import { notFound } from 'next/navigation'
import AppShell from '@/components/app-shell'
import NewDeliveryForm from '@/components/new-delivery-form'
import { previewCouriers, previewProducts, previewProfile } from '@/lib/desktop-preview-data'

export default function DesktopPreviewNewDelivery(){
  if(process.env.NEXT_PUBLIC_DESKTOP_PREVIEW!=='1')notFound()
  return <AppShell profile={previewProfile} organization={{name:'Altus Sevkiyat',brandColor:'#cf006f'}} preview>
    <div className="pageHead modernPageHead compactCreateHead"><div><div className="eyebrow">YENİ SEVKİYAT</div><h1>Teslimat oluştur</h1><p>Müşteri, konum, ürün ve plan.</p></div></div>
    <NewDeliveryForm orgId={previewProfile.org_id!} storeId={previewProfile.store_id!} userId={previewProfile.user_id} products={previewProducts} couriers={previewCouriers.map(x=>({user_id:x.user_id,full_name:x.full_name,phone:x.phone,availability:x.availability}))} preview/>
  </AppShell>
}
