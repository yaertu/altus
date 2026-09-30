import Link from 'next/link'
import { notFound } from 'next/navigation'
import CourierDashboard from '@/components/courier-dashboard'
import { previewDeliveries } from '@/lib/desktop-preview-data'

export default function DesktopCourierPreviewPage(){
  if(process.env.NEXT_PUBLIC_DESKTOP_PREVIEW!=='1')notFound()
  const userId='20000000-0000-4000-8000-000000000001'
  const initial=previewDeliveries.filter(d=>d.assigned_courier_id===userId)
  return <div className="desktopCourierPreview">
    <div className="desktopPreviewBar"><div><span className="eyebrow">MASAÜSTÜ ÖNİZLEME</span><strong>Sevkiyatçı Saha Ekranı</strong></div><div><Link className="btn btnGhost" href="/desktop-preview">← Mağaza operasyonu</Link><Link className="btn btnPrimary" href="/login">Gerçek Giriş</Link></div></div>
    <CourierDashboard initial={initial} userId={userId} orgId="00000000-0000-4000-8000-000000000010" name="Mehmet Kaya" preview/>
  </div>
}
