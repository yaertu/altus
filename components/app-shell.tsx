import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { Profile } from '@/lib/types'
import { logout } from '@/app/login/actions'
import NotificationCenter from './notification-center'
import { LayoutDashboard, Plus, ChartNoAxesCombined, Settings2, Truck, LogIn, LogOut } from 'lucide-react'

const roleLabel:Record<string,string>={admin:'Yönetici',store_manager:'Mağaza Yöneticisi',store_staff:'Mağaza Personeli',courier:'Sevkiyat Personeli'}
function initials(name:string){return name.split(' ').filter(Boolean).map(x=>x[0]).slice(0,2).join('').toUpperCase()}

export default function AppShell({profile,organization,children,preview=false}:{profile:Profile;organization:{name:string;brandColor:string};children:React.ReactNode;preview?:boolean}){
  const themeStyle={'--brand':organization.brandColor} as CSSProperties
  if(profile.role==='courier')return <div style={themeStyle}>{children}</div>
  const dashboardHref=preview?'/desktop-preview':'/dashboard'
  const newHref=preview?'/desktop-preview/new':'/deliveries/new'
  const reportsHref=preview?'/desktop-preview/reports':'/reports'
  const adminHref=preview?'/desktop-preview/admin':'/admin'
  const nav=[
    {href:dashboardHref,label:'Genel Bakış',icon:<LayoutDashboard size={18}/>},
    {href:newHref,label:'Yeni Sevkiyat',icon:<Plus size={18}/>},
    {href:reportsHref,label:'Raporlar',icon:<ChartNoAxesCombined size={18}/>},
    ...(profile.role==='admin'?[{href:adminHref,label:'Admin Paneli',icon:<Settings2 size={18}/>}]:[]),
  ]
  return <div className="shell premiumShell" style={themeStyle}>
    <header className="topbar premiumTopbar">
      <Link href={dashboardHref} className="brand premiumBrand" aria-label="Operasyon merkezine dön">
        <div className="brandMark">A</div>
        <div className="brandText"><strong>{organization.name}</strong><span>Sevkiyat ve saha operasyonu</span></div>
      </Link>
      <div className="topActions premiumTopActions">
        {preview?<>
          <span className="badge s-new previewBadge">Önizleme</span>
          <Link className="btn btnSoft compact topTextAction" href="/desktop-preview/courier"><Truck size={16}/> Sevkiyatçı</Link>
          <Link className="btn btnGhost compact topTextAction" href="/login"><LogIn size={16}/> Gerçek giriş</Link>
        </>:<>
          <NotificationCenter userId={profile.user_id} compact/>
          <div className="topAccount" title={`${profile.full_name} • ${profile.role?roleLabel[profile.role]:''}`}>
            <span>{initials(profile.full_name)}</span>
            <div><strong>{profile.full_name}</strong><small>{profile.role?roleLabel[profile.role]:''}</small></div>
          </div>
          <form action={logout}><button className="topLogout" type="submit" aria-label="Çıkış yap" title="Çıkış yap"><LogOut size={18}/></button></form>
        </>}
      </div>
    </header>

    <nav className="mobilePrimaryNav" aria-label="Mobil ana menü">
      {nav.map(item=><Link key={item.href} href={item.href}>{item.icon}<span>{item.label}</span></Link>)}
    </nav>

    <div className="layout premiumLayout">
      <aside className="sidebar premiumSidebar">
        <Link className="navLink" href={dashboardHref}><span className="navGlyph"><LayoutDashboard size={18}/></span><span>Genel Bakış</span></Link>
        <Link className="navLink" href={newHref}><span className="navGlyph"><Plus size={18}/></span><span>Yeni Sevkiyat</span></Link>
        <Link className="navLink" href={reportsHref}><span className="navGlyph"><ChartNoAxesCombined size={18}/></span><span>Raporlar</span></Link>
        {profile.role==='admin'&&<Link className="navLink navLinkAdmin" href={adminHref}><span className="navGlyph"><Settings2 size={18}/></span><span>Admin Paneli</span></Link>}
        <div className="userBox premiumUserBox"><div className="userAvatar">{initials(profile.full_name)}</div><div><strong>{profile.full_name}</strong><small>{profile.role?roleLabel[profile.role]:''}</small></div></div>
      </aside>
      <main className="content premiumContent">{children}</main>
    </div>
  </div>
}
