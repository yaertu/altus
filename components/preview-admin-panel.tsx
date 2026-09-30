'use client'

import { useState } from 'react'

const initialUsers=[
  {name:'Ertu Caymaz',role:'Yönetici',store:'Organizasyon geneli',active:true},
  {name:'Mehmet Kaya',role:'Sevkiyat personeli',store:'Merkez Mağaza',active:true},
  {name:'Can Demir',role:'Sevkiyat personeli',store:'Merkez Mağaza',active:true},
  {name:'Serkan Aydın',role:'Sevkiyat personeli',store:'Merkez Mağaza',active:true},
]

export default function PreviewAdminPanel(){
  const [message,setMessage]=useState('')
  const [users,setUsers]=useState(initialUsers)
  function simulate(text:string){setMessage(text);window.setTimeout(()=>setMessage(''),2800)}
  function invite(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const name=String(f.get('full_name')||'Yeni Personel');setUsers(x=>[...x,{name,role:String(f.get('role')||'Mağaza personeli'),store:'Merkez Mağaza',active:true}]);e.currentTarget.reset();simulate('Önizleme: personel daveti başarıyla oluşturuldu.')}
  return <div className="stack">
    {message&&<div className="success">{message}</div>}
    <div className="pageHead modernPageHead"><div><div className="eyebrow">YÖNETİM • MASAÜSTÜ ÖNİZLEME</div><h1>Admin ve organizasyon</h1><p>Mağaza, personel, roller ve operasyon ayarları tek yönetim ekranında.</p></div><div className="headHint"><span>Aktif personel</span><strong>{users.filter(x=>x.active).length}</strong></div></div>
    <div className="adminGrid">
      <div className="panel"><div className="panelHead"><div><h2>Organizasyon ayarları</h2><p>Marka ve destek bilgilerini merkezi yönet.</p></div></div><div className="stack"><div className="field"><label>Operasyon adı</label><input className="input" defaultValue="Altus Sevkiyat"/></div><div className="field"><label>Kurumsal renk</label><input className="input" defaultValue="#CF006F"/></div><div className="field"><label>Destek telefonu</label><input className="input" defaultValue="0850 000 00 00"/></div><button className="btn btnPrimary" onClick={()=>simulate('Önizleme: organizasyon ayarları kaydedildi.')}>Ayarları kaydet</button></div></div>
      <div className="panel"><div className="panelHead"><div><h2>Mağaza bilgisi</h2><p>Sevkiyat çıkış noktası ve operasyon merkezi.</p></div></div><div className="stack"><div className="field"><label>Mağaza</label><input className="input" defaultValue="Merkez Mağaza"/></div><div className="field"><label>Kod</label><input className="input" defaultValue="MERKEZ"/></div><div className="field"><label>Adres</label><input className="input" defaultValue="Çorlu / Tekirdağ"/></div><button className="btn btnSoft" onClick={()=>simulate('Önizleme: mağaza bilgisi güncellendi.')}>Mağazayı güncelle</button></div></div>
    </div>
    <div className="panel"><div className="panelHead"><div><h2>Personel davet et</h2><p>Önizleme modunda işlem yalnız ekranda simüle edilir.</p></div></div><form onSubmit={invite} className="formGrid"><div className="field"><label>Ad soyad</label><input className="input" name="full_name" required/></div><div className="field"><label>E-posta</label><input className="input" name="email" type="email" required/></div><div className="field"><label>Rol</label><select className="select" name="role"><option>Mağaza personeli</option><option>Mağaza yöneticisi</option><option>Sevkiyat personeli</option><option>Yönetici</option></select></div><div className="field"><label>Mağaza</label><select className="select"><option>Merkez Mağaza</option></select></div><div className="full"><button className="btn btnPrimary">Daveti oluştur →</button></div></form></div>
    <div className="panel"><div className="panelHead"><div><h2>Kullanıcı ve yetki yönetimi</h2><p>Rol ve çalışma durumu daha okunabilir tek listede.</p></div><span className="badge s-new">{users.length} kullanıcı</span></div><div className="userAdminList">{users.map((u,i)=><div className="userAdminRow" key={`${u.name}-${i}`}><div className="courierAvatar">{u.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div className="userAdminName"><strong>{u.name}</strong><small>{u.store}</small></div><select className="select" defaultValue={u.role}><option>Yönetici</option><option>Mağaza yöneticisi</option><option>Mağaza personeli</option><option>Sevkiyat personeli</option></select><label className="activeSwitch"><input type="checkbox" defaultChecked={u.active}/><span>Aktif</span></label><button className="btn btnGhost" onClick={()=>simulate(`${u.name} için önizleme değişikliği kaydedildi.`)}>Kaydet</button></div>)}</div></div>
  </div>
}
