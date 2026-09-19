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
  if (error.code === '23505') return { error: 'Cet élément existe déjà (matricule, période, code ou version).' }
  if (error.code === '42501') return { error: 'Droits insuffisants pour cette opération.' }
  if (error.code === '23514') return { error: 'Valeurs invalides (vérifiez les dates, montants et statuts).' }
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

/** Parts fiscales proposées : 1 (1,5 si marié) + 0,5 par enfant, plafonné à 5 ; modifiables par l'utilisateur. */
function partsParDefaut(situation: string, enfants: number) {
  const base = situation === 'marie' ? 1.5 : 1
  return Math.min(5, base + 0.5 * enfants)
}

// ---------- Personnel ----------

export async function addEmploye(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const situation = txt(formData, 'situation_familiale') || 'celibataire'
  const enfants = num(formData, 'nombre_enfants') ?? 0
  const conjoints = num(formData, 'nombre_conjoints') ?? (situation === 'marie' ? 1 : 0)
  const { error } = await supabase.from('employes').insert({
    organisation_id: ctx.organisationId,
    matricule: txt(formData, 'matricule').toUpperCase(),
    nom: txt(formData, 'nom'),
    prenom: opt(formData, 'prenom') ?? null,
    statut: txt(formData, 'statut'),
    poste: opt(formData, 'poste') ?? null,
    date_embauche: txt(formData, 'date_embauche'),
    departement_id: txt(formData, 'departement_id'),
    secteur_id: opt(formData, 'secteur_id') ?? null,
    situation_familiale: situation,
    nombre_enfants: enfants,
    nombre_conjoints: conjoints,
    parts_ir: num(formData, 'parts_ir') ?? partsParDefaut(situation, enfants),
    regime_ipres: txt(formData, 'regime_ipres') || 'general',
    deduction_fixe_mensuelle: num(formData, 'deduction_fixe_mensuelle') ?? 0,
    telephone: opt(formData, 'telephone') ?? null,
  })
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

export async function addContrat(employeId: string, formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { error } = await supabase.from('contrats_travail').insert({
    organisation_id: ctx.organisationId,
    employe_id: employeId,
    type: txt(formData, 'type'),
    date_debut: txt(formData, 'date_debut'),
    date_fin: opt(formData, 'date_fin') ?? null,
    salaire_base: num(formData, 'salaire_base') ?? 0,
    primes_mensuelles: num(formData, 'primes_mensuelles') ?? 0,
    taux_journalier: num(formData, 'taux_journalier') ?? null,
  })
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

// ---------- Pointage ----------

export type LignePointage = {
  employe_id: string
  statut: string
  secteur_id?: string
  campagne_id?: string
  departement_id?: string
}

export async function enregistrerPointages(date: string, lignes: LignePointage[]): Promise<Resultat> {
  const ctx = await getContexte()
  const retenues = lignes.filter((l) => l.statut)
  if (!date || retenues.length === 0) return { error: 'Choisissez une date et au moins un statut.' }
  const supabase = await createClient()
  const { error } = await supabase.from('pointages').upsert(
    retenues.map((l) => ({
      organisation_id: ctx.organisationId,
      employe_id: l.employe_id,
      date_pointage: date,
      statut: l.statut,
      departement_id: l.departement_id || null,
      secteur_id: l.secteur_id || null,
      campagne_id: l.campagne_id || null,
    })),
    { onConflict: 'employe_id,date_pointage' }
  )
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

// ---------- Congés ----------

export async function addDemandeConge(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { error } = await supabase.from('demandes_conge').insert({
    organisation_id: ctx.organisationId,
    employe_id: txt(formData, 'employe_id'),
    type: txt(formData, 'type'),
    date_debut: txt(formData, 'date_debut'),
    date_fin: txt(formData, 'date_fin'),
    motif: opt(formData, 'motif') ?? null,
  })
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

export async function traiterConge(id: string, decision: 'approuve' | 'refuse'): Promise<Resultat> {
  return rpc('traiter_conge', { p_id: id, p_decision: decision })
}

// ---------- Paie ----------

export async function addPeriode(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { error } = await supabase.from('periodes_paie').insert({
    organisation_id: ctx.organisationId,
    annee: num(formData, 'annee'),
    mois: num(formData, 'mois'),
  })
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

export async function calculerPaie(periodeId: string): Promise<Resultat> {
  return rpc('calculer_paie', { p_periode_id: periodeId })
}

export async function validerPaie(periodeId: string): Promise<Resultat> {
  return rpc('valider_paie', { p_periode_id: periodeId })
}

export async function payerSalaires(periodeId: string, date: string, compteId: string): Promise<Resultat> {
  return rpc('payer_salaires', { p: { periode_id: periodeId, date, compte_tresorerie_id: compteId } })
}

// ---------- Paramétrage de la paie ----------

export async function majParametrage(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const periodicites: Record<string, string> = {}
  for (const statut of ['permanent', 'saisonnier', 'journalier']) {
    const v = txt(formData, `periodicite_${statut}`)
    if (v) periodicites[statut] = v
  }
  const { error } = await supabase
    .from('parametrage_paie')
    .update({
      mode_ir: txt(formData, 'mode_ir'),
      bareme_version: opt(formData, 'bareme_version') ?? null,
      periodicite_par_statut: periodicites,
      jours_par_mois: num(formData, 'jours_par_mois') ?? 30,
      jours_conge_par_mois: num(formData, 'jours_conge_par_mois') ?? 2,
      abattement_pct: num(formData, 'abattement_pct') ?? 0,
      abattement_plafond_annuel: num(formData, 'abattement_plafond_annuel') ?? null,
      arrondi_base: num(formData, 'arrondi_base') ?? 0,
      ricf_mode: txt(formData, 'ricf_mode') || 'parts',
      ricf_marie_pct: num(formData, 'ricf_marie_pct') ?? 0,
      ricf_par_enfant_pct: num(formData, 'ricf_par_enfant_pct') ?? 0,
      ricf_max_enfants: num(formData, 'ricf_max_enfants') ?? 10,
      reduction_pression_points: num(formData, 'reduction_pression_points') ?? 0,
    })
    .eq('organisation_id', ctx.organisationId)
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

export async function validerParametrage(): Promise<Resultat> {
  return rpc('valider_parametrage_paie', {})
}

export async function addRegle(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { error } = await supabase.from('regles_paie').insert({
    organisation_id: ctx.organisationId,
    code: txt(formData, 'code').toUpperCase(),
    libelle: txt(formData, 'libelle'),
    taux_salarie: num(formData, 'taux_salarie') ?? 0,
    taux_employeur: num(formData, 'taux_employeur') ?? 0,
    plancher_mensuel: num(formData, 'plancher_mensuel') ?? 0,
    plafond_mensuel: num(formData, 'plafond_mensuel') ?? null,
    regime: opt(formData, 'regime') ?? null,
    deductible_ir: formData.get('deductible_ir') === 'oui',
    compte_cle: txt(formData, 'compte_cle') || 'organismes_sociaux',
    ordre: num(formData, 'ordre') ?? 10,
  })
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

export async function supprimerRegle(id: string): Promise<Resultat> {
  const supabase = await createClient()
  const { error } = await supabase.from('regles_paie').delete().eq('id', id)
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

export async function basculerRegle(id: string, actif: boolean): Promise<Resultat> {
  const supabase = await createClient()
  const { error } = await supabase.from('regles_paie').update({ actif }).eq('id', id)
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

// ---------- Barèmes de retenue à la source (import CSV, propres à l'organisation) ----------

const COLONNES = ['periodicite', 'revenu_brut', 'trimf', 'ir_1', 'ir_1_5', 'ir_2', 'ir_2_5', 'ir_3', 'ir_3_5', 'ir_4', 'ir_4_5', 'ir_5']

export async function importerBareme(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const version = txt(formData, 'version')
  const pays = txt(formData, 'pays').toUpperCase() || ctx.pays
  const fichier = formData.get('fichier')
  if (!version) return { error: 'Indiquez un nom de version (ex. SN-2026).' }
  if (!(fichier instanceof File) || fichier.size === 0) return { error: 'Choisissez un fichier CSV.' }

  const lignes = (await fichier.text()).replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
  const entete = lignes[0].split(/[;,]/).map((c) => c.trim().toLowerCase())
  const manquantes = COLONNES.filter((c) => !entete.includes(c))
  if (manquantes.length) return { error: `Colonnes manquantes : ${manquantes.join(', ')}` }

  const lignesBareme = []
  for (let i = 1; i < lignes.length; i++) {
    const cellules = lignes[i].split(/[;,]/).map((c) => c.trim())
    const enr: Record<string, string> = {}
    entete.forEach((c, idx) => (enr[c] = cellules[idx] ?? ''))
    const valeurs = COLONNES.slice(1).map((c) => Number(enr[c].replace(',', '.')))
    if (!['annuel', 'mensuel', 'journalier'].includes(enr.periodicite) || valeurs.some((v) => Number.isNaN(v))) {
      return { error: `Ligne ${i + 1} invalide (périodicité annuel/mensuel/journalier et valeurs numériques attendues).` }
    }
    lignesBareme.push({
      organisation_id: ctx.organisationId,
      version,
      pays,
      periodicite: enr.periodicite,
      revenu_brut: valeurs[0],
      trimf: valeurs[1],
      ir_1: valeurs[2], ir_1_5: valeurs[3], ir_2: valeurs[4], ir_2_5: valeurs[5], ir_3: valeurs[6],
      ir_3_5: valeurs[7], ir_4: valeurs[8], ir_4_5: valeurs[9], ir_5: valeurs[10],
    })
  }
  if (lignesBareme.length === 0) return { error: 'Le fichier ne contient aucune ligne.' }

  const supabase = await createClient()
  for (let i = 0; i < lignesBareme.length; i += 1000) {
    const { error } = await supabase.from('baremes_retenue').insert(lignesBareme.slice(i, i + 1000))
    if (error) {
      await supabase.from('baremes_retenue').delete().eq('organisation_id', ctx.organisationId).eq('version', version)
      return message(error)
    }
  }
  rafraichir()
  return { success: true }
}

export async function supprimerBareme(version: string): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { error } = await supabase
    .from('baremes_retenue')
    .delete()
    .eq('organisation_id', ctx.organisationId)
    .eq('version', version)
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

// ---------- Mode « calcul » : barème progressif, réductions de famille, forfaits par tranche ----------

export async function addTrancheIr(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { error } = await supabase.from('bareme_ir').insert({
    organisation_id: ctx.organisationId,
    tranche_min: num(formData, 'tranche_min'),
    tranche_max: num(formData, 'tranche_max') ?? null,
    taux: num(formData, 'taux'),
  })
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

export async function addReductionFamille(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { error } = await supabase.from('reductions_famille').insert({
    organisation_id: ctx.organisationId,
    parts: num(formData, 'parts'),
    taux: num(formData, 'taux'),
    minimum: num(formData, 'minimum') ?? 0,
    maximum: num(formData, 'maximum') ?? null,
  })
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

export async function addForfait(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { error } = await supabase.from('tranches_forfaitaires').insert({
    organisation_id: ctx.organisationId,
    code: 'TRIMF',
    libelle: txt(formData, 'libelle') || 'TRIMF',
    periodicite: txt(formData, 'periodicite') || 'annuel',
    seuil_min: num(formData, 'seuil_min'),
    seuil_max: num(formData, 'seuil_max') ?? null,
    montant: num(formData, 'montant'),
  })
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

export async function supprimerLigneParametre(
  table: 'bareme_ir' | 'reductions_famille' | 'tranches_forfaitaires',
  id: string
): Promise<Resultat> {
  if (!['bareme_ir', 'reductions_famille', 'tranches_forfaitaires'].includes(table)) return { error: 'Table invalide.' }
  const supabase = await createClient()
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

export async function chargerModelePaie(formData: FormData): Promise<Resultat> {
  return rpc('charger_modele_paie', { p_pays: txt(formData, 'pays') })
}
