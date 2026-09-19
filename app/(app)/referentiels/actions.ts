'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'

type Resultat = { success: true } | { error: string }

const txt = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
const opt = (f: FormData, k: string) => txt(f, k) || null

function message(error: { code?: string; message: string }): Resultat {
  if (error.code === '23505') return { error: 'Ce code existe déjà.' }
  if (error.code === '42501') return { error: 'Droits insuffisants pour cette opération.' }
  if (error.code === '23P01') return { error: 'Cet exercice chevauche un exercice existant.' }
  if (error.code === '23514') return { error: 'Valeurs invalides (vérifiez les dates et les champs obligatoires).' }
  return { error: error.message }
}

export async function addDepartement(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { error } = await supabase.from('departements').insert({
    organisation_id: ctx.organisationId,
    code: txt(formData, 'code').toUpperCase(),
    nom: txt(formData, 'nom'),
    type: txt(formData, 'type') || 'autre',
  })
  if (error) return message(error)
  revalidatePath('/referentiels/departements')
  return { success: true }
}

export async function addSecteur(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const superficie = txt(formData, 'superficie_ha')
  const { error } = await supabase.from('secteurs_projets').insert({
    organisation_id: ctx.organisationId,
    departement_id: txt(formData, 'departement_id'),
    code: txt(formData, 'code').toUpperCase(),
    nom: txt(formData, 'nom'),
    nature: txt(formData, 'nature') || 'secteur',
    superficie_ha: superficie ? Number(superficie) : null,
  })
  if (error) return message(error)
  revalidatePath('/referentiels/secteurs')
  return { success: true }
}

export async function addExercice(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { error } = await supabase.from('exercices_comptables').insert({
    organisation_id: ctx.organisationId,
    libelle: txt(formData, 'libelle'),
    date_debut: txt(formData, 'date_debut'),
    date_fin: txt(formData, 'date_fin'),
  })
  if (error) return message(error)
  revalidatePath('/referentiels/exercices')
  return { success: true }
}

export async function addCampagne(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { error } = await supabase.from('campagnes').insert({
    organisation_id: ctx.organisationId,
    code: txt(formData, 'code').toUpperCase(),
    libelle: txt(formData, 'libelle'),
    date_debut: txt(formData, 'date_debut'),
    date_fin: txt(formData, 'date_fin'),
  })
  if (error) return message(error)
  revalidatePath('/referentiels/campagnes')
  return { success: true }
}

export async function addTiers(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const types = formData.getAll('types').map(String)
  if (types.length === 0) return { error: 'Choisissez au moins un type de tiers.' }
  const supabase = await createClient()
  const { error } = await supabase.from('tiers').insert({
    organisation_id: ctx.organisationId,
    code: txt(formData, 'code').toUpperCase(),
    nom: txt(formData, 'nom'),
    types,
    telephone: opt(formData, 'telephone'),
    email: opt(formData, 'email'),
    adresse: opt(formData, 'adresse'),
    nif: opt(formData, 'nif'),
  })
  if (error) return message(error)
  revalidatePath('/referentiels/tiers')
  return { success: true }
}

export async function addCompte(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { error } = await supabase.from('comptes_comptables').insert({
    organisation_id: ctx.organisationId,
    numero: txt(formData, 'numero'),
    libelle: txt(formData, 'libelle'),
  })
  if (error) return message(error)
  revalidatePath('/comptabilite/plan-comptable')
  return { success: true }
}
