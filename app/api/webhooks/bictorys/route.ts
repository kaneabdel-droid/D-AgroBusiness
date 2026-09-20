import { verifyBictorysWebhook, parseBictorysWebhookEvent } from '@/lib/payments/bictorys'
import { fulfillWebhookEvent } from '@/lib/payments/fulfill'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const rawBody = await req.text()

  const verified = verifyBictorysWebhook(rawBody, req.headers)
  if (!verified.ok) {
    console.error('[webhook:bictorys] signature invalide', verified.error)
    return Response.json({ error: verified.error }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return Response.json({ received: true, ignored: true })
  }

  const event = parseBictorysWebhookEvent(body)
  if (!event) {
    return Response.json({ received: true, ignored: true })
  }

  const result = await fulfillWebhookEvent('bictorys', rawBody, event)
  return Response.json({ received: true, ...result })
}
