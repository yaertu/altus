import { notFound } from 'next/navigation'
import AppShell from '@/components/app-shell'
import PreviewAdminPanel from '@/components/preview-admin-panel'
import { previewProfile } from '@/lib/desktop-preview-data'

export default function DesktopPreviewAdmin(){
  if(process.env.NEXT_PUBLIC_DESKTOP_PREVIEW!=='1')notFound()
  return <AppShell profile={previewProfile} organization={{name:'Altus Sevkiyat',brandColor:'#cf006f'}} preview>
    <PreviewAdminPanel/>
  </AppShell>
}
