import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!url || !serviceKey || !vapidPublic || !vapidPrivate) return NextResponse.json({ sent:false, reason:"push_not_configured" },{status:503});

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return NextResponse.json({sent:false,reason:"unauthorized"},{status:401});

  const admin = createClient(url,serviceKey,{auth:{persistSession:false}});
  const token = auth.slice(7);
  const { data:{ user }, error:userError } = await admin.auth.getUser(token);
  if (userError || !user) return NextResponse.json({sent:false,reason:"unauthorized"},{status:401});

  const body = await req.json();
  const deliveryId = String(body.deliveryId || "");
  const { data:profile } = await admin.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if (!profile || !["admin","office"].includes(profile.role)) return NextResponse.json({sent:false,reason:"forbidden"},{status:403});

  const { data:delivery } = await admin.from("deliveries").select("id,order_no,customer_name,delivery_date,time_window,assignee_id,staff:assignee_id(user_id)").eq("id",deliveryId).maybeSingle();
  const staff:any = Array.isArray((delivery as any)?.staff) ? (delivery as any)?.staff[0] : (delivery as any)?.staff;
  const targetUserId = staff?.user_id;
  if (!delivery || !targetUserId) return NextResponse.json({sent:false,reason:"no_target"},{status:200});

  const { data:subs } = await admin.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id",targetUserId);
  if (!subs?.length) return NextResponse.json({sent:false,reason:"no_subscription"},{status:200});

  webpush.setVapidDetails(subject,vapidPublic,vapidPrivate);
  let sent=0;
  await Promise.all(subs.map(async(s:any)=>{
    try{
      await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({
        title:"Yeni teslimat atandı",
        body:(delivery as any).order_no+" • "+(delivery as any).time_window,
        url:"/"
      }));
      sent++;
    }catch(err:any){
      if(err?.statusCode===404 || err?.statusCode===410) await admin.from("push_subscriptions").delete().eq("endpoint",s.endpoint);
    }
  }));
  return NextResponse.json({sent:sent>0,count:sent});
}
