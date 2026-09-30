'use client'
import { useEffect, useState } from 'react'

type DeferredPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>}
export default function InstallAppButton(){
  const [prompt,setPrompt]=useState<DeferredPrompt|null>(null);const [installed,setInstalled]=useState(false)
  useEffect(()=>{setInstalled(window.matchMedia('(display-mode: standalone)').matches);const onPrompt=(e:Event)=>{e.preventDefault();setPrompt(e as DeferredPrompt)};const onInstalled=()=>{setInstalled(true);setPrompt(null)};window.addEventListener('beforeinstallprompt',onPrompt);window.addEventListener('appinstalled',onInstalled);return()=>{window.removeEventListener('beforeinstallprompt',onPrompt);window.removeEventListener('appinstalled',onInstalled)}},[])
  if(installed||!prompt)return null
  return <button className="btn btnGhost compact" onClick={async()=>{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')setPrompt(null)}}>＋ Uygulamayı yükle</button>
}
