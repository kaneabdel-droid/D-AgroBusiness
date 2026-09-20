import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { chargerOptions } from '@/lib/options'
import { formatDate, formatMontant } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addReceptionNature } from '../operations/actions'

export default async function RemboursementsNaturePage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
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
        titre={t('Remboursements en nature')}
        description={t('Le produit livré par le producteur entre en stock à la valorisation retenue et diminue sa créance.')}
      >
        <SimpleCreateForm
          titre={t('Réception en nature')}
          disabled={!peutEcrire}
          action={addReceptionNature}
          champs={[
            { name: 'date', label: t('Date'), type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
            { name: 'producteur_id', label: t('Producteur'), type: 'select', required: true, options: o.producteurs.map((x) => ({ value: x.id, label: x.label })) },
            { name: 'produit_id', label: t('Produit reçu'), type: 'select', required: true, options: o.produits.filter((p) => p.categorie !== 'service').map((x) => ({ value: x.id, label: x.label })) },
            { name: 'magasin_id', label: t('Magasin'), type: 'select', required: true, options: o.magasins.map((x) => ({ value: x.id, label: x.label })) },
            { name: 'quantite', label: t('Quantité'), type: 'number', step: '0.001', required: true },
            { name: 'prix_unitaire', label: t('Valorisation (prix unitaire retenu)'), type: 'number', step: '0.01', required: true },
            { name: 'campagne_id', label: t('Campagne'), type: 'select', options: o.campagnes.map((x) => ({ value: x.id, label: x.label })) },
            { name: 'observation', label: t('Observation (qualité, humidité, prix convenu…)') },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>N°</th>
            <th className={th}>{t('Date')}</th>
            <th className={th}>{t('Producteur')}</th>
            <th className={th}>{t('Produit')}</th>
            <th className={`${th} text-right`}>{t('Quantité')}</th>
            <th className={`${th} text-right`}>{t('Prix')}</th>
            <th className={`${th} text-right`}>{t('Montant')}</th>
          </tr>
        </thead>
        <tbody>
          {receptions?.map((r) => {
            const t = Array.isArray(r.tiers) ? r.tiers[0] : r.tiers
            const p = Array.isArray(r.produits) ? r.produits[0] : r.produits
            return (
              <tr key={r.id}>
                <td className={td}>{r.numero}</td>
                <td className={td}>{formatDate(r.date_reception, ctx.lang)}</td>
                <td className={td}>{t?.nom}</td>
                <td className={td}>{p?.nom}</td>
                <td className={`${td} text-right tabular-nums`}>{Number(r.quantite).toLocaleString('fr-FR')} {p?.unite}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(r.prix_unitaire, ctx.devise, ctx.lang)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(r.montant, ctx.devise, ctx.lang)}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
