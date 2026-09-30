import type {CSSProperties,ReactNode} from 'react'
import {Award,Flame,Medal,ShieldAlert,Sparkles,Star,Trophy,Zap} from 'lucide-react'
import AvatarCropper from './avatar-cropper'
import {COURIER_RANKS,getRankProgress,performanceStars,type CourierPromotion,type CourierScore,type CourierScoreEvent,promotionProgress} from '@/lib/courier-growth'

type DeliveredLite={product_id:string|null;delivered_at:string|null}
type Props={
  userId:string
  name:string
  phone:string|null
  avatarUrl:string|null
  score:CourierScore
  promotions:CourierPromotion[]
  deliveries:DeliveredLite[]
  events:CourierScoreEvent[]
  active:boolean
  schemaReady?:boolean
  children?:ReactNode
}

function rewardText(p:CourierPromotion){return p.reward_label||((p.reward_amount||0)>0?`${p.reward_amount} ₺ ek ödül`:'Özel ödül')}

export default function CourierGrowthProfile({userId,name,phone,avatarUrl,score,promotions,deliveries,events,active,schemaReady=true,children}:Props){
  const rp=getRankProgress(score.points)
  const stars=performanceStars(rp.current.rankNo)
  const roadmap=COURIER_RANKS.slice(Math.max(0,rp.current.rankNo-2),Math.min(COURIER_RANKS.length,rp.current.rankNo+5))
  const style={'--rank':rp.current.accent,'--rank-glow':rp.current.glow} as CSSProperties
  return <div className="growthProfile">
    <section className={`courierProfileHero rankAnim-${rp.current.animationKey} rankFrame-${rp.current.frameStyle}`} style={style}>
      <div className="profileHeroIdentity">
        <AvatarCropper userId={userId} currentUrl={avatarUrl} name={name} enabled={schemaReady}/>
        <div className="profileHeroCopy"><span className="eyebrow">SEVKİYAT PERSONELİ • RÜTBE {rp.current.rankNo}/60</span><h1>{name}</h1><p>{phone||'Telefon bilgisi eklenmemiş'}</p><div className="rankTitleChip"><Medal size={15}/>{rp.current.title}</div></div>
      </div>
      <div className="profileHeroLevel">
        <div className="levelHeadline"><span><Trophy size={17}/> Seviye {rp.current.rankNo}</span><b>{score.points.toLocaleString('tr-TR')} XP</b></div>
        <div className="rankProgress"><i style={{width:`${rp.percent}%`}}/></div>
        <small>{rp.next?`${rp.next.title} için ${rp.remaining.toLocaleString('tr-TR')} XP kaldı`:'En üst rütbeye ulaştın.'}</small>
        <div className="profileStars" aria-label={`${stars} performans yıldızı`}>{Array.from({length:6},(_,i)=><Star key={i} size={18} fill={i<stars?'currentColor':'none'} className={i<stars?'earned':''}/>)}</div>
      </div>
    </section>

    <section className="growthKpis">
      <div><span><Zap size={18}/></span><strong>{score.points.toLocaleString('tr-TR')}</strong><small>Toplam XP</small></div>
      <div><span><Star size={18}/></span><strong>{stars}/6</strong><small>Performans yıldızı</small></div>
      <div><span><Award size={18}/></span><strong>{score.delivered_count}</strong><small>Başarılı teslimat</small></div>
      <div><span><Flame size={18}/></span><strong>{score.streak_days}</strong><small>Günlük seri</small></div>
    </section>

    <section className="panel growthSection careerRoadmapSection">
      <div className="panelHead"><div><span className="eyebrow">KARİYER YOLU</span><h2>Sonraki rütbeler</h2><p>Her kademe yeni unvan, renk ve profil çerçevesi açar.</p></div><Trophy size={20}/></div>
      <div className="careerRoadmap">{roadmap.map(rank=><div key={rank.rankNo} className={`careerRankCard ${rank.rankNo===rp.current.rankNo?'current':''} ${rank.rankNo<rp.current.rankNo?'done':''}`} style={{'--rank':rank.accent,'--rank-glow':rank.glow} as CSSProperties}><span>{rank.rankNo}</span><div><strong>{rank.title}</strong><small>{rank.minPoints.toLocaleString('tr-TR')} XP</small></div><i>{rank.rankNo<rp.current.rankNo?'✓':rank.rankNo===rp.current.rankNo?'Şimdi':'Kilitli'}</i></div>)}</div>
    </section>

    <section className="panel growthSection promotionSection">
      <div className="panelHead"><div><span className="eyebrow">EK KAZANÇ & HEDEFLER</span><h2>Aktif promosyonlar</h2><p>Yönetimin tanımladığı hedefleri tamamla, ödülünü aç.</p></div><Sparkles size={20}/></div>
      {!schemaReady?<div className="growthEmpty">Promosyon ve gerçek XP altyapısı production veritabanında henüz etkin değil. Mevcut teslimat verilerin korunuyor.</div>:promotions.length?<div className="promotionRail">{promotions.map(p=>{const current=promotionProgress(p,deliveries,score.points);const pct=Math.min(100,Math.round(current/Math.max(1,p.target_count)*100));return <article key={p.id} className={`promotionCard theme-${p.theme||'magenta'}`}>
        <div className="promoTop"><span>{p.target_type==='deliveries'?'TESLİMAT':p.target_type==='selected_products'?'SEÇİLİ ÜRÜN':'PUAN HEDEFİ'}</span><b>{rewardText(p)}</b></div>
        <h3>{p.title}</h3><p>{p.description}</p>
        <div className="promoProgress"><i style={{width:`${pct}%`}}/></div>
        <div className="promoFoot"><strong>{current}/{p.target_count}</strong><span>%{pct}</span></div>
      </article>})}</div>:<div className="growthEmpty">Şu anda aktif promosyon yok. Yeni hedef açıldığında burada görünecek.</div>}
    </section>

    <div className="growthProfileGrid">
      <section className="panel growthSection"><div className="panelHead"><div><span className="eyebrow">PUAN HAREKETLERİ</span><h2>Son performans kayıtları</h2></div></div>
        {events.length?<div className="scoreEventList">{events.map(e=><div key={e.id}><span className={e.points_delta>=0?'scorePlus':'scoreMinus'}>{e.points_delta>=0?'+':''}{e.points_delta} XP</span><div><strong>{e.reason||e.event_key.replaceAll('_',' ')}</strong><small>{new Date(e.created_at).toLocaleString('tr-TR')}</small></div></div>)}</div>:<div className="growthEmpty compact">İlk puan hareketin teslimat tamamlandığında oluşacak.</div>}
      </section>
      <section className={`panel growthSection disciplineCard ${active?'ok':'blocked'}`}><div className="disciplineIcon">{active?<Award size={22}/>:<ShieldAlert size={22}/>}</div><div><span className="eyebrow">HESAP DURUMU</span><h2>{active?'Göreve uygun':'Hesap incelemede'}</h2><p>{active?'Performans kuralların normal. Sorun ve kurye kaynaklı iptaller yönetici incelemesinden sonra puana yansır.':score.suspended_reason||'Yönetici hesabı yeniden açana kadar yeni görev alınamaz.'}</p><div className="disciplineStats"><span>Kurye iptali <b>{score.courier_cancel_count}</b></span><span>Sorun kaydı <b>{score.failed_count}</b></span></div></div></section>
    </div>
    {children}
  </div>
}
