import { supabase } from "./supabase";

function urlBase64ToUint8Array(base64String:string){
  const padding="=".repeat((4-(base64String.length%4))%4);
  const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");
  const rawData=window.atob(base64);
  return Uint8Array.from([...rawData].map(char=>char.charCodeAt(0)));
}

async function getVapidPublicKey(){
  const fromEnv=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if(fromEnv)return fromEnv;
  if(!supabase)throw new Error("Bulut bağlantısı kapalı.");

  const {data,error}=await supabase.functions.invoke("push-service",{
    body:{action:"public-key"}
  });
  if(error)throw error;
  if(!data?.ok||!data?.publicKey)throw new Error("Bildirim anahtarı alınamadı.");
  return String(data.publicKey);
}

async function saveSubscription(subscription:PushSubscription){
  if(!supabase)throw new Error("Bulut bağlantısı kapalı.");
  const {data:{user},error:userError}=await supabase.auth.getUser();
  if(userError)throw userError;
  if(!user)throw new Error("Bildirim kaydı için giriş yapmalısın.");

  const json:any=subscription.toJSON();
  const p256dh=json.keys?.p256dh;
  const auth=json.keys?.auth;
  if(!p256dh||!auth)throw new Error("Tarayıcı bildirim anahtarları alınamadı.");

  const {error}=await supabase.from("push_subscriptions").upsert({
    user_id:user.id,
    endpoint:subscription.endpoint,
    p256dh,
    auth,
    user_agent:navigator.userAgent,
    updated_at:new Date().toISOString()
  },{onConflict:"endpoint"});
  if(error)throw error;
}

async function ensurePushSubscription(){
  if(!("serviceWorker" in navigator)||!("PushManager" in window)){
    throw new Error("Bu cihaz Web Push desteklemiyor.");
  }
  if(!supabase)throw new Error("Bulut bağlantısı kapalı.");

  const publicKey=await getVapidPublicKey();
  const registration=await navigator.serviceWorker.ready;
  let subscription=await registration.pushManager.getSubscription();

  if(!subscription){
    subscription=await registration.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:urlBase64ToUint8Array(publicKey)
    });
  }

  await saveSubscription(subscription);
  return true;
}

export async function enablePushNotifications(){
  if(!("Notification" in window))throw new Error("Bu cihaz bildirimleri desteklemiyor.");
  const permission=await Notification.requestPermission();
  if(permission!=="granted")throw new Error("Bildirim izni verilmedi.");
  return ensurePushSubscription();
}

// Permission was already granted before. This does not show a new browser prompt.
// It re-validates the subscription on app open and recreates it when the browser dropped it.
export async function syncPushSubscription(){
  if(typeof window==="undefined"||!("Notification" in window))return false;
  if(Notification.permission!=="granted")return false;
  try{
    return await ensurePushSubscription();
  }catch{
    return false;
  }
}

export type PushSendResult={
  sent:boolean;
  count:number;
  reason?:string;
};

export async function sendAssignmentPush(deliveryId:string):Promise<PushSendResult>{
  if(!supabase)return {sent:false,count:0,reason:"cloud_unavailable"};

  try{
    const {data,error}=await supabase.functions.invoke("push-service",{
      body:{action:"send",deliveryId}
    });
    if(error)return {sent:false,count:0,reason:"request_failed"};

    return {
      sent:Boolean(data?.sent),
      count:Number(data?.count||0),
      reason:typeof data?.reason==="string"?data.reason:undefined
    };
  }catch{
    return {sent:false,count:0,reason:"network_error"};
  }
}
