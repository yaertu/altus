'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Map as LeafletMap, LayerGroup, Polyline as LeafletPolyline } from 'leaflet'
import type { CourierAvailability, Delivery, DeliveryStatus } from '@/lib/types'

export type OperationsCourierPoint={
  user_id:string
  full_name:string
  availability:CourierAvailability
  latitude:number|null
  longitude:number|null
  heading_deg?:number|null
  speed_mps?:number|null
  accuracy_m?:number|null
  last_heartbeat_at?:string|null
}

export type RouteSummary={
  provider:'graphhopper'|'osrm'|'osrm-public'|'none'
  distance_m:number
  duration_s:number
  coordinates:[number,number][]
  instructions:{text:string;distance:number;time:number;street_name?:string}[]
}

type Props={
  deliveries:Delivery[]
  routeDeliveries?:Delivery[]
  couriers?:OperationsCourierPoint[]
  origin?:{latitude:number;longitude:number;heading?:number|null}|null
  selectedDeliveryId?:string|null
  selectedCourierId?:string|null
  compact?:boolean
  className?:string
  showRoute?:boolean
  onRouteSummary?:(summary:RouteSummary|null)=>void
  onSelectDelivery?:(id:string)=>void
  onSelectCourier?:(id:string)=>void
}

const statusColor:Record<DeliveryStatus,string>={new:'#d60072',accepted:'#4169d8',en_route:'#f0a21a',arrived:'#7857c7',delivered:'#15936a',failed:'#c83f50',cancelled:'#8f8790'}
const availabilityColor:Record<CourierAvailability,string>={offline:'#9a9399',available:'#12a56f',busy:'#f09a18',break:'#7456ba'}

function heartbeatAge(value?:string|null){
  if(!value)return null
  const seconds=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/1000))
  return seconds<60?`${seconds} sn önce`:`${Math.floor(seconds/60)} dk önce`
}
function gpsQuality(accuracy?:number|null){
  if(accuracy===null||accuracy===undefined)return 'GPS belirsiz'
  if(accuracy<=20)return 'GPS çok iyi'
  if(accuracy<=50)return 'GPS iyi'
  if(accuracy<=100)return 'GPS orta'
  return 'GPS zayıf'
}

function tooltipNode(title:string,subtitle:string,meta?:string){
  const root=document.createElement('div');root.className='mapTooltipContent'
  const strong=document.createElement('strong');strong.textContent=title;root.appendChild(strong)
  const span=document.createElement('span');span.textContent=subtitle;root.appendChild(span)
  if(meta){const small=document.createElement('small');small.textContent=meta;root.appendChild(small)}
  return root
}


function vehicleIcon(L:typeof import('leaflet'),heading=0,selected=false){
  const size=selected?54:46
  return L.divIcon({
    className:'altusVehicleMarkerHost',
    html:`<div class="altusVehicleMarker ${selected?'selected':''}" style="--heading:${Number.isFinite(heading)?heading:0}deg"><img src="/vehicle/pratico_E_rozetli_disk.svg" alt="Sevkiyat aracı"/></div>`,
    iconSize:[size,size],iconAnchor:[size/2,size/2]
  })
}

function stopIcon(L:typeof import('leaflet'),d:Delivery,selected:boolean){
  const number=d.route_position??'•'
  return L.divIcon({
    className:'altusStopMarkerHost',
    html:`<div class="altusStopMarker ${selected?'selected':''}" style="--marker:${statusColor[d.status]}"><span>${number}</span></div>`,
    iconSize:[selected?42:36,selected?42:36],iconAnchor:[selected?21:18,selected?21:18]
  })
}

export default function OperationsMap({deliveries,routeDeliveries,couriers=[],origin=null,selectedDeliveryId,selectedCourierId,compact=false,className='',showRoute=true,onRouteSummary,onSelectDelivery,onSelectCourier}:Props){
  const nodeRef=useRef<HTMLDivElement|null>(null)
  const mapRef=useRef<LeafletMap|null>(null)
  const layerRef=useRef<LayerGroup|null>(null)
  const routeRef=useRef<LeafletPolyline|null>(null)
  const leafletRef=useRef<typeof import('leaflet')|null>(null)
  const [route,setRoute]=useState<RouteSummary|null>(null)
  const [routing,setRouting]=useState(false)
  const lastRouteFetchRef=useRef(0)
  const mappedDeliveries=useMemo(()=>deliveries.filter(x=>Number.isFinite(x.latitude)&&Number.isFinite(x.longitude)),[deliveries])
  const mappedCouriers=useMemo(()=>couriers.filter(x=>Number.isFinite(x.latitude)&&Number.isFinite(x.longitude)),[couriers])
  const activeRoute=useMemo(()=>{const source=(routeDeliveries??deliveries).filter(x=>x.latitude!==null&&x.longitude!==null);return source.filter(x=>!['cancelled','failed','delivered'].includes(x.status)).sort((a,b)=>(a.route_position??999)-(b.route_position??999))},[deliveries,routeDeliveries])
  const tileUrl=process.env.NEXT_PUBLIC_MAP_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
  const tileAttribution=process.env.NEXT_PUBLIC_MAP_ATTRIBUTION||'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  const hasAny=mappedDeliveries.length+mappedCouriers.length>0
  const pointsKey=useMemo(()=>[origin?`${origin.latitude.toFixed(5)},${origin.longitude.toFixed(5)}`:'',...activeRoute.map(x=>`${x.latitude!.toFixed(5)},${x.longitude!.toFixed(5)}`)].join('|'),[activeRoute,origin])

  useEffect(()=>{
    let cancelled=false;let resizeObserver:ResizeObserver|null=null
    void(async()=>{
      if(!nodeRef.current||mapRef.current)return
      const L=await import('leaflet');if(cancelled||!nodeRef.current)return
      leafletRef.current=L
      const map=L.map(nodeRef.current,{zoomControl:!compact,attributionControl:true,scrollWheelZoom:true,preferCanvas:true}).setView([41.1603,27.8027],13)
      L.tileLayer(tileUrl,{attribution:tileAttribution,maxZoom:19}).addTo(map)
      layerRef.current=L.layerGroup().addTo(map)
      mapRef.current=map
      resizeObserver=new ResizeObserver(entries=>{const rect=entries[0]?.contentRect;if(!rect)return;if(rect.width<10||rect.height<10){map.stop();return}map.invalidateSize({pan:false})})
      resizeObserver.observe(nodeRef.current)
      window.setTimeout(()=>map.invalidateSize(),50)
    })()
    return()=>{cancelled=true;resizeObserver?.disconnect();if(mapRef.current){mapRef.current.stop();mapRef.current.remove();mapRef.current=null;layerRef.current=null;routeRef.current=null}}
  },[compact,tileAttribution,tileUrl])

  useEffect(()=>{
    let cancelled=false
    let timer=0
    async function calculate(){
      if(!showRoute){setRoute(null);onRouteSummary?.(null);return}
      const points=[...(origin?[{lat:origin.latitude,lng:origin.longitude}]:[]),...activeRoute.map(x=>({lat:x.latitude!,lng:x.longitude!}))]
      if(points.length<2){setRoute(null);onRouteSummary?.(null);return}
      setRouting(true);lastRouteFetchRef.current=Date.now()
      try{
        const res=await fetch('/api/routing/route',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({points,profile:'car'})})
        if(!res.ok)throw new Error('route unavailable')
        const data=await res.json() as RouteSummary
        if(cancelled)return
        if(Array.isArray(data.coordinates)&&data.coordinates.length>1){setRoute(data);onRouteSummary?.(data)}
        else {setRoute(null);onRouteSummary?.(null)}
      }catch{if(!cancelled){setRoute(null);onRouteSummary?.(null)}}finally{if(!cancelled)setRouting(false)}
    }
    const elapsed=Date.now()-lastRouteFetchRef.current
    const wait=lastRouteFetchRef.current===0?100:Math.max(100,15_000-elapsed)
    timer=window.setTimeout(()=>void calculate(),wait)
    return()=>{cancelled=true;window.clearTimeout(timer)}
  },[pointsKey,showRoute,onRouteSummary])

  useEffect(()=>{
    let cancelled=false
    void(async()=>{
      const L=leafletRef.current||await import('leaflet');if(cancelled)return
      leafletRef.current=L
      const map=mapRef.current,group=layerRef.current;if(!map||!group)return
      group.clearLayers();if(routeRef.current){routeRef.current.remove();routeRef.current=null}

      if(route?.coordinates?.length){
        routeRef.current=L.polyline(route.coordinates,{color:'#cf006f',weight:6,opacity:.86,lineCap:'round',lineJoin:'round'}).addTo(map)
      }else if(showRoute&&activeRoute.length>1){
        routeRef.current=L.polyline(activeRoute.map(x=>[x.latitude!,x.longitude!] as [number,number]),{color:'#cf006f',weight:4,opacity:.55,dashArray:'10 9'}).addTo(map)
      }

      if(origin){
        const courier=L.marker([origin.latitude,origin.longitude],{icon:vehicleIcon(L,origin.heading??0,true),keyboard:false,title:'Sevkiyat aracı'})
        courier.bindTooltip(tooltipNode('Sevkiyat aracı','Canlı saha konumu'),{direction:'bottom',offset:[0,18],opacity:1,className:'altusMapTooltip courierTip'})
        courier.addTo(group)
      }

      for(const d of mappedDeliveries){
        const selected=d.id===selectedDeliveryId
        const marker=L.marker([d.latitude!,d.longitude!],{icon:stopIcon(L,d,selected),keyboard:true,title:`${d.customer_name} • ${d.product_name}`})
        marker.bindTooltip(tooltipNode(`${d.route_position?`${d.route_position}. `:''}${d.customer_name}`,d.product_name,d.time_window),{direction:'top',offset:[0,-18],opacity:1,permanent:selected,className:'altusMapTooltip'})
        marker.on('click',()=>onSelectDelivery?.(d.id));marker.addTo(group)
      }
      for(const c of mappedCouriers){
        const selected=c.user_id===selectedCourierId
        const marker=L.marker([c.latitude!,c.longitude!],{icon:vehicleIcon(L,c.heading_deg??0,selected),keyboard:true,title:`${c.full_name} • ${c.availability}`})
        const label=c.availability==='available'?'Müsait':c.availability==='busy'?'Görevde':c.availability==='break'?'Molada':'Çevrimdışı'
        const speed=c.speed_mps&&c.speed_mps>1?` • ${Math.round(c.speed_mps*3.6)} km/sa`:''
        const accuracy=c.accuracy_m!==null&&c.accuracy_m!==undefined?`±${Math.round(c.accuracy_m)} m`:'konum doğruluğu yok'
        const age=heartbeatAge(c.last_heartbeat_at)
        marker.bindTooltip(tooltipNode(c.full_name,`${label}${speed}`,`${gpsQuality(c.accuracy_m)} • ${accuracy}${age?` • ${age}`:''}`),{direction:'bottom',offset:[0,18],opacity:1,permanent:selected,className:'altusMapTooltip courierTip'})
        marker.on('click',()=>onSelectCourier?.(c.user_id));marker.addTo(group)
      }

      const selectedDelivery=mappedDeliveries.find(x=>x.id===selectedDeliveryId)
      const selectedCourier=mappedCouriers.find(x=>x.user_id===selectedCourierId)
      const container=map.getContainer();if(container.clientWidth<10||container.clientHeight<10){map.stop();return}
      if(selectedDelivery){map.flyTo([selectedDelivery.latitude!,selectedDelivery.longitude!],16,{duration:.45});return}
      if(selectedCourier){map.flyTo([selectedCourier.latitude!,selectedCourier.longitude!],15,{duration:.45});return}
      const routeCoords=route?.coordinates||[]
      const coords:[number,number][]=routeCoords.length>1?routeCoords:[...(origin?[[origin.latitude,origin.longitude] as [number,number]]:[]),...mappedDeliveries.map(x=>[x.latitude!,x.longitude!] as [number,number]),...mappedCouriers.map(x=>[x.latitude!,x.longitude!] as [number,number])]
      if(coords.length===1)map.setView(coords[0],14)
      else if(coords.length>1)map.fitBounds(L.latLngBounds(coords),{padding:[42,42],maxZoom:15})
      map.invalidateSize()
    })()
    return()=>{cancelled=true}
  },[activeRoute,mappedDeliveries,mappedCouriers,onSelectCourier,onSelectDelivery,origin,route,selectedCourierId,selectedDeliveryId,showRoute])

  const km=route?route.distance_m/1000:0
  const min=route?Math.max(1,Math.round(route.duration_s/60)):0
  return <div className={`internalMapShell ${compact?'compact':''} ${className}`.trim()}>
    <div ref={nodeRef} className="internalMapCanvas"/>
    {!hasAny&&<div className="mapEmptyState"><div className="mapEmptyIcon">⌖</div><strong>Haritada gösterilecek konum yok</strong><span>Sevkiyat oluştururken teslimat noktasını harita üzerinden işaretleyebilirsin.</span></div>}
    <div className="mapLegend"><span><i className="legendDelivery"/>Teslimat</span><span><span className="legendVehicleIcon"><img src="/vehicle/pratico_E_rozetli_disk.svg" alt=""/></span>Araç</span><span className="mapProviderNote">{routing?'Rota hesaplanıyor…':route?`${km.toFixed(1)} km • ${min} dk`:'Uygulama içi harita'}</span></div>
    {route&&<div className="routeProviderBadge">{route.provider==='graphhopper'?'Canlı yol rotası':'Yol rotası'} • ETA {min} dk</div>}
  </div>
}
