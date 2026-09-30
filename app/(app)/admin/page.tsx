import {requireProfile} from '@/lib/auth'
import AdminPanel from '@/components/admin-panel'
import ProductMediaManager from '@/components/product-media-manager'
import AdminGrowthCenter from '@/components/admin-growth-center'
import type {Product} from '@/lib/types'
import type {CourierPromotion} from '@/lib/courier-growth'

type ProductMediaRow={product_id:string;image_url:string}
type AdminUserRow={user_id:string;full_name:string;phone:string|null;role:string|null;is_active:boolean;store_id:string|null}
type ScoreRow={user_id:string;points:number;delivered_count:number;failed_count:number;courier_cancel_count:number;streak_days:number;suspended_reason?:string|null}
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

  return <div className="fadeIn adminPage">
    <div className="pageHead adminPageHead"><div><div className="eyebrow">YÖNETİM MERKEZİ</div><h1>Organizasyon, personel ve performans</h1><p>Hesaplar, mağazalar, promosyonlar, rütbeler, puan/ceza kuralları ve ürün yönetimi tek merkezde.</p></div><div className="adminPageMeta"><span>{deliveryRes.count||0} sevkiyat</span><span>{users.filter(x=>x.role==='courier').length} sevkiyatçı</span></div></div>
    <div className="stack">
      <AdminGrowthCenter orgId={profile.org_id!} adminUserId={userId} users={users} scores={(scoresRes.data||[]) as ScoreRow[]} promotions={(promosRes.data||[]) as CourierPromotion[]} settings={{...defaultSettings,...(settingsRes.data||{})}} products={enrichedProducts} schemaReady={schemaReady}/>
      <AdminPanel users={users} stores={stores} orgId={profile.org_id!} organization={orgRes.data||{name:'Altus Sevkiyat',brand_color:'#d10072',support_phone:null}}/>
      <ProductMediaManager orgId={profile.org_id!} products={enrichedProducts}/>
    </div>
  </div>
}
