import Link from 'next/link'
import { Bell, ClipboardList, History, UserRound, ArrowLeft, MapPinned, ShieldCheck, LogOut, Smartphone } from 'lucide-react'
import { requireProfile } from '@/lib/auth'
import { logout } from '@/app/login/actions'
import PushEnrollment from '@/components/push-enrollment'
import InstallAppButton from '@/components/install-app-button'
import OfflineSyncStatus from '@/components/offline-sync-status'

export default async function CourierProfilePage(){
  const {profile,userId}=await requireProfile(['courier'])
  return <div className="courierShell courierShellModern fadeIn">
    <OfflineSyncStatus/>
    <header className="courierTop courierTopModern"><div className="courierTopRow"><div className="courierIdentity"><div className="avatar">{profile.full_name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><strong>Profil ve cihaz</strong><div className="meta">Hesap ve saha ayarları</div></div></div><Link className="btn btnGhost compact" href="/courier"><ArrowLeft size={16}/> Görevler</Link></div></header>
    <main className="courierContent courierContentModern profilePageModern">
      <section className="panel mobileProfileCard premiumProfileIdentity"><div className="profileIdentityAvatar">{profile.full_name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><span className="eyebrow">SEVKİYAT PERSONELİ</span><h2>{profile.full_name}</h2><p>{profile.phone||'Telefon bilgisi eklenmemiş'}</p></div></section>
      <div className="profileSettingsGrid">
        <section className="panel mobileProfileCard"><div className="panelHead"><div className="titleIcon"><Smartphone size={18}/></div><div><span className="eyebrow">CİHAZ</span><h2>Uygulama kurulumu</h2><p>Telefonunda uygulama gibi açmak için ana ekrana ekle.</p></div></div><InstallAppButton/></section>
        <section className="panel mobileProfileCard"><div className="panelHead"><div className="titleIcon"><Bell size={18}/></div><div><span className="eyebrow">BİLDİRİMLER</span><h2>Görev uyarıları</h2><p>Yeni görev ve plan değişikliklerini anında al.</p></div></div><PushEnrollment orgId={profile.org_id!} userId={userId}/></section>
        <section className="panel mobileProfileCard"><div className="panelHead"><div className="titleIcon"><MapPinned size={18}/></div><div><span className="eyebrow">KONUM</span><h2>Konum paylaşımı</h2><p>Görev ekranında açıldığında operasyon merkezine son bilinen konumun iletilir.</p></div></div><Link className="btn btnGhost" href="/courier">Konum ayarına git →</Link></section>
        <section className="panel mobileProfileCard"><div className="panelHead"><div className="titleIcon"><ShieldCheck size={18}/></div><div><span className="eyebrow">GÜVENLİK</span><h2>Sürüş modu</h2><p>Görev, fotoğraf, imza ve durum işlemlerini yalnız araç güvenli şekilde durduğunda tamamla.</p></div></div></section>
      </div>
      <form action={logout}><button className="btn btnDanger btnLarge profileLogout"><LogOut size={17}/> Güvenli çıkış</button></form>
    </main>
    <nav className="bottomNav premiumBottomNav"><Link href="/courier"><ClipboardList size={18}/><span>Görevler</span></Link><Link href="/courier/history"><History size={18}/><span>Geçmiş</span></Link><Link className="active" href="/courier/profile"><UserRound size={18}/><span>Profil</span></Link></nav>
  </div>
}
