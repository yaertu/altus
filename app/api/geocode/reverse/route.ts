import { NextRequest, NextResponse } from 'next/server'
export async function GET(req:NextRequest){
  const lat=Number(req.nextUrl.searchParams.get('lat')),lng=Number(req.nextUrl.searchParams.get('lng'))
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return NextResponse.json({label:null},{status:400})
  const key=process.env.MAPTILER_API_KEY
  const preview=process.env.NEXT_PUBLIC_DESKTOP_PREVIEW==='1'
  try{
    if(key){const url=new URL(`https://api.maptiler.com/geocoding/${lng},${lat}.json`);url.searchParams.set('key',key);url.searchParams.set('language','tr');url.searchParams.set('limit','1');const r=await fetch(url,{cache:'no-store'});if(r.ok){const d=await r.json();const f=d?.features?.[0];if(f)return NextResponse.json({label:String(f.place_name||f.text||''),provider:'MapTiler'})}}
    if(preview){const url=new URL('https://nominatim.openstreetmap.org/reverse');url.searchParams.set('format','jsonv2');url.searchParams.set('lat',String(lat));url.searchParams.set('lon',String(lng));url.searchParams.set('zoom','18');const r=await fetch(url,{headers:{'accept-language':'tr','user-agent':'Altus-Sevkiyat-Desktop-Preview/5.0'},cache:'no-store'});if(r.ok){const d=await r.json();return NextResponse.json({label:String(d?.display_name||''),provider:'OpenStreetMap Preview'})}}
  }catch{}
  return NextResponse.json({label:null})
}
