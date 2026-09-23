-- D-AGROBUSINESS — Matrice de permissions par rôle, configurable par l'administrateur local de chaque organisation.
--
-- Ceci est une restriction ADDITIVE, jamais une extension : le plafond technique de chaque rôle reste celui déjà
-- codé page par page (ex. seuls admin/comptable/chef_departement peuvent écrire sur les achats) et appliqué par les
-- policies RLS existantes — la matrice ne peut que retirer, au sein de ce plafond, la lecture/l'écriture/la
-- modification d'un menu pour un rôle donné. Le rôle 'admin' n'est jamais restreignable, pour éviter tout
-- verrouillage total de l'organisation. Une organisation sans ligne (ou un menu/rôle absent de la matrice) a un
-- comportement inchangé : tout est autorisé par défaut, dans la limite du plafond existant.
--
-- matrice : { "<menu>": { "<role>": { "lire": bool, "ecrire": bool, "modifier": bool } } } — une valeur absente
-- vaut « autorisé » (true).

create table parametres_permissions (
  organisation_id uuid primary key references organisations(id) on delete cascade,
  matrice jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_par uuid
);

alter table parametres_permissions enable row level security;

create policy perm_select on parametres_permissions for select
  using (organisation_id = current_org_id());

create policy perm_write on parametres_permissions for all
  using (organisation_id = current_org_id() and has_role('admin'))
  with check (organisation_id = current_org_id());
