# Audit global — D-AGROBUSINESS (21 septembre 2026)

Périmètre : sécurité, performance, rapidité des actions, cohérence des données, impressions, responsivité (tous écrans, tous niveaux d'abonnement, français et arabe).
Les contrôles sont rejouables : `npm run audit:securite`, `npm run audit:coherence`, `npm run audit:index`, `npm run i18n:check`.

## 1. Sécurité

| Contrôle | Résultat |
|---|---|
| Tables avec sécurité par lignes (RLS) | 74 sur 74 |
| Tables sans policy (accès par clé de service uniquement, voulu) | compteurs, événements de webhook, produits Chariow, moyens de paiement |
| Fonctions `security definer` | 68, toutes avec `search_path` fixé ; 63 verrouillées pour `anon`, 5 publiques volontairement (aides des policies RLS, qui ne renvoient que le contexte de l'appelant, et `invitation_en_attente`) |
| Lecture anonyme de 95 tables et vues (API réelle) | 0 ligne renvoyée |
| Appel anonyme de 69 fonctions (API réelle) | 0 exécution utile (seuls les 3 aides RLS répondent, avec `null` ou `[]`) |
| Dépendances (`npm audit`, production) | 0 vulnérabilité |
| Secrets dans les fichiers suivis par Git | aucun ; `.env.local` ignoré |
| Usage de la clé de service | 13 fichiers, tous derrière un contrôle : espace `/admin` (administrateur de la plateforme), webhooks (signature), cron (secret), démonstration (adresses fixes), paiement (rôle admin ou direction) |
| En-têtes HTTP | ajoutés : CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |

Écarts trouvés et corrigés pendant l'audit :
- **Proxy** : le contrôle du super-admin (`/admin`) interceptait aussi `/administration/...` (équipe, journal d'audit), qui redirigeaient vers l'accueil. Corrigé (`/admin` exactement ou `/admin/...`).
- **Cron Chariow** : route ouverte si `CRON_SECRET` n'était pas défini. Fermée dans ce cas.
- **En-têtes de sécurité** : absents. Ajoutés (`next.config.ts`).

Points à surveiller (non bloquants) :
- La politique de contenu autorise `'unsafe-inline'` pour les scripts (Next.js injecte des scripts en ligne) ; un nonce par requête la durcirait.
- `invitation_en_attente` révèle si une adresse est invitée (nécessaire au formulaire d'inscription sans envoi d'email).
- Les comptes de démonstration sont partagés : leurs données peuvent être modifiées par les visiteurs.
- La limitation de débit des connexions et inscriptions repose sur Supabase.

## 2. Performance

- **Index** (migration 34) : 21 tables filtrées par RLS sur `organisation_id` n'avaient aucun index sur cette colonne (chaque lecture parcourait toute la table, toutes entreprises confondues) ; 30 clés de jointure fréquentes non plus (lignes d'achat et de vente, règlements, écritures, stocks, paie). Tous les index sont créés « if not exists ».
- **Proxy** : le contrôle d'expiration de l'abonnement faisait une requête base de données de plus à chaque navigation, en doublon avec le layout. Il est maintenant fait une seule fois, dans le layout.
- **Authentification** : `auth.getUser()` (≈ 500 ms d'aller-retour réseau, appelé deux fois par page : proxy et layout) est remplacé par `auth.getClaims()`, qui vérifie la signature du jeton localement (1 ms après le premier appel). L'appartenance à l'entreprise et son activité restent contrôlées en base à chaque requête (`current_org_id()`).
- **Résilience réseau** : les clients Supabase côté serveur ont un délai maximal de 15 s et relancent une fois les lectures en échec. Avant, une requête sans réponse bloquait la page (4 pages sur 235 ont dépassé 30 s pendant le balayage).
- **Mesures** (serveur de production local, base Supabase distante, 42 pages de l'application) : moyenne **1 933 ms → 1 135 ms** (−41 %), maximum 5 146 ms → 3 424 ms, plus aucun dépassement de délai. La latence vers Supabase reste dominante (médiane 0,3 à 1,2 s par requête depuis ce poste : lecture d'une vue 0,5 s, 200 lignes d'écritures 1,2 s, connexion 2,1 s) : placer les fonctions Vercel dans la même région que le projet Supabase est le levier le plus important en production.

## 3. Cohérence des données (`npm run audit:coherence`)

27 contrôles sur les 4 organisations existantes, tous conformes : écritures équilibrées (44), balance équilibrée par organisation, écritures datées dans leur exercice, comptes de la bonne organisation, aucun stock négatif, vue des stocks conforme aux mouvements, lots (quantités expédiées, libération, numéros uniques), bulletins (net = brut − retenues ; coût = brut + charges), échéances et remboursements, pointages bancaires uniques, administrateur actif par organisation, paiements (montants, références uniques, abonnement daté).

## 4. Impressions

Aucune règle d'impression n'existait : menu, boutons et filtres s'imprimaient. Ajout d'une feuille d'impression A4 (menu, en-têtes, boutons et filtres masqués ; tableaux à la largeur de la page, en-têtes répétés, lignes non coupées ; fond blanc). Vérifié sur 8 écrans clés (accueil, balance, écritures, états, paie, stocks, trésorerie, traçabilité) : 0 bouton et 0 menu à l'impression. Les bulletins et documents PDF utilisent leur propre génération (`lib/impression.ts`, PDF ou impression arabe).

## 5. Responsivité

Balayage de 47 pages : mobile 360 px, tablette 768 px, portable 1280 px, grand écran 1920 px (français), puis arabe (mobile et portable) :
- 0 défilement horizontal de la page, 0 élément hors de la fenêtre ;
- arabe : `dir="rtl"` sur toutes les pages ;
- aucune erreur JavaScript ;
- corrigé : le tiroir de menu mobile et la barre latérale ne suivaient pas le sens d'écriture en arabe (`left`/`border-r` remplacés par `start`/`border-e`).
Petites cibles tactiles : seuls les liens de texte dans les tableaux (17 px de haut) sont sous 24 px ; la ligne entière reste cliquable au doigt.

## 6. Niveaux d'abonnement

Vérifié en base et à l'écran : essai, Premium, Standard (menu RH masqué, pages fermées, tables protégées, calcul de paie refusé), compte expiré ou verrouillé (redirection vers la page Abonnement), webhooks signés, paiement rejoué sans double crédit. Le niveau Medium (usine) est vérifiable une fois la migration 32 appliquée.
