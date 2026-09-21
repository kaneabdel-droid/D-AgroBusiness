'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { isAdminEmail } from '@/lib/admin/auth'

// Verrouillage après échecs répétés, séparé de celui de /login (cookies dédiés).
const ATTEMPTS_COOKIE = 'admin_login_attempts'
const LOCKOUT_COOKIE = 'admin_lockout_until'
const MAX_ATTEMPTS = 3
const LOCKOUT_MS = 60_000

const retour = (code: string) => redirect(`/admin/login?erreur=${code}`)

export async function connecterAdmin(formData: FormData) {
  const cookieStore = await cookies()
  const verrou = cookieStore.get(LOCKOUT_COOKIE)?.value
  if (verrou && parseInt(verrou) > Date.now()) retour('verrou')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  })

  const compterEchec = () => {
    const tentatives = parseInt(cookieStore.get(ATTEMPTS_COOKIE)?.value ?? '0') + 1
    if (tentatives >= MAX_ATTEMPTS) {
      cookieStore.set(LOCKOUT_COOKIE, String(Date.now() + LOCKOUT_MS), { maxAge: 60, httpOnly: true })
      cookieStore.delete(ATTEMPTS_COOKIE)
    } else {
      cookieStore.set(ATTEMPTS_COOKIE, String(tentatives), { maxAge: 300, httpOnly: true })
    }
  }

  if (error) {
    compterEchec()
    retour('identifiants')
  }
  // Identifiants valides mais compte non administrateur : la session est refermée aussitôt.
  if (!isAdminEmail(data?.user?.email)) {
    compterEchec()
    await supabase.auth.signOut()
    retour('acces')
  }

  cookieStore.delete(ATTEMPTS_COOKIE)
  cookieStore.delete(LOCKOUT_COOKIE)
  redirect('/admin')
}
