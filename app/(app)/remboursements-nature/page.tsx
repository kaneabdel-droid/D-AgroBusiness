import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { chargerOptions } from '@/lib/options'
import { formatDate, formatMontant } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addReceptionNature } from '../operations/actions'

export default async function RemboursementsNaturePage() {
  const ctx = await getContexte()
  const o = await chargerOptions()
  const supabase = await createClient()
  const { data: receptions } = await supabase
    .from('receptions_nature')
    .select('id, numero, date_reception, quantite, prix_unitaire, montant, tiers:producteur_id(nom), produits(nom, unite)')
    .order('date_reception', { ascending: false })
    .limit(100)
  const peutEcrire = ['admin', 'comptable', 'chef_departement'].includes(ctx.role)

  return (
    <>
      <PageHeader
        titre="Remboursements en nature"
        description="Le produit livré par le producteur entre en stock à la valorisation retenue et diminue sa créance."
      >
        <SimpleCreateForm
          titre="Réception en nature"
          disabled={!peutEcrire}
          action={addReceptionNature}
          champs={[
            { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
            { name: 'producteur_id', label: 'Producteur', type: 'select', required: true, options: o.producteurs.map((x) => ({ value: x.id, label: x.label })) },
            { name: 'produit_id', label: 'Produit reçu', type: 'select', required: true, options: o.produits.filter((p) => p.categorie !== 'service').map((x) => ({ value: x.id, label: x.label })) },
            { name: 'magasin_id', label: 'Magasin', type: 'select', required: true, options: o.magasins.map((x) => ({ value: x.id, label: x.label })) },
            { name: 'quantite', label: 'Quantité', type: 'number', step: '0.001', required: true },
            { name: 'prix_unitaire', label: 'Valorisation (prix unitaire retenu)', type: 'number', step: '0.01', required: true },
            { name: 'campagne_id', label: 'Campagne', type: 'select', options: o.campagnes.map((x) => ({ value: x.id, label: x.label })) },
            { name: 'observation', label: 'Observation (qualité, humidité, prix convenu…)' },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>N°</th>
            <th className={th}>Date</th>
            <th className={th}>Producteur</th>
            <th className={th}>Produit</th>
            <th className={`${th} text-right`}>Quantité</th>
            <th className={`${th} text-right`}>Prix</th>
            <th className={`${th} text-right`}>Montant</th>
          </tr>
        </thead>
        <tbody>
          {receptions?.map((r) => {
            const t = Array.isArray(r.tiers) ? r.tiers[0] : r.tiers
            const p = Array.isArray(r.produits) ? r.produits[0] : r.produits
            return (
              <tr key={r.id}>
                <td className={td}>{r.numero}</td>
                <td className={td}>{formatDate(r.date_reception)}</td>
                <td className={td}>{t?.nom}</td>
                <td className={td}>{p?.nom}</td>
                <td className={`${td} text-right tabular-nums`}>{Number(r.quantite).toLocaleString('fr-FR')} {p?.unite}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(r.prix_unitaire, ctx.devise)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(r.montant, ctx.devise)}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
