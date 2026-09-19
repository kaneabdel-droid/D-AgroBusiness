export const STATUTS_EMPLOYE: Record<string, string> = {
  permanent: 'Permanent',
  saisonnier: 'Saisonnier',
  journalier: 'Journalier',
  prestataire: 'Prestataire',
}

export const SITUATIONS = [
  { value: 'celibataire', label: 'Célibataire' },
  { value: 'marie', label: 'Marié(e)' },
  { value: 'divorce', label: 'Divorcé(e)' },
  { value: 'veuf', label: 'Veuf / veuve' },
]

export const TYPES_CONTRAT = [
  { value: 'cdi', label: 'CDI' },
  { value: 'cdd', label: 'CDD' },
  { value: 'saisonnier', label: 'Saisonnier' },
  { value: 'journalier', label: 'Journalier' },
  { value: 'prestation', label: 'Prestation de services' },
]

export const STATUTS_POINTAGE = [
  { value: 'present', label: 'Présent' },
  { value: 'demi_journee', label: 'Demi-journée' },
  { value: 'conge_paye', label: 'Congé payé' },
  { value: 'maladie', label: 'Maladie' },
  { value: 'absent', label: 'Absent (non payé)' },
  { value: 'conge_sans_solde', label: 'Congé sans solde' },
]

export const TYPES_CONGE = [
  { value: 'annuel', label: 'Congé annuel' },
  { value: 'maladie', label: 'Maladie' },
  { value: 'maternite', label: 'Maternité' },
  { value: 'sans_solde', label: 'Sans solde' },
  { value: 'autre', label: 'Autre (payé)' },
]

export const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]
