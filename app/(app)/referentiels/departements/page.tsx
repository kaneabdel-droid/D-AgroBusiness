import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
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
  const t = creerT(ctx.lang)
  const supabase = await createClient()
  const { data: departements } = await supabase.from('departements').select('*').order('code')
  const peutEcrire = ['admin', 'direction', 'comptable'].includes(ctx.role)

  return (
    <>
      <PageHeader
        titre={t('Départements')}
        description={t('Premier axe analytique : chaque charge et chaque produit est imputé à un département.')}
      >
        <SimpleCreateForm
          titre={t('Nouveau département')}
          disabled={!peutEcrire}
          action={addDepartement}
          champs={[
            { name: 'code', label: t('Code'), required: true, placeholder: t('ex. USIN') },
            { name: 'nom', label: t('Nom'), required: true },
            { name: 'type', label: t('Type'), type: 'select', options: TYPES.map((x) => ({ ...x, label: t(x.label) })), required: true },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Code')}</th>
            <th className={th}>{t('Nom')}</th>
            <th className={th}>{t('Type')}</th>
          </tr>
        </thead>
        <tbody>
          {departements?.map((d) => (
            <tr key={d.id}>
              <td className={td}>{d.code}</td>
              <td className={td}>{t(d.nom)}</td>
              <td className={td}>{t(TYPES.find((x) => x.value === d.type)?.label ?? d.type)}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
