import { createAdminClient } from '@/utils/supabase/admin'
import { fetchChariowSale, mapChariowStatus } from '@/lib/payments/chariow'
import { applyPaymentResult } from '@/lib/payments/fulfill'

export const runtime = 'nodejs'

/**
 * Filet de sécurité (règle de réconciliation Chariow) : un paiement peut se régler alors que
 * l'utilisateur a déjà fermé l'onglet ET que le webhook n'est pas arrivé. Ce cron
 * repull le statut réel des paiements Chariow encore "pending" après quelques minutes.
 */
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const seuil = new Date(Date.now() - 2 * 60_000).toISOString()

  const { data: enAttente } = await supabase
    .from('abonnement_paiements')
    .select('provider_reference')
    .eq('provider', 'chariow')
    .eq('statut', 'pending')
    .not('provider_reference', 'is', null)
    .lt('created_at', seuil)

  const resultats = []
  for (const row of enAttente ?? []) {
    const saleId = row.provider_reference as string
    const live = await fetchChariowSale(saleId)
    if (!live) continue

    const status = mapChariowStatus(live.status)
    if (status === 'pending') continue

    const result = await applyPaymentResult('chariow', {
      providerTransactionId: saleId,
      status,
      reportedAmount: live.amount,
      reportedCurrency: live.currency,
    })
    resultats.push({ saleId, ...result })
  }

  return Response.json({ verifies: enAttente?.length ?? 0, resultats })
}
