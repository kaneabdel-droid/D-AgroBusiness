import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { formatMontant } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'

export default async function StocksPage() {
  const ctx = await getContexte()
  const supabase = await createClient()
  const [{ data: stock }, { data: produits }, { data: magasins }, { data: contrats }] = await Promise.all([
    supabase.from('v_stock').select('*'),
    supabase.from('produits').select('id, code, nom, unite'),
    supabase.from('magasins').select('id, code'),
    supabase.from('contrats_depot').select('id, code'),
  ])

  const lignes = (stock ?? [])
    .map((s) => ({
      ...s,
      produit: produits?.find((p) => p.id === s.produit_id),
      magasin: magasins?.find((m) => m.id === s.magasin_id)?.code ?? '?',
      contrat: contrats?.find((c) => c.id === s.contrat_depot_id)?.code,
    }))
    .sort((a, b) => (a.produit?.code ?? '').localeCompare(b.produit?.code ?? ''))

  const valeurTotale = lignes.reduce((s, l) => s + Number(l.valeur), 0)

  return (
    <>
      <PageHeader
        titre="État des stocks"
        description="Valorisation au coût moyen unitaire pondéré (CUMP). Le stock consigné n'est pas valorisé : il appartient au fournisseur."
      />
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>Produit</th>
            <th className={th}>Magasin</th>
            <th className={th}>Propriété</th>
            <th className={`${th} text-right`}>Quantité</th>
            <th className={`${th} text-right`}>CUMP</th>
            <th className={`${th} text-right`}>Valeur</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={i}>
              <td className={td}>{l.produit?.code} — {l.produit?.nom}</td>
              <td className={td}>{l.magasin}</td>
              <td className={td}>
                {l.propriete === 'propre' ? 'Propre' : <span className="rounded bg-warning/15 px-1.5 py-0.5 text-xs">Consigné ({l.contrat})</span>}
              </td>
              <td className={`${td} text-right tabular-nums`}>{Number(l.quantite).toLocaleString('fr-FR')} {l.produit?.unite}</td>
              <td className={`${td} text-right tabular-nums`}>{l.cump != null ? formatMontant(l.cump, ctx.devise) : '—'}</td>
              <td className={`${td} text-right tabular-nums`}>{l.propriete === 'propre' ? formatMontant(l.valeur, ctx.devise) : '—'}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className={td} colSpan={5}>Valeur du stock propre</td>
            <td className={`${td} text-right tabular-nums`}>{formatMontant(valeurTotale, ctx.devise)}</td>
          </tr>
        </tbody>
      </TableWrap>
    </>
  )
}
