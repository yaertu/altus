import { requireProfile } from '@/lib/auth'
import NewDeliveryForm from '@/components/new-delivery-form'
import type { CourierAvailability, Product } from '@/lib/types'

type PresenceRow={user_id:string;availability:CourierAvailability}
type CourierRow={user_id:string;full_name:string;phone:string|null}
type ProductMediaRow={product_id:string;image_url:string}

export default async function NewDeliveryPage(){
  const {supabase,profile,userId}=await requireProfile(['admin','store_manager','store_staff'])
  if(!profile.store_id) return <div className="error">Bu hesaba mağaza atanmadığı için sevkiyat oluşturulamıyor.</div>

  const [{data:products},{data:couriers},{data:presence},{data:media}]=await Promise.all([
    supabase.from('products').select('*').eq('is_active',true).order('category').order('model'),
    supabase.from('profiles').select('user_id,full_name,phone').eq('org_id',profile.org_id!).eq('role','courier').eq('is_active',true).order('full_name'),
    supabase.from('courier_presence').select('user_id,availability').eq('org_id',profile.org_id!),
    supabase.from('product_media').select('product_id,image_url').eq('org_id',profile.org_id!),
  ])

  const pmap=new Map<string,PresenceRow>(((presence||[]) as PresenceRow[]).map(p=>[p.user_id,p]))
  const enrichedCouriers=((couriers||[]) as CourierRow[]).map(c=>({ ...c, availability:pmap.get(c.user_id)?.availability||'offline' }))
  const imageMap=new Map<string,string>(((media||[]) as ProductMediaRow[]).map(x=>[x.product_id,x.image_url]))
  const enrichedProducts=((products||[]) as Product[]).map(p=>({...p,image_url:imageMap.get(p.id)||p.image_url||null}))

  return <div className="newDeliveryPage">
    <NewDeliveryForm orgId={profile.org_id!} storeId={profile.store_id} userId={userId} products={enrichedProducts} couriers={enrichedCouriers}/>
  </div>
}
