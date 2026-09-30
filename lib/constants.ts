import type { DeliveryStatus } from './types'

export const STATUS_LABELS: Record<DeliveryStatus, string> = {
  new: 'Yeni görev',
  accepted: 'Görev alındı',
  en_route: 'Yolda',
  arrived: 'Adreste',
  delivered: 'Teslim edildi',
  failed: 'Sorunlu',
  cancelled: 'İptal edildi',
}

export const NEXT_STATUS: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
  new: 'accepted',
  accepted: 'en_route',
  en_route: 'arrived',
  arrived: 'delivered',
}

export const NEXT_STATUS_LABEL: Partial<Record<DeliveryStatus, string>> = {
  new: 'Görevi Aldım',
  accepted: 'Yola Çıktım',
  en_route: 'Adrese Vardım',
  arrived: 'Teslim Ettim',
}
