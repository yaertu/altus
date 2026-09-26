"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, Share2, Smartphone } from "lucide-react";
import WebIcon from "./web-icon";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome:"accepted"|"dismissed"; platform:string }>;
};

export default function InstallPwaCard(){
  const [installed,setInstalled]=useState(false);
  const [prompt,setPrompt]=useState<BeforeInstallPromptEvent|null>(null);
  const [ios,setIos]=useState(false);

  useEffect(()=>{
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const handler=(event:Event)=>{ event.preventDefault(); setPrompt(event as BeforeInstallPromptEvent); };
    window.addEventListener("beforeinstallprompt",handler);
    return()=>window.removeEventListener("beforeinstallprompt",handler);
  },[]);

  if(installed) return <div className="installCard installed"><span><CheckCircle2/></span><div><b>Uygulama bu cihazda kurulu</b><small>Ana ekrandan yaaTeslimat gibi normal bir uygulama olarak açabilirsin.</small></div></div>;

  async function install(){
    if(!prompt)return;
    await prompt.prompt();
    const choice=await prompt.userChoice;
    if(choice.outcome==="accepted") setInstalled(true);
    setPrompt(null);
  }

  return <div className="installCard">
    <div className="installArt"><WebIcon name="truck-fast-outline" size={42}/><Smartphone/></div>
    <div className="installCopy">
      <small>TELEFONA KUR</small>
      <b>Sevkiyatçının işi tek dokunuş olsun.</b>
      {ios
        ? <p><Share2/> Safari’de <strong>Paylaş</strong> → <strong>Ana Ekrana Ekle</strong> → uygulamayı aç → <strong>Bildirimleri Aç</strong>.</p>
        : <p><Download/> Uygulamayı telefona kur. Sonra görevler tarayıcı sekmesi olmadan uygulama gibi açılır.</p>}
    </div>
    {prompt?<button className="primary" onClick={install}><Download size={16}/>Şimdi kur</button>:null}
  </div>;
}
