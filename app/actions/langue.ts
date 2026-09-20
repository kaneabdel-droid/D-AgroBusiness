'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { estLang } from '@/lib/i18n'
import { COOKIE_LANGUE } from '@/lib/i18n-server'

/** Enregistre la langue choisie (un an) et recharge l'application dans cette langue. */
export async function changerLangue(lang: string) {
  if (!estLang(lang)) return
  ;(await cookies()).set(COOKIE_LANGUE, lang, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  revalidatePath('/', 'layout')
}
