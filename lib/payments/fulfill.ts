import crypto from 'node:crypto'
import { createAdminClient } from '@/utils/supabase/admin'
import type { NormalizedWebhookEvent } from './types'

export type PaymentProvider = 'bictorys' | 'moneroo' | 'chariow'

/**
 * Cœur idempotent du crédit d'abonnement : retrouve le paiement, vérifie le montant, puis demande à la base de faire passer le
 * paiement de 'pending' à 'completed'/'failed' (une seule fois) et de prolonger l'abonnement de l'organisation dans la même transaction.
 * Réutilisé par les webhooks (avec dédoublonnage) et par le cron de réconciliation.
 */
export async function applyPaymentResult(provider: PaymentProvider, event: NormalizedWebhookEvent) {
  const supabase = createAdminClient()

  const { data: payment } = await supabase
    .from('abonnement_paiements')
    .select('id, montant, statut')
    .eq('provider', provider)
    .eq('provider_reference', event.providerTransactionId)
    .maybeSingle()

  if (!payment) {
    console.error('[paiement] introuvable', { provider, reference: event.providerTransactionId })
    return { orphaned: true }
  }

  if (event.status === 'completed' && typeof event.reportedAmount === 'number' && event.reportedAmount !== Number(payment.montant)) {
    console.error('[paiement] montant incohérent — refusé', {
      provider,
      paymentId: payment.id,
      attendu: Number(payment.montant),
      recu: event.reportedAmount,
    })
    return { rejected: 'amount_mismatch' }
  }

  const { data, error } = await supabase.rpc('finaliser_paiement_abonnement', {
    p_paiement: payment.id,
    p_statut: event.status === 'completed' ? 'completed' : 'failed',
  })
  if (error) {
    console.error('[paiement] finalisation impossible', error.message)
    return { failed: true }
  }
  return data === 'deja_traite' ? { alreadyProcessed: true } : { processed: true, statut: event.status }
}

/** Traite un événement de webhook déjà vérifié (signature/secret OK) : dédoublonne puis délègue à applyPaymentResult(). */
export async function fulfillWebhookEvent(provider: PaymentProvider, rawBody: string, event: NormalizedWebhookEvent) {
  const supabase = createAdminClient()

  // Dédoublonnage atomique : la clé primaire (provider, event_hash) rejette les doublons.
  const eventHash = crypto.createHash('sha256').update(rawBody).digest('hex').slice(0, 32)
  const { error: dedupError } = await supabase.from('paiement_webhook_events').insert({ provider, event_hash: eventHash })
  if (dedupError) return { deduped: true }

  return applyPaymentResult(provider, event)
}
