/** Libellés (traduits à l'affichage) et couleurs du module traçabilité et qualité. */
export const STATUTS_LOT: Record<string, string> = { en_attente: 'En attente de contrôle', libere: 'Libéré', bloque: 'Bloqué' }
export const ORIGINES_LOT: Record<string, string> = { recolte: 'Récolte', fabrication: 'Fabrication', achat: 'Achat', autre: 'Autre' }
export const COULEURS_STATUT: Record<string, string> = { en_attente: 'text-warning', libere: 'text-success', bloque: 'text-danger' }
