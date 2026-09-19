export const CATEGORIES = [
  { value: 'intrant', label: 'Intrant' },
  { value: 'semence', label: 'Semence' },
  { value: 'produit_agricole', label: 'Produit agricole (matière première)' },
  { value: 'produit_fini', label: 'Produit fini' },
  { value: 'sous_produit', label: 'Sous-produit' },
  { value: 'service', label: 'Service / prestation' },
]

export const TYPES_FINANCEMENT: Record<string, string> = {
  emprunt_investissement: 'Emprunt d’investissement',
  credit_campagne: 'Crédit de campagne',
  fonds_commercialisation: 'Fonds de commercialisation',
  credit_bail: 'Crédit-bail',
}

export const MODES_REMBOURSEMENT = [
  { value: 'annuite_constante', label: 'Annuités constantes' },
  { value: 'capital_constant', label: 'Capital constant' },
  { value: 'in_fine', label: 'In fine (capital à l’échéance)' },
]

export const CATEGORIES_MATERIEL = [
  { value: 'hydraulique', label: 'Hydraulique (pompes, groupes, réseaux)' },
  { value: 'agricole', label: 'Agricole (tracteurs, moissonneuses…)' },
  { value: 'transport', label: 'Transport' },
  { value: 'usine', label: 'Usine / installations techniques' },
  { value: 'autre', label: 'Autre' },
]
