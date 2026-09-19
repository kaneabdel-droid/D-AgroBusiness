import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { formatDate, formatMontant } from '@/lib/utils'
import { MOIS } from '@/lib/rh'
import { Card, PageHeader } from '@/components/ui/card'

export default async function DashboardPage() {
  const ctx = await getContexte()
  const supabase = await createClient()
  const fm = (v: number) => formatMontant(v, ctx.devise)
  const maintenant = new Date()
  const aujourdhui = maintenant.toISOString().slice(0, 10)
  const dans30 = new Date(maintenant.getTime() + 30 * 86400000).toISOString().slice(0, 10)

  const { data: exercice } = await supabase
    .from('exercices_comptables')
    .select('id, libelle')
    .eq('statut', 'ouvert')
    .order('date_debut', { ascending: false })
    .limit(1)
    .maybeSingle()

  const [analytique, evolution, tresorerie, soldes, financements, stock, echeances, conges] = await Promise.all([
    exercice ? supabase.from('v_resultat_analytique').select('produits, charges').eq('exercice_id', exercice.id) : Promise.resolve({ data: [] as { produits: number; charges: number }[] }),
    exercice ? supabase.from('v_evolution_mensuelle').select('mois, produits, charges').eq('exercice_id', exercice.id).order('mois') : Promise.resolve({ data: [] as { mois: number; produits: number; charges: number }[] }),
    supabase.from('v_soldes_tresorerie').select('solde'),
    supabase.from('v_soldes_tiers').select('solde'),
    supabase.from('v_financements').select('encours'),
    supabase.from('v_stock').select('valeur, propriete'),
    supabase.from('echeances_financement').select('date_echeance, capital, interets, contrats_financement(code)').eq('statut', 'a_payer').lte('date_echeance', dans30).order('date_echeance').limit(5),
    supabase.from('demandes_conge').select('id', { count: 'exact', head: true }).eq('statut', 'demande'),
  ])

  const somme = (rows: { [k: string]: unknown }[] | null, k: string, filtre?: (r: { [k: string]: unknown }) => boolean) =>
    (rows ?? []).filter((r) => (filtre ? filtre(r) : true)).reduce((s, r) => s + Number(r[k] ?? 0), 0)
  const produits = somme(analytique.data, 'produits')
  const charges = somme(analytique.data, 'charges')
  const treso = somme(tresorerie.data, 'solde')
  const creances = somme(soldes.data, 'solde', (r) => Number(r.solde) > 0)
  const dettes = -somme(soldes.data, 'solde', (r) => Number(r.solde) < 0)
  const encours = somme(financements.data, 'encours')
  const valeurStock = somme(stock.data, 'valeur', (r) => r.propriete === 'propre')

  const mensuel = Array.from({ length: 12 }, (_, i) => {
    const m = evolution.data?.find((e) => e.mois === i + 1)
    return { mois: MOIS[i].slice(0, 3), produits: Number(m?.produits ?? 0), charges: Number(m?.charges ?? 0) }
  })
  const maxMensuel = Math.max(1, ...mensuel.flatMap((m) => [m.produits, m.charges]))

  const cartes: [string, string, string?][] = [
    ['Produits', fm(produits), exercice?.libelle],
    ['Charges', fm(charges)],
    ['Résultat', fm(produits - charges)],
    ['Trésorerie', fm(treso)],
    ['Créances (producteurs, clients)', fm(creances)],
    ['Dettes (fournisseurs, etc.)', fm(dettes)],
    ['Encours des financements', fm(encours)],
    ['Stock valorisé', fm(valeurStock)],
  ]

  return (
    <>
      <PageHeader titre={`Bonjour${ctx.nomComplet ? `, ${ctx.nomComplet}` : ''}`} description={ctx.organisationNom} />

      {!exercice && (
        <Card className="mb-6 border-warning">
          <p className="text-sm">
            Aucun exercice comptable ouvert : créez-en un pour pouvoir saisir des écritures.{' '}
            <Link href="/referentiels/exercices" className="font-medium text-primary underline">Créer un exercice</Link>
          </p>
        </Card>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cartes.map(([libelle, valeur, note]) => (
          <Card key={libelle}>
            <p className="text-sm text-foreground-muted">{libelle}{note ? ` — ${note}` : ''}</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${libelle === 'Résultat' ? (produits - charges < 0 ? 'text-danger' : 'text-success') : ''}`}>{valeur}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-1 font-heading text-lg font-semibold">Évolution mensuelle</h2>
          <p className="mb-4 text-xs text-foreground-muted">
            <span className="mr-3 inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-primary" /> Produits</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-secondary" /> Charges</span>
          </p>
          <div className="flex h-40 items-end gap-1 sm:gap-2" role="img" aria-label="Produits et charges par mois">
            {mensuel.map((m) => (
              <div key={m.mois} className="flex h-full flex-1 flex-col justify-end">
                <div className="flex flex-1 items-end justify-center gap-0.5">
                  <div className="w-1/2 rounded-t bg-primary" style={{ height: `${(m.produits / maxMensuel) * 100}%` }} title={`${m.mois} produits : ${fm(m.produits)}`} />
                  <div className="w-1/2 rounded-t bg-secondary" style={{ height: `${(m.charges / maxMensuel) * 100}%` }} title={`${m.mois} charges : ${fm(m.charges)}`} />
                </div>
                <p className="mt-1 text-center text-[10px] text-foreground-muted sm:text-xs">{m.mois}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-heading text-lg font-semibold">À surveiller</h2>
          <ul className="space-y-3 text-sm">
            {(echeances.data ?? []).length === 0 && <li className="text-foreground-muted">Aucune échéance d&apos;emprunt dans les 30 jours.</li>}
            {echeances.data?.map((e, i) => {
              const c = Array.isArray(e.contrats_financement) ? e.contrats_financement[0] : e.contrats_financement
              const enRetard = e.date_echeance < aujourdhui
              return (
                <li key={i} className="flex justify-between gap-3">
                  <span>Échéance {c?.code} <span className={enRetard ? 'text-danger' : 'text-foreground-muted'}>({formatDate(e.date_echeance)}{enRetard ? ', en retard' : ''})</span></span>
                  <span className="tabular-nums">{fm(Number(e.capital) + Number(e.interets))}</span>
                </li>
              )
            })}
            {(conges.count ?? 0) > 0 && (
              <li><Link href="/rh/conges" className="text-primary underline">{conges.count} demande(s) de congé en attente</Link></li>
            )}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link href="/pilotage/etats" className="text-primary underline">États et ratios</Link>
            <Link href="/pilotage/rapport-mensuel" className="text-primary underline">Rapport mensuel</Link>
            <Link href="/pilotage/budgets" className="text-primary underline">Budgets</Link>
          </div>
        </Card>
      </div>
    </>
  )
}
