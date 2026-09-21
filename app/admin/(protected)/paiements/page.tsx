import Link from 'next/link'
import { createAdminClient } from '@/utils/supabase/admin'
import { creerT } from '@/lib/i18n'
import { langueNavigateur } from '@/lib/i18n-server'
import { NIVEAUX, type Niveau } from '@/lib/abonnement'
import { formatDate } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'

const STATUTS: Record<string, string> = { pending: 'En attente', completed: 'Payé', failed: 'Échoué' }

export default async function AdminPaiementsPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const { statut } = await searchParams
  const lang = await langueNavigateur()
  const t = creerT(lang)
  const admin = createAdminClient()

  let requete = admin
    .from('abonnement_paiements')
    .select('id, organisation_id, niveau, mois, montant, provider, moyen_paiement, statut, created_at, organisations(nom)')
    .order('created_at', { ascending: false })
    .limit(300)
  if (statut && statut in STATUTS) requete = requete.eq('statut', statut)
  const { data: paiements } = await requete

  const total = (paiements ?? []).filter((p) => p.statut === 'completed' && p.provider !== 'manuel').reduce((s, p) => s + Number(p.montant), 0)
  const fcfa = (v: number) => `${v.toLocaleString('fr-FR').replace(/[  ]/g, ' ')} F CFA`
  const filtres: { label: string; value?: string }[] = [
    { label: 'Tous' }, { label: 'En attente', value: 'pending' }, { label: 'Payé', value: 'completed' }, { label: 'Échoué', value: 'failed' },
  ]

  return (
    <>
      <PageHeader titre={t('Paiements')} description={`${t('Encaissé (paiements en ligne)')} : ${fcfa(total)}`}>
        <div className="flex flex-wrap gap-2">
          {filtres.map((f) => (
            <Link
              key={f.label}
              href={f.value ? `/admin/paiements?statut=${f.value}` : '/admin/paiements'}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${statut === f.value ? 'border-primary bg-primary text-primary-foreground' : 'border-surface-border text-foreground-muted hover:bg-sidebar'}`}
            >
              {t(f.label)}
            </Link>
          ))}
        </div>
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Date')}</th><th className={th}>{t('Entreprise')}</th><th className={th}>{t('Niveau')}</th><th className={th}>{t('Durée')}</th>
            <th className={`${th} text-end`}>{t('Montant')}</th><th className={th}>{t('Prestataire')}</th><th className={th}>{t('Statut')}</th>
          </tr>
        </thead>
        <tbody>
          {paiements?.map((p) => {
            const org = Array.isArray(p.organisations) ? p.organisations[0] : p.organisations
            return (
              <tr key={p.id}>
                <td className={`${td} whitespace-nowrap`}>{formatDate(p.created_at, lang)}</td>
                <td className={td}><Link href={`/admin/entreprises/${p.organisation_id}`} className="text-primary underline">{org?.nom ?? p.organisation_id}</Link></td>
                <td className={td}>{t(NIVEAUX[p.niveau as Niveau]?.nom ?? p.niveau)}</td>
                <td className={td}>{t('{n} mois', { n: p.mois })}</td>
                <td className={`${td} text-end tabular-nums`}>{fcfa(Number(p.montant))}</td>
                <td className={`${td} capitalize`}>{p.provider === 'manuel' ? t('Manuel') : `${p.provider} · ${p.moyen_paiement}`}</td>
                <td className={`${td} ${p.statut === 'completed' ? 'text-success' : p.statut === 'failed' ? 'text-danger' : ''}`}>{t(STATUTS[p.statut])}</td>
              </tr>
            )
          })}
          {(paiements ?? []).length === 0 && (
            <tr><td colSpan={7} className={`${td} text-center text-foreground-muted`}>{t('Aucun paiement')}</td></tr>
          )}
        </tbody>
      </TableWrap>
    </>
  )
}
