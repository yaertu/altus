const PRODUCTION_SUPABASE_URL='https://mfpecvflsludooresdlq.supabase.co'
const PRODUCTION_SUPABASE_PUBLISHABLE_KEY='sb_publishable_7Zb0BkRrlOb2Rx6fBTAOyg_wKI07vnw'

const configuredUrl=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const configuredKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()

// Migration bridge: older Vercel environments can still contain the retired project ref.
// Public URL/publishable key are safe client configuration; secret/service-role keys never live here.
export const SUPABASE_URL =
  configuredUrl?.includes('mfpecvflsludooresdlq.supabase.co')
    ? configuredUrl
    : PRODUCTION_SUPABASE_URL

export const SUPABASE_PUBLISHABLE_KEY =
  configuredUrl?.includes('mfpecvflsludooresdlq.supabase.co') && configuredKey
    ? configuredKey
    : PRODUCTION_SUPABASE_PUBLISHABLE_KEY
