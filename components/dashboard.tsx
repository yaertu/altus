"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Bell, Building2, CalendarDays, Check, CheckCircle2, ChevronDown,
  ChevronLeft, ChevronRight, ClipboardCheck, Clock3, ExternalLink, History, Image,
  LayoutDashboard, MapPin, Menu, Navigation, PackageCheck, PackageSearch, Phone, Plus,
  Save, Search, Settings, ShieldCheck, Store, Trash2, Truck, Upload, UserPlus, MessageCircle,
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
  cloudAvailable, createCourierStaff, getCurrentUser, getMyProfile, insertDelivery, insertEvent, insertStaff,
  loadAppSettings, loadCloudData, loadMyNotifications, loadProductCatalog, markNotificationRead,
  patchDelivery, removeCloudDelivery, signOut, subscribeCloud, subscribeMyNotifications, unsubscribeCloud,
  updateAppSettings, uploadStoreLogo,
  type AppNotification, type AppSettings, type ProductCatalogItem, type Profile
} from "@/lib/cloud";
import { enablePushNotifications, sendAssignmentPush, syncPushSubscription } from "@/lib/push";

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
const primaryNav=nav.filter(([view])=>["dashboard","deliveries","staff","customers","planning"].includes(view));
const secondaryNav=nav.filter(([view])=>["checklists","logs","settings"].includes(view));
function id(p:string){ return p+"-"+Date.now()+"-"+Math.random().toString(36).slice(2,7); }
function today(){ const d=new Date(), o=d.getTimezoneOffset()*60000; return new Date(d.getTime()-o).toISOString().slice(0,10); }
function initials(n:string){ return n.split(" ").filter(Boolean).map(x=>x[0]).join("").slice(0,2).toUpperCase(); }
function tel(p:string){ return "tel:"+p.replace(/[^\d+]/g,""); }
function whatsapp(p:string){ const digits=p.replace(/\D/g,""); const normalized=digits.startsWith("90")?digits:digits.startsWith("0")?"90"+digits.slice(1):digits.length===10?"90"+digits:digits; return "https://wa.me/"+normalized; }
function addressText(address:string,district:string,city:string){ return [address,district,city].filter(Boolean).join(", "); }
function map(d:Delivery){ return "https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(addressText(d.address,d.district,d.city)); }
function mapSearch(address:string,district:string,city:string){ return "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(addressText(address,district,city)); }
function mapEmbed(address:string,district:string,city:string){ return "https://www.google.com/maps?q="+encodeURIComponent(addressText(address,district,city))+"&output=embed"; }
const ALTUS_LOGO_URL="https://www.arcelikglobal.com/media/zl5aashl/altus_logo_pink.png";
const DEFAULT_APP_SETTINGS:AppSettings={storeName:"ALTUS Mağazası",storeSubtitle:"Teslimat & Servis",storePhone:"",storeAddress:"",storeCity:"İstanbul",logoUrl:""};

export default function Dashboard(){
  const [view,setView]=useState<View>("dashboard"), [mode,setMode]=useState<"office"|"courier">("office"), [side,setSide]=useState(false);
  const [deliveries,setDeliveries]=useState<Delivery[]>([]), [staff,setStaff]=useState<Staff[]>([]), [events,setEvents]=useState<ActivityEvent[]>([]);
  const [selected,setSelected]=useState<Delivery|null>(null), [newOpen,setNewOpen]=useState(false), [staffOpen,setStaffOpen]=useState(false);
  const [courier,setCourier]=useState(""), [notify,setNotify]=useState(false), [splash,setSplash]=useState(true), [ready,setReady]=useState(false);
  const [requireChecks,setRequireChecks]=useState(true), [query,setQuery]=useState(""), [filter,setFilter]=useState<"all"|DeliveryStatus>("all");
  const [cloud,setCloud]=useState(false), [cloudError,setCloudError]=useState(""), [profile,setProfile]=useState<Profile|null>(null), [signedIn,setSignedIn]=useState(false), [authReady,setAuthReady]=useState(!cloudAvailable());
  const [online,setOnline]=useState(true);
  const [inboxNotifications,setInboxNotifications]=useState<AppNotification[]>([]);
  const [notificationOpen,setNotificationOpen]=useState(false);
  const [moreOpen,setMoreOpen]=useState(false);
  const [actionNotice,setActionNotice]=useState<{text:string;tone:"ok"|"warn"}|null>(null);
  const [pendingDeliveryId,setPendingDeliveryId]=useState("");
  const [appSettings,setAppSettings]=useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [catalog,setCatalog]=useState<ProductCatalogItem[]>([]);
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
        setMode("office");
        setView("deliveries");
        window.setTimeout(()=>searchRef.current?.focus(),60);
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
      const [data,settings]=await Promise.all([
        loadCloudData(),
        loadAppSettings().catch(()=>DEFAULT_APP_SETTINGS)
      ]);
      if(!alive)return;
      setDeliveries(data.deliveries);
      setStaff(data.staff);
      setEvents(data.events);
      setAppSettings(settings);
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
        if(p?.role==="courier"){
          setMode("courier");
          setCourier(p.fullName);
          syncPushSubscription().then(ok=>{if(ok)setNotify(true)}).catch(()=>undefined);
        }
        await refresh();
        const productRows=await loadProductCatalog().catch(()=>[]);
        if(alive)setCatalog(productRows);
        const inbox=await loadMyNotifications().catch(()=>[]);
        if(!alive)return;
        setInboxNotifications(inbox);
        setCloud(true);
        channel=subscribeCloud(()=>{ refresh().catch(()=>undefined); });
        notificationChannel=subscribeMyNotifications(user.id,(notification)=>{
          setInboxNotifications(current=>[notification,...current.filter(item=>item.id!==notification.id)].slice(0,30));
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
    if(reason==="push_not_configured")return "Arka plan bildirim servisi henüz hazır değil.";
    if(reason==="login_required")return "Bildirim göndermek için mağaza hesabıyla giriş gerekli.";
    return "Görev kaydedildi; arka plan bildiriminin ulaştığı doğrulanamadı.";
  }

  async function addDelivery(d:Omit<Delivery,"id"|"createdAt"|"updatedAt"|"checklist">){
    const now=new Date().toISOString();
    try{
      const rec=cloud ? await insertDelivery(d,staff) : {...d,id:id("d"),createdAt:now,updatedAt:now,status:(d.assignee==="Atanmamış"?"new":"assigned") as DeliveryStatus,checklist:{addressVerified:false,customerCalled:false,productLoaded:false,modelChecked:false,accessoriesChecked:false,returnChecked:false}};
      setDeliveries(p=>[rec,...p.filter(x=>x.id!==rec.id)]); setNewOpen(false); log("Yeni teslimat oluşturuldu",rec,[rec.customerName,rec.items.map(x=>[x.product,x.model].filter(Boolean).join(" ")).join(", "),rec.address,rec.assignee].filter(Boolean).join(" • "),"created");
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
  async function addStaff(s:{name:string;phone:string;email:string;password:string}){
    try{
      const rec=cloud
        ? await createCourierStaff({name:s.name,phone:s.phone,email:s.email,password:s.password})
        : await insertStaff(s.name,s.phone);
      setStaff(p=>[...p.filter(x=>x.id!==rec.id),rec]);
      setStaffOpen(false);
      log("Servis personeli oluşturuldu",undefined,s.name+" • "+s.phone,"system");
      setActionNotice({text:cloud?s.name+" için servis hesabı oluşturuldu. Telefonda giriş yapıp bildirimleri açabilir.":s.name+" personel listesine eklendi.",tone:"ok"});
    }catch(err:any){ setCloudError(err?.message||"Personel hesabı oluşturulamadı."); }
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
  async function saveStoreSettings(next:AppSettings){
    try{
      const saved=cloud ? await updateAppSettings(next) : next;
      setAppSettings(saved);
      log("Mağaza ayarları güncellendi",undefined,saved.storeName+" • "+(saved.storeCity||""),"system");
      setActionNotice({text:"Mağaza kimliği ve iletişim bilgileri kaydedildi.",tone:"ok"});
      return saved;
    }catch(err:any){
      setCloudError(err?.message||"Mağaza ayarları kaydedilemedi.");
      throw err;
    }
  }

  async function uploadBrandLogo(file:File){
    if(!cloud)throw new Error("Logo yüklemek için canlı bağlantı gerekli.");
    const url=await uploadStoreLogo(file);
    log("Mağaza logosu yüklendi",undefined,file.name,"system");
    return url;
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

  const authRequired=cloudAvailable() && process.env.NEXT_PUBLIC_REQUIRE_AUTH!=="false";
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
      <div className="brand"><div className="hasBrandLogo"><img src={appSettings.logoUrl||ALTUS_LOGO_URL} alt="ALTUS"/></div><p><b>{appSettings.storeName}</b><span>{appSettings.storeSubtitle}</span></p><button aria-label="Menüyü kapat" onClick={()=>setSide(false)}><X size={18}/></button></div>
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
          <div className="topBrandMark storeBrandMark hasBrandLogo"><img src={appSettings.logoUrl||ALTUS_LOGO_URL} alt="ALTUS"/></div>
          <div className="topBrandCopy"><b>{appSettings.storeName}</b><span>{appSettings.storeSubtitle.toLocaleUpperCase("tr-TR")}</span></div>
        </div>

        {mode==="office"&&view!=="dashboard"?<label className="globalSearch">
          <Search size={18}/>
          <input
            ref={searchRef}
            value={mode==="office"?query:""}
            readOnly={mode!=="office"}
            onChange={e=>{setQuery(e.target.value);if(e.target.value)setView("deliveries")}}
            placeholder={mode==="office"?"Sipariş, müşteri, ürün, telefon veya adres ara":"Sevkiyatçı görevlerinde ara"}
          />
          <kbd>⌘K</kbd>
        </label>:<div className="topbarContext"><span>{mode==="courier"?"SERVİS MODU":"MAĞAZA OPERASYONU"}</span><b>{mode==="courier"?"Sıradaki teslimat":"Bugünkü teslimatlar"}</b></div>}

        <div className="topbarRight">
          <span className={"syncState "+(!online?"offline":cloud?"live":"local")}><i/>{!online?"Offline":cloud?"Canlı":"Yerel"}</span>
          {mode==="courier"&&profile?.role!=="courier"?<label className="select courierSelect"><UserRound size={15}/><select value={courier} onChange={e=>setCourier(e.target.value)}><option value="">Personel seç</option>{names.map(n=><option key={n}>{n}</option>)}</select><ChevronDown size={13}/></label>:null}
          <div className="notifyWrap">
            <button className="iconButton notifyButton" aria-label="Bildirimler" onClick={()=>setNotificationOpen(v=>!v)}>
              <Bell size={18}/>{inboxNotifications.some(n=>!n.readAt)?<i/>:notify?<i className="ready"/>:null}
              {inboxNotifications.filter(n=>!n.readAt).length?<b>{Math.min(9,inboxNotifications.filter(n=>!n.readAt).length)}</b>:null}
            </button>
            {notificationOpen?<div className="notificationTray">
              <div className="notificationTrayHead"><div><b>Bildirimler</b><span>{inboxNotifications.filter(n=>!n.readAt).length} okunmamış</span></div><button onClick={notifications}><Bell size={14}/>{notify?"Cihaz açık":"Bildirimleri aç"}</button></div>
              <div className="notificationTrayList">
                {inboxNotifications.length?inboxNotifications.slice(0,10).map(item=><button className={item.readAt?"":"unread"} key={item.id} onClick={async()=>{
                  if(!item.readAt){await markNotificationRead(item.id).catch(()=>undefined);setInboxNotifications(current=>current.map(n=>n.id===item.id?{...n,readAt:new Date().toISOString()}:n))}
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
        {mode==="office"?<nav>{primaryNav.map(([v,l,i])=><button key={v} className={view===v?"on":""} onClick={()=>{setView(v);setMoreOpen(false)}}>{i}<span>{l}</span>{v==="deliveries"&&active>0?<b>{active}</b>:null}</button>)}</nav>:<nav><button className="on"><Truck size={17}/><span>Görevlerim</span></button>{profile?.role!=="courier"?<button onClick={()=>setMode("office")}><Store size={17}/><span>Mağazaya dön</span></button>:null}</nav>}
        {mode==="office"?<div className="desktopNavActions">
          <div className="moreNavWrap">
            <button className={"moreNavButton "+(secondaryNav.some(([v])=>v===view)?"on":"")} onClick={()=>setMoreOpen(v=>!v)}><Settings size={16}/><span>Diğer</span><ChevronDown size={13}/></button>
            {moreOpen?<div className="moreNavMenu">{secondaryNav.map(([v,l,i])=><button key={v} className={view===v?"on":""} onClick={()=>{setView(v);setMoreOpen(false)}}>{i}<span>{l}</span></button>)}</div>:null}
          </div>
          <button className="primary navCreate" onClick={()=>setNewOpen(true)}><Plus size={17}/>Yeni teslimat</button>
        </div>:null}
      </div>

      {mode==="office"&&view!=="dashboard"?<section className="pageIntro">
        <div>
          <small>{mode==="office"?"OPERASYON / "+pageTitle.toLocaleUpperCase("tr-TR"):"SAHA / GÖREVLER"}</small>
          <h1>{pageTitle}</h1>
          <p>{pageDescription}</p>
        </div>
        <div className="pageIntroMeta">
          <span><CalendarDays size={16}/>{new Intl.DateTimeFormat("tr-TR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(new Date())}</span>
          {cloudError?<button className="cloudError" onClick={()=>setCloudError("")}><AlertTriangle size={13}/>{cloudError}<X size={12}/></button>:null}
        </div>
      </section>:null}
      {mode==="courier"?<CourierList list={my} courier={courier} catalog={catalog} notify={notify} cloud={cloud} onNotify={notifications} onOpen={setSelected} onStatus={setStatus} onToggle={toggle} requireChecks={requireChecks}/>:<>
        {view==="dashboard"&&<OperationsCenter deliveries={deliveries} staff={operationalStaff} cloud={cloud} onNew={()=>setNewOpen(true)} onStaff={()=>setStaffOpen(true)} onOpen={setSelected} onAssign={assignDelivery}/>}
        {view==="deliveries"&&<section className="card page"><PageHead tag="DÜKKAN KAYITLARI" title="Tüm teslimatlar" text="Müşteri, adres, ürün ve personel bilgilerini tek yerden takip et." action={<button className="primary" onClick={()=>setNewOpen(true)}><Plus size={16}/>Yeni teslimat</button>}/><div className="filters"><label><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="İsim, telefon, ürün, sipariş no..."/></label><label className="select"><select value={filter} onChange={e=>setFilter(e.target.value as "all"|DeliveryStatus)}><option value="all">Tüm durumlar</option>{Object.keys(labels).map(k=><option key={k} value={k}>{labels[k as DeliveryStatus]}</option>)}</select><ChevronDown size={13}/></label></div><DeliveryList list={filtered} onOpen={setSelected}/></section>}
        {view==="staff"&&<StaffPage staff={staff} deliveries={deliveries} onAdd={()=>setStaffOpen(true)}/>}
        {view==="customers"&&<CustomersPage deliveries={deliveries} onOpen={setSelected}/>}
        {view==="checklists"&&<ChecklistPage deliveries={deliveries}/>}
        {view==="planning"&&<PlanningPage deliveries={deliveries} staff={operationalStaff} onOpen={setSelected}/>}
        {view==="logs"&&<LogsPage events={events}/>}
        {view==="settings"&&<SettingsPage settings={appSettings} catalogCount={catalog.length} requireChecks={requireChecks} setRequireChecks={v=>{setRequireChecks(v);log("Teslimat kuralı değiştirildi",undefined,v?"Kontrol listesi zorunlu":"Kontrol listesi isteğe bağlı","system")}} notify={notify} onNotify={notifications} cloud={cloud} profile={profile} onSaveSettings={saveStoreSettings} onUploadLogo={uploadBrandLogo} onSignOut={async()=>{await signOut();window.location.reload()}} onClear={()=>{if(confirm("Bu cihazdaki yerel kayıtlar silinsin mi?")){setDeliveries([]);setStaff([]);setEvents([]);log("Yerel önbellek temizlendi",undefined,"Bu cihaz","system")}}}/>} 
      </>}
      <footer><span>ALTUS Teslimat • v2.2</span><DeveloperBadge compact/></footer>
      {mode==="office"?<MobileBottomNav view={view} onView={v=>setView(v)} onNew={()=>setNewOpen(true)}/>:null}
    </main>
    {newOpen&&<NewDelivery staff={operationalStaff} deliveries={deliveries} catalog={catalog} onClose={()=>setNewOpen(false)} onSave={addDelivery}/>} 
    {staffOpen&&<NewStaff onClose={()=>setStaffOpen(false)} onSave={addStaff}/>} 
    {selected&&<Drawer d={deliveries.find(x=>x.id===selected.id)||selected} events={events} staff={operationalStaff} cloud={cloud} office={mode==="office"} requireChecks={requireChecks} onClose={()=>setSelected(null)} onStatus={s=>setStatus(deliveries.find(x=>x.id===selected.id)||selected,s)} onToggle={k=>toggle(deliveries.find(x=>x.id===selected.id)||selected,k)} onAssign={person=>assignDelivery(deliveries.find(x=>x.id===selected.id)||selected,person)} onProofSaved={kind=>log(kind==="photo"?"Teslimat fotoğrafı eklendi":"Müşteri imzası eklendi",deliveries.find(x=>x.id===selected.id)||selected,undefined,"system")} onDelete={()=>remove(deliveries.find(x=>x.id===selected.id)||selected)}/>}
  </div>;
}

function PageHead({tag,title,text,action}:{tag:string;title:string;text:string;action?:React.ReactNode}){return <div className="pageHead"><div><small>{tag}</small><h2>{title}</h2><p>{text}</p></div>{action}</div>}
function Empty({title,text}:{title:string;text:string}){return <div className="empty"><PackageCheck size={28}/><b>{title}</b><span>{text}</span></div>}
function DeliveryList({list,onOpen}:{list:Delivery[];onOpen:(d:Delivery)=>void}){return <div className="list">{list.length?list.map(d=>{const done=Object.values(d.checklist).filter(Boolean).length;const item=d.items[0];return <button className="row deliveryRow" key={d.id} onClick={()=>onOpen(d)}><div className="customerCell"><div className="badges"><span className={"status s-"+d.status}>{labels[d.status]}</span>{d.priority!=="normal"?<span className={"prio p-"+d.priority}>{d.priority==="critical"?"Acil":"Öncelikli"}</span>:null}<small>{d.orderNo}</small></div><h3>{d.customerName}</h3><p><span><MapPin size={14}/>{d.district||"İlçe yok"}</span><span><Clock3 size={14}/>{d.timeWindow}</span><span><UserRound size={14}/>{d.assignee}</span></p></div><div className="product deliveryProduct"><span className="productIcon"><WebIcon product={item?.product||""} size={30}/></span><p><small>ÜRÜN</small><b>{item?.brand+" • "+item?.product}</b><span>{item?.model||"Model yok"}</span></p></div><div className="progress deliveryProgress"><p><span>Hazırlık</span><b>{done}/6</b></p><i><em style={{width:(done/6*100)+"%"}}/></i><small>{done===6?"Hazır":"Kontroller sürüyor"}</small></div><span className="rowArrow">›</span></button>}):<Empty title="Kayıt yok" text="Henüz teslimat oluşturulmadı."/>}</div>}
function StaffPage({staff,deliveries,onAdd}:{staff:Staff[];deliveries:Delivery[];onAdd:()=>void}){return <section className="card page"><PageHead tag="SEVKİYAT EKİBİ" title="Personeller" text="Dükkandan görev atayacağın personeller." action={<button className="primary" onClick={onAdd}><UserPlus size={16}/>Personel ekle</button>}/>{staff.length?<div className="staffGrid">{staff.map(s=>{const a=deliveries.filter(d=>d.assignee===s.name&&!["completed","issue"].includes(d.status)).length;return <div className="staffCard" key={s.id}><div>{initials(s.name)}</div><h3>{s.name}</h3><a href={tel(s.phone)}>{s.phone||"Telefon yok"}</a><div className={"staffNotify "+(s.userId?"ready":"waiting")}><Bell size={13}/>{s.userId?"Bildirim hesabı bağlı":"Bildirim hesabı bağlı değil"}</div><p><b>{a}</b><span>aktif teslimat</span></p></div>})}</div>:<Empty title="Personel eklenmedi" text="Önce sevkiyat personelini ekle."/>}</section>}
function CustomersPage({deliveries,onOpen}:{deliveries:Delivery[];onOpen:(d:Delivery)=>void}){
  const [search,setSearch]=useState("");
  const customers=useMemo(()=>{
    const sorted=[...deliveries].sort((a,b)=>new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime());
    const map=new Map<string,{key:string;name:string;phone:string;last:Delivery;count:number;addresses:Set<string>}>();
    for(const d of sorted){
      const key=(d.phone||d.customerName).replace(/\s/g,"").toLocaleLowerCase("tr-TR");
      const existing=map.get(key);
      if(existing){
        existing.count++;
        existing.addresses.add(addressText(d.address,d.district,d.city));
      }else{
        map.set(key,{key,name:d.customerName,phone:d.phone,last:d,count:1,addresses:new Set([addressText(d.address,d.district,d.city)])});
      }
    }
    return Array.from(map.values());
  },[deliveries]);
  const q=search.trim().toLocaleLowerCase("tr-TR");
  const visible=customers.filter(c=>!q||[c.name,c.phone,c.last.address,c.last.district,productLabel(c.last)].join(" ").toLocaleLowerCase("tr-TR").includes(q));
  return <section className="customerDirectory">
    <div className="customerDirectoryHead">
      <PageHead tag="MÜŞTERİLER" title="Müşteri rehberi" text="Teslimatlardan otomatik oluşur; tekrar gelen müşteriyi aramak ve geçmişini görmek kolaydır."/>
      <div className="customerStats"><span><b>{customers.length}</b><small>müşteri</small></span><span><b>{deliveries.length}</b><small>teslimat kaydı</small></span></div>
    </div>
    <label className="customerSearch"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="İsim, telefon, adres veya ürün ara..."/></label>
    {visible.length?<div className="customerCards">{visible.map(customer=><article className="customerCardV2" key={customer.key}>
      <div className="customerCardMain">
        <span className="customerAvatar">{initials(customer.name)}</span>
        <div><small>MÜŞTERİ</small><h3>{customer.name}</h3><a href={tel(customer.phone)}><Phone/>{customer.phone}</a></div>
        <em>{customer.count} teslimat</em>
      </div>
      <div className="customerCardInfo">
        <p><MapPin/><span><small>Son adres</small><b>{addressText(customer.last.address,customer.last.district,customer.last.city)}</b></span></p>
        <p><PackageCheck/><span><small>Son ürün</small><b>{productLabel(customer.last)}</b></span></p>
      </div>
      <div className="customerCardActions">
        <a href={whatsapp(customer.phone)} target="_blank" rel="noreferrer"><MessageCircle/>WhatsApp</a>
        <a href={map(customer.last)} target="_blank" rel="noreferrer"><Navigation/>Yol tarifi</a>
        <button onClick={()=>onOpen(customer.last)}>Son teslimatı aç<ChevronRight/></button>
      </div>
    </article>)}</div>:<Empty title="Müşteri bulunamadı" text={customers.length?"Arama kriterini değiştir.":"Teslimat oluşturdukça müşteri rehberi otomatik oluşur."}/>}
  </section>
}
function productLabel(d:Delivery){return d.items.map(item=>[item.brand,item.product,item.model].filter(Boolean).join(" ")).join(" • ")||"Ürün yok";}
function ChecklistPage({deliveries}:{deliveries:Delivery[]}){return <section className="card page"><PageHead tag="ZORUNLU KONTROLLER" title="Kontrol listeleri" text="Personel teslimatı kapatmadan önce bu adımları işaretler."/><div className="checkDefs">{checks.map(([k,l])=>{const n=deliveries.filter(d=>d.checklist[k]).length;return <div key={k}><span><Check/></span><p><b>{l}</b><small>{n+" / "+deliveries.length+" kayıtta tamamlandı"}</small></p></div>})}</div></section>}
function PlanningPage({deliveries,staff,onOpen}:{deliveries:Delivery[];staff:Staff[];onOpen:(d:Delivery)=>void}){
  const [date,setDate]=useState(today());
  const list=deliveries.filter(d=>d.date===date).sort((a,b)=>a.timeWindow.localeCompare(b.timeWindow));
  const slots=["09:00 - 12:00","12:00 - 15:00","15:00 - 18:00","18:00 - 21:00"];
  const assigned=list.filter(d=>d.assignee&&d.assignee!=="Atanmamış").length;
  const unassigned=list.length-assigned;
  const completed=list.filter(d=>d.status==="completed").length;
  function move(amount:number){
    const next=new Date(date+"T12:00:00");
    next.setDate(next.getDate()+amount);
    const offset=next.getTimezoneOffset()*60000;
    setDate(new Date(next.getTime()-offset).toISOString().slice(0,10));
  }
  return <section className="planningWorkspace">
    <div className="planningHead">
      <PageHead tag="GÜNLÜK PLAN" title="Sevkiyat planı" text="Günü saat aralıklarına böl, personel yükünü gör ve teslimatı doğrudan aç."/>
      <div className="planningDate"><button onClick={()=>move(-1)}><ChevronLeft/></button><label><CalendarDays/><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button onClick={()=>move(1)}><ChevronRight/></button></div>
    </div>
    <div className="planningSummary">
      <span><PackageCheck/><p><b>{list.length}</b><small>toplam iş</small></p></span>
      <span><Truck/><p><b>{assigned}</b><small>personel atandı</small></p></span>
      <span className={unassigned?"warn":""}><AlertTriangle/><p><b>{unassigned}</b><small>atanmamış</small></p></span>
      <span className="ok"><CheckCircle2/><p><b>{completed}</b><small>tamamlandı</small></p></span>
    </div>
    <div className="planningBoardV2">
      {slots.map(slot=>{
        const items=list.filter(d=>d.timeWindow===slot);
        return <section className="planLane" key={slot}>
          <header><Clock3/><div><b>{slot}</b><small>{items.length} teslimat</small></div></header>
          <div>{items.length?items.map(d=><button className={"planTask "+(d.assignee==="Atanmamış"?"unassigned":"")} key={d.id} onClick={()=>onOpen(d)}>
            <div className="planTaskTop"><span className={"status s-"+d.status}>{labels[d.status]}</span><small>{d.orderNo}</small></div>
            <h3>{d.customerName}</h3>
            <p><PackageCheck/>{productLabel(d)}</p>
            <p><MapPin/>{d.district}, {d.city}</p>
            <footer><span><Truck/>{d.assignee||"Atanmamış"}</span><ChevronRight/></footer>
          </button>):<div className="planLaneEmpty">Bu saat aralığında iş yok.</div>}</div>
        </section>
      })}
    </div>
    <div className="planningCrew">
      <div><b>Personel yükü</b><small>Seçili gündeki açık görev sayısı</small></div>
      <div>{staff.length?staff.map(person=>{const count=list.filter(d=>d.assignee===person.name&&!["completed","issue"].includes(d.status)).length;return <span key={person.id}><i>{initials(person.name)}</i><p><b>{person.name}</b><small>{count} açık görev</small></p><em>{person.userId?"Bildirim hazır":"Hesap bekliyor"}</em></span>}):<small>Personel eklenmedi.</small>}</div>
    </div>
  </section>
}
function LogsPage({events}:{events:ActivityEvent[]}){
  const [filter,setFilter]=useState<"all"|ActivityEvent["type"]>("all");
  const [search,setSearch]=useState("");
  const q=search.trim().toLocaleLowerCase("tr-TR");
  const visible=events.filter(event=>(filter==="all"||event.type===filter)&&(!q||[event.title,event.detail,event.orderNo,event.actor].filter(Boolean).join(" ").toLocaleLowerCase("tr-TR").includes(q)));
  return <section className="auditWorkspace">
    <div className="auditHead"><PageHead tag="DENETİM İZİ" title="İşlem kayıtları" text="Teslimat, personel, ayar, durum ve kontrol değişiklikleri kronolojik olarak tutulur."/><span><ShieldCheck/><b>{events.length}</b><small>kayıt</small></span></div>
    <div className="auditTools"><label><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Sipariş, müşteri, işlem veya kullanıcı ara..."/></label><select value={filter} onChange={e=>setFilter(e.target.value as any)}><option value="all">Tüm hareketler</option><option value="created">Oluşturma</option><option value="status">Durum</option><option value="checklist">Kontrol</option><option value="issue">Sorun</option><option value="system">Sistem / ayar</option></select></div>
    {visible.length?<div className="auditList">{visible.map(event=><article className={"auditRow "+event.type} key={event.id}><span><History/></span><div><div><b>{event.title}</b><em>{event.type}</em></div><p>{event.detail||"Detay yok"}</p><small>{event.actor} • {event.orderNo||"Sistem"}</small></div><time>{new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(event.createdAt))}</time></article>)}</div>:<Empty title="İşlem kaydı bulunamadı" text="Filtreyi değiştir veya sistemde bir işlem yap."/>}
  </section>
}
function SettingsPage({
  settings,catalogCount,requireChecks,setRequireChecks,notify,onNotify,cloud,profile,onSaveSettings,onUploadLogo,onSignOut,onClear
}:{
  settings:AppSettings;
  catalogCount:number;
  requireChecks:boolean;
  setRequireChecks:(v:boolean)=>void;
  notify:boolean;
  onNotify:()=>void;
  cloud:boolean;
  profile:Profile|null;
  onSaveSettings:(settings:AppSettings)=>Promise<AppSettings>;
  onUploadLogo:(file:File)=>Promise<string>;
  onSignOut:()=>void;
  onClear:()=>void;
}){
  const [draft,setDraft]=useState<AppSettings>(settings);
  const [saving,setSaving]=useState(false);
  const [logoBusy,setLogoBusy]=useState(false);
  const [message,setMessage]=useState("");
  useEffect(()=>setDraft(settings),[settings]);

  function set<K extends keyof AppSettings>(key:K,value:AppSettings[K]){setDraft(current=>({...current,[key]:value}))}
  async function save(){
    setSaving(true);setMessage("");
    try{const saved=await onSaveSettings(draft);setDraft(saved);setMessage("Ayarlar kaydedildi.");}
    catch{setMessage("Ayarlar kaydedilemedi.");}
    finally{setSaving(false);}
  }
  async function logo(file?:File){
    if(!file)return;
    setLogoBusy(true);setMessage("");
    try{const url=await onUploadLogo(file);setDraft(current=>({...current,logoUrl:url}));setMessage("Logo yüklendi. Kaydet butonuna bas.");}
    catch(err:any){setMessage(err?.message||"Logo yüklenemedi.");}
    finally{setLogoBusy(false);}
  }

  return <div className="settingsHub">
    <section className="settingsIdentity">
      <div className="settingsIdentityPreview">
        <div className="settingsLogo hasImage"><img src={draft.logoUrl||ALTUS_LOGO_URL} alt="ALTUS"/></div>
        <div><small>MAĞAZA KİMLİĞİ</small><h2>{draft.storeName||"Mağaza adı"}</h2><p>{draft.storeSubtitle||"Teslimat & Servis"}</p></div>
      </div>
      <div className="settingsIdentityActions">
        <label className="soft uploadLogo"><Upload/>{logoBusy?"Yükleniyor...":"Logo yükle"}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={logoBusy||!cloud} onChange={e=>logo(e.target.files?.[0])}/></label>
        <button className="primary" disabled={saving} onClick={save}><Save/>{saving?"Kaydediliyor...":"Ayarları kaydet"}</button>
      </div>
    </section>

    {message?<div className="settingsMessage">{message}</div>:null}

    <div className="settingsGridV5">
      <section className="settingsPanel branding">
        <div className="settingsPanelHead"><span><Building2/></span><div><small>MAĞAZA</small><h3>Kimlik ve iletişim</h3><p>Mağaza personeli ve servis ekranlarında ortak görünür.</p></div></div>
        <div className="settingsForm">
          <Field label="Mağaza adı" v={draft.storeName} set={v=>set("storeName",v)} placeholder="ALTUS Mağazası"/>
          <Field label="Alt başlık" v={draft.storeSubtitle} set={v=>set("storeSubtitle",v)} placeholder="Teslimat & Servis"/>
          <Field label="Mağaza telefonu" v={draft.storePhone} set={v=>set("storePhone",v)} placeholder="0212..." inputMode="tel"/>
          <Field label="Şehir" v={draft.storeCity} set={v=>set("storeCity",v)} placeholder="İstanbul"/>
          <Field label="Mağaza adresi" v={draft.storeAddress} set={v=>set("storeAddress",v)} placeholder="Mağaza açık adresi" wide/>
        </div>
      </section>

      <section className="settingsPanel">
        <div className="settingsPanelHead"><span><ClipboardCheck/></span><div><small>OPERASYON</small><h3>Teslimat kuralları</h3><p>Servis personelinin işi eksik kapatmasını engelle.</p></div></div>
        <div className="setting settingRich"><p><b>6 kontrol tamamlanmadan teslimatı kapatma</b><small>Adres, müşteri araması, araç yükleme, model, aksesuar ve geri alım kontrol edilir.</small></p><button className={requireChecks?"on":""} onClick={()=>setRequireChecks(!requireChecks)}><i/></button></div>
        <div className="settingsRule"><CheckCircle2/><p><b>Fotoğraf ve imza kanıtı</b><small>Teslimat detayından fotoğraf ve müşteri imzası Supabase Storage'a kaydedilir.</small></p></div>
        <div className="settingsRule"><History/><p><b>İşlem geçmişi</b><small>Durum, checklist, atama, personel ve ayar değişiklikleri loglanır.</small></p></div>
      </section>

      <section className="settingsPanel">
        <div className="settingsPanelHead"><span><Bell/></span><div><small>BİLDİRİM</small><h3>Servis personeli bildirimi</h3><p>Yeni görev atandığında personelin telefonuna haber ver.</p></div></div>
        <div className={"settingsStatus "+(notify?"ready":"warn")}><i/><div><b>{notify?"Bu cihazın bildirimleri açık":"Bu cihazın bildirim izni kapalı"}</b><small>{notify?"Push aboneliği hazır.":"İzin vererek görev uyarılarını etkinleştir."}</small></div></div>
        <button className="primary settingsWideAction" onClick={onNotify}><Bell/>{notify?"Bildirimleri yeniden doğrula":"Bildirimleri aç"}</button>
      </section>

      <section className="settingsPanel">
        <div className="settingsPanelHead"><span><PackageSearch/></span><div><small>ÜRÜN KATALOĞU</small><h3>Altus ürünleri</h3><p>Yeni teslimat formundaki model aramasını besler.</p></div></div>
        <div className="catalogSummary"><b>{catalogCount}</b><span>hazır Altus model kaydı</span></div>
        <p className="settingsHelp">Buzdolabı, çamaşır/bulaşık makinesi, kurutma, televizyon, süpürge, mikrodalga ve klima modelleri başlangıç kataloğunda hazırdır.</p>
        <a className="soft settingsLink" href="https://www.altus.com.tr/urunler/beyaz-esya" target="_blank" rel="noreferrer"><ExternalLink/>Altus ürün kataloğunu aç</a>
      </section>

      <section className="settingsPanel">
        <div className="settingsPanelHead"><span><ShieldCheck/></span><div><small>HESAP & BAĞLANTI</small><h3>{cloud?"Canlı bağlantı açık":"Yerel çalışma"}</h3><p>{cloud?"Mağaza ve servis personeli aynı veriyi anlık görür.":"Bulut bağlantısı kapalı."}</p></div></div>
        <div className="connectionInfo settingsConnection"><i className={cloud?"on":""}/><p><b>{profile?.fullName||"Bu cihaz"}</b><small>{profile?.role||"yerel mod"} • {cloud?"Supabase bağlı":"yerel"}</small></p>{profile?<button className="soft" onClick={onSignOut}>Çıkış yap</button>:null}</div>
      </section>

      <section className="settingsPanel dangerZone">
        <div className="settingsPanelHead"><span><Trash2/></span><div><small>BAKIM</small><h3>Yerel önbellek</h3><p>Canlı veritabanını silmeden yalnız bu cihazdaki yerel kopyayı temizler.</p></div></div>
        <button className="delete settingsWideAction" onClick={onClear}><Trash2/>Bu cihazdaki yerel veriyi temizle</button>
      </section>
    </div>

    <InstallPwaCard/>
  </div>
}
function CourierList({
  list,courier,catalog,notify,cloud,onNotify,onOpen,onStatus,onToggle,requireChecks
}:{
  list:Delivery[];
  courier:string;
  catalog:ProductCatalogItem[];
  notify:boolean;
  cloud:boolean;
  onNotify:()=>void;
  onOpen:(d:Delivery)=>void;
  onStatus:(d:Delivery,s:DeliveryStatus)=>void;
  onToggle:(d:Delivery,k:keyof Delivery["checklist"])=>void;
  requireChecks:boolean;
}){
  if(!courier)return <div className="courierEmpty"><WebIcon name="truck-fast-outline" size={52}/><h2>Personel seçilmedi</h2><p>Servis personelini seçince yalnız ona atanmış bugünkü teslimatlar görünür.</p></div>;

  const ordered=[...list].sort((a,b)=>(a.timeWindow||"").localeCompare(b.timeWindow||""));
  const active=ordered.filter(d=>!["completed","issue"].includes(d.status));
  const finished=ordered.filter(d=>d.status==="completed");
  const next=active[0];
  const others=active.slice(1);

  if(!next)return <div className="driverFocus driverAllDone">
    <div className="driverDoneIcon"><CheckCircle2/></div>
    <small>BUGÜN</small>
    <h1>Tüm işler tamam 🎉</h1>
    <p>{finished.length} teslimat tamamlandı. Yeni görev geldiğinde burada otomatik görünecek.</p>
    {!notify?<button className="primary driverBigButton" disabled={!cloud} onClick={onNotify}><Bell/>Bildirimleri aç</button>:<span className="driverReady"><Bell/><b>Bildirimler açık</b></span>}
  </div>;

  const done=Object.values(next.checklist).filter(Boolean).length;
  const nextProducts=next.items.map((item,index)=>{
    const match=catalog.find(row=>row.model?.toLocaleLowerCase("tr-TR")===(item.model||"").toLocaleLowerCase("tr-TR"));
    return {item,index,match};
  });

  return <div className="driverFocus">
    <section className="driverHeader">
      <div className="driverHeaderTop">
        <div><span className="driverEyebrow">SIRADAKİ DURAK</span><h1>{next.customerName}</h1><p><Clock3/>{next.timeWindow||"Saat belirtilmedi"} <b>•</b> {next.district}</p></div>
        <span className={"driverStatus s-"+next.status}>{labels[next.status]}</span>
      </div>
      <div className={"driverNotifyMini "+(notify?"ready":"waiting")} onClick={!notify?onNotify:undefined}>
        <Bell/>{notify?<><b>Bildirimler açık</b><small>Yeni görevler anında gelir</small></>:<><b>Bildirimleri aç</b><small>Yeni görevi kaçırma</small></>}
      </div>
    </section>

    <section className="driverMapCard">
      <AddressMap address={next.address} district={next.district} city={next.city} compact/>
      <div className="driverAddress">
        <span><MapPin/></span>
        <div><small>GİDECEĞİN ADRES</small><b>{next.address}</b><p>{next.district}, {next.city}</p></div>
      </div>
      <a className="driverNavigate" href={map(next)} target="_blank" rel="noreferrer"><Navigation/><span><b>YOL TARİFİNİ AÇ</b><small>Google Maps ile başlat</small></span><ChevronRight/></a>
    </section>

    <section className="driverCustomerCard">
      <div className="driverCustomerMain">
        <span>{initials(next.customerName)}</span>
        <div><small>MÜŞTERİ</small><h2>{next.customerName}</h2><p>{next.phone}{next.secondaryPhone?" • "+next.secondaryPhone:""}</p></div>
      </div>
      <div className="driverContactActions">
        <a className="call" href={tel(next.phone)}><Phone/><b>ARA</b></a>
        <a className="whatsapp" href={whatsapp(next.phone)} target="_blank" rel="noreferrer"><MessageCircle/><b>WHATSAPP</b></a>
      </div>
    </section>

    <section className="driverProductCard">
      <header><PackageCheck/><div><small>TESLİM EDECEĞİN ÜRÜN</small><b>{next.items.reduce((sum,item)=>sum+(item.quantity||1),0)} adet ürün</b></div></header>
      <div className="driverProducts">
        {nextProducts.map(({item,index,match})=><article className="driverProduct" key={item.id||index}>
          <div className="driverProductVisual"><WebIcon product={item.product||""} size={52} color="f00088"/></div>
          <div className="driverProductCopy"><span>{item.brand||"ALTUS"}</span><h3>{item.product||"Ürün bilgisi eksik"}</h3><b>{item.model||"Model girilmedi"}</b>
            <div>{item.installationRequired?<em>Kurulum</em>:null}{item.serviceRequired?<em>Servis</em>:null}{item.takeBackOldProduct?<em>Eski ürün alınacak</em>:null}</div>
            {match?.sourceUrl?<a href={match.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink/>Altus ürün bilgisini aç</a>:null}
          </div>
          <strong>×{item.quantity||1}</strong>
        </article>)}
      </div>
    </section>

    {next.notes?<section className="driverNote"><AlertTriangle/><div><small>MAĞAZA NOTU</small><b>{next.notes}</b></div></section>:null}

    <section className="driverChecklist">
      <div className="driverSectionHead"><div><small>SON KONTROL</small><h2>Teslimatı eksiksiz yap</h2></div><strong>{done}/6</strong></div>
      <div className="driverCheckGrid">{checks.map(([k,l],index)=><button className={next.checklist[k]?"on":""} onClick={()=>onToggle(next,k)} key={k}><i>{next.checklist[k]?<Check/>:index+1}</i><span>{l}</span></button>)}</div>
    </section>

    <section className="driverFinish">
      {next.status==="new"||next.status==="assigned"?<button className="primary driverStateAction" onClick={()=>onStatus(next,"seen")}><CheckCircle2/><span><b>GÖREVİ ALDIM</b><small>Müşteri ve ürünü gördüm</small></span></button>:null}
      {next.status==="seen"?<button className="primary driverStateAction" onClick={()=>onStatus(next,"on_route")}><Truck/><span><b>YOLA ÇIKTIM</b><small>Mağazadan ayrılıyorum</small></span></button>:null}
      {next.status==="on_route"?<button className="primary driverStateAction complete" disabled={requireChecks&&done<6} onClick={()=>onStatus(next,"completed")}><CheckCircle2/><span><b>TESLİMATI TAMAMLADIM</b><small>{requireChecks&&done<6?"Önce 6 kontrolü tamamla":"İşi kapat"}</small></span></button>:null}
      <button className="driverIssue" onClick={()=>onStatus(next,"issue")}><AlertTriangle/>Sorun var</button>
    </section>

    {others.length?<section className="driverOtherStops">
      <div className="driverSectionHead"><div><small>SONRAKİLER</small><h2>Diğer duraklar</h2></div><strong>{others.length}</strong></div>
      <div>{others.map((d,index)=><button key={d.id} onClick={()=>onOpen(d)} className="driverStopRow">
        <span className="driverStopNo">{index+2}</span>
        <div><b>{d.customerName}</b><small>{d.timeWindow} • {d.district}</small><em>{d.items.map(item=>[item.product,item.model].filter(Boolean).join(" ")).join(" • ")}</em></div>
        <ChevronRight/>
      </button>)}</div>
    </section>:null}

    <div className="driverStickyBar">
      <a href={tel(next.phone)}><Phone/><span>Ara</span></a>
      <a className="main" href={map(next)} target="_blank" rel="noreferrer"><Navigation/><span>Yol Tarifi</span></a>
      <button onClick={()=>onOpen(next)}><PackageCheck/><span>Detay</span></button>
    </div>
  </div>
}
function NewDelivery({staff,deliveries,catalog,onClose,onSave}:{staff:Staff[];deliveries:Delivery[];catalog:ProductCatalogItem[];onClose:()=>void;onSave:(d:Omit<Delivery,"id"|"createdAt"|"updatedAt"|"checklist">)=>void}){
  type DraftItem={id:string;brand:string;product:string;model:string;quantity:number;service:boolean;install:boolean;old:boolean};
  const [step,setStep]=useState(1);
  const [f,setF]=useState({
    name:"",phone:"",secondaryPhone:"",address:"",district:"",city:"İstanbul",
    assignee:"Atanmamış",date:today(),time:"09:00 - 12:00",priority:"normal" as Priority,notes:""
  });
  const [items,setItems]=useState<DraftItem[]>([{id:id("draft"),brand:"ALTUS",product:"",model:"",quantity:1,service:false,install:false,old:false}]);
  const [err,setErr]=useState("");
  const [customerOpen,setCustomerOpen]=useState(false);
  const quickProducts=["Buzdolabı","Derin Dondurucu","Bulaşık Makinesi","Çamaşır Makinesi","Kurutma Makinesi","Fırın","Mikrodalga Fırın","Televizyon","Klima","Süpürge"];

  const recentCustomers=useMemo(()=>{
    const map=new Map<string,Delivery>();
    [...deliveries].sort((a,b)=>new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime()).forEach(d=>{const key=(d.phone||d.customerName).replace(/\s/g,"").toLowerCase();if(!map.has(key))map.set(key,d)});
    return Array.from(map.values()).slice(0,50);
  },[deliveries]);
  const customerSuggestions=recentCustomers.filter(d=>{
    const q=(f.name+" "+f.phone).trim().toLocaleLowerCase("tr-TR");
    if(!q)return true;
    return [d.customerName,d.phone,d.address,d.district].join(" ").toLocaleLowerCase("tr-TR").includes(q);
  }).slice(0,5);

  function set(k:string,v:string){setF(x=>({...x,[k]:v}))}
  function setItem(itemId:string,patch:Partial<DraftItem>){setItems(list=>list.map(item=>item.id===itemId?{...item,...patch}:item))}
  function addItem(){setItems(list=>[...list,{id:id("draft"),brand:"ALTUS",product:"",model:"",quantity:1,service:false,install:false,old:false}])}
  function removeItem(itemId:string){setItems(list=>list.length===1?list:list.filter(item=>item.id!==itemId))}
  function chooseCustomer(d:Delivery){
    setF(current=>({...current,name:d.customerName,phone:d.phone,secondaryPhone:d.secondaryPhone||"",address:d.address,district:d.district,city:d.city||"İstanbul"}));
    setCustomerOpen(false);
  }
  function chooseCatalog(itemId:string,model:string){
    const hit=catalog.find(row=>row.model===model);
    if(hit)setItem(itemId,{brand:hit.brand,product:hit.category,model:hit.model});
    else setItem(itemId,{model});
  }
  function catalogFor(item:DraftItem){return catalog.filter(row=>!item.product||row.category===item.product).slice(0,80)}

  const complete={
    customer:Boolean(f.name.trim()&&f.phone.replace(/\D/g,"").length>=10),
    address:Boolean(f.address.trim().length>=8&&f.district.trim()),
    products:Boolean(items.length&&items.every(item=>item.product.trim())),
    assignment:Boolean(f.assignee!=="Atanmamış")
  };

  function goNext(){
    setErr("");
    if(step===1&&!complete.customer){setErr("Müşteri adı ve telefonunu tamamla.");return}
    if(step===2&&!complete.address){setErr("Açık adres ve ilçeyi tamamla.");return}
    if(step===3&&!complete.products){setErr("En az bir ürün seç veya ürün adını yaz.");return}
    setStep(current=>Math.min(4,current+1));
  }
  function submit(e:FormEvent){
    e.preventDefault();
    setErr("");
    if(step<4){goNext();return}
    if(!complete.assignment){setErr("Teslimatı göndereceğin servis personelini seç.");return}
    const suffix=(Date.now().toString(36).slice(-3)+Math.random().toString(36).slice(2,4)).toUpperCase();
    onSave({
      orderNo:"YD-"+f.date.replaceAll("-","").slice(2)+"-"+suffix,
      customerName:f.name.trim(),phone:f.phone.trim(),secondaryPhone:f.secondaryPhone.trim()||undefined,
      address:f.address.trim(),district:f.district.trim(),city:f.city.trim(),date:f.date,timeWindow:f.time,
      assignee:f.assignee,assigneeInitials:initials(f.assignee),status:"assigned",priority:f.priority,notes:f.notes.trim()||undefined,
      items:items.map(item=>({id:id("i"),brand:item.brand,product:item.product.trim(),model:item.model.trim()||undefined,quantity:item.quantity,serviceRequired:item.service,installationRequired:item.install,takeBackOldProduct:item.old}))
    })
  }

  const stepInfo=[
    {n:1,title:"Müşteri",sub:"Kim?",ok:complete.customer,icon:<UserRound/>},
    {n:2,title:"Adres",sub:"Nereye?",ok:complete.address,icon:<MapPin/>},
    {n:3,title:"Ürün",sub:"Ne gidecek?",ok:complete.products,icon:<PackageSearch/>},
    {n:4,title:"Personel",sub:"Kim götürecek?",ok:complete.assignment,icon:<Truck/>}
  ];

  return <Modal onClose={onClose}><form onSubmit={submit} className="deliveryWizard">
    <div className="wizardHead">
      <div><small>YENİ TESLİMAT</small><h2>4 adımda teslimat oluştur</h2><p>Her adımda sadece gerekli bilgiyi gir. Son adımda personele bildirim gider.</p></div>
      <strong>{step}/4</strong>
    </div>

    <nav className="wizardSteps">
      {stepInfo.map(info=><button type="button" key={info.n} className={(step===info.n?"active ":"")+(info.ok?"done":"")} onClick={()=>{if(info.n<=step||stepInfo.slice(0,info.n-1).every(x=>x.ok)){setErr("");setStep(info.n)}}}>
        <i>{info.ok?<Check/>:info.icon}</i><span><b>{info.title}</b><small>{info.sub}</small></span>
      </button>)}
    </nav>

    <div className="wizardBody">
      {step===1?<section className="wizardPanel">
        <div className="wizardPanelTitle"><span>1</span><div><h3>Müşteri kim?</h3><p>Adı ve telefonu yeterli. Eski müşteriyse tek tıkla doldur.</p></div><button type="button" className="soft" onClick={()=>setCustomerOpen(v=>!v)}><Search/>Geçmiş müşteri</button></div>
        {customerOpen?<div className="customerSuggestions">{customerSuggestions.length?customerSuggestions.map(d=><button type="button" key={d.id} onClick={()=>chooseCustomer(d)}><i>{initials(d.customerName)}</i><p><b>{d.customerName}</b><small>{d.phone} • {d.district}</small></p><ChevronRight/></button>):<span>Uygun geçmiş müşteri bulunamadı.</span>}</div>:null}
        <div className="wizardFields three">
          <Field label="Müşteri adı soyadı *" v={f.name} set={v=>set("name",v)} placeholder="Örn. Ayşe Yılmaz"/>
          <Field label="Telefon *" v={f.phone} set={v=>set("phone",v)} placeholder="05xx xxx xx xx" inputMode="tel"/>
          <Field label="İkinci telefon" v={f.secondaryPhone} set={v=>set("secondaryPhone",v)} placeholder="Varsa"/>
        </div>
      </section>:null}

      {step===2?<section className="wizardPanel">
        <div className="wizardPanelTitle"><span>2</span><div><h3>Nereye gidecek?</h3><p>Servisçi bu adresi telefonda haritada görecek.</p></div></div>
        <div className="wizardFields two">
          <Field label="Açık adres *" v={f.address} set={v=>set("address",v)} placeholder="Mahalle, sokak, bina no, kat/daire..." wide/>
          <Field label="İlçe *" v={f.district} set={v=>set("district",v)} placeholder="İlçe"/>
          <Field label="Şehir" v={f.city} set={v=>set("city",v)} placeholder="İstanbul"/>
        </div>
        {f.address.trim().length>=6?<AddressMap address={f.address} district={f.district} city={f.city}/>:<div className="wizardHint"><MapPin/><b>Adres yazınca harita burada görünür.</b><span>Servisçi aynı konumu “Yol Tarifi” tuşuyla açar.</span></div>}
      </section>:null}

      {step===3?<section className="wizardPanel">
        <div className="wizardPanelTitle"><span>3</span><div><h3>Hangi ürün gidecek?</h3><p>Ürün türünü seç, model kodunu yaz. Birden fazla ürün ekleyebilirsin.</p></div><button type="button" className="soft" onClick={addItem}><Plus/>Ürün ekle</button></div>
        <div className="productBigChoices">{quickProducts.map(name=><button type="button" className={items[0]?.product===name?"on":""} key={name} onClick={()=>setItem(items[0].id,{product:name})}><WebIcon product={name} size={28} color="f00088"/><span>{name}</span></button>)}</div>
        <div className="wizardProducts">{items.map((item,index)=><article className="wizardProduct" key={item.id}>
          <div className="wizardProductHead"><div className="wizardProductIcon"><WebIcon product={item.product||"package"} size={34} color="f00088"/></div><div><small>ÜRÜN {index+1}</small><b>{item.product||"Ürün seçilmedi"}</b></div>{items.length>1?<button type="button" onClick={()=>removeItem(item.id)}><Trash2/>Sil</button>:null}</div>
          <div className="wizardFields product">
            <Select label="Marka" v={item.brand} set={v=>setItem(item.id,{brand:v})} opts={["ALTUS","BEKO","GRUNDIG","REGAL","HOOVER","PROFILO","KUMTEL","DİĞER"]}/>
            <Field label="Ürün türü *" v={item.product} set={v=>setItem(item.id,{product:v})} placeholder="Örn. Bulaşık Makinesi"/>
            <label className="catalogModelField"><span>Model / kod</span><input list={"catalog-"+item.id} value={item.model} placeholder="Örn. AL 413 P" onChange={e=>chooseCatalog(item.id,e.target.value)}/><datalist id={"catalog-"+item.id}>{catalogFor(item).map(row=><option value={row.model} key={row.id}>{row.productName}</option>)}</datalist></label>
            <label><span>Adet</span><input type="number" min="1" max="20" value={item.quantity} onChange={e=>setItem(item.id,{quantity:Math.max(1,Number(e.target.value)||1)})}/></label>
          </div>
          <div className="wizardOptions">
            <Opt t="Kurulum gerekli" on={item.install} set={v=>setItem(item.id,{install:v})}/>
            <Opt t="Servis gerekli" on={item.service} set={v=>setItem(item.id,{service:v})}/>
            <Opt t="Eski ürün geri alınacak" on={item.old} set={v=>setItem(item.id,{old:v})}/>
          </div>
        </article>)}</div>
      </section>:null}

      {step===4?<section className="wizardPanel">
        <div className="wizardPanelTitle"><span>4</span><div><h3>Kim götürecek?</h3><p>Personeli seç. Kaydedince görev doğrudan telefonuna gönderilir.</p></div></div>
        <div className="wizardAssignees">
          {staff.length?staff.map(person=><button type="button" key={person.id} className={f.assignee===person.name?"on":""} onClick={()=>set("assignee",person.name)}>
            <i>{initials(person.name)}</i><p><b>{person.name}</b><small>{person.phone||"Telefon yok"}</small><em className={person.userId?"ready":"waiting"}>{person.userId?"🔔 Bildirim hazır":"Hesap bağlantısı bekliyor"}</em></p>{f.assignee===person.name?<CheckCircle2/>:<ChevronRight/>}
          </button>):<div className="wizardNoStaff"><UserPlus/><b>Önce personel ekle</b><span>Servis personeli olmadan bildirim gönderilemez.</span></div>}
        </div>
        <div className="wizardFields three">
          <Field label="Teslim tarihi" v={f.date} set={v=>set("date",v)} type="date"/>
          <Select label="Saat aralığı" v={f.time} set={v=>set("time",v)} opts={["09:00 - 12:00","12:00 - 15:00","15:00 - 18:00","18:00 - 21:00"]}/>
          <Select label="Öncelik" v={f.priority} set={v=>set("priority",v)} opts={["normal","high","critical"]}/>
          <Field label="Mağaza notu" v={f.notes} set={v=>set("notes",v)} placeholder="Örn. Eski ürün geri alınacak; önce müşteri aranacak." wide/>
        </div>
        <div className="wizardSummary">
          <span><UserRound/><p><small>MÜŞTERİ</small><b>{f.name}</b><em>{f.phone}</em></p></span>
          <span><PackageCheck/><p><small>ÜRÜN</small><b>{items.map(x=>[x.product,x.model].filter(Boolean).join(" ")).join(", ")}</b><em>{items.reduce((n,x)=>n+x.quantity,0)} adet</em></p></span>
          <span><MapPin/><p><small>ADRES</small><b>{f.district}, {f.city}</b><em>{f.address}</em></p></span>
          <span><Bell/><p><small>BİLDİRİM</small><b>{f.assignee}</b><em>{f.assignee==="Atanmamış"?"Personel seç":"Kaydedince gönderilir"}</em></p></span>
        </div>
      </section>:null}
    </div>

    {err?<div className="wizardError"><AlertTriangle/>{err}</div>:null}
    <div className="wizardFooter">
      <button type="button" className="soft" onClick={()=>step===1?onClose():setStep(s=>Math.max(1,s-1))}>{step===1?"Vazgeç":"← Geri"}</button>
      {step<4?<button type="submit" className="primary wizardNext">Devam et <ChevronRight/></button>:<button type="submit" className="primary wizardSave" disabled={!complete.assignment}><Bell/><span><b>KAYDET VE PERSONELE GÖNDER</b><small>Görev bildirimi anında iletilir</small></span></button>}
    </div>
  </form></Modal>
}
function NewStaff({onClose,onSave}:{onClose:()=>void;onSave:(s:{name:string;phone:string;email:string;password:string})=>void}){
  const [name,setName]=useState("");
  const [phone,setPhone]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [show,setShow]=useState(false);
  const valid=name.trim().length>=3&&phone.replace(/\D/g,"").length>=10&&email.includes("@")&&password.length>=8;

  return <Modal onClose={onClose}><form className="staffCreate" onSubmit={e=>{e.preventDefault();if(valid)onSave({name:name.trim(),phone:phone.trim(),email:email.trim(),password})}}>
    <PageHead tag="SERVİS PERSONELİ" title="Personel + telefon hesabını birlikte oluştur" text="Bu hesap personelin telefonunda yaaTeslimat'a giriş yapması ve yeni görev bildirimlerini alması için kullanılacak."/>
    <div className="staffCreateGrid">
      <section>
        <div className="staffCreateTitle"><span>1</span><div><b>Personel bilgileri</b><small>Mağazada göreceğin ad ve telefon</small></div></div>
        <div className="form one">
          <Field label="Ad soyad *" v={name} set={setName} placeholder="Örn. Ahmet Yılmaz"/>
          <Field label="Telefon *" v={phone} set={setPhone} placeholder="05xx xxx xx xx" inputMode="tel"/>
        </div>
      </section>
      <section>
        <div className="staffCreateTitle"><span>2</span><div><b>Telefon giriş hesabı</b><small>Personel bu bilgilerle telefondan giriş yapacak</small></div></div>
        <div className="form one">
          <Field label="E-posta *" v={email} set={setEmail} placeholder="personel@magaza.com"/>
          <label><span>Geçici şifre *</span><div className="passwordField"><input type={show?"text":"password"} value={password} placeholder="En az 8 karakter" onChange={e=>setPassword(e.target.value)}/><button type="button" onClick={()=>setShow(v=>!v)}>{show?"Gizle":"Göster"}</button></div></label>
        </div>
      </section>
    </div>
    <div className="staffCreateInfo"><Bell/><div><b>Bildirim akışı</b><span>Hesap oluşturulur → personel telefonda giriş yapar → “Bildirimleri aç”a bir kez basar → mağazadan atanan yeni teslimatlar anında o telefona gönderilir.</span></div></div>
    <div className="modalActions"><button type="button" className="soft" onClick={onClose}>Vazgeç</button><button className="primary" disabled={!valid}><UserPlus/>Personeli ve hesabı oluştur</button></div>
  </form></Modal>
}

function AddressMap({address,district,city,compact=false}:{address:string;district:string;city:string;compact?:boolean}){
  const query=addressText(address,district,city);
  if(!query.trim())return null;
  return <div className={"addressMap "+(compact?"compact":"")}>
    <iframe title={"Harita: "+query} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={mapEmbed(address,district,city)}/>
    <a href={mapSearch(address,district,city)} target="_blank" rel="noreferrer"><ExternalLink/>Google Maps'te aç</a>
  </div>
}

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
            <a href={map(d)} target="_blank" rel="noreferrer"><Navigation size={14}/>Yol tarifi</a>
          </div>
          <AddressMap address={d.address} district={d.district} city={d.city} compact/>
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

