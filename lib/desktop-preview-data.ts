import type { Delivery, Profile, Product } from '@/lib/types'

const now='2026-09-30T00:10:00+03:00'
const yesterday='2026-09-29T17:35:00+03:00'

export const previewProfile:Profile={
  user_id:'00000000-0000-4000-8000-000000000001',
  org_id:'00000000-0000-4000-8000-000000000010',
  store_id:'00000000-0000-4000-8000-000000000020',
  full_name:'Ertu Caymaz',phone:'0555 000 00 00',role:'admin',avatar_url:null,is_active:true,
}

const base={
  tracking_token:'00000000-0000-4000-8000-000000000099',
  tracking_expires_at:'2026-10-14T23:59:59+03:00',
  org_id:'00000000-0000-4000-8000-000000000010',
  store_id:'00000000-0000-4000-8000-000000000020',
  created_by:'00000000-0000-4000-8000-000000000001',
  district:'Çorlu',city:'Tekirdağ',latitude:null,longitude:null,product_id:null,product_image_url:null,
  floor_text:'3. Kat / Daire 7',has_elevator:true,install_required:true,old_product_pickup:false,fragile:false,
  requires_photo:true,requires_signature:true,scheduled_date:'2026-09-30',time_window:'12:00 – 15:00',priority:'normal' as const,
  failure_reason:null,
  planned_service_minutes:25,last_event_lat:null,last_event_lng:null,last_event_accuracy_m:null,
  accepted_at:null,en_route_at:null,arrived_at:null,delivered_at:null,failed_at:null,created_at:now,updated_at:now,
}

export const previewDeliveries:Delivery[]=[
  {...base,id:'10000000-0000-4000-8000-000000000001',tracking_no:'ALT-260930-001021',assigned_courier_id:'20000000-0000-4000-8000-000000000001',latitude:41.1594,longitude:27.8047,customer_name:'Ayşe Yılmaz',customer_phone:'0532 411 22 31',customer_address:'Kazımiye Mah. Salih Omurtak Cad. No:28 D:7, Çorlu / Tekirdağ',order_no:'SP-10482',product_name:'No-Frost Buzdolabı',product_model:'ALK 484 XIE',product_image_url:'/product-fallback/fridge.svg',quantity:1,route_position:1,status:'en_route',priority:'urgent',notes:'Teslimden 15 dakika önce aransın. Kurulum yapılacak.',accepted_at:'2026-09-30T09:12:00+03:00',en_route_at:'2026-09-30T10:04:00+03:00'},
  {...base,id:'10000000-0000-4000-8000-000000000002',tracking_no:'ALT-260930-001022',assigned_courier_id:'20000000-0000-4000-8000-000000000001',latitude:41.1650,longitude:27.8125,customer_name:'Mehmet Arslan',customer_phone:'0544 327 18 90',customer_address:'Muhittin Mah. Bağlariçi 2. Sok. No:14, Çorlu / Tekirdağ',order_no:'SP-10483',product_name:'Çamaşır Makinesi',product_model:'AL CM 121460 D',product_image_url:'/product-fallback/washer.svg',quantity:1,route_position:2,status:'new',priority:'priority',notes:'Eski ürün teslim sırasında alınacak.',old_product_pickup:true,created_at:'2026-09-30T00:00:00+03:00'},
  {...base,id:'10000000-0000-4000-8000-000000000003',tracking_no:'ALT-260930-001023',assigned_courier_id:'20000000-0000-4000-8000-000000000002',latitude:41.1582,longitude:27.7960,customer_name:'Selin Demir',customer_phone:'0507 220 48 16',customer_address:'Reşadiye Mah. Şinasi Kurşun Cad. No:41 D:12, Çorlu / Tekirdağ',order_no:'SP-10484',product_name:'Google TV',product_model:'AL43 UHD 9823',product_image_url:'/product-fallback/tv.svg',quantity:1,route_position:1,status:'accepted',priority:'normal',notes:'Kutu hasarı kontrol edilerek teslim edilsin.',fragile:true,accepted_at:'2026-09-30T09:34:00+03:00'},
  {...base,id:'10000000-0000-4000-8000-000000000004',tracking_no:'ALT-260930-001019',assigned_courier_id:'20000000-0000-4000-8000-000000000003',latitude:41.1515,longitude:27.8090,customer_name:'Hakan Kaya',customer_phone:'0551 487 55 02',customer_address:'Kemalettin Mah. Menekşe Sok. No:5, Çorlu / Tekirdağ',order_no:'SP-10479',product_name:'Bulaşık Makinesi',product_model:'AL 445 NX',product_image_url:'/product-fallback/dishwasher.svg',quantity:1,route_position:1,status:'delivered',priority:'normal',notes:null,accepted_at:yesterday,en_route_at:yesterday,arrived_at:yesterday,delivered_at:yesterday,created_at:yesterday,updated_at:yesterday},
  {...base,id:'10000000-0000-4000-8000-000000000005',tracking_no:'ALT-260929-001014',assigned_courier_id:'20000000-0000-4000-8000-000000000002',latitude:41.1690,longitude:27.7980,customer_name:'Deniz Akın',customer_phone:'0538 199 74 62',customer_address:'Hürriyet Mah. Erdal İnönü Cad. No:52 D:2, Çorlu / Tekirdağ',order_no:'SP-10472',product_name:'Kurutma Makinesi',product_model:'AL KM 1160',product_image_url:'/product-fallback/dryer.svg',quantity:1,route_position:3,status:'failed',priority:'normal',notes:null,failure_reason:'Müşteriye ulaşılamadı',scheduled_date:'2026-09-29',created_at:yesterday,updated_at:yesterday,failed_at:yesterday},
]

export const previewCouriers=[
  {user_id:'20000000-0000-4000-8000-000000000001',full_name:'Mehmet Kaya',phone:'0555 111 20 30',availability:'busy' as const,last_heartbeat_at:'2026-09-30T00:09:20+03:00',latitude:41.1591,longitude:27.8022,accuracy_m:18,heading_deg:72,speed_mps:8.5},
  {user_id:'20000000-0000-4000-8000-000000000002',full_name:'Can Demir',phone:'0555 222 30 40',availability:'available' as const,last_heartbeat_at:'2026-09-30T00:08:10+03:00',latitude:41.1642,longitude:27.8117,accuracy_m:24,heading_deg:118,speed_mps:0},
  {user_id:'20000000-0000-4000-8000-000000000003',full_name:'Serkan Aydın',phone:'0555 333 40 50',availability:'break' as const,last_heartbeat_at:'2026-09-30T00:06:42+03:00',latitude:41.1518,longitude:27.7974,accuracy_m:31,heading_deg:245,speed_mps:0},
]

export const previewProducts:Product[]=[
  {id:'30000000-0000-4000-8000-000000000001',sku:'ALK-484-XIE',category:'Buzdolabı',model:'ALK 484 XIE',title:'No-Frost Buzdolabı',specs:{hacim:'580 L',renk:'Gümüş'},image_url:null,is_active:true},
  {id:'30000000-0000-4000-8000-000000000002',sku:'AL-CM-121460-D',category:'Çamaşır Makinesi',model:'AL CM 121460 D',title:'Çamaşır Makinesi',specs:{kapasite:'12 kg',devir:'1400 rpm'},image_url:null,is_active:true},
  {id:'30000000-0000-4000-8000-000000000003',sku:'AL-KM-1160',category:'Kurutma Makinesi',model:'AL KM 1160',title:'Isı Pompalı Kurutma Makinesi',specs:{kapasite:'11 kg'},image_url:null,is_active:true},
]
