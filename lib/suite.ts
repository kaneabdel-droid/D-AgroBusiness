/**
 * Page où renvoyer après connexion, inscription ou confirmation d'email (paramètre « suite »).
 * Seuls les chemins internes sont acceptés : jamais une autre adresse (redirection ouverte).
 */
export function pageSuivante(valeur: FormDataEntryValue | string | null | undefined): string | null {
  const v = typeof valeur === 'string' ? valeur.trim() : ''
  return v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\') ? v : null
}

/** Page de paiement pour un niveau choisi sur les tarifs (null si le niveau est inconnu). */
export function suitePaiement(niveau: string | undefined): string | null {
  return niveau && ['standard', 'medium', 'premium'].includes(niveau) ? `/abonnement?niveau=${niveau}` : null
}
