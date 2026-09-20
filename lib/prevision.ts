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

export type VenteMensuelle = { annee: number; mois: number; montant: number }
export type EstimationVentes = {
  valeurs: number[]                                  // ventes estimées de chaque mois de l'horizon (0 = pas d'estimation)
  methodes: ('saisonnier' | 'moyenne' | null)[]
  moisHistorique: number                             // nombre de mois complets avec des ventes dans les 24 derniers mois
}

/**
 * Estime les ventes des mois à venir à partir de l'historique.
 * - saisonnier : moyenne du même mois calendaire des 2 années précédentes (les cultures sont saisonnières) ;
 * - moyenne : à défaut, ventes des 12 derniers mois complets ÷ 12, si au moins 3 mois de ventes sont connus.
 * Le mois en cours n'est pas estimé : il est déjà en partie réalisé et figure dans les créances ouvertes.
 */
export function estimerVentes(historique: VenteMensuelle[], horizon: string[], aujourdhui: string): EstimationVentes {
  const cle = (a: number, m: number) => a * 12 + (m - 1)
  const courant = cle(Number(aujourdhui.slice(0, 4)), Number(aujourdhui.slice(5, 7)))
  const parCle = new Map<number, number>()
  for (const h of historique) {
    const k = cle(h.annee, h.mois)
    if (k < courant && k >= courant - 24 && h.montant > 0) parCle.set(k, (parCle.get(k) ?? 0) + h.montant)
  }
  const derniers12 = [...parCle].filter(([k]) => k >= courant - 12)
  const moyenne12 = derniers12.length >= 3 ? derniers12.reduce((s, [, v]) => s + v, 0) / 12 : null

  const valeurs: number[] = []
  const methodes: EstimationVentes['methodes'] = []
  horizon.forEach((mois, i) => {
    const k = cle(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)))
    const memes = [k - 12, k - 24].map((x) => parCle.get(x)).filter((v): v is number => v !== undefined)
    if (i === 0) { valeurs.push(0); methodes.push(null) }
    else if (memes.length) { valeurs.push(Math.round(memes.reduce((s, v) => s + v, 0) / memes.length)); methodes.push('saisonnier') }
    else if (moyenne12 !== null) { valeurs.push(Math.round(moyenne12)); methodes.push('moyenne') }
    else { valeurs.push(0); methodes.push(null) }
  })
  return { valeurs, methodes, moisHistorique: parCle.size }
}

export type PaieMensuelle = { annee: number; mois: number; montant: number }
export type EstimationPaie = { valeurs: number[]; base: number; moisHistorique: number }

/**
 * Masse salariale à venir : moyenne du coût total des 3 dernières paies connues (mois en cours compris), reconduite chaque mois.
 * Le mois en cours n'est ajouté que si sa paie n'existe pas encore ; sinon elle figure déjà dans la comptabilité.
 */
export function estimerPaie(historique: PaieMensuelle[], horizon: string[], aujourdhui: string): EstimationPaie {
  const cle = (a: number, m: number) => a * 12 + (m - 1)
  const courant = cle(Number(aujourdhui.slice(0, 4)), Number(aujourdhui.slice(5, 7)))
  const parCle = new Map<number, number>()
  for (const h of historique) {
    const k = cle(h.annee, h.mois)
    if (k <= courant && h.montant > 0) parCle.set(k, (parCle.get(k) ?? 0) + h.montant)
  }
  const derniers = [...parCle].sort((a, b) => b[0] - a[0]).slice(0, 3)
  if (derniers.length === 0) return { valeurs: horizon.map(() => 0), base: 0, moisHistorique: 0 }
  const base = Math.round(derniers.reduce((s, [, v]) => s + v, 0) / derniers.length)
  const valeurs = horizon.map((_, i) => (i === 0 && parCle.has(courant) ? 0 : base))
  return { valeurs, base, moisHistorique: parCle.size }
}
