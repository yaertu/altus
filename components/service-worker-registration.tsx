'use client'
import { useEffect } from 'react'
export default function ServiceWorkerRegistration(){
  useEffect(()=>{ if('serviceWorker' in navigator) navigator.serviceWorker.register('/push-sw.js').catch(()=>{}) },[])
  return null
}
