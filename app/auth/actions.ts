'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { creerT } from '@/lib/i18n'
import { langueNavigateur } from '@/lib/i18n-server'

export async function signIn(formData: FormData) {
  const t = creerT(await langueNavigateur())
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  })
  if (error) return { error: t('Email ou mot de passe incorrect.') }
  redirect('/')
}

export async function signUp(formData: FormData) {
  const t = creerT(await langueNavigateur())
  const organisation = String(formData.get('organisation') ?? '').trim()
  const nomComplet = String(formData.get('nom_complet') ?? '').trim()
  const pays = String(formData.get('pays') ?? 'SN')
  const password = String(formData.get('password') ?? '')

  const email = String(formData.get('email') ?? '').trim()
  if (!nomComplet) return { error: t('Tous les champs sont obligatoires.') }
  if (password.length < 8) return { error: t('Le mot de passe doit contenir au moins 8 caractères.') }

  const supabase = await createClient()
  // sans nom d'entreprise, la personne rejoint l'organisation qui l'a invitée : une invitation doit l'attendre
  if (!organisation) {
    const { data: invitee } = await supabase.rpc('invitation_en_attente', { p_email: email })
    if (!invitee) return { error: t('Aucune invitation en attente pour cette adresse : indiquez le nom de votre entreprise pour créer un compte.') }
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: organisation ? { organisation_nom: organisation, nom_complet: nomComplet, pays } : { nom_complet: nomComplet },
    },
  })
  if (error) return { error: error.message }

  // Confirmation d'email activée : pas de session immédiate.
  if (!data.session) {
    return { success: t('Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse.') }
  }
  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
