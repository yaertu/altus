import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params
  const supabase=await createClient()
  const {data:claims}=await supabase.auth.getClaims()
  if(!claims?.claims?.sub)return NextResponse.json({error:'Oturum gerekli'},{status:401})
  const {data:proof}=await supabase.from('delivery_proofs').select('storage_path').eq('id',id).single()
  if(!proof)return NextResponse.json({error:'Kanıt bulunamadı'},{status:404})
  const {data,error}=await supabase.storage.from('delivery-proofs').createSignedUrl(proof.storage_path,60)
  if(error||!data?.signedUrl)return NextResponse.json({error:'Kanıt açılamadı'},{status:400})
  return NextResponse.redirect(data.signedUrl)
}
