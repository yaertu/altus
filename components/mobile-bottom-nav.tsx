"use client";

import { Home, PackageCheck, Plus, Settings, Users } from "lucide-react";

export type MobileView = "dashboard" | "deliveries" | "staff" | "settings";

export default function MobileBottomNav({
  view,onView,onNew
}:{
  view:string;
  onView:(view:MobileView)=>void;
  onNew:()=>void;
}){
  return <nav className="mobileBottom" aria-label="Mobil hızlı menü">
    <button className={view==="dashboard"?"on":""} onClick={()=>onView("dashboard")}><Home/><span>Ana Sayfa</span></button>
    <button className={view==="deliveries"?"on":""} onClick={()=>onView("deliveries")}><PackageCheck/><span>Teslimatlar</span></button>
    <button className="mobileCreate" onClick={onNew} aria-label="Yeni teslimat"><Plus/></button>
    <button className={view==="staff"?"on":""} onClick={()=>onView("staff")}><Users/><span>Personel</span></button>
    <button className={view==="settings"?"on":""} onClick={()=>onView("settings")}><Settings/><span>Ayarlar</span></button>
  </nav>;
}
