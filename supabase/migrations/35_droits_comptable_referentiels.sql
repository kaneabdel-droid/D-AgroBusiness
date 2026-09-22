-- D-AGROBUSINESS — Le comptable peut créer et modifier les référentiels de base : départements, secteurs/projets et
-- campagnes (déjà le cas pour les tiers, magasins, produits et exercices comptables).

drop policy if exists dep_write on departements;
create policy dep_write on departements for all
  using (organisation_id = current_org_id() and has_role('admin', 'direction', 'comptable'))
  with check (organisation_id = current_org_id());

drop policy if exists sec_write on secteurs_projets;
create policy sec_write on secteurs_projets for all
  using (organisation_id = current_org_id() and has_role('admin', 'direction', 'comptable', 'chef_departement'))
  with check (organisation_id = current_org_id());

drop policy if exists camp_write on campagnes;
create policy camp_write on campagnes for all
  using (organisation_id = current_org_id() and has_role('admin', 'direction', 'comptable', 'chef_departement'))
  with check (organisation_id = current_org_id());
