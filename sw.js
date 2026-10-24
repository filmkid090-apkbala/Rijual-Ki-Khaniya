// Rijual Ki Khaniya service worker (v5)
// App ki files: network-first (naya update turant milta hai, internet na ho to purani copy).
// Supabase library (CDN) aur kahani ki photos pehli baar online jaane par save ho jati hain, taaki offline bhi chalein.
// Supabase ke database/login ki requests kabhi cache nahi hoti.
const CACHE='rijual-v5', MEDIA='rijual-media-v1';
const LIB='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4';
const FILES=['./','./index.html','./admin.html','./app.js','./pwa.js','./config.js','./manifest.json','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(CACHE);
    await c.addAll(FILES).catch(()=>{});
    try{const r=await fetch(LIB,{mode:'no-cors'});await c.put(LIB,r)}catch(_){}
  })());
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!==MEDIA).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const req=e.request,url=new URL(req.url);
  if(req.method!=='GET')return;
  if(req.url.startsWith(LIB)){            // library: cache-first
    e.respondWith(caches.match(LIB).then(hit=>hit||fetch(req).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put(LIB,cp));return r})));
    return;
  }
  if(url.origin!==location.origin){        // kahani ki photos: pehle save wali, peeche se update
    if(req.destination==='image'&&url.pathname.includes('/storage/v1/object/public/')){
      e.respondWith(caches.open(MEDIA).then(async c=>{
        const hit=await c.match(req);
        const net=fetch(req).then(r=>{c.put(req,r.clone());return r}).catch(()=>hit);
        return hit||net;
      }));
    }
    return;                                // baaki sab (supabase database/login) seedha network
  }
  e.respondWith(fetch(req).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp))}return r}).catch(()=>caches.match(req).then(r=>r||caches.match('./index.html'))));
});
