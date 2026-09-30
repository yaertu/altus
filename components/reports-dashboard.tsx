'use client'

import { useMemo } from 'react'
import type { Delivery } from '@/lib/types'

function esc(value:unknown){const s=String(value??'');return `"${s.replace(/"/g,'""')}"`}
function percent(n:number,d:number){return d?Math.round((n/d)*100):0}

export default function ReportsDashboard({deliveries}:{deliveries:Delivery[]}){
  const stats=useMemo(()=>{
    const delivered=deliveries.filter(x=>x.status==='delivered')
    const failed=deliveries.filter(x=>x.status==='failed')
    const completion=percent(delivered.length,deliveries.length)
    const avgMinutes=delivered.length?Math.round(delivered.reduce((sum,d)=>{const start=new Date(d.created_at).getTime();const end=d.delivered_at?new Date(d.delivered_at).getTime():start;return sum+Math.max(0,(end-start)/60000)},0)/delivered.length):0
    const days=[...Array(7)].map((_,i)=>{const dt=new Date();dt.setDate(dt.getDate()-(6-i));const key=dt.toISOString().slice(0,10);return {key,label:dt.toLocaleDateString('tr-TR',{weekday:'short'}),total:deliveries.filter(x=>x.scheduled_date===key).length,done:deliveries.filter(x=>x.scheduled_date===key&&x.status==='delivered').length}})
    return {delivered,failed,completion,avgMinutes,days,max:Math.max(1,...days.map(x=>x.total))}
  },[deliveries])

  function exportCsv(){
    const headers=['Sevkiyat No','Sipariş No','Müşteri','Telefon','Ürün','Adet','Tarih','Saat','Durum','Öncelik','Adres','Sorun']
    const rows=deliveries.map(d=>[d.tracking_no,d.order_no,d.customer_name,d.customer_phone,d.product_name,d.quantity,d.scheduled_date,d.time_window,d.status,d.priority,d.customer_address,d.failure_reason])
    const csv='\ufeff'+[headers,...rows].map(r=>r.map(esc).join(';')).join('\n')
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`sevkiyat-raporu-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url)
  }

  return <div className="stack">
    <div className="reportKpis"><div><span>Teslimat başarı oranı</span><strong>%{stats.completion}</strong><small>{stats.delivered.length} tamamlandı</small></div><div><span>Sorunlu teslimat</span><strong>{stats.failed.length}</strong><small>%{percent(stats.failed.length,deliveries.length)} oran</small></div><div><span>Ort. çevrim süresi</span><strong>{stats.avgMinutes<60?`${stats.avgMinutes} dk`:`${(stats.avgMinutes/60).toFixed(1)} sa`}</strong><small>oluşturma → teslim</small></div><div><span>Toplam kayıt</span><strong>{deliveries.length}</strong><small>rapor kapsamı</small></div></div>
    <div className="panel"><div className="panelHead"><div><h2>Son 7 gün sevkiyat hacmi</h2><p>Planlanan toplam işler ve tamamlanan teslimatlar.</p></div><button className="btn btnGhost" onClick={exportCsv}>CSV dışa aktar ↓</button></div><div className="chartBars">{stats.days.map(day=><div className="chartCol" key={day.key}><div className="barTrack"><div className="barTotal" style={{height:`${Math.max(8,(day.total/stats.max)*100)}%`}}><div className="barDone" style={{height:`${day.total?Math.max(0,(day.done/day.total)*100):0}%`}}/></div></div><strong>{day.total}</strong><span>{day.label}</span></div>)}</div><div className="chartLegend"><span><i className="legendTotal"/>Planlanan</span><span><i className="legendDone"/>Tamamlanan</span></div></div>
    <div className="panel"><div className="panelHead"><div><h2>Operasyon özeti</h2><p>Satış sonrası takip ve yönetim raporları için temel veri seti.</p></div></div><div className="reportRows"><div><span>Yeni / kabul bekleyen</span><strong>{deliveries.filter(x=>x.status==='new').length}</strong></div><div><span>Yolda</span><strong>{deliveries.filter(x=>x.status==='en_route').length}</strong></div><div><span>Adreste</span><strong>{deliveries.filter(x=>x.status==='arrived').length}</strong></div><div><span>İptal</span><strong>{deliveries.filter(x=>x.status==='cancelled').length}</strong></div><div><span>Öncelikli + acil</span><strong>{deliveries.filter(x=>x.priority!=='normal').length}</strong></div><div><span>Eski ürün alımı</span><strong>{deliveries.filter(x=>x.old_product_pickup).length}</strong></div></div></div>
  </div>
}
