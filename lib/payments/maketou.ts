import { maketouApiKey, maketouApiUrl } from './config'

type InitiateMaketouParams = {
  productId: string
  reference: string
  phoneLocal: string
  countryCode?: string
  customerEmail: string
  customerName?: string
  returnUrl: string
  montantAttendu?: number
}

export type InitiateMaketouResult =
  | { ok: true; providerTransactionId: string; checkoutUrl: string }
  | { ok: false; error: string }

function splitName(full: string | undefined, fallbackEmail: string): { first: string; last: string } {
  const v = (full ?? '').trim()
  if (!v) {
    const local = fallbackEmail.split('@')[0] || 'Client'
    return { first: local, last: '-' }
  }
  const parts = v.split(/\s+/)
  return { first: parts[0]!, last: parts.slice(1).join(' ') || '-' }
}

export async function initiateMaketouPayment(params: InitiateMaketouParams): Promise<InitiateMaketouResult> {
  if (!maketouApiKey) {
    return { ok: false, error: 'Maketou non configuré (MAKETOU_API_KEY manquant)' }
  }

  const { first, last } = splitName(params.customerName, params.customerEmail)

  const body = {
    productDocumentId: params.productId,
    email: params.customerEmail,
    firstName: first,
    lastName: last,
    phone: params.phoneLocal, // Le client doit valider/ajouter l'indicatif si nécessaire ou le passer correctement
    redirectURL: params.returnUrl,
    meta: { paymentId: params.reference },
  }

  let res: Response
  try {
    res = await fetch(`${maketouApiUrl}/api/v1/stores/cart/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${maketouApiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) {
    return { ok: false, error: `Erreur réseau Maketou : ${(err as Error).message}` }
  }

  let parsed: any
  try {
    parsed = await res.json()
  } catch {
    return { ok: false, error: `Maketou a répondu ${res.status} (réponse non-JSON)` }
  }

  const providerTransactionId = parsed.cart?.id
  const checkoutUrl = parsed.redirectUrl

  if (!res.ok || !providerTransactionId || !checkoutUrl) {
    return { ok: false, error: parsed.message || `Maketou a répondu ${res.status}` }
  }

  return { ok: true, providerTransactionId, checkoutUrl }
}

export async function fetchMaketouCart(cartId: string): Promise<{ status: string } | null> {
  if (!maketouApiKey) return null
  let res: Response
  try {
    res = await fetch(`${maketouApiUrl}/api/v1/stores/cart/${encodeURIComponent(cartId)}`, {
      headers: { Authorization: `Bearer ${maketouApiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    return null
  }
  if (!res.ok) return null
  const json = (await res.json().catch(() => null)) as any
  if (!json?.status) return null
  return { status: json.status }
}

export function mapMaketouStatus(raw: string): 'completed' | 'failed' | 'pending' {
  const s = raw.toLowerCase()
  if (s === 'completed') return 'completed'
  if (s === 'payment_failed' || s === 'abandoned') return 'failed'
  return 'pending' // waiting_payment
}
