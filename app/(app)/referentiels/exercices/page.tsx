import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { formatDate } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addExercice } from '../actions'

export default async function ExercicesPage() {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { data: exercices } = await supabase
    .from('exercices_comptables')
    .select('*')
    .order('date_debut', { ascending: false })
  const peutEcrire = ['admin', 'comptable'].includes(ctx.role)

  return (
    <>
      <PageHeader
        titre="Exercices comptables"
        description="Aucune écriture ne peut être saisie hors d'un exercice ouvert."
      >
        <SimpleCreateForm
          titre="Nouvel exercice"
          disabled={!peutEcrire}
          action={addExercice}
          champs={[
            { name: 'libelle', label: 'Libellé', required: true, placeholder: 'ex. Exercice 2026' },
            { name: 'date_debut', label: 'Début', type: 'date', required: true },
            { name: 'date_fin', label: 'Fin', type: 'date', required: true },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>Libellé</th>
            <th className={th}>Début</th>
            <th className={th}>Fin</th>
            <th className={th}>Statut</th>
          </tr>
        </thead>
        <tbody>
          {exercices?.map((e) => (
            <tr key={e.id}>
              <td className={td}>{e.libelle}</td>
              <td className={td}>{formatDate(e.date_debut)}</td>
              <td className={td}>{formatDate(e.date_fin)}</td>
              <td className={td}>{e.statut === 'ouvert' ? 'Ouvert' : 'Clôturé'}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
