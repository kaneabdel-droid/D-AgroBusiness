-- D-AGROBUSINESS — Phase 0 : fondations (multi-tenant, RBAC, référentiels)
-- Toute table métier porte organisation_id ; la RLS est le point d'application réel.

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- ============================================================
-- Types
-- ============================================================
create type role_utilisateur as enum (
  'admin', 'comptable', 'chef_departement', 'rh', 'direction', 'lecteur'
);

create type type_departement as enum (
  'fonctionnement', 'distribution', 'production', 'usine', 'materiel', 'commercial', 'autre'
);

create type type_tiers as enum (
  'producteur', 'fournisseur', 'client', 'bailleur'
);

create type referentiel_comptable as enum ('SYSCOHADA', 'PCM_MA', 'PCM_MR');

-- ============================================================
-- Organisations et utilisateurs
-- ============================================================
create table organisations (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  pays text not null default 'SN',                 -- ISO 3166-1 alpha-2
  devise text not null default 'XOF',
  referentiel referentiel_comptable not null default 'SYSCOHADA',
  nif text,
  adresse text,
  telephone text,
  created_at timestamptz not null default now()
);

create table utilisateurs (
  id uuid primary key references auth.users(id) on delete cascade,
  organisation_id uuid not null references organisations(id) on delete cascade,
  nom_complet text,
  role role_utilisateur not null default 'lecteur',
  actif boolean not null default true,
  created_at timestamptz not null default now()
);
create index on utilisateurs (organisation_id);

-- ============================================================
-- Fonctions d'aide RLS (security definer : évitent la récursion de policies)
-- ============================================================
create or replace function current_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select organisation_id from utilisateurs where id = auth.uid() and actif
$$;

create or replace function current_role_utilisateur() returns role_utilisateur
language sql stable security definer set search_path = public as $$
  select role from utilisateurs where id = auth.uid() and actif
$$;

create or replace function has_role(variadic roles role_utilisateur[]) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_role_utilisateur() = any(roles), false)
$$;

-- ============================================================
-- Départements (axe analytique n°1) et secteurs/projets (axe n°2)
-- ============================================================
create table departements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  code text not null,
  nom text not null,
  type type_departement not null default 'autre',
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organisation_id, code)
);

create table utilisateur_departements (
  utilisateur_id uuid not null references utilisateurs(id) on delete cascade,
  departement_id uuid not null references departements(id) on delete cascade,
  primary key (utilisateur_id, departement_id)
);

create table secteurs_projets (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  departement_id uuid not null references departements(id) on delete restrict,
  code text not null,
  nom text not null,
  nature text not null default 'secteur' check (nature in ('secteur', 'projet')),
  superficie_ha numeric(12,2),
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organisation_id, code)
);
create index on secteurs_projets (organisation_id, departement_id);

-- ============================================================
-- Exercices comptables et campagnes agricoles (axe n°3)
-- ============================================================
create table exercices_comptables (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  libelle text not null,
  date_debut date not null,
  date_fin date not null,
  statut text not null default 'ouvert' check (statut in ('ouvert', 'cloture')),
  created_at timestamptz not null default now(),
  check (date_fin > date_debut),
  unique (organisation_id, libelle)
);

-- Deux exercices d'une même organisation ne peuvent pas se chevaucher.
alter table exercices_comptables add constraint exercices_sans_chevauchement
  exclude using gist (
    organisation_id with =,
    daterange(date_debut, date_fin, '[]') with &&
  );

create table campagnes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  code text not null,
  libelle text not null,
  date_debut date not null,
  date_fin date not null,
  statut text not null default 'ouverte' check (statut in ('ouverte', 'cloturee')),
  created_at timestamptz not null default now(),
  check (date_fin > date_debut),
  unique (organisation_id, code)
);

-- ============================================================
-- Tiers unifiés (un tiers peut cumuler plusieurs rôles)
-- ============================================================
create table tiers (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  code text not null,
  nom text not null,
  types type_tiers[] not null default '{}',
  telephone text,
  email text,
  adresse text,
  nif text,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organisation_id, code),
  check (cardinality(types) > 0)
);
create index on tiers using gin (types);
create index on tiers (organisation_id, nom);

-- ============================================================
-- Journal d'audit (traçabilité réglementaire)
-- ============================================================
create table journal_audit (
  id bigint generated always as identity primary key,
  organisation_id uuid,
  utilisateur_id uuid default auth.uid(),
  table_name text not null,
  ligne_id text,
  action text not null,
  anciennes_valeurs jsonb,
  nouvelles_valeurs jsonb,
  created_at timestamptz not null default now()
);
create index on journal_audit (organisation_id, created_at desc);

create or replace function audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into journal_audit (organisation_id, table_name, ligne_id, action, anciennes_valeurs, nouvelles_valeurs)
  values (
    (v_row ->> 'organisation_id')::uuid,
    tg_table_name,
    v_row ->> 'id',
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create trigger audit_departements after insert or update or delete on departements
  for each row execute function audit_trigger();
create trigger audit_secteurs after insert or update or delete on secteurs_projets
  for each row execute function audit_trigger();
create trigger audit_exercices after insert or update or delete on exercices_comptables
  for each row execute function audit_trigger();
create trigger audit_campagnes after insert or update or delete on campagnes
  for each row execute function audit_trigger();
create trigger audit_tiers after insert or update or delete on tiers
  for each row execute function audit_trigger();
create trigger audit_utilisateurs after insert or update or delete on utilisateurs
  for each row execute function audit_trigger();

-- ============================================================
-- RLS
-- ============================================================
alter table organisations enable row level security;
alter table utilisateurs enable row level security;
alter table departements enable row level security;
alter table utilisateur_departements enable row level security;
alter table secteurs_projets enable row level security;
alter table exercices_comptables enable row level security;
alter table campagnes enable row level security;
alter table tiers enable row level security;
alter table journal_audit enable row level security;

create policy org_select on organisations for select using (id = current_org_id());
create policy org_update on organisations for update
  using (id = current_org_id() and has_role('admin'))
  with check (id = current_org_id());

create policy utilisateurs_select on utilisateurs for select using (organisation_id = current_org_id());
create policy utilisateurs_update on utilisateurs for update
  using (organisation_id = current_org_id() and has_role('admin'))
  with check (organisation_id = current_org_id());

create policy ud_select on utilisateur_departements for select
  using (exists (select 1 from utilisateurs u where u.id = utilisateur_id and u.organisation_id = current_org_id()));
create policy ud_write on utilisateur_departements for all
  using (has_role('admin') and exists (select 1 from utilisateurs u where u.id = utilisateur_id and u.organisation_id = current_org_id()))
  with check (has_role('admin') and exists (select 1 from utilisateurs u where u.id = utilisateur_id and u.organisation_id = current_org_id()));

-- Référentiels : lecture pour tous les membres de l'organisation, écriture selon le rôle.
create policy dep_select on departements for select using (organisation_id = current_org_id());
create policy dep_write on departements for all
  using (organisation_id = current_org_id() and has_role('admin', 'direction'))
  with check (organisation_id = current_org_id());

create policy sec_select on secteurs_projets for select using (organisation_id = current_org_id());
create policy sec_write on secteurs_projets for all
  using (organisation_id = current_org_id() and has_role('admin', 'direction', 'chef_departement'))
  with check (organisation_id = current_org_id());

create policy exo_select on exercices_comptables for select using (organisation_id = current_org_id());
create policy exo_write on exercices_comptables for all
  using (organisation_id = current_org_id() and has_role('admin', 'comptable'))
  with check (organisation_id = current_org_id());

create policy camp_select on campagnes for select using (organisation_id = current_org_id());
create policy camp_write on campagnes for all
  using (organisation_id = current_org_id() and has_role('admin', 'direction', 'chef_departement'))
  with check (organisation_id = current_org_id());

create policy tiers_select on tiers for select using (organisation_id = current_org_id());
create policy tiers_write on tiers for all
  using (organisation_id = current_org_id() and has_role('admin', 'comptable', 'chef_departement'))
  with check (organisation_id = current_org_id());

create policy audit_select on journal_audit for select
  using (organisation_id = current_org_id() and has_role('admin', 'direction'));
