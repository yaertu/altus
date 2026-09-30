import { NextRequest, NextResponse } from 'next/server'

function cleanInstruction(input:string){
  return input.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,220)
}

export async function POST(req:NextRequest){
  const body=await req.json().catch(()=>({})) as {text?:string}
  const text=cleanInstruction(String(body.text||''))
  if(text.length<2)return NextResponse.json({error:'Metin gerekli.'},{status:400})

  const key=process.env.GOOGLE_CLOUD_TTS_API_KEY||process.env.GOOGLE_TTS_API_KEY
  if(!key)return NextResponse.json({error:'Google Cloud TTS yapılandırılmadı.',configured:false},{status:503})
  const voice=process.env.GOOGLE_TTS_VOICE||'tr-TR-Chirp3-HD-Aoede'

  try{
    const response=await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        input:{text},
        voice:{languageCode:'tr-TR',name:voice},
        audioConfig:voice.includes('Chirp3-HD')?{audioEncoding:'MP3'}:{audioEncoding:'MP3',speakingRate:1.03,pitch:0,volumeGainDb:1}
      }),
      cache:'no-store'
    })
    const data=await response.json().catch(()=>null) as {audioContent?:string;error?:{message?:string}}|null
    if(!response.ok||!data?.audioContent)throw new Error(data?.error?.message||`Google TTS ${response.status}`)
    const bytes=Buffer.from(data.audioContent,'base64')
    return new NextResponse(bytes,{status:200,headers:{'Content-Type':'audio/mpeg','Cache-Control':'private, max-age=86400','Content-Length':String(bytes.byteLength)}})
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'Ses üretilemedi.'},{status:502})
  }
}
