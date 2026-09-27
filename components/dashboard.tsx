"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Bell, CalendarDays, Check, CheckCircle2, ChevronDown,
  ClipboardCheck, Clock3, History, LayoutDashboard, MapPin, Menu, Navigation,
  PackageCheck, Phone, Plus, Search, Settings, Store, Trash2, Truck, UserPlus, MessageCircle,
  UserRound, Users, X
} from "lucide-react";
import DeveloperBadge from "./developer-badge";
import LoginScreen from "./login-screen";
import WebIcon from "./web-icon";
import InstallPwaCard from "./install-pwa-card";
import MobileBottomNav from "./mobile-bottom-nav";
import OperationsCenter from "./operations-center";
import DeliveryProofPanel from "./delivery-proof-panel";
import { ActivityEvent, Delivery, DeliveryStatus, Priority } from "@/lib/types";
import {
  cloudAvailable, getCurrentUser, getMyProfile, insertDelivery, insertEvent, insertStaff,
  loadCloudData, loadMyNotifications, markNotificationRead, patchDelivery, removeCloudDelivery,
  signOut, subscribeCloud, subscribeMyNotifications, unsubscribeCloud,
  type AppNotification, type Profile
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
  ["dashboard","Bugün",<LayoutDashboard size={18}/>], ["deliveries","Teslimatlar",<PackageCheck size={18}/>],
  ["staff","Personel",<Users size={18}/>], ["customers","Müşteriler",<UserRound size={18}/>],
  ["checklists","Kontrol Listeleri",<ClipboardCheck size={18}/>], ["planning","Planlama",<CalendarDays size={18}/>],
  ["logs","İşlem Kayıtları",<History size={18}/>], ["settings","Ayarlar",<Settings size={18}/>]
];
function id(p:string){ return p+"-"+Date.now()+"-"+Math.random().toString(36).slice(2,7); }
function today(){ const d=new Date(), o=d.getTimezoneOffset()*60000; return new Date(d.getTime()-o).toISOString().slice(0,10); }
function initials(n:string){ return n.split(" ").filter(Boolean).map(x=>x[0]).join("").slice(0,2).toUpperCase(); }
function tel(p:string){ return "tel:"+p.replace(/[^\d+]/g,""); }
function whatsapp(p:string){ const digits=p.replace(/\D/g,""); const normalized=digits.startsWith("90")?digits:digits.startsWith("0")?"90"+digits.slice(1):digits.length===10?"90"+digits:digits; return "https://wa.me/"+normalized; }
function map(d:Delivery){ return "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(d.address+", "+d.district+", "+d.city); }

export default function Dashboard(){
  const [view,setView]=useState<View>("dashboard"), [mode,setMode]=useState<"office"|"courier">("office"), [side,setSide]=useState(false);
  const [deliveries,setDeliveries]=useState<Delivery[]>([]), [staff,setStaff]=useState<Staff[]>([]), [events,setEvents]=useState<ActivityEvent[]>([]);
  const [selected,setSelected]=useState<Delivery|null>(null), [newOpen,setNewOpen]=useState(false), [staffOpen,setStaffOpen]=useState(false);
  const [courier,setCourier]=useState(""), [notify,setNotify]=useState(false), [splash,setSplash]=useState(true), [ready,setReady]=useState(false);
  const [requireChecks,setRequireChecks]=useState(true), [query,setQuery]=useState(""), [filter,setFilter]=useState<"all"|DeliveryStatus>("all");
  const [cloud,setCloud]=useState(false), [cloudError,setCloudError]=useState(""), [profile,setProfile]=useState<Profile|null>(null), [signedIn,setSignedIn]=useState(false), [authReady,setAuthReady]=useState(!cloudAvailable());
  const [online,setOnline]=useState(true);
  const [notifications,setNotifications]=useState<AppNotification[]>([]);
  const [notificationOpen,setNotificationOpen]=useState(false);
  const [actionNotice,setActionNotice]=useState<{text:string;tone:"ok"|"warn"}|null>(null);
  const [pendingDeliveryId,setPendingDeliveryId]=useState("");
  const searchRef=useRef<HTMLInputElement|null>(null);

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
    if(params.get("mode")==="courier") setMode("courier");
    if(params.get("delivery")) setPendingDeliveryId(params.get("delivery")||"");
    if(params.has("action")||params.has("view")||params.has("mode")||params.has("delivery")) window.history.replaceState({},"",window.location.pathname);
    const t=window.setTimeout(()=>setSplash(false),900);
    return()=>{window.clearTimeout(t);window.removeEventListener("online",goOnline);window.removeEventListener("offline",goOffline)};
  },[]);
  useEffect(()=>{ if(ready)localStorage.setItem(DKEY,JSON.stringify(deliveries)); },[deliveries,ready]);
  useEffect(()=>{ if(ready)localStorage.setItem(SKEY,JSON.stringify(staff)); },[staff,ready]);
  useEffect(()=>{ if(ready)localStorage.setItem(EKEY,JSON.stringify(events.slice(0,200))); },[events,ready]);
  useEffect(()=>{
    const shortcut=(event:KeyboardEvent)=>{
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown",shortcut);
    return()=>window.removeEventListener("keydown",shortcut);
  },[]);

  useEffect(()=>{
    let alive=true;
    let channel:any=null;
    let notificationChannel:any=null;
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
        const inbox=await loadMyNotifications().catch(()=>[]);
        if(!alive)return;
        setNotifications(inbox);
        setCloud(true);
        channel=subscribeCloud(()=>{ refresh().catch(()=>undefined); });
        notificationChannel=subscribeMyNotifications(user.id,(notification)=>{
          setNotifications(current=>[notification,...current.filter(item=>item.id!==notification.id)].slice(0,30));
          setActionNotice({text:notification.title+" • "+notification.body,tone:"ok"});
        });
      }catch(err:any){
        if(alive){ setCloud(false); setCloudError(err?.message||"Bulut bağlantısı kurulamadı."); }
      }
    }
    connect();
    return()=>{alive=false;unsubscribeCloud(channel);unsubscribeCloud(notificationChannel)};
  },[]);

  useEffect(()=>{
    if(!pendingDeliveryId)return;
    const delivery=deliveries.find(item=>item.id===pendingDeliveryId);
    if(!delivery)return;
    setSelected(delivery);
    setPendingDeliveryId("");
  },[pendingDeliveryId,deliveries]);

  useEffect(()=>{
    if(!actionNotice)return;
    const timer=window.setTimeout(()=>setActionNotice(null),5200);
    return()=>window.clearTimeout(timer);
  },[actionNotice]);

  const names=useMemo(()=>Array.from(new Set(staff.map(x=>x.name).concat(deliveries.map(x=>x.assignee).filter(x=>x&&x!=="Atanmamış")))),[staff,deliveries]);
  const operationalStaff=useMemo(()=>{
    if(cloud)return staff;
    const merged=new Map<string,Staff>(staff.map(s=>[s.name,s]));
    deliveries.forEach(d=>{
      if(d.assignee&&d.assignee!=="Atanmamış"&&!merged.has(d.assignee)){
        merged.set(d.assignee,{id:"local-"+d.assignee.toLocaleLowerCase("tr-TR").replace(/\s+/g,"-"),name:d.assignee,phone:""});
      }
    });
    return Array.from(merged.values());
  },[cloud,staff,deliveries]);
  useEffect(()=>{ if(!courier&&names[0])setCourier(names[0]); },[courier,names]);
  const day=today(), active=deliveries.filter(x=>x.date<=day&&!["completed","issue"].includes(x.status)).length;
  const filtered=deliveries.filter(d=>{
    const q=query.toLocaleLowerCase("tr-TR"), h=(d.customerName+" "+d.phone+" "+d.orderNo+" "+d.address+" "+d.assignee+" "+d.items.map(i=>i.brand+" "+i.product+" "+(i.model||"")).join(" ")).toLocaleLowerCase("tr-TR");
    return (!q||h.includes(q))&&(filter==="all"||d.status===filter);
  });
  const my=deliveries.filter(d=>d.assignee===courier&&d.date<=day&&!["completed","issue"].includes(d.status));
  function log(title:string,d?:Delivery,detail?:string,type:ActivityEvent["type"]="status"){
    const event:ActivityEvent={id:id("e"),deliveryId:d?.id,orderNo:d?.orderNo,actor:mode==="courier"?(courier||profile?.fullName||"Sevkiyatçı"):(profile?.fullName||"Dükkan"),type,title,detail,createdAt:new Date().toISOString()};
    setEvents(p=>[event,...p]);
    if(cloud) insertEvent({deliveryId:event.deliveryId,orderNo:event.orderNo,actor:event.actor,type:event.type,title:event.title,detail:event.detail}).catch(()=>undefined);
  }
  async function setStatus(d:Delivery,status:DeliveryStatus){
    if(status==="completed"&&requireChecks&&Object.values(d.checklist).some(v=>!v))return;
    const updated={...d,status,updatedAt:new Date().toISOString()};
    setDeliveries(p=>p.map(x=>x.id===d.id?updated:x));
    setSelected(s=>s?.id===d.id?updated:s);
    try{
      if(cloud)await patchDelivery(d.id,{status});
      log("Durum: "+labels[status],updated,d.customerName,status==="issue"?"issue":"status");
    }catch(err:any){
      setDeliveries(p=>p.map(x=>x.id===d.id?d:x));
      setSelected(s=>s?.id===d.id?d:s);
      setCloudError(err?.message||"Durum buluta yazılamadı; değişiklik geri alındı.");
    }
  }
  async function toggle(d:Delivery,k:keyof Delivery["checklist"]){
    const value=!d.checklist[k], checklist={...d.checklist,[k]:value}, updated={...d,checklist,updatedAt:new Date().toISOString()};
    setDeliveries(p=>p.map(x=>x.id===d.id?updated:x));
    setSelected(s=>s?.id===d.id?updated:s);
    try{
      if(cloud)await patchDelivery(d.id,{checklist});
      log(value?"Kontrol tamamlandı":"Kontrol geri alındı",updated,checks.find(x=>x[0]===k)?.[1],"checklist");
    }catch(err:any){
      setDeliveries(p=>p.map(x=>x.id===d.id?d:x));
      setSelected(s=>s?.id===d.id?d:s);
      setCloudError(err?.message||"Kontrol buluta yazılamadı; değişiklik geri alındı.");
    }
  }
  async function notifications(){
    try{
      if(cloud){ await enablePushNotifications(); setNotify(true); }
      else if("Notification" in window){ const p=await Notification.requestPermission(); setNotify(p==="granted"); }
    }catch(err:any){ setCloudError(err?.message||"Bildirim açılamadı."); }
  }
  function pushResultMessage(reason?:string){
    if(reason==="no_target")return "Personelin kullanıcı hesabı henüz bu personele bağlı değil.";
    if(reason==="no_subscription")return "Personel hesabı bağlı ama bu telefonda bildirimler henüz açılmamış.";
    if(reason==="push_not_configured")return "Arka plan bildirimi için VAPID / sunucu anahtarları henüz tamamlanmamış.";
    if(reason==="login_required")return "Bildirim göndermek için mağaza hesabıyla giriş gerekli.";
    return "Görev kaydedildi; arka plan bildiriminin ulaştığı doğrulanamadı.";
  }

  async function addDelivery(d:Omit<Delivery,"id"|"createdAt"|"updatedAt"|"checklist">){
    const now=new Date().toISOString();
    try{
      const rec=cloud ? await insertDelivery(d,staff) : {...d,id:id("d"),createdAt:now,updatedAt:now,status:(d.assignee==="Atanmamış"?"new":"assigned") as DeliveryStatus,checklist:{addressVerified:false,customerCalled:false,productLoaded:false,modelChecked:false,accessoriesChecked:false,returnChecked:false}};
      setDeliveries(p=>[rec,...p.filter(x=>x.id!==rec.id)]); setNewOpen(false); log("Yeni teslimat oluşturuldu",rec,rec.assignee,"created");
      if(cloud&&rec.assignee!=="Atanmamış"){
        const push=await sendAssignmentPush(rec.id);
        setActionNotice(push.sent
          ? {text:"Teslimat kaydedildi • "+rec.assignee+" cihazına bildirim gönderildi.",tone:"ok"}
          : {text:"Teslimat kaydedildi • "+pushResultMessage(push.reason),tone:"warn"});
      }else{
        setActionNotice({text:rec.assignee==="Atanmamış"?"Teslimat kaydedildi • Personel seçilmediği için bildirim gönderilmedi.":"Teslimat kaydedildi.",tone:"ok"});
      }
    }catch(err:any){ setCloudError(err?.message||"Teslimat kaydedilemedi."); }
  }
  async function addStaff(s:{name:string;phone:string}){
    try{
      const rec=cloud ? await insertStaff(s.name,s.phone) : {...s,id:id("s")};
      setStaff(p=>[...p.filter(x=>x.id!==rec.id),rec]); setStaffOpen(false);
    }catch(err:any){ setCloudError(err?.message||"Personel kaydedilemedi."); }
  }
  async function assignDelivery(d:Delivery,person:Staff|null){
    const assignee=person?.name||"Atanmamış";
    const nextStatus:DeliveryStatus = person
      ? (d.status==="new" ? "assigned" : d.status)
      : (["new","assigned","seen"].includes(d.status) ? "new" : d.status);
    const updated:Delivery={
      ...d,
      assignee,
      assigneeInitials:person?initials(person.name):"--",
      status:nextStatus,
      updatedAt:new Date().toISOString()
    };
    setDeliveries(p=>p.map(x=>x.id===d.id?updated:x));
    setSelected(s=>s?.id===d.id?updated:s);
    try{
      if(cloud)await patchDelivery(d.id,{assigneeId:person?.id||null,assigneeName:person?.name||null,status:nextStatus});
      log(person?"Personel atandı":"Personel ataması kaldırıldı",updated,assignee);
      if(cloud&&person){
        const push=await sendAssignmentPush(d.id);
        setActionNotice(push.sent
          ? {text:person.name+" cihazına yeni görev bildirimi gönderildi.",tone:"ok"}
          : {text:pushResultMessage(push.reason),tone:"warn"});
      }
    }catch(err:any){
      setDeliveries(p=>p.map(x=>x.id===d.id?d:x));
      setSelected(s=>s?.id===d.id?d:s);
      setCloudError(err?.message||"Personel ataması buluta yazılamadı; değişiklik geri alındı.");
    }
  }
  async function remove(d:Delivery){
    try{
      if(cloud)await removeCloudDelivery(d.id);
      setDeliveries(p=>p.filter(x=>x.id!==d.id));
      setSelected(null);
      log("Teslimat silindi",undefined,d.orderNo+" • "+d.customerName,"system");
    }catch(err:any){
      setCloudError(err?.message||"Teslimat silinemedi.");
    }
  }

  const authRequired=process.env.NEXT_PUBLIC_REQUIRE_AUTH==="true";
  if(authRequired&&cloudAvailable()&&authReady&&!signedIn) return <LoginScreen onSuccess={()=>window.location.reload()}/>;

  const pageTitle=mode==="office" ? (nav.find(x=>x[0]===view)?.[1]||"Kontrol Merkezi") : "Bugünkü Görevler";
  const pageDescription=mode==="courier"
    ? "Bugünkü işlerini sırayla gör; müşteri, telefon, ürün, adres ve mağaza notu tek kartta."
    : view==="dashboard"
      ? "Mağazadaki teslimat listesini eksiksiz kaydet, personele ata ve tamamlanana kadar takip et."
      : view==="deliveries"
        ? "Tüm teslimat kayıtlarını ara, filtrele ve detaylarını düzenle."
        : view==="staff"
          ? "Saha ekibini ve aktif görev yükünü takip et."
          : view==="customers"
            ? "Müşteri ve teslimat geçmişine hızlı eriş."
            : view==="checklists"
              ? "Teslimat kapanmadan tamamlanması gereken zorunlu adımları izle."
              : view==="planning"
                ? "Günlük teslimat planını tarih ve saat aralıklarına göre yönet."
                : view==="logs"
                  ? "Operasyondaki durum ve kontrol değişikliklerini incele."
                  : "Uygulama, bildirim ve cihaz ayarlarını yönet.";

  return <div className="app">
    {actionNotice?<div className={"actionNotice "+actionNotice.tone}>{actionNotice.tone==="ok"?<CheckCircle2/>:<AlertTriangle/>}<span>{actionNotice.text}</span><button onClick={()=>setActionNotice(null)}><X/></button></div>:null}
    {splash&&<div className="splash"><div className="splashLogo"><Truck/></div><b>yaaTeslimat</b><span>Teslimat Takip</span><DeveloperBadge compact/></div>}
    {side?<button className="sideBackdrop" aria-label="Menüyü kapat" onClick={()=>setSide(false)}/>:null}

    <aside className={"side "+(side?"open":"")} aria-label="Mobil menü">
      <div className="brand"><div><Truck size={21}/></div><p><b>yaaTeslimat</b><span>Teslimat Takip</span></p><button aria-label="Menüyü kapat" onClick={()=>setSide(false)}><X size={18}/></button></div>
      {profile?.role==="courier"?<div className="roleChip"><Truck size={15}/><span>Servis personeli</span><i>CANLI</i></div>:<div className="modes"><button className={mode==="office"?"on":""} onClick={()=>{setMode("office");setView("dashboard")}}><Store size={15}/>Mağaza</button><button className={mode==="courier"?"on":""} onClick={()=>setMode("courier")}><Truck size={15}/>Servis</button></div>}
      {mode==="office"?<nav>{nav.map(([v,l,i])=><button key={v} className={view===v?"on":""} onClick={()=>{setView(v);setSide(false)}}>{i}<span>{l}</span>{v==="deliveries"&&active>0?<b>{active}</b>:null}</button>)}</nav>:<nav><button className="on"><Truck size={18}/><span>Görevlerim</span></button>{profile?.role!=="courier"?<button onClick={()=>setMode("office")}><Store size={18}/><span>Mağazaya dön</span></button>:null}</nav>}
      <div className="grow"/>
      <div className="online"><i/><p><b>Sistem hazır</b><span>Mobil • Tablet • PC</span></p></div>
      <DeveloperBadge/>
    </aside>

    <main>
      <header className="appTopbar">
        <div className="topBrand">
          <button className="hamb" aria-label="Menüyü aç" onClick={()=>setSide(true)}><Menu size={20}/></button>
          <div className="topBrandMark"><Truck size={19}/></div>
          <div className="topBrandCopy"><b>yaaTeslimat</b><span>TESLİMAT TAKİP</span></div>
        </div>

        <label className="globalSearch">
          <Search size={18}/>
          <input
            ref={searchRef}
            value={mode==="office"?query:""}
            readOnly={mode!=="office"}
            onChange={e=>{setQuery(e.target.value);if(e.target.value)setView("deliveries")}}
            placeholder={mode==="office"?"Sipariş, müşteri, ürün, telefon veya adres ara":"Sevkiyatçı görevlerinde ara"}
          />
          <kbd>⌘K</kbd>
        </label>

        <div className="topbarRight">
          <span className={"syncState "+(!online?"offline":cloud?"live":"local")}><i/>{!online?"Offline":cloud?"Canlı":"Yerel"}</span>
          {mode==="courier"&&profile?.role!=="courier"?<label className="select courierSelect"><UserRound size={15}/><select value={courier} onChange={e=>setCourier(e.target.value)}><option value="">Personel seç</option>{names.map(n=><option key={n}>{n}</option>)}</select><ChevronDown size={13}/></label>:null}
          <div className="notifyWrap">
            <button className="iconButton notifyButton" aria-label="Bildirimler" onClick={()=>setNotificationOpen(v=>!v)}>
              <Bell size={18}/>{notifications.some(n=>!n.readAt)?<i/>:notify?<i className="ready"/>:null}
              {notifications.filter(n=>!n.readAt).length?<b>{Math.min(9,notifications.filter(n=>!n.readAt).length)}</b>:null}
            </button>
            {notificationOpen?<div className="notificationTray">
              <div className="notificationTrayHead"><div><b>Bildirimler</b><span>{notifications.filter(n=>!n.readAt).length} okunmamış</span></div><button onClick={notifications}><Bell size={14}/>{notify?"Cihaz açık":"Bildirimleri aç"}</button></div>
              <div className="notificationTrayList">
                {notifications.length?notifications.slice(0,10).map(item=><button className={item.readAt?"":"unread"} key={item.id} onClick={async()=>{
                  if(!item.readAt){await markNotificationRead(item.id).catch(()=>undefined);setNotifications(current=>current.map(n=>n.id===item.id?{...n,readAt:new Date().toISOString()}:n))}
                  if(item.deliveryId){const delivery=deliveries.find(d=>d.id===item.deliveryId);if(delivery)setSelected(delivery)}
                  setNotificationOpen(false);
                }}><i/><p><b>{item.title}</b><span>{item.body}</span><small>{new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(item.createdAt))}</small></p></button>):<div className="notificationEmpty">Henüz görev bildirimi yok.</div>}
              </div>
            </div>:null}
          </div>
          <div className="userChip"><span>{initials(profile?.fullName||courier||"Dükkan")}</span><p><b>{profile?.fullName||courier||"Dükkan"}</b><small>{profile?.role==="courier"?"Sevkiyatçı":"Operasyon"}</small></p></div>
        </div>
      </header>

      <div className="desktopNav">
        <div className="navMode">
          {profile?.role==="courier"?<span><Truck size={14}/>Servis</span>:<>
            <button className={mode==="office"?"on":""} onClick={()=>{setMode("office");setView("dashboard")}}><Store size={14}/>Mağaza</button>
            <button className={mode==="courier"?"on":""} onClick={()=>setMode("courier")}><Truck size={14}/>Servis</button>
          </>}
        </div>
        {mode==="office"?<nav>{nav.map(([v,l,i])=><button key={v} className={view===v?"on":""} onClick={()=>setView(v)}>{i}<span>{l}</span>{v==="deliveries"&&active>0?<b>{active}</b>:null}</button>)}</nav>:<nav><button className="on"><Truck size={17}/><span>Görevlerim</span></button>{profile?.role!=="courier"?<button onClick={()=>setMode("office")}><Store size={17}/><span>Mağazaya dön</span></button>:null}</nav>}
        {mode==="office"?<button className="primary navCreate" onClick={()=>setNewOpen(true)}><Plus size={17}/>Yeni teslimat</button>:null}
      </div>

      <section className="pageIntro">
        <div>
          <small>{mode==="office"?"OPERASYON / "+pageTitle.toLocaleUpperCase("tr-TR"):"SAHA / GÖREVLER"}</small>
          <h1>{pageTitle}</h1>
          <p>{pageDescription}</p>
        </div>
        <div className="pageIntroMeta">
          <span><CalendarDays size={16}/>{new Intl.DateTimeFormat("tr-TR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(new Date())}</span>
          {cloudError?<button className="cloudError" onClick={()=>setCloudError("")}><AlertTriangle size={13}/>{cloudError}<X size={12}/></button>:null}
        </div>
      </section>
      {mode==="courier"?<CourierList list={my} courier={courier} notify={notify} cloud={cloud} onNotify={notifications} onOpen={setSelected} onStatus={setStatus} onToggle={toggle} requireChecks={requireChecks}/>:<>
        {view==="dashboard"&&<OperationsCenter deliveries={deliveries} staff={operationalStaff} cloud={cloud} onNew={()=>setNewOpen(true)} onStaff={()=>setStaffOpen(true)} onOpen={setSelected} onAssign={assignDelivery}/>}
        {view==="deliveries"&&<section className="card page"><PageHead tag="DÜKKAN KAYITLARI" title="Tüm teslimatlar" text="Müşteri, adres, ürün ve personel bilgilerini tek yerden takip et." action={<button className="primary" onClick={()=>setNewOpen(true)}><Plus size={16}/>Yeni teslimat</button>}/><div className="filters"><label><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="İsim, telefon, ürün, sipariş no..."/></label><label className="select"><select value={filter} onChange={e=>setFilter(e.target.value as "all"|DeliveryStatus)}><option value="all">Tüm durumlar</option>{Object.keys(labels).map(k=><option key={k} value={k}>{labels[k as DeliveryStatus]}</option>)}</select><ChevronDown size={13}/></label></div><DeliveryList list={filtered} onOpen={setSelected}/></section>}
        {view==="staff"&&<StaffPage staff={staff} deliveries={deliveries} onAdd={()=>setStaffOpen(true)}/>}
        {view==="customers"&&<CustomersPage deliveries={deliveries} onOpen={setSelected}/>}
        {view==="checklists"&&<ChecklistPage deliveries={deliveries}/>}
        {view==="planning"&&<PlanningPage deliveries={deliveries} onOpen={setSelected}/>}
        {view==="logs"&&<LogsPage events={events}/>}
        {view==="settings"&&<SettingsPage requireChecks={requireChecks} setRequireChecks={setRequireChecks} notify={notify} onNotify={notifications} cloud={cloud} profile={profile} onSignOut={async()=>{await signOut();window.location.reload()}} onClear={()=>{if(confirm("Bu cihazdaki yerel kayıtlar silinsin mi?")){setDeliveries([]);setStaff([]);setEvents([])}}}/>} 
      </>}
      <footer><span>yaaTeslimat • v1.7</span><DeveloperBadge compact/></footer>
      {mode==="office"?<MobileBottomNav view={view} onView={v=>setView(v)} onNew={()=>setNewOpen(true)}/>:null}
    </main>
    {newOpen&&<NewDelivery staff={operationalStaff} onClose={()=>setNewOpen(false)} onSave={addDelivery}/>} 
    {staffOpen&&<NewStaff onClose={()=>setStaffOpen(false)} onSave={addStaff}/>} 
    {selected&&<Drawer d={deliveries.find(x=>x.id===selected.id)||selected} events={events} staff={operationalStaff} cloud={cloud} office={mode==="office"} requireChecks={requireChecks} onClose={()=>setSelected(null)} onStatus={s=>setStatus(deliveries.find(x=>x.id===selected.id)||selected,s)} onToggle={k=>toggle(deliveries.find(x=>x.id===selected.id)||selected,k)} onAssign={person=>assignDelivery(deliveries.find(x=>x.id===selected.id)||selected,person)} onProofSaved={kind=>log(kind==="photo"?"Teslimat fotoğrafı eklendi":"Müşteri imzası eklendi",deliveries.find(x=>x.id===selected.id)||selected,undefined,"system")} onDelete={()=>remove(deliveries.find(x=>x.id===selected.id)||selected)}/>}
  </div>;
}

function PageHead({tag,title,text,action}:{tag:string;title:string;text:string;action?:React.ReactNode}){return <div className="pageHead"><div><small>{tag}</small><h2>{title}</h2><p>{text}</p></div>{action}</div>}
function Empty({title,text}:{title:string;text:string}){return <div className="empty"><PackageCheck size={28}/><b>{title}</b><span>{text}</span></div>}
function DeliveryList({list,onOpen}:{list:Delivery[];onOpen:(d:Delivery)=>void}){return <div className="list">{list.length?list.map(d=>{const done=Object.values(d.checklist).filter(Boolean).length;const item=d.items[0];return <button className="row deliveryRow" key={d.id} onClick={()=>onOpen(d)}><div className="customerCell"><div className="badges"><span className={"status s-"+d.status}>{labels[d.status]}</span>{d.priority!=="normal"?<span className={"prio p-"+d.priority}>{d.priority==="critical"?"Acil":"Öncelikli"}</span>:null}<small>{d.orderNo}</small></div><h3>{d.customerName}</h3><p><span><MapPin size={14}/>{d.district||"İlçe yok"}</span><span><Clock3 size={14}/>{d.timeWindow}</span><span><UserRound size={14}/>{d.assignee}</span></p></div><div className="product deliveryProduct"><span className="productIcon"><WebIcon product={item?.product||""} size={30}/></span><p><small>ÜRÜN</small><b>{item?.brand+" • "+item?.product}</b><span>{item?.model||"Model yok"}</span></p></div><div className="progress deliveryProgress"><p><span>Hazırlık</span><b>{done}/6</b></p><i><em style={{width:(done/6*100)+"%"}}/></i><small>{done===6?"Hazır":"Kontroller sürüyor"}</small></div><span className="rowArrow">›</span></button>}):<Empty title="Kayıt yok" text="Henüz teslimat oluşturulmadı."/>}</div>}
function StaffPage({staff,deliveries,onAdd}:{staff:Staff[];deliveries:Delivery[];onAdd:()=>void}){return <section className="card page"><PageHead tag="SEVKİYAT EKİBİ" title="Personeller" text="Dükkandan görev atayacağın personeller." action={<button className="primary" onClick={onAdd}><UserPlus size={16}/>Personel ekle</button>}/>{staff.length?<div className="staffGrid">{staff.map(s=>{const a=deliveries.filter(d=>d.assignee===s.name&&!["completed","issue"].includes(d.status)).length;return <div className="staffCard" key={s.id}><div>{initials(s.name)}</div><h3>{s.name}</h3><a href={tel(s.phone)}>{s.phone||"Telefon yok"}</a><div className={"staffNotify "+(s.userId?"ready":"waiting")}><Bell size={13}/>{s.userId?"Bildirim hesabı bağlı":"Bildirim hesabı bağlı değil"}</div><p><b>{a}</b><span>aktif teslimat</span></p></div>})}</div>:<Empty title="Personel eklenmedi" text="Önce sevkiyat personelini ekle."/>}</section>}
function CustomersPage({deliveries,onOpen}:{deliveries:Delivery[];onOpen:(d:Delivery)=>void}){const groups=Array.from(new Map(deliveries.map(d=>[d.customerName+"|"+d.phone,d])).values());return <section className="card page"><PageHead tag="MÜŞTERİLER" title="Müşteri rehberi" text="Teslimatlardan otomatik oluşur."/>{groups.length?<div className="customerList">{groups.map(d=><button key={d.id} onClick={()=>onOpen(d)}><span>{initials(d.customerName)}</span><p><b>{d.customerName}</b><small>{d.address+" • "+d.district}</small></p><em><Phone size={14}/>{d.phone}</em></button>)}</div>:<Empty title="Müşteri yok" text="Teslimat oluşturdukça rehber oluşur."/>}</section>}
function ChecklistPage({deliveries}:{deliveries:Delivery[]}){return <section className="card page"><PageHead tag="ZORUNLU KONTROLLER" title="Kontrol listeleri" text="Personel teslimatı kapatmadan önce bu adımları işaretler."/><div className="checkDefs">{checks.map(([k,l])=>{const n=deliveries.filter(d=>d.checklist[k]).length;return <div key={k}><span><Check/></span><p><b>{l}</b><small>{n+" / "+deliveries.length+" kayıtta tamamlandı"}</small></p></div>})}</div></section>}
function PlanningPage({deliveries,onOpen}:{deliveries:Delivery[];onOpen:(d:Delivery)=>void}){const [date,setDate]=useState(today());const list=deliveries.filter(d=>d.date===date).sort((a,b)=>a.timeWindow.localeCompare(b.timeWindow));return <section className="card page"><PageHead tag="GÜNLÜK PLAN" title="Planlama" text="Tarih seçip günün sevkiyat sırasını gör." action={<input className="dateInput" type="date" value={date} onChange={e=>setDate(e.target.value)}/>} /><DeliveryList list={list} onOpen={onOpen}/></section>}
function LogsPage({events}:{events:ActivityEvent[]}){return <section className="card page"><PageHead tag="DENETİM İZİ" title="İşlem kayıtları" text="Oluşturma, durum ve kontrol hareketleri."/>{events.length?<div className="logs">{events.map(e=><div key={e.id}><span><History size={15}/></span><p><b>{e.title}</b><small>{(e.detail||"")+" • "+(e.orderNo||"Sistem")}</small></p><time>{new Intl.DateTimeFormat("tr-TR",{hour:"2-digit",minute:"2-digit"}).format(new Date(e.createdAt))}</time></div>)}</div>:<Empty title="İşlem kaydı yok" text="İşlem yaptıkça burada görünür."/>}</section>}
function SettingsPage({requireChecks,setRequireChecks,notify,onNotify,cloud,profile,onSignOut,onClear}:{requireChecks:boolean;setRequireChecks:(v:boolean)=>void;notify:boolean;onNotify:()=>void;cloud:boolean;profile:Profile|null;onSignOut:()=>void;onClear:()=>void}){return <div className="settings settingsV4"><InstallPwaCard/><section className="card"><PageHead tag="OPERASYON" title="Teslimat kuralı" text="Personel işi eksik kapatmasın."/><div className="setting"><p><b>6 kontrol tamamlanmadan “Teslim edildi” olmasın</b><small>Adres, arama, yükleme, model, aksesuar ve geri alım kontrol edilir.</small></p><button className={requireChecks?"on":""} onClick={()=>setRequireChecks(!requireChecks)}><i/></button></div></section><section className="card"><PageHead tag="BAĞLANTI" title={cloud?"Canlı bağlantı açık":"Bu cihazda çalışıyor"} text={cloud?"Dükkan ve sevkiyatçı aynı veriyi anında görür.":"Supabase bağlanınca cihazlar otomatik senkron olur."}/><div className="connectionInfo"><i className={cloud?"on":""}/><p><b>{profile?.fullName||"Bu cihaz"}</b><small>{cloud?"canlı senkron":profile?.role||"yerel mod"}</small></p>{profile?<button className="soft" onClick={onSignOut}>Çıkış yap</button>:null}</div></section><section className="card"><PageHead tag="BİLDİRİM" title={notify?"Bildirimler açık":"Bildirimleri aç"} text="Yeni görev geldiğinde personelin telefonuna haber ver."/><button className="primary settingsAction" onClick={onNotify}><Bell size={16}/>{notify?"Bildirim hazır":"Bildirim izni ver"}</button></section><section className="card danger"><PageHead tag="BAKIM" title="Yerel önbelleği temizle" text="Canlı veritabanını silmez; yalnız bu cihazdaki kopyayı temizler."/><button onClick={onClear}><Trash2 size={16}/>Bu cihazı temizle</button></section></div>}
function CourierList({list,courier,notify,cloud,onNotify,onOpen,onStatus,onToggle,requireChecks}:{list:Delivery[];courier:string;notify:boolean;cloud:boolean;onNotify:()=>void;onOpen:(d:Delivery)=>void;onStatus:(d:Delivery,s:DeliveryStatus)=>void;onToggle:(d:Delivery,k:keyof Delivery["checklist"])=>void;requireChecks:boolean}){
  if(!courier)return <div className="courierEmpty"><WebIcon name="truck-fast-outline" size={52}/><h2>Personel seçilmedi</h2><p>Servis personelini seçince yalnız ona atanmış bugünkü teslimatlar görünür.</p></div>;
  return <div className="courier serviceWorkspace">
    <div className={"serviceNotifyBanner "+(notify?"ready":"waiting")}>
      <span><Bell/></span>
      <div><b>{notify?"Görev bildirimleri açık":"Yeni görevleri anında telefona al"}</b><small>{notify?"Mağaza sana teslimat atadığında bildirim cihazına düşer.":cloud?"Bir kez bildirim izni ver; yeni teslimatlar uygulama kapalıyken de haber versin.":"Canlı bağlantı kurulunca bildirimleri açabilirsin."}</small></div>
      {!notify?<button className="primary" disabled={!cloud} onClick={onNotify}><Bell/>Bildirimleri aç</button>:<strong><CheckCircle2/>HAZIR</strong>}
    </div>
    <div className="serviceHero">
      <div><small>SERVİS PERSONELİ</small><h2>{courier.split(" ")[0]}, bugün {list.length} işin var.</h2><p>Her kartta müşterinin telefonu, ürünleri, adresi ve mağazanın notu birlikte durur.</p></div>
      <b>{list.length}<span>açık iş</span></b>
    </div>
    {list.length?list.map(d=>{
      const done=Object.values(d.checklist).filter(Boolean).length;
      const productText=d.items.map(item=>[item.brand,item.product,item.model].filter(Boolean).join(" ")+(item.quantity>1?` ×${item.quantity}`:"")).join(" • ");
      return <article className="serviceTask" key={d.id}>
        <div className="serviceTaskHead">
          <div><span className={"status s-"+d.status}>{labels[d.status]}</span><small>{d.timeWindow} • {d.orderNo}</small></div>
          <button className="soft" onClick={()=>onOpen(d)}>Tüm detaylar</button>
        </div>
        <div className="serviceCustomer">
          <span>{initials(d.customerName)}</span>
          <div><small>MÜŞTERİ</small><h3>{d.customerName}</h3><a href={tel(d.phone)}><Phone size={14}/>{d.phone}</a></div>
        </div>
        <div className="serviceFacts">
          <div className="serviceFact product"><PackageCheck/><p><small>ÜRÜN / İŞLEM</small><b>{productText||"Ürün bilgisi yok"}</b></p></div>
          <div className="serviceFact address"><MapPin/><p><small>TESLİMAT ADRESİ</small><b>{d.address}</b><span>{d.district}, {d.city}</span></p></div>
        </div>
        {d.notes?<div className="serviceNote"><AlertTriangle/><p><b>Mağaza notu</b><span>{d.notes}</span></p></div>:null}
        <div className="serviceQuick">
          <a href={tel(d.phone)}><Phone/>Müşteriyi ara</a>
          <a href={whatsapp(d.phone)} target="_blank" rel="noreferrer"><MessageCircle/>WhatsApp</a>
          <a href={map(d)} target="_blank" rel="noreferrer"><Navigation/>Haritada aç</a>
        </div>
        <div className="serviceChecklist">
          <div className="serviceChecklistHead"><div><b>Teslimat kontrolü</b><span>Eksik adım kalınca teslimat kapanmaz.</span></div><strong>{done}/6</strong></div>
          <div className="serviceProgress"><i><em style={{width:(done/6*100)+"%"}}/></i><span>%{Math.round(done/6*100)}</span></div>
          <div className="serviceChecks">{checks.map(([k,l])=><button className={d.checklist[k]?"on":""} onClick={()=>onToggle(d,k)} key={k}><i>{d.checklist[k]?<Check size={13}/>:null}</i><span>{l}</span></button>)}</div>
        </div>
        <div className="serviceActions">
          {d.status==="assigned"?<button className="primary" onClick={()=>onStatus(d,"seen")}>Görevi gördüm</button>:null}
          {d.status==="seen"?<button className="primary" onClick={()=>onStatus(d,"on_route")}><Truck size={17}/>Yola çıktım</button>:null}
          {d.status==="on_route"?<button className="primary" disabled={requireChecks&&done<6} onClick={()=>onStatus(d,"completed")}><CheckCircle2 size={17}/>Teslimatı tamamla</button>:null}
          <button className="issue" onClick={()=>onStatus(d,"issue")}><AlertTriangle size={16}/>Sorun var</button>
        </div>
      </article>
    }):<div className="card"><Empty title="Bugün atanmış iş yok" text="Mağaza sana teslimat atadığında burada görünecek."/></div>}
  </div>
}

function NewDelivery({staff,onClose,onSave}:{staff:Staff[];onClose:()=>void;onSave:(d:Omit<Delivery,"id"|"createdAt"|"updatedAt"|"checklist">)=>void}){
  type DraftItem={id:string;brand:string;product:string;model:string;quantity:number;service:boolean;install:boolean;old:boolean};
  const [f,setF]=useState({
    name:"",phone:"",secondaryPhone:"",address:"",district:"",city:"İstanbul",
    assignee:"Atanmamış",date:today(),time:"09:00 - 12:00",priority:"normal" as Priority,notes:""
  });
  const [items,setItems]=useState<DraftItem[]>([{id:id("draft"),brand:"ALTUS",product:"",model:"",quantity:1,service:false,install:false,old:false}]);
  const [err,setErr]=useState("");
  const quickProducts=["Bulaşık Makinesi","Çamaşır Makinesi","Buzdolabı","Fırın","Mikrodalga","Televizyon","Süpürge"];
  function set(k:string,v:string){setF(x=>({...x,[k]:v}))}
  function setItem(itemId:string,patch:Partial<DraftItem>){setItems(list=>list.map(item=>item.id===itemId?{...item,...patch}:item))}
  function addItem(){setItems(list=>[...list,{id:id("draft"),brand:"ALTUS",product:"",model:"",quantity:1,service:false,install:false,old:false}])}
  function removeItem(itemId:string){setItems(list=>list.length===1?list:list.filter(item=>item.id!==itemId))}
  const complete={
    customer:Boolean(f.name.trim()&&f.phone.replace(/\D/g,"").length>=10),
    address:Boolean(f.address.trim().length>=8&&f.district.trim()),
    products:Boolean(items.length&&items.every(item=>item.product.trim())),
    assignment:Boolean(f.assignee!=="Atanmamış")
  };
  function submit(e:FormEvent){
    e.preventDefault();
    setErr("");
    const phoneDigits=f.phone.replace(/\D/g,"");
    if(!f.name.trim()){setErr("Müşteri adı ve soyadı eksik.");return}
    if(phoneDigits.length<10){setErr("Müşteri telefonunu eksiksiz gir.");return}
    if(f.address.trim().length<8||!f.district.trim()){setErr("Açık adres ve ilçe eksik. Personel adres aramak zorunda kalmasın.");return}
    if(!items.length||items.some(item=>!item.product.trim())){setErr("Her ürün satırında ürün adı bulunmalı.");return}
    const suffix=(Date.now().toString(36).slice(-3)+Math.random().toString(36).slice(2,4)).toUpperCase();
    onSave({
      orderNo:"YD-"+f.date.replaceAll("-","").slice(2)+"-"+suffix,
      customerName:f.name.trim(),phone:f.phone.trim(),secondaryPhone:f.secondaryPhone.trim()||undefined,
      address:f.address.trim(),district:f.district.trim(),city:f.city.trim(),date:f.date,timeWindow:f.time,
      assignee:f.assignee,assigneeInitials:f.assignee==="Atanmamış"?"--":initials(f.assignee),status:"new",priority:f.priority,notes:f.notes.trim()||undefined,
      items:items.map(item=>({id:id("i"),brand:item.brand,product:item.product.trim(),model:item.model.trim()||undefined,quantity:item.quantity,serviceRequired:item.service,installationRequired:item.install,takeBackOldProduct:item.old}))
    })
  }
  return <Modal onClose={onClose}><form onSubmit={submit} className="deliveryEntry">
    <PageHead tag="YENİ TESLİMAT" title="Mağazada bir kez doğru gir, servis personeli aynısını görsün." text="Kağıttaki günlük listeyi dijitale çeviriyoruz: müşteri, telefon, ürün, adres, personel ve özel not."/>
    <div className="entryCompleteness">
      <span className={complete.customer?"done":""}><i>{complete.customer?<Check/>:"1"}</i>Müşteri</span>
      <span className={complete.address?"done":""}><i>{complete.address?<Check/>:"2"}</i>Adres</span>
      <span className={complete.products?"done":""}><i>{complete.products?<Check/>:"3"}</i>Ürün</span>
      <span className={complete.assignment?"done":""}><i>{complete.assignment?<Check/>:"4"}</i>Personel</span>
    </div>

    <section className="entrySection">
      <div className="entrySectionTitle"><span><UserRound/></span><div><b>Müşteri bilgileri</b><small>Servis personelinin arayacağı kişi</small></div></div>
      <div className="form">
        <Field label="Ad soyad *" v={f.name} set={v=>set("name",v)} placeholder="Müşteri adı ve soyadı"/>
        <Field label="Telefon *" v={f.phone} set={v=>set("phone",v)} placeholder="05xx xxx xx xx" inputMode="tel"/>
        <Field label="İkinci telefon" v={f.secondaryPhone} set={v=>set("secondaryPhone",v)} placeholder="Varsa ikinci numara" inputMode="tel"/>
      </div>
    </section>

    <section className="entrySection">
      <div className="entrySectionTitle"><span><MapPin/></span><div><b>Teslimat adresi</b><small>Mahalle, sokak ve bina bilgisi eksik kalmasın</small></div></div>
      <div className="form">
        <Field label="Açık adres *" v={f.address} set={v=>set("address",v)} placeholder="Mahalle, cadde/sokak, bina no, kat/daire..." wide/>
        <Field label="İlçe *" v={f.district} set={v=>set("district",v)} placeholder="İlçe"/>
        <Field label="Şehir" v={f.city} set={v=>set("city",v)} placeholder="İstanbul"/>
      </div>
    </section>

    <section className="entrySection">
      <div className="entrySectionTitle productTitle"><span><PackageCheck/></span><div><b>Ürünler ve yapılacak işlem</b><small>Aynı müşteride birden fazla ürün varsa ayrı satır ekle</small></div><button type="button" className="soft" onClick={addItem}><Plus size={15}/>Ürün ekle</button></div>
      <div className="entryItems">
        {items.map((item,index)=><div className="entryItem" key={item.id}>
          <div className="entryItemHead"><b>Ürün {index+1}</b>{items.length>1?<button type="button" onClick={()=>removeItem(item.id)}><Trash2 size={14}/>Sil</button>:null}</div>
          <div className="quickProducts">{quickProducts.map(x=><button type="button" className={item.product===x?"on":""} key={x} onClick={()=>setItem(item.id,{product:x})}>{x}</button>)}</div>
          <div className="form">
            <Select label="Marka" v={item.brand} set={v=>setItem(item.id,{brand:v})} opts={["ALTUS","BEKO","GRUNDIG","REGAL","HOOVER","PROFILO","KUMTEL","DİĞER"]}/>
            <Field label="Ürün *" v={item.product} set={v=>setItem(item.id,{product:v})} placeholder="Örn. Buzdolabı"/>
            <Field label="Model / kod" v={item.model} set={v=>setItem(item.id,{model:v})} placeholder="Örn. AL 413 P"/>
            <label><span>Adet</span><input type="number" min="1" max="20" value={item.quantity} onChange={e=>setItem(item.id,{quantity:Math.max(1,Number(e.target.value)||1)})}/></label>
          </div>
          <div className="options">
            <Opt t="Servis gerekli" on={item.service} set={v=>setItem(item.id,{service:v})}/>
            <Opt t="Kurulum gerekli" on={item.install} set={v=>setItem(item.id,{install:v})}/>
            <Opt t="Eski ürün geri alınacak" on={item.old} set={v=>setItem(item.id,{old:v})}/>
          </div>
        </div>)}
      </div>
    </section>

    <section className="entrySection">
      <div className="entrySectionTitle"><span><Truck/></span><div><b>Planlama ve personel</b><small>Kimin götüreceği ve mağazanın özel notu</small></div></div>
      <div className="form">
        <div className="assigneeField wide">
          <span>Servis / sevkiyat personeli *</span>
          <div className="assigneePicker">
            <button type="button" className={f.assignee==="Atanmamış"?"on unassigned":""} onClick={()=>set("assignee","Atanmamış")}><i>—</i><p><b>Atanmamış</b><small>Bildirim gönderilmez</small></p></button>
            {staff.map(person=><button type="button" key={person.id} className={f.assignee===person.name?"on":""} onClick={()=>set("assignee",person.name)}><i>{initials(person.name)}</i><p><b>{person.name}</b><small>{person.phone||"Telefon yok"}</small><em className={person.userId?"ready":"waiting"}>{person.userId?"Bildirim hesabı bağlı":"Hesap bağlantısı bekliyor"}</em></p></button>)}
          </div>
        </div>
        <Field label="Teslim tarihi" v={f.date} set={v=>set("date",v)} type="date"/>
        <Select label="Saat aralığı" v={f.time} set={v=>set("time",v)} opts={["09:00 - 12:00","12:00 - 15:00","15:00 - 18:00","18:00 - 21:00"]}/>
        <Select label="Öncelik" v={f.priority} set={v=>set("priority",v)} opts={["normal","high","critical"]}/>
        <Field label="Mağaza notu / unutulmaması gereken" v={f.notes} set={v=>set("notes",v)} placeholder="Örn. Eski bulaşık makinesi geri alınacak, teslimden önce ara." wide/>
      </div>
    </section>

    <div className="entryReview">
      <div><small>KAYIT ÖZETİ</small><b>{f.name||"Müşteri adı"} • {items.filter(x=>x.product).map(x=>x.product).join(", ")||"Ürün girilmedi"}</b><span>{f.address||"Adres girilmedi"}</span></div>
      <strong className={Object.values(complete).every(Boolean)?"ready":""}>{Object.values(complete).filter(Boolean).length}/4 hazır</strong>
    </div>
    {err?<div className="error">{err}</div>:null}
    <div className="modalActions"><button type="button" className="soft" onClick={onClose}>Vazgeç</button><button className="primary"><CheckCircle2 size={17}/>Teslimatı kaydet ve personele gönder</button></div>
  </form></Modal>
}

function NewStaff({onClose,onSave}:{onClose:()=>void;onSave:(s:{name:string;phone:string})=>void}){const [name,setName]=useState(""),[phone,setPhone]=useState("");return <Modal onClose={onClose}><form onSubmit={e=>{e.preventDefault();if(name)onSave({name,phone})}}><PageHead tag="PERSONEL" title="Sevkiyatçı ekle" text="Teslimat atayacağın personeli kaydet."/><div className="form one"><Field label="Ad soyad" v={name} set={setName}/><Field label="Telefon" v={phone} set={setPhone}/></div><div className="modalActions"><button type="button" className="soft" onClick={onClose}>Vazgeç</button><button className="primary"><UserPlus size={16}/>Personeli ekle</button></div></form></Modal>}
function Modal({children,onClose}:{children:React.ReactNode;onClose:()=>void}){return <div className="modalBg" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modalX" aria-label="Pencereyi kapat" onClick={onClose}><X size={18}/></button>{children}</div></div>}
function Field({label,v,set,wide,type="text",placeholder="",inputMode}:{label:string;v:string;set:(v:string)=>void;wide?:boolean;type?:string;placeholder?:string;inputMode?:React.HTMLAttributes<HTMLInputElement>["inputMode"]}){return <label className={wide?"wide":""}><span>{label}</span><input type={type} value={v} placeholder={placeholder} inputMode={inputMode} onChange={e=>set(e.target.value)}/></label>}
function Select({label,v,set,opts}:{label:string;v:string;set:(v:string)=>void;opts:string[]}){return <label><span>{label}</span><select value={v} onChange={e=>set(e.target.value)}>{opts.map(o=><option key={o} value={o}>{o==="normal"?"Normal":o==="high"?"Öncelikli":o==="critical"?"Acil":o}</option>)}</select></label>}
function Opt({t,on,set}:{t:string;on:boolean;set:(v:boolean)=>void}){return <button type="button" className={on?"on":""} onClick={()=>set(!on)}><i>{on?<Check size={13}/>:null}</i>{t}</button>}
function Drawer({
  d,events,staff,cloud,office,requireChecks,onClose,onStatus,onToggle,onAssign,onProofSaved,onDelete
}:{
  d:Delivery;
  events:ActivityEvent[];
  staff:Staff[];
  cloud:boolean;
  office:boolean;
  requireChecks:boolean;
  onClose:()=>void;
  onStatus:(s:DeliveryStatus)=>void;
  onToggle:(k:keyof Delivery["checklist"])=>void;
  onAssign:(person:Staff|null)=>void;
  onProofSaved:(kind:"photo"|"signature")=>void;
  onDelete:()=>void;
}){
  const done=Object.values(d.checklist).filter(Boolean).length;
  const timeline=events
    .filter(e=>e.deliveryId===d.id || (!e.deliveryId&&e.orderNo===d.orderNo))
    .sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
  const hasCreatedEvent=timeline.some(event=>event.type==="created");
  const priority=d.priority==="critical"?"Acil":d.priority==="high"?"Öncelikli":"Normal";
  const itemCount=d.items.reduce((sum,item)=>sum+(item.quantity||1),0);

  return <div className="drawerBg detailOverlay" onMouseDown={onClose}>
    <aside className="deliveryDetail" onMouseDown={e=>e.stopPropagation()}>
      <button className="modalX" aria-label="Pencereyi kapat" onClick={onClose}><X size={18}/></button>

      <header className="detailHero">
        <div className="detailHeroTop">
          <div className="badges">
            <span className={"status s-"+d.status}>{labels[d.status]}</span>
            <span className={"prio p-"+d.priority}>{priority}</span>
            <small>{d.orderNo}</small>
          </div>
          <span className="detailDate"><CalendarDays size={14}/>{d.date} • {d.timeWindow}</span>
        </div>
        <div className="detailCustomer">
          <span>{initials(d.customerName||"Müşteri")}</span>
          <div><small>MÜŞTERİ</small><h2>{d.customerName||"İsimsiz müşteri"}</h2><p>{d.district}, {d.city}</p></div>
        </div>
        <div className="detailQuick">
          <a href={tel(d.phone)}><Phone size={16}/><span>Ara</span></a>
          <a href={whatsapp(d.phone)} target="_blank" rel="noreferrer"><MessageCircle size={16}/><span>WhatsApp</span></a>
          <a href={map(d)} target="_blank" rel="noreferrer"><Navigation size={16}/><span>Yol tarifi</span></a>
        </div>
      </header>

      <div className="detailBody">
        <section className="detailSection">
          <div className="detailSectionHead"><span><UserRound size={16}/></span><div><small>MÜŞTERİ BİLGİLERİ</small><b>İletişim</b></div></div>
          <div className="detailInfoGrid">
            <p><small>Telefon</small><b>{d.phone||"Telefon girilmedi"}</b></p>
            <p><small>İkinci telefon</small><b>{d.secondaryPhone||"—"}</b></p>
          </div>
        </section>

        <section className="detailSection">
          <div className="detailSectionHead"><span><MapPin size={16}/></span><div><small>TESLİMAT NOKTASI</small><b>Adres</b></div></div>
          <div className="detailAddress">
            <b>{d.address||"Adres bilgisi girilmedi"}</b>
            <span>{d.district}, {d.city}</span>
            <a href={map(d)} target="_blank" rel="noreferrer"><Navigation size={14}/>Haritada aç</a>
          </div>
        </section>

        <section className="detailSection">
          <div className="detailSectionHead"><span><PackageCheck size={16}/></span><div><small>SİPARİŞ İÇERİĞİ</small><b>{itemCount} ürün</b></div></div>
          <div className="detailProducts">
            {d.items.map((item,index)=><div className="detailProduct" key={item.id||index}>
              <span><WebIcon product={item.product||""} size={32}/></span>
              <p><small>{item.brand||"MARKA YOK"}</small><b>{item.product||"Ürün bilgisi eksik"}</b><em>{item.model||"Model belirtilmedi"}</em></p>
              <strong>×{item.quantity||1}</strong>
              <div className="productFlags">
                {item.installationRequired?<i>Kurulum</i>:null}
                {item.serviceRequired?<i>Servis</i>:null}
                {item.takeBackOldProduct?<i>Eski ürün alımı</i>:null}
              </div>
            </div>)}
          </div>
        </section>

        <section className="detailSection">
          <div className="detailSectionHead"><span><Truck size={16}/></span><div><small>SEVKİYAT</small><b>Görev ve plan</b></div></div>
          <div className="detailInfoGrid detailInfoWide">
            <p><small>Servis</small><b>{d.assignee||"Atanmamış"}</b></p>
            <p><small>Tarih</small><b>{d.date}</b></p>
            <p><small>Saat aralığı</small><b>{d.timeWindow}</b></p>
            <p><small>Öncelik</small><b>{priority}</b></p>
          </div>
          {office?<label className="detailAssignee"><span>Personeli değiştir</span><select value={d.assignee||"Atanmamış"} onChange={e=>{const value=e.target.value;onAssign(value==="Atanmamış"?null:(staff.find(s=>s.name===value)||null));}}><option>Atanmamış</option>{staff.map(person=><option key={person.id}>{person.name}</option>)}</select></label>:null}
        </section>

        {d.notes?<section className="detailSection detailNote"><div className="detailSectionHead"><span><ClipboardCheck size={16}/></span><div><small>DÜKKAN NOTU</small><b>Sevkiyat notu</b></div></div><p>{d.notes}</p></section>:null}

        <section className="detailSection">
          <div className="detailSectionHead"><span><ClipboardCheck size={16}/></span><div><small>KONTROL LİSTESİ</small><b>{done}/6 tamamlandı</b></div></div>
          <div className="detailProgress"><i><em style={{width:(done/6*100)+"%"}}/></i><span>%{Math.round(done/6*100)}</span></div>
          <div className="detailChecklist">
            {checks.map(([k,l])=><button className={d.checklist[k]?"on":""} onClick={()=>onToggle(k)} key={k}><i>{d.checklist[k]?<Check size={13}/>:null}</i><span>{l}</span></button>)}
          </div>
        </section>

        <section className="detailSection">
          <div className="detailSectionHead"><span><History size={16}/></span><div><small>ZAMAN ÇİZELGESİ</small><b>İşlem geçmişi</b></div></div>
          <div className="detailTimeline">
            {timeline.length?timeline.map(event=><div className={"timelineItem "+event.type} key={event.id}>
              <i/>
              <div><b>{event.title}</b>{event.detail?<span>{event.detail}</span>:null}<small>{event.actor} • {new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(event.createdAt))}</small></div>
            </div>):<div className="timelineEmpty">Bu teslimat için henüz işlem geçmişi oluşmadı.</div>}
            {!hasCreatedEvent?<div className="timelineItem created"><i/><div><b>Teslimat kaydı oluşturuldu</b><small>{new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(d.createdAt))}</small></div></div>:null}
          </div>
        </section>

        <DeliveryProofPanel deliveryId={d.id} cloud={cloud} onSaved={onProofSaved}/>
      </div>

      <footer className="detailFooter">
        <div>
          {d.status==="new"?<button className="soft" disabled>Önce personel seç</button>:null}
          {d.status==="assigned"?<button className="primary" onClick={()=>onStatus("seen")}>Görüldü olarak işaretle</button>:null}
          {d.status==="seen"?<button className="primary" onClick={()=>onStatus("on_route")}>Yola çıktı</button>:null}
          {d.status==="on_route"?<button className="primary" disabled={requireChecks&&done<6} onClick={()=>onStatus("completed")}>Teslimatı tamamla</button>:null}
          {!["completed","issue"].includes(d.status)?<button className="issue" onClick={()=>onStatus("issue")}>Sorun bildir</button>:null}
        </div>
        {office?<button className="delete detailDelete" onClick={onDelete}><Trash2 size={14}/>Teslimatı sil</button>:null}
      </footer>
    </aside>
  </div>;
}

