'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { flushOfflineQueue, pendingOfflineCount } from '@/lib/offline-queue'

export default function OfflineSyncStatus() {
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)

  const refresh = useCallback(async () => {
    setOnline(navigator.onLine)
    setPending(await pendingOfflineCount().catch(() => 0))
  }, [])

  const sync = useCallback(async () => {
    if (!navigator.onLine || syncing) return
    setSyncing(true)
    const supabase = createClient()
    await flushOfflineQueue(supabase).catch(() => null)
    setSyncing(false)
    await refresh()
  }, [refresh, syncing])

  useEffect(() => {
    void refresh()
    const onOnline = () => { void refresh(); void sync() }
    const onOffline = () => { void refresh() }
    const onQueue = () => { void refresh() }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('altus:offline-queue', onQueue)
    const onSwMessage=(event:MessageEvent)=>{if(event.data?.type==='ALTUS_SYNC_REQUEST')void sync()}
    navigator.serviceWorker?.addEventListener('message',onSwMessage)
    const timer = window.setInterval(() => { if (navigator.onLine) void sync() }, 30_000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('altus:offline-queue', onQueue)
      navigator.serviceWorker?.removeEventListener('message',onSwMessage)
      window.clearInterval(timer)
    }
  }, [refresh, sync])

  if (online && pending === 0) return null
  return <button type="button" className={`syncBanner ${online ? 'syncPending' : 'syncOffline'}`} onClick={() => void sync()}>
    <span className="syncDot" />
    <span>{!online ? 'Çevrimdışı — işlemler cihazda saklanıyor' : syncing ? 'Bekleyen işlemler senkronize ediliyor…' : `${pending} işlem senkronizasyon bekliyor`}</span>
  </button>
}
