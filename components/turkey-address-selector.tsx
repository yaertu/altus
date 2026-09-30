'use client'

import {useEffect,useRef,useState} from 'react'
import {Building2,MapPin,MapPinned} from 'lucide-react'

type Unit={id:number;name:string;postalCode?:string|null}
export type TurkeyAddressValue={city:string;district:string;neighborhood:string;street:string;buildingNo:string;apartmentNo:string;postalCode:string;formattedAddress:string}
type Props={initialCity?:string;initialDistrict?:string;onChange:(value:TurkeyAddressValue)=>void}

const pretty=(s:string)=>s.toLocaleLowerCase('tr-TR').replace(/(^|\s)\S/g,m=>m.toLocaleUpperCase('tr-TR'))

export default function TurkeyAddressSelector({initialCity='',initialDistrict='',onChange}:Props){
  const cb=useRef(onChange);cb.current=onChange
  const [provinces,setProvinces]=useState<Unit[]>([])
  const [districts,setDistricts]=useState<Unit[]>([])
  const [neighborhoods,setNeighborhoods]=useState<Unit[]>([])
  const [provinceId,setProvinceId]=useState(0)
  const [districtId,setDistrictId]=useState(0)
  const [neighborhood,setNeighborhood]=useState('')
  const [street,setStreet]=useState('')
  const [buildingNo,setBuildingNo]=useState('')
  const [apartmentNo,setApartmentNo]=useState('')
  const [postalCode,setPostalCode]=useState('')
  const [loading,setLoading]=useState(false)
  const [note,setNote]=useState('')

  useEffect(()=>{void(async()=>{try{const r=await fetch('/api/address/admin-units?level=provinces');const j=await r.json();const list=(j.items||[]) as Unit[];setProvinces(list);if(initialCity){const found=list.find(x=>x.name.localeCompare(initialCity,'tr',{sensitivity:'base'})===0);if(found)setProvinceId(found.id)}}catch{setNote('İl listesi alınamadı; açık adresi elle girebilirsin.')}})()},[])
  useEffect(()=>{if(!provinceId){setDistricts([]);return}setLoading(true);void fetch(`/api/address/admin-units?level=districts&provinceId=${provinceId}`).then(r=>r.json()).then(j=>{const list=(j.items||[]) as Unit[];setDistricts(list);if(initialDistrict){const f=list.find(x=>x.name.localeCompare(initialDistrict,'tr',{sensitivity:'base'})===0);if(f)setDistrictId(f.id)}}).catch(()=>setNote('İlçe listesi alınamadı.')).finally(()=>setLoading(false))},[provinceId])
  useEffect(()=>{if(!provinceId||!districtId){setNeighborhoods([]);return}setLoading(true);const d=districts.find(x=>x.id===districtId);if(d?.postalCode)setPostalCode(d.postalCode);void fetch(`/api/address/admin-units?level=neighborhoods&provinceId=${provinceId}&districtId=${districtId}`).then(r=>r.json()).then(j=>setNeighborhoods((j.items||[]) as Unit[])).catch(()=>setNote('Mahalle listesi alınamadı.')).finally(()=>setLoading(false))},[provinceId,districtId,districts])

  useEffect(()=>{
    const city=pretty(provinces.find(x=>x.id===provinceId)?.name||'')
    const district=pretty(districts.find(x=>x.id===districtId)?.name||'')
    const parts=[neighborhood&&`${pretty(neighborhood)} Mah.`,street,buildingNo&&`No:${buildingNo}`,apartmentNo&&`D:${apartmentNo}`,district,city,postalCode].filter(Boolean)
    cb.current({city,district,neighborhood:pretty(neighborhood),street,buildingNo,apartmentNo,postalCode,formattedAddress:parts.join(', ')})
  },[provinceId,districtId,neighborhood,street,buildingNo,apartmentNo,postalCode,provinces,districts])

  return <div className="turkeyAddressSelector">
    <div className="addressHierarchyHead"><MapPinned size={17}/><div><strong>Türkiye adres ağacı</strong><small>81 il → ilçe → mahalle → sokak / bina / daire</small></div>{loading&&<span>Yükleniyor…</span>}</div>
    <div className="addressHierarchyGrid">
      <label><span>İl</span><select className="select" value={provinceId||''} onChange={e=>{setProvinceId(Number(e.target.value));setDistrictId(0);setNeighborhood('')}}><option value="">İl seç</option>{provinces.map(x=><option key={x.id} value={x.id}>{pretty(x.name)}</option>)}</select></label>
      <label><span>İlçe</span><select className="select" value={districtId||''} disabled={!provinceId} onChange={e=>{setDistrictId(Number(e.target.value));setNeighborhood('')}}><option value="">İlçe seç</option>{districts.map(x=><option key={x.id} value={x.id}>{pretty(x.name)}</option>)}</select></label>
      <label><span>Mahalle</span><select className="select" value={neighborhood} disabled={!districtId} onChange={e=>setNeighborhood(e.target.value)}><option value="">Mahalle seç</option>{neighborhoods.map(x=><option key={x.id} value={x.name}>{pretty(x.name)}</option>)}</select></label>
      <label><span>Posta kodu</span><input className="input" value={postalCode} onChange={e=>setPostalCode(e.target.value.replace(/\D/g,'').slice(0,5))} inputMode="numeric" placeholder="59850"/></label>
      <label className="wide"><span>Sokak / cadde / bulvar</span><div className="addressIconInput"><MapPin size={14}/><input className="input" value={street} onChange={e=>setStreet(e.target.value)} placeholder="Örn. Atatürk Bulvarı"/></div></label>
      <label><span>Bina no</span><input className="input" value={buildingNo} onChange={e=>setBuildingNo(e.target.value)} placeholder="24/A"/></label>
      <label><span>Daire</span><input className="input" value={apartmentNo} onChange={e=>setApartmentNo(e.target.value)} placeholder="7"/></label>
    </div>
    <div className="addressDataNote"><Building2 size={13}/><span>İdari seçim açık veriyle yapılır; gerçek bina girişi aşağıdaki haritada pin ile ayrıca doğrulanır.</span></div>
    {note&&<small className="addressHierarchyError">{note}</small>}
  </div>
}
