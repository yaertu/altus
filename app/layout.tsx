import type { Metadata, Viewport } from 'next'
import { Manrope } from 'next/font/google'
import 'leaflet/dist/leaflet.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import './globals.css'
import ServiceWorkerRegistration from '@/components/service-worker-registration'

const manrope=Manrope({subsets:['latin','latin-ext'],display:'swap',variable:'--font-app'})

export const metadata: Metadata = {
  title: {default:'Altus Sevkiyat Operasyon',template:'%s • Altus Sevkiyat'},
  description: 'Mağaza ve sevkiyat personeli için gerçek zamanlı teslimat operasyon sistemi',
  applicationName:'Altus Sevkiyat',
  manifest: '/manifest.webmanifest',
  icons:{icon:[{url:'/icon-192.png',sizes:'192x192',type:'image/png'},{url:'/icon-512.png',sizes:'512x512',type:'image/png'}],apple:[{url:'/apple-touch-icon.png',sizes:'180x180',type:'image/png'}]},
  appleWebApp:{capable:true,statusBarStyle:'default',title:'Altus Sevkiyat'},
  formatDetection:{telephone:true,address:false,email:false},
}
export const viewport: Viewport = { themeColor: '#cf006f', width: 'device-width', initialScale: 1, maximumScale:1, viewportFit: 'cover' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr" className={manrope.variable}><body>{children}<ServiceWorkerRegistration /></body></html>
}
