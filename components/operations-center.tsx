"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle, BellRing, CheckCircle2, ChevronRight, Clock3, MapPin,
  PackageCheck, Phone, Plus, Route, ShieldAlert, Truck, UserPlus, UsersRound
} from "lucide-react";
import type { Delivery } from "@/lib/types";
import WebIcon from "./web-icon";

type StaffLite = { id:string; name:string; phone:string; userId?:string|null };
type Focus = "all" | "overdue" | "unseen" | "missing";

function localDay(date:Date){
  const offset=date.getTimezoneOffset()*60000;
  return new Date(date.getTime()-offset).toISOString().slice(0,10);
}

function endOfWindow(delivery:Delivery){
  const match=delivery.timeWindow?.match(/(\d{1,2}):(\d{2})\s*$/);
  if(!match)return null;
  const [year,month,day]=delivery.date.split("-").map(Number);
  return new Date(year,month-1,day,Number(match[1]),Number(match[2]),0,0);
}

function isOverdue(delivery:Delivery, now:Date){
  if(["completed","issue"].includes(delivery.status))return false;
  const today=localDay(now);
  if(delivery.date<today)return true;
  if(delivery.date>today)return false;
  const end=endOfWindow(delivery);
  return Boolean(end && end.getTime()<now.getTime());
}

function isUnseen(delivery:Delivery, now:Date){
  if(delivery.status!=="assigned")return false;
  const stamp=new Date(delivery.updatedAt || delivery.createdAt).getTime();
  return Number.isFinite(stamp) && now.getTime()-stamp > 15*60*1000;
}

function missingFields(delivery:Delivery){
  const missing:string[]=[];
  const digits=delivery.phone?.replace(/\D/g,"")||"";
  if(!delivery.customerName?.trim())missing.push("müşteri");
  if(digits.length<10)missing.push("telefon");
  if(!delivery.address?.trim())missing.push("adres");
  if(!delivery.district?.trim())missing.push("ilçe");
  if(!delivery.items?.length || !delivery.items[0]?.product?.trim())missing.push("ürün");
  if(!delivery.assignee || delivery.assignee==="Atanmamış")missing.push("personel");
  return missing;
}

function initials(name:string){
  return name.split(" ").filter(Boolean).map(x=>x[0]).join("").slice(0,2).toUpperCase();
}

function statusLabel(status:Delivery["status"]){
  return status==="new"?"Yeni":status==="assigned"?"Atandı":status==="seen"?"Görüldü":status==="on_route"?"Yolda":status==="completed"?"Tamamlandı":"Sorun";
}

function statusTone(status:Delivery["status"]){
  return status==="completed"?"done":status==="on_route"?"route":status==="issue"?"problem":status==="seen"?"seen":"wait";
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
  const [dragId,setDragId]=useState<string|null>(null);

  useEffect(()=>{
    const timer=window.setInterval(()=>setNow(new Date()),60000);
    return()=>window.clearInterval(timer);
  },[]);

  const today=localDay(now);
  const operational=useMemo(
    ()=>deliveries.filter(d=>d.date===today || isOverdue(d,now)),
    [deliveries,today,now]
  );

  const overdue=operational.filter(d=>isOverdue(d,now));
  const unseen=operational.filter(d=>isUnseen(d,now));
  const missing=operational.filter(d=>missingFields(d).length>0 && !["completed","issue"].includes(d.status));
  const completed=operational.filter(d=>d.date===today&&d.status==="completed");
  const onRoute=operational.filter(d=>d.status==="on_route");
  const active=operational.filter(d=>!["completed","issue"].includes(d.status));

  const visible=operational
    .filter(d=>{
      if(focus==="overdue")return isOverdue(d,now);
      if(focus==="unseen")return isUnseen(d,now);
      if(focus==="missing")return missingFields(d).length>0 && !["completed","issue"].includes(d.status);
      return true;
    })
    .sort((a,b)=>{
      const ao=isOverdue(a,now)?0:1;
      const bo=isOverdue(b,now)?0:1;
      if(ao!==bo)return ao-bo;
      return (a.date+a.timeWindow).localeCompare(b.date+b.timeWindow);
    });

  function dropTo(person:StaffLite|null){
    if(!dragId)return;
    const delivery=deliveries.find(d=>d.id===dragId);
    if(delivery)onAssign(delivery,person);
    setDragId(null);
  }

  return <div className="dispatchDesk">
    <section className="dispatchSummary">
      <div className="summaryLead">
        <span className="summaryKicker">BUGÜN / OPERASYON</span>
        <div className="summaryTitleRow">
          <div>
            <h2>{active.length} aktif iş sahada bekliyor.</h2>
            <p>Gecikmeleri, atamaları ve teslimat kapanışlarını tek iş akışında yönet.</p>
          </div>
          <div className="summaryActions">
            <button className="primary" onClick={onNew}><Plus/>Teslimat ekle</button>
            <button className="soft" onClick={onStaff}><UserPlus/>Personel</button>
          </div>
        </div>
        <div className="summaryMeta">
          <span><i className={cloud?"live":""}/>{cloud?"Canlı senkron":"Yerel mod"}</span>
          <span><Clock3/>{new Intl.DateTimeFormat("tr-TR",{hour:"2-digit",minute:"2-digit"}).format(now)}</span>
        </div>
      </div>

      <div className="summaryStats">
        <SummaryStat label="Toplam iş" value={operational.length} icon={<PackageCheck/>}/>
        <SummaryStat label="Yolda" value={onRoute.length} icon={<Route/>}/>
        <SummaryStat label="Tamamlandı" value={completed.length} icon={<CheckCircle2/>}/>
        <SummaryStat label="Sorun" value={operational.filter(d=>d.status==="issue").length} icon={<AlertTriangle/>}/>
      </div>
    </section>

    <section className="dispatchToolbar">
      <div className="toolbarFilters">
        <button className={focus==="all"?"on":""} onClick={()=>setFocus("all")}>Tümü <b>{operational.length}</b></button>
        <button className={focus==="overdue"?"on danger":""} onClick={()=>setFocus("overdue")}>Geciken <b>{overdue.length}</b></button>
        <button className={focus==="unseen"?"on warning":""} onClick={()=>setFocus("unseen")}>Görülmedi <b>{unseen.length}</b></button>
        <button className={focus==="missing"?"on warning":""} onClick={()=>setFocus("missing")}>Eksik bilgi <b>{missing.length}</b></button>
      </div>
      <div className="toolbarLegend">
        <span><i className="wait"/>Bekliyor</span>
        <span><i className="route"/>Yolda</span>
        <span><i className="done"/>Tamamlandı</span>
        <span><i className="problem"/>Sorun</span>
      </div>
    </section>

    <div className="dispatchGrid">
      <section className="dispatchQueue">
        <div className="dispatchQueueHead">
          <div>
            <span>AKTİF AKIŞ</span>
            <h3>Teslimat listesi</h3>
          </div>
          <b>{visible.length} kayıt</b>
        </div>

        <div className="dispatchRows">
          {visible.length ? visible.map(delivery=>
            <DispatchRow
              key={delivery.id}
              delivery={delivery}
              now={now}
              staff={staff}
              onOpen={onOpen}
              onAssign={onAssign}
              onDragStart={setDragId}
            />
          ) : <div className="dispatchEmpty"><CheckCircle2/><b>Bu görünüm temiz</b><span>Seçili filtre için gösterilecek teslimat yok.</span></div>}
        </div>
      </section>

      <aside className="dispatchSide">
        <section className="signalPanel">
          <div className="sidePanelHead"><span>RİSK RADARI</span><b>Öncelik</b></div>
          <SignalRow icon={<Clock3/>} tone="danger" title="Geciken" text="Planlanan süre aşıldı" value={overdue.length} onClick={()=>setFocus("overdue")}/>
          <SignalRow icon={<BellRing/>} tone="warning" title="Görülmedi" text="15 dakikadır yanıt yok" value={unseen.length} onClick={()=>setFocus("unseen")}/>
          <SignalRow icon={<ShieldAlert/>} tone="warning" title="Eksik bilgi" text="Adres, telefon veya atama" value={missing.length} onClick={()=>setFocus("missing")}/>
        </section>

        <section className="crewPanel">
          <div className="sidePanelHead"><span>SAHA EKİBİ</span><b>{staff.length} kişi</b></div>
          <button className="crewDrop unassigned" onDragOver={e=>e.preventDefault()} onDrop={()=>dropTo(null)}>
            <span>?</span><p><b>Atanmamış havuz</b><small>Kartı buraya bırak</small></p>
          </button>
          {staff.map(person=><button key={person.id} className="crewDrop" onDragOver={e=>e.preventDefault()} onDrop={()=>dropTo(person)}>
            <span>{initials(person.name)}</span>
            <p><b>{person.name}</b><small>{operational.filter(d=>d.assignee===person.name&&!["completed","issue"].includes(d.status)).length} aktif görev</small></p>
            <em>{person.userId?"CANLI":"YEREL"}</em>
          </button>)}
          {!staff.length?<button className="crewAdd" onClick={onStaff}><UserPlus/><span>Personel ekle</span></button>:null}
        </section>
      </aside>
    </div>
  </div>;
}

function SummaryStat({label,value,icon}:{label:string;value:number;icon:ReactNode}){
  return <div className="summaryStat"><span>{icon}</span><p><b>{value}</b><small>{label}</small></p></div>;
}

function SignalRow({icon,tone,title,text,value,onClick}:{icon:ReactNode;tone:string;title:string;text:string;value:number;onClick:()=>void}){
  return <button className={"signalRow "+tone} onClick={onClick}><span>{icon}</span><p><b>{title}</b><small>{text}</small></p><strong>{value}</strong></button>;
}

function DispatchRow({
  delivery,now,staff,onOpen,onAssign,onDragStart
}:{
  delivery:Delivery;now:Date;staff:StaffLite[];
  onOpen:(delivery:Delivery)=>void;
  onAssign:(delivery:Delivery,staff:StaffLite|null)=>void;
  onDragStart:(id:string)=>void;
}){
  const item=delivery.items?.[0];
  const missing=missingFields(delivery);
  const overdue=isOverdue(delivery,now);
  const unseen=isUnseen(delivery,now);
  const done=Object.values(delivery.checklist).filter(Boolean).length;

  return <article
    className={"dispatchRow "+(overdue?"isOverdue ":"")+(unseen?"isUnseen ":"")+(missing.length?"hasMissing":"")}
    draggable
    onDragStart={e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",delivery.id);onDragStart(delivery.id)}}
  >
    <div className="rowTime">
      <time>{delivery.timeWindow.split("-")[0]?.trim()||delivery.timeWindow}</time>
      <span>{delivery.date===localDay(now)?"Bugün":delivery.date}</span>
    </div>

    <div className="rowMain" onClick={()=>onOpen(delivery)}>
      <div className="rowIdentity">
        <div className="rowStatusLine">
          <span className={"rowStatus "+statusTone(delivery.status)}>{statusLabel(delivery.status)}</span>
          <small>{delivery.orderNo}</small>
          {overdue?<i className="risk danger">Gecikti</i>:null}
          {unseen?<i className="risk warning">Görülmedi</i>:null}
          {missing.length?<i className="risk warning">{missing.length} eksik</i>:null}
        </div>
        <h4>{delivery.customerName||"İsimsiz müşteri"}</h4>
        <p><span><MapPin/>{delivery.district||"İlçe yok"}</span><span><Phone/>{delivery.phone||"Telefon yok"}</span></p>
      </div>

      <div className="rowProduct">
        <span><WebIcon product={item?.product||""} size={28}/></span>
        <p><small>{item?.brand||"ÜRÜN"}</small><b>{item?.product||"Ürün bilgisi eksik"}</b><em>{item?.model||"Model belirtilmedi"}</em></p>
      </div>

      <div className="rowCheck">
        <p><span>Kontrol</span><b>{done}/6</b></p>
        <i><em style={{width:(done/6*100)+"%"}}/></i>
      </div>
    </div>

    <div className="rowAssign">
      <span>{delivery.assignee==="Atanmamış"?"?":initials(delivery.assignee)}</span>
      <select value={delivery.assignee||"Atanmamış"} onChange={e=>{const value=e.target.value;onAssign(delivery,value==="Atanmamış"?null:(staff.find(s=>s.name===value)||null));}}>
        <option>Atanmamış</option>
        {staff.map(person=><option key={person.id}>{person.name}</option>)}
      </select>
    </div>

    <button className="rowOpen" aria-label={delivery.customerName+" detayını aç"} onClick={()=>onOpen(delivery)}><ChevronRight/></button>
  </article>;
}
