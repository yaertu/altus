'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [follow,setFollow]=useState(true)
  const [route,setRoute]=useState<RouteSummary|null>(null)
  const [routing,setRouting]=useState(false)
  const [mapReady,setMapReady]=useState(false)
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
        if(!map.getLayer('route-casing'))map.addLayer({id:'route-casing',type:'line',source:'route',paint:{'line-color':'#ffffff','line-width':10,'line-opacity':.92},layout:{'line-cap':'round','line-join':'round'}})
        if(!map.getLayer('route-line'))map.addLayer({id:'route-line',type:'line',source:'route',paint:{'line-color':'#d60072','line-width':6,'line-opacity':.96},layout:{'line-cap':'round','line-join':'round'}})
        setMapReady(true)
      })
      map.on('dragstart',()=>setFollow(false));map.on('rotatestart',()=>setFollow(false));map.on('pitchstart',()=>setFollow(false))
      mapRef.current=map
    })()
    return()=>{cancelled=true;setMapReady(false);vehicleMarkerRef.current?.remove();destinationMarkerRef.current?.remove();mapRef.current?.remove();mapRef.current=null}
  },[styleUrl,tileAttribution,tileUrl])

  useEffect(()=>{
    if(!mapReady||!destination||!maplibreRef.current||!mapRef.current)return
    const maplibre=maplibreRef.current
    if(!destinationMarkerRef.current){
      const el=document.createElement('div');el.className='premiumDestinationMarker';el.innerHTML='<span>1</span>'
      destinationMarkerRef.current=new maplibre.Marker({element:el,anchor:'bottom'}).setLngLat([destination.lng,destination.lat]).addTo(mapRef.current)
    }else destinationMarkerRef.current.setLngLat([destination.lng,destination.lat])
  },[destination?.lat,destination?.lng,mapReady])

  useEffect(()=>{
    if(!mapReady||!currentLocation||!maplibreRef.current||!mapRef.current)return
    const maplibre=maplibreRef.current
    if(!vehicleMarkerRef.current){
      const el=document.createElement('div');el.className='praticoVehicleMarker'
      const img=document.createElement('img');img.src='/vehicle/pratico_E_rozetli_disk.svg';img.alt='Sevkiyat aracı';el.appendChild(img)
      vehicleMarkerRef.current=new maplibre.Marker({element:el,anchor:'center',rotationAlignment:'map',pitchAlignment:'map',subpixelPositioning:true})
        .setLngLat([currentLocation.lng,currentLocation.lat]).addTo(mapRef.current)
    }else vehicleMarkerRef.current.setLngLat([currentLocation.lng,currentLocation.lat])
    vehicleMarkerRef.current.setRotation(Number.isFinite(currentLocation.heading)?currentLocation.heading:0)
    if(follow){
      mapRef.current.easeTo({center:[currentLocation.lng,currentLocation.lat],zoom:16.7,pitch:50,bearing:Number.isFinite(currentLocation.heading)?currentLocation.heading:mapRef.current.getBearing(),duration:650,easing:(t:number)=>t*(2-t)})
    }
  },[currentLocation?.lat,currentLocation?.lng,currentLocation?.heading,follow,mapReady])

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
        setRoute(data);onRouteSummary?.(data)
      }catch{if(!cancelled){setRoute(null);onRouteSummary?.(null)}}finally{if(!cancelled)setRouting(false)}
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

  function recenter(){setFollow(true);if(currentLocation&&mapRef.current)mapRef.current.easeTo({center:[currentLocation.lng,currentLocation.lat],zoom:16.7,pitch:50,bearing:currentLocation.heading??0,duration:450})}

  return <div className="courierNavigationMapShell">
    <div ref={nodeRef} className="courierNavigationMapCanvas"/>
    <button type="button" className={`navFollowButton ${follow?'active':''}`} onClick={recenter} aria-label="Aracı ortala">{follow?'◎':'⌖'}<span>{follow?'Takip':'Aracı bul'}</span></button>
    {routing&&<div className="navRoutingPulse"><i/> Rota güncelleniyor</div>}
  </div>
}
