'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { CourierAvailability, Delivery } from '@/lib/types'
import StatusPill from './status-pill'
import OperationsMap, { type RouteSummary } from './operations-map'
import ProductVisual from './product-visual'
import { Boxes, ClockAlert, Route, CircleCheckBig, Search, MapPinned, Phone, Plus, BarChart3, MapPin, Clock3, Wrench, UserRound } from 'lucide-react'

type CourierRow={user_id:string;full_name:string;phone:string|null;availability:CourierAvailability;last_heartbeat_at:string|null;latitude:number|null;longitude:number|null;accuracy_m:number|null;heading_deg:number|null;speed_mps:number|null}
type PresenceRow={user_id:string;availability:CourierAvailability;last_heartbeat_at:string;latitude:number|null;longitude:number|null;accuracy_m:number|null;heading_deg:number|null;speed_mps:number|null}
type CourierProfileRow={user_id:string;full_name:string;phone:string|null}

function minutesAgo(value:string|null){if(!value)return null;return Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/60000))}
function presenceLabel(v:CourierAvailability){return v==='available'?'Müsait':v==='busy'?'Teslimatta':v==='break'?'Molada':'Çevrimdışı'}
function initials(name:string){return name.split(' ').filter(Boolean).map(x=>x[0]).slice(0,2).join('').toUpperCase()}

export default function StoreDashboard({initial,orgId,initialCouriers,preview=false}:{initial:Delivery[];orgId:string;initialCouriers:CourierRow[];preview?:boolean}){
  const [items,setItems]=useState(initial)
  const [couriers,setCouriers]=useState(initialCouriers)
  const [q,setQ]=useState('')
  const [filter,setFilter]=useState('all')
  const [liveState,setLiveState]=useState<'connecting'|'live'|'error'>('connecting')
  const [selectedDeliveryId,setSelectedDeliveryId]=useState<string|null>(initial.find(x=>!['delivered','cancelled'].includes(x.status))?.id||initial[0]?.id||null)
  const [selectedRouteSummary,setSelectedRouteSummary]=useState<RouteSummary|null>(null)

  const loadDeliveries=useCallback(async()=>{if(preview)return;const supabase=createClient();const {data}=await supabase.from('deliveries').select('*').eq('org_id',orgId).order('created_at',{ascending:false}).limit(300);if(data)setItems(data as Delivery[])},[orgId,preview])
  const loadPresence=useCallback(async()=>{if(preview)return;const supabase=createClient();const [{data:profiles},{data:presence}]=await Promise.all([supabase.from('profiles').select('user_id,full_name,phone').eq('org_id',orgId).eq('role','courier').eq('is_active',true).order('full_name'),supabase.from('courier_presence').select('user_id,availability,last_heartbeat_at,latitude,longitude,accuracy_m,heading_deg,speed_mps').eq('org_id',orgId)]);const map=new Map<string,PresenceRow>(((presence||[]) as PresenceRow[]).map(x=>[x.user_id,x]));setCouriers(((profiles||[]) as CourierProfileRow[]).map(p=>({user_id:p.user_id,full_name:p.full_name,phone:p.phone,availability:(map.get(p.user_id)?.availability||'offline') as CourierAvailability,last_heartbeat_at:map.get(p.user_id)?.last_heartbeat_at||null,latitude:map.get(p.user_id)?.latitude??null,longitude:map.get(p.user_id)?.longitude??null,accuracy_m:map.get(p.user_id)?.accuracy_m??null,heading_deg:map.get(p.user_id)?.heading_deg??null,speed_mps:map.get(p.user_id)?.speed_mps??null})))},[orgId,preview])

  useEffect(()=>{
    if(preview){setLiveState('live');return}
    const supabase=createClient();let deliveriesChannel:ReturnType<typeof supabase.channel>|null=null;let presenceChannel:ReturnType<typeof supabase.channel>|null=null
    void(async()=>{try{await supabase.realtime.setAuth();deliveriesChannel=supabase.channel(`org:${orgId}:deliveries`,{config:{private:true}}).on('broadcast',{event:'*'},()=>{void loadDeliveries()}).on('postgres_changes',{event:'*',schema:'public',table:'deliveries',filter:`org_id=eq.${orgId}`},()=>{void loadDeliveries()}).subscribe(status=>setLiveState(status==='SUBSCRIBED'?'live':status==='CHANNEL_ERROR'?'error':'connecting'));presenceChannel=supabase.channel(`org:${orgId}:presence`,{config:{private:true}}).on('broadcast',{event:'*'},()=>{void loadPresence()}).on('postgres_changes',{event:'*',schema:'public',table:'courier_presence',filter:`org_id=eq.${orgId}`},()=>{void loadPresence()}).subscribe()}catch{setLiveState('error')}})()
    return()=>{if(deliveriesChannel)void supabase.removeChannel(deliveriesChannel);if(presenceChannel)void supabase.removeChannel(presenceChannel)}
  },[loadDeliveries,loadPresence,orgId,preview])

  const shown=useMemo(()=>items.filter(d=>{const text=`${d.customer_name} ${d.customer_phone} ${d.tracking_no} ${d.product_name} ${d.order_no||''}`.toLocaleLowerCase('tr');const matchQ=text.includes(q.toLocaleLowerCase('tr'));const matchF=filter==='all'||(filter==='active'&&['accepted','en_route','arrived'].includes(d.status))||(filter==='attention'&&['failed'].includes(d.status))||d.status===filter;return matchQ&&matchF}),[items,q,filter])
  const selected=items.find(x=>x.id===selectedDeliveryId)||shown[0]||items[0]||null
  const selectedCourier=selected?.assigned_courier_id?couriers.find(x=>x.user_id===selected.assigned_courier_id):null
  const selectedCourierRoute=selected?.assigned_courier_id?items.filter(x=>x.assigned_courier_id===selected.assigned_courier_id):selected?[selected]:[]
  const selectedCourierOrigin=selectedCourier?.latitude!==null&&selectedCourier?.latitude!==undefined&&selectedCourier?.longitude!==null&&selectedCourier?.longitude!==undefined?{latitude:selectedCourier.latitude,longitude:selectedCourier.longitude,heading:selectedCourier.heading_deg}:null
  const n=(s:string)=>items.filter(x=>x.status===s).length
  const active=items.filter(x=>['accepted','en_route','arrived'].includes(x.status)).length
  const today=new Date().toISOString().slice(0,10)
  const overdue=items.filter(x=>!['delivered','cancelled'].includes(x.status)&&x.scheduled_date<today)
  const staleNew=items.filter(x=>x.status==='new'&&(Date.now()-new Date(x.created_at).getTime())>15*60_000)
  const alerts=[...overdue.map(x=>({id:`overdue-${x.id}`,delivery:x,text:'Planlanan teslimat günü geçti'})),...staleNew.map(x=>({id:`stale-${x.id}`,delivery:x,text:'15 dakikadan uzun süredir kabul bekliyor'}))].slice(0,6)

  return <div className="fadeIn modernOpsPage">
    <div className="opsCommandBar">
      <div className="opsCommandTitle"><h1>Operasyon</h1><span className={`livePill ${liveState}`}><i/>{liveState==='live'?'Sistem canlı':liveState==='error'?'Bağlantı sorunu':'Bağlanıyor'}</span></div>
      <Link className="btn btnPrimary" href={preview?'/desktop-preview/new':'/deliveries/new'}><Plus size={16}/> Yeni sevkiyat</Link>
    </div>

    <div className="opsKpis">
      <div className="opsKpi"><span className="opsKpiIcon"><Boxes size={18}/></span><div><small>Bugünkü kayıt</small><strong>{items.length}</strong><p>Tüm planlanan işler</p></div></div>
      <div className="opsKpi"><span className="opsKpiIcon hot"><ClockAlert size={18}/></span><div><small>Kabul bekliyor</small><strong>{n('new')}</strong><p>{staleNew.length?`${staleNew.length} görev dikkat istiyor`:'Bekleyen kritik görev yok'}</p></div></div>
      <div className="opsKpi"><span className="opsKpiIcon moving"><Route size={18}/></span><div><small>Sahada aktif</small><strong>{active}</strong><p>Kabul + yolda + adreste</p></div></div>
      <div className="opsKpi"><span className="opsKpiIcon done"><CircleCheckBig size={18}/></span><div><small>Tamamlandı</small><strong>{n('delivered')}</strong><p>{n('failed')} sorunlu kayıt</p></div></div>
    </div>

    <section className="opsCommandGrid">
      <div className="panel opsListPanel">
        <div className="panelHead opsPanelHead"><div><h2>Canlı görev akışı</h2><p>Göreve tıkla; harita ve ayrıntılar sağda açılır.</p></div><span className="badge s-new">{shown.length} görev</span></div>
        <div className="toolbar modernToolbar"><div className="searchWrap"><span><Search size={16}/></span><input className="input" placeholder="Müşteri, telefon, ürün, sipariş no…" value={q} onChange={e=>setQ(e.target.value)}/></div><div className="filterGroup">{[['all','Tümü'],['new','Yeni'],['active','Aktif'],['delivered','Tamam'],['attention','Sorunlu']].map(([v,l])=><button key={v} className={`btn ${filter===v?'btnSoft':'btnGhost'}`} onClick={()=>setFilter(v)}>{l}</button>)}</div></div>
        <div className="opsTaskList">{shown.length?shown.map(d=><button type="button" onClick={()=>setSelectedDeliveryId(d.id)} className={`opsTaskCard ${selected?.id===d.id?'selected':''}`} key={d.id}>
          <div className="taskRouteBadge">{d.route_position?String(d.route_position).padStart(2,'0'):'—'}</div>
          <ProductVisual delivery={d} size="sm"/>
          <div className="opsTaskMain"><div className="tracking">{d.tracking_no}{d.priority!=='normal'&&<span className="priority">{d.priority==='urgent'?'ACİL':'ÖNCELİKLİ'}</span>}</div><h3>{d.customer_name}</h3><p className="opsProduct">{d.product_name} <span>× {d.quantity}</span></p><div className="opsAddress"><MapPin size={13}/><span>{d.customer_address}</span></div><div className="opsTaskMeta"><span><Clock3 size={12}/>{d.time_window}</span><span><Phone size={12}/>{d.customer_phone}</span>{d.install_required&&<span><Wrench size={12}/>Kurulum</span>}</div></div>
          <div className="opsTaskSide"><StatusPill status={d.status}/><span className="mapOpenHint">Haritada göster →</span></div>
        </button>):<div className="empty"><strong>Kayıt bulunamadı</strong>Arama veya filtreyi değiştir.</div>}</div>
      </div>

      <aside className="opsMapColumn">
        <section className="panel opsMapPanel">
          <div className="panelHead opsPanelHead"><div><h2>Canlı saha haritası</h2><p>Seçili personelin konumu ve teslimat rotası.</p></div><span className="mapLiveBadge"><MapPinned size={14}/> Dahili harita</span></div>
          <OperationsMap deliveries={items} routeDeliveries={selectedCourierRoute} couriers={couriers} origin={selectedCourierOrigin} selectedDeliveryId={selected?.id} selectedCourierId={selectedCourier?.user_id||null} onSelectDelivery={setSelectedDeliveryId} onRouteSummary={setSelectedRouteSummary}/>
          {selected&&<div className="selectedDeliverySummary">
            <div className="selectedSummaryTop selectedSummaryWithProduct"><ProductVisual delivery={selected} size="md"/><div><span className="eyebrow">SEÇİLİ GÖREV</span><h3>{selected.customer_name}</h3><p>{selected.product_name}{selected.product_model?` • ${selected.product_model}`:''}</p></div><StatusPill status={selected.status}/></div>
            <div className="selectedAddress"><b><MapPin size={16}/></b><span><strong>{selected.customer_address}</strong><small>{selected.scheduled_date} • {selected.time_window}{selected.floor_text?` • ${selected.floor_text}`:''}</small></span></div>
            <div className="selectedQuickGrid"><div><small>Personel</small><strong><UserRound size={12}/>{selectedCourier?.full_name||'Atanmadı'}</strong></div><div><small>Telefon</small><strong>{selected.customer_phone}</strong></div><div><small>Rota sırası</small><strong>{selected.route_position?`#${selected.route_position}`:'—'}</strong></div>{selectedRouteSummary&&<><div><small>Rota mesafesi</small><strong>{(selectedRouteSummary.distance_m/1000).toFixed(1)} km</strong></div><div><small>Tahmini rota</small><strong>{Math.max(1,Math.round(selectedRouteSummary.duration_s/60))} dk</strong></div></>}</div>
            <div className="selectedActions"><a className="btn btnSoft" href={`tel:${selected.customer_phone.replace(/\D/g,'')}`}><Phone size={15}/> Müşteriyi ara</a>{!preview&&<Link className="btn btnPrimary" href={`/deliveries/${selected.id}`}>Görev detayını aç →</Link>}</div>
          </div>}
        </section>
      </aside>
    </section>

    <section className="opsLowerGrid">
      <div className="panel alertPanel"><div className="panelHead"><div><h2>Operasyon uyarıları</h2><p>Müdahale bekleyen işler.</p></div><span className={`badge ${alerts.length?'s-failed':'s-delivered'}`}>{alerts.length}</span></div>{alerts.length?<div className="alertList">{alerts.map(a=><button type="button" onClick={()=>setSelectedDeliveryId(a.delivery.id)} key={a.id} className="alertItem"><span>!</span><div><strong>{a.delivery.customer_name}</strong><small>{a.text}</small></div></button>)}</div>:<div className="allGood">✓ Kritik uyarı yok</div>}</div>
      <div className="panel fieldPanel"><div className="panelHead"><div><h2>Saha personeli</h2><p>Mesai ve canlı konum durumu.</p></div><span className="badge s-delivered">Canlı konum</span></div><div className="courierList modernCourierList">{couriers.length?couriers.map(c=>{const mins=minutesAgo(c.last_heartbeat_at);const stale=mins===null||mins>4;const availability=stale?'offline':c.availability;return <div className="courierRow modernCourierRow" key={c.user_id}><div className="courierAvatar">{initials(c.full_name)}</div><div><strong>{c.full_name}</strong><small>{presenceLabel(availability)}{mins!==null?` • ${mins<1?'şimdi':`${mins} dk önce`}`:''}{c.accuracy_m?` • ±${Math.round(c.accuracy_m)} m`:''}</small><span className="inlineAction staticAction">Konum haritada görünüyor</span></div><span className={`presenceDot presence-${availability}`}/></div>}):<div className="empty">Sevkiyat personeli eklenmemiş.</div>}</div></div>
      <Link href={preview?'/desktop-preview':'/reports'} className="opsReportsCard"><div className="opsReportsIcon"><BarChart3 size={22}/></div><div><span className="eyebrow">RAPORLAMA</span><h3>Operasyon raporları</h3><p>Tamamlanma, sorun ve performans.</p></div><b>→</b></Link>
    </section>
  </div>
}
