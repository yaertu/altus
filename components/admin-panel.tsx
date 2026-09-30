'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Building2, CheckCircle2, Copy, KeyRound, Palette, Phone, Plus, Save, ShieldCheck, Store, UserPlus, UsersRound } from 'lucide-react'

type UserRow={user_id:string;full_name:string;phone:string|null;role:string|null;is_active:boolean;store_id:string|null}
type StoreRow={id:string;name:string}
type Organization={name:string;brand_color:string;support_phone:string|null}
const ROLE_OPTIONS=[['store_staff','Mağaza personeli'],['store_manager','Mağaza yöneticisi'],['courier','Sevkiyat personeli'],['admin','Yönetici']] as const
const roleLabel=new Map<string,string>(ROLE_OPTIONS)

function initials(name:string){return name.split(' ').filter(Boolean).map(x=>x[0]).slice(0,2).join('').toUpperCase()}
function generatePassword(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#';return Array.from({length:14},()=>chars[Math.floor(Math.random()*chars.length)]).join('')}

export default function AdminPanel({users,stores,orgId,organization}:{users:UserRow[];stores:StoreRow[];orgId:string;organization:Organization}){
  const router=useRouter()
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [password,setPassword]=useState(()=>generatePassword())
  const [lastCreated,setLastCreated]=useState<{email:string;password:string}|null>(null)
  const activeUsers=useMemo(()=>users.filter(x=>x.is_active).length,[users])

  async function createUser(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setMessage('');setLastCreated(null)
    const f=new FormData(e.currentTarget)
    const email=String(f.get('email')||'').trim().toLowerCase()
    const full_name=String(f.get('full_name')||'').trim()
    const phone=String(f.get('phone')||'').trim()
    const role=String(f.get('role')||'courier')
    const store_id=String(f.get('store_id')||'')||null
    const requestedPassword=String(f.get('password')||'')
    const r=await fetch('/api/admin/users/create',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,full_name,phone,role,store_id,password:requestedPassword})})
    const j=await r.json().catch(()=>({}))
    setBusy(false)
    if(!r.ok){setMessage(j.error||'Hesap oluşturulamadı.');return}
    setMessage('Personel hesabı oluşturuldu ve mağazaya bağlandı.')
    setLastCreated({email,password:requestedPassword})
    setPassword(generatePassword())
    e.currentTarget.reset();router.refresh()
  }

  async function createStore(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setMessage('');const f=new FormData(e.currentTarget);const supabase=createClient();const {error}=await supabase.from('stores').insert({org_id:orgId,name:String(f.get('name')),code:String(f.get('code')||'')||null,phone:String(f.get('phone')||'')||null,address:String(f.get('address')||'')||null});setMessage(error?error.message:'Mağaza oluşturuldu.');setBusy(false);if(!error){e.currentTarget.reset();router.refresh()}}
  async function saveOrg(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);const f=new FormData(e.currentTarget);const supabase=createClient();const {error}=await supabase.from('organizations').update({name:String(f.get('name')),brand_color:String(f.get('brand_color')),support_phone:String(f.get('support_phone')||'')||null}).eq('id',orgId);setMessage(error?error.message:'Organizasyon ayarları kaydedildi.');setBusy(false);if(!error)router.refresh()}
  async function saveUser(e:React.FormEvent<HTMLFormElement>,userId:string){e.preventDefault();setBusy(true);const f=new FormData(e.currentTarget);const supabase=createClient();const {error}=await supabase.from('profiles').update({role:String(f.get('role')),store_id:String(f.get('store_id')||'')||null,is_active:f.get('is_active')==='on'}).eq('user_id',userId);setMessage(error?error.message:'Personel yetkisi güncellendi.');setBusy(false);if(!error)router.refresh()}

  return <div className="adminExperience">
    {message&&<div className={message.includes('oluşturuldu')||message.includes('kaydedildi')||message.includes('güncellendi')?'success adminToast':'error adminToast'}>{message}</div>}

    <section className="adminOverviewStrip">
      <div><UsersRound size={20}/><span><b>{users.length}</b><small>Toplam kullanıcı</small></span></div>
      <div><CheckCircle2 size={20}/><span><b>{activeUsers}</b><small>Aktif hesap</small></span></div>
      <div><Store size={20}/><span><b>{stores.length}</b><small>Mağaza</small></span></div>
      <div><ShieldCheck size={20}/><span><b>{users.filter(x=>x.role==='courier').length}</b><small>Sevkiyatçı</small></span></div>
    </section>

    <div className="adminTopGrid">
      <section className="panel adminSettingsCard">
        <div className="panelHead premiumSectionTitle"><div className="titleIcon"><Palette size={18}/></div><div><span className="eyebrow">MARKA</span><h2>Operasyon ayarları</h2><p>Panel adı, vurgu rengi ve destek hattı.</p></div></div>
        <form onSubmit={saveOrg} className="adminSettingsForm">
          <div className="field"><label>Operasyon adı</label><input className="input" name="name" defaultValue={organization.name} required/></div>
          <div className="field"><label>Marka rengi</label><div className="colorField premiumColorField"><input type="color" name="brand_color" defaultValue={organization.brand_color}/><div><strong>{organization.brand_color}</strong><small>Buton, durum ve vurgu rengi</small></div></div></div>
          <div className="field"><label>Destek telefonu</label><input className="input" name="support_phone" defaultValue={organization.support_phone||''} placeholder="0850 ..."/></div>
          <button className="btn btnPrimary" disabled={busy}><Save size={16}/> Ayarları kaydet</button>
        </form>
      </section>

      <section className="panel adminSettingsCard">
        <div className="panelHead premiumSectionTitle"><div className="titleIcon"><Building2 size={18}/></div><div><span className="eyebrow">ŞUBE</span><h2>Yeni mağaza</h2><p>Sevkiyat çıkış noktası veya operasyon şubesi oluştur.</p></div></div>
        <form onSubmit={createStore} className="adminStoreForm">
          <div className="field"><label>Mağaza adı</label><input className="input" name="name" required placeholder="Çorlu Merkez"/></div>
          <div className="field"><label>Kod</label><input className="input" name="code" placeholder="CORLU-01"/></div>
          <div className="field"><label>Telefon</label><input className="input" name="phone" placeholder="0 282 ..."/></div>
          <div className="field"><label>Adres</label><input className="input" name="address" placeholder="Mahalle, cadde, bina…"/></div>
          <button className="btn btnPrimary full" disabled={busy}><Plus size={16}/> Mağaza oluştur</button>
        </form>
      </section>
    </div>

    <section className="panel accountCreatePanel">
      <div className="panelHead premiumSectionTitle"><div className="titleIcon strong"><UserPlus size={18}/></div><div><span className="eyebrow">HESAP OLUŞTUR</span><h2>Personeli anında sisteme ekle</h2><p>Davet mailine bağlı kalmadan geçici şifreyle gerçek Auth hesabı oluşturur.</p></div><span className="badge s-delivered">Mail beklemez</span></div>
      <form onSubmit={createUser} className="accountCreateGrid">
        <div className="field"><label>Ad soyad</label><input className="input" name="full_name" required placeholder="Batuhan Görgün"/></div>
        <div className="field"><label>E-posta</label><input className="input" name="email" type="email" required placeholder="personel@firma.com"/></div>
        <div className="field"><label>Telefon</label><input className="input" name="phone" inputMode="tel" placeholder="05xx xxx xx xx"/></div>
        <div className="field"><label>Rol</label><select className="select" name="role" defaultValue="courier">{ROLE_OPTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
        <div className="field"><label>Mağaza</label><select className="select" name="store_id" defaultValue={stores[0]?.id||''}><option value="">Organizasyon geneli</option>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div className="field passwordField"><label>Geçici şifre</label><div className="passwordControl"><KeyRound size={16}/><input className="input" name="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required/><button type="button" onClick={()=>setPassword(generatePassword())}>Yenile</button></div><small>Personel ilk girişten sonra şifresini değiştirebilir.</small></div>
        <button disabled={busy} className="btn btnPrimary btnLarge createAccountButton">{busy?'Oluşturuluyor…':<><UserPlus size={17}/> Hesabı oluştur</>}</button>
      </form>
      {lastCreated&&<div className="createdCredential"><CheckCircle2 size={18}/><div><strong>Hesap hazır</strong><span>{lastCreated.email}</span></div><button type="button" onClick={()=>navigator.clipboard?.writeText(`${lastCreated.email}\n${lastCreated.password}`)}><Copy size={15}/> Bilgileri kopyala</button></div>}
    </section>

    <section className="panel userManagementPanel">
      <div className="panelHead premiumSectionTitle"><div className="titleIcon"><UsersRound size={18}/></div><div><span className="eyebrow">YETKİ YÖNETİMİ</span><h2>Kullanıcılar ve roller</h2><p>Rol, mağaza ve hesap durumunu tek satırdan yönet.</p></div><span className="badge s-new">{users.length} kullanıcı</span></div>
      <div className="userAdminTableHead"><span>Kullanıcı</span><span>Rol</span><span>Mağaza</span><span>Durum</span><span/></div>
      <div className="userAdminList">{users.map(u=><form key={u.user_id} className="userAdminRow premiumUserAdminRow" onSubmit={e=>saveUser(e,u.user_id)}>
        <div className="userIdentityCell"><div className="courierAvatar">{initials(u.full_name)}</div><div className="userAdminName"><strong>{u.full_name}</strong><small><Phone size={12}/>{u.phone||'Telefon eklenmemiş'}</small><em>{roleLabel.get(u.role||'store_staff')}</em></div></div>
        <select className="select" name="role" defaultValue={u.role||'store_staff'} aria-label="Kullanıcı rolü">{ROLE_OPTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
        <select className="select" name="store_id" defaultValue={u.store_id||''} aria-label="Mağaza"><option value="">Organizasyon geneli</option>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <label className="activeSwitch modernActiveSwitch"><input type="checkbox" name="is_active" defaultChecked={u.is_active}/><span><i/>{u.is_active?'Aktif':'Pasif'}</span></label>
        <button className="btn btnGhost saveUserButton" disabled={busy}><Save size={15}/> Kaydet</button>
      </form>)}</div>
    </section>
  </div>
}
