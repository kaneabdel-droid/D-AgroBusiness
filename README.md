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
- **Traçabilité et qualité** (migration 27) : lots créés automatiquement par chaque récolte et chaque fabrication (ou à la main pour les achats), filiation matière → produit fini, contrôles qualité avec blocage automatique d’un lot non conforme, expéditions refusées pour un lot bloqué ou périmé, rappel de lot (clients touchés en aval).
- **Rapprochement bancaire** (migration 28) : import d’un relevé CSV, pointage automatique (uniquement sans ambiguïté) ou manuel avec les écritures de la banque, comptabilisation des lignes absentes des livres (frais, agios), écart de rapprochement.
- **Trésorerie prévisionnelle** (migration 29) : plan à 12 mois (soldes, échéances de financement, créances et dettes ouvertes avec délai de règlement paramétrable, prévisions saisies uniques ou mensuelles), alerte au premier mois de trésorerie négative.
  Les ventes futures sont estimées d’après l’historique (même mois des années précédentes, sinon moyenne des 12 derniers mois), retenues à 80 % par défaut (0 à 100 % au choix) et encaissées avec le délai des créances ; le mois en cours n’est pas estimé.

## Paie : impôt et TRIMF calculés automatiquement

L'impôt sur le revenu et la TRIMF se calculent à partir du **brut**, du **nombre de parts** et du **nombre de conjoints**, sans barème à importer :

1. base = brut − abattement (30 %, plafonné à 900 000 par an), arrondie à l'inférieur (1 000) ;
2. impôt brut = barème progressif ; réduction pour charges de famille selon les parts (minimum et maximum) ;
3. TRIMF = palier du brut × (1 + nombre de conjoints).

Permanents : base annuelle · saisonniers : base mensuelle · journaliers : base journalière (annualisée × 360 puis ÷ 360).
Cette formule reproduit exactement le barème officiel de retenue à la source du Sénégal (vérifié sur les 19 823 lignes de ses grilles annuelle, mensuelle et journalière).

Tout est paramétrable par organisation dans Paie → Paramètres (tranches, réductions, paliers de TRIMF, abattement, arrondi, cotisations), donc adaptable à un autre pays.
Un mode « table » permet aussi d'importer une grille de retenue (CSV, `supabase/seed/bareme_retenue_sn_2013.csv` pour l'exemple sénégalais) pour les pays qui publient un barème par lignes.
Un administrateur doit valider le paramétrage avant tout calcul de paie ; toute modification impose une nouvelle validation.

## Règle des trois langues (français, anglais, arabe)

Tout texte de l'interface, message d'erreur ou libellé doit exister en français, en anglais et en arabe. Le français sert de clé : `t('Texte')` côté serveur (`creerT(ctx.lang)`) ou `useT()` côté client, avec les traductions dans `lib/i18n-en.ts` et `lib/i18n-ar.ts`.

`npm run i18n:check` (exécuté aussi automatiquement avant `npm run build`) recense tous les textes du code et des migrations et échoue s'il en manque un dans l'une des deux langues, si un marqueur `{nom}` ou `§` n'est pas conservé, si une traduction arabe ne contient pas d'arabe, ou si une clé est en double. Option `-- --orphelines` : liste les clés de dictionnaire devenues inutiles.
