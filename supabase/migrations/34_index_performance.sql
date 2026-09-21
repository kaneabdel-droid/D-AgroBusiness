-- D-AGROBUSINESS — Index de performance (audit du 21/09/2026).
-- 1. Les 21 tables ci-dessous sont filtrées par la sécurité RLS sur organisation_id (« organisation_id = current_org_id() »)
--    mais n'avaient aucun index sur cette colonne : chaque lecture parcourait toute la table, toutes organisations confondues.
-- 2. Les clés de jointure les plus utilisées (lignes de documents, règlements, écritures, comptes de trésorerie…) sont indexées.
-- Tous les index sont créés « if not exists » : la migration est rejouable sans risque et rapide (tables encore petites).

-- 1. organisation_id
create index if not exists idx_achats_lignes_org on achats_lignes (organisation_id);
create index if not exists idx_ventes_lignes_org on ventes_lignes (organisation_id);
create index if not exists idx_tirages_financement_org on tirages_financement (organisation_id);
create index if not exists idx_echeances_financement_org on echeances_financement (organisation_id);
create index if not exists idx_remboursements_financement_org on remboursements_financement (organisation_id);
create index if not exists idx_dotations_amortissement_org on dotations_amortissement (organisation_id);
create index if not exists idx_encaissements_subvention_org on encaissements_subvention (organisation_id);
create index if not exists idx_consommations_production_org on consommations_production (organisation_id);
create index if not exists idx_nomenclature_sorties_org on nomenclature_sorties (organisation_id);
create index if not exists idx_of_sorties_org on of_sorties (organisation_id);
create index if not exists idx_contrats_travail_org on contrats_travail (organisation_id);
create index if not exists idx_demandes_conge_org on demandes_conge (organisation_id);
create index if not exists idx_baremes_retenue_org on baremes_retenue (organisation_id);
create index if not exists idx_bulletins_paie_org on bulletins_paie (organisation_id);
create index if not exists idx_bulletins_lignes_org on bulletins_lignes (organisation_id);
create index if not exists idx_bulletins_imputations_org on bulletins_imputations (organisation_id);
create index if not exists idx_budget_lignes_org on budget_lignes (organisation_id);
create index if not exists idx_lot_liens_org on lot_liens (organisation_id);
create index if not exists idx_lot_expeditions_org on lot_expeditions (organisation_id);
create index if not exists idx_controles_qualite_org on controles_qualite (organisation_id);
create index if not exists idx_lignes_releve_org on lignes_releve (organisation_id);

-- 2. jointures et suppressions
create index if not exists idx_achats_lignes_achat on achats_lignes (achat_id);
create index if not exists idx_achats_lignes_produit on achats_lignes (produit_id);
create index if not exists idx_ventes_lignes_vente on ventes_lignes (vente_id);
create index if not exists idx_ventes_lignes_produit on ventes_lignes (produit_id);
create index if not exists idx_achats_fournisseur on achats (fournisseur_id);
create index if not exists idx_reglements_tiers on reglements (tiers_id);
create index if not exists idx_reglements_compte on reglements (compte_tresorerie_id);
create index if not exists idx_reglements_achat on reglements (achat_id) where achat_id is not null;
create index if not exists idx_reglements_vente on reglements (vente_id) where vente_id is not null;
create index if not exists idx_operations_tresorerie_compte on operations_tresorerie (compte_tresorerie_id);
create index if not exists idx_ecritures_journal on ecritures (journal_id);
create index if not exists idx_ecritures_exercice on ecritures (exercice_id);
create index if not exists idx_lignes_ecritures_compte on lignes_ecritures (compte_id);
create index if not exists idx_mouvements_stock_produit on mouvements_stock (produit_id);
create index if not exists idx_mouvements_stock_magasin on mouvements_stock (magasin_id);
create index if not exists idx_remboursements_contrat on remboursements_financement (contrat_id);
create index if not exists idx_remboursements_echeance on remboursements_financement (echeance_id);
create index if not exists idx_contrats_financement_bailleur on contrats_financement (bailleur_id);
create index if not exists idx_bulletins_paie_employe on bulletins_paie (employe_id);
create index if not exists idx_bulletins_paie_periode on bulletins_paie (periode_id);
create index if not exists idx_demandes_conge_employe on demandes_conge (employe_id);
create index if not exists idx_ordres_fabrication_nomenclature on ordres_fabrication (nomenclature_id);
create index if not exists idx_lot_expeditions_tiers on lot_expeditions (tiers_id) where tiers_id is not null;
create index if not exists idx_lot_expeditions_vente on lot_expeditions (vente_id) where vente_id is not null;
create index if not exists idx_releves_bancaires_compte on releves_bancaires (compte_tresorerie_id);

-- statistiques à jour pour le planificateur de requêtes
analyze;
