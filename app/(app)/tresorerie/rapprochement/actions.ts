'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { lireReleve } from '@/lib/releve'

type Resultat = { success: true } | { error: string }

const txt = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
const opt = (f: FormData, k: string) => txt(f, k) || undefined

async function rpc(nom: string, payload: object): Promise<Resultat> {
  const supabase = await createClient()
  const { error } = await supabase.rpc(nom, { p: payload })
  if (error) return error.code === '42501' ? { error: 'Droits insuffisants pour cette opération.' } : { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function importerReleve(formData: FormData): Promise<Resultat> {
  const fichier = formData.get('fichier')
  if (!(fichier instanceof File) || fichier.size === 0) return { error: 'Choisissez un fichier CSV.' }
  const lu = lireReleve(await fichier.text())
  if ('erreur' in lu) return { error: lu.erreur }
  const dates = lu.lignes.map((l) => l.date).sort()
  return rpc('importer_releve', {
    compte_tresorerie_id: txt(formData, 'compte_tresorerie_id'),
    libelle: opt(formData, 'libelle') ?? fichier.name,
    date_debut: opt(formData, 'date_debut') ?? dates[0],
    date_fin: opt(formData, 'date_fin') ?? dates[dates.length - 1],
    solde_initial: opt(formData, 'solde_initial'),
    solde_final: opt(formData, 'solde_final'),
    lignes: lu.lignes,
  })
}

export async function pointer(ligneReleveId: string, ligneEcritureId: string): Promise<Resultat> {
  return rpc('pointer_ligne', { ligne_releve_id: ligneReleveId, ligne_ecriture_id: ligneEcritureId })
}

export async function depointer(ligneReleveId: string): Promise<Resultat> {
  return rpc('depointer_ligne', { ligne_releve_id: ligneReleveId })
}

export async function pointerAuto(releveId: string): Promise<Resultat> {
  return rpc('pointer_automatiquement', { releve_id: releveId })
}

export async function comptabiliser(ligneReleveId: string, formData: FormData): Promise<Resultat> {
  return rpc('comptabiliser_ligne', {
    ligne_releve_id: ligneReleveId,
    contrepartie_compte_id: txt(formData, 'contrepartie_compte_id'),
    libelle: opt(formData, 'libelle'),
    departement_id: opt(formData, 'departement_id'),
    secteur_id: opt(formData, 'secteur_id'),
    campagne_id: opt(formData, 'campagne_id'),
  })
}
