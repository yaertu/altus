'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, CheckCheck, X, PackageCheck, TriangleAlert, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { AppNotification } from '@/lib/types'

function safeNotificationHref(item:AppNotification){const raw=item.data?.url;return typeof raw==='string'&&raw.startsWith('/')&&!raw.startsWith('//')?raw:(item.delivery_id?`/deliveries/${item.delivery_id}`:'#')}
function iconFor(kind:string){if(kind==='assignment'||kind==='status')return <PackageCheck size={17}/>;if(kind==='exception')return <TriangleAlert size={17}/>;return <Info size={17}/>}

export default function NotificationCenter({ userId, compact = false }: { userId: string; compact?: boolean }) {
  const [items, setItems] = useState<AppNotification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const unread = items.filter(x => !x.read_at).length

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(30)
    if (data) setItems(data as AppNotification[])
  }, [])

  useEffect(() => {
    void load()
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    void (async () => {
      await supabase.realtime.setAuth()
      channel = supabase.channel(`user:${userId}:notifications`, { config: { private: true } }).on('broadcast', { event: '*' }, () => { void load() }).subscribe()
    })()
    return () => { if (channel) void supabase.removeChannel(channel) }
  }, [load, userId])

  async function markAllRead() {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
    await load(); setLoading(false)
  }

  async function markRead(item: AppNotification) {
    if (item.read_at) return
    const supabase = createClient()
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', item.id)
    setItems(prev => prev.map(x => x.id === item.id ? { ...x, read_at: new Date().toISOString() } : x))
  }

  return <div className="notificationWrap">
    <button type="button" className={`notificationButton ${compact ? 'compact' : ''} ${unread?'hasUnread':''}`} onClick={() => setOpen(v => !v)} aria-label={`Bildirimler${unread?` • ${unread} okunmamış`:''}`} title="Bildirimler">
      <Bell size={18}/>{!compact && <span>Bildirimler</span>}{unread > 0 && <b>{unread > 9 ? '9+' : unread}</b>}
    </button>
    {open && <>
      <button className="drawerBackdrop" aria-label="Bildirimleri kapat" onClick={() => setOpen(false)} />
      <aside className="notificationDrawer" aria-label="Bildirim merkezi">
        <div className="drawerHead"><div><span className="eyebrow">CANLI AKIŞ</span><h2>Bildirimler</h2><p>Görev, atama ve saha değişiklikleri.</p></div><button className="iconButton" onClick={() => setOpen(false)} aria-label="Kapat"><X size={18}/></button></div>
        <div className="drawerToolbar"><span>{unread ? `${unread} okunmamış` : 'Hepsi okundu'}</span><button onClick={markAllRead} disabled={loading || unread === 0}><CheckCheck size={15}/> Tümünü okundu yap</button></div>
        <div className="notificationList">
          {items.length ? items.map(item => {
            const href = safeNotificationHref(item)
            return <Link key={item.id} href={href} className={`notificationItem ${item.read_at ? '' : 'unread'}`} onClick={() => { void markRead(item); setOpen(false) }}>
              <span className={`notificationIcon kind-${item.kind}`}>{iconFor(item.kind)}</span>
              <span><strong>{item.title}</strong><small>{item.body}</small><time>{new Date(item.created_at).toLocaleString('tr-TR')}</time></span>
            </Link>
          }) : <div className="empty"><strong>Henüz bildirim yok</strong>Yeni görev ve durum değişiklikleri burada görünür.</div>}
        </div>
      </aside>
    </>}
  </div>
}
