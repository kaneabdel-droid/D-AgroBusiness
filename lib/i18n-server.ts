import { cookies, headers } from 'next/headers'
import { estLang, type Lang } from '@/lib/i18n'

export const COOKIE_LANGUE = 'lang'

/** Langue choisie explicitement par l'utilisateur (cookie posé par le sélecteur de langue), sinon undefined. */
export async function langueChoisie(): Promise<Lang | undefined> {
  const v = (await cookies()).get(COOKIE_LANGUE)?.value
  return estLang(v) ? v : undefined
}

/** Pages sans organisation connue (connexion, inscription) : choix de l'utilisateur, sinon langue du navigateur (Accept-Language). */
export async function langueNavigateur(): Promise<Lang> {
  const choisie = await langueChoisie()
  if (choisie) return choisie
  const entete = (await headers()).get('accept-language') ?? ''
  const premiere = entete.split(',')[0]?.trim().toLowerCase() ?? ''
  return premiere.startsWith('ar') ? 'ar' : premiere.startsWith('en') ? 'en' : 'fr'
}
