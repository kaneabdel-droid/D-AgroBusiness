/**
 * Adaptateur Bictorys (Mobile Money Wave / Orange Money).
 *
 * Bictorys est derrière un WAF AWS (Bot Control) qui bloque le fetch par
 * défaut de Node (empreinte TLS d'undici). On passe par `curl` en
 * sous-processus à la place. Ne pas changer les arguments curl : ajouter
 * -s, -A, --noproxy, Accept, User-Agent, etc. refait déclencher le WAF.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import crypto from 'node:crypto'
import { bictorysApiKey, bictorysWebhookSecret } from './config'
import type { InitiatePaymentParams, InitiatePaymentResult, NormalizedWebhookEvent, VerifyWebhookResult } from './types'

const execFileP = promisify(execFile)

const BICTORYS_API_URL_LIVE = 'https://api.bictorys.com'
const BICTORYS_API_URL_SANDBOX = 'https://api.test.bictorys.com'
const FETCH_TIMEOUT_MS = 15_000
const MAX_RETRIES_ON_WAF_403 = 3

function bictorysApiUrl(apiKey: string): string {
  return apiKey.startsWith('test_') ? BICTORYS_API_URL_SANDBOX : BICTORYS_API_URL_LIVE
}

function parseRawHttpResponse(raw: string): { status: number; body: string } {
  const sep = raw.indexOf('\r\n\r\n')
  const head = sep >= 0 ? raw.slice(0, sep) : raw
  const body = sep >= 0 ? raw.slice(sep + 4) : ''
  const statusLine = head.split(/\r?\n/)[0] ?? ''
  const m = statusLine.match(/^HTTP\/[\d.]+\s+(\d+)/)
  return { status: m ? parseInt(m[1]!, 10) : 0, body }
}

async function bictorysFetch(
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string }
): Promise<{ ok: boolean; status: number; text: string }> {
  const args: string[] = ['-i', '-X', init.method]
  for (const [k, v] of Object.entries(init.headers)) args.push('-H', `${k}: ${v}`)
  if (init.body) args.push('-d', init.body)
  args.push(url)

  let lastError = ''
  for (let attempt = 0; attempt < MAX_RETRIES_ON_WAF_403; attempt++) {
    try {
      const { stdout } = await execFileP('curl', args, {
        timeout: FETCH_TIMEOUT_MS,
        maxBuffer: 4 * 1024 * 1024,
      })
      const { status, body } = parseRawHttpResponse(stdout)

      if (status === 403 && body.includes('Forbidden')) {
        lastError = `Bictorys WAF a renvoyé 403 (tentative ${attempt + 1}/${MAX_RETRIES_ON_WAF_403})`
        if (attempt < MAX_RETRIES_ON_WAF_403 - 1) {
          await new Promise((r) => setTimeout(r, 2_000 * Math.pow(2, attempt)))
          continue
        }
      }

      return { ok: status >= 200 && status < 300, status, text: body }
    } catch (err) {
      lastError = (err as Error).message
      if (attempt < MAX_RETRIES_ON_WAF_403 - 1) {
        await new Promise((r) => setTimeout(r, 2_000 * Math.pow(2, attempt)))
      }
    }
  }

  return { ok: false, status: 0, text: lastError }
}

export async function initiateBictorysPayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
  if (!bictorysApiKey) {
    return { ok: false, error: 'Bictorys non configuré (BICTORYS_API_KEY manquant)' }
  }

  // Le WAF Bictorys rejette les corps de requête contenant "localhost".
  if (params.returnUrl.includes('localhost') || params.cancelUrl.includes('localhost')) {
    return {
      ok: false,
      error: "Bictorys rejette les URLs contenant 'localhost'. Utilisez un tunnel public (ngrok) en développement.",
    }
  }

  const merchantCountry = params.country || 'SN'
  const body = {
    amount: params.amount,
    currency: params.currency,
    country: merchantCountry,
    paymentReference: params.reference,
    successRedirectUrl: params.returnUrl,
    // Bictorys est sensible à la casse de ce champ selon la version d'API : on envoie les deux.
    errorRedirectUrl: params.cancelUrl,
    ErrorRedirectUrl: params.cancelUrl,
    customerObject: {
      name: params.customerName || 'Client',
      email: params.customerEmail,
      phone: params.customerPhone || '',
      city: 'Dakar',
      country: merchantCountry,
      locale: 'fr-FR',
    },
  }

  const res = await bictorysFetch(`${bictorysApiUrl(bictorysApiKey)}/pay/v1/charges`, {
    method: 'POST',
    headers: { 'X-Api-Key': bictorysApiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const isWaf = res.status === 403 && res.text.includes('Forbidden')
    return {
      ok: false,
      error: isWaf
        ? 'Bictorys a bloqué la requête (WAF, 3 tentatives épuisées).'
        : `Bictorys a répondu ${res.status}: ${res.text.slice(0, 300)}`,
    }
  }

  let data: { transactionId?: string; chargeId?: string; link?: string; redirectUrl?: string }
  try {
    data = JSON.parse(res.text)
  } catch {
    return { ok: false, error: 'Bictorys : réponse JSON invalide' }
  }

  const providerTransactionId = data.transactionId || data.chargeId
  let checkoutUrl = data.link || data.redirectUrl
  if (!providerTransactionId || !checkoutUrl) {
    return { ok: false, error: 'Bictorys : réponse incomplète (pas de transactionId ou de lien)' }
  }

  try {
    const u = new URL(checkoutUrl)
    if (!u.searchParams.has('payment_category')) {
      u.searchParams.set('payment_category', 'mobile_money')
      checkoutUrl = u.toString()
    }
  } catch {
    // URL malformée : on la retourne telle quelle.
  }

  return { ok: true, providerTransactionId, checkoutUrl }
}

/** Vérifie la signature d'un webhook Bictorys — mode HMAC (préféré) ou X-Secret-Key statique (repli). */
export function verifyBictorysWebhook(rawBody: string, headers: Headers): VerifyWebhookResult {
  if (!bictorysWebhookSecret) {
    return { ok: false, error: 'BICTORYS_WEBHOOK_SECRET manquant' }
  }

  const sig = headers.get('x-webhook-signature')
  const ts = headers.get('x-webhook-timestamp')

  if (sig && ts) {
    let tsNum = parseInt(ts, 10)
    if (tsNum > 0 && tsNum < 10_000_000_000) tsNum *= 1000
    if (isNaN(tsNum) || Math.abs(Date.now() - tsNum) > 5 * 60_000) {
      return { ok: false, error: 'Horodatage Bictorys hors tolérance (±5 min)' }
    }
    const expected = crypto.createHmac('sha256', bictorysWebhookSecret).update(`${ts}.${rawBody}`).digest('hex')
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, error: 'Signature HMAC Bictorys invalide' }
    }
    return { ok: true }
  }

  const staticKey = headers.get('x-secret-key')
  if (!staticKey) {
    return { ok: false, error: 'Aucun en-tête de signature (X-Webhook-Signature ou X-Secret-Key)' }
  }
  const a = Buffer.from(staticKey)
  const b = Buffer.from(bictorysWebhookSecret)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'X-Secret-Key Bictorys invalide' }
  }
  return { ok: true }
}

export function parseBictorysWebhookEvent(body: unknown): NormalizedWebhookEvent | null {
  const b = body as {
    event?: string
    status?: string
    transactionId?: string
    chargeId?: string
    amount?: number
    currency?: string
  } | null
  if (!b) return null

  const providerTransactionId = b.transactionId || b.chargeId
  if (!providerTransactionId) return null

  const rawStatus = (b.status || b.event || '').toLowerCase()

  if (rawStatus.includes('succeed') || rawStatus === 'succeeded' || rawStatus === 'payment.succeeded') {
    return {
      providerTransactionId,
      status: 'completed',
      reportedAmount: typeof b.amount === 'number' ? b.amount : undefined,
      reportedCurrency: b.currency,
    }
  }
  if (rawStatus.includes('fail') || rawStatus.includes('cancel')) {
    return {
      providerTransactionId,
      status: 'failed',
      failureReason: rawStatus,
      reportedAmount: typeof b.amount === 'number' ? b.amount : undefined,
      reportedCurrency: b.currency,
    }
  }
  return null
}
