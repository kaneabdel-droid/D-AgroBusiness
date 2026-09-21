import { CheckCircle2, XCircle } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import { creerT } from '@/lib/i18n'
import { langueNavigateur } from '@/lib/i18n-server'
import { siteUrl } from '@/lib/payments/config'
import { clesPresentes, type Moyen } from '@/lib/payments/moyens'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { ActionButton } from '@/components/ActionButton'
import { ChariowProduitsEditor } from '@/components/ChariowProduitsEditor'
import { basculerMoyen, enregistrerProduitChariow } from './actions'

const MOYENS: { moyen: Moyen; nom: string; prestataire: string }[] = [
  { moyen: 'chariow', nom: 'Mobile Money / carte (Chariow)', prestataire: 'Chariow' },
  { moyen: 'wave', nom: 'Wave', prestataire: 'Bictorys' },
  { moyen: 'orange', nom: 'Orange Money', prestataire: 'Bictorys' },
  { moyen: 'carte', nom: 'Carte bancaire', prestataire: 'Moneroo' },
]

export default async function AdminConfigPage() {
  const t = creerT(await langueNavigateur())
  const admin = createAdminClient()
  const [{ data: moyens }, { data: produits }] = await Promise.all([
    admin.from('paiement_moyens').select('moyen, actif, note'),
    admin.from('chariow_produits').select('niveau, mois, product_id'),
  ])
  const etat = new Map((moyens ?? []).map((m) => [m.moyen, m]))

  const webhooks = [
    { nom: 'Bictorys', url: `${siteUrl}/api/webhooks/bictorys` },
    { nom: 'Moneroo', url: `${siteUrl}/api/webhooks/moneroo` },
    { nom: 'Chariow', url: `${siteUrl}/api/webhooks/chariow?secret=<CHARIOW_WEBHOOK_SECRET>` },
  ]

  return (
    <>
      <PageHeader titre={t('Configuration')} description={t('Moyens de paiement proposés aux clients et produits Chariow. Les clés API restent dans les variables d’environnement du serveur et ne sont jamais affichées.')} />

      <Card className="mb-6">
        <h2 className="mb-3 font-semibold">{t('Moyens de paiement')}</h2>
        <TableWrap>
          <thead>
            <tr><th className={th}>{t('Moyen')}</th><th className={th}>{t('Prestataire')}</th><th className={th}>{t('Clés sur le serveur')}</th><th className={th}>{t('Proposé aux clients')}</th><th className={th}></th></tr>
          </thead>
          <tbody>
            {MOYENS.map(({ moyen, nom, prestataire }) => {
              const actif = Boolean(etat.get(moyen)?.actif)
              const cles = clesPresentes[moyen]
              return (
                <tr key={moyen}>
                  <td className={td}>{t(nom)}</td>
                  <td className={td}>{prestataire}</td>
                  <td className={td}>
                    <span className={`inline-flex items-center gap-1 ${cles ? 'text-success' : 'text-danger'}`}>
                      {cles ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
                      {cles ? t('Présentes') : t('En attente des clés')}
                    </span>
                  </td>
                  <td className={`${td} font-medium ${actif && cles ? 'text-success' : 'text-foreground-muted'}`}>
                    {actif && cles ? t('Oui') : actif ? t('Activé, en attente des clés') : t('Non')}
                  </td>
                  <td className={td}><ActionButton label={actif ? t('Désactiver') : t('Activer')} action={basculerMoyen.bind(null, moyen, !actif)} /></td>
                </tr>
              )
            })}
          </tbody>
        </TableWrap>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 font-semibold">{t('Produits Chariow')}</h2>
        <p className="mb-3 text-sm text-foreground-muted">{t('Chariow débite le prix du produit configuré dans sa boutique : créez un produit par niveau et par durée, au prix indiqué, puis collez son identifiant. Un champ vide retombe sur les variables d’environnement.')}</p>
        <ChariowProduitsEditor produits={produits ?? []} action={enregistrerProduitChariow} />
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">{t('Adresses des webhooks à déclarer chez les prestataires')}</h2>
        <ul className="space-y-2 text-sm">
          {webhooks.map((w) => (
            <li key={w.nom}><span className="font-medium">{w.nom}</span> : <code className="break-all rounded bg-sidebar px-1.5 py-0.5 text-xs">{w.url}</code></li>
          ))}
        </ul>
      </Card>
    </>
  )
}
