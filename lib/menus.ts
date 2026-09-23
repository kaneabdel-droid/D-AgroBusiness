// Registre unique des menus de l'application : source commune à la barre latérale (AppShell) et à la page
// d'administration des permissions (/administration/permissions), pour que les deux ne divergent jamais.
// `href` sert aussi de clé dans la matrice de permissions (parametres_permissions.matrice) : ne pas le changer
// sans migrer les matrices déjà enregistrées.

export type MenuItem = {
  href: string
  label: string
  requiertRh?: boolean
  requiertUsine?: boolean
}

export type GroupeMenu = {
  titre: string
  items: MenuItem[]
}

export const MENUS: GroupeMenu[] = [
  {
    titre: 'Pilotage',
    items: [{ href: '/', label: 'Tableau de bord' }],
  },
  {
    titre: 'Référentiels',
    items: [
      { href: '/referentiels/departements', label: 'Départements' },
      { href: '/referentiels/secteurs', label: 'Secteurs & projets' },
      { href: '/referentiels/exercices', label: 'Exercices' },
      { href: '/referentiels/campagnes', label: 'Campagnes' },
      { href: '/referentiels/tiers', label: 'Tiers' },
    ],
  },
  {
    titre: 'Catalogue & stocks',
    items: [
      { href: '/catalogue/produits', label: 'Produits' },
      { href: '/catalogue/magasins', label: 'Magasins' },
      { href: '/stocks', label: 'État des stocks' },
    ],
  },
  {
    titre: 'Opérations',
    items: [
      { href: '/achats', label: 'Achats' },
      { href: '/depot-vente', label: 'Dépôt-vente' },
      { href: '/ventes?type=distribution', label: 'Distribution producteurs' },
      { href: '/ventes?type=marche', label: 'Ventes marché' },
      { href: '/remboursements-nature', label: 'Remboursements en nature' },
      { href: '/tresorerie', label: 'Trésorerie' },
      { href: '/tresorerie/rapprochement', label: 'Rapprochement bancaire' },
      { href: '/tresorerie/previsionnel', label: 'Trésorerie prévisionnelle' },
    ],
  },
  {
    titre: 'Production & usine',
    items: [
      { href: '/production', label: 'Production agricole' },
      { href: '/usine', label: 'Usine de transformation', requiertUsine: true },
      { href: '/tracabilite', label: 'Traçabilité et qualité' },
    ],
  },
  {
    titre: 'Personnel & paie',
    items: [
      { href: '/rh/employes', label: 'Personnel', requiertRh: true },
      { href: '/rh/categories', label: 'Catégories salariales', requiertRh: true },
      { href: '/rh/pointage', label: 'Pointage', requiertRh: true },
      { href: '/rh/conges', label: 'Congés et absences', requiertRh: true },
      { href: '/rh/paie', label: 'Paie', requiertRh: true },
      { href: '/rh/parametres', label: 'Paramètres de paie', requiertRh: true },
    ],
  },
  {
    titre: 'Financement & matériel',
    items: [
      { href: '/financements', label: 'Emprunts et crédits' },
      { href: '/subventions', label: 'Subventions' },
      { href: '/materiel', label: 'Parc matériel' },
    ],
  },
  {
    titre: 'Pilotage',
    items: [
      { href: '/pilotage/budgets', label: 'Budgets' },
      { href: '/pilotage/etats', label: 'États et ratios' },
      { href: '/pilotage/campagnes', label: 'Bilans de campagne' },
      { href: '/pilotage/rapport-mensuel', label: 'Rapport mensuel' },
      { href: '/pilotage/tva', label: 'TVA' },
    ],
  },
  {
    titre: 'Administration',
    items: [
      { href: '/administration/equipe', label: 'Équipe' },
      { href: '/administration/permissions', label: 'Permissions' },
      { href: '/administration/audit', label: 'Journal d’audit' },
      { href: '/abonnement', label: 'Abonnement' },
    ],
  },
  {
    titre: 'Comptabilité',
    items: [
      { href: '/comptabilite/plan-comptable', label: 'Plan comptable' },
      { href: '/comptabilite/ecritures', label: 'Écritures' },
      { href: '/comptabilite/balance', label: 'Balance' },
      { href: '/comptabilite/soldes-tiers', label: 'Créances et dettes' },
      { href: '/comptabilite/releve', label: 'Relevés de compte' },
      { href: '/comptabilite/analytique', label: 'Résultat analytique' },
    ],
  },
]

/** Rôles restreignables dans la matrice : jamais 'admin', qui garde toujours un accès complet. */
export const ROLES_RESTREIGNABLES = ['direction', 'comptable', 'chef_departement', 'rh', 'lecteur']
