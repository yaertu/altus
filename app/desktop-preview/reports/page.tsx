import { notFound } from 'next/navigation'
import AppShell from '@/components/app-shell'
import ReportsDashboard from '@/components/reports-dashboard'
import { previewDeliveries, previewProfile } from '@/lib/desktop-preview-data'

export default function DesktopPreviewReports(){
  if(process.env.NEXT_PUBLIC_DESKTOP_PREVIEW!=='1')notFound()
  return <AppShell profile={previewProfile} organization={{name:'Altus Sevkiyat',brandColor:'#cf006f'}} preview>
    <div className="pageHead modernPageHead"><div><div className="eyebrow">RAPORLAR • MASAÜSTÜ ÖNİZLEME</div><h1>Operasyon raporları</h1><p>Teslimat başarı oranı, sorunlar, yoğunluk ve dışa aktarım tek ekranda.</p></div></div>
    <ReportsDashboard deliveries={previewDeliveries}/>
  </AppShell>
}
