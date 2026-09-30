'use client'

import {useEffect,useRef,useState} from 'react'
import {Camera,Check,ImageUp,RotateCcw} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'

export default function AvatarCropper({userId,currentUrl,name,enabled=true}:{userId:string;currentUrl:string|null;name:string;enabled?:boolean}){
  const canvasRef=useRef<HTMLCanvasElement|null>(null)
  const imageRef=useRef<HTMLImageElement|null>(null)
  const [sourceUrl,setSourceUrl]=useState<string|null>(null)
  const [zoom,setZoom]=useState(1)
  const [panX,setPanX]=useState(0)
  const [panY,setPanY]=useState(0)
  const [saving,setSaving]=useState(false)
  const [message,setMessage]=useState('')
  const [avatar,setAvatar]=useState(currentUrl)

  function draw(canvas:HTMLCanvasElement,size:number){
    const img=imageRef.current;if(!img)return
    canvas.width=size;canvas.height=size
    const ctx=canvas.getContext('2d');if(!ctx)return
    ctx.clearRect(0,0,size,size)
    const cover=Math.max(size/img.naturalWidth,size/img.naturalHeight)
    const scale=cover*zoom
    const w=img.naturalWidth*scale,h=img.naturalHeight*scale
    const overflowX=Math.max(0,w-size),overflowY=Math.max(0,h-size)
    const x=-overflowX/2+(panX/100)*(overflowX/2)
    const y=-overflowY/2+(panY/100)*(overflowY/2)
    ctx.drawImage(img,x,y,w,h)
  }

  useEffect(()=>{if(canvasRef.current)draw(canvasRef.current,320)},[sourceUrl,zoom,panX,panY])

  function choose(file:File|null){
    setMessage('')
    if(!file)return
    if(!/^image\/(jpeg|png|webp)$/.test(file.type)){setMessage('JPG, PNG veya WebP seç.');return}
    if(file.size>6*1024*1024){setMessage('Görsel en fazla 6 MB olabilir.');return}
    if(sourceUrl)URL.revokeObjectURL(sourceUrl)
    const url=URL.createObjectURL(file);setSourceUrl(url);setZoom(1);setPanX(0);setPanY(0)
    const img=new Image();img.onload=()=>{imageRef.current=img;if(canvasRef.current)draw(canvasRef.current,320)};img.src=url
  }

  async function save(){
    if(!imageRef.current)return
    setSaving(true);setMessage('')
    try{
      const out=document.createElement('canvas');draw(out,512)
      const blob=await new Promise<Blob>((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(new Error('Görsel hazırlanamadı.')),'image/webp',.9))
      const supabase=createClient()
      const path=`${userId}/avatar-${Date.now()}.webp`
      const {error:uploadError}=await supabase.storage.from('courier-avatars').upload(path,blob,{contentType:'image/webp',upsert:false})
      if(uploadError)throw uploadError
      const {data:urlData}=supabase.storage.from('courier-avatars').getPublicUrl(path)
      const {error:profileError}=await supabase.from('courier_profile_media').upsert({user_id:userId,avatar_url:urlData.publicUrl,updated_at:new Date().toISOString()},{onConflict:'user_id'})
      if(profileError)throw profileError
      setAvatar(urlData.publicUrl);setSourceUrl(null);imageRef.current=null;setMessage('Profil fotoğrafı güncellendi.')
    }catch(e){setMessage(e instanceof Error?e.message:'Fotoğraf kaydedilemedi.')}
    finally{setSaving(false)}
  }

  const initials=name.split(' ').filter(Boolean).map(x=>x[0]).slice(0,2).join('').toUpperCase()
  return <div className="avatarStudio">
    <div className="avatarStudioCurrent">{avatar?<img src={avatar} alt="Kurye avatarı"/>:<span>{initials}</span>}{enabled&&<label title="Fotoğraf seç"><Camera size={16}/><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>choose(e.target.files?.[0]||null)}/></label>}</div>
    {sourceUrl&&<div className="avatarEditor">
      <div className="avatarCanvasWrap"><canvas ref={canvasRef}/><span className="avatarCropRing"/></div>
      <div className="avatarSliders">
        <label>Yakınlık <input type="range" min="1" max="2.6" step=".05" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label>
        <label>Yatay <input type="range" min="-100" max="100" value={panX} onChange={e=>setPanX(Number(e.target.value))}/></label>
        <label>Dikey <input type="range" min="-100" max="100" value={panY} onChange={e=>setPanY(Number(e.target.value))}/></label>
      </div>
      <div className="avatarEditorActions"><button type="button" className="btn btnGhost" onClick={()=>{setZoom(1);setPanX(0);setPanY(0)}}><RotateCcw size={14}/> Sıfırla</button><button type="button" className="btn btnPrimary" disabled={saving} onClick={save}>{saving?'Yükleniyor…':<><Check size={14}/> Kırp ve kaydet</>}</button></div>
    </div>}
    {!enabled?<small className="avatarMessage">Profil görseli altyapısı henüz etkin değil.</small>:!sourceUrl&&<label className="avatarUploadButton"><ImageUp size={15}/> Fotoğraf ekle / değiştir<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>choose(e.target.files?.[0]||null)}/></label>}
    {message&&<small className="avatarMessage">{message}</small>}
  </div>
}
