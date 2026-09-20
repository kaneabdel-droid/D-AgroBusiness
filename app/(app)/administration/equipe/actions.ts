'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

type Resultat = { success: true } | { error: string }

const txt = (f: FormData, k: string) => String(f.get(k) ?? '').trim()

async function rpc(nom: string, payload: object): Promise<Resultat> {
  const supabase = await createClient()
  const { error } = await supabase.rpc(nom, { p: payload })
  if (error) return error.code === '42501' ? { error: 'Droits insuffisants pour cette opération.' } : { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function inviter(formData: FormData): Promise<Resultat> {
  return rpc('inviter_utilisateur', { email: txt(formData, 'email'), role: txt(formData, 'role') })
}

export async function annulerInvitation(id: string): Promise<Resultat> {
  return rpc('annuler_invitation', { id })
}

export async function changerRole(utilisateurId: string, role: string): Promise<Resultat> {
  return rpc('modifier_utilisateur', { utilisateur_id: utilisateurId, role })
}

export async function changerActivation(utilisateurId: string, actif: boolean): Promise<Resultat> {
  return rpc('modifier_utilisateur', { utilisateur_id: utilisateurId, actif })
}
