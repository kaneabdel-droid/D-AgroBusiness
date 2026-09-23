import { redirect } from 'next/navigation'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { chargerOptions } from '@/lib/options'
import { PageHeader } from '@/components/ui/card'
import { DocumentForm } from '@/components/DocumentForm'

export default async function NouvelleVentePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const { type } = await searchParams
  const distribution = type !== 'marche'
  if (!peutMenu(ctx, `/ventes?type=${distribution ? 'distribution' : 'marche'}`, ['admin', 'comptable', 'chef_departement'])) redirect('/ventes')
  const o = await chargerOptions()

  return (
    <>
      <PageHeader
        titre={distribution ? t('Nouvelle distribution') : t('Nouvelle vente marché')}
        description={
          distribution
            ? t('Facture au producteur : sortie de stock au CUMP et créance sur le producteur.')
            : t('Facture client : sortie de stock au CUMP et créance client.')
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
