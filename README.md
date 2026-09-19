# D-AGROBUSINESS

SaaS de gestion intégrée de la chaîne de valeur agricole : financement, intrants, parc matériel, production, usine de transformation, RH/paie et comptabilité analytique (département × secteur/projet × campagne).

Stack : Next.js 16 (App Router), Supabase (Postgres + RLS + Auth), Tailwind v4, composants de style shadcn/ui.

## Mise en route

1. Copier `.env.example` vers `.env.local` et renseigner l'URL et la clé publique du projet Supabase.
2. Appliquer les migrations de `supabase/migrations/` dans l'ordre (SQL Editor Supabase ou `supabase db push`).
3. `npm install` puis `npm run dev`.
4. Créer une organisation depuis `/signup` : plan comptable (selon le pays), départements et journaux sont initialisés automatiquement.

## Commandes

```bash
npm run dev        # serveur de développement
npm run build      # build de production
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

## Phase 0 — Fondations (livrée)

- Multi-tenant par `organisation_id`, rôles (admin, comptable, chef de département, RH, direction, lecteur), RLS sur toutes les tables, journal d'audit.
- Référentiels : départements, secteurs/projets, exercices, campagnes, tiers unifiés.
- Moteur comptable : plan comptable par référentiel (SYSCOHADA complet sur les comptes principaux ; PCM Maroc et Mauritanie en squelette, à faire valider), journaux, écritures immuables et équilibrées, imputation analytique obligatoire sur les classes 6 et 7, contre-passation, balance et résultat analytique.

## Phases livrées

- **Phase 1** : catalogue, stocks (CUMP, stock propre / consigné), achats, dépôt-vente, ventes et distribution, remboursement en nature, trésorerie.
- **Phase 2** : emprunts, crédit de campagne, fonds de commercialisation, crédit-bail, subventions d'investissement (reprise au taux de financement), parc matériel et amortissements.
- **Phase 3** : production par secteur × campagne (coût analytique, rendement), usine de transformation (nomenclatures, ordres de fabrication, répartition matière + frais).
- **Phase 4** : personnel, contrats, pointage, congés, paie paramétrable avec verrou de validation.

## Paie : barème de retenue à la source (Sénégal)

L'impôt sur le revenu et la TRIMF sont lus dans un barème officiel de retenue à la source, importé dans la table `baremes_retenue`
(permanents → barème annuel, saisonniers → mensuel, journaliers → journalier ; TRIMF × (1 + nombre de conjoints)).

Après avoir exécuté `supabase/migrations/06_rh_paie.sql`, importer le barème de référence :

1. Supabase → Table Editor → `baremes_retenue` → Insert → Import data from CSV.
2. Choisir `supabase/seed/bareme_retenue_sn_2013.csv` (19 823 lignes) ; laisser `id`, `organisation_id` et `pays` vides (valeurs par défaut).
3. Dans l'application : Paie → Paramètres → vérifier les taux et plafonds, puis « Valider le paramétrage ».

Le barème SN-2013 est celui en vigueur au Sénégal (confirmé par l'utilisateur). Si les textes changent, importer une nouvelle version depuis Paie → Paramètres (import CSV, même format), sans toucher au code.
Pour un autre pays, importer son barème (ou renseigner tranches, réductions et forfaits en mode « calcul ») et ses règles de cotisations.
