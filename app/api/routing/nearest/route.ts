import { NextRequest, NextResponse } from 'next/server'

type Point={id:string;lat:number;lng:number}

function validPoint(value:unknown):value is Point{
  if(!value||typeof value!=='object')return false
  const point=value as Point
  return typeof point.id==='string'&&point.id.length>0&&Number.isFinite(point.lat)&&Number.isFinite(point.lng)&&Math.abs(point.lat)<=90&&Math.abs(point.lng)<=180
}

function airDistance(a:Point,b:Point){
  const radius=6371000
  const p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180
  const dp=(b.lat-a.lat)*Math.PI/180,dl=(b.lng-a.lng)*Math.PI/180
  const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2
  return 2*radius*Math.asin(Math.sqrt(h))
}

export async function POST(req:NextRequest){
  const body=await req.json().catch(()=>null) as {origin?:Point;destinations?:Point[]}|null
  const origin=validPoint(body?.origin)?body!.origin:null
  const destinations=Array.isArray(body?.destinations)?body!.destinations.filter(validPoint).slice(0,20):[]
  if(!origin||!destinations.length)return NextResponse.json({error:'Başlangıç ve en az bir hedef gerekli.'},{status:400})

  const fallback=()=>destinations.map(point=>({id:point.id,distance_m:Math.round(airDistance(origin,point)),duration_s:null,source:'air'})).sort((a,b)=>a.distance_m-b.distance_m)
  const osrmBase=(process.env.ROUTING_OSRM_BASE_URL||'https://router.project-osrm.org').replace(/\/$/,'')
  try{
    const coordinates=[origin,...destinations].map(point=>`${point.lng},${point.lat}`).join(';')
    const url=`${osrmBase}/table/v1/driving/${coordinates}?sources=0&destinations=${destinations.map((_,index)=>index+1).join(';')}&annotations=duration,distance&skip_waypoints=true`
    const response=await fetch(url,{headers:{accept:'application/json'},next:{revalidate:30}})
    if(!response.ok)throw new Error(`OSRM ${response.status}`)
    const data=await response.json() as {code?:string;distances?:Array<Array<number|null>>;durations?:Array<Array<number|null>>}
    if(data.code!=='Ok')throw new Error('OSRM response')
    const distances=data.distances?.[0]||[];const durations=data.durations?.[0]||[]
    const ranked=destinations.map((point,index)=>({id:point.id,distance_m:Math.round(distances[index]??airDistance(origin,point)),duration_s:durations[index]===null||durations[index]===undefined?null:Math.round(durations[index]!),source:'road'})).sort((a,b)=>a.distance_m-b.distance_m)
    return NextResponse.json({provider:'osrm-table',ranked},{headers:{'Cache-Control':'private, max-age=20, stale-while-revalidate=40'}})
  }catch{
    return NextResponse.json({provider:'distance-fallback',ranked:fallback()},{headers:{'Cache-Control':'private, max-age=10'}})
  }
}
