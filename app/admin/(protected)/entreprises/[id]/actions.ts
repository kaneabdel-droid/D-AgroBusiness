'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { refuserSiNonAdmin } from '@/lib/admin/garde'
import { estDuree, estNiveau, montantAbonnement } from '@/lib/abonnement'

type Resultat = { success: true } | { error: string }

/** Accorde un abonnement à la main (virement reçu, geste commercial) : même circuit qu'un paiement, tracé dans l'historique. */
export async function accorderAbonnement(organisationId: string, niveau: string, mois: number): Promise<Resultat> {
  const refus = await refuserSiNonAdmin()
  if (refus) return { error: refus }
  if (!estNiveau(niveau) || !estDuree(mois)) return { error: 'Offre inconnue' }

  const admin = createAdminClient()
  const { data: org } = await admin.from('organisations').select('id').eq('id', organisationId).maybeSingle()
  if (!org) return { error: 'Entreprise introuvable' }

  const { data: paiement, error } = await admin
    .from('abonnement_paiements')
    .insert({ organisation_id: organisationId, niveau, mois, montant: montantAbonnement(niveau, mois), provider: 'manuel', moyen_paiement: 'manuel' })
    .select('id')
    .single()
  if (error || !paiement) return { error: error?.message ?? 'Impossible d’enregistrer' }
  const { error: erreurFinalisation } = await admin.rpc('finaliser_paiement_abonnement', { p_paiement: paiement.id, p_statut: 'completed' })
  if (erreurFinalisation) return { error: erreurFinalisation.message }

  revalidatePath('/admin', 'layout')
  return { success: true }
}

export async function prolongerEssai(organisationId: string, jours: number): Promise<Resultat> {
  const refus = await refuserSiNonAdmin()
  if (refus) return { error: refus }
  if (!Number.isInteger(jours) || jours < 1 || jours > 365) return { error: 'Valeur invalide' }

  const admin = createAdminClient()
  const { data: org } = await admin.from('organisations').select('essai_expire_le').eq('id', organisationId).maybeSingle()
  if (!org) return { error: 'Entreprise introuvable' }
  const base = Math.max(new Date(org.essai_expire_le).getTime(), Date.now())
  const { error } = await admin.from('organisations').update({ essai_expire_le: new Date(base + jours * 86_400_000).toISOString() }).eq('id', organisationId)
  if (error) return { error: error.message }

  revalidatePath('/admin', 'layout')
  return { success: true }
}

export async function verrouiller(organisationId: string, verrouille: boolean): Promise<Resultat> {
  const refus = await refuserSiNonAdmin()
  if (refus) return { error: refus }
  const admin = createAdminClient()
  const { data: org } = await admin.from('organisations').select('demo').eq('id', organisationId).maybeSingle()
  if (!org) return { error: 'Entreprise introuvable' }
  if (org.demo) return { error: 'L’organisation de démonstration ne peut pas être verrouillée' }
  const { error } = await admin.from('organisations').update({ compte_verrouille: verrouille }).eq('id', organisationId)
  if (error) return { error: error.message }

  revalidatePath('/admin', 'layout')
  return { success: true }
}
