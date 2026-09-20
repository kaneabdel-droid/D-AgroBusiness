'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'

type Resultat = { success: true } | { error: string }

const txt = (f: FormData, k: string) => String(f.get(k) ?? '').trim()

export async function addPrevision(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const montant = Number(txt(formData, 'montant'))
  if (!(montant > 0)) return { error: 'Montant invalide' }
  const debut = txt(formData, 'date_debut')
  const fin = txt(formData, 'date_fin')
  const recurrence = txt(formData, 'recurrence') || 'unique'
  if (recurrence === 'mensuelle' && !fin) return { error: 'Une prévision mensuelle a besoin d’une date de fin.' }
  const supabase = await createClient()
  const { error } = await supabase.from('previsions_tresorerie').insert({
    organisation_id: ctx.organisationId,
    libelle: txt(formData, 'libelle'),
    categorie: txt(formData, 'categorie') || 'autre',
    sens: txt(formData, 'sens'),
    montant,
    date_debut: debut,
    date_fin: recurrence === 'mensuelle' ? fin : null,
    recurrence,
  })
  if (error) {
    if (error.code === '42501') return { error: 'Droits insuffisants pour cette opération.' }
    if (error.code === '23514') return { error: 'Valeurs invalides.' }
    return { error: error.message }
  }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function supprimerPrevision(id: string): Promise<Resultat> {
  const supabase = await createClient()
  const { error } = await supabase.from('previsions_tresorerie').delete().eq('id', id)
  if (error) return error.code === '42501' ? { error: 'Droits insuffisants pour cette opération.' } : { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}
