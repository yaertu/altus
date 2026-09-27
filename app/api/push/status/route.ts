import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET(){
  const checks = {
    supabaseUrl:Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    serviceRole:Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    vapidPublic:Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    vapidPrivate:Boolean(process.env.VAPID_PRIVATE_KEY),
    vapidSubject:Boolean(process.env.VAPID_SUBJECT)
  };
  return NextResponse.json({
    configured:Object.values(checks).every(Boolean),
    checks
  },{
    headers:{"Cache-Control":"no-store"}
  });
}
