import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { AppRole, Profile } from '@/lib/types'

type ProfileOptions={allowInactive?:boolean}

export async function requireProfile(allowedRoles?: AppRole[],options:ProfileOptions={}) {
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub

  if (claimsError || !userId) redirect('/login')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('user_id, org_id, store_id, full_name, phone, role, avatar_url, is_active')
    .eq('user_id', userId)
    .single()

  if (error || !profile || !profile.org_id || !profile.role) {
    redirect('/login?error=profile')
  }

  if (!profile.is_active && !options.allowInactive) {
    if (profile.role === 'courier') redirect('/courier/profile?suspended=1')
    redirect('/login?error=inactive')
  }

  if (allowedRoles && !allowedRoles.includes(profile.role as AppRole)) {
    redirect(profile.role === 'courier' ? '/courier' : '/dashboard')
  }

  return { supabase, profile: profile as Profile, userId }
}
