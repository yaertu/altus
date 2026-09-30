import AppShell from '@/components/app-shell'
import { requireProfile } from '@/lib/auth'
export default async function ProtectedLayout({children}:{children:React.ReactNode}){
  const {profile,supabase}=await requireProfile()
  const {data:org}=await supabase.from('organizations').select('name,brand_color').eq('id',profile.org_id!).single()
  return <AppShell profile={profile} organization={{name:org?.name||'Altus Sevkiyat',brandColor:org?.brand_color||'#cf006f'}}>{children}</AppShell>
}
