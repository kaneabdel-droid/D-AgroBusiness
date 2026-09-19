'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function signIn(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  })
  if (error) return { error: 'Email ou mot de passe incorrect.' }
  redirect('/')
}

export async function signUp(formData: FormData) {
  const organisation = String(formData.get('organisation') ?? '').trim()
  const nomComplet = String(formData.get('nom_complet') ?? '').trim()
  const pays = String(formData.get('pays') ?? 'SN')
  const password = String(formData.get('password') ?? '')

  if (!organisation || !nomComplet) return { error: 'Tous les champs sont obligatoires.' }
  if (password.length < 8) return { error: 'Le mot de passe doit contenir au moins 8 caractères.' }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get('email') ?? '').trim(),
    password,
    options: {
      data: { organisation_nom: organisation, nom_complet: nomComplet, pays },
    },
  })
  if (error) return { error: error.message }

  // Confirmation d'email activée : pas de session immédiate.
  if (!data.session) {
    return { success: 'Compte créé. Vérifiez votre boîte mail pour confirmer votre adresse.' }
  }
  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
