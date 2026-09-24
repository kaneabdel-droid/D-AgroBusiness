import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addPartenaireFinancier } from '../actions'

export default async function PartenairesFinanciersPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const supabase = await createClient()
  const { data: tiersData } = await supabase.from('tiers').select('*').order('nom')
  const partenaires = (tiersData ?? []).filter((ti) => (ti.types as string[]).includes('bailleur'))
  const peutEcrire = peutMenu(ctx, '/referentiels/partenaires-financiers', ['admin', 'comptable', 'direction'])

  return (
    <>
      <PageHeader
        titre={t('Partenaires financiers')}
        description={t('Banques et bailleurs de fonds : emprunts, crédits de campagne et subventions d’investissement. Distincts des tiers commerciaux (clients, fournisseurs, producteurs).')}
      >
        <SimpleCreateForm
          titre={t('Nouveau partenaire financier')}
          disabled={!peutEcrire}
          action={addPartenaireFinancier}
          champs={[
            { name: 'code', label: t('Code'), required: true },
            { name: 'nom', label: t('Nom / raison sociale'), required: true },
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
            <th className={th}>{t('Téléphone')}</th>
          </tr>
        </thead>
        <tbody>
          {partenaires.map((ti) => (
            <tr key={ti.id}>
              <td className={td}>{ti.code}</td>
              <td className={td}>{ti.nom}</td>
              <td className={td}>{ti.telephone ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
