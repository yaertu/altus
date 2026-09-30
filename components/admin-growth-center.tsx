'use client'

import {useMemo,useState} from 'react'
import {useRouter} from 'next/navigation'
import {Ban,Gift,Medal,Plus,RotateCcw,Save,ShieldAlert,Sparkles,Star,Trophy,UserCheck,Zap} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {COURIER_RANKS,getRank,type CourierPromotion} from '@/lib/courier-growth'
import type {Product} from '@/lib/types'

type UserRow={user_id:string;full_name:string;phone:string|null;role:string|null;is_active:boolean;store_id:string|null}
type ScoreRow={user_id:string;points:number;delivered_count:number;failed_count:number;courier_cancel_count:number;streak_days:number;suspended_reason?:string|null}
type Settings={daily_cancel_limit:number;auto_suspend:boolean;accepted_points:number;arrived_points:number;delivered_points:number;courier_cancel_points:number}
type Props={orgId:string;adminUserId:string;users:UserRow[];scores:ScoreRow[];promotions:CourierPromotion[];settings:Settings;products:Product[];schemaReady:boolean}

export default function AdminGrowthCenter({orgId,adminUserId,users,scores,promotions,settings,products,schemaReady}:Props){
  const router=useRouter()
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const couriers=useMemo(()=>users.filter(x=>x.role==='courier'),[users])
  const scoreMap=useMemo(()=>new Map(scores.map(x=>[x.user_id,x])),[scores])
  const [selectedCourier,setSelectedCourier]=useState(couriers[0]?.user_id||'')

  async function createPromotion(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!schemaReady)return
    setBusy(true);setMessage('')
    const form=e.currentTarget
    const f=new FormData(form)
    const start=new Date(String(f.get('starts_at')))
    const end=new Date(String(f.get('ends_at')))
    if(!(start<end)){setBusy(false);setMessage('Promosyon bitişi başlangıçtan sonra olmalı.');return}
    const supabase=createClient()
    const {error}=await supabase.from('courier_promotions').insert({
      org_id:orgId,
      title:String(f.get('title')||'').trim(),
      description:String(f.get('description')||'').trim(),
      target_type:String(f.get('target_type')),
      target_count:Number(f.get('target_count')||1),
      reward_amount:String(f.get('reward_amount')||'').trim()?Number(f.get('reward_amount')):null,
      reward_label:String(f.get('reward_label')||'').trim()||null,
      product_ids:f.getAll('product_ids').map(String).filter(Boolean),
      starts_at:start.toISOString(),
      ends_at:end.toISOString(),
      theme:String(f.get('theme')||'magenta'),
      created_by:adminUserId
    })
    setBusy(false)
    setMessage(error?error.message:'Promosyon oluşturuldu.')
    if(!error){form.reset();router.refresh()}
  }

  async function togglePromotion(p:CourierPromotion){
    setBusy(true)
    const supabase=createClient()
    const {error}=await supabase.from('courier_promotions').update({is_active:!p.is_active,updated_at:new Date().toISOString()}).eq('id',p.id).eq('org_id',orgId)
    setMessage(error?error.message:(p.is_active?'Promosyon durduruldu.':'Promosyon yeniden yayınlandı.'))
    setBusy(false)
    if(!error)router.refresh()
  }

  async function adjustPoints(delta:number,label:string){
    if(!selectedCourier||!schemaReady)return
    const reason=window.prompt('Puan işlemi nedeni',label)?.trim()
    if(!reason)return
    setBusy(true)
    const supabase=createClient()
    const {error}=await supabase.from('courier_score_events').insert({
      org_id:orgId,courier_id:selectedCourier,points_delta:delta,
      event_key:delta>=0?'admin_bonus':'admin_penalty',reason,actor_id:adminUserId
    })
    setMessage(error?error.message:(delta>=0?'+':'')+delta+' XP kaydedildi.')
    setBusy(false)
    if(!error)router.refresh()
  }

  async function setAccount(active:boolean,withPenalty=false){
    if(!selectedCourier)return
    const reason=window.prompt(active?'Hesabı açma notu':'Hesabı durdurma nedeni',active?'Yönetici incelemesi tamamlandı':'Operasyon kuralı incelemesi')?.trim()
    if(!reason)return
    setBusy(true)
    const supabase=createClient()
    const profileRes=await supabase.from('profiles').update({is_active:active}).eq('user_id',selectedCourier)
    if(profileRes.error){setMessage(profileRes.error.message);setBusy(false);return}
    if(schemaReady){
      if(!active)await supabase.from('courier_penalties').insert({org_id:orgId,courier_id:selectedCourier,reason,points_delta:0,suspended:true,created_by:adminUserId})
      await supabase.from('courier_scores').update({suspended_reason:active?null:reason,updated_at:new Date().toISOString()}).eq('user_id',selectedCourier)
      if(active&&withPenalty)await supabase.from('courier_score_events').insert({org_id:orgId,courier_id:selectedCourier,points_delta:-100,event_key:'reactivation_penalty',reason,actor_id:adminUserId})
    }
    setMessage(active?(withPenalty?'Hesap -100 XP ceza ile açıldı.':'Hesap cezasız açıldı.'):'Kurye hesabı durduruldu.')
    setBusy(false);router.refresh()
  }

  async function confirmCancellation(){
    if(!selectedCourier||!schemaReady)return
    const reason=window.prompt('Kurye kaynaklı iptal nedeni')?.trim()
    if(!reason)return
    setBusy(true)
    const supabase=createClient()
    const {error}=await supabase.from('courier_cancel_events').insert({org_id:orgId,courier_id:selectedCourier,reason,confirmed_by:adminUserId})
    setMessage(error?error.message:'Kurye kaynaklı iptal doğrulandı. Günlük limit ve puan kuralı işlendi.')
    setBusy(false)
    if(!error)router.refresh()
  }

  async function saveRules(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault()
    if(!schemaReady)return
    setBusy(true)
    const f=new FormData(e.currentTarget)
    const supabase=createClient()
    const {error}=await supabase.from('gamification_settings').upsert({
      org_id:orgId,
      daily_cancel_limit:Number(f.get('daily_cancel_limit')||5),
      auto_suspend:f.get('auto_suspend')==='on',
      accepted_points:Number(f.get('accepted_points')||5),
      arrived_points:Number(f.get('arrived_points')||10),
      delivered_points:Number(f.get('delivered_points')||100),
      courier_cancel_points:Number(f.get('courier_cancel_points')||-75),
      updated_at:new Date().toISOString()
    },{onConflict:'org_id'})
    setMessage(error?error.message:'Puan ve disiplin kuralları kaydedildi.')
    setBusy(false)
    if(!error)router.refresh()
  }

  const selected=couriers.find(x=>x.user_id===selectedCourier)
  const score=scoreMap.get(selectedCourier)
  const rank=getRank(score?.points||0)

  return <section className="panel adminGrowthCenter">
    <div className="panelHead premiumSectionTitle"><div className="titleIcon strong"><Trophy size={18}/></div><div><span className="eyebrow">KURYE GELİŞİM MERKEZİ</span><h2>Promosyon, rütbe, puan ve disiplin</h2><p>Ödülleri yayınla, performansı puanla, iptal sınırını ve hesap durumunu yönet.</p></div><span className="badge s-delivered">60 rütbe</span></div>

    {!schemaReady&&<div className="adminMigrationNotice"><ShieldAlert size={18}/><div><strong>v6 veritabanı migration'ı bekliyor</strong><span>Arayüz hazır. Production Supabase'e v6 migration uygulanınca kayıt işlemleri aktif olur.</span></div></div>}
    {message&&<div className="fieldNotice modernNotice">{message}</div>}

    <div className="adminGrowthGrid">
      <div className="adminGrowthColumn">
        <div className="growthAdminCard">
          <div className="growthAdminHead"><Gift size={17}/><div><strong>Yeni promosyon</strong><small>Kurye mobil profilinde banner olarak görünür.</small></div></div>
          <form onSubmit={createPromotion} className="promotionAdminForm">
            <label className="wide">Başlık<input className="input" name="title" required placeholder="10 teslimat yap, ek ödülü aç"/></label>
            <label className="wide">Açıklama<input className="input" name="description" placeholder="Başarılı teslimatları tamamla ve hedefe ulaş."/></label>
            <label>Hedef<select className="select" name="target_type" defaultValue="deliveries"><option value="deliveries">Teslimat adedi</option><option value="selected_products">Seçili ürün teslimatı</option><option value="points">XP hedefi</option></select></label>
            <label>Hedef sayı<input className="input" name="target_count" type="number" min="1" defaultValue="10"/></label>
            <label>Ödül ₺<input className="input" name="reward_amount" type="number" min="0" step=".01" placeholder="200"/></label>
            <label>Ödül etiketi<input className="input" name="reward_label" placeholder="200 ₺ ek ödül"/></label>
            <label>Başlangıç<input className="input" name="starts_at" type="datetime-local" required/></label>
            <label>Bitiş<input className="input" name="ends_at" type="datetime-local" required/></label>
            <label>Tema<select className="select" name="theme"><option value="magenta">Altus Magenta</option><option value="gold">Altın</option><option value="emerald">Zümrüt</option><option value="night">Gece</option></select></label>
            <label className="wide">Seçili ürünler<select className="select promoProductSelect" name="product_ids" multiple>{products.map(p=><option key={p.id} value={p.id}>{p.model} • {p.title}</option>)}</select><small>Yalnız seçili ürün hedefinde kullanılır. Ctrl/Cmd ile çoklu seç.</small></label>
            <button disabled={busy||!schemaReady} className="btn btnPrimary wide"><Plus size={15}/> Promosyon oluştur</button>
          </form>
        </div>

        <div className="growthAdminCard">
          <div className="growthAdminHead"><Sparkles size={17}/><div><strong>Promosyon listesi</strong><small>{promotions.length} kayıt</small></div></div>
          <div className="adminPromotionList">{promotions.length?promotions.map(p=><div key={p.id}><span className={'promoDot theme-'+p.theme}/><div><strong>{p.title}</strong><small>{p.target_count} hedef • {p.reward_label||((p.reward_amount||0)>0?p.reward_amount+' ₺':'Özel ödül')}</small></div><button className="btn btnGhost compact" disabled={busy} onClick={()=>togglePromotion(p)}>{p.is_active?'Durdur':'Yayınla'}</button></div>):<div className="growthEmpty compact">Henüz promosyon oluşturulmadı.</div>}</div>
        </div>
      </div>

      <div className="adminGrowthColumn">
        <div className="growthAdminCard">
          <div className="growthAdminHead"><Medal size={17}/><div><strong>Kurye puan & ceza merkezi</strong><small>İşlemler neden notuyla loglanır.</small></div></div>
          <select className="select" value={selectedCourier} onChange={e=>setSelectedCourier(e.target.value)}>{couriers.map(c=><option key={c.user_id} value={c.user_id}>{c.full_name} • {c.is_active?'Aktif':'Durduruldu'}</option>)}</select>
          {selected&&<div className="selectedCourierGrowth"><div className="rankMiniOrb" style={{background:rank.accent}}><Star size={17}/></div><div><strong>{selected.full_name}</strong><span>{rank.title} • {(score?.points||0).toLocaleString('tr-TR')} XP</span><small>{score?.delivered_count||0} teslim • {score?.courier_cancel_count||0} kurye iptali</small></div><b className={selected.is_active?'stateOk':'stateStop'}>{selected.is_active?'AKTİF':'DURDURULDU'}</b></div>}
          <div className="adminScoreButtons"><button disabled={!schemaReady||busy} onClick={()=>adjustPoints(100,'Yönetici performans bonusu')} className="btn btnSoft"><Zap size={14}/> +100 XP</button><button disabled={!schemaReady||busy} onClick={()=>adjustPoints(-50,'Yönetici performans kesintisi')} className="btn btnGhost">−50 XP</button><button disabled={!schemaReady||busy} onClick={confirmCancellation} className="btn btnGhost"><ShieldAlert size={14}/> Kurye iptali doğrula</button></div>
          <div className="adminAccountButtons"><button disabled={busy||!selected?.is_active} onClick={()=>setAccount(false)} className="btn btnDanger"><Ban size={14}/> Hesabı durdur</button><button disabled={busy||!!selected?.is_active} onClick={()=>setAccount(true,false)} className="btn btnSoft"><UserCheck size={14}/> Cezasız aç</button><button disabled={busy||!!selected?.is_active} onClick={()=>setAccount(true,true)} className="btn btnGhost"><RotateCcw size={14}/> −100 XP ile aç</button></div>
        </div>

        <div className="growthAdminCard">
          <div className="growthAdminHead"><ShieldAlert size={17}/><div><strong>Otomatik kural motoru</strong><small>Yalnız yönetici tarafından kurye kaynaklı olarak doğrulanan iptaller sayılır.</small></div></div>
          <form onSubmit={saveRules} className="rulesGrid">
            <label>Günlük iptal sınırı<input className="input" name="daily_cancel_limit" type="number" min="1" max="50" defaultValue={settings.daily_cancel_limit}/></label>
            <label>Teslimat XP<input className="input" name="delivered_points" type="number" defaultValue={settings.delivered_points}/></label>
            <label>Görevi alma XP<input className="input" name="accepted_points" type="number" defaultValue={settings.accepted_points}/></label>
            <label>Adrese varış XP<input className="input" name="arrived_points" type="number" defaultValue={settings.arrived_points}/></label>
            <label>Kurye iptali XP<input className="input" name="courier_cancel_points" type="number" max="0" defaultValue={settings.courier_cancel_points}/></label>
            <label className="ruleSwitch"><input type="checkbox" name="auto_suspend" defaultChecked={settings.auto_suspend}/><span>Limit aşılırsa hesabı otomatik durdur</span></label>
            <button disabled={busy||!schemaReady} className="btn btnPrimary wide"><Save size={14}/> Kuralları kaydet</button>
          </form>
        </div>
      </div>
    </div>

    <div className="rankCatalogAdmin">
      <div className="growthAdminHead"><Trophy size={17}/><div><strong>60 kademeli rütbe kataloğu</strong><small>Her rütbenin ayrı unvanı, rengi, çerçeve stili ve hareket karakteri vardır.</small></div></div>
      <div className="rankCatalogRail">{COURIER_RANKS.map(r=><div key={r.rankNo} className={'rankCatalogCard rankAnim-'+r.animationKey+' rankFrame-'+r.frameStyle} style={{'--rank':r.accent,'--rank-glow':r.glow} as React.CSSProperties}><i>{r.rankNo}</i><strong>{r.title}</strong><small>{r.minPoints.toLocaleString('tr-TR')} XP</small></div>)}</div>
    </div>
  </section>
}
