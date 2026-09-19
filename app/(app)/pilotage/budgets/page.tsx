import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { chargerOptions } from '@/lib/options'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addBudget } from '../actions'

export default async function BudgetsPage() {
  const ctx = await getContexte()
  const o = await chargerOptions()
  const supabase = await createClient()
  const [{ data: budgets }, { data: exercices }] = await Promise.all([
    supabase.from('budgets').select('*, exercices_comptables(libelle), campagnes(code)').order('created_at', { ascending: false }),
    supabase.from('exercices_comptables').select('id, libelle').order('date_debut', { ascending: false }),
  ])
  const peutEcrire = ['admin', 'comptable', 'direction'].includes(ctx.role)

  return (
    <>
      <PageHeader
        titre="Budgets"
        description="Budgets par département et secteur/projet, comparés en continu à la comptabilité analytique. Consolidation automatique."
      >
        <SimpleCreateForm
          titre="Nouveau budget"
          disabled={!peutEcrire}
          action={addBudget}
          champs={[
            { name: 'code', label: 'Code', required: true },
            { name: 'libelle', label: 'Libellé', required: true, placeholder: 'ex. Budget campagne hivernage 2026' },
            { name: 'exercice_id', label: 'Exercice', type: 'select', required: true, options: exercices?.map((e) => ({ value: e.id, label: e.libelle })) },
            { name: 'campagne_id', label: 'Limiter le réalisé à une campagne (facultatif)', type: 'select', options: o.campagnes.map((c) => ({ value: c.id, label: c.label })) },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>Code</th>
            <th className={th}>Libellé</th>
            <th className={th}>Exercice</th>
            <th className={th}>Campagne</th>
            <th className={th}>Statut</th>
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
                <td className={td}>{b.statut === 'approuve' ? 'Approuvé' : 'Brouillon'}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
