import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addSecteur } from '../actions'

export default async function SecteursPage() {
  const ctx = await getContexte()
  const supabase = await createClient()
  const [{ data: secteurs }, { data: departements }] = await Promise.all([
    supabase.from('secteurs_projets').select('*, departements(nom)').order('code'),
    supabase.from('departements').select('id, nom').eq('actif', true).order('nom'),
  ])
  const peutEcrire = ['admin', 'direction', 'chef_departement'].includes(ctx.role)

  return (
    <>
      <PageHeader
        titre="Secteurs & projets"
        description="Deuxième axe analytique : subdivisez la production ou l'usine par secteur ou par projet."
      >
        <SimpleCreateForm
          titre="Nouveau secteur / projet"
          disabled={!peutEcrire}
          action={addSecteur}
          champs={[
            { name: 'code', label: 'Code', required: true },
            { name: 'nom', label: 'Nom', required: true },
            {
              name: 'departement_id',
              label: 'Département',
              type: 'select',
              required: true,
              options: departements?.map((d) => ({ value: d.id, label: d.nom })),
            },
            {
              name: 'nature',
              label: 'Nature',
              type: 'select',
              required: true,
              options: [
                { value: 'secteur', label: 'Secteur' },
                { value: 'projet', label: 'Projet' },
              ],
            },
            { name: 'superficie_ha', label: 'Superficie (ha)', type: 'number', step: '0.01' },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>Code</th>
            <th className={th}>Nom</th>
            <th className={th}>Département</th>
            <th className={th}>Nature</th>
            <th className={th}>Superficie (ha)</th>
          </tr>
        </thead>
        <tbody>
          {secteurs?.map((s) => {
            const dep = Array.isArray(s.departements) ? s.departements[0] : s.departements
            return (
              <tr key={s.id}>
                <td className={td}>{s.code}</td>
                <td className={td}>{s.nom}</td>
                <td className={td}>{dep?.nom}</td>
                <td className={td}>{s.nature === 'projet' ? 'Projet' : 'Secteur'}</td>
                <td className={td}>{s.superficie_ha ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
