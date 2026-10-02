'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { ROLES_PRESTATIONS, UNITES_PRESTATION } from '@/lib/catalogue'

type Resultat = { success: true } | { error: string }

const UNITES = UNITES_PRESTATION.map((u) => u.value)

const txt = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
const opt = (f: FormData, k: string) => txt(f, k) || null

function nombre(f: FormData, k: string) {
  const v = txt(f, k).replace(',', '.')
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

function message(error: { code?: string; message: string }): Resultat {
  if (error.code === '42501') return { error: 'Droits insuffisants pour cette opération.' }
  if (error.code === '23514') return { error: 'Valeurs invalides.' }
  if (error.code === '23503') return { error: 'Élément utilisé ailleurs : suppression impossible.' }
  return { error: error.message }
}

/** Lit et contrôle le pointage (unité, quantités, téléphone, produit et variété, part de récolte). */
async function lirePointage(f: FormData, supabase: Awaited<ReturnType<typeof createClient>>) {
  const unite = txt(f, 'unite') || 'ha'
  if (!UNITES.includes(unite)) return { error: 'Unité de pointage invalide.' }
  const unite_autre = unite === 'autre' ? opt(f, 'unite_autre') : null
  if (unite === 'autre' && !unite_autre) return { error: 'Précisez l’unité de pointage.' }

  const quantite_traitee = nombre(f, 'quantite_traitee')
  if (quantite_traitee === null || Number.isNaN(quantite_traitee) || quantite_traitee <= 0) {
    return { error: 'Indiquez la quantité traitée (supérieure à 0).' }
  }

  const client_id = opt(f, 'client_id')
  let client_nom = opt(f, 'client_nom')
  let client_telephone = opt(f, 'client_telephone')
  if (client_id) {
    const { data: client } = await supabase.from('tiers').select('nom, telephone').eq('id', client_id).maybeSingle()
    if (!client) return { error: 'Client introuvable.' }
    client_nom = client_nom ?? client.nom
    client_telephone = client_telephone ?? client.telephone
  }
  if (!client_id && !client_nom) return { error: 'Indiquez le client.' }
  if (!client_telephone || client_telephone.replace(/\D/g, '').length < 7) {
    return { error: 'Indiquez le téléphone du client (au moins 7 chiffres).' }
  }

  const produit_id = opt(f, 'produit_id')
  const variete = produit_id ? opt(f, 'variete') : null
  if (produit_id) {
    const { data: produit } = await supabase.from('produits').select('variete_obligatoire').eq('id', produit_id).maybeSingle()
    if (!produit) return { error: 'Produit introuvable.' }
    if (produit.variete_obligatoire && !variete) return { error: 'Ce produit exige de préciser la variété.' }
  }

  const quantite_obtenue = nombre(f, 'quantite_obtenue')
  if (Number.isNaN(quantite_obtenue) || (quantite_obtenue !== null && quantite_obtenue < 0)) return { error: 'Quantité obtenue invalide.' }

  const mode_paiement = txt(f, 'mode_paiement') === 'part_recolte' ? 'part_recolte' : 'especes'
  const taux_part = mode_paiement === 'part_recolte' ? nombre(f, 'taux_part') : null
  const prix_unitaire_part = mode_paiement === 'part_recolte' ? nombre(f, 'prix_unitaire_part') : null
  const tarif_unitaire = mode_paiement === 'especes' ? nombre(f, 'tarif_unitaire') : null
  if (mode_paiement === 'part_recolte') {
    if (!quantite_obtenue) return { error: 'Indiquez la quantité obtenue pour calculer la part de récolte.' }
    if (taux_part === null || Number.isNaN(taux_part) || taux_part <= 0 || taux_part > 100) {
      return { error: 'Indiquez la part prélevée, entre 0 et 100 %.' }
    }
  }
  const montant = nombre(f, 'montant') ?? 0
  for (const v of [tarif_unitaire, prix_unitaire_part, montant]) {
    if (v !== null && (Number.isNaN(v) || v < 0)) return { error: 'Montant ou tarif invalide.' }
  }

  const materiel_id = opt(f, 'materiel_id')
  const type_prestation = opt(f, 'type_prestation')
  const date_prestation = opt(f, 'date_prestation')
  if (!materiel_id || !type_prestation || !date_prestation) return { error: 'Veuillez remplir les champs obligatoires.' }

  return {
    valeurs: {
      materiel_id,
      campagne_id: opt(f, 'campagne_id'),
      date_prestation,
      type_prestation,
      client_id,
      client_nom,
      client_telephone,
      unite,
      unite_autre,
      quantite_traitee,
      tarif_unitaire,
      produit_id,
      variete,
      quantite_obtenue,
      unite_obtenue: quantite_obtenue !== null ? opt(f, 'unite_obtenue') ?? 'sac' : null,
      mode_paiement,
      taux_part,
      prix_unitaire_part,
      montant,
    },
  }
}

async function autorise() {
  const ctx = await getContexte()
  return peutMenu(ctx, '/materiel/prestations', ROLES_PRESTATIONS) ? ctx : null
}

export async function ajouterPrestation(formData: FormData): Promise<Resultat> {
  const ctx = await autorise()
  if (!ctx) return { error: 'Droits insuffisants pour cette opération.' }
  const supabase = await createClient()
  const pointage = await lirePointage(formData, supabase)
  if ('error' in pointage) return { error: pointage.error as string }
  const { error } = await supabase.from('prestations_materiel').insert({ organisation_id: ctx.organisationId, ...pointage.valeurs })
  if (error) return message(error)
  // La prestation passe une écriture : comptabilité, soldes tiers et suivi budgétaire changent aussi.
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function modifierPrestation(id: string, formData: FormData): Promise<Resultat> {
  if (!(await autorise())) return { error: 'Droits insuffisants pour cette opération.' }
  const supabase = await createClient()
  const pointage = await lirePointage(formData, supabase)
  if ('error' in pointage) return { error: pointage.error as string }
  const { error } = await supabase.from('prestations_materiel').update(pointage.valeurs).eq('id', id)
  if (error) return message(error)
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function supprimerPrestation(id: string): Promise<Resultat> {
  if (!(await autorise())) return { error: 'Droits insuffisants pour cette opération.' }
  const supabase = await createClient()
  const { error } = await supabase.from('prestations_materiel').delete().eq('id', id)
  if (error) return message(error)
  revalidatePath('/', 'layout')
  return { success: true }
}
