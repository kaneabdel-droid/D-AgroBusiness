import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/utils/supabase/admin'
import { creerT } from '@/lib/i18n'
import { langueNavigateur } from '@/lib/i18n-server'
import { ROLES } from '@/lib/pays'
import { DUREES, NIVEAUX, montantAbonnement, type Niveau } from '@/lib/abonnement'
import { formatDate } from '@/lib/utils'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { ActionButton } from '@/components/ActionButton'
import { accorderAbonnement, prolongerEssai, verrouiller } from './actions'

const STATUTS: Record<string, string> = { pending: 'En attente', completed: 'Payé', failed: 'Échoué' }

export default async function AdminEntreprisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lang = await langueNavigateur()
  const t = creerT(lang)
  const admin = createAdminClient()

  const { data: org } = await admin.from('organisations').select('*').eq('id', id).maybeSingle()
  if (!org) notFound()
  const [{ data: utilisateurs }, { data: paiements }] = await Promise.all([
    admin.from('utilisateurs').select('id, nom_complet, role, actif, created_at').eq('organisation_id', id).order('created_at'),
    admin.from('abonnement_paiements').select('*').eq('organisation_id', id).order('created_at', { ascending: false }).limit(50),
  ])
  const fin = new Date(Math.max(new Date(org.essai_expire_le).getTime(), org.abonnement_expire_le ? new Date(org.abonnement_expire_le).getTime() : 0))
  const fcfa = (v: number) => `${v.toLocaleString('fr-FR').replace(/[  ]/g, ' ')} F CFA`

  return (
    <>
      <PageHeader titre={org.nom} description={`${org.pays} · ${org.devise} · ${org.referentiel}${org.demo ? ` · ${t('Démo')}` : ''}`}>
        <Link href="/admin/entreprises" className="text-sm text-primary underline">{t('← Entreprises')}</Link>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card><p className="text-sm text-foreground-muted">{t('Niveau')}</p><p className="mt-1 text-xl font-semibold">{t(NIVEAUX[org.niveau as Niveau]?.nom ?? org.niveau)}</p></Card>
        <Card><p className="text-sm text-foreground-muted">{t('Fin d’accès')}</p><p className="mt-1 text-xl font-semibold">{formatDate(fin.toISOString(), lang)}</p></Card>
        <Card><p className="text-sm text-foreground-muted">{t('Compte')}</p><p className={`mt-1 text-xl font-semibold ${org.compte_verrouille ? 'text-danger' : 'text-success'}`}>{org.compte_verrouille ? t('Verrouillé') : t('Actif')}</p></Card>
      </div>

      <Card className="mb-6">
        <h2 className="mb-3 font-semibold">{t('Actions')}</h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(NIVEAUX) as Niveau[]).flatMap((n) =>
            DUREES.map((m) => (
              <ActionButton
                key={`${n}-${m}`}
                label={`${t(NIVEAUX[n].nom)} · ${t('{n} mois', { n: m })}`}
                action={accorderAbonnement.bind(null, id, n, m)}
                confirmation={t('Accorder cet abonnement ({montant}) sans paiement en ligne ?', { montant: fcfa(montantAbonnement(n, m)) })}
              />
            ))
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <ActionButton label={t('Prolonger l’essai de 7 jours')} action={prolongerEssai.bind(null, id, 7)} />
          {!org.demo && (
            <ActionButton
              label={org.compte_verrouille ? t('Déverrouiller') : t('Verrouiller le compte')}
              action={verrouiller.bind(null, id, !org.compte_verrouille)}
              confirmation={org.compte_verrouille ? undefined : t('Verrouiller ce compte ? Ses utilisateurs ne pourront plus accéder qu’à la page de paiement.')}
            />
          )}
        </div>
      </Card>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Utilisateurs')}</h2>
      <div className="mb-6">
        <TableWrap>
          <thead><tr><th className={th}>{t('Nom')}</th><th className={th}>{t('Rôle')}</th><th className={th}>{t('Statut')}</th><th className={th}>{t('Depuis le')}</th></tr></thead>
          <tbody>
            {utilisateurs?.map((u) => (
              <tr key={u.id}>
                <td className={td}>{u.nom_complet ?? '—'}</td>
                <td className={td}>{t(ROLES[u.role] ?? u.role)}</td>
                <td className={`${td} ${u.actif ? 'text-success' : 'text-danger'}`}>{u.actif ? t('Actif') : t('Désactivé')}</td>
                <td className={td}>{formatDate(u.created_at, lang)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Historique des paiements')}</h2>
      <TableWrap>
        <thead>
          <tr><th className={th}>{t('Date')}</th><th className={th}>{t('Niveau')}</th><th className={th}>{t('Durée')}</th><th className={`${th} text-end`}>{t('Montant')}</th><th className={th}>{t('Prestataire')}</th><th className={th}>{t('Statut')}</th></tr>
        </thead>
        <tbody>
          {paiements?.map((p) => (
            <tr key={p.id}>
              <td className={td}>{formatDate(p.created_at, lang)}</td>
              <td className={td}>{t(NIVEAUX[p.niveau as Niveau]?.nom ?? p.niveau)}</td>
              <td className={td}>{t('{n} mois', { n: p.mois })}</td>
              <td className={`${td} text-end tabular-nums`}>{fcfa(Number(p.montant))}</td>
              <td className={`${td} capitalize`}>{p.provider === 'manuel' ? t('Manuel') : p.provider}</td>
              <td className={`${td} ${p.statut === 'completed' ? 'text-success' : p.statut === 'failed' ? 'text-danger' : ''}`}>{t(STATUTS[p.statut])}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
