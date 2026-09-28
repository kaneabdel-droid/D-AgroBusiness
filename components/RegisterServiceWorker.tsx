'use client'

import { useEffect } from 'react'

// Rend l'application installable (icône sur l'écran d'accueil / bureau) et
// accélère les visites suivantes via le cache des fichiers statiques (cf.
// public/sw.js). N'affiche jamais rien : montée silencieusement au sommet de
// l'arbre, hors de la zone authentifiée, pour que l'installabilité fonctionne
// dès la page de connexion.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Échec silencieux : l'app reste pleinement fonctionnelle sans service
      // worker (navigateur trop ancien, mode privé strict…), seule
      // l'installabilité et le cache statique sont perdus.
    })
  }, [])

  return null
}
