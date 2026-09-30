'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, Marker } from 'leaflet'
import { Search, MapPinCheck, Crosshair, CheckCircle2 } from 'lucide-react'

export type LocationMeta={provider:string;precision:string;confidence:number;confirmed:boolean;label:string|null}
type Props={
  latitude:number|null
  longitude:number|null
  addressText?:string
  districtText?:string
  cityText?:string
  onChange:(lat:number,lng:number)=>void
  onAddressSelect?:(label:string)=>void
  onMetaChange?:(meta:LocationMeta)=>void
}
type SearchResult={id:string;label:string;lat:number;lng:number;provider:string;confidence:number;precision:string}

const precisionLabel:Record<string,string>={rooftop:'Bina/kapı',street:'Sokak',district:'Bölge',approximate:'Yaklaşık',manual:'Elle doğrulandı'}

export default function AddressMapPicker({latitude,longitude,addressText='',districtText='',cityText='',onChange,onAddressSelect,onMetaChange}:Props){
  const nodeRef=useRef<HTMLDivElement|null>(null)
  const mapRef=useRef<LeafletMap|null>(null)
  const markerRef=useRef<Marker|null>(null)
  const leafletRef=useRef<typeof import('leaflet')|null>(null)
  const [query,setQuery]=useState('')
  const [results,setResults]=useState<SearchResult[]>([])
  const [searching,setSearching]=useState(false)
  const [searchNote,setSearchNote]=useState('')
  const [meta,setMeta]=useState<LocationMeta>({provider:'',precision:'',confidence:0,confirmed:false,label:null})
  const [reverseLabel,setReverseLabel]=useState('')
  const tileUrl=process.env.NEXT_PUBLIC_MAP_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
  const tileAttribution=process.env.NEXT_PUBLIC_MAP_ATTRIBUTION||'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

  function publish(next:LocationMeta){setMeta(next);onMetaChange?.(next)}
  useEffect(()=>{if(addressText.trim().length>=4)setQuery(addressText)},[addressText])

  useEffect(()=>{
    let cancelled=false
    void(async()=>{
      if(!nodeRef.current||mapRef.current)return
      const L=await import('leaflet');if(cancelled||!nodeRef.current)return
      leafletRef.current=L
      const center:[number,number]=latitude!==null&&longitude!==null?[latitude,longitude]:[41.1603,27.8027]
      const map=L.map(nodeRef.current,{scrollWheelZoom:true,preferCanvas:true,zoomControl:true}).setView(center,latitude!==null?17:13)
      L.tileLayer(tileUrl,{attribution:tileAttribution,maxZoom:20}).addTo(map)
      map.on('click',e=>{const la=Number(e.latlng.lat.toFixed(6)),ln=Number(e.latlng.lng.toFixed(6));onChange(la,ln);publish({provider:'manual',precision:'manual',confidence:1,confirmed:true,label:null});void reverse(la,ln)})
      mapRef.current=map;window.setTimeout(()=>map.invalidateSize(),80)
    })()
    return()=>{cancelled=true;if(mapRef.current){mapRef.current.remove();mapRef.current=null;markerRef.current=null}}
  },[tileAttribution,tileUrl])

  useEffect(()=>{
    void(async()=>{
      const L=leafletRef.current||await import('leaflet');leafletRef.current=L
      const map=mapRef.current;if(!map)return
      if(markerRef.current){markerRef.current.remove();markerRef.current=null}
      if(latitude!==null&&longitude!==null){
        const icon=L.divIcon({className:'verifiedAddressMarkerHost',html:'<div class="verifiedAddressMarker"><span>⌖</span></div>',iconSize:[42,42],iconAnchor:[21,36]})
        const marker=L.marker([latitude,longitude],{icon,draggable:true,title:'Teslimat noktası'})
        marker.on('dragend',()=>{const p=marker.getLatLng();const la=Number(p.lat.toFixed(6)),ln=Number(p.lng.toFixed(6));onChange(la,ln);publish({provider:'manual',precision:'manual',confidence:1,confirmed:true,label:null});void reverse(la,ln)})
        marker.addTo(map);markerRef.current=marker;map.panTo([latitude,longitude])
      }
    })()
  },[latitude,longitude])

  async function reverse(lat:number,lng:number){
    try{const res=await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);const data=await res.json();setReverseLabel(String(data?.label||''))}catch{setReverseLabel('')}
  }

  async function search(){
    if(query.trim().length<4)return
    setSearching(true);setSearchNote('');setResults([])
    try{
      const params=new URLSearchParams({q:query.trim()});if(districtText.trim())params.set('district',districtText.trim());if(cityText.trim())params.set('city',cityText.trim());if(latitude!==null&&longitude!==null){params.set('lat',String(latitude));params.set('lng',String(longitude))}
      const res=await fetch(`/api/geocode?${params}`)
      const data=await res.json().catch(()=>({results:[]}))
      if(!res.ok){setSearchNote(data.configured===false?'Production adres servisi anahtarı bekliyor. Pini haritada elle işaretleyebilirsin.':'Adres aranamadı.');return}
      const next=(data.results||[]) as SearchResult[];setResults(next)
      if(!next.length)setSearchNote('Adres bulunamadı. İlçe/şehir bilgisini kontrol et veya bina girişini haritada işaretle.')
      else if(data.previewFallback)setSearchNote('Önizleme araması kullanılıyor. Canlı sistemde MapTiler/GraphHopper anahtarıyla daha güçlü doğrulama yapılır.')
    }finally{setSearching(false)}
  }

  function choose(r:SearchResult){
    onChange(r.lat,r.lng);onAddressSelect?.(r.label);setQuery(r.label);setResults([]);setReverseLabel(r.label)
    publish({provider:r.provider,precision:r.precision,confidence:r.confidence,confirmed:false,label:r.label})
    mapRef.current?.flyTo([r.lat,r.lng],18,{duration:.55})
  }

  function confirm(){
    if(latitude===null||longitude===null)return
    const next={...meta,provider:meta.provider||'manual',precision:meta.precision||'manual',confidence:Math.max(meta.confidence,.9),confirmed:true,label:reverseLabel||meta.label}
    publish(next)
  }

  const ready=latitude!==null&&longitude!==null
  return <div className="addressMapSearchShell premiumAddressPicker">
    <div className="addressSearchRow"><div className="addressQueryBox"><span><Search size={16}/></span><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void search()}}} className="input" placeholder="Mahalle, sokak, bina no…"/></div><button type="button" className="btn btnPrimary" disabled={searching||query.trim().length<4} onClick={()=>void search()}>{searching?'Aranıyor…':'Adresi bul'}</button></div>
    {results.length>0&&<div className="addressSearchResults premiumResults">{results.map((r,i)=><button type="button" key={r.id||`${r.lat}-${r.lng}`} onClick={()=>choose(r)}><b>{i+1}</b><span><strong>{r.label}</strong><small>{r.provider} • {precisionLabel[r.precision]||'Konum'} • %{Math.round(r.confidence*100)} güven</small></span><i>→</i></button>)}</div>}
    {searchNote&&<div className="addressSearchNote">{searchNote}</div>}
    <div className="addressPickerMap premiumPickerMap">
      <div ref={nodeRef} className="internalMapCanvas"/>
      <div className="addressPickerHint"><b><Crosshair size={16}/></b><span><strong>Kapı girişini kontrol et</strong><small>Pin yanlışsa haritada doğru bina girişine tıkla veya pini sürükle.</small></span></div>
      {ready&&!meta.confirmed&&<button type="button" className="confirmMapPoint" onClick={confirm}><MapPinCheck size={15}/> Bu noktayı doğrula</button>}
      {ready&&meta.confirmed&&<div className="confirmedMapPoint"><CheckCircle2 size={14}/> Konum doğrulandı</div>}
    </div>
    {ready&&<div className="locationVerificationBar"><span className={meta.confirmed?'ok':'warn'}>{meta.confirmed?'Doğrulandı':'Kontrol gerekli'}</span><p>{reverseLabel||meta.label||`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}</p></div>}
  </div>
}
