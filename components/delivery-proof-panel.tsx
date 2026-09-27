"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Image as ImageIcon, LoaderCircle, PenLine, RefreshCw, Trash2, Upload } from "lucide-react";
import { loadDeliveryProofs, removeDeliveryProof, uploadDeliveryProof } from "@/lib/cloud";
import type { DeliveryProof, DeliveryProofType } from "@/lib/types";

export default function DeliveryProofPanel({
  deliveryId,
  cloud,
  onSaved
}:{
  deliveryId:string;
  cloud:boolean;
  onSaved?:(type:DeliveryProofType)=>void;
}){
  const [proofs,setProofs]=useState<DeliveryProof[]>([]);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [signing,setSigning]=useState(false);
  const [hasInk,setHasInk]=useState(false);
  const cameraRef=useRef<HTMLInputElement|null>(null);
  const uploadRef=useRef<HTMLInputElement|null>(null);
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const drawing=useRef(false);

  const refresh=useCallback(async()=>{
    if(!cloud){setProofs([]);return}
    setLoading(true);
    setError("");
    try{
      setProofs(await loadDeliveryProofs(deliveryId));
    }catch(err:any){
      const msg=err?.message||"Teslimat kanıtları yüklenemedi.";
      setError(msg.includes("delivery_proofs")||msg.includes("delivery-proofs")
        ?"Teslimat kanıtı altyapısı Supabase veritabanında henüz etkin değil."
        :msg);
    }finally{
      setLoading(false);
    }
  },[cloud,deliveryId]);

  useEffect(()=>{refresh()},[refresh]);

  const prepareCanvas=useCallback(()=>{
    const canvas=canvasRef.current;
    if(!canvas)return;
    const rect=canvas.getBoundingClientRect();
    const dpr=Math.max(1,window.devicePixelRatio||1);
    canvas.width=Math.max(1,Math.floor(rect.width*dpr));
    canvas.height=Math.floor(220*dpr);
    const ctx=canvas.getContext("2d");
    if(!ctx)return;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle="#ffffff";
    ctx.fillRect(0,0,rect.width,220);
    ctx.strokeStyle="#111111";
    ctx.lineWidth=2.4;
    ctx.lineCap="round";
    ctx.lineJoin="round";
    setHasInk(false);
  },[]);

  useEffect(()=>{
    if(!signing)return;
    const id=window.requestAnimationFrame(prepareCanvas);
    const onResize=()=>prepareCanvas();
    window.addEventListener("resize",onResize);
    return()=>{window.cancelAnimationFrame(id);window.removeEventListener("resize",onResize)};
  },[signing,prepareCanvas]);

  function point(event:React.PointerEvent<HTMLCanvasElement>){
    const canvas=canvasRef.current!;
    const rect=canvas.getBoundingClientRect();
    return {x:event.clientX-rect.left,y:event.clientY-rect.top};
  }

  function pointerDown(event:React.PointerEvent<HTMLCanvasElement>){
    const canvas=canvasRef.current;
    const ctx=canvas?.getContext("2d");
    if(!canvas||!ctx)return;
    drawing.current=true;
    canvas.setPointerCapture(event.pointerId);
    const p=point(event);
    ctx.beginPath();
    ctx.moveTo(p.x,p.y);
  }

  function pointerMove(event:React.PointerEvent<HTMLCanvasElement>){
    if(!drawing.current)return;
    const ctx=canvasRef.current?.getContext("2d");
    if(!ctx)return;
    const p=point(event);
    ctx.lineTo(p.x,p.y);
    ctx.stroke();
    setHasInk(true);
  }

  function pointerUp(event:React.PointerEvent<HTMLCanvasElement>){
    drawing.current=false;
    try{canvasRef.current?.releasePointerCapture(event.pointerId)}catch{}
  }

  async function optimizePhoto(file:File){
    if(file.size<2*1024*1024 || !file.type.match(/^image\/(jpeg|jpg|png|webp)$/i))return file;
    try{
      const bitmap=await createImageBitmap(file);
      const max=1920;
      const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
      const width=Math.max(1,Math.round(bitmap.width*scale));
      const height=Math.max(1,Math.round(bitmap.height*scale));
      const canvas=document.createElement("canvas");
      canvas.width=width;
      canvas.height=height;
      const ctx=canvas.getContext("2d");
      if(!ctx){bitmap.close();return file}
      ctx.drawImage(bitmap,0,0,width,height);
      bitmap.close();
      const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",.86));
      if(!blob || blob.size>=file.size)return file;
      return new File([blob],file.name.replace(/\.[^.]+$/,"")+".jpg",{type:"image/jpeg",lastModified:Date.now()});
    }catch{
      return file;
    }
  }

  async function upload(file:File,type:DeliveryProofType){
    if(!cloud){
      setError("Fotoğraf ve imza kaydı için canlı Supabase bağlantısı gerekli.");
      return;
    }
    setBusy(true);
    setError("");
    try{
      const ready=type==="photo"?await optimizePhoto(file):file;
      const proof=await uploadDeliveryProof(deliveryId,ready,type);
      setProofs(current=>[proof,...current]);
      onSaved?.(type);
    }catch(err:any){
      const msg=err?.message||"Teslimat kanıtı kaydedilemedi.";
      setError(msg.includes("delivery_proofs")||msg.includes("delivery-proofs")
        ?"Supabase tarafında delivery_proofs tablosu ve delivery-proofs bucket'ı kurulmalı."
        :msg);
    }finally{
      setBusy(false);
    }
  }

  async function pick(event:React.ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];
    event.target.value="";
    if(file)await upload(file,"photo");
  }

  async function saveSignature(){
    const canvas=canvasRef.current;
    if(!canvas||!hasInk)return;
    setBusy(true);
    setError("");
    try{
      const blob=await new Promise<Blob>((resolve,reject)=>{
        canvas.toBlob(value=>value?resolve(value):reject(new Error("İmza görseli oluşturulamadı.")),"image/png",0.95);
      });
      const file=new File([blob],`imza-${deliveryId}.png`,{type:"image/png"});
      await upload(file,"signature");
      setSigning(false);
    }catch(err:any){
      setError(err?.message||"İmza kaydedilemedi.");
      setBusy(false);
    }
  }

  async function removeProof(proof:DeliveryProof){
    if(!window.confirm(proof.proofType==="signature"?"Müşteri imzası silinsin mi?":"Teslimat fotoğrafı silinsin mi?"))return;
    setBusy(true);
    setError("");
    try{
      await removeDeliveryProof(proof);
      setProofs(current=>current.filter(item=>item.id!==proof.id));
    }catch(err:any){
      setError(err?.message||"Teslimat kanıtı silinemedi.");
    }finally{
      setBusy(false);
    }
  }

  const photos=proofs.filter(x=>x.proofType==="photo");
  const signatures=proofs.filter(x=>x.proofType==="signature");

  return <section className="detailSection proofSection">
    <div className="detailSectionHead">
      <span><Camera size={16}/></span>
      <div><small>TESLİMAT KANITI</small><b>Fotoğraf ve müşteri imzası</b></div>
      <button className="proofRefresh" onClick={refresh} disabled={!cloud||loading} aria-label="Kanıtları yenile"><RefreshCw size={14}/></button>
    </div>

    <input ref={cameraRef} className="proofFileInput" type="file" accept="image/*" capture="environment" onChange={pick}/>
    <input ref={uploadRef} className="proofFileInput" type="file" accept="image/*" onChange={pick}/>

    {!cloud?<div className="proofCloudNotice"><span>Canlı bağlantı gerekli</span><p>Fotoğraf ve imza, yalnız Supabase bağlıyken güvenli olarak saklanır.</p></div>:null}

    <div className="proofActions">
      <button className="proofAction camera" disabled={busy||!cloud} onClick={()=>cameraRef.current?.click()}><Camera/><span><b>Fotoğraf çek</b><small>Telefon kamerasını aç</small></span></button>
      <button className="proofAction upload" disabled={busy||!cloud} onClick={()=>uploadRef.current?.click()}><Upload/><span><b>Galeriden seç</b><small>Fotoğraf yükle</small></span></button>
      <button className="proofAction signature" disabled={busy||!cloud} onClick={()=>setSigning(v=>!v)}><PenLine/><span><b>Müşteri imzası</b><small>Ekrana imza attır</small></span></button>
    </div>

    {signing?<div className="signaturePad">
      <div className="signaturePadHead"><div><b>Müşteri imzası</b><small>Parmak veya kalemle beyaz alana imza atın.</small></div><button onClick={prepareCanvas}><Trash2 size={14}/>Temizle</button></div>
      <canvas
        ref={canvasRef}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onPointerLeave={event=>{if(drawing.current)pointerUp(event)}}
        aria-label="Müşteri imza alanı"
      />
      <div className="signaturePadActions">
        <button className="soft" onClick={()=>setSigning(false)}>Vazgeç</button>
        <button className="primary" disabled={!hasInk||busy} onClick={saveSignature}>{busy?<LoaderCircle className="spin"/>:<Check/>}İmzayı kaydet</button>
      </div>
    </div>:null}

    {error?<div className="proofError">{error}</div>:null}
    {loading?<div className="proofLoading"><LoaderCircle className="spin"/>Kanıtlar yükleniyor…</div>:null}

    {!loading&&proofs.length?<div className="proofGallery">
      {proofs.map(proof=><article className={"proofCard "+proof.proofType} key={proof.id}>
        <a href={proof.signedUrl} target="_blank" rel="noreferrer">
          <div className="proofPreview">
            {proof.signedUrl?<img src={proof.signedUrl} alt={proof.proofType==="signature"?"Müşteri imzası":"Teslimat fotoğrafı"}/>:<ImageIcon/>}
            <span>{proof.proofType==="signature"?"İMZA":"FOTOĞRAF"}</span>
          </div>
          <p><b>{proof.proofType==="signature"?"Müşteri imzası":"Teslimat fotoğrafı"}</b><small>{new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(proof.createdAt))}</small></p>
        </a>
        <button className="proofDelete" disabled={busy} onClick={()=>removeProof(proof)} aria-label="Teslimat kanıtını sil"><Trash2 size={13}/></button>
      </article>)}
    </div>:null}

    {!loading&&cloud&&!proofs.length&&!error?<div className="proofEmpty"><ImageIcon/><div><b>Henüz teslimat kanıtı yok</b><span>Fotoğraf çekebilir veya müşteriden imza alabilirsin.</span></div></div>:null}

    {photos.length||signatures.length?<div className="proofSummary"><span>{photos.length} fotoğraf</span><span>{signatures.length} imza</span></div>:null}
  </section>;
}
