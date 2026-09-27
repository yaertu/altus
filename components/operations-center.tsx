"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle, ArrowUpDown, BellRing, CalendarDays, CheckCircle2,
  ChevronLeft, ChevronRight, Clock3, Download, MapPin, PackageCheck,
  Phone, Plus, Printer, Search, SlidersHorizontal, Truck, UserPlus, Wifi
} from "lucide-react";
import type { Delivery } from "@/lib/types";

type StaffLite = { id:string; name:string; phone:string; userId?:string|null };
type Focus = "all" | "open" | "late" | "overdue" | "missing" | "done";
type SortKey = "time" | "customer" | "status";
type Density = "comfortable" | "compact";

function localDay(date:Date){
  const offset=date.getTimezoneOffset()*60000;
  return new Date(date.getTime()-offset).toISOString().slice(0,10);
}
function shiftDay(iso:string,amount:number){
  const date=new Date(iso+"T12:00:00");
  date.setDate(date.getDate()+amount);
  return localDay(date);
}
function statusLabel(status:Delivery["status"]){
  return status==="new"?"Bekliyor":status==="assigned"?"Atandı":status==="seen"?"Görüldü":status==="on_route"?"Yolda":status==="completed"?"Tamamlandı":"Sorun";
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
  return flags.length?flags:["Teslimat"];
}
function windowEnd(delivery:Delivery){
  const times=[...(delivery.timeWindow||"").matchAll(/(\d{1,2}):(\d{2})/g)];
  const last=times.at(-1);
  if(!last)return null;
  const hour=Number(last[1]), minute=Number(last[2]);
  if(!Number.isFinite(hour)||!Number.isFinite(minute))return null;
  const date=new Date(delivery.date+"T00:00:00");
  date.setHours(hour,minute,0,0);
  return date;
}
function isLate(delivery:Delivery,now:Date){
  if(["completed","issue"].includes(delivery.status))return false;
  const end=windowEnd(delivery);
  return Boolean(end&&end.getTime()<now.getTime());
}
function initials(name:string){
  return name.split(" ").filter(Boolean).map(x=>x[0]).join("").slice(0,2).toUpperCase()||"—";
}
function csvCell(value:unknown){
  const text=String(value??"").replace(/"/g,'""');
  return '"'+text+'"';
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
  const [selectedDay,setSelectedDay]=useState(()=>localDay(new Date()));
  const [focus,setFocus]=useState<Focus>("all");
  const [search,setSearch]=useState("");
  const [sort,setSort]=useState<SortKey>("time");
  const [density,setDensity]=useState<Density>("comfortable");

  useEffect(()=>{
    const timer=window.setInterval(()=>setNow(new Date()),30000);
    return()=>window.clearInterval(timer);
  },[]);

  const today=localDay(now);
  const dayDeliveries=useMemo(()=>deliveries.filter(d=>d.date===selectedDay),[deliveries,selectedDay]);
  const carryover=useMemo(
    ()=>deliveries.filter(d=>d.date<selectedDay&&!["completed","issue"].includes(d.status)),
    [deliveries,selectedDay]
  );
  const queue=useMemo(()=>[...carryover,...dayDeliveries],[carryover,dayDeliveries]);
  const open=queue.filter(d=>!["completed","issue"].includes(d.status));
  const overdue=carryover;
  const late=queue.filter(d=>isLate(d,now));
  const missing=queue.filter(d=>missingFields(d).length>0&&!["completed","issue"].includes(d.status));
  const done=dayDeliveries.filter(d=>d.status==="completed");
  const linkedStaff=staff.filter(person=>Boolean(person.userId)).length;
  const completion=dayDeliveries.length?Math.round(done.length/dayDeliveries.length*100):0;

  const visible=queue.filter(d=>{
    if(focus==="open"&&["completed","issue"].includes(d.status))return false;
    if(focus==="late"&&!isLate(d,now))return false;
    if(focus==="overdue"&&!(d.date<selectedDay&&!["completed","issue"].includes(d.status)))return false;
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
    if(sort==="customer")return (a.customerName||"").localeCompare(b.customerName||"","tr");
    if(sort==="status")return a.status.localeCompare(b.status);
    const dateCompare=a.date.localeCompare(b.date);
    if(dateCompare!==0)return dateCompare;
    return (a.timeWindow||"").localeCompare(b.timeWindow||"");
  });

  const selectedDate=new Date(selectedDay+"T12:00:00");
  const selectedIsToday=selectedDay===today;
  const prettyDate=new Intl.DateTimeFormat("tr-TR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).format(selectedDate);

  function exportCsv(){
    const header=["Sipariş","Tarih","Saat","Durum","Müşteri","Telefon","2. Telefon","Ürün","Yapılacak İş","Adres","İlçe","Şehir","Personel","Mağaza Notu","Eksikler"];
    const rows=visible.map(d=>[
      d.orderNo,d.date,d.timeWindow,statusLabel(d.status),d.customerName,d.phone,d.secondaryPhone||"",
      productText(d),workFlags(d).join(" / "),d.address,d.district,d.city,d.assignee||"Atanmamış",d.notes||"",missingFields(d).join(", ")
    ]);
    const csv="\ufeff"+[header,...rows].map(row=>row.map(csvCell).join(";")).join("\r\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download="ALTUS-Teslimat-"+selectedDay+".csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return <div className="opsV3">
    <section className="opsCommand opsCommandV3">
      <div className="opsCommandCopy">
        <span className="opsBreadcrumb">OPERASYON / {selectedIsToday?"BUGÜN":"TESLİMAT GÜNÜ"}</span>
        <div className="opsTitleLine">
          <span className="opsSun">{selectedIsToday?"☀":"◷"}</span>
          <div>
            <h1>{selectedIsToday?"Bugün":new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"long"}).format(selectedDate)}</h1>
            <p>Teslimatları kaydet, personele ata, eksikleri gör ve tamamlanana kadar tek çizelgeden takip et.</p>
          </div>
        </div>
      </div>

      <div className="opsCommandTools">
        <div className="opsDateSwitch">
          <CalendarDays/>
          <b>{prettyDate}</b>
          <button aria-label="Önceki gün" onClick={()=>setSelectedDay(day=>shiftDay(day,-1))}><ChevronLeft/></button>
          <button aria-label="Sonraki gün" onClick={()=>setSelectedDay(day=>shiftDay(day,1))}><ChevronRight/></button>
        </div>
        {!selectedIsToday?<button className="soft opsToday" onClick={()=>setSelectedDay(today)}>Bugüne dön</button>:null}
      </div>
    </section>

    <section className="opsSummaryStrip">
      <Metric icon={<PackageCheck/>} value={queue.length} label="Toplam" tone="blue"/>
      <Metric icon={<Clock3/>} value={open.length} label="Açık iş" tone="blue"/>
      <Metric icon={<AlertTriangle/>} value={late.length} label="Geciken" tone="red"/>
      <Metric icon={<AlertTriangle/>} value={missing.length} label="Eksik bilgi" tone="amber"/>
      <Metric icon={<CheckCircle2/>} value={done.length} label="Tamamlanan" tone="green"/>
      <div className="opsCompletion">
        <div><span>Tamamlanma</span><b>%{completion}</b></div>
        <i><em style={{width:completion+"%"}}/></i>
      </div>
      <div className={"opsLivePill "+(cloud?"online":"local")}><i/><Wifi/><span>{cloud?"Canlı senkron":"Yerel mod"}</span></div>
    </section>

    <section className="opsAttentionStrip">
      <button className={late.length?"danger":"quiet"} onClick={()=>setFocus("late")}><AlertTriangle/><b>{late.length}</b><span>geciken</span></button>
      <button className={overdue.length?"violet":"quiet"} onClick={()=>setFocus("overdue")}><Clock3/><b>{overdue.length}</b><span>dünden kalan</span></button>
      <button className={missing.length?"warn":"quiet"} onClick={()=>setFocus("missing")}><CheckCircle2/><b>{missing.length}</b><span>eksik kayıt</span></button>
      <button className={staff.length&&linkedStaff===staff.length?"ok":"warn"} onClick={onStaff}><BellRing/><b>{linkedStaff}/{staff.length}</b><span>bildirim hesabı</span></button>
      <p>{late.length||overdue.length||missing.length||linkedStaff<staff.length?"Kontrol gereken başlıklar burada toplanır.":"Operasyon temiz görünüyor; kritik uyarı yok."}</p>
    </section>

    <section className="opsTableCard opsTableCardV3">
      <div className="opsTableTitle opsTableTitleV3">
        <div className="opsTableIdentity">
          <span><PackageCheck/></span>
          <div><h2>Mağaza teslimat çizelgesi</h2><p>{prettyDate} • {visible.length} kayıt</p></div>
        </div>
        <div className="opsTableActions">
          <button className="soft compactAction" onClick={onStaff}><UserPlus/>Personel</button>
          <button className="soft compactAction" onClick={exportCsv}><Download/>CSV</button>
          <button className="soft compactAction" onClick={()=>window.print()}><Printer/>Yazdır</button>
          <button className="primary compactAction" onClick={onNew}><Plus/>Yeni teslimat</button>
        </div>
      </div>

      <div className="opsToolbar opsToolbarV3">
        <label className="opsSearch">
          <Search/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Müşteri, telefon, ürün, adres, personel veya not ara..."/>
        </label>
        <div className="opsFilters">
          <Filter on={focus==="all"} onClick={()=>setFocus("all")} label="Tümü" count={queue.length}/>
          <Filter on={focus==="open"} onClick={()=>setFocus("open")} label="Açık" count={open.length}/>
          <Filter on={focus==="late"} onClick={()=>setFocus("late")} label="Geciken" count={late.length} tone="danger"/>
          <Filter on={focus==="overdue"} onClick={()=>setFocus("overdue")} label="Dünden kalan" count={overdue.length} tone="violet"/>
          <Filter on={focus==="missing"} onClick={()=>setFocus("missing")} label="Eksik" count={missing.length} tone="warn"/>
          <Filter on={focus==="done"} onClick={()=>setFocus("done")} label="Tamamlanan" count={done.length} tone="ok"/>
        </div>
        <div className="opsViewTools">
          <label className="opsSort">
            <ArrowUpDown/>
            <select value={sort} onChange={e=>setSort(e.target.value as SortKey)}>
              <option value="time">Saate göre</option>
              <option value="customer">Müşteriye göre</option>
              <option value="status">Duruma göre</option>
            </select>
          </label>
          <div className="opsDensity">
            <button className={density==="comfortable"?"on":""} aria-label="Rahat satır görünümü" onClick={()=>setDensity("comfortable")}><SlidersHorizontal/></button>
            <button className={density==="compact"?"on":""} aria-label="Kompakt satır görünümü" onClick={()=>setDensity("compact")}><ArrowUpDown/></button>
          </div>
        </div>
      </div>

      <div className={"sheetGridScroll opsGridScroll opsGridScrollV3 "+density}>
        <div className="sheetGrid opsGrid opsGridV3" role="table" aria-label="Teslimat çizelgesi">
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
            <span className="colAlert">UYARI</span>
            <span className="colOpen"></span>
          </div>

          {visible.length?visible.map((delivery,index)=>
            <SheetRow
              key={delivery.id}
              index={index+1}
              delivery={delivery}
              staff={staff}
              late={isLate(delivery,now)}
              onOpen={onOpen}
              onAssign={onAssign}
            />
          ):<div className="opsEmpty opsEmptyV3">
            <div className="opsEmptyIcon"><CheckCircle2/></div>
            <h3>{focus==="all"?"Bu gün için kayıt yok":"Bu filtrede teslimat yok"}</h3>
            <p>{focus==="all"?"İlk teslimatı oluşturduğunda müşteri, ürün, adres ve personel bilgileri burada görünecek.":"Filtreyi değiştir veya yeni bir teslimat oluştur."}</p>
            <button className="primary" onClick={onNew}><Plus/>Yeni teslimat oluştur</button>
          </div>}
        </div>
      </div>
    </section>
  </div>;
}

function Metric({icon,value,label,tone}:{icon:ReactNode;value:number;label:string;tone:"blue"|"red"|"amber"|"green"}){
  return <div className={"opsMetric "+tone}><span>{icon}</span><p><b>{value}</b><small>{label}</small></p></div>;
}
function Filter({on,onClick,label,count,tone=""}:{on:boolean;onClick:()=>void;label:string;count:number;tone?:string}){
  return <button className={(on?"on ":"")+tone} onClick={onClick}>{label}<b>{count}</b></button>;
}
function SheetRow({
  index,delivery,staff,late,onOpen,onAssign
}:{
  index:number;
  delivery:Delivery;
  staff:StaffLite[];
  late:boolean;
  onOpen:(d:Delivery)=>void;
  onAssign:(d:Delivery,s:StaffLite|null)=>void;
}){
  const missing=missingFields(delivery);
  const overdue=delivery.date<localDay(new Date())&&!["completed","issue"].includes(delivery.status);
  const flags=workFlags(delivery);

  return <article className={"sheetRow "+(missing.length?"hasMissing ":"")+(overdue?"isOverdue ":"")+(late?"isLate ":"")+(delivery.status==="completed"?"isDone":"")} role="row">
    <button className="sheetCell colNo" data-label="#" onClick={()=>onOpen(delivery)}><b>{index}</b></button>
    <button className="sheetCell colStatus" data-label="Durum / Saat" onClick={()=>onOpen(delivery)}>
      <span className={"status s-"+delivery.status}>{late&&delivery.status!=="completed"?"Geciken":statusLabel(delivery.status)}</span>
      <b>{delivery.timeWindow||"Saat yok"}</b>
      <small>{overdue?delivery.date:delivery.orderNo}</small>
    </button>
    <button className="sheetCell colCustomer" data-label="Müşteri" onClick={()=>onOpen(delivery)}>
      <div className="opsCustomer"><span>{initials(delivery.customerName)}</span><p><b>{delivery.customerName||"İsimsiz müşteri"}</b><small>{delivery.orderNo}</small></p></div>
    </button>
    <a className="sheetCell colPhone" data-label="Telefon" href={"tel:"+delivery.phone.replace(/[^\d+]/g,"")}>
      <Phone/><b>{delivery.phone||"Telefon yok"}</b>{delivery.secondaryPhone?<small>{delivery.secondaryPhone}</small>:null}
    </a>
    <button className="sheetCell colProduct" data-label="Ürün" onClick={()=>onOpen(delivery)}>
      <b>{productText(delivery)}</b><small>{delivery.items.reduce((sum,item)=>sum+(item.quantity||1),0)} ürün/adet</small>
    </button>
    <button className="sheetCell colWork" data-label="Yapılacak İş" onClick={()=>onOpen(delivery)}>
      <div className="sheetTags">{flags.map(flag=><span key={flag}>{flag}</span>)}</div>
    </button>
    <button className="sheetCell colAddress" data-label="Adres" onClick={()=>onOpen(delivery)}>
      <b>{delivery.address||"Adres girilmedi"}</b><small><MapPin/>{delivery.district||"İlçe yok"}{delivery.city?", "+delivery.city:""}</small>
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
    <button className="sheetCell colAlert" data-label="Uyarı" onClick={()=>onOpen(delivery)}>
      {late?<span className="sheetAlert danger">Geciken</span>:null}
      {overdue?<span className="sheetAlert violet">Dünden kaldı</span>:null}
      {missing.length?missing.slice(0,2).map(item=><span className="sheetAlert warn" key={item}>{item} eksik</span>):!late&&!overdue?<span className="sheetAlert ok">Hazır</span>:null}
      {missing.length>2?<small className="moreAlert">+{missing.length-2} eksik</small>:null}
    </button>
    <button className="sheetCell colOpen sheetOpen" aria-label="Teslimat detayını aç" onClick={()=>onOpen(delivery)}><ChevronRight/></button>
  </article>;
}
