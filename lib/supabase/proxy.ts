import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config'

const PUBLIC_ROUTES=['/login','/track/','/privacy','/terms','/auth/callback','/auth/confirm','/api/health','/desktop-preview']
function isPublicPath(pathname:string){
  const base=PUBLIC_ROUTES.some(p=>p.endsWith('/')?pathname.startsWith(p):pathname===p||pathname.startsWith(`${p}/`))
  if(base)return true
  if(process.env.NEXT_PUBLIC_DESKTOP_PREVIEW==='1'&&(pathname==='/api/routing/route'||pathname==='/api/routing/nearest'||pathname==='/api/geocode'||pathname==='/api/geocode/reverse'||pathname==='/api/voice/navigation'))return true
  return false
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
    cookies: {
      getAll(){return request.cookies.getAll()},
      setAll(cookiesToSet){cookiesToSet.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});cookiesToSet.forEach(({name,value,options})=>response.cookies.set(name,value,options))},
    },
  })

  const { data } = await supabase.auth.getClaims()
  const authLanding = request.nextUrl.pathname === '/' && (request.nextUrl.searchParams.has('code') || request.nextUrl.searchParams.has('token_hash'))
  const publicPath=isPublicPath(request.nextUrl.pathname) || authLanding
  if (!data?.claims?.sub && !publicPath) {const target=request.nextUrl.clone();target.pathname='/login';target.searchParams.set('next',request.nextUrl.pathname);return NextResponse.redirect(target)}
  if (data?.claims?.sub && request.nextUrl.pathname==='/login') {const target=request.nextUrl.clone();target.pathname='/dashboard';target.search='';return NextResponse.redirect(target)}
  return response
}
