const STATIC_CACHE='altus-static-v4'
const STATIC_ASSETS=['/manifest.webmanifest','/icon-192.png','/icon-512.png','/apple-touch-icon.png','/offline.html']

self.addEventListener('install',event=>{event.waitUntil(caches.open(STATIC_CACHE).then(cache=>cache.addAll(STATIC_ASSETS)));self.skipWaiting()})
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys()){if(key!==STATIC_CACHE)await caches.delete(key)}await self.clients.claim()})())})

// Protected HTML/customer data is deliberately never cached. Only static shell assets are cached.
self.addEventListener('fetch',event=>{
  const req=event.request
  if(req.method!=='GET')return
  const url=new URL(req.url)
  if(url.origin!==self.location.origin)return
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).catch(()=>caches.match('/offline.html')))
    return
  }
  if(STATIC_ASSETS.includes(url.pathname))event.respondWith(caches.match(req).then(hit=>hit||fetch(req)))
})

self.addEventListener('push',event=>{
  let data={title:'Altus Sevkiyat',body:'Yeni bir bildirim var.',url:'/courier',kind:'delivery'}
  try{data={...data,...event.data.json()}}catch{}
  const options={body:data.body,icon:'/icon-192.png',badge:'/icon-192.png',data:{url:data.url||'/courier'},tag:data.tag||`altus-${data.kind||'notice'}`,renotify:true,vibrate:[180,80,180],actions:[{action:'open',title:'Aç'}]}
  event.waitUntil(self.registration.showNotification(data.title,options))
})

self.addEventListener('notificationclick',event=>{
  event.notification.close();const url=event.notification.data?.url||'/courier'
  event.waitUntil((async()=>{const wins=await clients.matchAll({type:'window',includeUncontrolled:true});for(const w of wins){if('focus'in w){if('navigate'in w)await w.navigate(url);return w.focus()}}return clients.openWindow(url)})())
})

self.addEventListener('sync',event=>{
  if(event.tag==='altus-field-sync')event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(wins=>Promise.all(wins.map(w=>w.postMessage({type:'ALTUS_SYNC_REQUEST'})))))
})
