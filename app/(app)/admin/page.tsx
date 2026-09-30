import {requireProfile} from '@/lib/auth'
import AdminPanel from '@/components/admin-panel'
import ProductMediaManager from '@/components/product-media-manager'
import AdminGrowthCenter from '@/components/admin-growth-center'
import type {Product} from '@/lib/types'
import type {CourierPromotion} from '@/lib/courier-growth'
import { Building2, Package, Trophy, UsersRound } from 'lucide-react'

type ProductMediaRow={product_id:string;image_url:string}
type AdminUserRow={user_id:string;full_name:string;phone:string|null;role:string|null;is_active:boolean;store_id:string|null}
type ScoreRow={user_id:string;points:number;delivered_count:number;failed_count:number;courier_cancel_count:number;streak_days:number;suspended_reason?:string|null}
type PenaltyRow={id:string;courier_id:string;reason:string;points_delta:number;suspended:boolean;status:string;created_at:string;lifted_at:string|null;lift_note:string|null}
type ScoreEventRow={id:string;courier_id:string;points_delta:number;event_key:string;reason:string|null;created_at:string}
const defaultSettings={daily_cancel_limit:5,auto_suspend:true,accepted_points:5,arrived_points:10,delivered_points:100,courier_cancel_points:-75}

export default async function AdminPage(){
  const {supabase,profile,userId}=await requireProfile(['admin'])
  const [usersRes,storesRes,orgRes,deliveryRes,productsRes,mediaRes,promosRes,scoresRes,settingsRes]=await Promise.all([
    supabase.from('profiles').select('user_id,full_name,phone,role,is_active,store_id').eq('org_id',profile.org_id!).order('full_name'),
    supabase.from('stores').select('id,name').eq('org_id',profile.org_id!).eq('is_active',true).order('name'),
    supabase.from('organizations').select('name,brand_color,support_phone').eq('id',profile.org_id!).single(),
    supabase.from('deliveries').select('id',{count:'exact',head:true}).eq('org_id',profile.org_id!),
    supabase.from('products').select('*').eq('is_active',true).order('category').order('model'),
    supabase.from('product_media').select('product_id,image_url').eq('org_id',profile.org_id!),
    supabase.from('courier_promotions').select('*').eq('org_id',profile.org_id!).order('created_at',{ascending:false}),
    supabase.from('courier_scores').select('user_id,points,delivered_count,failed_count,courier_cancel_count,streak_days,suspended_reason').eq('org_id',profile.org_id!).order('points',{ascending:false}),
    supabase.from('gamification_settings').select('*').eq('org_id',profile.org_id!).maybeSingle(),
  ])
  const users=(usersRes.data||[]) as AdminUserRow[]
  const stores=storesRes.data||[]
  const products=(productsRes.data||[]) as Product[]
  const imageMap=new Map<string,string>(((mediaRes.data||[]) as ProductMediaRow[]).map(x=>[x.product_id,x.image_url]))
  const enrichedProducts=products.map(p=>({...p,image_url:imageMap.get(p.id)||p.image_url||null}))
  const schemaReady=!promosRes.error&&!scoresRes.error&&!settingsRes.error
  const [penaltiesRes,scoreEventsRes]=schemaReady?await Promise.all([
    supabase.from('courier_penalties').select('id,courier_id,reason,points_delta,suspended,status,created_at,lifted_at,lift_note').eq('org_id',profile.org_id!).order('created_at',{ascending:false}).limit(100),
    supabase.from('courier_score_events').select('id,courier_id,points_delta,event_key,reason,created_at').eq('org_id',profile.org_id!).order('created_at',{ascending:false}).limit(150),
  ]):[{data:[]},{data:[]}]

  return <div className="fadeIn adminPage">
    <div className="adminCommandBar"><h1>Yönetim</h1><div className="adminPageMeta"><span>{deliveryRes.count||0} sevkiyat</span><span>{users.filter(x=>x.role==='courier').length} sevkiyatçı</span></div></div>
    <nav className="adminSectionNav" aria-label="Yönetim bölümleri">
      <a href="#courier-growth"><Trophy size={16}/> Kurye gelişimi</a>
      <a href="#team-access"><UsersRound size={16}/> Ekip ve yetkiler</a>
      <a href="#products"><Package size={16}/> Ürünler</a>
      <a href="#team-access"><Building2 size={16}/> Organizasyon</a>
    </nav>
    <div className="stack">
      <section id="courier-growth" className="adminAnchorSection"><AdminGrowthCenter orgId={profile.org_id!} adminUserId={userId} users={users} scores={(scoresRes.data||[]) as ScoreRow[]} promotions={(promosRes.data||[]) as CourierPromotion[]} settings={{...defaultSettings,...(settingsRes.data||{})}} products={enrichedProducts} schemaReady={schemaReady} penalties={(penaltiesRes.data||[]) as PenaltyRow[]} scoreEvents={(scoreEventsRes.data||[]) as ScoreEventRow[]}/></section>
      <section id="team-access" className="adminAnchorSection"><AdminPanel users={users} stores={stores} orgId={profile.org_id!} organization={orgRes.data||{name:'Altus Sevkiyat',brand_color:'#d10072',support_phone:null}}/></section>
      <section id="products" className="adminAnchorSection"><ProductMediaManager orgId={profile.org_id!} products={enrichedProducts}/></section>
    </div>
  </div>
}
