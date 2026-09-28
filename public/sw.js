// Service worker minimal : installabilité + accueil plus rapide au retour +
// message clair en cas de coupure réseau, SANS jamais mettre en cache une
// page applicative. Chaque page de D-AGROBUSINESS est un Server Component qui
// interroge Supabase à chaque requête (auth, rôle, données financières/stock) :
// la mettre en cache servirait à un utilisateur — potentiellement un autre,
// sur un poste partagé — des données obsolètes ou qui ne sont pas les
// siennes. Seuls les fichiers statiques (immuables, sans donnée utilisateur)
// sont mis en cache.

const CACHE = 'd-agrobusiness-statique-v1'
const FICHIERS_STATIQUES = ['/manifest.json', '/icon.svg', '/offline.html']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FICHIERS_STATIQUES)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Navigation (chargement d'une page) : toujours réseau d'abord — jamais de
  // page applicative servie depuis le cache — avec la page hors-ligne comme
  // seul filet de secours si le réseau est indisponible.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline.html'))
    )
    return
  }

  // Fichiers de build Next.js (hashés, donc immuables) et fichiers statiques
  // connus : cache d'abord, réseau en repli et en réserve pour la prochaine fois.
  if (url.pathname.startsWith('/_next/static/') || FICHIERS_STATIQUES.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((reponse) => {
        if (reponse) return reponse
        return fetch(request).then((res) => {
          if (res.ok) caches.open(CACHE).then((cache) => cache.put(request, res.clone()))
          return res
        })
      })
    )
  }
})
