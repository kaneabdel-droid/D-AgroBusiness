import { verifyMonerooWebhook, parseMonerooWebhookEvent, verifyMonerooPayment } from '@/lib/payments/moneroo'
import { fulfillWebhookEvent } from '@/lib/payments/fulfill'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const rawBody = await req.text()

  const verified = verifyMonerooWebhook(rawBody, req.headers)
  if (!verified.ok) {
    console.error('[webhook:moneroo] signature invalide', verified.error)
    return Response.json({ error: verified.error }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return Response.json({ received: true, ignored: true })
  }

  const event = parseMonerooWebhookEvent(body)
  if (!event) {
    return Response.json({ received: true, ignored: true })
  }

  // Défense en profondeur : re-interroge Moneroo avant de créditer l'abonnement.
  if (event.status === 'completed') {
    const live = await verifyMonerooPayment(event.providerTransactionId)
    if (live && live.status !== 'success' && live.status !== 'succeeded') {
      event.status = 'failed'
      event.failureReason = `Incohérence re-vérification : statut réel = ${live.status}`
    }
  }

  const result = await fulfillWebhookEvent('moneroo', rawBody, event)
  return Response.json({ received: true, ...result })
}
