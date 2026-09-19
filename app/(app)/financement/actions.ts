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
  if (error.code === '23505') return { error: 'Ce code existe déjà.' }
  if (error.code === '42501') return { error: 'Droits insuffisants pour cette opération.' }
  if (error.code === '23514') return { error: 'Valeurs invalides (vérifiez montants, durées et dates).' }
  return { error: error.message }
}

const rafraichir = () => revalidatePath('/', 'layout')

async function rpc(nom: string, args: object): Promise<Resultat> {
  const supabase = await createClient()
  const { error } = await supabase.rpc(nom, args)
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

// ---------- Financements ----------

export async function addContratFinancement(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contrats_financement')
    .insert({
      organisation_id: ctx.organisationId,
      code: txt(formData, 'code').toUpperCase(),
      libelle: txt(formData, 'libelle'),
      type: txt(formData, 'type'),
      bailleur_id: txt(formData, 'bailleur_id'),
      campagne_id: opt(formData, 'campagne_id') ?? null,
      departement_id: txt(formData, 'departement_id'),
      montant_accorde: num(formData, 'montant_accorde'),
      taux_annuel: num(formData, 'taux_annuel') ?? 0,
      duree_mois: num(formData, 'duree_mois'),
      periodicite_mois: num(formData, 'periodicite_mois') ?? 1,
      mode_remboursement: txt(formData, 'mode_remboursement') || 'annuite_constante',
      date_debut: txt(formData, 'date_debut'),
      garantie: opt(formData, 'garantie') ?? null,
    })
    .select('id')
    .single()
  if (error) return message(error)
  const res = await supabase.rpc('generer_echeancier', { p_contrat_id: data.id })
  if (res.error) return message(res.error)
  rafraichir()
  return { success: true }
}

export async function genererEcheancier(contratId: string): Promise<Resultat> {
  return rpc('generer_echeancier', { p_contrat_id: contratId })
}

export async function enregistrerTirage(contratId: string, formData: FormData): Promise<Resultat> {
  return rpc('enregistrer_tirage', {
    p: {
      contrat_id: contratId,
      date: txt(formData, 'date'),
      montant: num(formData, 'montant'),
      compte_tresorerie_id: txt(formData, 'compte_tresorerie_id'),
      reference: opt(formData, 'reference'),
    },
  })
}

export async function rembourserEcheance(
  echeanceId: string,
  date: string,
  compteTresorerieId: string
): Promise<Resultat> {
  return rpc('rembourser_echeance', {
    p: { echeance_id: echeanceId, date, compte_tresorerie_id: compteTresorerieId },
  })
}

// ---------- Subventions ----------

export async function addSubvention(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { error } = await supabase.from('subventions').insert({
    organisation_id: ctx.organisationId,
    code: txt(formData, 'code').toUpperCase(),
    libelle: txt(formData, 'libelle'),
    bailleur_id: txt(formData, 'bailleur_id'),
    materiel_id: opt(formData, 'materiel_id') ?? null,
    montant_accorde: num(formData, 'montant_accorde'),
    date_octroi: txt(formData, 'date_octroi'),
  })
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

export async function encaisserSubvention(formData: FormData): Promise<Resultat> {
  return rpc('encaisser_subvention', {
    p: {
      subvention_id: txt(formData, 'subvention_id'),
      date: txt(formData, 'date'),
      montant: num(formData, 'montant'),
      compte_tresorerie_id: txt(formData, 'compte_tresorerie_id'),
    },
  })
}

// ---------- Matériel ----------

export async function acquerirMateriel(formData: FormData): Promise<Resultat> {
  const dureeAns = num(formData, 'duree_ans')
  return rpc('acquerir_materiel', {
    p: {
      code: txt(formData, 'code'),
      designation: txt(formData, 'designation'),
      categorie: txt(formData, 'categorie'),
      mode_acquisition: txt(formData, 'mode_acquisition'),
      fournisseur_id: txt(formData, 'fournisseur_id'),
      date_acquisition: txt(formData, 'date_acquisition'),
      date_mise_service: opt(formData, 'date_mise_service'),
      cout: num(formData, 'cout'),
      taux_tva: num(formData, 'taux_tva'),
      valeur_residuelle: num(formData, 'valeur_residuelle'),
      duree_mois: dureeAns ? Math.round(dureeAns * 12) : undefined,
      departement_id: txt(formData, 'departement_id'),
      secteur_id: opt(formData, 'secteur_id'),
      taux_annuel: num(formData, 'taux_annuel'),
      duree_contrat_mois: num(formData, 'duree_contrat_mois'),
      periodicite_mois: num(formData, 'periodicite_mois'),
      mode_remboursement: opt(formData, 'mode_remboursement'),
    },
  })
}

export async function comptabiliserAmortissements(exerciceId: string): Promise<Resultat> {
  return rpc('comptabiliser_amortissements', { p_exercice_id: exerciceId })
}
