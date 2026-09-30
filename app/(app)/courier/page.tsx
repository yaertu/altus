import CourierDashboard from '@/components/courier-dashboard'
import {requireProfile} from '@/lib/auth'
import type {Delivery} from '@/lib/types'
import {fallbackScore,getRank,performanceStars,type CourierPromotion,type CourierScore} from '@/lib/courier-growth'

export default async function CourierPage(){
  const {supabase,profile,userId}=await requireProfile(['courier'])
  const now=new Date().toISOString()
  const [deliveryRes,scoreRes,mediaRes,promoRes]=await Promise.all([
    supabase.from('deliveries').select('*').eq('assigned_courier_id',userId).order('created_at',{ascending:false}).limit(150),
    supabase.from('courier_scores').select('*').eq('user_id',userId).maybeSingle(),
    supabase.from('courier_profile_media').select('avatar_url').eq('user_id',userId).maybeSingle(),
    supabase.from('courier_promotions').select('*').eq('org_id',profile.org_id!).eq('is_active',true).lte('starts_at',now).gte('ends_at',now).order('ends_at').limit(1),
  ])
  const deliveries=(deliveryRes.data||[]) as Delivery[]
  const delivered=deliveries.filter(x=>x.status==='delivered').length
  const failed=deliveries.filter(x=>x.status==='failed').length
  const score=(scoreRes.data as CourierScore|null)||fallbackScore(userId,delivered,failed)
  const rank=getRank(score.points)
  const promo=((promoRes.data||[])[0]||null) as CourierPromotion|null
  const avatarUrl=(mediaRes.data as {avatar_url?:string|null}|null)?.avatar_url||profile.avatar_url||null
  const growth={
    points:score.points,
    rankNo:rank.rankNo,
    rankTitle:rank.title,
    rankColor:rank.accent,
    stars:performanceStars(rank.rankNo),
    avatarUrl,
    promotion:promo?{
      title:promo.title,
      rewardLabel:promo.reward_label||((promo.reward_amount||0)>0?promo.reward_amount+' ₺ ek ödül':'Özel ödül'),
      target:promo.target_count
    }:null
  }
  return <CourierDashboard initial={deliveries} userId={userId} orgId={profile.org_id!} name={profile.full_name} growth={growth}/>
}
