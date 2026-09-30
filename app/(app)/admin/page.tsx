import { requireProfile } from '@/lib/auth'
import AdminPanel from '@/components/admin-panel'
import ProductMediaManager from '@/components/product-media-manager'
import type { Product } from '@/lib/types'

type ProductMediaRow={product_id:string;image_url:string}
type AdminUserRow={user_id:string;full_name:string;phone:string|null;role:string|null;is_active:boolean;store_id:string|null}

export default async function AdminPage(){
  const {supabase,profile}=await requireProfile(['admin'])
  const [{data:users},{data:stores},{data:organization},{count:deliveryCount},{data:products},{data:media}]=await Promise.all([
    supabase.from('profiles').select('user_id,full_name,phone,role,is_active,store_id').eq('org_id',profile.org_id!).order('full_name'),
    supabase.from('stores').select('id,name').eq('org_id',profile.org_id!).eq('is_active',true).order('name'),
    supabase.from('organizations').select('name,brand_color,support_phone').eq('id',profile.org_id!).single(),
    supabase.from('deliveries').select('id',{count:'exact',head:true}).eq('org_id',profile.org_id!),
    supabase.from('products').select('*').eq('is_active',true).order('category').order('model'),
    supabase.from('product_media').select('product_id,image_url').eq('org_id',profile.org_id!),
  ])
  const imageMap=new Map<string,string>(((media||[]) as ProductMediaRow[]).map(x=>[x.product_id,x.image_url]))
  const enrichedProducts=((products||[]) as Product[]).map(p=>({...p,image_url:imageMap.get(p.id)||p.image_url||null}))
  return <div className="fadeIn adminPage"><div className="pageHead adminPageHead"><div><div className="eyebrow">YÖNETİM MERKEZİ</div><h1>Organizasyon ve personel</h1><p>Hesaplar, roller, mağazalar ve ürün görselleri tek düzenli yönetim alanında.</p></div><div className="adminPageMeta"><span>{deliveryCount||0} sevkiyat</span><span>{((users||[]) as AdminUserRow[]).filter(x=>x.role==='courier').length} sevkiyatçı</span></div></div><div className="stack"><AdminPanel users={users||[]} stores={stores||[]} orgId={profile.org_id!} organization={organization||{name:'Altus Sevkiyat',brand_color:'#d10072',support_phone:null}}/><ProductMediaManager orgId={profile.org_id!} products={enrichedProducts}/></div></div>
}
