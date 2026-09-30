'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function safeNext(value: string) {
  return value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
    ? value
    : '/dashboard'
}

async function siteOrigin() {
  // Password recovery must return to the exact origin that requested it.
  // This keeps web, localhost and the Electron local server working with the same code.
  const h = await headers()
  const proto = h.get('x-forwarded-proto') || 'http'
  const host = h.get('x-forwarded-host') || h.get('host')
  if (host) return `${proto}://${host}`

  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  return configured || 'http://localhost:3000'
}

export async function login(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')
  const next = safeNext(String(formData.get('next') || '/dashboard'))

  if (!email || password.length < 6) {
    redirect(`/login?error=credentials&next=${encodeURIComponent(next)}`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) redirect(`/login?error=credentials&next=${encodeURIComponent(next)}`)
  redirect(next)
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  if (!email || !email.includes('@')) redirect('/login/forgot?error=email')

  const supabase = await createClient()
  const origin = await siteOrigin()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent('/auth/update-password')}`,
  })

  // Do not disclose whether an account exists for this address.
  if (error) console.error('Password reset request failed:', error.message)
  redirect('/login/forgot?sent=1')
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password') || '')
  const confirm = String(formData.get('confirm') || '')
  if (password.length < 10 || password !== confirm) {
    redirect('/auth/update-password?error=password')
  }

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims?.claims?.sub) redirect('/login?error=recovery')

  const { error } = await supabase.auth.updateUser({ password })
  if (error) redirect('/auth/update-password?error=update')
  redirect('/dashboard?password=updated')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
