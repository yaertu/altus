'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Delivery, DeliveryPriority } from '@/lib/types'

type Courier={user_id:string;full_name:string}
export default function DeliveryManagement({delivery,couriers}:{delivery:Delivery;couriers:Courier[]}){
  const router=useRouter()
  const [courierId,setCourierId]=useState(delivery.assigned_courier_id||'')
  const [date,setDate]=useState(delivery.scheduled_date)
  const [timeWindow,setTimeWindow]=useState(delivery.time_window)
  const [priority,setPriority]=useState<DeliveryPriority>(delivery.priority)
  const [routePosition,setRoutePosition]=useState(delivery.route_position?.toString()||'')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')

  async function save(){setBusy(true);setMessage('');const supabase=createClient();const patch:{assigned_courier_id:string|null;scheduled_date:string;time_window:string;priority:DeliveryPriority;route_position:number|null;status?:string;failure_reason?:null}={assigned_courier_id:courierId||null,scheduled_date:date,time_window:timeWindow,priority,route_position:routePosition?Number(routePosition):null};if(delivery.status==='failed'){patch.status='new';patch.failure_reason=null}const {error}=await supabase.from('deliveries').update(patch).eq('id',delivery.id);setMessage(error?error.message:delivery.status==='failed'?'Teslimat yeniden planlandı ve görev kuyruğuna alındı.':'Operasyon planı güncellendi.');setBusy(false);if(!error)router.refresh()}
  async function cancel(){if(!confirm('Bu sevkiyat iptal edilsin mi?'))return;setBusy(true);const supabase=createClient();const {error}=await supabase.from('deliveries').update({status:'cancelled'}).eq('id',delivery.id);setMessage(error?error.message:'Sevkiyat iptal edildi.');setBusy(false);if(!error)router.refresh()}

  return <div className="panel"><div className="panelHead"><div><h2>Operasyon yönetimi</h2><p>Atama, rota sırası, zaman penceresi ve yeniden planlama.</p></div></div>{message&&<div className={message.includes('güncellendi')||message.includes('planlandı')||message.includes('iptal')?'success':'error'}>{message}</div>}<div className="formGrid"><div className="field full"><label>Sevkiyat personeli</label><select className="select" value={courierId} onChange={e=>setCourierId(e.target.value)}><option value="">Atanmamış</option>{couriers.map(c=><option key={c.user_id} value={c.user_id}>{c.full_name}</option>)}</select></div><div className="field"><label>Teslimat günü</label><input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div><div className="field"><label>Saat aralığı</label><select className="select" value={timeWindow} onChange={e=>setTimeWindow(e.target.value)}><option>09:00 – 12:00</option><option>12:00 – 15:00</option><option>15:00 – 18:00</option><option>18:00 – 21:00</option></select></div><div className="field"><label>Rota sırası</label><input className="input" type="number" min="1" placeholder="Örn. 4" value={routePosition} onChange={e=>setRoutePosition(e.target.value)}/></div><div className="field"><label>Öncelik</label><select className="select" value={priority} onChange={e=>setPriority(e.target.value as DeliveryPriority)}><option value="normal">Normal</option><option value="priority">Öncelikli</option><option value="urgent">Acil</option></select></div></div><div className="managementActions"><button disabled={busy} onClick={save} className="btn btnPrimary">{busy?'Kaydediliyor…':delivery.status==='failed'?'Yeniden planla →':'Değişiklikleri kaydet'}</button>{delivery.status!=='delivered'&&delivery.status!=='cancelled'&&<button disabled={busy} onClick={cancel} className="btn btnDanger">Sevkiyatı iptal et</button>}</div></div>
}
