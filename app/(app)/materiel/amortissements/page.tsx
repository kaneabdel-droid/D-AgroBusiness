import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { formatDate, formatMontant } from '@/lib/utils'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { ActionButton } from '@/components/ActionButton'
import { comptabiliserAmortissements } from '../../financement/actions'

export default async function AmortissementsPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const supabase = await createClient()
  const [{ data: exercices }, { data: dotations }] = await Promise.all([
    supabase.from('exercices_comptables').select('id, libelle, date_debut, date_fin, statut').order('date_debut', { ascending: false }),
    supabase.from('dotations_amortissement').select('exercice_id, montant, reprise_subvention'),
  ])
  const peutEcrire = ['admin', 'comptable'].includes(ctx.role)

  const parExercice = new Map<string, { dotations: number; reprises: number; nb: number }>()
  for (const d of dotations ?? []) {
    const cur = parExercice.get(d.exercice_id) ?? { dotations: 0, reprises: 0, nb: 0 }
    cur.dotations += Number(d.montant)
    cur.reprises += Number(d.reprise_subvention)
    cur.nb += 1
    parExercice.set(d.exercice_id, cur)
  }

  return (
    <>
      <PageHeader
        titre={t('Dotations aux amortissements')}
        description={t('Comptabilisation par exercice : dotation de chaque bien (imputée à son département d’affectation) et reprise des subventions correspondantes. Relancer un exercice ne traite que les biens non encore amortis sur cette période.')}
      >
        <Link href="/materiel" className="text-sm text-primary underline">{t('← Parc matériel')}</Link>
      </PageHeader>
      <Card className="mb-4 text-sm text-foreground-muted">
        {t('Convention linéaire au mois : amortissement dès le mois de mise en service. À valider avec votre expert-comptable (prorata en jours, mode dégressif fiscal éventuel).')}
      </Card>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Exercice')}</th>
            <th className={th}>{t('Période')}</th>
            <th className={`${th} text-right`}>{t('Biens amortis')}</th>
            <th className={`${th} text-right`}>{t('Dotations')}</th>
            <th className={`${th} text-right`}>{t('Reprises de subventions')}</th>
            <th className={th}></th>
          </tr>
        </thead>
        <tbody>
          {exercices?.map((e) => {
            const tot = parExercice.get(e.id)
            return (
              <tr key={e.id}>
                <td className={td}>{e.libelle}</td>
                <td className={td}>{formatDate(e.date_debut, ctx.lang)} → {formatDate(e.date_fin, ctx.lang)}</td>
                <td className={`${td} text-right`}>{tot?.nb ?? 0}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(tot?.dotations ?? 0, ctx.devise, ctx.lang)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(tot?.reprises ?? 0, ctx.devise, ctx.lang)}</td>
                <td className={td}>
                  {peutEcrire && e.statut === 'ouvert' && (
                    <ActionButton
                      label={t('Comptabiliser')}
                      confirmation={t('Comptabiliser les dotations de l’exercice « {e} » ?', { e: e.libelle })}
                      action={comptabiliserAmortissements.bind(null, e.id)}
                    />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
