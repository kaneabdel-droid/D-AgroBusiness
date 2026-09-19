import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addMagasin } from '../../operations/actions'

export default async function MagasinsPage() {
  const ctx = await getContexte()
  const supabase = await createClient()
  const [{ data: magasins }, { data: departements }] = await Promise.all([
    supabase.from('magasins').select('*, departements(nom)').order('code'),
    supabase.from('departements').select('id, nom').eq('actif', true).order('nom'),
  ])
  const peutEcrire = ['admin', 'comptable', 'chef_departement'].includes(ctx.role)

  return (
    <>
      <PageHeader titre="Magasins" description="Lieux de stockage des intrants, produits agricoles et produits finis.">
        <SimpleCreateForm
          titre="Nouveau magasin"
          disabled={!peutEcrire}
          action={addMagasin}
          champs={[
            { name: 'code', label: 'Code', required: true },
            { name: 'nom', label: 'Nom', required: true },
            {
              name: 'departement_id',
              label: 'Département',
              type: 'select',
              options: departements?.map((d) => ({ value: d.id, label: d.nom })),
            },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>Code</th>
            <th className={th}>Nom</th>
            <th className={th}>Département</th>
          </tr>
        </thead>
        <tbody>
          {magasins?.map((m) => {
            const dep = Array.isArray(m.departements) ? m.departements[0] : m.departements
            return (
              <tr key={m.id}>
                <td className={td}>{m.code}</td>
                <td className={td}>{m.nom}</td>
                <td className={td}>{dep?.nom ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
