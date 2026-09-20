import { verifyChariowWebhookSecret, fetchChariowSale, mapChariowStatus } from '@/lib/payments/chariow'
import { applyPaymentResult } from '@/lib/payments/fulfill'

export const runtime = 'nodejs'

/**
 * Chariow n'a pas de signature de corps et le doc est explicite : "zéro confiance dans
 * le corps" — le webhook ne fait que déclencher une re-vérification (GET /sales/{id}),
 * jamais créditer directement sur la foi de ce qu'il contient.
 */
export async function POST(req: Request) {
  const url = new URL(req.url)

  const verified = verifyChariowWebhookSecret(url)
  if (!verified.ok) {
    console.error('[webhook:chariow] secret invalide', verified.error)
    return Response.json({ error: verified.error }, { status: 401 })
  }

  const rawBody = await req.text()
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return Response.json({ received: true, ignored: true })
  }

  const b = body as { data?: { id?: string }; sale_id?: string; custom_metadata?: { paymentId?: string } } | null
  const saleId = b?.data?.id || b?.sale_id
  if (!saleId) {
    return Response.json({ received: true, ignored: true })
  }

  const live = await fetchChariowSale(saleId)
  if (!live) {
    // Ne pas faire échouer le webhook : le cron de réconciliation réessaiera.
    return Response.json({ received: true, deferred: true })
  }

  const status = mapChariowStatus(live.status)
  if (status === 'pending') {
    return Response.json({ received: true, pending: true })
  }

  const result = await applyPaymentResult('chariow', {
    providerTransactionId: saleId,
    status,
    reportedAmount: live.amount,
    reportedCurrency: live.currency,
  })

  return Response.json({ received: true, ...result })
}
