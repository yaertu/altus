import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import DeliveryProof from '@/components/delivery-proof'
import StatusPill from '@/components/status-pill'
import DeliveryManagement from '@/components/delivery-management'
import TrackingShare from '@/components/tracking-share'
import OperationsMap from '@/components/operations-map'
import ProductVisual from '@/components/product-visual'
import DeliveryStatusSteps from '@/components/delivery-status-steps'
import type { Delivery } from '@/lib/types'

const eventLabel:Record<string,string>={created:'Sevkiyat oluşturuldu',assigned:'Personel atandı',status_changed:'Durum güncellendi',location_checkpoint:'Konum doğrulandı'}
const statusLabel:Record<string,string>={new:'Yeni',accepted:'Kabul edildi',en_route:'Yola çıktı',arrived:'Adrese vardı',delivered:'Teslim edildi',failed:'Sorunlu',cancelled:'İptal'}

export default async function DeliveryDetail({params}:{params:Promise<{id:string}>}){
  const {id}=await params
  const {supabase,profile,userId}=await requireProfile()
  const {data:delivery}=await supabase.from('deliveries').select('*').eq('id',id).single()
  if(!delivery)notFound()
  const [{data:events},{data:proofs},{data:couriers}]=await Promise.all([
    supabase.from('delivery_events').select('id,event_type,from_status,to_status,note,metadata,created_at').eq('delivery_id',id).order('created_at',{ascending:false}),
    supabase.from('delivery_proofs').select('id,proof_type,storage_path,created_at').eq('delivery_id',id).order('created_at',{ascending:false}),
    supabase.from('profiles').select('user_id,full_name').eq('org_id',profile.org_id!).eq('role','courier').eq('is_active',true).order('full_name'),
  ])
  const d=delivery as Delivery;const courier=profile.role==='courier'
  return <div className={courier?'courierShell':''}>
    {courier?<header className="courierTop"><div className="courierTopRow"><div><Link href="/courier" className="backLink">← Görevlere dön</Link><div className="tracking">{d.tracking_no}</div></div><StatusPill status={d.status}/></div></header>:<div className="pageHead"><div><div className="eyebrow">{d.tracking_no}</div><h1>{d.customer_name}</h1><p>{d.product_name} • {d.customer_phone}</p></div><div className="pageHeadActions"><TrackingShare token={d.tracking_token}/><StatusPill status={d.status}/></div></div>}
    <main className={courier?'courierContent':''}><div className="twoCol"><div className="stack">
      <div className="panel"><div className="panelHead"><div><h2>Müşteri ve ürün</h2><p>Sahada gerekli bilgiler tek yerde.</p></div></div><div className="detailProductHero"><ProductVisual delivery={d} size="lg"/><div><span className="eyebrow">ÜRÜN</span><h3>{d.product_name}</h3><p>{d.product_model||'Model bilgisi yok'} • {d.quantity} adet</p></div></div><DeliveryStatusSteps status={d.status}/><div className="formGrid"><div className="infoBlock"><strong>MÜŞTERİ</strong><p>{d.customer_name}<br/><a href={`tel:${d.customer_phone.replace(/\D/g,'')}`}>{d.customer_phone}</a></p></div><div className="infoBlock"><strong>ÜRÜN</strong><p>{d.product_name} × {d.quantity}<br/>{d.product_model||''}</p></div><div className="infoBlock full"><strong>ADRES</strong><p>{d.customer_address}</p><span className="inlineAction staticAction">⌖ Konum aşağıdaki uygulama içi haritada gösteriliyor</span></div><div className="infoBlock"><strong>PLAN</strong><p>{d.scheduled_date}<br/>{d.time_window}</p></div><div className="infoBlock"><strong>TAŞIMA</strong><p>{d.floor_text||'Kat bilgisi yok'}{d.has_elevator===false?' • Asansör yok':''}{d.install_required?' • Kurulum':''}{d.old_product_pickup?' • Eski ürün alınacak':''}{d.fragile?' • Hassas':''}</p></div>{d.notes&&<div className="infoBlock full importantNote"><strong>MAĞAZA NOTU</strong><p>{d.notes}</p></div>}</div></div>
      {courier&&d.status==='arrived'&&<DeliveryProof delivery={d} userId={userId} existing={(proofs||[])}/>} {!courier&&<DeliveryManagement delivery={d} couriers={couriers||[]}/>} 
    </div><aside className="stack"><div className="panel detailMapPanel"><div className="panelHead"><div><h2>Teslimat haritası</h2><p>Adres ve görev konumu uygulama içinde.</p></div><span className="mapLiveBadge">⌖ Dahili</span></div><OperationsMap deliveries={[d]} selectedDeliveryId={d.id}/></div><div className="panel"><div className="panelHead"><div><h2>Zaman çizgisi</h2><p>Tüm kritik hareketler denetim kaydında tutulur.</p></div></div><div className="timeline">{(events||[]).length?(events||[]).map((e:{id:number;event_type:string;from_status:string|null;to_status:string|null;note:string|null;metadata:Record<string,unknown>;created_at:string})=><div className="timelineItem" key={e.id}><div className="timelineLine"><div className="timelineDot"/></div><div><strong>{e.to_status?`${statusLabel[e.from_status||'']||'Başlangıç'} → ${statusLabel[e.to_status]||e.to_status}`:eventLabel[e.event_type]||e.event_type}</strong><p>{e.note||new Date(e.created_at).toLocaleString('tr-TR')}</p><small>{new Date(e.created_at).toLocaleString('tr-TR')}{e.metadata&&'accuracy_m' in e.metadata?` • GPS ±${Math.round(Number(e.metadata.accuracy_m)||0)} m`:''}</small></div></div>):<div className="empty">Henüz olay kaydı yok.</div>}</div></div>
      <div className="panel"><div className="panelHead"><div><h2>Teslimat kanıtları</h2><p>Private Storage içindeki dosyalar 60 saniyelik imzalı bağlantıyla açılır.</p></div></div>{(proofs||[]).length?<div className="proofList">{(proofs||[]).map((p:{id:string;proof_type:string;created_at:string})=><a key={p.id} href={`/api/proofs/${p.id}`} target="_blank" rel="noreferrer" className="proofRow"><span>{p.proof_type==='photo'?'📷':'✍'}</span><div><strong>{p.proof_type==='photo'?'Teslimat fotoğrafı':'Müşteri imzası'}</strong><small>{new Date(p.created_at).toLocaleString('tr-TR')}</small></div><b>↗</b></a>)}</div>:<div className="empty">Henüz kanıt yüklenmedi.</div>}</div>
    </aside></div></main>
  </div>
}
