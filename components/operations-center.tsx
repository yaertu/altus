"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, BellRing, CheckCircle2, Clock3, GripVertical, MapPin,
  PackageCheck, Phone, Plus, Route, ShieldAlert, Truck, UserCheck,
  UserPlus, UsersRound
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
  if(!delivery.customerName?.trim())missing.push("müşteri");
  if(!delivery.phone?.replace(/\D/g,"") || delivery.phone.replace(/\D/g,"").length<10)missing.push("telefon");
  if(!delivery.address?.trim())missing.push("adres");
  if(!delivery.district?.trim())missing.push("ilçe");
  if(!delivery.items?.length || !delivery.items[0]?.product?.trim())missing.push("ürün");
  if(!delivery.assignee || delivery.assignee==="Atanmamış")missing.push("personel");
  return missing;
}

function initials(name:string){
  return name.split(" ").filter(Boolean).map(x=>x[0]).join("").slice(0,2).toUpperCase();
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

  const visible=operational.filter(d=>{
    if(focus==="overdue")return isOverdue(d,now);
    if(focus==="unseen")return isUnseen(d,now);
    if(focus==="missing")return missingFields(d).length>0 && !["completed","issue"].includes(d.status);
    return true;
  });

  const waiting=visible.filter(d=>["new","assigned","seen"].includes(d.status));
  const onRoute=visible.filter(d=>d.status==="on_route");
  const done=visible.filter(d=>d.status==="completed");
  const issues=visible.filter(d=>d.status==="issue");

  function dropTo(staffMember:StaffLite|null){
    if(!dragId)return;
    const delivery=deliveries.find(d=>d.id===dragId);
    if(delivery)onAssign(delivery,staffMember);
    setDragId(null);
  }

  return <div className="operationsCenter">
    <section className="commandHero">
      <div className="commandCopy">
        <div className="commandTopline">
          <span><i/>{cloud?"CANLI OPERASYON MERKEZİ":"YEREL OPERASYON MERKEZİ"}</span>
          <b>{new Intl.DateTimeFormat("tr-TR",{hour:"2-digit",minute:"2-digit"}).format(now)}</b>
        </div>
        <h2>Bugün ne kaldı, kim gördü, kim yolda?</h2>
        <p>Geciken işler ve eksik bilgiler yukarı çıkar. Kartı personele sürükle; görev anında atanır. Telefonda ise personeli karttan seçebilirsin.</p>
        <div className="commandActions">
          <button className="commandPrimary" onClick={onNew}><Plus/><span><b>Yeni teslimat</b><small>Görevi oluştur ve ata</small></span></button>
          <button className="commandSecondary" onClick={onStaff}><UserPlus/><span><b>Personel ekle</b><small>Saha ekibini düzenle</small></span></button>
        </div>
      </div>
      <div className="pulseOverview">
        <div><span><PackageCheck/></span><p><b>{operational.length}</b><small>bugün + geciken</small></p></div>
        <div className={overdue.length?"danger":""}><span><Clock3/></span><p><b>{overdue.length}</b><small>geciken</small></p></div>
        <div className={unseen.length?"warning":""}><span><BellRing/></span><p><b>{unseen.length}</b><small>15 dk+ görülmedi</small></p></div>
        <div className={missing.length?"warning":""}><span><ShieldAlert/></span><p><b>{missing.length}</b><small>eksik bilgi</small></p></div>
      </div>
    </section>

    <section className="attentionBar">
      <div className="attentionIntro"><span><AlertTriangle/></span><p><b>Dikkat gerekenler</b><small>Bir düğmeye bas, yalnız o işleri gör.</small></p></div>
      <button className={focus==="all"?"on":""} onClick={()=>setFocus("all")}><CheckCircle2/>Tümü <b>{operational.length}</b></button>
      <button className={(focus==="overdue"?"on ":"")+(overdue.length?"danger":"")} onClick={()=>setFocus("overdue")}><Clock3/>Geciken <b>{overdue.length}</b></button>
      <button className={(focus==="unseen"?"on ":"")+(unseen.length?"warning":"")} onClick={()=>setFocus("unseen")}><BellRing/>Görülmedi <b>{unseen.length}</b></button>
      <button className={(focus==="missing"?"on ":"")+(missing.length?"warning":"")} onClick={()=>setFocus("missing")}><ShieldAlert/>Eksik bilgi <b>{missing.length}</b></button>
    </section>

    <section className="assignmentDock">
      <div className="assignmentHead">
        <div><span><UsersRound/></span><p><b>Hızlı personel atama</b><small>Masaüstünde teslimat kartını personelin üstüne sürükle.</small></p></div>
        <em>{staff.length} personel</em>
      </div>
      <div className="staffDropRail">
        <button
          className="staffDrop unassigned"
          onDragOver={e=>e.preventDefault()}
          onDrop={()=>dropTo(null)}
        >
          <span>?</span><p><b>Atanmamış</b><small>Görevi havuza bırak</small></p>
        </button>
        {staff.map(s=><button
          key={s.id}
          className="staffDrop"
          onDragOver={e=>e.preventDefault()}
          onDrop={()=>dropTo(s)}
        >
          <span>{initials(s.name)}</span>
          <p><b>{s.name}</b><small>{operational.filter(d=>d.assignee===s.name&&!["completed","issue"].includes(d.status)).length} aktif iş</small></p>
          <i>{s.userId?"CANLI":"YEREL"}</i>
        </button>)}
        {!staff.length?<button className="staffDrop addStaffDrop" onClick={onStaff}><UserPlus/><p><b>Personel ekle</b><small>Görev atamak için önce ekip oluştur.</small></p></button>:null}
      </div>
    </section>

    <section className="kanbanShell">
      <div className="kanbanHeader">
        <div><small>BUGÜNÜN AKIŞI</small><h3>{focus==="all"?"Tüm operasyon":focus==="overdue"?"Geciken teslimatlar":focus==="unseen"?"Henüz görülmeyen görevler":"Eksik bilgili kayıtlar"}</h3></div>
        <div className="kanbanLegend"><span><i className="wait"/>Bekliyor {waiting.length}</span><span><i className="route"/>Yolda {onRoute.length}</span><span><i className="done"/>Bitti {done.length}</span><span><i className="problem"/>Sorun {issues.length}</span></div>
      </div>
      <div className="opsKanban">
        <KanbanColumn title="Bekliyor" subtitle="Yeni, atandı veya görüldü" icon={<Clock3/>} tone="wait" list={waiting} now={now} staff={staff} onOpen={onOpen} onAssign={onAssign} onDragStart={setDragId}/>
        <KanbanColumn title="Yolda" subtitle="Personel teslimata çıktı" icon={<Route/>} tone="route" list={onRoute} now={now} staff={staff} onOpen={onOpen} onAssign={onAssign} onDragStart={setDragId}/>
        <KanbanColumn title="Tamamlandı" subtitle="Bugün kapanan işler" icon={<CheckCircle2/>} tone="done" list={done} now={now} staff={staff} onOpen={onOpen} onAssign={onAssign} onDragStart={setDragId}/>
        <KanbanColumn title="Sorun" subtitle="Müdahale bekleyen işler" icon={<AlertTriangle/>} tone="problem" list={issues} now={now} staff={staff} onOpen={onOpen} onAssign={onAssign} onDragStart={setDragId}/>
      </div>
    </section>

    <section className="dailyHealth">
      <div><span><Truck/></span><p><b>{operational.filter(d=>d.status==="on_route").length}</b><small>şu an yolda</small></p></div>
      <div><span><UserCheck/></span><p><b>{operational.filter(d=>["seen","on_route","completed"].includes(d.status)).length}</b><small>personel tarafından görüldü</small></p></div>
      <div><span><CheckCircle2/></span><p><b>{completed.length}</b><small>bugün teslim edildi</small></p></div>
      <div><span><Phone/></span><p><b>{operational.filter(d=>d.checklist.customerCalled).length}</b><small>müşteri arandı</small></p></div>
    </section>
  </div>;
}

function KanbanColumn({
  title,subtitle,icon,tone,list,now,staff,onOpen,onAssign,onDragStart
}:{
  title:string;subtitle:string;icon:React.ReactNode;tone:string;list:Delivery[];now:Date;staff:StaffLite[];
  onOpen:(delivery:Delivery)=>void;
  onAssign:(delivery:Delivery,staff:StaffLite|null)=>void;
  onDragStart:(id:string)=>void;
}){
  return <section className={"kanbanColumn "+tone}>
    <header><span>{icon}</span><div><h4>{title}</h4><small>{subtitle}</small></div><b>{list.length}</b></header>
    <div className="kanbanCards">
      {list.map(d=><OperationCard key={d.id} delivery={d} now={now} staff={staff} onOpen={onOpen} onAssign={onAssign} onDragStart={onDragStart}/>)}
      {!list.length?<div className="kanbanEmpty"><CheckCircle2/><b>Burada iş yok</b><span>Bu kolon şu an temiz.</span></div>:null}
    </div>
  </section>
}

function OperationCard({
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
    className={"operationCard "+(overdue?"isOverdue ":"")+(unseen?"isUnseen ":"")+(missing.length?"hasMissing":"")}
    draggable
    onDragStart={e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",delivery.id);onDragStart(delivery.id)}}
    onClick={()=>onOpen(delivery)}
  >
    <div className="dragLine"><GripVertical/><span>{delivery.orderNo}</span><em>{delivery.timeWindow}</em></div>
    <div className="operationFlags">
      {overdue?<span className="flag danger"><Clock3/>Gecikti</span>:null}
      {unseen?<span className="flag warning"><BellRing/>Görülmedi</span>:null}
      {missing.length?<span className="flag warning"><ShieldAlert/>{missing.length} eksik</span>:null}
      {delivery.priority==="critical"?<span className="flag danger">Acil</span>:delivery.priority==="high"?<span className="flag priority">Öncelikli</span>:null}
    </div>
    <h4>{delivery.customerName || "İsimsiz müşteri"}</h4>
    <div className="operationMeta">
      <span><MapPin/>{delivery.district||"İlçe yok"}</span>
      <span><Phone/>{delivery.phone||"Telefon yok"}</span>
    </div>
    <div className="operationProduct">
      <span><WebIcon product={item?.product||""} size={26}/></span>
      <p><small>{item?.brand||"ÜRÜN"}</small><b>{item?.product||"Ürün bilgisi eksik"}</b><em>{item?.model||"Model belirtilmedi"}</em></p>
    </div>
    <div className="operationAssignee">
      <span>{delivery.assignee==="Atanmamış"?"?":initials(delivery.assignee)}</span>
      <p><small>PERSONEL</small><b>{delivery.assignee||"Atanmamış"}</b></p>
      <select
        value={delivery.assignee||"Atanmamış"}
        onClick={e=>e.stopPropagation()}
        onChange={e=>{
          e.stopPropagation();
          const value=e.target.value;
          onAssign(delivery,value==="Atanmamış"?null:(staff.find(s=>s.name===value)||null));
        }}
      >
        <option>Atanmamış</option>
        {staff.map(s=><option key={s.id}>{s.name}</option>)}
      </select>
    </div>
    <div className="operationCheck">
      <p><span>Kontrol</span><b>{done}/6</b></p>
      <i><em style={{width:(done/6*100)+"%"}}/></i>
    </div>
    {missing.length?<div className="missingHint">Eksik: {missing.join(", ")}</div>:null}
  </article>
}
