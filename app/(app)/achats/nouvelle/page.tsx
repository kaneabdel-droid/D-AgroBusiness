import { redirect } from 'next/navigation'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { chargerOptions } from '@/lib/options'
import { PageHeader } from '@/components/ui/card'
import { DocumentForm } from '@/components/DocumentForm'

export default async function NouvelAchatPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  if (!['admin', 'comptable'].includes(ctx.role)) redirect('/achats')
  const o = await chargerOptions()
  return (
    <>
      <PageHeader titre={t('Nouvel achat')} description={t('Facture fournisseur avec entrée en stock.')} />
      <DocumentForm
        kind="achat"
        tiers={o.fournisseurs}
        magasins={o.magasins}
        campagnes={o.campagnes}
        departements={o.departements}
        secteurs={o.secteurs}
        produits={o.produits.filter((p) => p.categorie !== 'service')}
        contrats={[]}
        devise={ctx.devise}
      />
    </>
  )
}
