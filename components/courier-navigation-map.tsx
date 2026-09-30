'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { LocateFixed, Navigation2 } from 'lucide-react'
import type { Delivery } from '@/lib/types'
import type { RouteSummary } from './operations-map'

type CurrentLocation={lat:number;lng:number;accuracy:number|null;heading:number|null;speed:number|null}
type Props={
  delivery:Delivery
  currentLocation:CurrentLocation|null
  onRouteSummary?:(summary:RouteSummary|null)=>void
}

function rasterStyle(tileUrl:string,attribution:string){
  return {
    version:8,
    sources:{base:{type:'raster',tiles:[tileUrl],tileSize:256,attribution}},
    layers:[{id:'base',type:'raster',source:'base'}]
  } as any
}

export default function CourierNavigationMap({delivery,currentLocation,onRouteSummary}:Props){
  const nodeRef=useRef<HTMLDivElement|null>(null)
  const mapRef=useRef<any>(null)
  const maplibreRef=useRef<any>(null)
  const vehicleMarkerRef=useRef<any>(null)
  const destinationMarkerRef=useRef<any>(null)
  const lastFetchRef=useRef({at:0,lat:0,lng:0})
  const routeRef=useRef<RouteSummary|null>(null)
  const visualLocationRef=useRef<{lat:number;lng:number}|null>(null)
  const lastCameraRef=useRef({at:0,lat:0,lng:0})
  const reducedMotionRef=useRef(false)
  const [follow,setFollow]=useState(true)
  const [route,setRoute]=useState<RouteSummary|null>(null)
  const [routing,setRouting]=useState(false)
  const [mapReady,setMapReady]=useState(false)
  const [fixClock,setFixClock]=useState(Date.now())
  const lastFixAtRef=useRef(0)
  const tileUrl=process.env.NEXT_PUBLIC_MAP_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
  const tileAttribution=process.env.NEXT_PUBLIC_MAP_ATTRIBUTION||'© OpenStreetMap contributors'
  const styleUrl=process.env.NEXT_PUBLIC_MAP_STYLE_URL||'https://tiles.openfreemap.org/styles/liberty'
  const destination=delivery.latitude!==null&&delivery.longitude!==null?{lat:delivery.latitude,lng:delivery.longitude}:null

  useEffect(()=>{
    let cancelled=false
    void(async()=>{
      if(!nodeRef.current||mapRef.current)return
      const maplibre=await import('maplibre-gl');if(cancelled||!nodeRef.current)return
      maplibreRef.current=maplibre
      maplibre.setWorkerUrl('/maplibre-gl-worker.mjs')
      reducedMotionRef.current=window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const center:[number,number]=currentLocation?[currentLocation.lng,currentLocation.lat]:destination?[destination.lng,destination.lat]:[27.8027,41.1603]
      const map=new maplibre.Map({
        container:nodeRef.current,
        style:styleUrl||rasterStyle(tileUrl,tileAttribution),
        center,
        zoom:currentLocation?16.2:14,
        pitch:currentLocation?48:0,
        bearing:currentLocation?.heading??0,
        attributionControl:{compact:true},
        dragRotate:true,
        touchPitch:true,
        maxPitch:62,
      })
      map.addControl(new maplibre.NavigationControl({showCompass:true,showZoom:false,visualizePitch:true}),'bottom-right')
      map.on('load',()=>{
        if(cancelled)return
        if(!map.getSource('route'))map.addSource('route',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[]}}})
        if(!map.getSource('gps-accuracy'))map.addSource('gps-accuracy',{type:'geojson',data:{type:'FeatureCollection',features:[]}})
        if(!map.getLayer('gps-accuracy-ring'))map.addLayer({id:'gps-accuracy-ring',type:'circle',source:'gps-accuracy',paint:{'circle-radius':0,'circle-color':'rgba(214,0,114,.10)','circle-stroke-color':'rgba(214,0,114,.36)','circle-stroke-width':1.5}})
        if(!map.getLayer('route-casing'))map.addLayer({id:'route-casing',type:'line',source:'route',paint:{'line-color':'#ffffff','line-width':10,'line-opacity':.92},layout:{'line-cap':'round','line-join':'round'}})
        if(!map.getLayer('route-line'))map.addLayer({id:'route-line',type:'line',source:'route',paint:{'line-color':'#d60072','line-width':6,'line-opacity':.96},layout:{'line-cap':'round','line-join':'round'}})
        setMapReady(true)
      })
      const pauseFollow=(event:any)=>{if(event?.originalEvent)setFollow(false)}
      map.on('dragstart',pauseFollow);map.on('rotatestart',pauseFollow);map.on('pitchstart',pauseFollow)
      mapRef.current=map
    })()
    return()=>{cancelled=true;setMapReady(false);vehicleMarkerRef.current?.remove();destinationMarkerRef.current?.remove();mapRef.current?.remove();mapRef.current=null}
  },[styleUrl,tileAttribution,tileUrl])

  useEffect(()=>{
    if(!mapReady||!destination||!maplibreRef.current||!mapRef.current)return
    const maplibre=maplibreRef.current
    if(!destinationMarkerRef.current){
      const el=document.createElement('div');el.className='premiumDestinationMarker';el.innerHTML='<span aria-hidden="true">⌂</span>'
      destinationMarkerRef.current=new maplibre.Marker({element:el,anchor:'bottom'}).setLngLat([destination.lng,destination.lat]).addTo(mapRef.current)
    }else destinationMarkerRef.current.setLngLat([destination.lng,destination.lat])
  },[destination?.lat,destination?.lng,mapReady])

  useEffect(()=>{
    if(!mapReady||!currentLocation||!maplibreRef.current||!mapRef.current)return
    const maplibre=maplibreRef.current
    lastFixAtRef.current=Date.now();setFixClock(Date.now())
    const previous=visualLocationRef.current
    const jump=previous?Math.hypot(currentLocation.lat-previous.lat,currentLocation.lng-previous.lng):1
    const alpha=jump>.002?1:(currentLocation.accuracy??100)<=25?.68:(currentLocation.accuracy??100)<=60?.48:.3
    const display=previous?{lat:previous.lat+(currentLocation.lat-previous.lat)*alpha,lng:previous.lng+(currentLocation.lng-previous.lng)*alpha}:{lat:currentLocation.lat,lng:currentLocation.lng}
    visualLocationRef.current=display
    if(!vehicleMarkerRef.current){
      const el=document.createElement('div');el.className='praticoVehicleMarker stopped'
      const img=document.createElement('img');img.src='/vehicle/pratico_E_rozetli_disk.svg';img.alt='Sevkiyat aracı';el.appendChild(img)
      vehicleMarkerRef.current=new maplibre.Marker({element:el,anchor:'center',rotationAlignment:'map',pitchAlignment:'map',subpixelPositioning:true})
        .setLngLat([display.lng,display.lat]).addTo(mapRef.current)
    }else vehicleMarkerRef.current.setLngLat([display.lng,display.lat])
    const vehicleElement=vehicleMarkerRef.current.getElement?.() as HTMLElement|undefined
    const moving=Boolean(currentLocation.speed&&currentLocation.speed>.8)
    vehicleElement?.classList.toggle('moving',moving)
    vehicleElement?.classList.toggle('stopped',!moving)
    vehicleMarkerRef.current.setRotation(Number.isFinite(currentLocation.heading)?currentLocation.heading:0)

    const accuracySource=mapRef.current.getSource('gps-accuracy')
    if(accuracySource?.setData){
      accuracySource.setData({type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Point',coordinates:[display.lng,display.lat]}}]})
      const meters=Math.max(4,currentLocation.accuracy||0)
      const metersPerPixel=156543.03392*Math.cos(currentLocation.lat*Math.PI/180)/Math.pow(2,mapRef.current.getZoom())
      mapRef.current.setPaintProperty('gps-accuracy-ring','circle-radius',Math.min(120,Math.max(5,meters/Math.max(.01,metersPerPixel))))
    }
    if(follow){
      const now=performance.now();const last=lastCameraRef.current;const moved=Math.hypot(display.lat-last.lat,display.lng-last.lng)
      if(last.at===0||now-last.at>650||moved>.00006){
        lastCameraRef.current={at:now,lat:display.lat,lng:display.lng}
        mapRef.current.easeTo({center:[display.lng,display.lat],zoom:16.7,pitch:50,bearing:Number.isFinite(currentLocation.heading)?currentLocation.heading:mapRef.current.getBearing(),duration:reducedMotionRef.current?0:620,easing:(t:number)=>1-Math.pow(1-t,3),essential:false,easeId:'courier-follow'})
      }
    }
  },[currentLocation?.lat,currentLocation?.lng,currentLocation?.heading,currentLocation?.accuracy,follow,mapReady])

  useEffect(()=>{const t=window.setInterval(()=>setFixClock(Date.now()),1000);return()=>window.clearInterval(t)},[])

  const routeKey=useMemo(()=>{
    if(!currentLocation||!destination)return ''
    return `${currentLocation.lat.toFixed(4)},${currentLocation.lng.toFixed(4)}|${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}`
  },[currentLocation?.lat,currentLocation?.lng,destination?.lat,destination?.lng])

  useEffect(()=>{
    if(!routeKey||!currentLocation||!destination)return
    let cancelled=false;let timer=0
    const now=Date.now();const moved=Math.hypot(currentLocation.lat-lastFetchRef.current.lat,currentLocation.lng-lastFetchRef.current.lng)
    const wait=lastFetchRef.current.at===0||moved>.00025?100:Math.max(100,12_000-(now-lastFetchRef.current.at))
    timer=window.setTimeout(()=>void(async()=>{
      setRouting(true);lastFetchRef.current={at:Date.now(),lat:currentLocation.lat,lng:currentLocation.lng}
      try{
        const res=await fetch('/api/routing/route',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({points:[{lat:currentLocation.lat,lng:currentLocation.lng},{lat:destination.lat,lng:destination.lng}],profile:'car'})})
        if(!res.ok)throw new Error('route unavailable')
        const data=await res.json() as RouteSummary;if(cancelled)return
        routeRef.current=data;setRoute(data);onRouteSummary?.(data)
      }catch{if(!cancelled&&!routeRef.current){setRoute(null);onRouteSummary?.(null)}}finally{if(!cancelled)setRouting(false)}
    })(),wait)
    return()=>{cancelled=true;window.clearTimeout(timer)}
  },[routeKey])

  useEffect(()=>{
    if(!mapReady||!mapRef.current)return
    const source=mapRef.current.getSource('route')
    if(!source?.setData)return
    const coords=(route?.coordinates||[]).map(([lat,lng])=>[lng,lat])
    source.setData({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords}})
  },[mapReady,route])

  function recenter(){setFollow(true);const point=visualLocationRef.current||currentLocation;if(point&&mapRef.current){lastCameraRef.current={at:performance.now(),lat:point.lat,lng:point.lng};mapRef.current.easeTo({center:[point.lng,point.lat],zoom:16.7,pitch:50,bearing:currentLocation?.heading??0,duration:reducedMotionRef.current?0:480,essential:false,easeId:'courier-recenter'})}}
  const accuracy=currentLocation?.accuracy??null
  const gpsQuality=accuracy===null?'Konum bekleniyor':accuracy<=20?'GPS çok iyi':accuracy<=50?'GPS iyi':accuracy<=100?'GPS orta':'GPS zayıf'
  const speedKmh=currentLocation?.speed&&currentLocation.speed>0.5?Math.round(currentLocation.speed*3.6):0
  const heading=currentLocation?.heading
  const fixAge=lastFixAtRef.current?Math.max(0,Math.floor((fixClock-lastFixAtRef.current)/1000)):null

  return <div className="courierNavigationMapShell">
    <div ref={nodeRef} className="courierNavigationMapCanvas"/>
    <button type="button" className={`navFollowButton ${follow?'active':''}`} onClick={recenter} aria-label={follow?'Konumu yeniden ortala':'Rotaya dön'} title={follow?'Konumu yeniden ortala':'Rotaya dön'}>{follow?<LocateFixed size={22}/>:<Navigation2 size={22}/>}<span className="srOnly">{follow?'Konumu yeniden ortala':'Rotaya dön'}</span></button>
    <div className={"navGpsTelemetry "+(accuracy!==null&&accuracy>100?'weak':'')}>
      <span className="gpsTelemetrySignal"><i/><b>{gpsQuality}</b></span>
      {accuracy!==null&&<span>±{Math.round(accuracy)} m</span>}
      <span>Konum takipte</span><span>{speedKmh} km/sa</span>
      {heading!==null&&Number.isFinite(heading)&&<span>{Math.round(heading!)}°</span>}
      {fixAge!==null&&<span>{fixAge<2?'şimdi':fixAge+' sn'}</span>}
    </div>
    {routing&&<div className="navRoutingPulse"><i/> Rota güncelleniyor</div>}
  </div>
}
