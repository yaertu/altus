'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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

function deliveryMarkerNode(delivery:Delivery,selected:boolean){
  const button=document.createElement('button')
  button.type='button'
  button.className=`altusDesktopStopMarker ${selected?'selected':''}`
  button.style.setProperty('--marker',statusColor[delivery.status])
  button.setAttribute('aria-label',`${delivery.customer_name} teslimatını seç`)
  const span=document.createElement('span');span.textContent=String(delivery.route_position??'•');button.appendChild(span)
  return button
}

function vehicleMarkerNode(selected:boolean,moving:boolean){
  const root=document.createElement('div')
  root.className=`altusDesktopVehicleMarker ${selected?'selected':''} ${moving?'moving':'stopped'}`
  const img=document.createElement('img');img.src='/vehicle/pratico_E_rozetli_disk.svg';img.alt='Altus sevkiyat aracı';root.appendChild(img)
  return root
}

export default function OperationsMap({deliveries,routeDeliveries,couriers=[],origin=null,selectedDeliveryId,selectedCourierId,compact=false,className='',showRoute=true,onRouteSummary,onSelectDelivery,onSelectCourier}:Props){
  const nodeRef=useRef<HTMLDivElement|null>(null)
  const mapRef=useRef<any>(null)
  const maplibreRef=useRef<any>(null)
  const markerRefs=useRef<any[]>([])
  const [mapReady,setMapReady]=useState(false)
  const [route,setRoute]=useState<RouteSummary|null>(null)
  const [routing,setRouting]=useState(false)
  const lastRouteFetchRef=useRef(0)
  const onRouteSummaryRef=useRef(onRouteSummary)
  const mappedDeliveries=useMemo(()=>deliveries.filter(x=>Number.isFinite(x.latitude)&&Number.isFinite(x.longitude)),[deliveries])
  const mappedCouriers=useMemo(()=>couriers.filter(x=>Number.isFinite(x.latitude)&&Number.isFinite(x.longitude)),[couriers])
  const activeRoute=useMemo(()=>{const source=(routeDeliveries??deliveries).filter(x=>Number.isFinite(x.latitude)&&Number.isFinite(x.longitude));return source.filter(x=>!['cancelled','failed','delivered'].includes(x.status)).sort((a,b)=>(a.route_position??999)-(b.route_position??999))},[deliveries,routeDeliveries])
  const styleUrl=process.env.NEXT_PUBLIC_MAP_STYLE_URL||'https://tiles.openfreemap.org/styles/liberty'
  const hasAny=mappedDeliveries.length+mappedCouriers.length>0
  const validOrigin=origin&&Number.isFinite(origin.latitude)&&Number.isFinite(origin.longitude)?origin:null
  const pointsKey=useMemo(()=>[validOrigin?`${validOrigin.latitude.toFixed(5)},${validOrigin.longitude.toFixed(5)}`:'',...activeRoute.map(x=>`${x.latitude!.toFixed(5)},${x.longitude!.toFixed(5)}`)].join('|'),[activeRoute,validOrigin])

  useEffect(()=>{onRouteSummaryRef.current=onRouteSummary},[onRouteSummary])

  useEffect(()=>{
    let cancelled=false;let resizeObserver:ResizeObserver|null=null
    void(async()=>{
      if(!nodeRef.current||mapRef.current)return
      const maplibre=await import('maplibre-gl');if(cancelled||!nodeRef.current)return
      maplibreRef.current=maplibre
      maplibre.setWorkerUrl('/maplibre-gl-worker.mjs')
      const map=new maplibre.Map({container:nodeRef.current,style:styleUrl,center:[27.8027,41.1603],zoom:13.2,pitch:compact?0:28,bearing:0,attributionControl:{compact:true},maxPitch:58})
      map.addControl(new maplibre.NavigationControl({showCompass:true,showZoom:!compact,visualizePitch:true}),'bottom-right')
      map.on('load',()=>{
        if(cancelled)return
        map.addSource('operations-route',{type:'geojson',lineMetrics:true,data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[]}}})
        map.addLayer({id:'operations-route-casing',type:'line',source:'operations-route',paint:{'line-color':'rgba(255,255,255,.96)','line-width':10,'line-opacity':.94},layout:{'line-cap':'round','line-join':'round'}})
        map.addLayer({id:'operations-route-line',type:'line',source:'operations-route',paint:{'line-color':'#d60072','line-width':6,'line-opacity':.96},layout:{'line-cap':'round','line-join':'round'}})
        setMapReady(true)
      })
      mapRef.current=map
      resizeObserver=new ResizeObserver(entries=>{const rect=entries[0]?.contentRect;if(rect&&rect.width>10&&rect.height>10)map.resize()})
      resizeObserver.observe(nodeRef.current)
    })()
    return()=>{cancelled=true;resizeObserver?.disconnect();setMapReady(false);markerRefs.current.forEach(marker=>marker.remove());markerRefs.current=[];mapRef.current?.remove();mapRef.current=null}
  },[compact,styleUrl])

  useEffect(()=>{
    let cancelled=false;let timer=0
    async function calculate(){
      if(!showRoute){setRoute(null);onRouteSummaryRef.current?.(null);return}
      const points=[...(validOrigin?[{lat:validOrigin.latitude,lng:validOrigin.longitude}]:[]),...activeRoute.map(x=>({lat:x.latitude!,lng:x.longitude!}))]
      if(points.length<2){setRoute(null);onRouteSummaryRef.current?.(null);return}
      setRouting(true);lastRouteFetchRef.current=Date.now()
      try{
        const response=await fetch('/api/routing/route',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({points,profile:'car'})})
        if(!response.ok)throw new Error('route unavailable')
        const data=await response.json() as RouteSummary;if(cancelled)return
        if(Array.isArray(data.coordinates)&&data.coordinates.length>1){setRoute(data);onRouteSummaryRef.current?.(data)}else{setRoute(null);onRouteSummaryRef.current?.(null)}
      }catch{if(!cancelled){setRoute(null);onRouteSummaryRef.current?.(null)}}finally{if(!cancelled)setRouting(false)}
    }
    const elapsed=Date.now()-lastRouteFetchRef.current
    timer=window.setTimeout(()=>void calculate(),lastRouteFetchRef.current===0?100:Math.max(100,15_000-elapsed))
    return()=>{cancelled=true;window.clearTimeout(timer)}
  },[pointsKey,showRoute])

  useEffect(()=>{
    if(!mapReady||!mapRef.current||!maplibreRef.current)return
    const map=mapRef.current,maplibre=maplibreRef.current
    markerRefs.current.forEach(marker=>marker.remove());markerRefs.current=[]

    const routeCoordinates=(route?.coordinates?.length?route.coordinates:showRoute?activeRoute.map(x=>[x.latitude!,x.longitude!] as [number,number]):[]).map(([lat,lng])=>[lng,lat])
    map.getSource('operations-route')?.setData({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:routeCoordinates}})

    if(validOrigin){
      const node=vehicleMarkerNode(true,false)
      const marker=new maplibre.Marker({element:node,anchor:'center',rotationAlignment:'map',pitchAlignment:'map'}).setLngLat([validOrigin.longitude,validOrigin.latitude]).setRotation(validOrigin.heading??0).addTo(map)
      markerRefs.current.push(marker)
    }

    for(const delivery of mappedDeliveries){
      const selected=delivery.id===selectedDeliveryId
      const node=deliveryMarkerNode(delivery,selected)
      node.addEventListener('click',event=>{event.stopPropagation();onSelectDelivery?.(delivery.id)})
      const popup=new maplibre.Popup({offset:selected?28:23,closeButton:false,closeOnClick:false,className:'altusMapPopup'}).setDOMContent(tooltipNode(`${delivery.route_position?`${delivery.route_position}. `:''}${delivery.customer_name}`,delivery.product_name,delivery.time_window))
      const marker=new maplibre.Marker({element:node,anchor:'center'}).setLngLat([delivery.longitude!,delivery.latitude!]).setPopup(popup).addTo(map)
      if(selected)marker.togglePopup()
      markerRefs.current.push(marker)
    }

    for(const courier of mappedCouriers){
      const selected=courier.user_id===selectedCourierId
      const node=vehicleMarkerNode(selected,Boolean(courier.speed_mps&&courier.speed_mps>.8))
      node.style.setProperty('--presence',availabilityColor[courier.availability])
      node.addEventListener('click',event=>{event.stopPropagation();onSelectCourier?.(courier.user_id)})
      const label=courier.availability==='available'?'Müsait':courier.availability==='busy'?'Görevde':courier.availability==='break'?'Molada':'Çevrimdışı'
      const speed=courier.speed_mps&&courier.speed_mps>1?` • ${Math.round(courier.speed_mps*3.6)} km/sa`:''
      const accuracy=courier.accuracy_m!==null&&courier.accuracy_m!==undefined?`±${Math.round(courier.accuracy_m)} m`:'konum doğruluğu yok'
      const age=heartbeatAge(courier.last_heartbeat_at)
      const popup=new maplibre.Popup({offset:selected?38:31,closeButton:false,closeOnClick:false,className:'altusMapPopup'}).setDOMContent(tooltipNode(courier.full_name,`${label}${speed}`,`${gpsQuality(courier.accuracy_m)} • ${accuracy}${age?` • ${age}`:''}`))
      const marker=new maplibre.Marker({element:node,anchor:'center',rotationAlignment:'map',pitchAlignment:'map'}).setLngLat([courier.longitude!,courier.latitude!]).setRotation(courier.heading_deg??0).setPopup(popup).addTo(map)
      if(selected)marker.togglePopup()
      markerRefs.current.push(marker)
    }

    const selectedDelivery=mappedDeliveries.find(x=>x.id===selectedDeliveryId)
    const selectedCourier=mappedCouriers.find(x=>x.user_id===selectedCourierId)
    if(selectedDelivery){map.easeTo({center:[selectedDelivery.longitude!,selectedDelivery.latitude!],zoom:15.7,pitch:38,duration:520});return}
    if(selectedCourier){map.easeTo({center:[selectedCourier.longitude!,selectedCourier.latitude!],zoom:15.4,pitch:42,bearing:selectedCourier.heading_deg??0,duration:520});return}
    const coordinates=routeCoordinates.length?routeCoordinates:[...(validOrigin?[[validOrigin.longitude,validOrigin.latitude]]:[]),...mappedDeliveries.map(x=>[x.longitude!,x.latitude!]),...mappedCouriers.map(x=>[x.longitude!,x.latitude!])]
    if(coordinates.length===1)map.easeTo({center:coordinates[0],zoom:14.5,duration:450})
    else if(coordinates.length>1){const bounds=coordinates.reduce((value,coordinate)=>value.extend(coordinate),new maplibre.LngLatBounds(coordinates[0],coordinates[0]));map.fitBounds(bounds,{padding:55,maxZoom:15,duration:520})}
  },[activeRoute,mapReady,mappedCouriers,mappedDeliveries,onSelectCourier,onSelectDelivery,origin,route,selectedCourierId,selectedDeliveryId,showRoute,validOrigin])

  const km=route?route.distance_m/1000:0
  const min=route?Math.max(1,Math.round(route.duration_s/60)):0
  return <div className={`internalMapShell altusOperationsMap ${compact?'compact':''} ${className}`.trim()}>
    <div ref={nodeRef} className="internalMapCanvas"/>
    <div className="altusMapBrand"><span>A</span><div><strong>ALTUS MAPS</strong><small>Operasyon haritası</small></div></div>
    {!hasAny?<div className="mapEmptyState customMapEmpty"><div className="mapEmptyIcon">⌖</div><strong>Konumlar burada görünecek</strong><span>Sevkiyat ve personel konumları geldikçe harita otomatik güncellenir.</span></div>:null}
    {routing?<div className="routeProviderBadge">Rota hazırlanıyor…</div>:route?<div className="routeProviderBadge">{km.toFixed(1)} km • ETA {min} dk</div>:null}
  </div>
}
