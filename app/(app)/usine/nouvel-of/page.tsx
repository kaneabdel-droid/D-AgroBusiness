import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { chargerOptions } from '@/lib/options'
import { PageHeader } from '@/components/ui/card'
import { OrdreFabricationForm, type NomenclatureOpt } from '@/components/OrdreFabricationForm'

export default async function NouvelOrdreFabricationPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  if (!['admin', 'comptable', 'chef_departement'].includes(ctx.role)) redirect('/usine')
  const o = await chargerOptions()
  const supabase = await createClient()
  const { data } = await supabase
    .from('nomenclatures')
    .select('id, code, libelle, produits:matiere_id(nom), nomenclature_sorties(produit_id, rendement_pct, principal, produits(nom, unite))')
    .eq('actif', true)
    .order('code')

  const nomenclatures: NomenclatureOpt[] = (data ?? []).map((n) => {
    const m = Array.isArray(n.produits) ? n.produits[0] : n.produits
    return {
      id: n.id,
      label: `${n.code} — ${n.libelle}`,
      matiere: m?.nom ?? t('matière première'),
      sorties: (n.nomenclature_sorties as { produit_id: string; rendement_pct: number; principal: boolean; produits: { nom: string; unite: string } | { nom: string; unite: string }[] | null }[]).map((s) => {
        const pr = Array.isArray(s.produits) ? s.produits[0] : s.produits
        return { produit_id: s.produit_id, label: pr?.nom ?? '', unite: pr?.unite ?? '', rendement: Number(s.rendement_pct), principal: s.principal }
      }),
    }
  })

  const usine = o.departements.find((d) => d.label.toLowerCase().includes('usine'))
  return (
    <>
      <PageHeader
        titre={t('Nouvel ordre de fabrication')}
        description={t('La matière est sortie du stock au CUMP ; les produits obtenus entrent en stock à leur coût de revient.')}
      />
      <OrdreFabricationForm
        nomenclatures={nomenclatures}
        magasins={o.magasins}
        departements={o.departements}
        campagnes={o.campagnes}
        departementParDefaut={usine?.id ?? ''}
      />
    </>
  )
}
