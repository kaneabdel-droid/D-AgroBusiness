import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addTiers } from '../actions'

const TYPES = [
  { value: 'producteur', label: 'Producteur' },
  { value: 'fournisseur', label: 'Fournisseur' },
  { value: 'client', label: 'Client' },
  { value: 'bailleur', label: 'Bailleur / banque' },
]

export default async function TiersPage() {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { data: tiers } = await supabase.from('tiers').select('*').order('nom')
  const peutEcrire = ['admin', 'comptable', 'chef_departement'].includes(ctx.role)

  return (
    <>
      <PageHeader
        titre="Tiers"
        description="Un même tiers peut être à la fois producteur, client et fournisseur."
      >
        <SimpleCreateForm
          titre="Nouveau tiers"
          disabled={!peutEcrire}
          action={addTiers}
          champs={[
            { name: 'code', label: 'Code', required: true },
            { name: 'nom', label: 'Nom / raison sociale', required: true },
            { name: 'types', label: 'Type(s)', type: 'multiselect', options: TYPES },
            { name: 'telephone', label: 'Téléphone', type: 'tel' },
            { name: 'email', label: 'Email', type: 'email' },
            { name: 'adresse', label: 'Adresse' },
            { name: 'nif', label: 'NIF / identifiant fiscal' },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>Code</th>
            <th className={th}>Nom</th>
            <th className={th}>Type(s)</th>
            <th className={th}>Téléphone</th>
          </tr>
        </thead>
        <tbody>
          {tiers?.map((t) => (
            <tr key={t.id}>
              <td className={td}>{t.code}</td>
              <td className={td}>{t.nom}</td>
              <td className={td}>
                {t.types.map((v: string) => TYPES.find((x) => x.value === v)?.label ?? v).join(', ')}
              </td>
              <td className={td}>{t.telephone ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
