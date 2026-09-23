import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { formatMontant } from '@/lib/utils'
import { CATEGORIES } from '@/lib/catalogue'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addProduit } from '../../operations/actions'

export default async function ProduitsPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const supabase = await createClient()
  const { data: produits } = await supabase.from('produits').select('*').order('code')
  const peutEcrire = peutMenu(ctx, '/catalogue/produits', ['admin', 'comptable', 'chef_departement'])

  return (
    <>
      <PageHeader
        titre={t('Produits')}
        description={t('La catégorie détermine les comptes de stock, de variation de stock et de vente utilisés.')}
      >
        <SimpleCreateForm
          titre={t('Nouveau produit')}
          disabled={!peutEcrire}
          action={addProduit}
          champs={[
            { name: 'code', label: t('Code'), required: true },
            { name: 'nom', label: t('Désignation'), required: true },
            { name: 'categorie', label: t('Catégorie'), type: 'select', required: true, options: CATEGORIES.map((c) => ({ ...c, label: t(c.label) })) },
            { name: 'unite', label: t('Unité'), defaultValue: 'kg' },
            { name: 'taux_tva', label: t('TVA %'), type: 'number', step: '0.01', defaultValue: '0' },
            { name: 'prix_reference', label: t('Prix de référence'), type: 'number', step: '0.01' },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Code')}</th>
            <th className={th}>{t('Désignation')}</th>
            <th className={th}>{t('Catégorie')}</th>
            <th className={th}>{t('Unité')}</th>
            <th className={`${th} text-right`}>{t('TVA')}</th>
            <th className={`${th} text-right`}>{t('Prix réf.')}</th>
          </tr>
        </thead>
        <tbody>
          {produits?.map((p) => (
            <tr key={p.id}>
              <td className={td}>{p.code}</td>
              <td className={td}>{p.nom}</td>
              <td className={td}>{t(CATEGORIES.find((c) => c.value === p.categorie)?.label ?? '')}</td>
              <td className={td}>{p.unite}</td>
              <td className={`${td} text-right`}>{Number(p.taux_tva)} %</td>
              <td className={`${td} text-right tabular-nums`}>
                {p.prix_reference != null ? formatMontant(p.prix_reference, ctx.devise, ctx.lang) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
