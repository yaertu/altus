import { redirect } from 'next/navigation'

function safeParam(value: string | undefined) {
  return value ? encodeURIComponent(value) : ''
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; sb_flow_id?: string; token_hash?: string; type?: string }>
}) {
  const params = await searchParams

  // Backward compatibility: older Supabase recovery links can fall back to Site URL
  // and arrive as /?code=... . Route them into the PKCE callback automatically.
  if (params.code) {
    const flow = params.sb_flow_id ? `&sb_flow_id=${safeParam(params.sb_flow_id)}` : ''
    redirect(`/auth/callback?code=${safeParam(params.code)}${flow}&next=${encodeURIComponent('/auth/update-password')}`)
  }

  // Token-hash recovery works across Electron and external browsers because it does
  // not depend on a PKCE verifier cookie created in another browser profile.
  if (params.token_hash && params.type) {
    redirect(`/auth/confirm?token_hash=${safeParam(params.token_hash)}&type=${safeParam(params.type)}&next=${encodeURIComponent('/auth/update-password')}`)
  }

  redirect('/dashboard')
}
