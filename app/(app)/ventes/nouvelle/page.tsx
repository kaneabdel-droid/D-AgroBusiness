import { redirect } from 'next/navigation'
import { getContexte } from '@/lib/session'
import { chargerOptions } from '@/lib/options'
import { PageHeader } from '@/components/ui/card'
import { DocumentForm } from '@/components/DocumentForm'

export default async function NouvelleVentePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const ctx = await getContexte()
  if (!['admin', 'comptable', 'chef_departement'].includes(ctx.role)) redirect('/ventes')
  const { type } = await searchParams
  const distribution = type !== 'marche'
  const o = await chargerOptions()

  return (
    <>
      <PageHeader
        titre={distribution ? 'Nouvelle distribution' : 'Nouvelle vente marché'}
        description={
          distribution
            ? 'Facture au producteur : sortie de stock au CUMP et créance sur le producteur.'
            : 'Facture client : sortie de stock au CUMP et créance client.'
        }
      />
      <DocumentForm
        kind={distribution ? 'distribution' : 'vente'}
        tiers={distribution ? o.producteurs : o.clients}
        magasins={o.magasins}
        campagnes={o.campagnes}
        departements={o.departements}
        secteurs={o.secteurs}
        produits={o.produits}
        contrats={o.contrats}
        devise={ctx.devise}
      />
    </>
  )
}
