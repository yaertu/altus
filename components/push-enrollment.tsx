'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function decodeBase64Url(value:string){const padding='='.repeat((4-value.length%4)%4);const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}

type State='idle'|'working'|'done'|'error'|'unsupported'|'install'
export default function PushEnrollment({orgId,userId,compact=false}:{orgId:string,userId:string;compact?:boolean}){
  const [state,setState]=useState<State>('idle')
  const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  useEffect(()=>{
    if(!publicKey||!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)||!window.isSecureContext){setState('unsupported');return}
    const isiOS=/iPad|iPhone|iPod/.test(navigator.userAgent);const standalone=window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true
    if(isiOS&&!standalone){setState('install');return}
    void navigator.serviceWorker.ready.then(r=>r.pushManager.getSubscription()).then(s=>{if(s)setState('done')}).catch(()=>null)
  },[publicKey])
  if(!publicKey||state==='unsupported')return null

  async function enable(){
    if(state==='install'){alert('iPhone/iPad için önce tarayıcı Paylaş menüsünden “Ana Ekrana Ekle” ile uygulamayı kur, sonra bildirimleri aç.');return}
    try{
      setState('working')
      const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('permission')
      const reg=await navigator.serviceWorker.ready
      let sub=await reg.pushManager.getSubscription()
      if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeBase64Url(publicKey!)})
      const json=sub.toJSON();const supabase=createClient()
      const {error}=await supabase.from('push_subscriptions').upsert({org_id:orgId,user_id:userId,endpoint:sub.endpoint,p256dh:json.keys?.p256dh,auth_key:json.keys?.auth,user_agent:navigator.userAgent,last_seen_at:new Date().toISOString()},{onConflict:'endpoint'})
      if(error)throw error;setState('done')
    }catch{setState('error')}
  }
  const label=state==='done'?'✓ Bildirim açık':state==='working'?'Açılıyor…':state==='install'?'⌂ Kur ve bildirimi aç':state==='error'?'Bildirim iznini dene':'🔔 Bildirimleri aç'
  return <button type="button" aria-label="Push bildirimleri" title={label} className={`btn ${state==='done'?'btnSoft':'btnGhost'} ${compact?'compact':''}`} onClick={enable} disabled={state==='working'||state==='done'}>{compact&&state!=='install'?(state==='done'?'✓':'🔔'):label}</button>
}
