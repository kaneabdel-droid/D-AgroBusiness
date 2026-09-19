-- D-AGROBUSINESS — Ghana, étape 1 : nouveau référentiel comptable.
-- Une valeur d'énumération ne peut être utilisée qu'après validation de la transaction qui l'ajoute :
-- ce fichier doit donc être exécuté seul, avant 14_ghana.sql.

alter type referentiel_comptable add value if not exists 'IFRS_GH';
