'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { CourierAvailability, Delivery, DeliveryStatus } from '@/lib/types'
import { NEXT_STATUS, NEXT_STATUS_LABEL } from '@/lib/constants'
import { enqueueStatus, flushOfflineQueue } from '@/lib/offline-queue'
import { getLocationSnapshot } from '@/lib/field-location'
import StatusPill from './status-pill'
import NotificationCenter from './notification-center'
import OfflineSyncStatus from './offline-sync-status'
import OperationsMap, { type RouteSummary } from './operations-map'
import ProductVisual from './product-visual'
import DeliveryStatusSteps from './delivery-status-steps'
import CourierNavigationMap from './courier-navigation-map'
import { Navigation, Phone, MapPinned, Volume2, VolumeX, X, ChevronUp, ClipboardList, History, UserRound, CirclePlus, Route as RouteIcon, CircleCheckBig, Coffee, Power, LocateFixed, MapPin, Trophy, Sparkles, Star } from 'lucide-react'

const FAILS=['Müşteriye ulaşılamadı','Müşteri adreste yok','Adres bulunamadı','Ürün hasarlı / eksik','Araç kaynaklı sorun','Teslimat müşteri tarafından ertelendi','Güvenli teslimat yapılamıyor']

function priorityValue(d:Delivery){if(d.priority==='urgent')return 0;if(d.priority==='priority')return 1;return 2}
function distanceLabel(m:number){return m>=1000?`${(m/1000).toFixed(m>=10000?0:1)} km`:`${Math.max(1,Math.round(m))} m`}
function etaLabel(s:number){const m=Math.max(1,Math.round(s/60));return m>=60?`${Math.floor(m/60)} sa ${m%60} dk`:`${m} dk`}
function metersBetween(a:{lat:number;lng:number},b:{lat:number;lng:number}){const r=6371000;const p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dp=(b.lat-a.lat)*Math.PI/180,dl=(b.lng-a.lng)*Math.PI/180;const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*r*Math.asin(Math.sqrt(h))}

type GrowthSummary={points:number;rankNo:number;rankTitle:string;rankColor:string;stars:number;avatarUrl:string|null;promotion:{title:string;rewardLabel:string;target:number}|null}

export default function CourierDashboard({initial,userId,orgId,name,preview=false,growth}:{initial:Delivery[];userId:string;orgId:string;name:string;preview?:boolean;growth?:GrowthSummary}){
  const [items,setItems]=useState(initial)
  const [busy,setBusy]=useState<string|null>(null)
  const [failure,setFailure]=useState<Delivery|null>(null)
  const [err,setErr]=useState('')
  const [notice,setNotice]=useState('')
  const [availability,setAvailabilityState]=useState<CourierAvailability>('available')
  const [locationSharing,setLocationSharing]=useState(false)
  const [selectedTaskId,setSelectedTaskId]=useState<string|null>(initial.find(x=>!['delivered','cancelled','failed'].includes(x.status))?.id||null)
  const [navigationMode,setNavigationMode]=useState(false)
  const [routeSummary,setRouteSummary]=useState<RouteSummary|null>(null)
  const [navRouteSummary,setNavRouteSummary]=useState<RouteSummary|null>(null)
  const [voiceGuidance,setVoiceGuidance]=useState(false)
  const [navSheet,setNavSheet]=useState<'peek'|'expanded'|'hidden'>('peek')
  const lastSpokenRef=useRef('')
  const voiceAudioRef=useRef<HTMLAudioElement|null>(null)
  const lastPresencePushRef=useRef(0)
  const [currentLocation,setCurrentLocation]=useState<{lat:number;lng:number;accuracy:number|null;heading:number|null;speed:number|null}|null>(preview?{lat:41.1578,lng:27.7972,accuracy:18,heading:72,speed:8.5}:null)
  const previousNewCount=useRef(initial.filter(x=>x.status==='new').length)
  const mapRef=useRef<HTMLDivElement|null>(null)

  const load=useCallback(async()=>{
    if(preview)return
    const supabase=createClient()
    const {data,error}=await supabase.from('deliveries').select('*').eq('assigned_courier_id',userId).order('created_at',{ascending:false}).limit(150)
    if(!error&&data){
      const next=data as Delivery[]
      const newCount=next.filter(x=>x.status==='new').length
      if(newCount>previousNewCount.current){setNotice('Yeni sevkiyat sıraya eklendi • mevcut navigasyon bölünmedi');if(navigator.vibrate)navigator.vibrate([160,80,160]);window.setTimeout(()=>setNotice(''),3500)}
      previousNewCount.current=newCount;setItems(next)
    }
  },[userId,preview])

  useEffect(()=>{if(preview)return;const supabase=createClient();let channel:ReturnType<typeof supabase.channel>|null=null;void(async()=>{await supabase.realtime.setAuth();channel=supabase.channel(`courier:${userId}:deliveries`,{config:{private:true}}).on('broadcast',{event:'*'},()=>{void load()}).subscribe()})();return()=>{if(channel)void supabase.removeChannel(channel)}},[load,userId,preview])
  useEffect(()=>{if(preview){setLocationSharing(true);return}setLocationSharing(localStorage.getItem('altus-location-sharing')==='1')},[preview])
  useEffect(()=>{
    if(preview){setAvailabilityState('available');return}
    const supabase=createClient();let active=true
    async function boot(){const {data}=await supabase.from('courier_presence').select('availability').eq('user_id',userId).maybeSingle();if(active&&data?.availability)setAvailabilityState(data.availability as CourierAvailability);if(navigator.onLine){const loc=locationSharing?await getLocationSnapshot():{lat:null,lng:null,accuracy:null};if(active&&loc.lat!==null&&loc.lng!==null)setCurrentLocation({lat:loc.lat,lng:loc.lng,accuracy:loc.accuracy,heading:null,speed:null});await supabase.from('courier_presence').upsert({user_id:userId,org_id:orgId,availability:data?.availability||'available',last_heartbeat_at:new Date().toISOString(),latitude:loc.lat,longitude:loc.lng,accuracy_m:loc.accuracy},{onConflict:'user_id'});await flushOfflineQueue(supabase).catch(()=>null)}}
    void boot();const timer=window.setInterval(()=>{if(!navigator.onLine)return;void(async()=>{const loc=locationSharing?await getLocationSnapshot():{lat:null,lng:null,accuracy:null};if(active&&loc.lat!==null&&loc.lng!==null)setCurrentLocation({lat:loc.lat,lng:loc.lng,accuracy:loc.accuracy,heading:null,speed:null});await supabase.from('courier_presence').upsert({user_id:userId,org_id:orgId,availability,last_heartbeat_at:new Date().toISOString(),latitude:loc.lat,longitude:loc.lng,accuracy_m:loc.accuracy},{onConflict:'user_id'})})()},60_000)
    return()=>{active=false;window.clearInterval(timer)}
  },[availability,locationSharing,orgId,userId,preview])


  useEffect(()=>{
    if(preview||!navigationMode||!locationSharing||!('geolocation' in navigator))return
    const watch=navigator.geolocation.watchPosition(
      pos=>{
        const next={lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:Number.isFinite(pos.coords.accuracy)?pos.coords.accuracy:null,heading:Number.isFinite(pos.coords.heading)?pos.coords.heading:null,speed:Number.isFinite(pos.coords.speed)?pos.coords.speed:null}
        setCurrentLocation(next)
        if(navigator.onLine&&Date.now()-lastPresencePushRef.current>10_000){
          lastPresencePushRef.current=Date.now();const supabase=createClient();void supabase.from('courier_presence').upsert({user_id:userId,org_id:orgId,availability,last_heartbeat_at:new Date().toISOString(),latitude:next.lat,longitude:next.lng,accuracy_m:next.accuracy,heading_deg:next.heading,speed_mps:next.speed},{onConflict:'user_id'})
        }
      },
      ()=>{},
      {enableHighAccuracy:true,maximumAge:1500,timeout:10_000}
    )
    return()=>navigator.geolocation.clearWatch(watch)
  },[availability,locationSharing,navigationMode,orgId,preview,userId])

  useEffect(()=>{
    if(!navigationMode||!voiceGuidance)return
    const instruction=navRouteSummary?.instructions?.[0]?.text?.trim()||navRouteSummary?.instructions?.[0]?.street_name?.trim()||''
    if(!instruction||instruction===lastSpokenRef.current)return
    lastSpokenRef.current=instruction
    let cancelled=false
    void(async()=>{
      try{
        const res=await fetch('/api/voice/navigation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:instruction})})
        if(res.ok&&!cancelled){const blob=await res.blob();const url=URL.createObjectURL(blob);voiceAudioRef.current?.pause();const audio=new Audio(url);voiceAudioRef.current=audio;audio.onended=()=>URL.revokeObjectURL(url);await audio.play();return}
      }catch{}
      const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      if(!mobile||!('speechSynthesis' in window)||cancelled)return
      const voices=window.speechSynthesis.getVoices();const turkish=voices.filter(v=>v.lang.toLowerCase().startsWith('tr'));const voice=turkish.find(v=>/(google|yandex)/i.test(v.name))||turkish[0]
      if(!voice)return
      window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(instruction);u.lang='tr-TR';u.voice=voice;u.rate=.96;window.speechSynthesis.speak(u)
    })()
    return()=>{cancelled=true}
  },[navRouteSummary,navigationMode,voiceGuidance])

  async function toggleLocation(){
    if(preview){setLocationSharing(v=>!v);setNotice(locationSharing?'Konum paylaşımı kapatıldı.':'Konum paylaşımı önizlemede açıldı.');return}
    if(locationSharing){localStorage.removeItem('altus-location-sharing');setLocationSharing(false);setNotice('Konum paylaşımı kapatıldı.');return}
    const loc=await getLocationSnapshot(7000);if(loc.lat===null||loc.lng===null){setErr('Konum alınamadı. Uygulama konum iznini kontrol et.');return}
    setCurrentLocation({lat:loc.lat,lng:loc.lng,accuracy:loc.accuracy,heading:null,speed:null});localStorage.setItem('altus-location-sharing','1');setLocationSharing(true);setNotice(`Konum paylaşımı açık • yaklaşık doğruluk ±${Math.round(loc.accuracy||0)} m`)
    if(navigator.onLine){const supabase=createClient();await supabase.from('courier_presence').upsert({user_id:userId,org_id:orgId,availability,last_heartbeat_at:new Date().toISOString(),latitude:loc.lat,longitude:loc.lng,accuracy_m:loc.accuracy},{onConflict:'user_id'})}
  }

  async function setAvailability(value:CourierAvailability){
    setAvailabilityState(value)
    if(preview){setNotice('Önizleme: mesai durumu güncellendi.');return}
    if(!navigator.onLine){setNotice('Durum internet gelince güncellenecek');return}
    const supabase=createClient();const now=new Date().toISOString();const loc=locationSharing?await getLocationSnapshot():{lat:null,lng:null,accuracy:null}
    if(loc.lat!==null&&loc.lng!==null)setCurrentLocation({lat:loc.lat,lng:loc.lng,accuracy:loc.accuracy,heading:null,speed:null})
    const {error}=await supabase.from('courier_presence').upsert({user_id:userId,org_id:orgId,availability:value,last_heartbeat_at:now,shift_started_at:value==='available'?now:undefined,break_started_at:value==='break'?now:null,latitude:loc.lat,longitude:loc.lng,accuracy_m:loc.accuracy},{onConflict:'user_id'})
    if(error)setErr(error.message)
  }

  async function move(d:Delivery,next:DeliveryStatus){
    setBusy(d.id);setErr('');setNotice('')
    if(preview){setItems(prev=>prev.map(x=>x.id===d.id?{...x,status:next}:x));setBusy(null);setNotice('Önizleme: görev durumu güncellendi.');return}
    const loc=await getLocationSnapshot();if(loc.lat!==null&&loc.lng!==null)setCurrentLocation({lat:loc.lat,lng:loc.lng,accuracy:loc.accuracy,heading:null,speed:null})
    if((next==='arrived'||next==='delivered')&&loc.lat!==null&&loc.lng!==null&&d.latitude!==null&&d.longitude!==null){const meters=Math.round(metersBetween({lat:loc.lat,lng:loc.lng},{lat:d.latitude,lng:d.longitude}));if(meters>500&&!window.confirm(`GPS teslimat noktasından yaklaşık ${meters} m uzakta görünüyor. Konum hatalıysa devam edebilirsin. İşleme devam edilsin mi?`)){setBusy(null);return}}
    if(!navigator.onLine){await enqueueStatus(d.id,{status:next,lat:loc.lat,lng:loc.lng,accuracy:loc.accuracy});setItems(prev=>prev.map(x=>x.id===d.id?{...x,status:next}:x));setNotice('İşlem çevrimdışı kaydedildi; internet gelince otomatik gönderilecek.');setBusy(null);return}
    const supabase=createClient();const {error}=await supabase.from('deliveries').update({status:next,last_event_lat:loc.lat,last_event_lng:loc.lng,last_event_accuracy_m:loc.accuracy}).eq('id',d.id);if(error)setErr(error.message);else await load();setBusy(null)
  }

  async function markFailed(reason:string){
    if(!failure)return
    if(preview){setItems(prev=>prev.map(x=>x.id===failure.id?{...x,status:'failed',failure_reason:reason}:x));setFailure(null);setNotice('Önizleme: sorun kaydı oluşturuldu.');return}
    setBusy(failure.id);setErr('');const loc=await getLocationSnapshot();if(loc.lat!==null&&loc.lng!==null)setCurrentLocation({lat:loc.lat,lng:loc.lng,accuracy:loc.accuracy,heading:null,speed:null})
    if(!navigator.onLine){await enqueueStatus(failure.id,{status:'failed',failure_reason:reason,lat:loc.lat,lng:loc.lng,accuracy:loc.accuracy});setItems(prev=>prev.map(x=>x.id===failure.id?{...x,status:'failed',failure_reason:reason}:x));setFailure(null);setBusy(null);setNotice('Sorun kaydı çevrimdışı kuyruğa alındı.');return}
    const supabase=createClient();const {error}=await supabase.from('deliveries').update({status:'failed',failure_reason:reason,last_event_lat:loc.lat,last_event_lng:loc.lng,last_event_accuracy_m:loc.accuracy}).eq('id',failure.id);if(error)setErr(error.message);else await load();setFailure(null);setBusy(null)
  }

  const active=useMemo(()=>items.filter(x=>!['delivered','cancelled','failed'].includes(x.status)).sort((a,b)=>{const rp=(a.route_position??999)-(b.route_position??999);if(rp!==0)return rp;return priorityValue(a)-priorityValue(b)}),[items])
  const current=active.find(x=>['accepted','en_route','arrived'].includes(x.status))||active[0]
  const selectedTask=active.find(x=>x.id===selectedTaskId)||current||null
  const origin=currentLocation?{latitude:currentLocation.lat,longitude:currentLocation.lng,heading:currentLocation.heading}:null
  const selectedDistance=currentLocation&&selectedTask?.latitude!==null&&selectedTask?.latitude!==undefined&&selectedTask?.longitude!==null&&selectedTask?.longitude!==undefined?Math.round(metersBetween({lat:currentLocation.lat,lng:currentLocation.lng},{lat:selectedTask.latitude,lng:selectedTask.longitude})):null

  function showOnMap(d:Delivery,openNavigation=false){setSelectedTaskId(d.id);if(openNavigation){setNavRouteSummary(null);setNavSheet('peek');setNavigationMode(true);if(!preview&&!locationSharing)void toggleLocation()}else window.setTimeout(()=>mapRef.current?.scrollIntoView({behavior:'smooth',block:'center'}),40)}

  function TaskActions({d,navigation=false}:{d:Delivery;navigation?:boolean}){
    const next=NEXT_STATUS[d.status];const proofNeeded=d.status==='arrived'&&(d.requires_photo||d.requires_signature)
    return <div className={navigation?'navSheetActions':'actionGrid modernActionGrid'}>
      <a className="btn btnSoft" href={`tel:${d.customer_phone.replace(/\D/g,'')}`}><Phone size={15}/> Müşteriyi ara</a>
      {!navigation&&<button type="button" className="btn btnGhost" onClick={()=>showOnMap(d,true)}><MapPinned size={15}/> Navigasyon</button>}
      {proofNeeded?(preview?<button className="btn btnPrimary wide" onClick={()=>move(d,'delivered')}>Fotoğraf / İmza Önizle →</button>:<Link className="btn btnPrimary wide" href={`/deliveries/${d.id}`}>Fotoğraf / İmza ve Teslimat →</Link>):next&&<button disabled={busy===d.id} onClick={()=>move(d,next)} className="btn btnPrimary wide">{busy===d.id?'Kaydediliyor…':NEXT_STATUS_LABEL[d.status]} →</button>}
      <button className="btn btnDanger" onClick={()=>setFailure(d)}>Sorun bildir</button>
    </div>
  }

  return <div className="courierShell courierShellModern fadeIn">
    <OfflineSyncStatus/>
    <header className="courierTop courierTopModern"><div className="courierTopRow"><div className="courierIdentity">{growth?.avatarUrl?<div className="avatar avatarImage"><img src={growth.avatarUrl} alt="Kurye avatarı"/></div>:<div className="avatar">{name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div>}<div><strong>İyi çalışmalar, {name.split(' ')[0]}</strong><div className="meta">{growth?(growth.rankTitle+' • '+growth.points.toLocaleString('tr-TR')+' XP'):'Saha operasyonu'}</div></div></div><div className="courierHeaderActions">{current&&<button className="btn btnPrimary navLaunchButton" onClick={()=>showOnMap(current,true)}><Navigation size={16}/> Navigasyon</button>}{!preview&&<NotificationCenter userId={userId} compact/>}</div></div></header>
    <main className="courierContent courierContentModern">
      {growth&&<section className="courierGrowthStrip" style={{'--rank':growth.rankColor} as React.CSSProperties}><div className="growthStripRank"><span><Trophy size={16}/></span><div><small>RÜTBE {growth.rankNo}/60</small><strong>{growth.rankTitle}</strong></div></div><div className="growthStripPoints"><b>{growth.points.toLocaleString('tr-TR')} XP</b><span>{Array.from({length:6},(_,i)=><Star key={i} size={13} fill={i<growth.stars?'currentColor':'none'}/>)}</span></div>{growth.promotion?<div className="growthStripPromo"><Sparkles size={16}/><span><small>AKTİF HEDEF</small><strong>{growth.promotion.title}</strong></span><b>{growth.promotion.rewardLabel}</b></div>:<div className="growthStripPromo muted"><Sparkles size={16}/><span><small>HEDEFLER</small><strong>Yeni promosyon bekleniyor</strong></span></div>}<Link className="btn btnGhost compact" href="/courier/profile">Profil & ödüller →</Link></section>}
      {notice&&<div className="fieldNotice modernNotice">{notice}</div>}
      {err&&<div className="error modernNotice">{err}</div>}
      <div className="courierWorkspace">
        <div className="courierWorkColumn">
          <section className="availability premiumAvailability modernAvailability"><div><span className="eyebrow">MESAİ DURUMU</span><strong>{availability==='available'?'Görev almaya hazırım':availability==='break'?'Moladayım':availability==='busy'?'Teslimattayım':'Mesai kapalı'}</strong><div className="meta">Mağaza ile canlı senkronize.</div></div><span className={`presencePill presence-${availability}`}><i/>{availability==='available'?'Müsait':availability==='break'?'Mola':availability==='busy'?'Meşgul':'Kapalı'}</span></section>
          <div className="availabilityActions modernAvailabilityActions"><button onClick={()=>setAvailability('available')} className={`btn ${availability==='available'?'btnSoft':'btnGhost'}`}><CircleCheckBig size={15}/> Müsait</button><button onClick={()=>setAvailability('break')} className={`btn ${availability==='break'?'btnSoft':'btnGhost'}`}><Coffee size={15}/> Mola</button><button onClick={()=>setAvailability('offline')} className={`btn ${availability==='offline'?'btnDanger':'btnGhost'}`}><Power size={15}/> Mesaiyi bitir</button><button onClick={toggleLocation} className={`btn ${locationSharing?'btnSoft':'btnGhost'}`}>{locationSharing?<><LocateFixed size={15}/> Konum açık</>:<><MapPin size={15}/> Konum paylaş</>}</button></div>
          <div className="drivingSafety modernDrivingSafety"><span>!</span><p><strong>Sürüşte ekrana dokunma.</strong> İşlemleri durduğunda tamamla.</p></div>

          <div className="courierStats modernCourierStats"><div><span className="statMiniIcon"><CirclePlus size={17}/></span><strong>{items.filter(x=>x.status==='new').length}</strong><span>Yeni görev</span></div><div><span className="statMiniIcon"><RouteIcon size={17}/></span><strong>{items.filter(x=>['accepted','en_route','arrived'].includes(x.status)).length}</strong><span>Sahada aktif</span></div><div><span className="statMiniIcon"><CircleCheckBig size={17}/></span><strong>{items.filter(x=>x.status==='delivered').length}</strong><span>Tamamlandı</span></div></div>

          {current&&<section className="nextStopCard nextStopModern"><div className="nextStopProductRow"><ProductVisual delivery={current} size="md"/><div className="nextStopTop"><div><span className="eyebrow">SIRADAKİ DURAK</span><h1>{current.customer_name}</h1><p>{current.product_name} × {current.quantity}{current.product_model?` • ${current.product_model}`:''}</p></div><StatusPill status={current.status}/></div></div><DeliveryStatusSteps status={current.status} compact/><div className="nextStopAddress"><b>⌖</b><span>{current.customer_address}</span></div><div className="nextStopMeta"><span>{current.route_position?`Rota #${current.route_position}`:'Sıra atanmadı'}</span><span>◷ {current.time_window}</span>{current.floor_text&&<span>{current.floor_text}</span>}</div><button className="btn btnPrimary btnLarge" onClick={()=>showOnMap(current,true)}><Navigation size={17}/> Navigasyonu başlat</button></section>}

          <div className="sectionHeading modernSectionHeading"><div><strong>Bugünün teslimatları</strong><span>{active.length} aktif görev</span></div></div>
          <div className="courierTaskStack">{active.length?active.map(d=><article className={`mobileTask modernMobileTask priority-${d.priority} ${selectedTask?.id===d.id?'selected':''}`} key={d.id}>
            <div className="taskMediaRow"><ProductVisual delivery={d} size="md"/><div className="taskHeadline"><div><div className="tracking">{d.route_position?`DURAK ${d.route_position} • `:''}{d.tracking_no}{d.order_no?` • SİPARİŞ ${d.order_no}`:''}</div><h2>{d.customer_name}</h2><div className="meta taskProductMeta">{d.product_name} × {d.quantity}{d.product_model?` • ${d.product_model}`:''}</div></div><StatusPill status={d.status}/></div></div>
            <DeliveryStatusSteps status={d.status} compact/>
            <div className="taskChips modernTaskChips">{d.priority!=='normal'&&<span className="hotChip">{d.priority==='urgent'?'ACİL':'ÖNCELİKLİ'}</span>}{d.install_required&&<span>Kurulum</span>}{d.old_product_pickup&&<span>Eski ürün</span>}{d.fragile&&<span>Hassas</span>}{d.has_elevator===false&&<span>Asansör yok</span>}</div>
            <button type="button" onClick={()=>showOnMap(d,true)} className="infoBlock addressInfoButton"><span className="addressInfoIcon">⌖</span><span><strong>TESLİMAT ADRESİ</strong><p>{d.customer_address}</p><small>Uygulama içi navigasyonu aç</small></span><b>→</b></button>
            <div className="taskInfoGrid"><div className="infoBlock"><strong>TESLİMAT PLANI</strong><p>{d.scheduled_date} • {d.time_window}{d.floor_text?` • ${d.floor_text}`:''}</p></div><div className="infoBlock"><strong>MÜŞTERİ</strong><p>{d.customer_phone}</p></div></div>
            {d.notes&&<div className="infoBlock importantNote"><strong>MAĞAZA NOTU</strong><p>{d.notes}</p></div>}
            <TaskActions d={d}/>
          </article>):<div className="empty" style={{background:'#fff'}}><strong>Aktif görevin yok</strong>Yeni sevkiyat atandığında burada görünecek.</div>}</div>
        </div>

        <aside className="courierMapColumn" ref={mapRef}>
          <div className="courierMapSticky">
            <section className="panel courierMapPanel"><div className="panelHead"><div><span className="eyebrow">DAHİLİ ROTA</span><h2>Görev haritası</h2><p>Canlı rota ve teslimat noktaları.</p></div><span className="mapLiveBadge"><LocateFixed size={14}/> Canlı</span></div><OperationsMap deliveries={active} origin={origin} selectedDeliveryId={selectedTask?.id} onSelectDelivery={setSelectedTaskId} onRouteSummary={setRouteSummary}/>{routeSummary&&<div className="routeSummaryBar"><div><span>TOPLAM ROTA</span><strong>{distanceLabel(routeSummary.distance_m)}</strong></div><div><span>TAHMİNİ SÜRE</span><strong>{etaLabel(routeSummary.duration_s)}</strong></div><div><span>SAĞLAYICI</span><strong>{routeSummary.provider==='graphhopper'?'GraphHopper':'OSRM'}</strong></div></div>}{selectedTask&&<div className="courierMapDetails"><div className="selectedMapProduct"><ProductVisual delivery={selectedTask} size="sm"/><div><small>SEÇİLİ DURAK</small><h3>{selectedTask.customer_name}</h3><p>{selectedTask.product_name} • {selectedTask.product_model||'Model yok'}</p></div><StatusPill status={selectedTask.status}/></div><p className="courierMapAddress">{selectedTask.customer_address}</p><div className="courierMapMeta"><span>#{selectedTask.route_position||'—'} rota</span><span>{selectedTask.time_window}</span><span>{selectedTask.quantity} adet</span></div><div className="selectedActions"><a className="btn btnSoft" href={`tel:${selectedTask.customer_phone.replace(/\D/g,'')}`}>☎ Ara</a><button className="btn btnPrimary" onClick={()=>setNavigationMode(true)}>Navigasyon →</button></div></div>}</section>
            
          </div>
        </aside>
      </div>
    </main>
    <nav className="bottomNav premiumBottomNav"><Link className="active" href={preview?'#/':'/courier'}><ClipboardList size={18}/><span>Görevler</span></Link><Link href={preview?'#/':'/courier/history'}><History size={18}/><span>Geçmiş</span></Link><Link href={preview?'#/':'/courier/profile'}><UserRound size={18}/><span>Profil</span></Link></nav>

    {navigationMode&&selectedTask&&<div className="courierNavigationOverlay premiumCourierNav">
      <div className="courierNavMap"><CourierNavigationMap delivery={selectedTask} currentLocation={currentLocation} onRouteSummary={setNavRouteSummary}/></div>
      <div className="courierNavTopbar premiumNavTopbar">
        <button className="navClose" onClick={()=>setNavigationMode(false)} aria-label="Navigasyonu kapat">←</button>
        <div className="navMissionTitle"><small>{selectedTask.route_position?`DURAK ${selectedTask.route_position}`:'AKTİF TESLİMAT'}</small><strong>{selectedTask.customer_address}</strong></div>
        <button type="button" className={`navVoiceButton ${voiceGuidance?'active':''}`} onClick={()=>setVoiceGuidance(v=>!v)}>{voiceGuidance?<><Volume2 size={17}/> Ses</>:<><VolumeX size={17}/> Ses</>}</button>
        <div className="navEtaCapsule"><b>{navRouteSummary?etaLabel(navRouteSummary.duration_s):'—'}</b><span>{navRouteSummary?distanceLabel(navRouteSummary.distance_m):'Rota hazırlanıyor'}</span></div>
      </div>
      {navRouteSummary?.instructions?.[0]&&<div className="nextInstruction premiumInstruction"><span>↗</span><div><small>SIRADAKİ MANEVRA</small><strong>{navRouteSummary.instructions[0].text||navRouteSummary.instructions[0].street_name||'Rotayı takip et'}</strong></div></div>}
      <div className="navDestinationChip"><span>⌂</span><div><small>HEDEF</small><b>{selectedTask.floor_text?`${selectedTask.floor_text} • `:''}{selectedTask.customer_address}</b></div></div>

      {navSheet==='hidden'&&<button type="button" className="navSheetRestore" onClick={()=>setNavSheet('peek')}><ProductVisual delivery={selectedTask} size="sm"/><span><small>GÖREV</small><b>{selectedTask.customer_name}</b></span><i><ChevronUp size={18}/></i></button>}

      {navSheet!=='hidden'&&<section className={`navOrderSheet premiumOrderSheet sheet-${navSheet}`}>
        <div className="navSheetControls"><button type="button" className="navSheetHandleButton" onClick={()=>setNavSheet(v=>v==='expanded'?'peek':'expanded')} aria-label="Görev panelini büyüt veya küçült"><span className="navSheetHandle"/><em>{navSheet==='expanded'?'Küçült':'Detaylar'}</em></button><button type="button" className="navSheetHide" onClick={()=>setNavSheet('hidden')} aria-label="Görev panelini gizle"><X size={18}/></button></div>
        <div className="navProductHeader premiumNavProduct"><ProductVisual delivery={selectedTask} size="lg"/><div className="navOrderIdentity"><div className="tracking">{selectedTask.order_no?`SİPARİŞ ${selectedTask.order_no} • `:''}{selectedTask.tracking_no}</div><h2>{selectedTask.customer_name}</h2><p>{selectedTask.product_name} × {selectedTask.quantity}{selectedTask.product_model?` • ${selectedTask.product_model}`:''}</p></div><StatusPill status={selectedTask.status}/></div>
        <DeliveryStatusSteps status={selectedTask.status} compact={navSheet==='peek'}/>
        {navSheet==='expanded'&&<>
          <div className="navAddressCard static"><span>⌖</span><div><small>TESLİMAT NOKTASI</small><strong>{selectedTask.customer_address}</strong><p>{selectedTask.floor_text||'Kat / daire bilgisi yok'}{selectedTask.has_elevator===false?' • Asansör yok':selectedTask.has_elevator===true?' • Asansör var':''}</p></div></div>
          <div className="navQuickInfo">{selectedDistance!==null&&<span className={selectedDistance<180?'nearbyChip':''}>⌖ {selectedDistance<180?'Teslimat noktasına yaklaştın':distanceLabel(selectedDistance)}</span>}<span>◷ {selectedTask.time_window}</span>{selectedTask.install_required&&<span>🔧 Kurulum</span>}{selectedTask.old_product_pickup&&<span>↩ Eski ürün</span>}{selectedTask.fragile&&<span>◈ Hassas</span>}</div>
          {selectedTask.notes&&<div className="navStoreNote"><b>Mağaza notu</b><span>{selectedTask.notes}</span></div>}
        </>}
        <TaskActions d={selectedTask} navigation/>
      </section>}
    </div>}

    {failure&&<div className="sheetBackdrop"><div className="bottomSheet"><div className="sheetHandle"/><div className="panelHead"><div><span className="eyebrow">HIZLI İSTİSNA</span><h2>Teslimat sorunu</h2><p>{failure.customer_name} için uygun nedeni seç.</p></div><button className="iconButton" onClick={()=>setFailure(null)}>×</button></div><div className="stack">{FAILS.map(r=><button key={r} onClick={()=>markFailed(r)} className="exceptionButton">{r}<span>→</span></button>)}</div></div></div>}
  </div>
}
