import Link from 'next/link'
import {Bell,ClipboardList,History,UserRound,ArrowLeft,MapPinned,ShieldCheck,LogOut,Smartphone} from 'lucide-react'
import {requireProfile} from '@/lib/auth'
import {logout} from '@/app/login/actions'
import PushEnrollment from '@/components/push-enrollment'
import InstallAppButton from '@/components/install-app-button'
import OfflineSyncStatus from '@/components/offline-sync-status'
import CourierGrowthProfile from '@/components/courier-growth-profile'
import {fallbackScore,type CourierPromotion,type CourierScore,type CourierScoreEvent} from '@/lib/courier-growth'

export default async function CourierProfilePage(){
  const {supabase,profile,userId}=await requireProfile(['courier'],{allowInactive:true})
  const now=new Date().toISOString()
  const [historyRes,scoreRes,mediaRes,promoRes,eventRes]=await Promise.all([
    supabase.from('deliveries').select('status,product_id,delivered_at').eq('assigned_courier_id',userId).order('updated_at',{ascending:false}).limit(1000),
    supabase.from('courier_scores').select('*').eq('user_id',userId).maybeSingle(),
    supabase.from('courier_profile_media').select('avatar_url').eq('user_id',userId).maybeSingle(),
    supabase.from('courier_promotions').select('*').eq('org_id',profile.org_id!).eq('is_active',true).lte('starts_at',now).gte('ends_at',now).order('ends_at'),
    supabase.from('courier_score_events').select('id,points_delta,event_key,reason,created_at').eq('courier_id',userId).order('created_at',{ascending:false}).limit(12),
  ])
  const history=historyRes.data||[]
  const delivered=history.filter(x=>x.status==='delivered').length
  const failed=history.filter(x=>x.status==='failed').length
  const score=(scoreRes.data as CourierScore|null)||fallbackScore(userId,delivered,failed)
  const promotions=(promoRes.data||[]) as CourierPromotion[]
  const events=(eventRes.data||[]) as CourierScoreEvent[]
  const avatarUrl=(mediaRes.data as {avatar_url?:string|null}|null)?.avatar_url||profile.avatar_url||null
  const deliveredLite=history.filter(x=>x.status==='delivered').map(x=>({product_id:x.product_id,delivered_at:x.delivered_at}))

  return <div className="courierShell courierShellModern fadeIn">
    <OfflineSyncStatus/>
    <header className="courierTop courierTopModern"><div className="courierTopRow"><div className="courierIdentity">{avatarUrl?<div className="avatar avatarImage"><img src={avatarUrl} alt="Kurye avatarı"/></div>:<div className="avatar">{profile.full_name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div>}<div><strong>Profil, seviye ve ödüller</strong><div className="meta">Performans merkezi</div></div></div><Link className="btn btnGhost compact" href="/courier"><ArrowLeft size={16}/> Görevler</Link></div></header>
    <main className="courierContent courierContentModern profilePageModern">
      <CourierGrowthProfile userId={userId} name={profile.full_name} phone={profile.phone} avatarUrl={avatarUrl} score={score} promotions={promotions} deliveries={deliveredLite} events={events} active={profile.is_active}>
        <div className="profileSettingsGrid growthSettingsGrid">
          <section className="panel mobileProfileCard"><div className="panelHead"><div className="titleIcon"><Smartphone size={18}/></div><div><span className="eyebrow">CİHAZ</span><h2>Uygulama kurulumu</h2><p>Telefonunda uygulama gibi açmak için ana ekrana ekle.</p></div></div><InstallAppButton/></section>
          <section className="panel mobileProfileCard"><div className="panelHead"><div className="titleIcon"><Bell size={18}/></div><div><span className="eyebrow">BİLDİRİMLER</span><h2>Görev uyarıları</h2><p>Yeni görev, promosyon ve plan değişikliklerini anında al.</p></div></div><PushEnrollment orgId={profile.org_id!} userId={userId}/></section>
          <section className="panel mobileProfileCard"><div className="panelHead"><div className="titleIcon"><MapPinned size={18}/></div><div><span className="eyebrow">KONUM</span><h2>Konum paylaşımı</h2><p>Aktif görevde operasyon merkezine son bilinen güvenli konum iletilir.</p></div></div><Link className="btn btnGhost" href="/courier">Konum ayarına git →</Link></section>
          <section className="panel mobileProfileCard"><div className="panelHead"><div className="titleIcon"><ShieldCheck size={18}/></div><div><span className="eyebrow">GÜVENLİK</span><h2>Sürüş modu</h2><p>Durum, fotoğraf ve imza işlemlerini yalnız araç güvenli şekilde durduğunda tamamla.</p></div></div></section>
        </div>
      </CourierGrowthProfile>
      <form action={logout}><button className="btn btnDanger btnLarge profileLogout"><LogOut size={17}/> Güvenli çıkış</button></form>
    </main>
    <nav className="bottomNav premiumBottomNav"><Link href="/courier"><ClipboardList size={18}/><span>Görevler</span></Link><Link href="/courier/history"><History size={18}/><span>Geçmiş</span></Link><Link className="active" href="/courier/profile"><UserRound size={18}/><span>Profil</span></Link></nav>
  </div>
}
