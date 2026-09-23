import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
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
  const t = creerT(ctx.lang)
  const supabase = await createClient()
  const { data: tiers } = await supabase.from('tiers').select('*').order('nom')
  const peutEcrire = peutMenu(ctx, '/referentiels/tiers', ['admin', 'comptable', 'chef_departement'])

  return (
    <>
      <PageHeader
        titre={t('Tiers')}
        description={t('Un même tiers peut être à la fois producteur, client et fournisseur.')}
      >
        <SimpleCreateForm
          titre={t('Nouveau tiers')}
          disabled={!peutEcrire}
          action={addTiers}
          champs={[
            { name: 'code', label: t('Code'), required: true },
            { name: 'nom', label: t('Nom / raison sociale'), required: true },
            { name: 'types', label: t('Type(s)'), type: 'multiselect', options: TYPES.map((x) => ({ ...x, label: t(x.label) })) },
            { name: 'telephone', label: t('Téléphone'), type: 'tel' },
            { name: 'email', label: t('Email'), type: 'email' },
            { name: 'adresse', label: t('Adresse') },
            { name: 'nif', label: t('NIF / identifiant fiscal') },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Code')}</th>
            <th className={th}>{t('Nom')}</th>
            <th className={th}>{t('Type(s)')}</th>
            <th className={th}>{t('Téléphone')}</th>
          </tr>
        </thead>
        <tbody>
          {tiers?.map((ti) => (
            <tr key={ti.id}>
              <td className={td}>{ti.code}</td>
              <td className={td}>{ti.nom}</td>
              <td className={td}>
                {ti.types.map((v: string) => t(TYPES.find((x) => x.value === v)?.label ?? v)).join(', ')}
              </td>
              <td className={td}>{ti.telephone ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
