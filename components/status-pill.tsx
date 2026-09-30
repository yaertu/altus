import { STATUS_LABELS } from '@/lib/constants'
import type { DeliveryStatus } from '@/lib/types'
export default function StatusPill({status}:{status:DeliveryStatus}){ return <span className={`badge s-${status}`}>{STATUS_LABELS[status]}</span> }
