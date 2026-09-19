import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { formatMontant } from '@/lib/utils'
import { CATEGORIES } from '@/lib/catalogue'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addProduit } from '../../operations/actions'

export default async function ProduitsPage() {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { data: produits } = await supabase.from('produits').select('*').order('code')
  const peutEcrire = ['admin', 'comptable', 'chef_departement'].includes(ctx.role)

  return (
    <>
      <PageHeader
        titre="Produits"
        description="La catégorie détermine les comptes de stock, de variation de stock et de vente utilisés."
      >
        <SimpleCreateForm
          titre="Nouveau produit"
          disabled={!peutEcrire}
          action={addProduit}
          champs={[
            { name: 'code', label: 'Code', required: true },
            { name: 'nom', label: 'Désignation', required: true },
            { name: 'categorie', label: 'Catégorie', type: 'select', required: true, options: CATEGORIES },
            { name: 'unite', label: 'Unité', defaultValue: 'kg' },
            { name: 'taux_tva', label: 'TVA %', type: 'number', step: '0.01', defaultValue: '0' },
            { name: 'prix_reference', label: 'Prix de référence', type: 'number', step: '0.01' },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>Code</th>
            <th className={th}>Désignation</th>
            <th className={th}>Catégorie</th>
            <th className={th}>Unité</th>
            <th className={`${th} text-right`}>TVA</th>
            <th className={`${th} text-right`}>Prix réf.</th>
          </tr>
        </thead>
        <tbody>
          {produits?.map((p) => (
            <tr key={p.id}>
              <td className={td}>{p.code}</td>
              <td className={td}>{p.nom}</td>
              <td className={td}>{CATEGORIES.find((c) => c.value === p.categorie)?.label}</td>
              <td className={td}>{p.unite}</td>
              <td className={`${td} text-right`}>{Number(p.taux_tva)} %</td>
              <td className={`${td} text-right tabular-nums`}>
                {p.prix_reference != null ? formatMontant(p.prix_reference, ctx.devise) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
