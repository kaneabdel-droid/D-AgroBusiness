// Le mapping pays → référentiel/devise est appliqué côté base (handle_new_user) ;
// cette liste ne sert qu'à alimenter le formulaire d'inscription.
export const PAYS = [
  { code: 'SN', nom: 'Sénégal' },
  { code: 'CI', nom: 'Côte d\'Ivoire' },
  { code: 'ML', nom: 'Mali' },
  { code: 'BF', nom: 'Burkina Faso' },
  { code: 'NE', nom: 'Niger' },
  { code: 'TG', nom: 'Togo' },
  { code: 'BJ', nom: 'Bénin' },
  { code: 'GW', nom: 'Guinée-Bissau' },
  { code: 'MR', nom: 'Mauritanie' },
  { code: 'MA', nom: 'Maroc' },
  { code: 'GH', nom: 'Ghana' },
  { code: 'GN', nom: 'Guinée' },
  { code: 'NG', nom: 'Nigeria' },
] as const

export const ROLES: Record<string, string> = {
  admin: 'Administrateur',
  comptable: 'Comptable',
  chef_departement: 'Chef de département',
  rh: 'Ressources humaines',
  direction: 'Direction',
  lecteur: 'Lecteur',
}
