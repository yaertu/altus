import type { DeliveryStatus } from '@/lib/types'

const steps:[DeliveryStatus,string,string][]= [
  ['new','Yeni','1'],['accepted','Alındı','2'],['en_route','Yolda','3'],['arrived','Adreste','4'],['delivered','Teslim','5']
]

const rank:Record<DeliveryStatus,number>={new:0,accepted:1,en_route:2,arrived:3,delivered:4,failed:2,cancelled:0}

export default function DeliveryStatusSteps({status,compact=false}:{status:DeliveryStatus;compact?:boolean}){
  const current=rank[status]
  return <div className={`deliveryStatusSteps ${compact?'compact':''} ${status==='failed'||status==='cancelled'?'isException':''}`}>
    {steps.map(([value,label,num],i)=><div key={value} className={`deliveryStatusStep ${i<current?'done':''} ${i===current?'active':''}`}>
      <span className="statusDot">{i<current?'✓':num}</span><small>{label}</small>
    </div>)}
  </div>
}
