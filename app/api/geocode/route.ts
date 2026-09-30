import { NextRequest, NextResponse } from 'next/server'

type Result={id:string;label:string;lat:number;lng:number;provider:string;confidence:number;precision:'rooftop'|'street'|'district'|'approximate'}

function uniqParts(parts:string[]){const seen=new Set<string>();return parts.map(x=>x.trim()).filter(Boolean).filter(x=>{const k=x.toLocaleLowerCase('tr');if(seen.has(k))return false;seen.add(k);return true})}
function cleanOperationalAddress(input:string){
  return input
    .replace(/\b(kat|katı|kat:|daire|daire:|d:|blok|blok:|apartman(?:ı)?|apt\.?|no\.?\s*daire)\s*[a-zçğıöşü0-9/-]+/gi,' ')
    .replace(/\b(iç kapı|iç kapı no|kapı kodu)\s*[:#-]?\s*[a-zçğıöşü0-9/-]+/gi,' ')
    .replace(/\s+/g,' ')
    .replace(/\s*,\s*/g,', ')
    .trim()
}
function precisionFromType(type:string):Result['precision']{const t=type.toLowerCase();if(/address|house|building|premise/.test(t))return'rooftop';if(/street|road|route/.test(t))return'street';if(/district|locality|place|municipality|neighbourhood/.test(t))return'district';return'approximate'}
function dedupe(items:Result[]){const out:Result[]=[];for(const x of items.sort((a,b)=>b.confidence-a.confidence)){if(!out.some(y=>Math.abs(y.lat-x.lat)<.00008&&Math.abs(y.lng-x.lng)<.00008))out.push(x)}return out.slice(0,8)}

export async function GET(req:NextRequest){
  const raw=req.nextUrl.searchParams.get('q')?.trim()||''
  const district=req.nextUrl.searchParams.get('district')?.trim()||''
  const city=req.nextUrl.searchParams.get('city')?.trim()||''
  const lat=Number(req.nextUrl.searchParams.get('lat'))
  const lng=Number(req.nextUrl.searchParams.get('lng'))
  if(raw.length<4)return NextResponse.json({results:[]})
  const cleaned=cleanOperationalAddress(raw)
  const q=uniqParts([cleaned||raw,district,city,'Türkiye']).join(', ')
  const results:Result[]=[]
  const maptiler=process.env.MAPTILER_API_KEY
  const graphhopper=process.env.GRAPHHOPPER_API_KEY
  const preview=process.env.NEXT_PUBLIC_DESKTOP_PREVIEW==='1'

  if(maptiler){
    try{
      const url=new URL(`https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json`)
      url.searchParams.set('key',maptiler);url.searchParams.set('country','tr');url.searchParams.set('limit','8');url.searchParams.set('language','tr');url.searchParams.set('autocomplete','false')
      if(Number.isFinite(lat)&&Number.isFinite(lng))url.searchParams.set('proximity',`${lng},${lat}`)
      const res=await fetch(url,{headers:{accept:'application/json'},cache:'no-store'})
      if(res.ok){const data=await res.json();for(const x of data?.features||[]){const la=Number(x.center?.[1]),ln=Number(x.center?.[0]);if(!Number.isFinite(la)||!Number.isFinite(ln))continue;const type=String(x.place_type?.[0]||x.properties?.type||x.id||'');results.push({id:`maptiler:${x.id||`${la},${ln}`}`,label:String(x.place_name||x.text||q),lat:la,lng:ln,provider:'MapTiler',confidence:Math.max(.45,Math.min(1,Number(x.relevance)||.72)),precision:precisionFromType(type)})}}
    }catch{}
  }

  if(graphhopper&&results.length<5){
    try{
      const url=new URL('https://graphhopper.com/api/1/geocode');url.searchParams.set('q',q);url.searchParams.set('locale','tr');url.searchParams.set('limit','8');url.searchParams.set('key',graphhopper)
      const res=await fetch(url,{headers:{accept:'application/json'},cache:'no-store'})
      if(res.ok){const data=await res.json();for(const x of data?.hits||[]){const la=Number(x.point?.lat),ln=Number(x.point?.lng);if(!Number.isFinite(la)||!Number.isFinite(ln))continue;const parts=uniqParts([x.name||'',x.street||'',x.housenumber||x.house_number||'',x.city||'',x.state||'']);results.push({id:`graphhopper:${x.osm_id||`${la},${ln}`}`,label:parts.join(', ')||q,lat:la,lng:ln,provider:'GraphHopper',confidence:.74,precision:precisionFromType(String(x.osm_value||x.type||''))})}}
    }catch{}
  }

  if(preview&&results.length<3){
    try{
      const url=new URL('https://nominatim.openstreetmap.org/search');url.searchParams.set('format','jsonv2');url.searchParams.set('q',q);url.searchParams.set('countrycodes','tr');url.searchParams.set('limit','6');url.searchParams.set('addressdetails','1')
      const res=await fetch(url,{headers:{accept:'application/json','accept-language':'tr','user-agent':'Altus-Sevkiyat-Desktop-Preview/5.0'},cache:'no-store'})
      if(res.ok){const data=await res.json();for(const x of data||[]){const la=Number(x.lat),ln=Number(x.lon);if(!Number.isFinite(la)||!Number.isFinite(ln))continue;results.push({id:`osm:${x.place_id||`${la},${ln}`}`,label:String(x.display_name||q),lat:la,lng:ln,provider:'OpenStreetMap Preview',confidence:Math.max(.4,Math.min(.78,Number(x.importance||.5)+.2)),precision:precisionFromType(String(x.type||x.class||''))})}}
    }catch{}
  }

  const final=dedupe(results)
  if(!final.length&&!maptiler&&!graphhopper&&!preview)return NextResponse.json({results:[],configured:false,message:'Production geocoding anahtarı gerekli.'},{status:503})
  return NextResponse.json({results:final,query:q,originalQuery:raw,normalizedQuery:cleaned,configured:Boolean(maptiler||graphhopper),previewFallback:preview&&!maptiler&&!graphhopper},{headers:{'Cache-Control':'private, max-age=60'}})
}
