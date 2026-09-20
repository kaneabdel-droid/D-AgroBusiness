import { headers } from 'next/headers'
import type { Lang } from '@/lib/i18n'

/** Langue du navigateur (en-tête Accept-Language) : sert aux pages sans organisation connue (connexion, inscription). */
export async function langueNavigateur(): Promise<Lang> {
  const entete = (await headers()).get('accept-language') ?? ''
  const premiere = entete.split(',')[0]?.trim().toLowerCase() ?? ''
  return premiere.startsWith('en') ? 'en' : 'fr'
}
