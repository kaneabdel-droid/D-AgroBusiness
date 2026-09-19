import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { formatDate } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addCampagne } from '../actions'

export default async function CampagnesPage() {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { data: campagnes } = await supabase
    .from('campagnes')
    .select('*')
    .order('date_debut', { ascending: false })
  const peutEcrire = ['admin', 'direction', 'chef_departement'].includes(ctx.role)

  return (
    <>
      <PageHeader
        titre="Campagnes agricoles"
        description="Troisième axe analytique : une campagne peut chevaucher deux exercices comptables."
      >
        <SimpleCreateForm
          titre="Nouvelle campagne"
          disabled={!peutEcrire}
          action={addCampagne}
          champs={[
            { name: 'code', label: 'Code', required: true, placeholder: 'ex. HIV-2026' },
            { name: 'libelle', label: 'Libellé', required: true, placeholder: 'ex. Contre-saison chaude 2026' },
            { name: 'date_debut', label: 'Début', type: 'date', required: true },
            { name: 'date_fin', label: 'Fin', type: 'date', required: true },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>Code</th>
            <th className={th}>Libellé</th>
            <th className={th}>Début</th>
            <th className={th}>Fin</th>
            <th className={th}>Statut</th>
          </tr>
        </thead>
        <tbody>
          {campagnes?.map((c) => (
            <tr key={c.id}>
              <td className={td}>{c.code}</td>
              <td className={td}>{c.libelle}</td>
              <td className={td}>{formatDate(c.date_debut)}</td>
              <td className={td}>{formatDate(c.date_fin)}</td>
              <td className={td}>{c.statut === 'ouverte' ? 'Ouverte' : 'Clôturée'}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
