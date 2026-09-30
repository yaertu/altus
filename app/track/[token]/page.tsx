import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import { notFound } from 'next/navigation'
import StatusPill from '@/components/status-pill'
import type { DeliveryStatus } from '@/lib/types'

export const metadata:Metadata={title:'Teslimat Takibi',robots:{index:false,follow:false}}
const labels:Record<string,string>={created:'Sevkiyat oluşturuldu',assigned:'Sevkiyat ekibine aktarıldı',new:'Planlandı',accepted:'Görev kabul edildi',en_route:'Teslimat ekibi yola çıktı',arrived:'Teslimat ekibi adreste',delivered:'Teslim edildi',failed:'Teslimat yeniden planlanıyor',cancelled:'İptal edildi'}

type TrackingSnapshot={
  delivery:{id:string;tracking_no:string;customer_first_name:string;product_name:string;product_model:string|null;quantity:number;scheduled_date:string;time_window:string;status:DeliveryStatus;priority:string;city:string|null;district:string|null;created_at:string;updated_at:string;tracking_expires_at:string}
  organization:{name:string;brand_color:string}
  events:Array<{id:number;event_type:string;to_status:string|null;created_at:string}>
}

export default async function PublicTrackingPage({params}:{params:Promise<{token:string}>}){
  const {token}=await params
  if(!/^[0-9a-f-]{36}$/i.test(token))notFound()
  const base=SUPABASE_URL
  const res=await fetch(`${base}/functions/v1/public-tracking?token=${encodeURIComponent(token)}`,{cache:'no-store'})
  if(!res.ok)notFound()
  const snapshot=await res.json() as TrackingSnapshot
  const d=snapshot.delivery; const org=snapshot.organization; const events=snapshot.events||[]
  return <main className="publicTrack" style={{'--brand':org?.brand_color||'#cf006f'} as CSSProperties}><section className="trackingHero"><div className="trackingBrand"><div className="brandMark">A</div><div><strong>{org?.name||'Sevkiyat Operasyonu'}</strong><span>Güvenli müşteri takip ekranı</span></div></div><div className="trackStatus"><span className="eyebrow">{d.tracking_no}</span><h1>Merhaba {d.customer_first_name}, teslimatınız takipte.</h1><p>Planlanan zaman: <b>{d.scheduled_date}</b> • <b>{d.time_window}</b></p><StatusPill status={d.status}/></div></section><section className="trackCard"><div className="trackProduct"><span>ÜRÜN</span><strong>{d.product_name} × {d.quantity}</strong><small>{d.product_model||''}</small></div><div className="trackProduct"><span>BÖLGE</span><strong>{[d.district,d.city].filter(Boolean).join(' / ')||'Teslimat bölgesi'}</strong><small>Güvenlik nedeniyle açık adres bu ekranda gösterilmez.</small></div></section><section className="trackTimeline"><h2>Teslimat akışı</h2>{events.map(e=><div className="trackStep" key={e.id}><i/><div><strong>{labels[e.to_status||e.event_type]||'Sevkiyat güncellendi'}</strong><span>{new Date(e.created_at).toLocaleString('tr-TR')}</span></div></div>)}</section><p className="trackPrivacy">Bu bağlantı kişiye özeldir ve sınırlı süre geçerlidir. Müşteri telefon numarası ve açık adresi herkese açık takip sayfasında gösterilmez.</p></main>
}
