import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { NIVEAUX, type Niveau } from '@/lib/abonnement'
import { fetchChariowSale, mapChariowStatus } from '@/lib/payments/chariow'
import { verifyMonerooPayment } from '@/lib/payments/moneroo'
import { applyPaymentResult } from '@/lib/payments/fulfill'
import { Card, PageHeader } from '@/components/ui/card'

/** Page de retour du prestataire : le statut vient toujours de la base ; un paiement encore en attente est re-vérifié auprès du prestataire. */
export default async function RetourPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const supabase = await createClient()

  const lire = async () =>
    ref ? (await supabase.from('abonnement_paiements').select('statut, niveau, mois, provider, provider_reference').eq('id', ref).maybeSingle()).data : null
  let paiement = await lire()

  if (paiement?.statut === 'pending' && paiement.provider_reference) {
    const reference = paiement.provider_reference
    if (paiement.provider === 'chariow') {
      const live = await fetchChariowSale(reference)
      const statut = live ? mapChariowStatus(live.status) : 'pending'
      if (live && statut !== 'pending') await applyPaymentResult('chariow', { providerTransactionId: reference, status: statut, reportedAmount: live.amount, reportedCurrency: live.currency })
    } else if (paiement.provider === 'moneroo') {
      const live = await verifyMonerooPayment(reference)
      if (live && (live.status === 'success' || live.status === 'succeeded')) await applyPaymentResult('moneroo', { providerTransactionId: reference, status: 'completed' })
    }
    paiement = await lire()
  }

  const statut = paiement?.statut ?? 'pending'
  return (
    <>
      <PageHeader titre={t('Paiement de l’abonnement')} description="" />
      {statut === 'pending' && <meta httpEquiv="refresh" content="6" />}
      <Card className="max-w-lg">
        {statut === 'completed' ? (
          <>
            <p className="text-lg font-semibold text-success">{t('Paiement confirmé')}</p>
            <p className="mt-2 text-sm">{t('Votre abonnement {niveau} est activé.', { niveau: NIVEAUX[paiement!.niveau as Niveau]?.nom ?? '' })}</p>
            <Link href="/" className="mt-4 inline-block font-medium text-primary underline">{t('Aller au tableau de bord')}</Link>
          </>
        ) : statut === 'failed' ? (
          <>
            <p className="text-lg font-semibold text-danger">{t('Paiement échoué')}</p>
            <p className="mt-2 text-sm">{t('Le paiement n’a pas abouti. Vous n’avez pas été débité.')}</p>
            <Link href="/abonnement" className="mt-4 inline-block font-medium text-primary underline">{t('Réessayer')}</Link>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold">{t('Paiement en cours de vérification…')}</p>
            <p className="mt-2 text-sm text-foreground-muted">{t('Cette page se met à jour automatiquement. Vous pouvez aussi la quitter : l’abonnement sera activé dès la confirmation du paiement.')}</p>
            <Link href="/abonnement" className="mt-4 inline-block font-medium text-primary underline">{t('Retour à l’abonnement')}</Link>
          </>
        )}
      </Card>
    </>
  )
}
