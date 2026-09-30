import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function safeNext(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
    ? value
    : '/dashboard'
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const flowId = url.searchParams.get('sb_flow_id')
  const next = safeNext(url.searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    )
    if (!error) {
      const response = NextResponse.redirect(new URL(next, url.origin))
      response.headers.set('Cache-Control', 'private, no-store')
      return response
    }
  }

  return NextResponse.redirect(new URL('/login?error=recovery', url.origin))
}
