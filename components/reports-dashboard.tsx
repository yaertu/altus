'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, BarChart3, CheckCircle2, Download, FileText, Inbox, PieChart, Timer } from 'lucide-react'
import type { Delivery } from '@/lib/types'

function esc(value:unknown){const s=String(value??'');return `"${s.replace(/"/g,'""')}"`}
function percent(n:number,d:number){return d?Math.round((n/d)*100):0}
function keyOf(date:Date){return date.toISOString().slice(0,10)}

const STATUS_ROWS=[
  {key:'new',label:'Yeni / kabul bekleyen',tone:'blue'},
  {key:'en_route',label:'Yolda',tone:'amber'},
  {key:'arrived',label:'Adreste',tone:'violet'},
  {key:'delivered',label:'Tamamlandı',tone:'green'},
  {key:'failed',label:'Sorunlu',tone:'red'},
  {key:'cancelled',label:'İptal',tone:'gray'},
] as const

export default function ReportsDashboard({deliveries}:{deliveries:Delivery[]}){
  const [range,setRange]=useState<7|30|90>(7)
  const stats=useMemo(()=>{
    const today=new Date();today.setHours(0,0,0,0)
    const cutoff=new Date(today);cutoff.setDate(today.getDate()-(range-1))
    const scoped=deliveries.filter(x=>x.scheduled_date>=keyOf(cutoff)&&x.scheduled_date<=keyOf(today))
    const delivered=scoped.filter(x=>x.status==='delivered')
    const failed=scoped.filter(x=>x.status==='failed')
    const completion=percent(delivered.length,scoped.length)
    const avgMinutes=delivered.length?Math.round(delivered.reduce((sum,d)=>{const start=new Date(d.created_at).getTime();const end=d.delivered_at?new Date(d.delivered_at).getTime():start;return sum+Math.max(0,(end-start)/60000)},0)/delivered.length):0
    const bucketSize=range===7?1:range===30?3:7
    const bucketCount=Math.ceil(range/bucketSize)
    const points=[...Array(bucketCount)].map((_,i)=>{
      const start=new Date(cutoff);start.setDate(cutoff.getDate()+i*bucketSize)
      const end=new Date(start);end.setDate(start.getDate()+bucketSize-1)
      if(end>today)end.setTime(today.getTime())
      const startKey=keyOf(start);const endKey=keyOf(end)
      const rows=scoped.filter(x=>x.scheduled_date>=startKey&&x.scheduled_date<=endKey)
      return {key:startKey,label:start.toLocaleDateString('tr-TR',{day:'numeric',month:'short'}),total:rows.length,done:rows.filter(x=>x.status==='delivered').length}
    })
    return {scoped,delivered,failed,completion,avgMinutes,points,max:Math.max(1,...points.map(x=>x.total))}
  },[deliveries,range])

  function exportCsv(){
    const headers=['Sevkiyat No','Sipariş No','Müşteri','Telefon','Ürün','Adet','Tarih','Saat','Durum','Öncelik','Adres','Sorun']
    const rows=stats.scoped.map(d=>[d.tracking_no,d.order_no,d.customer_name,d.customer_phone,d.product_name,d.quantity,d.scheduled_date,d.time_window,d.status,d.priority,d.customer_address,d.failure_reason])
    const csv='\ufeff'+[headers,...rows].map(r=>r.map(esc).join(';')).join('\n')
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`sevkiyat-raporu-${range}-gun-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url)
  }

  return <div className="reportsWorkspace">
    <div className="reportCommandBar">
      <div className="reportTitle"><span><BarChart3 size={20}/></span><h1>Raporlar</h1></div>
      <div className="reportCommandActions"><div className="rangeSwitch" aria-label="Rapor aralığı">{([7,30,90] as const).map(value=><button type="button" className={range===value?'active':''} onClick={()=>setRange(value)} key={value}>{value} gün</button>)}</div><button className="btn btnGhost" onClick={exportCsv}><Download size={15}/> CSV dışa aktar</button></div>
    </div>

    <div className="reportKpis premiumReportKpis">
      <div><span className="reportKpiIcon success"><CheckCircle2 size={19}/></span><span>Teslimat başarı oranı</span><strong>%{stats.completion}</strong><small>{stats.delivered.length} tamamlandı</small></div>
      <div><span className="reportKpiIcon danger"><AlertTriangle size={19}/></span><span>Sorunlu teslimat</span><strong>{stats.failed.length}</strong><small>%{percent(stats.failed.length,stats.scoped.length)} oran</small></div>
      <div><span className="reportKpiIcon time"><Timer size={19}/></span><span>Ort. çevrim süresi</span><strong>{stats.avgMinutes<60?`${stats.avgMinutes} dk`:`${(stats.avgMinutes/60).toFixed(1)} sa`}</strong><small>oluşturma → teslim</small></div>
      <div><span className="reportKpiIcon neutral"><FileText size={19}/></span><span>Toplam kayıt</span><strong>{stats.scoped.length}</strong><small>son {range} gün</small></div>
    </div>

    <div className="reportMainGrid">
      <section className="panel reportChartPanel">
        <div className="panelHead"><div><h2>Sevkiyat hacmi</h2><p>Planlanan ve tamamlanan teslimatlar.</p></div><div className="chartLegend"><span><i className="legendTotal"/>Planlanan</span><span><i className="legendDone"/>Tamamlanan</span></div></div>
        <div className={`premiumChart ${stats.scoped.length?'':'isEmpty'}`}>
          <div className="chartGrid" aria-hidden="true"><i/><i/><i/><i/><i/></div>
          {stats.scoped.length?<div className="chartBars">{stats.points.map(point=><div className="chartCol" key={point.key}><div className="barTrack"><div className="barTotal" style={{height:`${Math.max(5,(point.total/stats.max)*100)}%`}}><div className="barDone" style={{height:`${point.total?(point.done/point.total)*100:0}%`}}/></div></div><strong>{point.total}</strong><span>{point.label}</span></div>)}</div>:<div className="reportEmptyState"><span><Inbox size={23}/></span><strong>Bu dönem için veri bulunmuyor</strong><p>Seçilen aralıkta planlanan veya tamamlanan teslimat kaydı yok.</p></div>}
        </div>
      </section>

      <section className="panel reportStatusPanel">
        <div className="panelHead"><div><h2><PieChart size={18}/> Operasyon özeti</h2><p>Son {range} günün durum dağılımı.</p></div></div>
        <div className="reportStatusRows">{STATUS_ROWS.map(row=>{const count=stats.scoped.filter(x=>x.status===row.key).length;const rate=percent(count,stats.scoped.length);return <div className={`statusDistribution tone-${row.tone}`} key={row.key}><div><i/><span>{row.label}</span><strong>{count}</strong><b>%{rate}</b></div><em><span style={{width:`${rate}%`}}/></em></div>})}</div>
      </section>
    </div>
  </div>
}
