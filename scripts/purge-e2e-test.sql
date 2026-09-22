-- Purge des organisations de test E2E GH et E2E NG créées pendant le développement du modèle de paie Ghana/Nigeria.
-- Aucune donnée réelle : ni achat, ni vente, ni écriture, ni financement, ni production pour ces deux organisations
-- (vérifié avant d'écrire ce script) — seuls le paramétrage (plan comptable, journaux, département, magasin) et
-- un employé de test avec ses 2 bulletins de paie.
--
-- La suppression du compte auth entraîne celle de sa ligne « utilisateurs » (clé étrangère en cascade), et la
-- suppression de l'organisation entraîne celle des départements, secteurs, campagnes et exercices (cascade).
-- Les autres tables sont protégées contre la suppression tant qu'une ligne les référence (« on delete restrict »)
-- et sont donc supprimées explicitement avant l'organisation elle-même, dans l'ordre de leurs dépendances.
do $$
declare
  v_orgs uuid[] := array[
    '4c5456df-7dd4-435f-9668-dfc20095e8e1',   -- E2E GH mu9pxdzq
    '0d8d9a90-8036-4d7b-9c95-655db8884453'    -- E2E NG mu9pxdzq
  ];
begin
  delete from bulletins_paie where organisation_id = any(v_orgs);
  delete from periodes_paie where organisation_id = any(v_orgs);
  delete from contrats_travail where organisation_id = any(v_orgs);
  delete from employes where organisation_id = any(v_orgs);
  delete from journal_audit where organisation_id = any(v_orgs);
  delete from comptes_tresorerie where organisation_id = any(v_orgs);
  delete from magasins where organisation_id = any(v_orgs);
  delete from parametres_comptables where organisation_id = any(v_orgs);
  delete from comptes_comptables where organisation_id = any(v_orgs);
  delete from journaux where organisation_id = any(v_orgs);
  delete from auth.users where id in (select id from utilisateurs where organisation_id = any(v_orgs));
  delete from organisations where id = any(v_orgs);
end $$;
