import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const runtime = "nodejs";

type PushError = { statusCode?: number };

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

  if (!url || !serviceKey || !vapidPublic || !vapidPrivate) {
    return NextResponse.json({ sent:false, reason:"push_not_configured" },{ status:503 });
  }

  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ sent:false, reason:"unauthorized" },{ status:401 });
  }

  const admin = createClient(url,serviceKey,{
    auth:{ persistSession:false, autoRefreshToken:false }
  });

  const token = authorization.slice(7);
  const { data:{ user }, error:userError } = await admin.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ sent:false, reason:"unauthorized" },{ status:401 });
  }

  let deliveryId = "";
  try {
    const body = await req.json();
    deliveryId = typeof body?.deliveryId === "string" ? body.deliveryId : "";
  } catch {
    return NextResponse.json({ sent:false, reason:"invalid_body" },{ status:400 });
  }
  if (!deliveryId) {
    return NextResponse.json({ sent:false, reason:"delivery_required" },{ status:400 });
  }

  const { data:profile, error:profileError } = await admin
    .from("profiles")
    .select("role,active")
    .eq("id",user.id)
    .maybeSingle();

  if (profileError || !profile?.active || !["admin","office"].includes(profile.role)) {
    return NextResponse.json({ sent:false, reason:"forbidden" },{ status:403 });
  }

  const { data:delivery, error:deliveryError } = await admin
    .from("deliveries")
    .select("id,order_no,time_window,assignee_id")
    .eq("id",deliveryId)
    .maybeSingle();

  if (deliveryError) {
    return NextResponse.json({ sent:false, reason:"delivery_lookup_failed" },{ status:500 });
  }
  if (!delivery?.assignee_id) {
    return NextResponse.json({ sent:false, reason:"no_target" },{ status:200 });
  }

  const { data:staff, error:staffError } = await admin
    .from("staff")
    .select("user_id")
    .eq("id",delivery.assignee_id)
    .maybeSingle();

  if (staffError) {
    return NextResponse.json({ sent:false, reason:"staff_lookup_failed" },{ status:500 });
  }
  if (!staff?.user_id) {
    return NextResponse.json({ sent:false, reason:"no_target" },{ status:200 });
  }

  const { data:subscriptions, error:subscriptionError } = await admin
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .eq("user_id",staff.user_id);

  if (subscriptionError) {
    return NextResponse.json({ sent:false, reason:"subscription_lookup_failed" },{ status:500 });
  }
  if (!subscriptions?.length) {
    return NextResponse.json({ sent:false, reason:"no_subscription" },{ status:200 });
  }

  webpush.setVapidDetails(subject,vapidPublic,vapidPrivate);
  let sent = 0;

  await Promise.all(subscriptions.map(async subscription => {
    try {
      await webpush.sendNotification(
        {
          endpoint:subscription.endpoint,
          keys:{ p256dh:subscription.p256dh, auth:subscription.auth }
        },
        JSON.stringify({
          title:"Yeni teslimat atandı",
          body:`${delivery.order_no} • ${delivery.time_window || "Saat bilgisi yok"}`,
          url:"/",
          tag:`delivery-${delivery.id}`
        })
      );
      sent += 1;
    } catch (error: unknown) {
      const statusCode = (error as PushError)?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("endpoint",subscription.endpoint);
      }
    }
  }));

  return NextResponse.json({ sent:sent>0, count:sent });
}
