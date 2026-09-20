/** Libellés (traduits à l'affichage) des catégories du plan de trésorerie prévisionnel. */
export const CATEGORIES_PREVISION: Record<string, string> = {
  vente: 'Ventes et encaissements clients',
  subvention: 'Subventions',
  paie: 'Salaires et charges sociales',
  fournisseur: 'Fournisseurs et achats',
  impot: 'Impôts et taxes',
  financement: 'Remboursements de financements',
  investissement: 'Investissements',
  autre: 'Autres flux',
  vente_estimee: 'Ventes estimées (historique)',
  paie_estimee: 'Salaires et charges (d’après la paie)',
}

/** Catégories alimentées automatiquement par la comptabilité (hors prévisions saisies). */
export const CATEGORIE_VENTES_ESTIMEES = 'vente_estimee'
export const CATEGORIE_PAIE_ESTIMEE = 'paie_estimee'
export const CATEGORIE_CREANCES = 'vente'
export const CATEGORIE_DETTES = 'fournisseur'
export const CATEGORIE_ECHEANCES = 'financement'
