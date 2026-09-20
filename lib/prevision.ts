/** Plan de trésorerie prévisionnel : agrège des flux datés par catégorie et par mois, avec le solde cumulé. */
export type Flux = { mois: number; categorie: string; montant: number }   // montant signé : + encaissement, − décaissement

export type Plan = {
  mois: string[]                                   // 'AAAA-MM'
  lignes: { categorie: string; parMois: number[] }[]
  soldeDebut: number[]
  soldeFin: number[]
  premierDeficit: number | null                    // indice du premier mois où le solde de fin est négatif
}

/** Les 'n' mois à partir du mois de 'depuis' (AAAA-MM-JJ), au format AAAA-MM. */
export function moisSuivants(depuis: string, n: number): string[] {
  let a = Number(depuis.slice(0, 4)), m = Number(depuis.slice(5, 7))
  const res: string[] = []
  for (let i = 0; i < n; i++) {
    res.push(`${a}-${String(m).padStart(2, '0')}`)
    if (++m > 12) { m = 1; a++ }
  }
  return res
}

/** Indice du mois d'une date dans l'horizon ; les dates déjà échues tombent dans le premier mois, celles au-delà de l'horizon sont ignorées. */
export function indiceMois(mois: string[], date: string): number | null {
  const m = date.slice(0, 7)
  if (m < mois[0]) return 0
  const i = mois.indexOf(m)
  return i < 0 ? null : i
}

export function construirePlan(mois: string[], soldeInitial: number, flux: Flux[]): Plan {
  const parCategorie = new Map<string, number[]>()
  for (const f of flux) {
    const tab = parCategorie.get(f.categorie) ?? new Array(mois.length).fill(0)
    tab[f.mois] += f.montant
    parCategorie.set(f.categorie, tab)
  }
  const soldeDebut: number[] = []
  const soldeFin: number[] = []
  let courant = soldeInitial
  let premierDeficit: number | null = null
  for (let i = 0; i < mois.length; i++) {
    soldeDebut.push(courant)
    for (const tab of parCategorie.values()) courant += tab[i]
    courant = Math.round(courant * 100) / 100
    soldeFin.push(courant)
    if (premierDeficit === null && courant < 0) premierDeficit = i
  }
  return { mois, lignes: [...parCategorie].map(([categorie, parMois]) => ({ categorie, parMois })), soldeDebut, soldeFin, premierDeficit }
}
