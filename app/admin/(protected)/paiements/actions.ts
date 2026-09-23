'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { refuserSiNonAdmin } from '@/lib/admin/garde'

type Resultat = { success: true } | { error: string }

/**
 * Supprime un paiement latent (en attente ou échoué) : jamais un paiement payé, qui reste la preuve comptable
 * de l'encaissement — le filtre `statut in (...)` est appliqué dans la requête elle-même, pas seulement en amont.
 */
export async function supprimerPaiement(id: string): Promise<Resultat> {
  const refus = await refuserSiNonAdmin()
  if (refus) return { error: refus }

  const admin = createAdminClient()
  const { error, count } = await admin
    .from('abonnement_paiements')
    .delete({ count: 'exact' })
    .eq('id', id)
    .in('statut', ['pending', 'failed'])
  if (error) return { error: error.message }
  if (!count) return { error: 'Introuvable, ou déjà payé : seuls les paiements en attente ou échoués peuvent être supprimés.' }

  revalidatePath('/admin/paiements')
  return { success: true }
}

/** Purge en une fois tous les paiements en attente ou échoués (nettoyage des essais de test, ex. Chariow en cours de configuration). */
export async function purgerPaiementsLatents(): Promise<Resultat> {
  const refus = await refuserSiNonAdmin()
  if (refus) return { error: refus }

  const admin = createAdminClient()
  const { error } = await admin.from('abonnement_paiements').delete().in('statut', ['pending', 'failed'])
  if (error) return { error: error.message }

  revalidatePath('/admin/paiements')
  return { success: true }
}
