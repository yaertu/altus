import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req:Request){
  try{
    const supabase=await createClient()
    const {data:claims}=await supabase.auth.getClaims()
    if(!claims?.claims?.sub)return NextResponse.json({error:'Oturum gerekli.'},{status:401})
    const {data:{session}}=await supabase.auth.getSession()
    if(!session?.access_token)return NextResponse.json({error:'Oturum yenilenemedi.'},{status:401})
    const body=await req.json()
    const {data,error}=await supabase.functions.invoke('create-user',{body,headers:{Authorization:`Bearer ${session.access_token}`}})
    if(error)return NextResponse.json({error:error.message||'Hesap oluşturulamadı.'},{status:400})
    if(data?.error)return NextResponse.json({error:data.error},{status:400})
    return NextResponse.json(data||{ok:true})
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Sunucu hatası.'},{status:500})}
}
