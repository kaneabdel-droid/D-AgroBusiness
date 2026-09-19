import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { formatDate, formatMontant } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'

export default async function VentesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const ctx = await getContexte()
  const { type: typeParam } = await searchParams
  const type = typeParam === 'marche' ? 'marche' : 'distribution'
  const supabase = await createClient()
  const { data: ventes } = await supabase
    .from('ventes')
    .select('id, numero, date_vente, total_ht, total_tva, total_ttc, tiers:client_id(nom), campagnes(code)')
    .eq('type', type)
    .order('date_vente', { ascending: false })
    .order('numero', { ascending: false })
    .limit(100)
  const peutEcrire = ['admin', 'comptable', 'chef_departement'].includes(ctx.role)
  const distribution = type === 'distribution'

  return (
    <>
      <PageHeader
        titre={distribution ? 'Distribution aux producteurs' : 'Ventes marché'}
        description={
          distribution
            ? 'Intrants et prestations facturés à crédit ; la créance se règle en nature ou en espèces.'
            : 'Produits finis et sous-produits vendus à des clients externes.'
        }
      >
        <Button asChild variant="outline">
          <Link href={`/ventes?type=${distribution ? 'marche' : 'distribution'}`}>
            {distribution ? 'Voir les ventes marché' : 'Voir la distribution'}
          </Link>
        </Button>
        {peutEcrire && (
          <Button asChild>
            <Link href={`/ventes/nouvelle?type=${type}`}>
              <Plus className="h-4 w-4" aria-hidden /> {distribution ? 'Nouvelle distribution' : 'Nouvelle vente'}
            </Link>
          </Button>
        )}
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>N°</th>
            <th className={th}>Date</th>
            <th className={th}>{distribution ? 'Producteur' : 'Client'}</th>
            <th className={th}>Campagne</th>
            <th className={`${th} text-right`}>HT</th>
            <th className={`${th} text-right`}>TTC</th>
          </tr>
        </thead>
        <tbody>
          {ventes?.map((v) => {
            const c = Array.isArray(v.tiers) ? v.tiers[0] : v.tiers
            const camp = Array.isArray(v.campagnes) ? v.campagnes[0] : v.campagnes
            return (
              <tr key={v.id}>
                <td className={td}>{v.numero}</td>
                <td className={td}>{formatDate(v.date_vente)}</td>
                <td className={td}>{c?.nom}</td>
                <td className={td}>{camp?.code ?? '—'}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(v.total_ht, ctx.devise)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(v.total_ttc, ctx.devise)}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
