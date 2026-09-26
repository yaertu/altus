import { supabase } from "./supabase";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function enablePushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Bu cihaz Web Push desteklemiyor.");
  if (!supabase) throw new Error("Bulut bağlantısı kapalı.");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("VAPID public key tanımlı değil.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Bildirim izni verilmedi.");

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:urlBase64ToUint8Array(publicKey)
    });
  }

  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Bildirim kaydı için giriş yapmalısın.");
  const json:any = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id:user.id,
    endpoint:subscription.endpoint,
    p256dh:json.keys?.p256dh,
    auth:json.keys?.auth,
    user_agent:navigator.userAgent,
    updated_at:new Date().toISOString()
  },{onConflict:"endpoint"});
  if (error) throw error;
  return true;
}

export async function sendAssignmentPush(deliveryId: string) {
  if (!supabase) return false;
  const { data:{ session } } = await supabase.auth.getSession();
  if (!session?.access_token) return false;
  const res = await fetch("/api/push/send", {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":"Bearer "+session.access_token
    },
    body:JSON.stringify({deliveryId})
  });
  if (!res.ok) return false;
  const data = await res.json();
  return Boolean(data.sent);
}
