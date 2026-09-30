import type { NextConfig } from 'next'

const csp=[
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.maptiler.com https://*.maptiler.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(process.env.NEXT_PUBLIC_DESKTOP_PREVIEW==='1'?[]:["upgrade-insecure-requests"]),
].join('; ')

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{source:'/(.*)',headers:[
      {key:'Content-Security-Policy',value:csp},
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'X-Frame-Options',value:'DENY'},
      {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
      {key:'Permissions-Policy',value:'camera=(self), microphone=(), geolocation=(self)'},
      {key:'Cross-Origin-Opener-Policy',value:'same-origin'},
      {key:'Strict-Transport-Security',value:'max-age=31536000; includeSubDomains'},
    ]}]
  },
}
export default nextConfig
