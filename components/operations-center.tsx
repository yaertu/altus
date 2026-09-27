"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronRight, Clock3, MapPin,
  PackageCheck, Phone, Plus, Search, Truck, UserPlus
} from "lucide-react";
import type { Delivery } from "@/lib/types";

type StaffLite = { id:string; name:string; phone:string; userId?:string|null };
type Focus = "all" | "open" | "overdue" | "missing" | "done";

function localDay(date:Date){
  const offset=date.getTimezoneOffset()*60000;
  return new Date(date.getTime()-offset).toISOString().slice(0,10);
}
function statusLabel(status:Delivery["status"]){
  return status==="new"?"Bekliyor":status==="assigned"?"Atandı":status==="seen"?"Görüldü":status==="on_route"?"Yolda":status==="completed"?"Teslim edildi":"Sorun";
}
function missingFields(delivery:Delivery){
  const missing:string[]=[];
  const digits=delivery.phone?.replace(/\D/g,"")||"";
  if(!delivery.customerName?.trim())missing.push("Müşteri");
  if(digits.length<10)missing.push("Telefon");
  if(!delivery.address?.trim())missing.push("Adres");
  if(!delivery.district?.trim())missing.push("İlçe");
  if(!delivery.items?.length || delivery.items.some(i=>!i.product?.trim()))missing.push("Ürün");
  if(!delivery.assignee || delivery.assignee==="Atanmamış")missing.push("Personel");
  return missing;
}
function productText(delivery:Delivery){
  if(!delivery.items?.length)return "Ürün girilmedi";
  return delivery.items.map(item=>[item.brand,item.product,item.model].filter(Boolean).join(" ")+(item.quantity>1?" ×"+item.quantity:"")).join(" • ");
}
function workFlags(delivery:Delivery){
  const flags=delivery.items.flatMap(item=>[
    item.serviceRequired?"Servis":null,
    item.installationRequired?"Kurulum":null,
    item.takeBackOldProduct?"Eski ürün alınacak":null
  ]).filter(Boolean) as string[];
  return flags.length?flags:["Standart teslimat"];
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
  const carryover=useMemo(()=>deliveries.filter(d=>d.date<today&&!["completed","issue"].includes(d.status)),[deliveries,today]);
  const queue=useMemo(()=>[...carryover,...todays],[carryover,todays]);
  const open=queue.filter(d=>!["completed","issue"].includes(d.status));
  const overdue=carryover;
  const missing=queue.filter(d=>missingFields(d).length>0&&!["completed","issue"].includes(d.status));
  const done=todays.filter(d=>d.status==="completed");

  const visible=queue.filter(d=>{
    if(focus==="open"&&["completed","issue"].includes(d.status))return false;
    if(focus==="overdue"&&!(d.date<today&&!["completed","issue"].includes(d.status)))return false;
    if(focus==="missing"&&!(missingFields(d).length>0&&!["completed","issue"].includes(d.status)))return false;
    if(focus==="done"&&d.status!=="completed")return false;
    const q=search.trim().toLocaleLowerCase("tr-TR");
    if(!q)return true;
    const hay=[
      d.customerName,d.phone,d.secondaryPhone,d.address,d.district,d.city,
      d.assignee,productText(d),d.orderNo,d.notes
    ].filter(Boolean).join(" ").toLocaleLowerCase("tr-TR");
    return hay.includes(q);
  }).sort((a,b)=>{
    const dateCompare=a.date.localeCompare(b.date);
    if(dateCompare!==0)return dateCompare;
    return (a.timeWindow||"").localeCompare(b.timeWindow||"");
  });

  return <div className="sheetDesk">
    <section className="sheetHeader">
      <div>
        <span className="sheetEyebrow">MAĞAZA TESLİMAT LİSTESİ</span>
        <h2>Günlük teslimat çizelgesi</h2>
        <p>Müşteri, telefon, ürün, adres, işlem ve personel bilgileri tek tabloda. Eksik alanlar satır üzerinde uyarı verir.</p>
      </div>
      <div className="sheetHeaderActions">
        <button className="soft" onClick={onStaff}><UserPlus/>Personel</button>
        <button className="primary" onClick={onNew}><Plus/>Yeni teslimat</button>
      </div>
    </section>

    <section className="sheetSummary">
      <Summary icon={<PackageCheck/>} value={queue.length} label="Listede"/>
      <Summary icon={<Clock3/>} value={open.length} label="Açık iş"/>
      <Summary icon={<AlertTriangle/>} value={overdue.length} label="Dünden kalan" tone="danger"/>
      <Summary icon={<AlertTriangle/>} value={missing.length} label="Eksik bilgi" tone="warn"/>
      <Summary icon={<CheckCircle2/>} value={done.length} label="Bugün tamamlanan" tone="ok"/>
      <div className="sheetSync"><i className={cloud?"live":""}/><span>{cloud?"Canlı senkron":"Yerel mod"}</span></div>
    </section>

    <section className="sheetPanel">
      <div className="sheetToolbar">
        <label className="sheetSearch">
          <Search/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Müşteri, telefon, ürün, adres, personel veya not ara"/>
        </label>
        <div className="sheetFilters">
          <button className={focus==="all"?"on":""} onClick={()=>setFocus("all")}>Tümü <b>{queue.length}</b></button>
          <button className={focus==="open"?"on":""} onClick={()=>setFocus("open")}>Açık <b>{open.length}</b></button>
          <button className={focus==="overdue"?"on danger":""} onClick={()=>setFocus("overdue")}>Dünden kalan <b>{overdue.length}</b></button>
          <button className={focus==="missing"?"on warn":""} onClick={()=>setFocus("missing")}>Eksik <b>{missing.length}</b></button>
          <button className={focus==="done"?"on ok":""} onClick={()=>setFocus("done")}>Tamamlanan <b>{done.length}</b></button>
        </div>
      </div>

      <div className="sheetDatebar">
        <div><b>{new Intl.DateTimeFormat("tr-TR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(now)}</b><span>{visible.length} kayıt gösteriliyor</span></div>
        <small>Satıra tıklayarak tüm teslimat detayını açabilirsin.</small>
      </div>

      <div className="sheetGridScroll">
        <div className="sheetGrid" role="table" aria-label="Teslimat çizelgesi">
          <div className="sheetHead" role="row">
            <span className="colNo">#</span>
            <span className="colStatus">DURUM / SAAT</span>
            <span className="colCustomer">MÜŞTERİ</span>
            <span className="colPhone">TELEFON</span>
            <span className="colProduct">ÜRÜN</span>
            <span className="colWork">YAPILACAK İŞ</span>
            <span className="colAddress">ADRES</span>
            <span className="colStaff">PERSONEL</span>
            <span className="colNote">MAĞAZA NOTU</span>
            <span className="colAlert">EKSİK / UYARI</span>
            <span className="colOpen"></span>
          </div>

          {visible.length?visible.map((delivery,index)=>
            <SheetRow
              key={delivery.id}
              index={index+1}
              delivery={delivery}
              staff={staff}
              onOpen={onOpen}
              onAssign={onAssign}
            />
          ):<div className="sheetEmpty">
            <CheckCircle2/>
            <b>Bu filtrede teslimat yok.</b>
            <span>Yeni kayıt ekleyebilir veya filtreyi değiştirebilirsin.</span>
          </div>}
        </div>
      </div>
    </section>
  </div>;
}

function Summary({icon,value,label,tone=""}:{icon:ReactNode;value:number;label:string;tone?:string}){
  return <div className={"sheetSummaryItem "+tone}><span>{icon}</span><p><b>{value}</b><small>{label}</small></p></div>;
}

function SheetRow({
  index,delivery,staff,onOpen,onAssign
}:{
  index:number;
  delivery:Delivery;
  staff:StaffLite[];
  onOpen:(d:Delivery)=>void;
  onAssign:(d:Delivery,s:StaffLite|null)=>void;
}){
  const missing=missingFields(delivery);
  const overdue=delivery.date<localDay(new Date())&&!["completed","issue"].includes(delivery.status);
  const flags=workFlags(delivery);

  return <article
    className={"sheetRow "+(missing.length?"hasMissing ":"")+(overdue?"isOverdue ":"")+(delivery.status==="completed"?"isDone":"")}
    role="row"
  >
    <button className="sheetCell colNo" data-label="#" onClick={()=>onOpen(delivery)}><b>{index}</b></button>

    <button className="sheetCell colStatus" data-label="Durum / Saat" onClick={()=>onOpen(delivery)}>
      <span className={"status s-"+delivery.status}>{statusLabel(delivery.status)}</span>
      <b>{delivery.timeWindow||"Saat yok"}</b>
      <small>{overdue?delivery.date:delivery.orderNo}</small>
    </button>

    <button className="sheetCell colCustomer" data-label="Müşteri" onClick={()=>onOpen(delivery)}>
      <b>{delivery.customerName||"İsimsiz müşteri"}</b>
      <small>{delivery.orderNo}</small>
    </button>

    <a className="sheetCell colPhone" data-label="Telefon" href={"tel:"+delivery.phone.replace(/[^\d+]/g,"")}>
      <Phone/>
      <b>{delivery.phone||"Telefon yok"}</b>
      {delivery.secondaryPhone?<small>{delivery.secondaryPhone}</small>:null}
    </a>

    <button className="sheetCell colProduct" data-label="Ürün" onClick={()=>onOpen(delivery)}>
      <b>{productText(delivery)}</b>
      <small>{delivery.items.reduce((sum,item)=>sum+(item.quantity||1),0)} ürün/adet</small>
    </button>

    <button className="sheetCell colWork" data-label="Yapılacak İş" onClick={()=>onOpen(delivery)}>
      <div className="sheetTags">{flags.map(flag=><span key={flag}>{flag}</span>)}</div>
    </button>

    <button className="sheetCell colAddress" data-label="Adres" onClick={()=>onOpen(delivery)}>
      <b>{delivery.address||"Adres girilmedi"}</b>
      <small><MapPin/>{delivery.district||"İlçe yok"}{delivery.city?", "+delivery.city:""}</small>
    </button>

    <div className="sheetCell colStaff" data-label="Personel">
      <select value={delivery.assignee||"Atanmamış"} onChange={e=>{
        const value=e.target.value;
        onAssign(delivery,value==="Atanmamış"?null:(staff.find(s=>s.name===value)||null));
      }}>
        <option>Atanmamış</option>
        {staff.map(person=><option key={person.id}>{person.name}</option>)}
      </select>
      <small><Truck/>{delivery.assignee||"Atanmamış"}</small>
    </div>

    <button className="sheetCell colNote" data-label="Mağaza Notu" onClick={()=>onOpen(delivery)}>
      {delivery.notes?<b>{delivery.notes}</b>:<span className="sheetMuted">Not yok</span>}
    </button>

    <button className="sheetCell colAlert" data-label="Eksik / Uyarı" onClick={()=>onOpen(delivery)}>
      {overdue?<span className="sheetAlert danger">Dünden kaldı</span>:null}
      {missing.length?missing.map(item=><span className="sheetAlert warn" key={item}>{item} eksik</span>):!overdue?<span className="sheetAlert ok">Eksik yok</span>:null}
    </button>

    <button className="sheetCell colOpen sheetOpen" aria-label="Teslimat detayını aç" onClick={()=>onOpen(delivery)}>
      <ChevronRight/>
    </button>
  </article>;
}
