import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { formatMontant } from '@/lib/utils'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { ExportButtons } from '@/components/ExportButtons'
import { ExerciceFilter } from '@/components/ExerciceFilter'

type Ligne = { exercice_id: string; numero: string; libelle: string; classe: number; solde: number }

/** Agrégats d'un exercice : bilan cumulé jusqu'à sa clôture, résultat de l'exercice seul. */
function synthese(cumul: Ligne[], exercice: Ligne[], anterieurs: Ligne[]) {
  const parCompte = new Map<string, { numero: string; libelle: string; classe: number; solde: number }>()
  for (const l of cumul) {
    const c = parCompte.get(l.numero) ?? { numero: l.numero, libelle: l.libelle, classe: l.classe, solde: 0 }
    c.solde += l.solde
    parCompte.set(l.numero, c)
  }
  const bilan = [...parCompte.values()]
  const somme = (rows: { classe: number; solde: number }[], classes: number[]) =>
    rows.filter((l) => classes.includes(l.classe)).reduce((x, l) => x + l.solde, 0)

  const produits = -somme(exercice, [7])
  const charges = somme(exercice, [6])
  const autres = -somme(exercice, [8])
  const resultat = produits - charges + autres
  const resultatAnterieur = -somme(anterieurs, [6, 7, 8])   // équivalent d'un report à nouveau (pas de clôture comptable)

  const debiteurs = (c: number) => bilan.filter((l) => l.classe === c && l.solde > 0).reduce((x, l) => x + l.solde, 0)
  const crediteurs = (c: number) => bilan.filter((l) => l.classe === c && l.solde < 0).reduce((x, l) => x - l.solde, 0)
  const immobilise = somme(bilan, [2])
  const stocks = somme(bilan, [3])
  const creances = debiteurs(4)
  const tresoActif = debiteurs(5)
  const capitauxPropres = -bilan.filter((l) => l.classe === 1 && !/^(16|17)/.test(l.numero)).reduce((x, l) => x + l.solde, 0)
    + resultatAnterieur + resultat
  const dettesFin = -bilan.filter((l) => /^(16|17)/.test(l.numero)).reduce((x, l) => x + l.solde, 0) + crediteurs(5)
  const dettesCT = crediteurs(4)

  const soldeExo = (prefixe: string) => exercice.filter((l) => l.numero.startsWith(prefixe)).reduce((x, l) => x + l.solde, 0)
  const ca = -soldeExo('70')
  const consoStocks = soldeExo('603')
  const creancesClients = bilan.filter((l) => l.numero.startsWith('411')).reduce((x, l) => x + l.solde, 0)
  const ebe =
    -exercice.filter((l) => l.classe === 7 && !/^(77|78|79)/.test(l.numero)).reduce((x, l) => x + l.solde, 0) -
    exercice.filter((l) => l.classe === 6 && !/^(67|68|69)/.test(l.numero)).reduce((x, l) => x + l.solde, 0)

  return {
    produits, charges, autres, resultat, resultatAnterieur,
    immobilise, stocks, creances, tresoActif, capitauxPropres, dettesFin, dettesCT,
    actif: immobilise + stocks + creances + tresoActif,
    passif: capitauxPropres + dettesFin + dettesCT,
    crediteurs5: crediteurs(5),
    ca, consoStocks, creancesClients, ebe,
    comptesResultat: exercice.filter((l) => l.classe >= 6),
  }
}
type Synthese = ReturnType<typeof synthese>

export default async function EtatsPage({ searchParams }: { searchParams: Promise<{ exercice?: string }> }) {
  const ctx = await getContexte()
  const { exercice } = await searchParams
  const supabase = await createClient()
  const fm = (v: number) => formatMontant(v, ctx.devise)

  const { data: exercices } = await supabase
    .from('exercices_comptables')
    .select('id, libelle, date_debut, date_fin')
    .order('date_debut', { ascending: false })
  const courant = exercices?.find((e) => e.id === exercice) ?? exercices?.[0]
  const precedent = courant ? exercices?.find((e) => e.date_fin < courant.date_debut) : undefined   // triés du plus récent au plus ancien

  const idsCumul = courant ? (exercices ?? []).filter((e) => e.date_fin <= courant.date_fin).map((e) => e.id) : []
  const { data } = idsCumul.length
    ? await supabase.from('v_balance').select('exercice_id, numero, libelle, classe, solde').in('exercice_id', idsCumul).order('numero')
    : { data: [] }
  const toutes: Ligne[] = (data ?? []).map((l) => ({ ...l, solde: Number(l.solde) }))

  const idsN1 = new Set(precedent ? (exercices ?? []).filter((e) => e.date_fin <= precedent.date_fin).map((e) => e.id) : [])
  const N: Synthese = synthese(toutes, toutes.filter((l) => l.exercice_id === courant?.id), toutes.filter((l) => l.exercice_id !== courant?.id))
  const N1: Synthese | null = precedent
    ? synthese(toutes.filter((l) => idsN1.has(l.exercice_id)), toutes.filter((l) => l.exercice_id === precedent.id), toutes.filter((l) => idsN1.has(l.exercice_id) && l.exercice_id !== precedent.id))
    : null

  const libN = courant?.libelle ?? 'N'
  const libN1 = precedent?.libelle ?? 'N-1'
  const variation = (a: number, b: number | undefined) => (b === undefined || b === 0 ? '—' : `${(((a - b) / Math.abs(b)) * 100).toFixed(1)} %`)
  const pct = (a: number, b: number) => (b !== 0 ? `${((a / b) * 100).toFixed(1)} %` : '—')
  const ratio = (a: number, b: number, dec = 2) => (b !== 0 ? (a / b).toFixed(dec) : '—')

  // Bilan
  const actifRows: [string, number, number | undefined][] = [
    ['Actif immobilisé net (classe 2 − amortissements)', N.immobilise, N1?.immobilise],
    ['Stocks (classe 3)', N.stocks, N1?.stocks],
    ['Créances (comptes de tiers débiteurs)', N.creances, N1?.creances],
    ['Trésorerie active', N.tresoActif, N1?.tresoActif],
  ]
  const passifRows: [string, number, number | undefined][] = [
    ['Capitaux propres (report des exercices antérieurs et résultat inclus)', N.capitauxPropres, N1?.capitauxPropres],
    ['Dettes financières (emprunts, crédit-bail, crédits de trésorerie)', N.dettesFin, N1?.dettesFin],
    ['Dettes à court terme (fournisseurs, personnel, État, organismes)', N.dettesCT, N1?.dettesCT],
  ]

  // Compte de résultat : une ligne par compte, montants en positif dans leur colonne naturelle
  const montantCR = (l: { classe: number; solde: number }) => (l.classe === 6 ? l.solde : -l.solde)
  const comptesCR = new Map<string, { numero: string; libelle: string; classe: number; n: number; n1: number | undefined }>()
  for (const l of N.comptesResultat) comptesCR.set(l.numero, { numero: l.numero, libelle: l.libelle, classe: l.classe, n: montantCR(l), n1: N1 ? 0 : undefined })
  for (const l of N1?.comptesResultat ?? []) {
    const c = comptesCR.get(l.numero) ?? { numero: l.numero, libelle: l.libelle, classe: l.classe, n: 0, n1: 0 }
    c.n1 = (c.n1 ?? 0) + montantCR(l)
    comptesCR.set(l.numero, c)
  }
  const cr = [...comptesCR.values()].sort((a, b) => a.numero.localeCompare(b.numero))
  const produitsCR = cr.filter((c) => c.classe !== 6)
  const chargesCR = cr.filter((c) => c.classe === 6)

  const ratios: [string, string, string, string | undefined, string][] = [
    ['Rentabilité', 'Marge nette', pct(N.resultat, N.produits), N1 ? pct(N1.resultat, N1.produits) : undefined, 'Résultat ÷ produits'],
    ['Rentabilité', 'Excédent brut d’exploitation (EBE)', fm(N.ebe), N1 ? fm(N1.ebe) : undefined, 'Produits d’exploitation − charges d’exploitation (hors financier, dotations)'],
    ['Rentabilité', 'Taux d’EBE', pct(N.ebe, N.produits), N1 ? pct(N1.ebe, N1.produits) : undefined, 'EBE ÷ produits'],
    ['Rentabilité', 'Poids des charges', pct(N.charges, N.produits), N1 ? pct(N1.charges, N1.produits) : undefined, 'Charges ÷ produits'],
    ['Liquidité', 'Liquidité générale', ratio(N.stocks + N.creances + N.tresoActif, N.dettesCT + N.crediteurs5), N1 ? ratio(N1.stocks + N1.creances + N1.tresoActif, N1.dettesCT + N1.crediteurs5) : undefined, '(Stocks + créances + trésorerie) ÷ dettes à court terme'],
    ['Liquidité', 'Trésorerie nette', fm(N.tresoActif - N.crediteurs5), N1 ? fm(N1.tresoActif - N1.crediteurs5) : undefined, 'Trésorerie active − crédits de trésorerie'],
    ['Endettement', 'Endettement', pct(N.dettesFin, N.capitauxPropres), N1 ? pct(N1.dettesFin, N1.capitauxPropres) : undefined, 'Dettes financières ÷ capitaux propres'],
    ['Endettement', 'Autonomie financière', pct(N.capitauxPropres, N.actif), N1 ? pct(N1.capitauxPropres, N1.actif) : undefined, 'Capitaux propres ÷ total de l’actif'],
    ['Efficacité', 'Rotation des stocks', N.consoStocks > 0 ? `${ratio(N.consoStocks, N.stocks, 1)} tours` : '—', N1 ? (N1.consoStocks > 0 ? `${ratio(N1.consoStocks, N1.stocks, 1)} tours` : '—') : undefined, 'Variation de stocks consommés (603) ÷ stocks'],
    ['Efficacité', 'Délai de recouvrement des créances', N.ca > 0 ? `${Math.round((N.creancesClients / N.ca) * 365)} jours` : '—', N1 ? (N1.ca > 0 ? `${Math.round((N1.creancesClients / N1.ca) * 365)} jours` : '—') : undefined, 'Créances clients (411) ÷ ventes (70) × 365'],
  ]

  const cell = (v: number | undefined) => (v === undefined ? '—' : fm(v))
  const enteteN1 = precedent ? libN1 : `${libN1} (aucun exercice antérieur)`

  return (
    <>
      <PageHeader titre="États financiers et ratios" description={`Exercice ${libN} comparé à ${precedent ? libN1 : 'l’exercice précédent (aucun exercice antérieur)'} — tirés de la balance, mis à jour à chaque écriture.`}>
        <ExerciceFilter exercices={exercices ?? []} selectionne={courant?.id} />
        <ExportButtons titre="Compte de résultat comparatif" sousTitre={`${ctx.organisationNom} — ${libN} / ${libN1}`} fichier={`compte-resultat-${libN}`}
          colonnes={['Compte', 'Libellé', 'Nature', libN, libN1]}
          lignes={[
            ...produitsCR.map((c) => [c.numero, c.libelle, 'Produit', c.n, c.n1 ?? '']),
            ...chargesCR.map((c) => [c.numero, c.libelle, 'Charge', c.n, c.n1 ?? '']),
            ['', 'Résultat de l’exercice', '', N.resultat, N1 ? N1.resultat : ''],
          ]} />
        <ExportButtons titre="Bilan comparatif" sousTitre={`${ctx.organisationNom} — ${libN} / ${libN1}`} fichier={`bilan-${libN}`}
          colonnes={['Poste', libN, libN1]}
          lignes={[
            ...actifRows.map(([l, n, n1]) => [`Actif — ${l}`, n, n1 ?? '']),
            ['Total actif', N.actif, N1 ? N1.actif : ''],
            ...passifRows.map(([l, n, n1]) => [`Passif — ${l}`, n, n1 ?? '']),
            ['Total passif', N.passif, N1 ? N1.passif : ''],
          ]} />
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {([
          ['Produits', N.produits, N1?.produits],
          ['Charges', N.charges, N1?.charges],
          ['Résultat', N.resultat, N1?.resultat],
          ['Trésorerie nette', N.tresoActif - N.crediteurs5, N1 ? N1.tresoActif - N1.crediteurs5 : undefined],
        ] as [string, number, number | undefined][]).map(([libelle, n, n1]) => (
          <Card key={libelle}>
            <p className="text-sm text-foreground-muted">{libelle}</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${libelle === 'Résultat' ? (n < 0 ? 'text-danger' : 'text-success') : ''}`}>{fm(n)}</p>
            <p className="text-xs text-foreground-muted">{libN1} : {cell(n1)} ({variation(n, n1)})</p>
          </Card>
        ))}
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">Bilan simplifié comparatif</h2>
      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <TableWrap>
          <thead><tr><th className={th}>Actif</th><th className={`${th} text-right`}>{libN}</th><th className={`${th} text-right`}>{enteteN1}</th><th className={`${th} text-right`}>Var.</th></tr></thead>
          <tbody>
            {actifRows.map(([l, n, n1]) => (
              <tr key={l}><td className={td}>{l}</td><td className={`${td} text-right tabular-nums`}>{fm(n)}</td><td className={`${td} text-right tabular-nums text-foreground-muted`}>{cell(n1)}</td><td className={`${td} text-right`}>{variation(n, n1)}</td></tr>
            ))}
            <tr className="font-semibold"><td className={td}>Total actif</td><td className={`${td} text-right tabular-nums`}>{fm(N.actif)}</td><td className={`${td} text-right tabular-nums`}>{cell(N1?.actif)}</td><td className={`${td} text-right`}>{variation(N.actif, N1?.actif)}</td></tr>
          </tbody>
        </TableWrap>
        <TableWrap>
          <thead><tr><th className={th}>Passif</th><th className={`${th} text-right`}>{libN}</th><th className={`${th} text-right`}>{enteteN1}</th><th className={`${th} text-right`}>Var.</th></tr></thead>
          <tbody>
            {passifRows.map(([l, n, n1]) => (
              <tr key={l}><td className={td}>{l}</td><td className={`${td} text-right tabular-nums`}>{fm(n)}</td><td className={`${td} text-right tabular-nums text-foreground-muted`}>{cell(n1)}</td><td className={`${td} text-right`}>{variation(n, n1)}</td></tr>
            ))}
            <tr className="font-semibold"><td className={td}>Total passif</td><td className={`${td} text-right tabular-nums`}>{fm(N.passif)}</td><td className={`${td} text-right tabular-nums`}>{cell(N1?.passif)}</td><td className={`${td} text-right`}>{variation(N.passif, N1?.passif)}</td></tr>
          </tbody>
        </TableWrap>
      </div>
      {(Math.abs(N.actif - N.passif) > 0.5 || (N1 && Math.abs(N1.actif - N1.passif) > 0.5)) && (
        <p className="mb-6 text-sm text-warning">
          Écart actif / passif ({fm(N.actif - N.passif)}) : vérifiez les comptes d&apos;une classe non reprise au bilan (ex. classe 8 ou à-nouveaux hors résultat).
        </p>
      )}

      <h2 className="mb-2 font-heading text-lg font-semibold">Ratios</h2>
      <div className="mb-6">
        <TableWrap>
          <thead><tr><th className={th}>Famille</th><th className={th}>Ratio</th><th className={`${th} text-right`}>{libN}</th><th className={`${th} text-right`}>{enteteN1}</th><th className={th}>Calcul</th></tr></thead>
          <tbody>
            {ratios.map(([famille, nom, valeur, valeurN1, calcul]) => (
              <tr key={nom}>
                <td className={td}>{famille}</td><td className={td}>{nom}</td>
                <td className={`${td} text-right font-medium tabular-nums`}>{valeur}</td>
                <td className={`${td} text-right tabular-nums text-foreground-muted`}>{valeurN1 ?? '—'}</td>
                <td className={`${td} text-xs text-foreground-muted`}>{calcul}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">Compte de résultat comparatif</h2>
      <TableWrap>
        <thead><tr><th className={th}>Compte</th><th className={th}>Libellé</th><th className={`${th} text-right`}>{libN}</th><th className={`${th} text-right`}>{enteteN1}</th><th className={`${th} text-right`}>Var.</th></tr></thead>
        <tbody>
          <tr><td className={`${td} bg-sidebar font-semibold`} colSpan={5}>Produits</td></tr>
          {produitsCR.map((c) => (
            <tr key={c.numero}><td className={td}>{c.numero}</td><td className={td}>{c.libelle}</td><td className={`${td} text-right tabular-nums`}>{fm(c.n)}</td><td className={`${td} text-right tabular-nums text-foreground-muted`}>{cell(c.n1)}</td><td className={`${td} text-right`}>{variation(c.n, c.n1)}</td></tr>
          ))}
          <tr className="font-semibold"><td className={td} colSpan={2}>Total produits</td><td className={`${td} text-right tabular-nums`}>{fm(N.produits + N.autres)}</td><td className={`${td} text-right tabular-nums`}>{cell(N1 ? N1.produits + N1.autres : undefined)}</td><td className={`${td} text-right`}>{variation(N.produits + N.autres, N1 ? N1.produits + N1.autres : undefined)}</td></tr>
          <tr><td className={`${td} bg-sidebar font-semibold`} colSpan={5}>Charges</td></tr>
          {chargesCR.map((c) => (
            <tr key={c.numero}><td className={td}>{c.numero}</td><td className={td}>{c.libelle}</td><td className={`${td} text-right tabular-nums`}>{fm(c.n)}</td><td className={`${td} text-right tabular-nums text-foreground-muted`}>{cell(c.n1)}</td><td className={`${td} text-right`}>{variation(c.n, c.n1)}</td></tr>
          ))}
          <tr className="font-semibold"><td className={td} colSpan={2}>Total charges</td><td className={`${td} text-right tabular-nums`}>{fm(N.charges)}</td><td className={`${td} text-right tabular-nums`}>{cell(N1?.charges)}</td><td className={`${td} text-right`}>{variation(N.charges, N1?.charges)}</td></tr>
          <tr className="font-semibold"><td className={td} colSpan={2}>Résultat de l&apos;exercice</td><td className={`${td} text-right tabular-nums ${N.resultat < 0 ? 'text-danger' : ''}`}>{fm(N.resultat)}</td><td className={`${td} text-right tabular-nums`}>{cell(N1?.resultat)}</td><td className={`${td} text-right`}>{variation(N.resultat, N1?.resultat)}</td></tr>
        </tbody>
      </TableWrap>
    </>
  )
}
