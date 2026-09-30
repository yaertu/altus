'use client'
import { useState } from 'react'

export default function TrackingShare({token}:{token:string}){
  const [done,setDone]=useState(false)
  async function share(){
    const url=`${window.location.origin}/track/${token}`
    if(navigator.share){try{await navigator.share({title:'Teslimat Takibi',text:'Teslimat durumunuzu bu bağlantıdan takip edebilirsiniz.',url});return}catch{}}
    await navigator.clipboard.writeText(url);setDone(true);window.setTimeout(()=>setDone(false),1800)
  }
  return <button type="button" className="btn btnSoft" onClick={share}>{done?'✓ Takip linki kopyalandı':'↗ Müşteri takip linki'}</button>
}
