// Cache only explicitly public static branding/offline assets. Never API, HTML dashboards,
// sessions, reports, Excel files, authenticated navigation responses or arbitrary images.
const CACHE='aviation-public-v1';
const PUBLIC=['/offline.html','/app-icons/icon-192-v2.png','/app-icons/icon-512-v2.png','/favicon.svg'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(PUBLIC)))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('/offline.html')));return;}if(PUBLIC.includes(u.pathname))e.respondWith(fetch(e.request).catch(()=>caches.match(u.pathname)));});
