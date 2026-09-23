import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { chargerOptions } from '@/lib/options'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addBudget } from '../actions'

export default async function BudgetsPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const o = await chargerOptions()
  const supabase = await createClient()
  const [{ data: budgets }, { data: exercices }] = await Promise.all([
    supabase.from('budgets').select('*, exercices_comptables(libelle), campagnes(code)').order('created_at', { ascending: false }),
    supabase.from('exercices_comptables').select('id, libelle').order('date_debut', { ascending: false }),
  ])
  const peutEcrire = peutMenu(ctx, '/pilotage/budgets', ['admin', 'comptable', 'direction'])

  return (
    <>
      <PageHeader
        titre={t('Budgets')}
        description={t('Budgets par département et secteur/projet, comparés en continu à la comptabilité analytique. Consolidation automatique.')}
      >
        <SimpleCreateForm
          titre={t('Nouveau budget')}
          disabled={!peutEcrire}
          action={addBudget}
          champs={[
            { name: 'code', label: t('Code'), required: true },
            { name: 'libelle', label: t('Libellé'), required: true, placeholder: t('ex. Budget campagne hivernage 2026') },
            { name: 'exercice_id', label: t('Exercice'), type: 'select', required: true, options: exercices?.map((e) => ({ value: e.id, label: e.libelle })) },
            { name: 'campagne_id', label: t('Limiter le réalisé à une campagne (facultatif)'), type: 'select', options: o.campagnes.map((c) => ({ value: c.id, label: c.label })) },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Code')}</th>
            <th className={th}>{t('Libellé')}</th>
            <th className={th}>{t('Exercice')}</th>
            <th className={th}>{t('Campagne')}</th>
            <th className={th}>{t('Statut')}</th>
          </tr>
        </thead>
        <tbody>
          {budgets?.map((b) => {
            const ex = Array.isArray(b.exercices_comptables) ? b.exercices_comptables[0] : b.exercices_comptables
            const camp = Array.isArray(b.campagnes) ? b.campagnes[0] : b.campagnes
            return (
              <tr key={b.id}>
                <td className={td}><Link href={`/pilotage/budgets/${b.id}`} className="font-medium text-primary underline">{b.code}</Link></td>
                <td className={td}>{b.libelle}</td>
                <td className={td}>{ex?.libelle}</td>
                <td className={td}>{camp?.code ?? 'Toutes'}</td>
                <td className={td}>{b.statut === 'approuve' ? t('Approuvé') : t('Brouillon')}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
