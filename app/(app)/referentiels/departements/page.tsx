import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addDepartement } from '../actions'

const TYPES = [
  { value: 'fonctionnement', label: 'Fonctionnement' },
  { value: 'distribution', label: 'Distribution' },
  { value: 'production', label: 'Production' },
  { value: 'usine', label: 'Usine' },
  { value: 'materiel', label: 'Matériel' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'autre', label: 'Autre' },
]

export default async function DepartementsPage() {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { data: departements } = await supabase.from('departements').select('*').order('code')
  const peutEcrire = ['admin', 'direction'].includes(ctx.role)

  return (
    <>
      <PageHeader
        titre="Départements"
        description="Premier axe analytique : chaque charge et chaque produit est imputé à un département."
      >
        <SimpleCreateForm
          titre="Nouveau département"
          disabled={!peutEcrire}
          action={addDepartement}
          champs={[
            { name: 'code', label: 'Code', required: true, placeholder: 'ex. USIN' },
            { name: 'nom', label: 'Nom', required: true },
            { name: 'type', label: 'Type', type: 'select', options: TYPES, required: true },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>Code</th>
            <th className={th}>Nom</th>
            <th className={th}>Type</th>
          </tr>
        </thead>
        <tbody>
          {departements?.map((d) => (
            <tr key={d.id}>
              <td className={td}>{d.code}</td>
              <td className={td}>{d.nom}</td>
              <td className={td}>{TYPES.find((t) => t.value === d.type)?.label ?? d.type}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
