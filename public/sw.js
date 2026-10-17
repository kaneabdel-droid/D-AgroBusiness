const CACHE_NAME = 'demba-offline-dagro-v1'
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {})
    }).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    }).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return

  // 1. Navigation requests (HTML pages) : Network-First with Cache Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request)
          if (cachedResponse) return cachedResponse
          const fallback = await caches.match('/')
          if (fallback) return fallback
          return caches.match('/offline.html')
        })
    )
    return
  }

  // 2. Static build assets (_next/static, fonts, icons) : Cache-First with Network Fallback
  if (url.pathname.startsWith('/_next/static/') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.png') || url.pathname.endsWith('.woff2')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return networkRes
        }).catch(() => new Response('', { status: 408 }))
      })
    )
    return
  }

  // 3. Other requests : Network with Cache Fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})
