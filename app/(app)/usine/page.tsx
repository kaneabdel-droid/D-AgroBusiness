import Link from 'next/link'
import { Factory } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { chargerOptions } from '@/lib/options'
import { formatDate, formatMontant } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm, type Champ } from '@/components/SimpleCreateForm'
import { addNomenclature } from '../production/actions'

type Sortie = { quantite: number; valeur: number; rendement_reel_pct: number; produits: { nom: string; unite: string } | { nom: string; unite: string }[] | null }

export default async function UsinePage() {
  const ctx = await getContexte()
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
      { name: `produit_${i}`, label: i === 1 ? 'Produit principal' : `Sous-produit / produit ${i}`, type: 'select', required: i === 1, options: finis },
      { name: `rendement_${i}`, label: `Rendement ${i} (% de la matière)`, type: 'number', step: '0.01', required: i === 1 },
    )
  }

  return (
    <>
      <PageHeader
        titre="Usine de transformation"
        description="Matière première → produits finis et sous-produits. La valeur (matière au CUMP + frais imputés) est répartie au prorata de la valeur de marché."
      >
        {peutEcrire && (
          <Button asChild>
            <Link href="/usine/nouvel-of"><Factory className="h-4 w-4" aria-hidden /> Nouvel ordre de fabrication</Link>
          </Button>
        )}
        <SimpleCreateForm
          titre="Nouvelle nomenclature"
          disabled={!peutEcrire}
          action={addNomenclature}
          champs={[
            { name: 'code', label: 'Code', required: true },
            { name: 'libelle', label: 'Libellé', required: true, placeholder: 'ex. Décorticage du paddy' },
            {
              name: 'matiere_id', label: 'Matière première', type: 'select', required: true,
              options: o.produits.filter((p) => ['produit_agricole', 'semence', 'intrant'].includes(p.categorie)).map((p) => ({ value: p.id, label: p.label })),
            },
            ...champsSorties,
          ]}
        />
      </PageHeader>

      <h2 className="mb-2 font-heading text-lg font-semibold">Nomenclatures</h2>
      <div className="mb-6">
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Code</th><th className={th}>Libellé</th><th className={th}>Matière</th><th className={th}>Sorties (rendement prévu)</th>
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

      <h2 className="mb-2 font-heading text-lg font-semibold">Ordres de fabrication</h2>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>N°</th>
            <th className={th}>Date</th>
            <th className={`${th} text-right`}>Matière</th>
            <th className={`${th} text-right`}>Coût matière</th>
            <th className={`${th} text-right`}>Frais</th>
            <th className={`${th} text-right`}>Valeur produite</th>
            <th className={th}>Produits obtenus (quantité · rendement · coût unitaire)</th>
          </tr>
        </thead>
        <tbody>
          {ordres?.map((of) => {
            const nom = Array.isArray(of.nomenclatures) ? of.nomenclatures[0] : of.nomenclatures
            const mat = nom && (Array.isArray(nom.produits) ? nom.produits[0] : nom.produits)
            return (
              <tr key={of.id}>
                <td className={td}>{of.numero}<span className="block text-xs text-foreground-muted">{nom?.code}</span></td>
                <td className={td}>{formatDate(of.date_of)}</td>
                <td className={`${td} text-right tabular-nums`}>{Number(of.quantite_matiere).toLocaleString('fr-FR')} {mat?.unite}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(of.cout_matiere, ctx.devise)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(of.frais_imputes, ctx.devise)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(of.valeur_totale, ctx.devise)}</td>
                <td className={td}>
                  {(of.of_sorties as unknown as Sortie[]).map((s, i) => {
                    const pr = Array.isArray(s.produits) ? s.produits[0] : s.produits
                    return (
                      <span key={i} className="block">
                        {pr?.nom} : {Number(s.quantite).toLocaleString('fr-FR')} {pr?.unite} · {Number(s.rendement_reel_pct)} % · {formatMontant(Number(s.valeur) / Number(s.quantite), ctx.devise)}/{pr?.unite}
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
