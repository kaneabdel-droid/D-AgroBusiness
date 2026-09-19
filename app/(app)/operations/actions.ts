'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'

type Resultat = { success: true } | { error: string }

const txt = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
const opt = (f: FormData, k: string) => txt(f, k) || undefined

function message(error: { code?: string; message: string }): Resultat {
  if (error.code === '23505') return { error: 'Ce code existe déjà.' }
  if (error.code === '42501') return { error: 'Droits insuffisants pour cette opération.' }
  if (error.code === '23514') return { error: 'Valeurs invalides.' }
  return { error: error.message }
}

const rafraichir = () => revalidatePath('/', 'layout')

// ---------- Catalogue ----------

export async function addProduit(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const prix = txt(formData, 'prix_reference')
  const { error } = await supabase.from('produits').insert({
    organisation_id: ctx.organisationId,
    code: txt(formData, 'code').toUpperCase(),
    nom: txt(formData, 'nom'),
    categorie: txt(formData, 'categorie'),
    unite: txt(formData, 'unite') || 'kg',
    taux_tva: Number(txt(formData, 'taux_tva') || 0),
    prix_reference: prix ? Number(prix) : null,
  })
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

export async function addMagasin(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { error } = await supabase.from('magasins').insert({
    organisation_id: ctx.organisationId,
    code: txt(formData, 'code').toUpperCase(),
    nom: txt(formData, 'nom'),
    departement_id: opt(formData, 'departement_id') ?? null,
  })
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

export async function addContratDepot(formData: FormData): Promise<Resultat> {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { error } = await supabase.from('contrats_depot').insert({
    organisation_id: ctx.organisationId,
    code: txt(formData, 'code').toUpperCase(),
    fournisseur_id: txt(formData, 'fournisseur_id'),
    taux_commission: Number(txt(formData, 'taux_commission')),
    date_debut: txt(formData, 'date_debut'),
    date_fin: opt(formData, 'date_fin') ?? null,
  })
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

// ---------- Documents à lignes (achat, vente, réception de dépôt) ----------

export type LignePayload = {
  produit_id: string
  quantite: number
  prix_unitaire?: number
  taux_tva?: number
  contrat_depot_id?: string
}

async function rpc(nom: string, payload: object): Promise<Resultat> {
  const supabase = await createClient()
  const { error } = await supabase.rpc(nom, { p: payload })
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

export async function enregistrerAchat(payload: object) {
  return rpc('enregistrer_achat', payload)
}
export async function enregistrerVente(payload: object) {
  return rpc('enregistrer_vente', payload)
}
export async function recevoirDepot(payload: object) {
  return rpc('recevoir_depot', payload)
}

// ---------- Remboursement en nature ----------

export async function addReceptionNature(formData: FormData): Promise<Resultat> {
  return rpc('enregistrer_reception_nature', {
    date: txt(formData, 'date'),
    producteur_id: txt(formData, 'producteur_id'),
    magasin_id: txt(formData, 'magasin_id'),
    produit_id: txt(formData, 'produit_id'),
    quantite: Number(txt(formData, 'quantite')),
    prix_unitaire: Number(txt(formData, 'prix_unitaire')),
    campagne_id: opt(formData, 'campagne_id'),
    observation: opt(formData, 'observation'),
  })
}

// ---------- Trésorerie ----------

export async function addCompteTresorerie(formData: FormData): Promise<Resultat> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('creer_compte_tresorerie', {
    p_nom: txt(formData, 'nom'),
    p_type: txt(formData, 'type'),
  })
  if (error) return message(error)
  rafraichir()
  return { success: true }
}

export async function addReglement(formData: FormData): Promise<Resultat> {
  return rpc('enregistrer_reglement', {
    date: txt(formData, 'date'),
    sens: txt(formData, 'sens'),
    tiers_id: txt(formData, 'tiers_id'),
    montant: Number(txt(formData, 'montant')),
    compte_tresorerie_id: txt(formData, 'compte_tresorerie_id'),
    reference: opt(formData, 'reference'),
    nature: opt(formData, 'nature'),
    contrat_financement_id: opt(formData, 'contrat_financement_id'),
  })
}

export async function addOperationTresorerie(formData: FormData): Promise<Resultat> {
  return rpc('enregistrer_operation_tresorerie', {
    date: txt(formData, 'date'),
    sens: txt(formData, 'sens'),
    montant: Number(txt(formData, 'montant')),
    compte_tresorerie_id: txt(formData, 'compte_tresorerie_id'),
    contrepartie_compte_id: txt(formData, 'contrepartie_compte_id'),
    libelle: txt(formData, 'libelle'),
    departement_id: opt(formData, 'departement_id'),
    secteur_id: opt(formData, 'secteur_id'),
    campagne_id: opt(formData, 'campagne_id'),
  })
}
