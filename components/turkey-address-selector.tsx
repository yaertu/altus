'use client'

import {useEffect,useRef,useState} from 'react'
import {Building2,LoaderCircle,MapPin,MapPinned} from 'lucide-react'

type Unit={id:number;name:string;postalCode?:string|null;officialName?:string|null}
export type TurkeyAddressValue={city:string;district:string;neighborhood:string;street:string;buildingNo:string;apartmentNo:string;postalCode:string;formattedAddress:string}
type Props={initialCity?:string;initialDistrict?:string;onChange:(value:TurkeyAddressValue)=>void}

const pretty=(s:string)=>s.toLocaleLowerCase('tr-TR').replace(/(^|\s)\S/g,m=>m.toLocaleUpperCase('tr-TR'))

export default function TurkeyAddressSelector({initialCity='',initialDistrict='',onChange}:Props){
  const cb=useRef(onChange);cb.current=onChange
  const [provinces,setProvinces]=useState<Unit[]>([])
  const [districts,setDistricts]=useState<Unit[]>([])
  const [neighborhoods,setNeighborhoods]=useState<Unit[]>([])
  const [streetResults,setStreetResults]=useState<Unit[]>([])
  const [provinceId,setProvinceId]=useState(0)
  const [districtId,setDistrictId]=useState(0)
  const [neighborhoodId,setNeighborhoodId]=useState(0)
  const [street,setStreet]=useState('')
  const [buildingNo,setBuildingNo]=useState('')
  const [apartmentNo,setApartmentNo]=useState('')
  const [postalCode,setPostalCode]=useState('')
  const [loading,setLoading]=useState(false)
  const [streetLoading,setStreetLoading]=useState(false)
  const [note,setNote]=useState('')

  const neighborhood=neighborhoods.find(x=>x.id===neighborhoodId)?.name||''

  useEffect(()=>{void(async()=>{
    try{
      const r=await fetch('/api/address/admin-units?level=provinces')
      const j=await r.json()
      const list=(j.items||[]) as Unit[]
      setProvinces(list)
      if(initialCity){
        const found=list.find(x=>x.name.localeCompare(initialCity,'tr',{sensitivity:'base'})===0)
        if(found)setProvinceId(found.id)
      }
    }catch{setNote('İl listesi alınamadı; açık adresi elle girebilirsin.')}
  })()},[])

  useEffect(()=>{
    if(!provinceId){setDistricts([]);setDistrictId(0);return}
    setLoading(true)
    void fetch(`/api/address/admin-units?level=districts&provinceId=${provinceId}`)
      .then(r=>r.json())
      .then(j=>{
        const list=(j.items||[]) as Unit[]
        setDistricts(list)
        if(initialDistrict){
          const f=list.find(x=>x.name.localeCompare(initialDistrict,'tr',{sensitivity:'base'})===0)
          if(f)setDistrictId(f.id)
        }
      })
      .catch(()=>setNote('İlçe listesi alınamadı.'))
      .finally(()=>setLoading(false))
  },[provinceId])

  useEffect(()=>{
    if(!provinceId||!districtId){setNeighborhoods([]);setNeighborhoodId(0);return}
    setLoading(true)
    const d=districts.find(x=>x.id===districtId)
    if(d?.postalCode)setPostalCode(d.postalCode)
    void fetch(`/api/address/admin-units?level=neighborhoods&provinceId=${provinceId}&districtId=${districtId}`)
      .then(r=>r.json())
      .then(j=>setNeighborhoods((j.items||[]) as Unit[]))
      .catch(()=>setNote('Mahalle listesi alınamadı.'))
      .finally(()=>setLoading(false))
  },[provinceId,districtId,districts])

  useEffect(()=>{
    setStreetResults([])
    if(!provinceId||!neighborhoodId||street.trim().length<2)return
    const controller=new AbortController()
    const timer=window.setTimeout(()=>{
      setStreetLoading(true)
      const params=new URLSearchParams({
        level:'streets',
        provinceId:String(provinceId),
        neighborhoodId:String(neighborhoodId),
        q:street.trim()
      })
      void fetch(`/api/address/admin-units?${params}`,{signal:controller.signal})
        .then(r=>r.json())
        .then(j=>setStreetResults((j.items||[]) as Unit[]))
        .catch(e=>{if(e?.name!=='AbortError')setNote('Sokak önerileri alınamadı; elle yazabilirsin.')})
        .finally(()=>setStreetLoading(false))
    },320)
    return()=>{window.clearTimeout(timer);controller.abort()}
  },[provinceId,neighborhoodId,street])

  useEffect(()=>{
    const city=pretty(provinces.find(x=>x.id===provinceId)?.name||'')
    const district=pretty(districts.find(x=>x.id===districtId)?.name||'')
    const parts=[
      neighborhood&&`${pretty(neighborhood)} Mah.`,
      street,
      buildingNo&&`No:${buildingNo}`,
      apartmentNo&&`D:${apartmentNo}`,
      district,city,postalCode
    ].filter(Boolean)
    cb.current({
      city,district,neighborhood:pretty(neighborhood),street,buildingNo,apartmentNo,postalCode,
      formattedAddress:parts.join(', ')
    })
  },[provinceId,districtId,neighborhoodId,neighborhood,street,buildingNo,apartmentNo,postalCode,provinces,districts])

  return <div className="turkeyAddressSelector">
    <div className="addressHierarchyHead"><MapPinned size={17}/><div><strong>Türkiye adres ağacı</strong><small>81 il → ilçe → mahalle → sokak / bina / daire</small></div>{loading&&<span>Yükleniyor…</span>}</div>
    <div className="addressHierarchyGrid">
      <label><span>İl</span><select className="select" value={provinceId||''} onChange={e=>{setProvinceId(Number(e.target.value));setDistrictId(0);setNeighborhoodId(0);setStreet('')}}><option value="">İl seç</option>{provinces.map(x=><option key={x.id} value={x.id}>{pretty(x.name)}</option>)}</select></label>
      <label><span>İlçe</span><select className="select" value={districtId||''} disabled={!provinceId} onChange={e=>{setDistrictId(Number(e.target.value));setNeighborhoodId(0);setStreet('')}}><option value="">İlçe seç</option>{districts.map(x=><option key={x.id} value={x.id}>{pretty(x.name)}</option>)}</select></label>
      <label><span>Mahalle</span><select className="select" value={neighborhoodId||''} disabled={!districtId} onChange={e=>{setNeighborhoodId(Number(e.target.value));setStreet('')}}><option value="">Mahalle seç</option>{neighborhoods.map(x=><option key={x.id} value={x.id}>{pretty(x.name)}</option>)}</select></label>
      <label><span>Posta kodu</span><input className="input" value={postalCode} onChange={e=>setPostalCode(e.target.value.replace(/\D/g,'').slice(0,5))} inputMode="numeric" placeholder="59850"/></label>

      <label className="wide streetLookupField"><span>Sokak / cadde / bulvar</span><div className="addressIconInput"><MapPin size={14}/><input className="input" value={street} disabled={!neighborhoodId} onChange={e=>setStreet(e.target.value)} list="turkey-street-options" autoComplete="off" placeholder={neighborhoodId?'En az 2 harf yaz…':'Önce mahalle seç'}/>{streetLoading&&<LoaderCircle size={14} className="streetLookupSpinner"/>}</div><datalist id="turkey-street-options">{streetResults.map(x=><option key={x.id} value={pretty(x.officialName||x.name)}/>)}</datalist>{street.trim().length>=2&&neighborhoodId&&<small>{streetLoading?'Gerçek sokak kayıtları aranıyor…':streetResults.length?streetResults.length+' eşleşme bulundu':'Eşleşme yoksa adresi elle yazabilirsin.'}</small>}</label>

      <label><span>Bina no</span><input className="input" value={buildingNo} onChange={e=>setBuildingNo(e.target.value)} placeholder="24/A"/></label>
      <label><span>Daire</span><input className="input" value={apartmentNo} onChange={e=>setApartmentNo(e.target.value)} placeholder="7"/></label>
    </div>
    <div className="addressDataNote"><Building2 size={13}/><span>İl/ilçe/mahalle/sokak açık veriyle seçilir; bina no ve gerçek kapı girişi aşağıdaki harita piniyle ayrıca doğrulanır.</span></div>
    {note&&<small className="addressHierarchyError">{note}</small>}
  </div>
}
