'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { enqueueProof, enqueueStatus, flushOfflineQueue, makeProofPath } from '@/lib/offline-queue'
import { getLocationSnapshot } from '@/lib/field-location'
import type { Delivery } from '@/lib/types'

async function compressPhoto(file: File) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .82))
    return blob && blob.size < file.size ? blob : file
  } catch { return file }
}

export default function DeliveryProof({delivery,userId,existing}:{delivery:Delivery;userId:string;existing:{proof_type:string}[]}){
  const router=useRouter()
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const drawing=useRef(false)
  const signatureDirty=useRef(false)
  const [photo,setPhoto]=useState(existing.some(x=>x.proof_type==='photo'))
  const [signature,setSignature]=useState(existing.some(x=>x.proof_type==='signature'))
  const [busy,setBusy]=useState('')
  const [err,setErr]=useState('')
  const [message,setMessage]=useState('')

  function point(e:React.PointerEvent<HTMLCanvasElement>){const c=canvasRef.current!;const r=c.getBoundingClientRect();return {x:(e.clientX-r.left)*(c.width/r.width),y:(e.clientY-r.top)*(c.height/r.height)}}
  function start(e:React.PointerEvent<HTMLCanvasElement>){drawing.current=true;signatureDirty.current=true;const c=canvasRef.current!;c.setPointerCapture(e.pointerId);const p=point(e),ctx=c.getContext('2d')!;ctx.beginPath();ctx.moveTo(p.x,p.y)}
  function move(e:React.PointerEvent<HTMLCanvasElement>){if(!drawing.current)return;const c=canvasRef.current!,p=point(e),ctx=c.getContext('2d')!;ctx.lineWidth=4;ctx.lineCap='round';ctx.strokeStyle='#20171d';ctx.lineTo(p.x,p.y);ctx.stroke()}
  function stop(){drawing.current=false}
  function clear(){const c=canvasRef.current!,ctx=c.getContext('2d')!;ctx.clearRect(0,0,c.width,c.height);signatureDirty.current=false;setSignature(false)}

  async function stageProof(blob:Blob,type:'photo'|'signature',ext:string){
    const path=makeProofPath(delivery.org_id,delivery.id,userId,type,ext)
    await enqueueProof({kind:'proof_upload',deliveryId:delivery.id,payload:{orgId:delivery.org_id,userId,proofType:type,mimeType:blob.type||'application/octet-stream',extension:ext,storagePath:path},blob})
    if(navigator.onLine){const supabase=createClient();const result=await flushOfflineQueue(supabase);if(result.remaining>0)throw new Error('Kanıt senkronizasyon kuyruğunda bekliyor')}
    return path
  }

  async function photoChanged(e:React.ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];if(!file)return
    try{setBusy('photo');setErr('');setMessage('');const blob=await compressPhoto(file);await stageProof(blob,'photo','jpg');setPhoto(true);setMessage(navigator.onLine?'Fotoğraf güvenli şekilde kaydedildi.':'Fotoğraf cihazda saklandı; internet gelince otomatik yüklenecek.');router.refresh()}catch(x){setErr(x instanceof Error?x.message:'Fotoğraf kaydedilemedi')}finally{setBusy('')}
  }

  async function saveSignature(){
    const c=canvasRef.current;if(!c||!signatureDirty.current){setErr('Önce müşteriden imza alın.');return}
    try{setBusy('signature');setErr('');setMessage('');const blob=await new Promise<Blob>((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('İmza oluşturulamadı')),'image/png'));await stageProof(blob,'signature','png');setSignature(true);setMessage(navigator.onLine?'İmza kaydedildi.':'İmza cihazda saklandı; internet gelince otomatik yüklenecek.');router.refresh()}catch(x){setErr(x instanceof Error?x.message:'İmza kaydedilemedi')}finally{setBusy('')}
  }

  async function finish(){
    try{
      setBusy('finish');setErr('');setMessage('')
      const loc=await getLocationSnapshot()
      if(!navigator.onLine){
        await enqueueStatus(delivery.id,{status:'delivered',lat:loc.lat,lng:loc.lng,accuracy:loc.accuracy})
        setMessage('Teslimat çevrimdışı tamamlandı. Kanıtlar ve durum internet gelince sırayla gönderilecek.')
        window.setTimeout(()=>router.push('/courier'),800);return
      }
      const supabase=createClient();await flushOfflineQueue(supabase)
      const {error}=await supabase.from('deliveries').update({status:'delivered',last_event_lat:loc.lat,last_event_lng:loc.lng,last_event_accuracy_m:loc.accuracy}).eq('id',delivery.id)
      if(error)throw error
      router.push('/courier');router.refresh()
    }catch(x){setErr(x instanceof Error?x.message:'Teslimat tamamlanamadı')}finally{setBusy('')}
  }

  const ready=(!delivery.requires_photo||photo)&&(!delivery.requires_signature||signature)
  return <div className="panel proofPanel"><div className="panelHead"><div><span className="eyebrow">ePOD</span><h2>Teslimat kanıtı</h2><p>Fotoğraf ve imza zorunlulukları tamamlanmadan teslimat kapanmaz.</p></div>{ready?<span className="badge s-delivered">✓ Hazır</span>:<span className="badge s-new">Eksik kanıt</span>}</div>
    {err&&<div className="error">{err}</div>}{message&&<div className="success">{message}</div>}
    <div className="proofGrid">
      <div className="cameraBox"><div className="proofTitle"><span>📷</span><div><strong>Teslimat fotoğrafı {delivery.requires_photo&&'*'}</strong><p>Net, ürünü ve teslim alanını gösterecek bir kare çek.</p></div></div>{photo&&<div className="proofDone">✓ Fotoğraf hazır</div>}<label className="btn btnGhost proofButton">{busy==='photo'?'Hazırlanıyor…':'Kamerayı Aç'}<input hidden type="file" accept="image/*" capture="environment" onChange={photoChanged}/></label><small className="proofHint">Fotoğraflar yükleme öncesi otomatik küçültülür; bağlantı yoksa cihazın yerel tarayıcı depolamasında kuyruklanır.</small></div>
      <div className="signatureBox"><div className="proofTitle"><span>✍</span><div><strong>Müşteri imzası {delivery.requires_signature&&'*'}</strong><p>Müşteri aşağıdaki geniş alana parmağıyla imza atabilir.</p></div></div>{signature&&<div className="proofDone">✓ İmza hazır</div>}<canvas ref={canvasRef} width={900} height={340} className="signatureCanvas" onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop}/><div className="proofActions"><button type="button" className="btn btnGhost" onClick={clear}>Temizle</button><button type="button" className="btn btnSoft" onClick={saveSignature} disabled={busy==='signature'}>{busy==='signature'?'Kaydediliyor…':'İmzayı Kaydet'}</button></div></div>
    </div>
    <button className="btn btnPrimary finishDelivery" disabled={!ready||busy==='finish'} onClick={finish}>{busy==='finish'?'Tamamlanıyor…':'Teslimatı Tamamla ✓'}</button>
  </div>
}
