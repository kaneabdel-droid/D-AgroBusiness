import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { formatDate } from '@/lib/utils'
import { finAcces, joursRestants, abonnementActif, NIVEAUX } from '@/lib/abonnement'
import { hasBictorysKeys, hasChariowKeys, hasMonerooKeys } from '@/lib/payments/config'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { AbonnementForm } from '@/components/AbonnementForm'
import { initierPaiement } from './actions'

const STATUTS: Record<string, string> = { pending: 'En attente', completed: 'Payé', failed: 'Échoué' }

export default async function AbonnementPage({ searchParams }: { searchParams: Promise<{ expire?: string; requis?: string }> }) {
  const { expire, requis } = await searchParams
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const e = ctx.abonnement
  const supabase = await createClient()
  const { data: paiements } = await supabase.from('abonnement_paiements').select('*').order('created_at', { ascending: false }).limit(20)

  const actif = abonnementActif(e)
  const paye = e.abonnementExpireLe !== null && e.abonnementExpireLe > new Date()
  const peutPayer = ['admin', 'direction'].includes(ctx.role)
  const moyens = [
    ...(hasBictorysKeys ? (['wave', 'orange'] as const) : []),
    ...(hasMonerooKeys ? (['carte'] as const) : []),
    ...(hasChariowKeys ? (['chariow'] as const) : []),
  ]
  const fcfa = (v: number) => `${v.toLocaleString('fr-FR').replace(/ | /g, ' ')} F CFA`

  return (
    <>
      <PageHeader
        titre={t('Abonnement')}
        description={t('Deux niveaux : Standard et Premium (avec les ressources humaines). Payez plusieurs mois d’un coup et gagnez 1 % de remise par mois payé.')}
      />

      {(expire === '1' || !actif) && (
        <p role="alert" className="mb-4 rounded-lg border border-danger p-3 text-sm text-danger">
          {e.verrouille ? t('Ce compte est verrouillé. Contactez le support.') : t('Votre accès a expiré. Choisissez un abonnement pour continuer.')}
        </p>
      )}
      {requis === 'premium' && (
        <p role="alert" className="mb-4 rounded-lg border border-surface-border bg-sidebar p-3 text-sm">
          {t('Les ressources humaines (personnel, pointage, congés, paie) sont incluses dans le niveau Premium.')}
        </p>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-foreground-muted">{t('Niveau actuel')}</p>
          <p className="mt-1 text-xl font-semibold">{t(NIVEAUX[e.niveau].nom)}</p>
        </Card>
        <Card>
          <p className="text-sm text-foreground-muted">{paye ? t('Abonnement payé jusqu’au') : t('Essai gratuit jusqu’au')}</p>
          <p className="mt-1 text-xl font-semibold">{formatDate(finAcces(e).toISOString(), ctx.lang)}</p>
        </Card>
        <Card>
          <p className="text-sm text-foreground-muted">{t('Jours restants')}</p>
          <p className={`mt-1 text-xl font-semibold tabular-nums ${joursRestants(e) <= 7 ? 'text-danger' : ''}`}>{joursRestants(e)}</p>
        </Card>
      </div>

      {peutPayer ? (
        <AbonnementForm
          niveauActuel={e.niveau}
          niveauBloque={paye ? e.niveau : null}
          moyens={[...moyens]}
          action={initierPaiement}
        />
      ) : (
        <p className="text-sm text-foreground-muted">{t('Seuls l’administrateur et la direction peuvent souscrire ou renouveler l’abonnement.')}</p>
      )}
      {paye && peutPayer && (
        <p className="mt-3 text-sm text-foreground-muted">{t('Un paiement prolonge l’abonnement à partir de son échéance. Le niveau ne peut changer qu’à l’échéance.')}</p>
      )}

      {paiements && paiements.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 font-heading text-lg font-semibold">{t('Historique des paiements')}</h2>
          <TableWrap>
            <thead>
              <tr>
                <th className={th}>{t('Date')}</th><th className={th}>{t('Niveau')}</th><th className={th}>{t('Durée')}</th>
                <th className={`${th} text-end`}>{t('Montant')}</th><th className={th}>{t('Statut')}</th>
              </tr>
            </thead>
            <tbody>
              {paiements.map((p) => (
                <tr key={p.id}>
                  <td className={td}>{formatDate(p.created_at, ctx.lang)}</td>
                  <td className={td}>{t(NIVEAUX[p.niveau as 'standard' | 'premium']?.nom ?? '')}</td>
                  <td className={td}>{t('{n} mois', { n: p.mois })}</td>
                  <td className={`${td} text-end tabular-nums`}>{fcfa(Number(p.montant))}</td>
                  <td className={`${td} ${p.statut === 'completed' ? 'text-success' : p.statut === 'failed' ? 'text-danger' : ''}`}>{t(STATUTS[p.statut])}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </>
      )}
    </>
  )
}
