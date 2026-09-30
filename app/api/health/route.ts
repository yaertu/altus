import { NextResponse } from 'next/server'
import { SUPABASE_URL } from '@/lib/supabase/config'
export const dynamic='force-dynamic'
export async function GET(){
  const started=Date.now(); const base=SUPABASE_URL
  try{
    if(!base)throw new Error('Supabase URL missing')
    const res=await fetch(`${base}/functions/v1/public-health`,{cache:'no-store'})
    if(!res.ok)throw new Error('Backend health failed')
    return NextResponse.json({status:'ok',database:'ok',version:'6.3.0',latencyMs:Date.now()-started},{headers:{'Cache-Control':'no-store'}})
  }catch{return NextResponse.json({status:'degraded',database:'unavailable',version:'6.3.0'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
