"use client";

import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Navigation, RefreshCw } from "lucide-react";

type Point={lat:number;lon:number};
type RouteState="idle"|"locating"|"ready"|"error";

export default function LiveRouteMap({address,district,city,navigationUrl}:{address:string;district:string;city:string;navigationUrl:string}){
  const destination=[address,district,city].filter(Boolean).join(", ");
  const mapsKey=process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY?.trim()||"";
  const [current,setCurrent]=useState<Point>();
  const [state,setState]=useState<RouteState>("idle");
  const [error,setError]=useState("");
  const watchRef=useRef<number|undefined>(undefined);
  const lastUpdateRef=useRef(0);

  const mapUrl=mapsKey&&current
    ? `https://www.google.com/maps/embed/v1/directions?key=${encodeURIComponent(mapsKey)}&origin=${current.lat},${current.lon}&destination=${encodeURIComponent(destination)}&mode=driving`
    : "https://www.google.com/maps?q="+encodeURIComponent(destination)+"&output=embed";

  function startLiveRoute(){
    if(!navigator.geolocation){setState("error");setError("Bu cihaz konum bilgisini desteklemiyor.");return}
    if(!mapsKey){
      setState("error");
      setError("Uygulama içi canlı rota henüz etkin değil. Aşağıdaki Google Maps tuşuyla navigasyonu başlat.");
      return;
    }
    if(watchRef.current!==undefined)navigator.geolocation.clearWatch(watchRef.current);
    setState("locating");
    setError("");
    watchRef.current=navigator.geolocation.watchPosition(position=>{
      const now=Date.now();
      if(now-lastUpdateRef.current<12000)return;
      lastUpdateRef.current=now;
      setCurrent({lat:position.coords.latitude,lon:position.coords.longitude});
      setState("ready");
    },reason=>{
      setState("error");
      setError(reason.code===1?"Konum izni kapalı. İzni aç veya Google Maps ile devam et.":"Konum alınamadı. Açık alana çıkıp tekrar dene.");
    },{enableHighAccuracy:true,maximumAge:10000,timeout:15000});
  }

  useEffect(()=>()=>{if(watchRef.current!==undefined)navigator.geolocation.clearWatch(watchRef.current)},[]);

  return <div className="liveRoute">
    <div className="liveRouteCanvas">
      <iframe title="Müşteriye canlı rota" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen src={mapUrl}/>
      <span className="liveRouteBadge"><i className={state==="ready"?"on":""}/>{state==="ready"?"CANLI ROTA":"MÜŞTERİ KONUMU"}</span>
    </div>

    {state==="idle"&&mapsKey?<button className="liveRouteStart" onClick={startLiveRoute}><LocateFixed/><span><b>KONUMUMU BUL, ROTAYI ÇİZ</b><small>Bulunduğun yerden müşteri adresine</small></span></button>:null}
    {state==="locating"?<div className="liveRouteProgress"><RefreshCw/><div><b>Konumun bulunuyor…</b><small>İzin penceresinden “İzin ver” seç.</small></div></div>:null}
    {state==="ready"?<div className="liveRouteReady"><LocateFixed/><div><b>Canlı rota açık</b><small>Hareket ettikçe başlangıç konumun güncellenir.</small></div><button onClick={startLiveRoute}><RefreshCw/>Yenile</button></div>:null}
    {state==="error"?<div className="liveRouteError"><MapPin/><div><b>{error}</b><small>Müşteri adresi haritada görünmeye devam eder.</small></div>{mapsKey?<button onClick={startLiveRoute}>Tekrar dene</button>:null}</div>:null}
    <a className="liveRouteExternal" href={navigationUrl} target="_blank" rel="noreferrer"><Navigation/><span><b>YOL TARİFİNİ BAŞLAT</b><small>Bulunduğun konumdan Google Maps navigasyonu</small></span></a>
    <small className="liveRoutePrivacy">Müşteri adresi ve rota Google Maps üzerinden gösterilir.</small>
  </div>;
}
