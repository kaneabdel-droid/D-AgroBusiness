'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'

type Resultat = { success: true } | { error: string }

const txt = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
const opt = (f: FormData, k: string) => txt(f, k) || null

// Le pays, la devise et le référentiel comptable ne se modifient pas ici : ils déterminent le plan comptable et les règles de paie.
export async function modifierEntreprise(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  if (ctx.role !== 'admin') return { error: 'Réservé à l’administrateur.' }

  const nom = txt(formData, 'nom')
  if (!nom) return { error: 'Le nom de l’entreprise est obligatoire.' }
  const email = opt(formData, 'email')
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Adresse e-mail invalide.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organisations')
    .update({
      nom,
      nif: opt(formData, 'nif'),
      rccm: opt(formData, 'rccm'),
      adresse: opt(formData, 'adresse'),
      telephone: opt(formData, 'telephone'),
      email,
    })
    .eq('id', ctx.organisationId)
    .select('id')
  if (error) return { error: error.code === '42501' ? 'Droits insuffisants pour cette opération.' : error.message }
  if (!data || data.length === 0) return { error: 'Droits insuffisants pour cette opération.' }

  // Le nom s'affiche dans la barre latérale, l'en-tête et les exports de toutes les pages.
  revalidatePath('/', 'layout')
  return { success: true }
}
