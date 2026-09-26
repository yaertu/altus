"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle, BellRing, CheckCircle2, ChevronRight, Clock3, Gauge,
  GripVertical, MapPin, PackageCheck, Phone, Plus, Route, ShieldAlert,
  Sparkles, Truck, UserCheck, UserPlus, UsersRound
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
  const active=operational.filter(d=>!["completed","issue"].includes(d.status));
  const completionRate=operational.length ? Math.round((completed.length/operational.length)*100) : 0;

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

  return <div className="opsDashboard">
    <section className="metricRibbon">
      <article className="metricLead">
        <div className="metricLeadTop">
          <span className="liveLabel"><i/>{cloud?"Canlı senkron":"Yerel çalışma"}</span>
          <span className="clockLabel">{new Intl.DateTimeFormat("tr-TR",{hour:"2-digit",minute:"2-digit"}).format(now)}</span>
        </div>
        <div className="metricLeadBody">
          <div className="progressRing" style={{"--p":completionRate} as React.CSSProperties}><b>%{completionRate}</b></div>
          <div><small>BUGÜNÜN İLERLEMESİ</small><h2>{completed.length}<span> / {operational.length}</span></h2><p>Tamamlanan teslimat</p></div>
        </div>
        <div className="metricLeadFoot"><span><Truck/>{active.length} aktif iş</span><span><UserCheck/>{operational.filter(d=>["seen","on_route","completed"].includes(d.status)).length} görüldü</span></div>
      </article>

      <MetricCard tone="danger" icon={<Clock3/>} value={overdue.length} title="Geciken" text="Planlanan süre aşıldı" onClick={()=>setFocus("overdue")} active={focus==="overdue"}/>
      <MetricCard tone="warning" icon={<BellRing/>} value={unseen.length} title="Görülmedi" text="15 dakikadır yanıt yok" onClick={()=>setFocus("unseen")} active={focus==="unseen"}/>
      <MetricCard tone="violet" icon={<ShieldAlert/>} value={missing.length} title="Eksik Bilgi" text="Telefon, adres veya atama" onClick={()=>setFocus("missing")} active={focus==="missing"}/>
    </section>

    <div className="opsWorkspace">
      <section className="flowBoard">
        <div className="flowBoardHead">
          <div>
            <span className="sectionEyebrow"><Sparkles/>OPERASYON AKIŞI</span>
            <h3>{focus==="all"?"Bugünün teslimat panosu":focus==="overdue"?"Geciken işlere odaklan":focus==="unseen"?"Henüz görülmeyen görevler":"Eksik bilgili kayıtlar"}</h3>
            <p>Kartlara dokunarak ayrıntıyı aç. Masaüstünde sürükleyip sağdaki personele bırakabilirsin.</p>
          </div>
          <div className="focusTabs" role="tablist" aria-label="Operasyon filtresi">
            <button className={focus==="all"?"on":""} onClick={()=>setFocus("all")}>Tümü <b>{operational.length}</b></button>
            <button className={focus==="overdue"?"on danger":""} onClick={()=>setFocus("overdue")}>Geciken <b>{overdue.length}</b></button>
            <button className={focus==="unseen"?"on warning":""} onClick={()=>setFocus("unseen")}>Görülmedi <b>{unseen.length}</b></button>
            <button className={focus==="missing"?"on warning":""} onClick={()=>setFocus("missing")}>Eksik <b>{missing.length}</b></button>
          </div>
        </div>

        <div className="flowGrid">
          <FlowLane title="Bekliyor" subtitle="Yeni, atandı veya görüldü" icon={<Clock3/>} tone="wait" list={waiting} now={now} staff={staff} onOpen={onOpen} onAssign={onAssign} onDragStart={setDragId}/>
          <FlowLane title="Yolda" subtitle="Sahaya çıkan teslimatlar" icon={<Route/>} tone="route" list={onRoute} now={now} staff={staff} onOpen={onOpen} onAssign={onAssign} onDragStart={setDragId}/>
          <FlowLane title="Tamamlandı" subtitle="Bugün kapanan işler" icon={<CheckCircle2/>} tone="done" list={done} now={now} staff={staff} onOpen={onOpen} onAssign={onAssign} onDragStart={setDragId}/>
          <FlowLane title="Sorun" subtitle="Müdahale bekleyen işler" icon={<AlertTriangle/>} tone="problem" list={issues} now={now} staff={staff} onOpen={onOpen} onAssign={onAssign} onDragStart={setDragId}/>
        </div>
      </section>

      <aside className="controlRail">
        <section className="railCard quickRail">
          <div className="railHead"><span><Plus/></span><div><b>Hızlı İşlemler</b><small>Dükkanda en sık yapılanlar</small></div></div>
          <button className="railPrimary" onClick={onNew}><Plus/><span><b>Teslimat oluştur</b><small>Müşteri + ürün + personel</small></span><ChevronRight/></button>
          <button className="railAction" onClick={onStaff}><UserPlus/><span><b>Personel ekle</b><small>Saha ekibini güncelle</small></span><ChevronRight/></button>
        </section>

        <section className="railCard staffRail">
          <div className="railHead"><span><UsersRound/></span><div><b>Atama Merkezi</b><small>Kartı personelin üstüne bırak</small></div><em>{staff.length}</em></div>
          <div className="staffTargets">
            <button className="staffTarget unassigned" onDragOver={e=>e.preventDefault()} onDrop={()=>dropTo(null)}>
              <span>?</span><p><b>Atanmamış</b><small>Görevi havuza geri bırak</small></p>
            </button>
            {staff.map(person=><button key={person.id} className="staffTarget" onDragOver={e=>e.preventDefault()} onDrop={()=>dropTo(person)}>
              <span>{initials(person.name)}</span>
              <p><b>{person.name}</b><small>{operational.filter(d=>d.assignee===person.name&&!["completed","issue"].includes(d.status)).length} aktif görev</small></p>
              <i className={person.userId?"live":""}>{person.userId?"CANLI":"YEREL"}</i>
            </button>)}
            {!staff.length?<button className="staffTarget add" onClick={onStaff}><UserPlus/><p><b>Personel ekle</b><small>İlk saha personelini oluştur</small></p></button>:null}
          </div>
        </section>

        <section className="railCard healthRail">
          <div className="railHead"><span><Gauge/></span><div><b>Günün Sağlığı</b><small>Operasyon kısa özeti</small></div></div>
          <div className="healthList">
            <div><span className="healthIcon route"><Route/></span><p><b>{onRoute.length}</b><small>şu an yolda</small></p></div>
            <div><span className="healthIcon done"><CheckCircle2/></span><p><b>{completed.length}</b><small>teslim edildi</small></p></div>
            <div><span className="healthIcon seen"><Phone/></span><p><b>{operational.filter(d=>d.checklist.customerCalled).length}</b><small>müşteri arandı</small></p></div>
            <div><span className="healthIcon alert"><AlertTriangle/></span><p><b>{issues.length}</b><small>sorun bekliyor</small></p></div>
          </div>
        </section>
      </aside>
    </div>
  </div>;
}

function MetricCard({tone,icon,value,title,text,onClick,active}:{tone:string;icon:ReactNode;value:number;title:string;text:string;onClick:()=>void;active:boolean}){
  return <button className={"metricCard "+tone+(active?" active":"")} onClick={onClick}>
    <span>{icon}</span>
    <div><b>{value}</b><strong>{title}</strong><small>{text}</small></div>
    <ChevronRight className="metricArrow"/>
  </button>;
}

function FlowLane({
  title,subtitle,icon,tone,list,now,staff,onOpen,onAssign,onDragStart
}:{
  title:string;subtitle:string;icon:ReactNode;tone:string;list:Delivery[];now:Date;staff:StaffLite[];
  onOpen:(delivery:Delivery)=>void;
  onAssign:(delivery:Delivery,staff:StaffLite|null)=>void;
  onDragStart:(id:string)=>void;
}){
  return <section className={"flowLane "+tone}>
    <div className="flowLaneHead"><span>{icon}</span><div><h4>{title}</h4><small>{subtitle}</small></div><b>{list.length}</b></div>
    <div className="flowLaneBody">
      {list.map(delivery=><OperationCard key={delivery.id} delivery={delivery} now={now} staff={staff} onOpen={onOpen} onAssign={onAssign} onDragStart={onDragStart}/>)}
      {!list.length?<div className="laneEmpty"><PackageCheck/><b>Burada iş yok</b><span>Bu alan şu an temiz.</span></div>:null}
    </div>
  </section>;
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
    className={"deliveryTile "+(overdue?"isOverdue ":"")+(unseen?"isUnseen ":"")+(missing.length?"hasMissing":"")}
    draggable
    onDragStart={e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",delivery.id);onDragStart(delivery.id)}}
    onClick={()=>onOpen(delivery)}
  >
    <div className="tileTop"><GripVertical/><span>{delivery.orderNo}</span><time>{delivery.timeWindow}</time><button aria-label={delivery.customerName+" detayını aç"} onClick={e=>{e.stopPropagation();onOpen(delivery)}}><ChevronRight/></button></div>
    <div className="tileFlags">
      {overdue?<span className="danger"><Clock3/>Gecikti</span>:null}
      {unseen?<span className="warning"><BellRing/>Görülmedi</span>:null}
      {missing.length?<span className="warning"><ShieldAlert/>{missing.length} eksik</span>:null}
      {delivery.priority==="critical"?<span className="danger">Acil</span>:delivery.priority==="high"?<span className="priority">Öncelikli</span>:null}
    </div>
    <h5>{delivery.customerName||"İsimsiz müşteri"}</h5>
    <div className="tileMeta"><span><MapPin/>{delivery.district||"İlçe yok"}</span><span><Phone/>{delivery.phone||"Telefon yok"}</span></div>
    <div className="tileProduct"><span><WebIcon product={item?.product||""} size={28}/></span><p><small>{item?.brand||"ÜRÜN"}</small><b>{item?.product||"Ürün bilgisi eksik"}</b><em>{item?.model||"Model belirtilmedi"}</em></p></div>
    <div className="tileAssign">
      <span>{delivery.assignee==="Atanmamış"?"?":initials(delivery.assignee)}</span>
      <p><small>PERSONEL</small><b>{delivery.assignee||"Atanmamış"}</b></p>
      <select value={delivery.assignee||"Atanmamış"} onClick={e=>e.stopPropagation()} onChange={e=>{e.stopPropagation();const value=e.target.value;onAssign(delivery,value==="Atanmamış"?null:(staff.find(s=>s.name===value)||null));}}>
        <option>Atanmamış</option>
        {staff.map(person=><option key={person.id}>{person.name}</option>)}
      </select>
    </div>
    <div className="tileProgress"><p><span>Kontrol</span><b>{done}/6</b></p><i><em style={{width:(done/6*100)+"%"}}/></i></div>
    {missing.length?<div className="tileMissing">Eksik: {missing.join(", ")}</div>:null}
  </article>;
}
