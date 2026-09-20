import Link from 'next/link'
import { Factory } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { chargerOptions } from '@/lib/options'
import { formatDate, formatMontant } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm, type Champ } from '@/components/SimpleCreateForm'
import { addNomenclature } from '../production/actions'

type Sortie = { quantite: number; valeur: number; rendement_reel_pct: number; produits: { nom: string; unite: string } | { nom: string; unite: string }[] | null }

export default async function UsinePage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const o = await chargerOptions()
  const supabase = await createClient()
  const [{ data: nomenclatures }, { data: ordres }] = await Promise.all([
    supabase.from('nomenclatures').select('id, code, libelle, produits:matiere_id(nom), nomenclature_sorties(rendement_pct, principal, produits(nom))').order('code'),
    supabase
      .from('ordres_fabrication')
      .select('id, numero, date_of, quantite_matiere, cout_matiere, frais_imputes, valeur_totale, nomenclatures(code, produits:matiere_id(nom, unite)), of_sorties(quantite, valeur, rendement_reel_pct, produits(nom, unite))')
      .order('date_of', { ascending: false })
      .limit(50),
  ])
  const peutEcrire = ['admin', 'comptable', 'chef_departement'].includes(ctx.role)
  const finis = o.produits.filter((p) => ['produit_fini', 'sous_produit'].includes(p.categorie)).map((p) => ({ value: p.id, label: p.label }))

  const champsSorties: Champ[] = []
  for (let i = 1; i <= 4; i++) {
    champsSorties.push(
      { name: `produit_${i}`, label: i === 1 ? t('Produit principal') : t('Sous-produit / produit {i}', { i }), type: 'select', required: i === 1, options: finis },
      { name: `rendement_${i}`, label: t('Rendement {i} (% de la matière)', { i }), type: 'number', step: '0.01', required: i === 1 },
    )
  }

  return (
    <>
      <PageHeader
        titre={t('Usine de transformation')}
        description={t('Matière première → produits finis et sous-produits. La valeur (matière au CUMP + frais imputés) est répartie au prorata de la valeur de marché.')}
      >
        {peutEcrire && (
          <Button asChild>
            <Link href="/usine/nouvel-of"><Factory className="h-4 w-4" aria-hidden /> {t('Nouvel ordre de fabrication')}</Link>
          </Button>
        )}
        <SimpleCreateForm
          titre={t('Nouvelle nomenclature')}
          disabled={!peutEcrire}
          action={addNomenclature}
          champs={[
            { name: 'code', label: t('Code'), required: true },
            { name: 'libelle', label: t('Libellé'), required: true, placeholder: t('ex. Décorticage du paddy') },
            {
              name: 'matiere_id', label: t('Matière première'), type: 'select', required: true,
              options: o.produits.filter((p) => ['produit_agricole', 'semence', 'intrant'].includes(p.categorie)).map((p) => ({ value: p.id, label: p.label })),
            },
            ...champsSorties,
          ]}
        />
      </PageHeader>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Nomenclatures')}</h2>
      <div className="mb-6">
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>{t('Code')}</th><th className={th}>{t('Libellé')}</th><th className={th}>{t('Matière')}</th><th className={th}>{t('Sorties (rendement prévu)')}</th>
            </tr>
          </thead>
          <tbody>
            {nomenclatures?.map((n) => {
              const m = Array.isArray(n.produits) ? n.produits[0] : n.produits
              return (
                <tr key={n.id}>
                  <td className={td}>{n.code}</td>
                  <td className={td}>{n.libelle}</td>
                  <td className={td}>{m?.nom}</td>
                  <td className={td}>
                    {(n.nomenclature_sorties as { rendement_pct: number; principal: boolean; produits: { nom: string } | { nom: string }[] | null }[]).map((s, i) => {
                      const pr = Array.isArray(s.produits) ? s.produits[0] : s.produits
                      return <span key={i} className="mr-3 inline-block">{pr?.nom} {Number(s.rendement_pct)} %</span>
                    })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </TableWrap>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Ordres de fabrication')}</h2>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>N°</th>
            <th className={th}>{t('Date')}</th>
            <th className={`${th} text-right`}>{t('Matière')}</th>
            <th className={`${th} text-right`}>{t('Coût matière')}</th>
            <th className={`${th} text-right`}>{t('Frais')}</th>
            <th className={`${th} text-right`}>{t('Valeur produite')}</th>
            <th className={th}>{t('Produits obtenus (quantité · rendement · coût unitaire)')}</th>
          </tr>
        </thead>
        <tbody>
          {ordres?.map((of) => {
            const nom = Array.isArray(of.nomenclatures) ? of.nomenclatures[0] : of.nomenclatures
            const mat = nom && (Array.isArray(nom.produits) ? nom.produits[0] : nom.produits)
            return (
              <tr key={of.id}>
                <td className={td}>{of.numero}<span className="block text-xs text-foreground-muted">{nom?.code}</span></td>
                <td className={td}>{formatDate(of.date_of, ctx.lang)}</td>
                <td className={`${td} text-right tabular-nums`}>{Number(of.quantite_matiere).toLocaleString('fr-FR')} {mat?.unite}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(of.cout_matiere, ctx.devise, ctx.lang)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(of.frais_imputes, ctx.devise, ctx.lang)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(of.valeur_totale, ctx.devise, ctx.lang)}</td>
                <td className={td}>
                  {(of.of_sorties as unknown as Sortie[]).map((s, i) => {
                    const pr = Array.isArray(s.produits) ? s.produits[0] : s.produits
                    return (
                      <span key={i} className="block">
                        {pr?.nom} : {Number(s.quantite).toLocaleString('fr-FR')} {pr?.unite} · {Number(s.rendement_reel_pct)} % · {formatMontant(Number(s.valeur) / Number(s.quantite), ctx.devise, ctx.lang)}/{pr?.unite}
                      </span>
                    )
                  })}
                </td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
