"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronRight, Clock3, MapPin,
  PackageCheck, Phone, Plus, Search, Truck, UserPlus, UsersRound
} from "lucide-react";
import type { Delivery } from "@/lib/types";

type StaffLite = { id:string; name:string; phone:string; userId?:string|null };
type Focus = "all" | "open" | "missing" | "done";

function localDay(date:Date){
  const offset=date.getTimezoneOffset()*60000;
  return new Date(date.getTime()-offset).toISOString().slice(0,10);
}
function initials(name:string){return name.split(" ").filter(Boolean).map(x=>x[0]).join("").slice(0,2).toUpperCase()}
function statusLabel(status:Delivery["status"]){
  return status==="new"?"Bekliyor":status==="assigned"?"Atandı":status==="seen"?"Görüldü":status==="on_route"?"Yolda":status==="completed"?"Teslim edildi":"Sorun";
}
function missingFields(delivery:Delivery){
  const missing:string[]=[];
  const digits=delivery.phone?.replace(/\D/g,"")||"";
  if(!delivery.customerName?.trim())missing.push("müşteri");
  if(digits.length<10)missing.push("telefon");
  if(!delivery.address?.trim())missing.push("adres");
  if(!delivery.district?.trim())missing.push("ilçe");
  if(!delivery.items?.length || delivery.items.some(i=>!i.product?.trim()))missing.push("ürün");
  if(!delivery.assignee || delivery.assignee==="Atanmamış")missing.push("personel");
  return missing;
}
function productText(delivery:Delivery){
  if(!delivery.items?.length)return "Ürün girilmedi";
  return delivery.items.map(item=>[item.brand,item.product,item.model].filter(Boolean).join(" ")+(item.quantity>1?` ×${item.quantity}`:"")).join(" • ");
}

export default function OperationsCenter({
  deliveries,staff,cloud,onNew,onStaff,onOpen,onAssign
}:{
  deliveries:Delivery[];
  staff:StaffLite[];
  cloud:boolean;
  onNew:()=>void;
  onStaff:()=>void;
  onOpen:(delivery:Delivery)=>void;
  onAssign:(delivery:Delivery,staff:StaffLite|null)=>void;
}){
  const [now,setNow]=useState(()=>new Date());
  const [focus,setFocus]=useState<Focus>("all");
  const [search,setSearch]=useState("");

  useEffect(()=>{
    const timer=window.setInterval(()=>setNow(new Date()),60000);
    return()=>window.clearInterval(timer);
  },[]);

  const today=localDay(now);
  const todays=useMemo(()=>deliveries.filter(d=>d.date===today),[deliveries,today]);
  const open=todays.filter(d=>!["completed","issue"].includes(d.status));
  const missing=todays.filter(d=>missingFields(d).length>0&&!["completed","issue"].includes(d.status));
  const done=todays.filter(d=>d.status==="completed");
  const issues=todays.filter(d=>d.status==="issue");

  const visible=todays.filter(d=>{
    if(focus==="open"&&["completed","issue"].includes(d.status))return false;
    if(focus==="missing"&&!(missingFields(d).length>0&&!["completed","issue"].includes(d.status)))return false;
    if(focus==="done"&&d.status!=="completed")return false;
    const q=search.trim().toLocaleLowerCase("tr-TR");
    if(!q)return true;
    const hay=[d.customerName,d.phone,d.secondaryPhone,d.address,d.district,d.assignee,productText(d),d.orderNo].filter(Boolean).join(" ").toLocaleLowerCase("tr-TR");
    return hay.includes(q);
  }).sort((a,b)=>(a.timeWindow||"").localeCompare(b.timeWindow||""));

  return <div className="storeDesk">
    <section className="storeWelcome">
      <div>
        <span className="eyebrow">MAĞAZA TESLİMAT TAKİBİ</span>
        <h2>Bugünün teslimatları tek ekranda.</h2>
        <p>İsim, telefon, ürün, adres ve servis notunu eksiksiz gir. Personel aynı kaydı telefondan görsün; kağıt listesi karışmasın.</p>
      </div>
      <div className="storeWelcomeActions">
        <button className="primary" onClick={onNew}><Plus size={18}/>Yeni teslimat</button>
        <button className="soft" onClick={onStaff}><UserPlus size={17}/>Personel ekle</button>
      </div>
    </section>

    <section className="storeStats">
      <Stat icon={<PackageCheck/>} value={todays.length} label="Bugün toplam"/>
      <Stat icon={<Clock3/>} value={open.length} label="Bekleyen iş"/>
      <Stat icon={<AlertTriangle/>} value={missing.length} label="Eksik / atanmamış" tone={missing.length?"warn":""}/>
      <Stat icon={<CheckCircle2/>} value={done.length} label="Teslim edildi" tone="ok"/>
      <Stat icon={<AlertTriangle/>} value={issues.length} label="Sorunlu" tone={issues.length?"danger":""}/>
    </section>

    <section className="storeBoard">
      <div className="storeBoardHead">
        <div>
          <span>GÜNLÜK LİSTE</span>
          <h3>{new Intl.DateTimeFormat("tr-TR",{weekday:"long",day:"2-digit",month:"long"}).format(now)}</h3>
        </div>
        <div className="storeSync"><i className={cloud?"live":""}/>{cloud?"Canlı senkron":"Yerel mod"}</div>
      </div>

      <div className="storeBoardTools">
        <label><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Müşteri, telefon, ürün veya adres ara"/></label>
        <div className="storeFilters">
          <button className={focus==="all"?"on":""} onClick={()=>setFocus("all")}>Tümü <b>{todays.length}</b></button>
          <button className={focus==="open"?"on":""} onClick={()=>setFocus("open")}>Bekleyen <b>{open.length}</b></button>
          <button className={focus==="missing"?"on warn":""} onClick={()=>setFocus("missing")}>Eksik <b>{missing.length}</b></button>
          <button className={focus==="done"?"on":""} onClick={()=>setFocus("done")}>Tamamlanan <b>{done.length}</b></button>
        </div>
      </div>

      <div className="deliveryTable">
        <div className="deliveryTableHeader">
          <span>Durum</span><span>Müşteri</span><span>Ürün / işlem</span><span>Adres</span><span>Personel</span><span></span>
        </div>
        {visible.length?visible.map(d=><DeliveryLine key={d.id} delivery={d} staff={staff} onOpen={onOpen} onAssign={onAssign}/>):(
          <div className="storeEmpty"><CheckCircle2/><b>Gösterilecek teslimat yok.</b><span>Yeni kayıt eklediğinde burada görünecek.</span></div>
        )}
      </div>
    </section>

    <section className="storeCrew">
      <div><span>PERSONEL DURUMU</span><h3>Servis / sevkiyat ekibi</h3></div>
      <div className="crewCards">
        {staff.length?staff.map(person=>{
          const count=open.filter(d=>d.assignee===person.name).length;
          return <button key={person.id} onClick={()=>setSearch(person.name)}>
            <span>{initials(person.name)}</span><p><b>{person.name}</b><small>{count} açık görev</small></p><em>{person.userId?"CANLI":"KAYITLI"}</em>
          </button>
        }):<button className="addCrew" onClick={onStaff}><UserPlus/><p><b>Personel ekle</b><small>Teslimat atamak için</small></p></button>}
      </div>
    </section>
  </div>;
}

function Stat({icon,value,label,tone=""}:{icon:ReactNode;value:number;label:string;tone?:string}){
  return <div className={"storeStat "+tone}><span>{icon}</span><p><b>{value}</b><small>{label}</small></p></div>;
}

function DeliveryLine({delivery,staff,onOpen,onAssign}:{delivery:Delivery;staff:StaffLite[];onOpen:(d:Delivery)=>void;onAssign:(d:Delivery,s:StaffLite|null)=>void}){
  const missing=missingFields(delivery);
  const flags=delivery.items.flatMap(i=>[
    i.serviceRequired?"Servis":null,
    i.installationRequired?"Kurulum":null,
    i.takeBackOldProduct?"Eski ürün alınacak":null
  ]).filter(Boolean) as string[];

  return <article className={"deliveryLine "+(missing.length?"needsAttention":"")}>
    <button className="deliveryStatusCell" onClick={()=>onOpen(delivery)}>
      <span className={"status s-"+delivery.status}>{statusLabel(delivery.status)}</span>
      <small>{delivery.timeWindow||"Saat yok"}</small>
      {missing.length?<i>{missing.length} eksik</i>:null}
    </button>

    <button className="deliveryCustomerCell" onClick={()=>onOpen(delivery)}>
      <b>{delivery.customerName||"İsimsiz müşteri"}</b>
      <span><Phone size={13}/>{delivery.phone||"Telefon yok"}</span>
      {delivery.secondaryPhone?<small>2. tel: {delivery.secondaryPhone}</small>:null}
    </button>

    <button className="deliveryProductCell" onClick={()=>onOpen(delivery)}>
      <b>{productText(delivery)}</b>
      <div>{flags.length?flags.map(flag=><span key={flag}>{flag}</span>):<span className="mutedTag">Standart teslimat</span>}</div>
      {delivery.notes?<small>{delivery.notes}</small>:null}
    </button>

    <button className="deliveryAddressCell" onClick={()=>onOpen(delivery)}>
      <b>{delivery.address||"Adres girilmedi"}</b>
      <span><MapPin size={13}/>{delivery.district||"İlçe yok"}{delivery.city?", "+delivery.city:""}</span>
    </button>

    <div className="deliveryAssigneeCell">
      <select value={delivery.assignee||"Atanmamış"} onChange={e=>{const value=e.target.value;onAssign(delivery,value==="Atanmamış"?null:(staff.find(s=>s.name===value)||null));}}>
        <option>Atanmamış</option>
        {staff.map(person=><option key={person.id}>{person.name}</option>)}
      </select>
      <span><Truck size={13}/>{delivery.assignee||"Atanmamış"}</span>
    </div>

    <button className="deliveryOpen" aria-label="Teslimat detayını aç" onClick={()=>onOpen(delivery)}><ChevronRight/></button>
  </article>;
}
