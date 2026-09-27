"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { signIn } from "@/lib/cloud";

export default function LoginScreen({ onSuccess }:{ onSuccess:()=>void }) {
  const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function submit(e:FormEvent){
    e.preventDefault(); setError(""); setBusy(true);
    try { await signIn(email,password); onSuccess(); }
    catch(err:any){ setError(err?.message || "Giriş yapılamadı."); }
    finally{ setBusy(false); }
  }
  return <div className="authShell productAuth">
    <div className="authGlow authGlowOne"/><div className="authGlow authGlowTwo"/>
    <section className="authCard">
      <div className="authBrand"><span className="officialLogoFrame"><Image src="/altus-logo.png" alt="ALTUS" width={1000} height={1000} priority/></span><div><b>ALTUS Teslimat</b><small>MAĞAZA &amp; SERVİS OPERASYONU</small></div></div>
      <div className="authTitle"><span><ShieldCheck/> Güvenli personel girişi</span><h1>Teslimatları kolayca yönet.</h1><p>Müşteri, ürün, adres ve personel görevleri tek, anlaşılır ekranda.</p></div>
      <form onSubmit={submit}>
        <label><span>E-posta</span><div><Mail/><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="kullanici@firma.com" required/></div></label>
        <label><span>Şifre</span><div><LockKeyhole/><input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required/></div></label>
        {error?<p className="authError">{error}</p>:null}
        <button className="primary authButton" disabled={busy}>{busy?"Bağlanıyor…":"Sisteme giriş yap"}</button>
      </form>
      <div className="authMeta"><i/><span>Yetkili personel erişimi</span></div>
    </section>
  </div>;
}
