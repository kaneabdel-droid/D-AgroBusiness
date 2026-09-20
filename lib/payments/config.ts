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
 * CHARIOW_PRODUITS associe chaque montant (FCFA) à l'identifiant du produit, ex. {"10000":"prod_a","29100":"prod_b"}.
 * Les montants attendus sont listés dans la page Abonnement de l'application (README, section Abonnements).
 */
export function chariowProduitPour(montant: number): string | null {
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
