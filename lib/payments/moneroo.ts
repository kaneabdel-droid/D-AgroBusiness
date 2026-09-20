/**
 * Adaptateur Moneroo (Carte bancaire).
 * https://docs.moneroo.io/
 */

import crypto from 'node:crypto'
import { monerooSecretKey, monerooWebhookSecret } from './config'
import type { InitiatePaymentParams, InitiatePaymentResult, NormalizedWebhookEvent, VerifyWebhookResult } from './types'

const MONEROO_API_URL = 'https://api.moneroo.io'
const FETCH_TIMEOUT_MS = 15_000

function splitName(full: string | undefined, fallbackEmail: string): { first: string; last: string } {
  const v = (full ?? '').trim()
  if (!v) {
    const local = fallbackEmail.split('@')[0] || 'Client'
    return { first: local, last: '-' }
  }
  const parts = v.split(/\s+/)
  return { first: parts[0]!, last: parts.slice(1).join(' ') || '-' }
}

async function monerooFetch(path: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(`${MONEROO_API_URL}${path}`, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function initiateMonerooPayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
  if (!monerooSecretKey) {
    return { ok: false, error: 'Moneroo non configuré (MONEROO_SECRET_KEY manquant)' }
  }

  // Moneroo répond 400 silencieusement si first_name/last_name manquent.
  const { first, last } = splitName(params.customerName, params.customerEmail)

  const body = {
    amount: params.amount,
    currency: params.currency,
    description: params.description.slice(0, 200),
    return_url: params.returnUrl,
    customer: {
      email: params.customerEmail,
      first_name: first,
      last_name: last,
      ...(params.customerPhone ? { phone: params.customerPhone } : {}),
    },
    metadata: { paymentId: params.reference },
  }

  let res: Response
  try {
    res = await monerooFetch('/v1/payments/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${monerooSecretKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    return { ok: false, error: `Erreur réseau Moneroo : ${(err as Error).message}` }
  }

  let parsed: { data?: { id?: string; checkout_url?: string }; message?: string }
  try {
    parsed = await res.json()
  } catch {
    return { ok: false, error: `Moneroo a répondu ${res.status} (réponse non-JSON)` }
  }

  if (!res.ok || !parsed.data?.id || !parsed.data?.checkout_url) {
    return { ok: false, error: parsed.message || `Moneroo a répondu ${res.status}` }
  }

  return { ok: true, providerTransactionId: parsed.data.id, checkoutUrl: parsed.data.checkout_url }
}

/** Re-interroge Moneroo pour confirmer un paiement — défense en profondeur avant d'accorder l'abonnement. */
export async function verifyMonerooPayment(paymentId: string): Promise<{ status: string } | null> {
  if (!monerooSecretKey) return null
  let res: Response
  try {
    res = await monerooFetch(`/v1/payments/${encodeURIComponent(paymentId)}/verify`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${monerooSecretKey}`, Accept: 'application/json' },
    })
  } catch {
    return null
  }
  if (!res.ok) return null
  const json = (await res.json().catch(() => null)) as { data?: { status?: string } } | null
  if (!json?.data?.status) return null
  return { status: String(json.data.status).toLowerCase() }
}

export function verifyMonerooWebhook(rawBody: string, headers: Headers): VerifyWebhookResult {
  if (!monerooWebhookSecret) {
    return { ok: false, error: 'MONEROO_WEBHOOK_SECRET manquant' }
  }
  const sig = headers.get('x-moneroo-signature')
  if (!sig) return { ok: false, error: 'En-tête x-moneroo-signature manquant' }

  const expected = crypto.createHmac('sha256', monerooWebhookSecret).update(rawBody).digest('hex')
  const a = Buffer.from(sig.trim())
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'Signature Moneroo invalide' }
  }
  return { ok: true }
}

export function parseMonerooWebhookEvent(body: unknown): NormalizedWebhookEvent | null {
  const b = body as { event?: string; data?: Record<string, unknown> } | null
  if (!b?.event || !b.data) return null

  const data = b.data
  const providerTransactionId = data.id as string | undefined
  if (!providerTransactionId) return null

  const reportedAmount =
    typeof data.amount === 'number' ? data.amount : typeof data.amount === 'string' ? parseInt(data.amount, 10) : undefined
  const reportedCurrency =
    typeof data.currency === 'string' ? data.currency : (data.currency as { code?: string } | undefined)?.code

  if (b.event === 'payment.success') {
    return { providerTransactionId, status: 'completed', reportedAmount, reportedCurrency }
  }
  if (b.event === 'payment.failed' || b.event === 'payment.cancelled') {
    return {
      providerTransactionId,
      status: 'failed',
      failureReason: typeof data.status === 'string' ? data.status : b.event,
      reportedAmount,
      reportedCurrency,
    }
  }
  return null
}
