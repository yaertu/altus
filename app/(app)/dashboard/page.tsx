import { redirect } from 'next/navigation'
import StoreDashboard from '@/components/store-dashboard'
import { requireProfile } from '@/lib/auth'
import type { CourierAvailability, Delivery } from '@/lib/types'

type PresenceRow={user_id:string;availability:CourierAvailability;last_heartbeat_at:string;latitude:number|null;longitude:number|null;accuracy_m:number|null;heading_deg:number|null;speed_mps:number|null}
type CourierProfileRow={user_id:string;full_name:string;phone:string|null}

export default async function DashboardPage(){
  const {supabase,profile}=await requireProfile()
  if(profile.role==='courier') redirect('/courier')
  const [{data:deliveries},{data:profiles},{data:presence}]=await Promise.all([
    supabase.from('deliveries').select('*').order('created_at',{ascending:false}).limit(300),
    supabase.from('profiles').select('user_id,full_name,phone').eq('org_id',profile.org_id!).eq('role','courier').eq('is_active',true).order('full_name'),
    supabase.from('courier_presence').select('user_id,availability,last_heartbeat_at,latitude,longitude,accuracy_m,heading_deg,speed_mps').eq('org_id',profile.org_id!),
  ])
  const map=new Map<string,PresenceRow>(((presence||[]) as PresenceRow[]).map(x=>[x.user_id,x]))
  const couriers=((profiles||[]) as CourierProfileRow[]).map(p=>({user_id:p.user_id,full_name:p.full_name,phone:p.phone,availability:(map.get(p.user_id)?.availability||'offline') as CourierAvailability,last_heartbeat_at:map.get(p.user_id)?.last_heartbeat_at||null,latitude:map.get(p.user_id)?.latitude??null,longitude:map.get(p.user_id)?.longitude??null,accuracy_m:map.get(p.user_id)?.accuracy_m??null,heading_deg:map.get(p.user_id)?.heading_deg??null,speed_mps:map.get(p.user_id)?.speed_mps??null}))
  return <StoreDashboard initial={(deliveries||[]) as Delivery[]} orgId={profile.org_id!} initialCouriers={couriers}/>
}
