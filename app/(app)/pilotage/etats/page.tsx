import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { formatMontant } from '@/lib/utils'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { ExportButtons } from '@/components/ExportButtons'
import { ExerciceFilter } from '@/components/ExerciceFilter'

type Ligne = { numero: string; libelle: string; classe: number; total_debit: number; total_credit: number; solde: number }

export default async function EtatsPage({ searchParams }: { searchParams: Promise<{ exercice?: string }> }) {
  const ctx = await getContexte()
  const { exercice } = await searchParams
  const supabase = await createClient()
  const { data: exercices } = await supabase.from('exercices_comptables').select('id, libelle').order('date_debut', { ascending: false })
  const exerciceId = exercice ?? exercices?.[0]?.id
  const libelleEx = exercices?.find((e) => e.id === exerciceId)?.libelle ?? ''
  const { data } = exerciceId
    ? await supabase.from('v_balance').select('numero, libelle, classe, total_debit, total_credit, solde').eq('exercice_id', exerciceId).order('numero')
    : { data: [] }
  const lignes: Ligne[] = (data ?? []).map((l) => ({ ...l, total_debit: Number(l.total_debit), total_credit: Number(l.total_credit), solde: Number(l.solde) }))

  // Soldes par préfixe : positif = débiteur
  const s = (...prefixes: string[]) => lignes.filter((l) => prefixes.some((p) => l.numero.startsWith(p))).reduce((x, l) => x + l.solde, 0)
  const debiteurs = (classe: number) => lignes.filter((l) => l.classe === classe && l.solde > 0).reduce((x, l) => x + l.solde, 0)
  const crediteurs = (classe: number) => lignes.filter((l) => l.classe === classe && l.solde < 0).reduce((x, l) => x - l.solde, 0)

  const produits = -lignes.filter((l) => l.classe === 7).reduce((x, l) => x + l.solde, 0)
  const charges = lignes.filter((l) => l.classe === 6).reduce((x, l) => x + l.solde, 0)
  const autres = -lignes.filter((l) => l.classe === 8).reduce((x, l) => x + l.solde, 0)
  const resultat = produits - charges + autres

  const immobilise = lignes.filter((l) => l.classe === 2).reduce((x, l) => x + l.solde, 0)   // net des amortissements (28x créditeurs)
  const stocks = lignes.filter((l) => l.classe === 3).reduce((x, l) => x + l.solde, 0)
  const creances = debiteurs(4)
  const tresoActif = debiteurs(5)
  const capitauxPropres = -lignes.filter((l) => l.classe === 1 && !/^(16|17)/.test(l.numero)).reduce((x, l) => x + l.solde, 0) + resultat
  const dettesFin = -lignes.filter((l) => /^(16|17)/.test(l.numero)).reduce((x, l) => x + l.solde, 0) + crediteurs(5)
  const dettesCT = crediteurs(4)
  const actif = immobilise + stocks + creances + tresoActif
  const passif = capitauxPropres + dettesFin + dettesCT

  const ca = -s('70')
  const creancesClients = s('411')
  const consoStocks = s('603')
  const ebe = -lignes.filter((l) => l.classe === 7 && !/^(77|78|79)/.test(l.numero)).reduce((x, l) => x + l.solde, 0)
    - lignes.filter((l) => l.classe === 6 && !/^(67|68|69)/.test(l.numero)).reduce((x, l) => x + l.solde, 0)

  const ratio = (a: number, b: number, dec = 2) => (b !== 0 ? (a / b).toFixed(dec) : '—')
  const pct = (a: number, b: number) => (b !== 0 ? `${((a / b) * 100).toFixed(1)} %` : '—')
  const fm = (v: number) => formatMontant(v, ctx.devise)

  const ratios: [string, string, string, string][] = [
    ['Rentabilité', 'Marge nette', pct(resultat, produits), 'Résultat ÷ produits'],
    ['Rentabilité', 'Excédent brut d’exploitation (EBE)', fm(ebe), 'Produits d’exploitation − charges d’exploitation (hors financier, dotations)'],
    ['Rentabilité', 'Taux d’EBE', pct(ebe, produits), 'EBE ÷ produits'],
    ['Rentabilité', 'Poids des charges', pct(charges, produits), 'Charges ÷ produits'],
    ['Liquidité', 'Liquidité générale', ratio(stocks + creances + tresoActif, dettesCT + crediteurs(5)), '(Stocks + créances + trésorerie) ÷ dettes à court terme'],
    ['Liquidité', 'Trésorerie nette', fm(tresoActif - crediteurs(5)), 'Trésorerie active − crédits de trésorerie'],
    ['Endettement', 'Endettement', pct(dettesFin, capitauxPropres), 'Dettes financières ÷ capitaux propres'],
    ['Endettement', 'Autonomie financière', pct(capitauxPropres, actif), 'Capitaux propres ÷ total de l’actif'],
    ['Efficacité', 'Rotation des stocks', consoStocks > 0 ? `${ratio(consoStocks, stocks, 1)} tours` : '—', 'Variation de stocks consommés (603) ÷ stocks'],
    ['Efficacité', 'Délai de recouvrement des créances', ca > 0 ? `${Math.round((creancesClients / ca) * 365)} jours` : '—', 'Créances clients (411) ÷ ventes (70) × 365'],
  ]

  const rowsCR = lignes.filter((l) => l.classe >= 6).map((l) => [l.numero, l.libelle, l.classe === 7 || l.classe === 8 && l.solde < 0 ? -l.solde : '', l.classe === 6 || l.classe === 8 && l.solde > 0 ? l.solde : ''])

  return (
    <>
      <PageHeader titre="États financiers et ratios" description={`Exercice ${libelleEx} — tirés de la balance, mis à jour à chaque écriture.`}>
        <ExerciceFilter exercices={exercices ?? []} selectionne={exerciceId} />
        <ExportButtons titre="Compte de résultat" sousTitre={`${ctx.organisationNom} — ${libelleEx}`} fichier={`compte-resultat-${libelleEx}`}
          colonnes={['Compte', 'Libellé', 'Produits', 'Charges']} lignes={rowsCR} />
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><p className="text-sm text-foreground-muted">Produits</p><p className="mt-1 text-xl font-semibold tabular-nums">{fm(produits)}</p></Card>
        <Card><p className="text-sm text-foreground-muted">Charges</p><p className="mt-1 text-xl font-semibold tabular-nums">{fm(charges)}</p></Card>
        <Card><p className="text-sm text-foreground-muted">Résultat</p><p className={`mt-1 text-xl font-semibold tabular-nums ${resultat < 0 ? 'text-danger' : 'text-success'}`}>{fm(resultat)}</p></Card>
        <Card><p className="text-sm text-foreground-muted">Trésorerie nette</p><p className="mt-1 text-xl font-semibold tabular-nums">{fm(tresoActif - crediteurs(5))}</p></Card>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">Bilan simplifié</h2>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <TableWrap>
          <thead><tr><th className={th}>Actif</th><th className={`${th} text-right`}>Montant</th></tr></thead>
          <tbody>
            <tr><td className={td}>Actif immobilisé net (classe 2 − amortissements)</td><td className={`${td} text-right tabular-nums`}>{fm(immobilise)}</td></tr>
            <tr><td className={td}>Stocks (classe 3)</td><td className={`${td} text-right tabular-nums`}>{fm(stocks)}</td></tr>
            <tr><td className={td}>Créances (comptes de tiers débiteurs)</td><td className={`${td} text-right tabular-nums`}>{fm(creances)}</td></tr>
            <tr><td className={td}>Trésorerie active</td><td className={`${td} text-right tabular-nums`}>{fm(tresoActif)}</td></tr>
            <tr className="font-semibold"><td className={td}>Total actif</td><td className={`${td} text-right tabular-nums`}>{fm(actif)}</td></tr>
          </tbody>
        </TableWrap>
        <TableWrap>
          <thead><tr><th className={th}>Passif</th><th className={`${th} text-right`}>Montant</th></tr></thead>
          <tbody>
            <tr><td className={td}>Capitaux propres (dont résultat de l&apos;exercice {fm(resultat)})</td><td className={`${td} text-right tabular-nums`}>{fm(capitauxPropres)}</td></tr>
            <tr><td className={td}>Dettes financières (emprunts, crédit-bail, crédits de trésorerie)</td><td className={`${td} text-right tabular-nums`}>{fm(dettesFin)}</td></tr>
            <tr><td className={td}>Dettes à court terme (fournisseurs, personnel, État, organismes)</td><td className={`${td} text-right tabular-nums`}>{fm(dettesCT)}</td></tr>
            <tr className="font-semibold"><td className={td}>Total passif</td><td className={`${td} text-right tabular-nums`}>{fm(passif)}</td></tr>
          </tbody>
        </TableWrap>
      </div>
      {Math.abs(actif - passif) > 0.5 && (
        <p className="mb-6 text-sm text-warning">Écart actif / passif de {fm(actif - passif)} : des comptes d&apos;une classe non reprise (ex. à-nouveaux, classe 8) peuvent l&apos;expliquer.</p>
      )}

      <h2 className="mb-2 font-heading text-lg font-semibold">Ratios de rentabilité, de liquidité et d&apos;efficacité</h2>
      <div className="mb-6">
        <TableWrap>
          <thead><tr><th className={th}>Famille</th><th className={th}>Ratio</th><th className={`${th} text-right`}>Valeur</th><th className={th}>Calcul</th></tr></thead>
          <tbody>
            {ratios.map(([famille, nom, valeur, calcul]) => (
              <tr key={nom}>
                <td className={td}>{famille}</td><td className={td}>{nom}</td>
                <td className={`${td} text-right font-medium tabular-nums`}>{valeur}</td>
                <td className={`${td} text-xs text-foreground-muted`}>{calcul}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">Compte de résultat</h2>
      <TableWrap>
        <thead><tr><th className={th}>Compte</th><th className={th}>Libellé</th><th className={`${th} text-right`}>Produits</th><th className={`${th} text-right`}>Charges</th></tr></thead>
        <tbody>
          {rowsCR.map((r, i) => (
            <tr key={i}>
              <td className={td}>{r[0]}</td><td className={td}>{r[1]}</td>
              <td className={`${td} text-right tabular-nums`}>{r[2] !== '' ? fm(Number(r[2])) : ''}</td>
              <td className={`${td} text-right tabular-nums`}>{r[3] !== '' ? fm(Number(r[3])) : ''}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className={td} colSpan={2}>Résultat de l&apos;exercice</td>
            <td className={`${td} text-right tabular-nums`} colSpan={2}>{fm(resultat)}</td>
          </tr>
        </tbody>
      </TableWrap>
    </>
  )
}
