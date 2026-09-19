'use client'

import { createContext, useContext, useMemo } from 'react'
import { creerT, type Lang, type Traducteur } from '@/lib/i18n'

const Contexte = createContext<{ lang: Lang; t: Traducteur }>({ lang: 'fr', t: creerT('fr') })

/** Fournit la langue de l'organisation aux composants clients (voir le layout de l'application). */
export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const valeur = useMemo(() => ({ lang, t: creerT(lang) }), [lang])
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>
}

export function useT() {
  return useContext(Contexte)
}
