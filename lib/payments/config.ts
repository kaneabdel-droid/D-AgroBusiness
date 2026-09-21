// Clés de la plateforme D-AGROBUSINESS elle-même (un seul compte marchand par prestataire) : lues dans l'environnement du serveur.
// Ne jamais importer ce module depuis un composant client.

export const bictorysApiKey = process.env.BICTORYS_API_KEY
export const bictorysWebhookSecret = process.env.BICTORYS_WEBHOOK_SECRET

export const monerooSecretKey = process.env.MONEROO_SECRET_KEY
export const monerooWebhookSecret = process.env.MONEROO_WEBHOOK_SECRET

export const chariowApiKey = process.env.CHARIOW_API_KEY
export const chariowWebhookSecret = process.env.CHARIOW_WEBHOOK_SECRET
export const chariowApiUrl = process.env.CHARIOW_API_URL || 'https://api.chariow.com/v1'

/**
 * Chariow ne facture jamais un montant libre : il débite le prix d'un produit préconfiguré dans sa boutique.
 * Un produit par niveau et par durée, dans une variable dédiée : CHARIOW_PRODUCT_STANDARD_1, CHARIOW_PRODUCT_PREMIUM_12, etc.
 * (l'écriture CHARIOW_PRODUITS_<NIVEAU>_<MOIS> est aussi acceptée). Repli : CHARIOW_PRODUITS, un JSON {"montant":"produit"}.
 */
export function chariowProduitPour(niveau: string, mois: number, montant: number): string | null {
  const suffixe = `${niveau.toUpperCase()}_${mois}`
  const direct = process.env[`CHARIOW_PRODUCT_${suffixe}`] || process.env[`CHARIOW_PRODUITS_${suffixe}`]
  if (direct) return direct.trim()
  try {
    const carte = JSON.parse(process.env.CHARIOW_PRODUITS || '{}') as Record<string, string>
    return carte[String(montant)] ?? null
  } catch {
    return null
  }
}

export const hasBictorysKeys = Boolean(bictorysApiKey && bictorysWebhookSecret)
export const hasMonerooKeys = Boolean(monerooSecretKey && monerooWebhookSecret)
export const hasChariowKeys = Boolean(chariowApiKey && chariowWebhookSecret)

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
