import { requireProfile } from '@/lib/auth'
import ReportsDashboard from '@/components/reports-dashboard'
import type { Delivery } from '@/lib/types'

export default async function ReportsPage(){
  const {supabase}=await requireProfile(['admin','store_manager','store_staff'])
  const {data}=await supabase.from('deliveries').select('*').order('created_at',{ascending:false}).limit(1500)
  return <div className="fadeIn"><div className="pageHead"><div><div className="eyebrow">RAPORLAMA</div><h1>Operasyon performansı</h1><p>Teslimat kalitesi, sorun oranı ve saha hacmini tek ekranda izle; gerektiğinde CSV olarak dışa aktar.</p></div></div><ReportsDashboard deliveries={(data||[]) as Delivery[]}/></div>
}
