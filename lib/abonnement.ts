/**
 * Offres d'abonnement : trois niveaux, paiement au mois avec une remise de 1 % par mois payé d'un coup.
 * Standard : sans l'usine ni les RH ; Medium : tout sauf les RH ; Premium : tout.
 */
export type Niveau = 'standard' | 'medium' | 'premium'

export const NIVEAUX: Record<Niveau, { nom: string; prixMensuel: number }> = {
  standard: { nom: 'Standard', prixMensuel: 10000 },
  medium: { nom: 'Medium', prixMensuel: 12500 },
  premium: { nom: 'Premium', prixMensuel: 15000 },
}

/** Durées proposées (en mois). Un mois seul est au prix plein ; à partir de 2 mois payés d'un coup, remise de 1 % par mois : 3 mois → 3 %, 12 mois → 12 %. */
export const DUREES = [1, 6, 12] as const
export type Duree = (typeof DUREES)[number]

export const estNiveau = (v: unknown): v is Niveau => v === 'standard' || v === 'medium' || v === 'premium'
export const estDuree = (v: unknown): v is Duree => DUREES.includes(v as Duree)

export const remisePourcent = (mois: number) => (mois > 1 ? mois : 0)

/** Montant en FCFA (entier) : prix mensuel × mois, moins 1 % par mois payé. */
export function montantAbonnement(niveau: Niveau, mois: number): number {
  return Math.round((NIVEAUX[niveau].prixMensuel * mois * (100 - remisePourcent(mois))) / 100)
}

/** Tous les montants possibles, pour configurer les produits Chariow. */
export function tousLesMontants(): { niveau: Niveau; mois: Duree; montant: number }[] {
  return (Object.keys(NIVEAUX) as Niveau[]).flatMap((niveau) => DUREES.map((mois) => ({ niveau, mois, montant: montantAbonnement(niveau, mois) })))
}

export type EtatAbonnement = {
  niveau: Niveau
  essaiExpireLe: Date
  abonnementExpireLe: Date | null
  verrouille: boolean
}

/** Fin de l'accès : le plus tardif de l'essai et de l'abonnement payé. */
export function finAcces(e: EtatAbonnement): Date {
  return e.abonnementExpireLe && e.abonnementExpireLe > e.essaiExpireLe ? e.abonnementExpireLe : e.essaiExpireLe
}

export const abonnementActif = (e: EtatAbonnement, maintenant = new Date()) => !e.verrouille && finAcces(e) > maintenant

/** L'usine de transformation exige le niveau Medium ou Premium. */
export const accesUsine = (e: EtatAbonnement, maintenant = new Date()) => e.niveau !== 'standard' && abonnementActif(e, maintenant)

/** Les ressources humaines exigent le niveau Premium (l'essai donne l'accès Premium). */
export const accesRh = (e: EtatAbonnement, maintenant = new Date()) => e.niveau === 'premium' && abonnementActif(e, maintenant)

export const joursRestants = (e: EtatAbonnement, maintenant = new Date()) =>
  Math.max(0, Math.ceil((finAcces(e).getTime() - maintenant.getTime()) / 86_400_000))
