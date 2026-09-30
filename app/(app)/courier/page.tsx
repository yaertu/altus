import CourierDashboard from '@/components/courier-dashboard'
import { requireProfile } from '@/lib/auth'
import type { Delivery } from '@/lib/types'

export default async function CourierPage(){
  const {supabase,profile,userId}=await requireProfile(['courier'])
  const {data}=await supabase.from('deliveries').select('*').eq('assigned_courier_id',userId).order('created_at',{ascending:false}).limit(100)
  return <CourierDashboard initial={(data||[]) as Delivery[]} userId={userId} orgId={profile.org_id!} name={profile.full_name}/>
}
