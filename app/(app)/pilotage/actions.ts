'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'

type Resultat = { success: true } | { error: string }

const txt = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
const opt = (f: FormData, k: string) => txt(f, k) || undefined
const num = (f: FormData, k: string) => {
  const v = txt(f, k)
  return v === '' ? undefined : Number(v)
}

function message(error: { code?: string; message: string }): Resultat {
  if (error.code === '23505') return { error: 'Cet élément existe déjà (code ou ligne budgétaire identique).' }
  if (error.code === '42501') return { error: 'Droits insuffisants pour cette opération.' }
  return { error: error.message }
}

const rafraichir = () => revalidatePath('/', 'layout')

export async function addBudget(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { error } = await supabase.from('budgets').insert({
    organisation_id: ctx.organisationId,
    code: txt(formData, 'code').toUpperCase(),
    libelle: txt(formData, 'libelle'),
    exercice_id: txt(formData, 'exercice_id'),
    campagne_id: opt(formData, 'campagne_id') ?? null,
  })
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

export async function addBudgetLigne(budgetId: string, formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { error } = await supabase.from('budget_lignes').insert({
    organisation_id: ctx.organisationId,
    budget_id: budgetId,
    departement_id: txt(formData, 'departement_id'),
    secteur_id: opt(formData, 'secteur_id') ?? null,
    compte_id: txt(formData, 'compte_id'),
    montant: num(formData, 'montant') ?? 0,
  })
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

export async function supprimerBudgetLigne(id: string): Promise<Resultat> {
  const supabase = await createClient()
  const { error } = await supabase.from('budget_lignes').delete().eq('id', id)
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

export async function approuverBudget(id: string): Promise<Resultat> {
  const supabase = await createClient()
  const { error } = await supabase.from('budgets').update({ statut: 'approuve' }).eq('id', id)
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

export async function liquiderTva(annee: number, mois: number): Promise<Resultat> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('liquider_tva', { p_annee: annee, p_mois: mois })
  if (error) return message(error)
  rafraichir()
  return { success: true }
}
