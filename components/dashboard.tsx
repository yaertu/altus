"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Bell, Box, CalendarDays, Check, CheckCircle2, ChevronDown,
  ClipboardCheck, Clock3, History, LayoutDashboard, MapPin, Menu, Navigation,
  PackageCheck, Phone, Plus, Search, Settings, Store, Trash2, Truck, UserPlus,
  UserRound, Users, X
} from "lucide-react";
import DeveloperBadge from "./developer-badge";
import LoginScreen from "./login-screen";
import WebIcon from "./web-icon";
import InstallPwaCard from "./install-pwa-card";
import MobileBottomNav from "./mobile-bottom-nav";
import { ActivityEvent, Delivery, DeliveryStatus, Priority } from "@/lib/types";
import {
  cloudAvailable, getCurrentUser, getMyProfile, insertDelivery, insertEvent, insertStaff,
  loadCloudData, patchDelivery, removeCloudDelivery, signOut, subscribeCloud, unsubscribeCloud,
  type Profile
} from "@/lib/cloud";
import { enablePushNotifications, sendAssignmentPush } from "@/lib/push";

type View = "dashboard" | "deliveries" | "staff" | "customers" | "checklists" | "planning" | "logs" | "settings";
type Staff = { id: string; name: string; phone: string; userId?: string | null };
const DKEY = "yaateslimat:v2:deliveries", SKEY = "yaateslimat:v2:staff", EKEY = "yaateslimat:v2:events";
const labels: Record<DeliveryStatus,string> = { new:"Yeni", assigned:"Atandı", seen:"Görüldü", on_route:"Yolda", completed:"Tamamlandı", issue:"Sorun" };
const checks: Array<[keyof Delivery["checklist"],string]> = [
  ["addressVerified","Adres doğrulandı"], ["customerCalled","Müşteri arandı"], ["productLoaded","Ürün araca yüklendi"],
  ["modelChecked","Model / ürün eşleşti"], ["accessoriesChecked","Aksesuarlar kontrol edildi"], ["returnChecked","Geri alım kontrol edildi"]
];
const nav: Array<[View,string,React.ReactNode]> = [
  ["dashboard","Kontrol Merkezi",<LayoutDashboard size={18}/>], ["deliveries","Teslimatlar",<PackageCheck size={18}/>],
  ["staff","Personeller",<Users size={18}/>], ["customers","Müşteriler",<UserRound size={18}/>],
  ["checklists","Kontrol Listeleri",<ClipboardCheck size={18}/>], ["planning","Planlama",<CalendarDays size={18}/>],
  ["logs","İşlem Kayıtları",<History size={18}/>], ["settings","Ayarlar",<Settings size={18}/>]
];
function id(p:string){ return p+"-"+Date.now()+"-"+Math.random().toString(36).slice(2,7); }
function today(){ const d=new Date(), o=d.getTimezoneOffset()*60000; return new Date(d.getTime()-o).toISOString().slice(0,10); }
function initials(n:string){ return n.split(" ").filter(Boolean).map(x=>x[0]).join("").slice(0,2).toUpperCase(); }
function tel(p:string){ return "tel:"+p.replace(/[^\d+]/g,""); }
function map(d:Delivery){ return "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(d.address+", "+d.district+", "+d.city); }

export default function Dashboard(){
  const [view,setView]=useState<View>("dashboard"), [mode,setMode]=useState<"office"|"courier">("office"), [side,setSide]=useState(false);
  const [deliveries,setDeliveries]=useState<Delivery[]>([]), [staff,setStaff]=useState<Staff[]>([]), [events,setEvents]=useState<ActivityEvent[]>([]);
  const [selected,setSelected]=useState<Delivery|null>(null), [newOpen,setNewOpen]=useState(false), [staffOpen,setStaffOpen]=useState(false);
  const [courier,setCourier]=useState(""), [notify,setNotify]=useState(false), [splash,setSplash]=useState(true), [ready,setReady]=useState(false);
  const [requireChecks,setRequireChecks]=useState(true), [query,setQuery]=useState(""), [filter,setFilter]=useState<"all"|DeliveryStatus>("all");
  const [cloud,setCloud]=useState(false), [cloudError,setCloudError]=useState(""), [profile,setProfile]=useState<Profile|null>(null), [signedIn,setSignedIn]=useState(false), [authReady,setAuthReady]=useState(!cloudAvailable());
  const [online,setOnline]=useState(true);

  useEffect(()=>{ try{
    const old=localStorage.getItem(DKEY)||localStorage.getItem("yaateslimat:deliveries");
    if(old) setDeliveries(JSON.parse(old)); const s=localStorage.getItem(SKEY), e=localStorage.getItem(EKEY);
    if(s) setStaff(JSON.parse(s)); if(e) setEvents(JSON.parse(e));
  }catch{} setReady(true); setNotify(typeof Notification!=="undefined"&&Notification.permission==="granted");
    if("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(()=>undefined);
    setOnline(navigator.onLine);
    const goOnline=()=>setOnline(true), goOffline=()=>setOnline(false);
    window.addEventListener("online",goOnline); window.addEventListener("offline",goOffline);
    const params=new URLSearchParams(window.location.search);
    if(params.get("action")==="new-delivery") setNewOpen(true);
    if(params.get("view")==="deliveries") setView("deliveries");
    if(params.has("action")||params.has("view")) window.history.replaceState({},"",window.location.pathname);
    const t=window.setTimeout(()=>setSplash(false),900);
    return()=>{window.clearTimeout(t);window.removeEventListener("online",goOnline);window.removeEventListener("offline",goOffline)};
  },[]);
  useEffect(()=>{ if(ready)localStorage.setItem(DKEY,JSON.stringify(deliveries)); },[deliveries,ready]);
  useEffect(()=>{ if(ready)localStorage.setItem(SKEY,JSON.stringify(staff)); },[staff,ready]);
  useEffect(()=>{ if(ready)localStorage.setItem(EKEY,JSON.stringify(events.slice(0,200))); },[events,ready]);

  useEffect(()=>{
    let alive=true;
    let channel:any=null;
    async function refresh(){
      const data=await loadCloudData();
      if(!alive)return;
      setDeliveries(data.deliveries);
      setStaff(data.staff);
      setEvents(data.events);
    }
    async function connect(){
      if(!cloudAvailable()){ setAuthReady(true); return; }
      try{
        const user=await getCurrentUser();
        if(!alive)return;
        setSignedIn(Boolean(user));
        setAuthReady(true);
        if(!user)return;
        const p=await getMyProfile();
        if(!alive)return;
        setProfile(p);
        if(p?.role==="courier"){ setMode("courier"); setCourier(p.fullName); }
        await refresh();
        setCloud(true);
        channel=subscribeCloud(()=>{ refresh().catch(()=>undefined); });
      }catch(err:any){
        if(alive){ setCloud(false); setCloudError(err?.message||"Bulut bağlantısı kurulamadı."); }
      }
    }
    connect();
    return()=>{alive=false;unsubscribeCloud(channel)};
  },[]);

  const names=useMemo(()=>Array.from(new Set(staff.map(x=>x.name).concat(deliveries.map(x=>x.assignee).filter(x=>x&&x!=="Atanmamış")))),[staff,deliveries]);
  useEffect(()=>{ if(!courier&&names[0])setCourier(names[0]); },[courier,names]);
  const day=today(), todayList=deliveries.filter(x=>x.date===day), active=todayList.filter(x=>!["completed","issue"].includes(x.status)).length;
  const completed=todayList.filter(x=>x.status==="completed").length, problems=deliveries.filter(x=>x.status==="issue").length;
  const filtered=deliveries.filter(d=>{
    const q=query.toLocaleLowerCase("tr-TR"), h=(d.customerName+" "+d.phone+" "+d.orderNo+" "+d.address+" "+d.assignee+" "+d.items.map(i=>i.brand+" "+i.product+" "+(i.model||"")).join(" ")).toLocaleLowerCase("tr-TR");
    return (!q||h.includes(q))&&(filter==="all"||d.status===filter);
  });
  const my=deliveries.filter(d=>d.assignee===courier&&d.date===day&&!["completed","issue"].includes(d.status));
  function log(title:string,d?:Delivery,detail?:string){
    const event:ActivityEvent={id:id("e"),deliveryId:d?.id,orderNo:d?.orderNo,actor:mode==="courier"?(courier||profile?.fullName||"Sevkiyatçı"):(profile?.fullName||"Dükkan"),type:"status",title,detail,createdAt:new Date().toISOString()};
    setEvents(p=>[event,...p]);
    if(cloud) insertEvent({deliveryId:event.deliveryId,orderNo:event.orderNo,actor:event.actor,type:event.type,title:event.title,detail:event.detail}).catch(()=>undefined);
  }
  function setStatus(d:Delivery,status:DeliveryStatus){
    if(status==="completed"&&requireChecks&&Object.values(d.checklist).some(v=>!v))return;
    const updated={...d,status,updatedAt:new Date().toISOString()};
    setDeliveries(p=>p.map(x=>x.id===d.id?updated:x)); setSelected(s=>s?.id===d.id?updated:s); log("Durum: "+labels[status],d,d.customerName);
    if(cloud) patchDelivery(d.id,{status}).catch((err:any)=>setCloudError(err?.message||"Durum buluta yazılamadı."));
  }
  function toggle(d:Delivery,k:keyof Delivery["checklist"]){
    const value=!d.checklist[k], checklist={...d.checklist,[k]:value}, updated={...d,checklist,updatedAt:new Date().toISOString()};
    setDeliveries(p=>p.map(x=>x.id===d.id?updated:x)); setSelected(s=>s?.id===d.id?updated:s); log(value?"Kontrol tamamlandı":"Kontrol geri alındı",d,checks.find(x=>x[0]===k)?.[1]);
    if(cloud) patchDelivery(d.id,{checklist}).catch((err:any)=>setCloudError(err?.message||"Kontrol buluta yazılamadı."));
  }
  async function notifications(){
    try{
      if(cloud){ await enablePushNotifications(); setNotify(true); }
      else if("Notification" in window){ const p=await Notification.requestPermission(); setNotify(p==="granted"); }
    }catch(err:any){ setCloudError(err?.message||"Bildirim açılamadı."); }
  }
  async function addDelivery(d:Omit<Delivery,"id"|"createdAt"|"updatedAt"|"checklist">){
    const now=new Date().toISOString();
    try{
      const rec=cloud ? await insertDelivery(d,staff) : {...d,id:id("d"),createdAt:now,updatedAt:now,status:(d.assignee==="Atanmamış"?"new":"assigned") as DeliveryStatus,checklist:{addressVerified:false,customerCalled:false,productLoaded:false,modelChecked:false,accessoriesChecked:false,returnChecked:false}};
      setDeliveries(p=>[rec,...p.filter(x=>x.id!==rec.id)]); setNewOpen(false); log("Yeni teslimat oluşturuldu",rec,rec.assignee);
      if(cloud&&rec.assignee!=="Atanmamış") sendAssignmentPush(rec.id).catch(()=>undefined);
    }catch(err:any){ setCloudError(err?.message||"Teslimat kaydedilemedi."); }
  }
  async function addStaff(s:{name:string;phone:string}){
    try{
      const rec=cloud ? await insertStaff(s.name,s.phone) : {...s,id:id("s")};
      setStaff(p=>[...p.filter(x=>x.id!==rec.id),rec]); setStaffOpen(false);
    }catch(err:any){ setCloudError(err?.message||"Personel kaydedilemedi."); }
  }
  function remove(d:Delivery){ setDeliveries(p=>p.filter(x=>x.id!==d.id)); setSelected(null); log("Teslimat silindi",d,d.customerName); if(cloud)removeCloudDelivery(d.id).catch((err:any)=>setCloudError(err?.message||"Silme işlemi buluta yazılamadı.")); }

  const authRequired=process.env.NEXT_PUBLIC_REQUIRE_AUTH==="true";
  if(authRequired&&cloudAvailable()&&authReady&&!signedIn) return <LoginScreen onSuccess={()=>window.location.reload()}/>;

  return <div className="app">
    {splash&&<div className="splash"><div className="splashLogo"><Truck/></div><b>yaaTeslimat</b><span>Teslimat Operasyon Sistemi</span><DeveloperBadge compact/></div>}
    <aside className={"side "+(side?"open":"")}>
      <div className="brand"><div><Truck size={21}/></div><p><b>yaaTeslimat</b><span>Sevkiyat Yönetimi</span></p><button onClick={()=>setSide(false)}><X size={18}/></button></div>
      {profile?.role==="courier"?<div className="roleChip"><Truck size={15}/><span>Sevkiyatçı modu</span><i>CANLI</i></div>:<div className="modes"><button className={mode==="office"?"on":""} onClick={()=>{setMode("office");setView("dashboard")}}><Store size={15}/>Dükkan</button><button className={mode==="courier"?"on":""} onClick={()=>setMode("courier")}><Truck size={15}/>Sevkiyatçı</button></div>}
      {mode==="office"?<nav>{nav.map(([v,l,i])=><button key={v} className={view===v?"on":""} onClick={()=>{setView(v);setSide(false)}}>{i}<span>{l}</span>{v==="deliveries"&&active>0?<b>{active}</b>:null}</button>)}</nav>:<nav><button className="on"><Truck size={18}/><span>Görevlerim</span></button><button onClick={()=>setMode("office")}><Store size={18}/><span>Dükkana dön</span></button></nav>}
      <div className="grow"/><div className="online"><i/><p><b>Sistem hazır</b><span>Mobil • Tablet • PC</span></p></div><DeveloperBadge/>
    </aside>
    <main>
      <header><button className="hamb" onClick={()=>setSide(true)}><Menu size={20}/></button><div><small>{mode==="office"?"DÜKKAN OPERASYONU":"SEVKİYATÇI EKRANI"}</small><h1>{mode==="office"?nav.find(x=>x[0]===view)?.[1]:"Bugünkü Görevler"}</h1></div><div className="actions"><span className={"syncState "+(!online?"offline":cloud?"live":"local")}><i/>{!online?"İnternet yok":cloud?"Canlı senkron":"Yerel mod"}</span>{mode==="courier"&&profile?.role!=="courier"?<label className="select"><UserRound size={15}/><select value={courier} onChange={e=>setCourier(e.target.value)}><option value="">Personel seç</option>{names.map(n=><option key={n}>{n}</option>)}</select><ChevronDown size={13}/></label>:null}<button className="soft" onClick={notifications}><Bell size={16}/><span>{notify?"Bildirim açık":"Bildirimleri aç"}</span></button>{mode==="office"?<button className="primary" onClick={()=>setNewOpen(true)}><Plus size={17}/>Yeni teslimat</button>:null}</div></header>
      <div className="date"><CalendarDays size={15}/><span>{new Intl.DateTimeFormat("tr-TR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(new Date())}</span>{cloudError?<button className="cloudError" onClick={()=>setCloudError("")}><AlertTriangle size={13}/>{cloudError}<X size={12}/></button>:null}</div>
      {mode==="courier"?<CourierList list={my} courier={courier} onOpen={setSelected} onStatus={setStatus} onToggle={toggle} requireChecks={requireChecks}/>:<>
        {view==="dashboard"&&<DashboardHome total={todayList.length} active={active} completed={completed} problems={problems} list={todayList.slice(0,5)} staff={staff} onNew={()=>setNewOpen(true)} onStaff={()=>setStaffOpen(true)} onOpen={setSelected}/>}
        {view==="deliveries"&&<section className="card page"><PageHead tag="DÜKKAN KAYITLARI" title="Tüm teslimatlar" text="Müşteri, adres, ürün ve personel bilgilerini tek yerden takip et." action={<button className="primary" onClick={()=>setNewOpen(true)}><Plus size={16}/>Yeni teslimat</button>}/><div className="filters"><label><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="İsim, telefon, ürün, sipariş no..."/></label><label className="select"><select value={filter} onChange={e=>setFilter(e.target.value as "all"|DeliveryStatus)}><option value="all">Tüm durumlar</option>{Object.keys(labels).map(k=><option key={k} value={k}>{labels[k as DeliveryStatus]}</option>)}</select><ChevronDown size={13}/></label></div><DeliveryList list={filtered} onOpen={setSelected}/></section>}
        {view==="staff"&&<StaffPage staff={staff} deliveries={deliveries} onAdd={()=>setStaffOpen(true)}/>}
        {view==="customers"&&<CustomersPage deliveries={deliveries} onOpen={setSelected}/>}
        {view==="checklists"&&<ChecklistPage deliveries={deliveries}/>}
        {view==="planning"&&<PlanningPage deliveries={deliveries} onOpen={setSelected}/>}
        {view==="logs"&&<LogsPage events={events}/>}
        {view==="settings"&&<SettingsPage requireChecks={requireChecks} setRequireChecks={setRequireChecks} notify={notify} onNotify={notifications} cloud={cloud} profile={profile} onSignOut={async()=>{await signOut();window.location.reload()}} onClear={()=>{if(confirm("Bu cihazdaki yerel kayıtlar silinsin mi?")){setDeliveries([]);setStaff([]);setEvents([])}}}/>} 
      </>}
      <footer><span>yaaTeslimat • v0.4</span><DeveloperBadge compact/></footer>
      {mode==="office"?<MobileBottomNav view={view} onView={v=>setView(v)} onNew={()=>setNewOpen(true)}/>:null}
    </main>
    {newOpen&&<NewDelivery staff={names} onClose={()=>setNewOpen(false)} onSave={addDelivery}/>}
    {staffOpen&&<NewStaff onClose={()=>setStaffOpen(false)} onSave={addStaff}/>} 
    {selected&&<Drawer d={deliveries.find(x=>x.id===selected.id)||selected} office={mode==="office"} requireChecks={requireChecks} onClose={()=>setSelected(null)} onStatus={s=>setStatus(selected,s)} onToggle={k=>toggle(selected,k)} onDelete={()=>remove(selected)}/>}
  </div>;
}

function DashboardHome(p:{total:number;active:number;completed:number;problems:number;list:Delivery[];staff:Staff[];onNew:()=>void;onStaff:()=>void;onOpen:(d:Delivery)=>void}){
  return <div className="stack">
    <section className="opsHero">
      <div className="opsHeroCopy">
        <span className="eyebrow"><i/>CANLI SEVKİYAT OPERASYONU</span>
        <h2>Bugünün tüm teslimatını tek ekrandan yönet.</h2>
        <p>Dükkanda görevi oluştur, personele ata, telefondan ilerleyişi takip et. Adres, ürün, notlar ve zorunlu kontroller aynı kayıtta kalır.</p>
        <div className="heroActions">
          <button className="primary heroPrimary" onClick={p.onNew}><Plus size={18}/><span><b>Yeni teslimat</b><small>Görev oluştur ve ata</small></span></button>
          <button className="soft heroSecondary" onClick={p.onStaff}><UserPlus size={18}/><span><b>Personel ekle</b><small>Sevkiyat ekibini yönet</small></span></button>
        </div>
      </div>
      <div className="opsFlow" aria-label="Teslimat akışı">
        <div><span><WebIcon name="storefront-outline" size={30}/></span><p><b>1. Dükkan</b><small>Kaydı oluşturur</small></p></div>
        <i/>
        <div><span><WebIcon name="truck-fast-outline" size={30}/></span><p><b>2. Sevkiyatçı</b><small>Görevi telefondan alır</small></p></div>
        <i/>
        <div><span><WebIcon name="clipboard-check-outline" size={30}/></span><p><b>3. Kontrol</b><small>6 adımı tamamlar</small></p></div>
        <i/>
        <div><span><WebIcon name="package-check" size={30}/></span><p><b>4. Teslim</b><small>İşi kapatır</small></p></div>
      </div>
    </section>

    <div className="stats">
      <Stat n={p.total} t="Bugünkü toplam"/>
      <Stat n={p.active} t="Devam eden"/>
      <Stat n={p.completed} t="Teslim edildi"/>
      <Stat n={p.problems} t="Sorun bekliyor" warn/>
    </div>

    <section className="card deliveryBoard">
      <PageHead tag="BUGÜN" title="Sevkiyat akışı" text="Bir kayda dokun; müşteri, adres, ürün, personel ve kontroller açılsın." action={<button className="soft compactAction" onClick={p.onNew}><Plus size={15}/>Yeni kayıt</button>}/>
      {p.list.length?<DeliveryList list={p.list} onOpen={p.onOpen}/>:<Empty title="Bugün için teslimat yok" text="İlk görevi oluşturmak için “Yeni teslimat” düğmesine bas."/>}
    </section>
  </div>;
}
function Stat({n,t,warn}:{n:number;t:string;warn?:boolean}){return <div className={"stat "+(warn?"warn":"")}><span>{warn?<AlertTriangle/>:<Box/>}</span><p><b>{n}</b><small>{t}</small></p></div>}
function PageHead({tag,title,text,action}:{tag:string;title:string;text:string;action?:React.ReactNode}){return <div className="pageHead"><div><small>{tag}</small><h2>{title}</h2><p>{text}</p></div>{action}</div>}
function Empty({title,text}:{title:string;text:string}){return <div className="empty"><PackageCheck size={28}/><b>{title}</b><span>{text}</span></div>}
function DeliveryList({list,onOpen}:{list:Delivery[];onOpen:(d:Delivery)=>void}){return <div className="list">{list.length?list.map(d=>{const done=Object.values(d.checklist).filter(Boolean).length;const item=d.items[0];return <button className="row deliveryRow" key={d.id} onClick={()=>onOpen(d)}><div className="customerCell"><div className="badges"><span className={"status s-"+d.status}>{labels[d.status]}</span>{d.priority!=="normal"?<span className={"prio p-"+d.priority}>{d.priority==="critical"?"Acil":"Öncelikli"}</span>:null}<small>{d.orderNo}</small></div><h3>{d.customerName}</h3><p><span><MapPin size={14}/>{d.district||"İlçe yok"}</span><span><Clock3 size={14}/>{d.timeWindow}</span><span><UserRound size={14}/>{d.assignee}</span></p></div><div className="product deliveryProduct"><span className="productIcon"><WebIcon product={item?.product||""} size={30}/></span><p><small>ÜRÜN</small><b>{item?.brand+" • "+item?.product}</b><span>{item?.model||"Model yok"}</span></p></div><div className="progress deliveryProgress"><p><span>Hazırlık</span><b>{done}/6</b></p><i><em style={{width:(done/6*100)+"%"}}/></i><small>{done===6?"Hazır":"Kontroller sürüyor"}</small></div><span className="rowArrow">›</span></button>}):<Empty title="Kayıt yok" text="Henüz teslimat oluşturulmadı."/>}</div>}
function StaffPage({staff,deliveries,onAdd}:{staff:Staff[];deliveries:Delivery[];onAdd:()=>void}){return <section className="card page"><PageHead tag="SEVKİYAT EKİBİ" title="Personeller" text="Dükkandan görev atayacağın personeller." action={<button className="primary" onClick={onAdd}><UserPlus size={16}/>Personel ekle</button>}/>{staff.length?<div className="staffGrid">{staff.map(s=>{const a=deliveries.filter(d=>d.assignee===s.name&&!["completed","issue"].includes(d.status)).length;return <div className="staffCard" key={s.id}><div>{initials(s.name)}</div><h3>{s.name}</h3><a href={tel(s.phone)}>{s.phone||"Telefon yok"}</a><p><b>{a}</b><span>aktif teslimat</span></p></div>})}</div>:<Empty title="Personel eklenmedi" text="Önce sevkiyat personelini ekle."/>}</section>}
function CustomersPage({deliveries,onOpen}:{deliveries:Delivery[];onOpen:(d:Delivery)=>void}){const groups=Array.from(new Map(deliveries.map(d=>[d.customerName+"|"+d.phone,d])).values());return <section className="card page"><PageHead tag="MÜŞTERİLER" title="Müşteri rehberi" text="Teslimatlardan otomatik oluşur."/>{groups.length?<div className="customerList">{groups.map(d=><button key={d.id} onClick={()=>onOpen(d)}><span>{initials(d.customerName)}</span><p><b>{d.customerName}</b><small>{d.address+" • "+d.district}</small></p><em><Phone size={14}/>{d.phone}</em></button>)}</div>:<Empty title="Müşteri yok" text="Teslimat oluşturdukça rehber oluşur."/>}</section>}
function ChecklistPage({deliveries}:{deliveries:Delivery[]}){return <section className="card page"><PageHead tag="ZORUNLU KONTROLLER" title="Kontrol listeleri" text="Personel teslimatı kapatmadan önce bu adımları işaretler."/><div className="checkDefs">{checks.map(([k,l])=>{const n=deliveries.filter(d=>d.checklist[k]).length;return <div key={k}><span><Check/></span><p><b>{l}</b><small>{n+" / "+deliveries.length+" kayıtta tamamlandı"}</small></p></div>})}</div></section>}
function PlanningPage({deliveries,onOpen}:{deliveries:Delivery[];onOpen:(d:Delivery)=>void}){const [date,setDate]=useState(today());const list=deliveries.filter(d=>d.date===date).sort((a,b)=>a.timeWindow.localeCompare(b.timeWindow));return <section className="card page"><PageHead tag="GÜNLÜK PLAN" title="Planlama" text="Tarih seçip günün sevkiyat sırasını gör." action={<input className="dateInput" type="date" value={date} onChange={e=>setDate(e.target.value)}/>} /><DeliveryList list={list} onOpen={onOpen}/></section>}
function LogsPage({events}:{events:ActivityEvent[]}){return <section className="card page"><PageHead tag="DENETİM İZİ" title="İşlem kayıtları" text="Oluşturma, durum ve kontrol hareketleri."/>{events.length?<div className="logs">{events.map(e=><div key={e.id}><span><History size={15}/></span><p><b>{e.title}</b><small>{(e.detail||"")+" • "+(e.orderNo||"Sistem")}</small></p><time>{new Intl.DateTimeFormat("tr-TR",{hour:"2-digit",minute:"2-digit"}).format(new Date(e.createdAt))}</time></div>)}</div>:<Empty title="İşlem kaydı yok" text="İşlem yaptıkça burada görünür."/>}</section>}
function SettingsPage({requireChecks,setRequireChecks,notify,onNotify,cloud,profile,onSignOut,onClear}:{requireChecks:boolean;setRequireChecks:(v:boolean)=>void;notify:boolean;onNotify:()=>void;cloud:boolean;profile:Profile|null;onSignOut:()=>void;onClear:()=>void}){return <div className="settings settingsV4"><InstallPwaCard/><section className="card"><PageHead tag="OPERASYON" title="Teslimat kuralı" text="Personel işi eksik kapatmasın."/><div className="setting"><p><b>6 kontrol tamamlanmadan “Teslim edildi” olmasın</b><small>Adres, arama, yükleme, model, aksesuar ve geri alım kontrol edilir.</small></p><button className={requireChecks?"on":""} onClick={()=>setRequireChecks(!requireChecks)}><i/></button></div></section><section className="card"><PageHead tag="BAĞLANTI" title={cloud?"Canlı bağlantı açık":"Bu cihazda çalışıyor"} text={cloud?"Dükkan ve sevkiyatçı aynı veriyi anında görür.":"Supabase bağlanınca cihazlar otomatik senkron olur."}/><div className="connectionInfo"><i className={cloud?"on":""}/><p><b>{profile?.fullName||"Bu cihaz"}</b><small>{cloud?"canlı senkron":profile?.role||"yerel mod"}</small></p>{profile?<button className="soft" onClick={onSignOut}>Çıkış yap</button>:null}</div></section><section className="card"><PageHead tag="BİLDİRİM" title={notify?"Bildirimler açık":"Bildirimleri aç"} text="Yeni görev geldiğinde personelin telefonuna haber ver."/><button className="primary settingsAction" onClick={onNotify}><Bell size={16}/>{notify?"Bildirim hazır":"Bildirim izni ver"}</button></section><section className="card danger"><PageHead tag="BAKIM" title="Yerel önbelleği temizle" text="Canlı veritabanını silmez; yalnız bu cihazdaki kopyayı temizler."/><button onClick={onClear}><Trash2 size={16}/>Bu cihazı temizle</button></section></div>}
function CourierList({list,courier,onOpen,onStatus,onToggle,requireChecks}:{list:Delivery[];courier:string;onOpen:(d:Delivery)=>void;onStatus:(d:Delivery,s:DeliveryStatus)=>void;onToggle:(d:Delivery,k:keyof Delivery["checklist"])=>void;requireChecks:boolean}){if(!courier)return <div className="courierEmpty"><WebIcon name="truck-fast-outline" size={52}/><h2>Önce personeli seç</h2><p>Personeli seçince sadece onun bugünkü işleri görünür.</p></div>;return <div className="courier"><div className="courierHero courierHeroPremium"><div><small>BUGÜNÜN GÖREVLERİ</small><h2>Merhaba, {courier.split(" ")[0]} 👋</h2><p>Üstten alta sırayla git. Ara → yol tarifi → kontroller → teslim.</p></div><b>{list.length}<span>kalan görev</span></b></div>{list.length?list.map(d=>{const done=Object.values(d.checklist).filter(Boolean).length;return <article className="task" key={d.id}><div className="taskTop"><span className={"status s-"+d.status}>{labels[d.status]}</span><small>{d.orderNo}</small></div><h2>{d.customerName}</h2><div className="addr"><MapPin/><p><b>{d.address}</b><span>{d.district+", "+d.city}</span></p></div><div className="quick"><a href={tel(d.phone)}><Phone/>Ara</a><a href={map(d)} target="_blank" rel="noreferrer"><Navigation/>Yol tarifi</a><button onClick={()=>onOpen(d)}><PackageCheck/>Detay</button></div><div className="taskProduct"><span className="productIcon"><WebIcon product={d.items[0]?.product||""} size={32}/></span><p><small>ÜRÜN</small><b>{d.items[0]?.brand+" "+d.items[0]?.product+(d.items[0]?.model?" • "+d.items[0]?.model:"")}</b></p></div>{d.notes?<div className="note"><AlertTriangle/><p><b>Dükkan notu</b><span>{d.notes}</span></p></div>:null}<div className="taskChecks"><p><b>Kontroller</b><span>{done}/6</span></p>{checks.map(([k,l])=><button className={d.checklist[k]?"on":""} onClick={()=>onToggle(d,k)} key={k}><i>{d.checklist[k]?<Check size={13}/>:null}</i>{l}</button>)}</div><div className="taskActions">{d.status==="assigned"?<button className="primary" onClick={()=>onStatus(d,"seen")}>Görevi gördüm</button>:null}{d.status==="seen"?<button className="primary" onClick={()=>onStatus(d,"on_route")}><Truck size={17}/>Yola çıktım</button>:null}{d.status==="on_route"?<button className="primary" disabled={requireChecks&&done<6} onClick={()=>onStatus(d,"completed")}><CheckCircle2 size={17}/>Teslim edildi</button>:null}<button className="issue" onClick={()=>onStatus(d,"issue")}><AlertTriangle size={16}/>Sorun bildir</button></div></article>}):<div className="card"><Empty title="Bugün görev yok" text="Dükkan bu personele teslimat atadığında burada görünür."/></div>}</div>}

function NewDelivery({staff,onClose,onSave}:{staff:string[];onClose:()=>void;onSave:(d:Omit<Delivery,"id"|"createdAt"|"updatedAt"|"checklist">)=>void}){
  const [f,setF]=useState({
    name:"",phone:"",address:"",district:"",city:"İstanbul",brand:"ALTUS",product:"",model:"",
    assignee:staff[0]||"Atanmamış",date:today(),time:"09:00 - 12:00",priority:"normal" as Priority,
    notes:"",service:false,install:false,old:false
  });
  const [err,setErr]=useState("");
  const quickProducts=["Bulaşık Makinesi","Çamaşır Makinesi","Buzdolabı","Fırın","Mikrodalga","Televizyon","Süpürge"];
  function set(k:string,v:string|boolean){setF(x=>({...x,[k]:v}))}
  function submit(e:FormEvent){
    e.preventDefault();
    if(!f.name||!f.phone||!f.address||!f.product){setErr("Şu 4 bilgi gerekli: müşteri adı, telefon, adres ve ürün.");return}
    onSave({
      orderNo:"YD-"+f.date.replaceAll("-","").slice(2)+"-"+(Math.floor(Math.random()*900)+100),
      customerName:f.name,phone:f.phone,address:f.address,district:f.district,city:f.city,date:f.date,timeWindow:f.time,
      assignee:f.assignee,assigneeInitials:f.assignee==="Atanmamış"?"--":initials(f.assignee),status:"new",priority:f.priority,notes:f.notes,
      items:[{id:id("i"),brand:f.brand,product:f.product,model:f.model,quantity:1,serviceRequired:f.service,installationRequired:f.install,takeBackOldProduct:f.old}]
    })
  }
  return <Modal onClose={onClose}><form onSubmit={submit} className="deliveryWizard">
    <PageHead tag="YENİ GÖREV" title="Teslimatı 4 küçük adımda oluştur" text="Zor olan hiçbir şey yok. Soldan sağa doldur, sonra personele gönder."/>
    <div className="wizardSteps">
      <span className={f.name&&f.phone?"done":"active"}><b>1</b><p>Müşteri<small>Kim, nerede?</small></p></span>
      <i/>
      <span className={f.product?"done":""}><b>2</b><p>Ürün<small>Ne götürülecek?</small></p></span>
      <i/>
      <span className={f.assignee!=="Atanmamış"?"done":""}><b>3</b><p>Personel<small>Kim götürecek?</small></p></span>
      <i/>
      <span><b>4</b><p>Gönder<small>Görev hazır</small></p></span>
    </div>

    <section className="wizardSection">
      <div className="wizardTitle"><span>1</span><p><b>Müşteri</b><small>İsim, telefon ve teslim adresi</small></p></div>
      <div className="form">
        <Field label="Müşteri adı ve soyadı *" v={f.name} set={v=>set("name",v)} placeholder="Örn. Ahmet Yılmaz"/>
        <Field label="Telefon *" v={f.phone} set={v=>set("phone",v)} placeholder="05xx xxx xx xx" inputMode="tel"/>
        <Field label="Açık adres *" v={f.address} set={v=>set("address",v)} placeholder="Mahalle, cadde, sokak, bina no..." wide/>
        <Field label="İlçe" v={f.district} set={v=>set("district",v)} placeholder="Örn. Kadıköy"/>
        <Field label="Şehir" v={f.city} set={v=>set("city",v)} placeholder="İstanbul"/>
      </div>
    </section>

    <section className="wizardSection">
      <div className="wizardTitle"><span>2</span><p><b>Ürün</b><small>Önce ürüne dokun, gerekirse model yaz</small></p></div>
      <div className="quickProducts">{quickProducts.map(x=><button type="button" className={f.product===x?"on":""} key={x} onClick={()=>set("product",x)}><WebIcon product={x} size={22}/>{x}</button>)}</div>
      <div className="form">
        <Select label="Marka" v={f.brand} set={v=>set("brand",v)} opts={["ALTUS","BEKO","GRUNDIG","REGAL","HOOVER","DİĞER"]}/>
        <Field label="Ürün *" v={f.product} set={v=>set("product",v)} placeholder="Listede yoksa buraya yaz"/>
        <Field label="Model / stok kodu" v={f.model} set={v=>set("model",v)} placeholder="Örn. AL 555"/>
      </div>
      <div className="options"><Opt t="Servis gerekli" on={f.service} set={v=>set("service",v)}/><Opt t="Kurulum gerekli" on={f.install} set={v=>set("install",v)}/><Opt t="Eski ürün alınacak" on={f.old} set={v=>set("old",v)}/></div>
    </section>

    <section className="wizardSection">
      <div className="wizardTitle"><span>3</span><p><b>Kim ve ne zaman?</b><small>Personeli seç, günü belirle</small></p></div>
      <div className="form">
        <Select label="Sevkiyat personeli" v={f.assignee} set={v=>set("assignee",v)} opts={["Atanmamış"].concat(staff)}/>
        <Field label="Teslim tarihi" v={f.date} set={v=>set("date",v)} type="date"/>
        <Select label="Saat aralığı" v={f.time} set={v=>set("time",v)} opts={["09:00 - 12:00","12:00 - 15:00","15:00 - 18:00","18:00 - 21:00"]}/>
        <Select label="Öncelik" v={f.priority} set={v=>set("priority",v)} opts={["normal","high","critical"]}/>
        <Field label="Personele not" v={f.notes} set={v=>set("notes",v)} placeholder="Örn. Eski ürün mutlaka geri alınacak" wide/>
      </div>
    </section>

    <div className="wizardSummary">
      <WebIcon name="truck-fast-outline" size={30}/>
      <p><small>GÖREV ÖZETİ</small><b>{f.name||"Müşteri"} • {f.brand} {f.product||"Ürün"}</b><span>{f.assignee==="Atanmamış"?"Henüz personel seçilmedi":f.assignee+" kişisine atanacak"} • {f.date} • {f.time}</span></p>
    </div>
    {err?<div className="error">{err}</div>:null}
    <div className="modalActions wizardActions"><button type="button" className="soft" onClick={onClose}>Vazgeç</button><button className="primary"><CheckCircle2 size={17}/><span><b>Görevi oluştur</b><small>Kaydet ve personele gönder</small></span></button></div>
  </form></Modal>
}
function NewStaff({onClose,onSave}:{onClose:()=>void;onSave:(s:{name:string;phone:string})=>void}){const [name,setName]=useState(""),[phone,setPhone]=useState("");return <Modal onClose={onClose}><form onSubmit={e=>{e.preventDefault();if(name)onSave({name,phone})}}><PageHead tag="PERSONEL" title="Sevkiyatçı ekle" text="Teslimat atayacağın personeli kaydet."/><div className="form one"><Field label="Ad soyad" v={name} set={setName}/><Field label="Telefon" v={phone} set={setPhone}/></div><div className="modalActions"><button type="button" className="soft" onClick={onClose}>Vazgeç</button><button className="primary"><UserPlus size={16}/>Personeli ekle</button></div></form></Modal>}
function Modal({children,onClose}:{children:React.ReactNode;onClose:()=>void}){return <div className="modalBg" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modalX" onClick={onClose}><X size={18}/></button>{children}</div></div>}
function Field({label,v,set,wide,type="text",placeholder="",inputMode}:{label:string;v:string;set:(v:string)=>void;wide?:boolean;type?:string;placeholder?:string;inputMode?:React.HTMLAttributes<HTMLInputElement>["inputMode"]}){return <label className={wide?"wide":""}><span>{label}</span><input type={type} value={v} placeholder={placeholder} inputMode={inputMode} onChange={e=>set(e.target.value)}/></label>}
function Select({label,v,set,opts}:{label:string;v:string;set:(v:string)=>void;opts:string[]}){return <label><span>{label}</span><select value={v} onChange={e=>set(e.target.value)}>{opts.map(o=><option key={o} value={o}>{o==="normal"?"Normal":o==="high"?"Öncelikli":o==="critical"?"Acil":o}</option>)}</select></label>}
function Opt({t,on,set}:{t:string;on:boolean;set:(v:boolean)=>void}){return <button type="button" className={on?"on":""} onClick={()=>set(!on)}><i>{on?<Check size={13}/>:null}</i>{t}</button>}
function Drawer({d,office,requireChecks,onClose,onStatus,onToggle,onDelete}:{d:Delivery;office:boolean;requireChecks:boolean;onClose:()=>void;onStatus:(s:DeliveryStatus)=>void;onToggle:(k:keyof Delivery["checklist"])=>void;onDelete:()=>void}){const done=Object.values(d.checklist).filter(Boolean).length;return <div className="drawerBg" onMouseDown={onClose}><aside onMouseDown={e=>e.stopPropagation()}><button className="modalX" onClick={onClose}><X size={18}/></button><div className="badges"><span className={"status s-"+d.status}>{labels[d.status]}</span><small>{d.orderNo}</small></div><h2>{d.customerName}</h2><div className="drawerQuick"><a href={tel(d.phone)}><Phone size={16}/>Ara</a><a href={map(d)} target="_blank" rel="noreferrer"><Navigation size={16}/>Yol tarifi</a></div><div className="block"><small>ADRES</small><b>{d.address}</b><span>{d.district+", "+d.city}</span></div><div className="info"><p><small>TELEFON</small><b>{d.phone}</b></p><p><small>PERSONEL</small><b>{d.assignee}</b></p><p><small>SAAT</small><b>{d.timeWindow}</b></p><p><small>ÖNCELİK</small><b>{d.priority==="critical"?"Acil":d.priority==="high"?"Öncelikli":"Normal"}</b></p></div><div className="block"><small>ÜRÜN</small><b>{d.items[0]?.brand+" • "+d.items[0]?.product}</b><span>{d.items[0]?.model||"Model belirtilmedi"}</span></div>{d.notes?<div className="drawerNote"><b>Dükkan notu</b><span>{d.notes}</span></div>:null}<div className="drawerChecks"><p><b>Zorunlu kontroller</b><span>{done}/6</span></p>{checks.map(([k,l])=><button className={d.checklist[k]?"on":""} onClick={()=>onToggle(k)} key={k}><i>{d.checklist[k]?<Check size={13}/>:null}</i>{l}</button>)}</div><div className="drawerActions">{d.status==="new"?<button className="primary" onClick={()=>onStatus("assigned")}>Personele ata</button>:null}{d.status==="assigned"?<button className="primary" onClick={()=>onStatus("seen")}>Görüldü</button>:null}{d.status==="seen"?<button className="primary" onClick={()=>onStatus("on_route")}>Yola çıktı</button>:null}{d.status==="on_route"?<button className="primary" disabled={requireChecks&&done<6} onClick={()=>onStatus("completed")}>Teslimatı tamamla</button>:null}{!["completed","issue"].includes(d.status)?<button className="issue" onClick={()=>onStatus("issue")}>Sorun bildir</button>:null}</div>{office?<button className="delete" onClick={onDelete}><Trash2 size={14}/>Bu teslimatı sil</button>:null}</aside></div>}
