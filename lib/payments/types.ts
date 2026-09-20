export type InitiatePaymentParams = {
  amount: number
  currency: 'XOF'
  description: string
  reference: string
  returnUrl: string
  cancelUrl: string
  customerEmail: string
  customerName?: string
  customerPhone?: string
  country?: string   // pays du client (ISO2), 'SN' par défaut
}

export type InitiatePaymentResult =
  | { ok: true; providerTransactionId: string; checkoutUrl: string }
  | { ok: false; error: string }

export type NormalizedWebhookEvent = {
  providerTransactionId: string
  status: 'completed' | 'failed'
  failureReason?: string
  reportedAmount?: number
  reportedCurrency?: string
}

export type VerifyWebhookResult = { ok: true } | { ok: false; error: string }
