'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AddressMapPicker, { type LocationMeta } from './address-map-picker'
import ProductVisual from './product-visual'
import { createClient } from '@/lib/supabase/client'
import type { CourierAvailability, Product } from '@/lib/types'
import { MapPinned, PackageOpen, CalendarClock, ShieldCheck, Wrench, RotateCcw, Gem, CheckCircle2, AlertCircle } from 'lucide-react'

type Courier={user_id:string;full_name:string;phone:string|null;availability:CourierAvailability}
const availabilityLabel:Record<CourierAvailability,string>={available:'Müsait',busy:'Görevde',break:'Molada',offline:'Çevrimdışı'}

export default function NewDeliveryForm({orgId,storeId,userId,products,couriers,preview=false}:{orgId:string;storeId:string;userId:string;products:Product[];couriers:Courier[];preview?:boolean}){
  const router=useRouter()
  const [saving,setSaving]=useState(false)
  const [err,setErr]=useState('')
  const [productId,setProductId]=useState(products[0]?.id||'__manual__')
  const [manualProduct,setManualProduct]=useState('')
  const [manualModel,setManualModel]=useState('')
  const [customer,setCustomer]=useState('')
  const [phone,setPhone]=useState('')
  const [address,setAddress]=useState('')
  const [district,setDistrict]=useState(preview?'Çorlu':'')
  const [city,setCity]=useState(preview?'Tekirdağ':'')
  const [courierId,setCourierId]=useState('')
  const [date,setDate]=useState(new Date().toISOString().slice(0,10))
  const [timeWindow,setTimeWindow]=useState('12:00 – 15:00')
  const [latitude,setLatitude]=useState<number|null>(null)
  const [longitude,setLongitude]=useState<number|null>(null)
  const [locationMeta,setLocationMeta]=useState<LocationMeta>({provider:'',precision:'',confidence:0,confirmed:false,label:null})
  const [previewNotice,setPreviewNotice]=useState('')
  const product=useMemo(()=>products.find(p=>p.id===productId),[products,productId])
  const courier=useMemo(()=>couriers.find(c=>c.user_id===courierId),[couriers,courierId])
  const today=new Date().toISOString().slice(0,10)

  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setSaving(true);setErr('');setPreviewNotice('')
    if(latitude===null||longitude===null||!locationMeta.confirmed){setSaving(false);setErr('Teslimat konumunu haritada bulup bina/kapı noktasını doğrula.');document.querySelector('.premiumAddressPicker')?.scrollIntoView({behavior:'smooth',block:'center'});return}
    const f=new FormData(e.currentTarget)
    if(preview){setSaving(false);setPreviewNotice('Önizleme tamamlandı • konum doğrulandı ve görev sevkiyata hazır.');return}
    const supabase=createClient()
    const {data,error}=await supabase.from('deliveries').insert({
      org_id:orgId,store_id:storeId,created_by:userId,
      assigned_courier_id:courierId||null,
      customer_name:customer.trim(),customer_phone:phone.trim(),customer_address:address.trim(),
      latitude,longitude,district:district.trim()||null,city:city.trim()||null,
      location_source:locationMeta.provider||'manual',location_precision:locationMeta.precision||'manual',location_confirmed_at:new Date().toISOString(),
      order_no:String(f.get('order_no')||'').trim()||null,
      product_id:product?.id||null,product_name:product?.title||manualProduct.trim()||'Ürün',product_model:product?.model||manualModel.trim()||null,product_image_url:product?.image_url||null,
      quantity:Number(f.get('quantity')||1),floor_text:String(f.get('floor_text')||'').trim()||null,
      has_elevator:f.get('has_elevator')==='yes'?true:f.get('has_elevator')==='no'?false:null,
      install_required:f.get('install_required')==='on',old_product_pickup:f.get('old_product_pickup')==='on',fragile:f.get('fragile')==='on',
      requires_photo:f.get('requires_photo')==='on',requires_signature:f.get('requires_signature')==='on',
      scheduled_date:date,time_window:timeWindow,priority:String(f.get('priority')),
      route_position:Number(f.get('route_position')||0)||null,planned_service_minutes:Number(f.get('planned_service_minutes')||20),
      notes:String(f.get('notes')||'').trim()||null
    }).select('id').single()
    if(error){setErr(error.message);setSaving(false);return}
    router.push(`/deliveries/${data.id}`);router.refresh()
  }

  return <form onSubmit={submit} className="deliveryBuilder fadeIn">
    {err&&<div className="error builderMessage">{err}</div>}
    {previewNotice&&<div className="success builderMessage">{previewNotice}</div>}

    <div className="builderStatusStrip">
      <div><span className={customer.trim()&&phone.trim()?'done':''}>1</span><b>Müşteri</b></div>
      <i>→</i><div><span className={locationMeta.confirmed?'done':''}>2</span><b>Konum</b></div>
      <i>→</i><div><span className={product||manualProduct.trim()?'done':''}>3</span><b>Ürün</b></div>
      <i>→</i><div><span className={courierId?'done':''}>4</span><b>Plan</b></div>
    </div>

    <div className="deliveryBuilderGrid">
      <section className="sectionBox premiumBuilderCard locationBuilderCard">
        <div className="premiumSectionHead"><span className="sectionIcon"><MapPinned size={18}/></span><div><span className="eyebrow">MÜŞTERİ & KONUM</span><h2>Teslimat adresini doğrula</h2></div><span className={`sectionState ${locationMeta.confirmed?'ok':''}`}>{locationMeta.confirmed?'✓ Doğrulandı':'Konum bekliyor'}</span></div>
        <div className="formGrid builderCustomerGrid">
          <div className="field"><label>Ad soyad</label><input className="input" name="customer_name" value={customer} onChange={e=>setCustomer(e.target.value)} required placeholder="Ahmet Yılmaz" autoComplete="name"/></div>
          <div className="field"><label>Telefon</label><input className="input" name="customer_phone" value={phone} onChange={e=>setPhone(e.target.value)} required inputMode="tel" autoComplete="tel" placeholder="05xx xxx xx xx" pattern="[0-9+() ]{10,20}"/></div>
          <div className="field full"><label>Açık adres</label><textarea className="textarea compactAddress" value={address} onChange={e=>{setAddress(e.target.value);setLocationMeta(m=>({...m,confirmed:false}))}} required placeholder="Mahalle, sokak, bina no, daire…"/></div>
          <div className="field"><label>İlçe</label><input className="input" value={district} onChange={e=>{setDistrict(e.target.value);setLocationMeta(m=>({...m,confirmed:false}))}} placeholder="Çorlu"/></div>
          <div className="field"><label>Şehir</label><input className="input" value={city} onChange={e=>{setCity(e.target.value);setLocationMeta(m=>({...m,confirmed:false}))}} placeholder="Tekirdağ"/></div>
        </div>
        <div className="mapPickerField premiumMapField">
          <AddressMapPicker latitude={latitude} longitude={longitude} addressText={address} districtText={district} cityText={city} onAddressSelect={setAddress} onMetaChange={setLocationMeta} onChange={(lat,lng)=>{setLatitude(lat);setLongitude(lng)}}/>
        </div>
      </section>

      <div className="builderSideStack">
        <section className="sectionBox premiumBuilderCard">
          <div className="premiumSectionHead compact"><span className="sectionIcon"><PackageOpen size={18}/></span><div><span className="eyebrow">ÜRÜN</span><h2>Taşınacak ürün</h2></div></div>
          <div className="field"><label>Ürün</label><select className="select" value={productId} onChange={e=>setProductId(e.target.value)}>{products.map(p=><option key={p.id} value={p.id}>{p.model} • {p.title}</option>)}<option value="__manual__">+ Özel ürün</option></select></div>
          {product&&<div className="selectedProductPreview compact"><ProductVisual product={product} size="md"/><div><strong>{product.title}</strong><p>{product.model}</p><div className="productSpecChips">{Object.entries(product.specs||{}).slice(0,3).map(([k,v])=><span key={k}>{String(v)}</span>)}</div></div></div>}
          {productId==='__manual__'&&<div className="miniFormGrid"><div className="field"><label>Ürün adı</label><input className="input" value={manualProduct} onChange={e=>setManualProduct(e.target.value)} required placeholder="Buzdolabı"/></div><div className="field"><label>Model</label><input className="input" value={manualModel} onChange={e=>setManualModel(e.target.value)} placeholder="Model"/></div></div>}
          <div className="miniFormGrid"><div className="field"><label>Adet</label><input className="input" name="quantity" type="number" min="1" max="20" defaultValue="1"/></div><div className="field"><label>Sipariş / fiş no</label><input className="input" name="order_no" placeholder="OPS-1042"/></div><div className="field"><label>Kat / daire</label><input className="input" name="floor_text" placeholder="3. kat / D:7"/></div><div className="field"><label>Asansör</label><select className="select" name="has_elevator" defaultValue="unknown"><option value="unknown">Bilinmiyor</option><option value="yes">Var</option><option value="no">Yok</option></select></div></div>
          <div className="compactToggleGrid">
            <label><input type="checkbox" name="install_required"/><span><Wrench size={14}/> Kurulum</span></label>
            <label><input type="checkbox" name="old_product_pickup"/><span><RotateCcw size={14}/> Eski ürün</span></label>
            <label><input type="checkbox" name="fragile"/><span><Gem size={14}/> Hassas</span></label>
          </div>
        </section>

        <section className="sectionBox premiumBuilderCard">
          <div className="premiumSectionHead compact"><span className="sectionIcon"><CalendarClock size={18}/></span><div><span className="eyebrow">PLANLAMA</span><h2>Zaman ve personel</h2></div>{courier&&<span className={`courierAvailabilityTag a-${courier.availability}`}>{availabilityLabel[courier.availability]}</span>}</div>
          <div className="miniFormGrid"><div className="field"><label>Teslimat günü</label><input className="input" type="date" min={today} value={date} onChange={e=>setDate(e.target.value)} required/></div><div className="field"><label>Saat</label><select className="select" value={timeWindow} onChange={e=>setTimeWindow(e.target.value)}><option>09:00 – 12:00</option><option>12:00 – 15:00</option><option>15:00 – 18:00</option><option>18:00 – 21:00</option></select></div><div className="field full"><label>Sevkiyat personeli</label><select className="select" value={courierId} onChange={e=>setCourierId(e.target.value)}><option value="">Daha sonra ata</option>{couriers.map(c=><option key={c.user_id} value={c.user_id}>{c.full_name} • {availabilityLabel[c.availability]}</option>)}</select></div><div className="field"><label>Öncelik</label><select className="select" name="priority" defaultValue="normal"><option value="normal">Normal</option><option value="priority">Öncelikli</option><option value="urgent">Acil</option></select></div><div className="field"><label>Rota sırası</label><input className="input" name="route_position" type="number" min="1" max="999" placeholder="Örn. 4"/></div><div className="field"><label>Servis süresi</label><select className="select" name="planned_service_minutes" defaultValue="20"><option value="10">10 dk</option><option value="20">20 dk</option><option value="30">30 dk</option><option value="45">45 dk</option><option value="60">60 dk</option></select></div></div>
          <div className="field"><label>Mağaza notu</label><textarea className="textarea compactNote" name="notes" placeholder="Teslimden önce ara, kapı dar, ek parça var…"/></div>
        </section>

        <section className="sectionBox premiumBuilderCard proofBuilderCard">
          <div className="premiumSectionHead compact"><span className="sectionIcon"><ShieldCheck size={18}/></span><div><span className="eyebrow">TESLİMAT KANITI</span><h2>Kapanış doğrulaması</h2></div></div>
          <div className="proofToggleRow"><label><input type="checkbox" name="requires_photo" defaultChecked/><span><b>Fotoğraf</b><small>Zorunlu</small></span></label><label><input type="checkbox" name="requires_signature" defaultChecked/><span><b>İmza</b><small>Zorunlu</small></span></label></div>
        </section>
      </div>
    </div>

    <div className="builderSubmitBar"><div className="submitSummary"><span className={locationMeta.confirmed?'ready':'wait'}>{locationMeta.confirmed?<><CheckCircle2 size={14}/> Konum hazır</>:<><AlertCircle size={14}/> Konumu doğrula</>}</span><b>{customer.trim()||'Müşteri'} • {product?.model||manualModel||'Ürün seçilmedi'}</b></div><div><button type="button" className="btn btnGhost" onClick={()=>router.back()}>Vazgeç</button><button disabled={saving} className="btn btnPrimary btnLarge">{saving?'Kaydediliyor…':'Sevkiyatı oluştur →'}</button></div></div>
  </form>
}
