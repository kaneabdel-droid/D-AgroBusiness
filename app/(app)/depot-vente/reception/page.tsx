import { redirect } from 'next/navigation'
import { getContexte } from '@/lib/session'
import { chargerOptions } from '@/lib/options'
import { PageHeader } from '@/components/ui/card'
import { DocumentForm } from '@/components/DocumentForm'

export default async function ReceptionDepotPage() {
  const ctx = await getContexte()
  if (!['admin', 'comptable', 'chef_departement'].includes(ctx.role)) redirect('/depot-vente')
  const o = await chargerOptions()
  return (
    <>
      <PageHeader titre="Réception d'un dépôt" description="Entrée en stock consigné : aucune écriture comptable." />
      <DocumentForm
        kind="depot"
        tiers={o.contrats}
        magasins={o.magasins}
        campagnes={[]}
        departements={[]}
        secteurs={[]}
        produits={o.produits.filter((p) => p.categorie !== 'service')}
        contrats={[]}
        devise={ctx.devise}
      />
    </>
  )
}
