export type RankDefinition={
  rankNo:number
  title:string
  minPoints:number
  accent:string
  glow:string
  animationKey:'pulse'|'orbit'|'shimmer'|'scan'|'spark'|'breathe'
  frameStyle:'solid'|'double'|'dash'|'halo'|'crown'|'neon'
}

export type CourierScore={
  user_id:string
  points:number
  delivered_count:number
  failed_count:number
  courier_cancel_count:number
  streak_days:number
  suspended_reason?:string|null
  updated_at?:string|null
}

export type CourierPromotion={
  id:string
  title:string
  description:string
  target_type:'deliveries'|'selected_products'|'points'
  target_count:number
  reward_amount:number|null
  reward_label:string|null
  product_ids:string[]
  starts_at:string
  ends_at:string
  is_active:boolean
  theme:string
}

export type CourierScoreEvent={
  id:string
  points_delta:number
  event_key:string
  reason:string|null
  created_at:string
}

const TITLES=[
'Acemi Kurye','İlk Adım','Yol Çırağı','Rota Öğrencisi','Dikkatli Taşıyıcı','Yeni Nesil Kurye',
'Mahalle Gözcüsü','Sokak Rehberi','Rota Çırağı','Zaman Takipçisi','Güvenli Taşıyıcı','Seri Başlangıç',
'Teslimat Uzmanı Adayı','Rota Ustası Adayı','Zaman Ustası Adayı','Müşteri Dostu','Paket Koruyucusu','Günlük Hedef Avcısı',
'Rota Ustası','Teslimat Ustası','Zaman Ustası','Şehir Rehberi','Güven Ustası','Seri Teslimatçı',
'Kıdemli Rota Ustası','Kıdemli Teslimatçı','Operasyon Ustası','Bölge Rehberi','Hizmet Yıldızı','Performans Ustası',
'Rota Uzmanı','Teslimat Uzmanı','Saha Uzmanı','Operasyon Uzmanı','Müşteri Deneyimi Uzmanı','Hız ve Güven Uzmanı',
'Şehir Ustası','Bölge Ustası','Saha Lideri','Rota Lideri','Teslimat Lideri','Operasyon Lideri',
'Elit Kurye','Elit Rota Ustası','Elit Teslimatçı','Elit Saha Lideri','Elit Operasyoncu','Altın Rota',
'Platin Rota','Elmas Rota','Usta Rehber','Şehir Efsanesi','Bölge Efsanesi','Teslimat Efsanesi',
'Rota Efsanesi','Operasyon Efsanesi','Lojistik Ustası','Lojistik Eliti','Lojistik Efsanesi','Rota Şampiyonu'
] as const

const ANIMATIONS:RankDefinition['animationKey'][]=['pulse','orbit','shimmer','scan','spark','breathe']
const FRAMES:RankDefinition['frameStyle'][]=['solid','double','dash','halo','crown','neon']

export const COURIER_RANKS:RankDefinition[]=TITLES.map((title,i)=>{
  const rankNo=i+1
  const hue=(328+i*41)%360
  return {
    rankNo,title,
    minPoints:i===0?0:Math.round((i*i*82)+(i*220)),
    accent:`hsl(${hue} 78% 45%)`,
    glow:`hsl(${hue} 92% 65% / .28)`,
    animationKey:ANIMATIONS[i%ANIMATIONS.length],
    frameStyle:FRAMES[i%FRAMES.length],
  }
})

export function getRank(points:number){
  let current=COURIER_RANKS[0]
  for(const rank of COURIER_RANKS){if(points>=rank.minPoints)current=rank;else break}
  return current
}

export function getRankProgress(points:number){
  const current=getRank(points)
  const next=COURIER_RANKS[current.rankNo]||null
  if(!next)return {current,next:null,percent:100,remaining:0}
  const span=Math.max(1,next.minPoints-current.minPoints)
  const progress=Math.max(0,points-current.minPoints)
  return {current,next,percent:Math.min(100,Math.round(progress/span*100)),remaining:Math.max(0,next.minPoints-points)}
}

export function performanceStars(rankNo:number){return Math.min(6,Math.max(0,Math.floor(rankNo/10)))}

export function fallbackScore(userId:string,delivered:number,failed:number):CourierScore{
  return {user_id:userId,points:Math.max(0,delivered*100),delivered_count:delivered,failed_count:failed,courier_cancel_count:0,streak_days:0}
}

export function promotionProgress(p:CourierPromotion,deliveries:{product_id:string|null;delivered_at:string|null}[],points:number){
  if(p.target_type==='points')return Math.min(p.target_count,points)
  const from=new Date(p.starts_at).getTime(),to=new Date(p.ends_at).getTime()
  return deliveries.filter(d=>{
    const at=d.delivered_at?new Date(d.delivered_at).getTime():0
    if(at<from||at>to)return false
    return p.target_type!=='selected_products'||p.product_ids.includes(String(d.product_id||''))
  }).length
}
