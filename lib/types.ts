export type AppRole = 'admin' | 'store_manager' | 'store_staff' | 'courier'
export type DeliveryStatus = 'new' | 'accepted' | 'en_route' | 'arrived' | 'delivered' | 'failed' | 'cancelled'
export type DeliveryPriority = 'normal' | 'priority' | 'urgent'
export type CourierAvailability = 'offline' | 'available' | 'busy' | 'break'

export type Profile = {
  user_id: string
  org_id: string | null
  store_id: string | null
  full_name: string
  phone: string | null
  role: AppRole | null
  avatar_url: string | null
  is_active: boolean
}

export type Delivery = {
  id: string
  tracking_no: string
  tracking_token: string
  tracking_expires_at: string
  org_id: string
  store_id: string
  created_by: string
  assigned_courier_id: string | null
  customer_name: string
  customer_phone: string
  customer_address: string
  district: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
  location_source?: string | null
  location_precision?: string | null
  location_confirmed_at?: string | null
  order_no: string | null
  product_id: string | null
  product_name: string
  product_model: string | null
  product_image_url: string | null
  quantity: number
  floor_text: string | null
  has_elevator: boolean | null
  install_required: boolean
  old_product_pickup: boolean
  fragile: boolean
  requires_photo: boolean
  requires_signature: boolean
  scheduled_date: string
  time_window: string
  priority: DeliveryPriority
  status: DeliveryStatus
  notes: string | null
  failure_reason: string | null
  route_position: number | null
  planned_service_minutes: number
  last_event_lat: number | null
  last_event_lng: number | null
  last_event_accuracy_m: number | null
  accepted_at: string | null
  en_route_at: string | null
  arrived_at: string | null
  delivered_at: string | null
  failed_at: string | null
  created_at: string
  updated_at: string
}

export type Product = {
  id: string
  sku: string
  category: string
  model: string
  title: string
  specs: Record<string, string | number | boolean | null>
  image_url: string | null
  is_active: boolean
}

export type AppNotification = {
  id: string
  org_id: string
  user_id: string
  delivery_id: string | null
  kind: string
  title: string
  body: string
  data: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export type CourierPresence = {
  user_id: string
  org_id: string
  availability: CourierAvailability
  shift_started_at: string | null
  break_started_at: string | null
  last_heartbeat_at: string
  latitude: number | null
  longitude: number | null
  accuracy_m: number | null
  heading_deg: number | null
  speed_mps: number | null
  updated_at: string
}
