import Link from 'next/link'
import { ClipboardList, History, UserRound, ArrowLeft, PackageCheck } from 'lucide-react'
import { requireProfile } from '@/lib/auth'
import type { Delivery } from '@/lib/types'
import StatusPill from '@/components/status-pill'
import ProductVisual from '@/components/product-visual'

export default async function CourierHistoryPage(){
  const {supabase,userId,profile}=await requireProfile(['courier'])
  const {data}=await supabase.from('deliveries').select('*').eq('assigned_courier_id',userId).in('status',['delivered','failed','cancelled']).order('updated_at',{ascending:false}).limit(100)
  const items=(data||[]) as Delivery[]
  return <div className="courierShell courierShellModern fadeIn">
    <header className="courierTop courierTopModern"><div className="courierTopRow"><div className="courierIdentity"><div className="avatar">{profile.full_name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><strong>Teslimat geçmişi</strong><div className="meta">Tamamlanan ve kapanan görevler</div></div></div><Link className="btn btnGhost compact" href="/courier"><ArrowLeft size={16}/> Görevler</Link></div></header>
    <main className="courierContent courierContentModern">
      <div className="historyHero"><div className="titleIcon"><PackageCheck size={18}/></div><div><span className="eyebrow">GEÇMİŞ</span><h1>Tamamlanan işler</h1><p>Son 100 teslimat, sorun ve iptal kaydı.</p></div><span className="badge s-delivered">{items.length} kayıt</span></div>
      {items.length?<div className="historyList premiumHistoryList">{items.map(d=><Link href={`/deliveries/${d.id}`} className="historyRow premiumHistoryRow" key={d.id}><ProductVisual delivery={d} size="sm"/><div><span className="tracking">{d.tracking_no}</span><strong>{d.customer_name}</strong><small>{d.product_name} • {d.scheduled_date} • {d.time_window}</small>{d.failure_reason&&<small className="historyFailure">{d.failure_reason}</small>}</div><StatusPill status={d.status}/></Link>)}</div>:<div className="empty courierEmptyState"><strong>Henüz geçmiş kayıt yok</strong>Tamamlanan teslimatlar burada görünür.</div>}
    </main>
    <nav className="bottomNav premiumBottomNav"><Link href="/courier"><ClipboardList size={18}/><span>Görevler</span></Link><Link className="active" href="/courier/history"><History size={18}/><span>Geçmiş</span></Link><Link href="/courier/profile"><UserRound size={18}/><span>Profil</span></Link></nav>
  </div>
}
