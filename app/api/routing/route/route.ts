import { NextRequest, NextResponse } from 'next/server'

type Point={lat:number;lng:number}
type RouteInstruction={text:string;distance:number;time:number;street_name?:string}

function validPoint(v:unknown):v is Point{
  if(!v||typeof v!=='object')return false
  const p=v as Point
  return Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180
}

export async function POST(req:NextRequest){
  const body=await req.json().catch(()=>null) as {points?:Point[];profile?:string}|null
  const points=Array.isArray(body?.points)?body!.points.filter(validPoint):[]
  if(points.length<2||points.length>25)return NextResponse.json({error:'En az 2, en fazla 25 rota noktası gerekli.'},{status:400})

  const profile=body?.profile==='bike'?'bike':body?.profile==='foot'?'foot':'car'
  const graphhopperKey=process.env.GRAPHHOPPER_API_KEY
  const osrmBase=(process.env.ROUTING_OSRM_BASE_URL||'https://router.project-osrm.org').replace(/\/$/,'')

  try{
    if(graphhopperKey){
      const url=new URL('https://graphhopper.com/api/1/route')
      for(const p of points)url.searchParams.append('point',`${p.lat},${p.lng}`)
      url.searchParams.set('profile',profile)
      url.searchParams.set('locale','tr')
      url.searchParams.set('calc_points','true')
      url.searchParams.set('points_encoded','false')
      url.searchParams.set('instructions','true')
      url.searchParams.set('key',graphhopperKey)
      const res=await fetch(url,{headers:{accept:'application/json'},cache:'no-store'})
      if(!res.ok)throw new Error(`GraphHopper ${res.status}`)
      const data=await res.json()
      const path=data?.paths?.[0]
      const coordinates=(path?.points?.coordinates||[]).map((c:number[])=>[Number(c[1]),Number(c[0])])
      const instructions:RouteInstruction[]=(path?.instructions||[]).slice(0,40).map((x:any)=>({
        text:String(x.text||''),distance:Number(x.distance||0),time:Number(x.time||0),street_name:x.street_name?String(x.street_name):undefined
      }))
      return NextResponse.json({provider:'graphhopper',distance_m:Number(path?.distance||0),duration_s:Math.round(Number(path?.time||0)/1000),coordinates,instructions},{headers:{'Cache-Control':'private, max-age=30'}})
    }

    if(osrmBase){
      const coordinatePath=points.map(p=>`${p.lng},${p.lat}`).join(';')
      const url=`${osrmBase}/route/v1/${profile==='bike'?'cycling':profile==='foot'?'walking':'driving'}/${coordinatePath}?overview=full&geometries=geojson&steps=true&annotations=false`
      const res=await fetch(url,{headers:{accept:'application/json'},cache:'no-store'})
      if(!res.ok)throw new Error(`OSRM ${res.status}`)
      const data=await res.json()
      const route=data?.routes?.[0]
      const coordinates=(route?.geometry?.coordinates||[]).map((c:number[])=>[Number(c[1]),Number(c[0])])
      const instructions:RouteInstruction[]=(route?.legs||[]).flatMap((leg:any)=>leg.steps||[]).slice(0,40).map((x:any)=>({
        text:[x?.maneuver?.type,x?.name].filter(Boolean).join(' • '),distance:Number(x.distance||0),time:Number(x.duration||0)*1000,street_name:x?.name?String(x.name):undefined
      }))
      return NextResponse.json({provider:process.env.ROUTING_OSRM_BASE_URL?'osrm':'osrm-public',distance_m:Number(route?.distance||0),duration_s:Math.round(Number(route?.duration||0)),coordinates,instructions},{headers:{'Cache-Control':'private, max-age=30'}})
    }

    return NextResponse.json({provider:'none',configured:false,error:'Production routing provider yapılandırılmamış.'},{status:503})
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'Rota hesaplanamadı.'},{status:502})
  }
}
