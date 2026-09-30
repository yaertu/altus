import { notFound } from 'next/navigation'
import AppShell from '@/components/app-shell'
import StoreDashboard from '@/components/store-dashboard'
import { previewCouriers, previewDeliveries, previewProfile } from '@/lib/desktop-preview-data'

export default function DesktopPreviewPage(){
  if(process.env.NEXT_PUBLIC_DESKTOP_PREVIEW!=='1')notFound()
  return <AppShell profile={previewProfile} organization={{name:'Altus Sevkiyat',brandColor:'#cf006f'}} preview>
    <StoreDashboard initial={previewDeliveries} orgId={previewProfile.org_id!} initialCouriers={previewCouriers} preview/>
  </AppShell>
}
