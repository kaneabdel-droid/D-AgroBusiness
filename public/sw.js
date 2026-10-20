const CACHE_NAME = 'demba-offline-dagro-v3'
const STATIC_ASSETS = [
  '/',
  '/login',
  '/manifest.json',
  '/decouvrir-dagrobusiness'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Pré-mise en cache SW partielle D-AGROBUSINESS:', err)
      })
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

  if (url.pathname.startsWith('/api/')) return

  // 1. Navigation requests (Pages HTML) : Network-First avec repli Cache Shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone)
              // Mémoriser automatiquement la racine applicative
              if (url.pathname === '/' || (!url.pathname.startsWith('/decouvrir') && url.pathname !== '/login')) {
                cache.put('/', response.clone())
              }
            })
          }
          return response
        })
        .catch(async () => {
          const cookieHeader = request.headers.get('cookie') || ''
          const isOfflineActive = cookieHeader.includes('demba_offline_active=1')
          const isAppTarget = url.pathname !== '/login' && !url.pathname.startsWith('/decouvrir')

          const cached = await caches.match(request)
          if (cached && (!cached.redirected || isAppTarget)) {
            return cached
          }

          if (isAppTarget || isOfflineActive) {
            const fallbackApp = await caches.match('/')
            if (fallbackApp && !fallbackApp.redirected) {
              return fallbackApp
            }

            const fallbackLogin = await caches.match('/login')
            if (fallbackLogin) return fallbackLogin
          }

          if (url.pathname.startsWith('/decouvrir') || url.pathname === '/bienvenue') {
            const cachedVitrine = await caches.match('/decouvrir-dagrobusiness')
            if (cachedVitrine) return cachedVitrine
          }

          const fallbackLogin = await caches.match('/login')
          if (fallbackLogin) return fallbackLogin

          const fallbackRoot = await caches.match('/')
          if (fallbackRoot) return fallbackRoot

          return new Response('Application D-AGROBUSINESS hors-ligne', {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          })
        })
    )
    return
  }

  // 2. Next.js RSC Prefetch & Data requests (_rsc query param)
  if (url.searchParams.has('_rsc')) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        return new Response('', { status: 503, statusText: 'Offline RSC' })
      })
    )
    return
  }

  // 3. Static build assets (_next/static, fonts, images) : Cache-First
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              const clone = networkRes.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
            }
            return networkRes
          })
          .catch(() => new Response('', { status: 408 }))
      })
    )
    return
  }

  // 4. Autres requêtes : Network avec Cache Fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})
