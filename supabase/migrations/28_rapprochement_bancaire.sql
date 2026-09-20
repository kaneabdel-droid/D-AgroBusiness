-- D-AGROBUSINESS — Rapprochement bancaire.
-- Un relevé importé (lignes signées : + entrée d'argent, − sortie) est pointé contre les écritures du compte comptable de la banque.
-- Les écritures comptables restent immuables : le pointage est porté par la ligne de relevé.

create table releves_bancaires (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  compte_tresorerie_id uuid not null references comptes_tresorerie(id) on delete restrict,
  libelle text not null,
  date_debut date not null,
  date_fin date not null,
  solde_initial numeric(18,2),
  solde_final numeric(18,2),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (date_fin >= date_debut)
);
create index on releves_bancaires (organisation_id, compte_tresorerie_id);

create table lignes_releve (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  releve_id uuid not null references releves_bancaires(id) on delete restrict,
  date_operation date not null,
  libelle text not null,
  reference text,
  montant numeric(18,2) not null check (montant <> 0),   -- + crédit du compte en banque (encaissement), − débit
  ligne_ecriture_id uuid unique references lignes_ecritures(id) on delete restrict,
  pointee_le timestamptz,
  created_at timestamptz not null default now()
);
create index on lignes_releve (releve_id);

-- ============================================================
-- Import : { compte_tresorerie_id, libelle, date_debut, date_fin, solde_initial?, solde_final?, lignes: [{ date, libelle, reference?, montant }] }
-- Si les deux soldes sont fournis, ils doivent être cohérents avec la somme des lignes.
-- ============================================================
create or replace function importer_releve(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_id uuid := gen_random_uuid();
  v_ct uuid := (p ->> 'compte_tresorerie_id')::uuid;
  v_type text;
  v_init numeric := nullif(p ->> 'solde_initial', '')::numeric;
  v_fin numeric := nullif(p ->> 'solde_final', '')::numeric;
  v_total numeric;
  v_n integer;
begin
  if v_org is null or not has_role('admin', 'comptable') then
    raise exception 'Droits insuffisants';
  end if;
  select type into v_type from comptes_tresorerie where id = v_ct and organisation_id = v_org;
  if not found then raise exception 'Compte de trésorerie introuvable'; end if;
  v_n := coalesce(jsonb_array_length(p -> 'lignes'), 0);
  if v_n = 0 then raise exception 'Le fichier ne contient aucune ligne.'; end if;
  select sum((l ->> 'montant')::numeric) into v_total from jsonb_array_elements(p -> 'lignes') l;
  if v_init is not null and v_fin is not null and abs(v_init + v_total - v_fin) > 0.01 then
    raise exception 'Soldes incohérents : solde initial + mouvements = %, solde final saisi = %',
      v_init + v_total, v_fin;
  end if;
  insert into releves_bancaires (id, organisation_id, compte_tresorerie_id, libelle, date_debut, date_fin, solde_initial, solde_final)
  values (v_id, v_org, v_ct, coalesce(nullif(trim(p ->> 'libelle'), ''), 'Relevé'),
          (p ->> 'date_debut')::date, (p ->> 'date_fin')::date, v_init, v_fin);
  insert into lignes_releve (organisation_id, releve_id, date_operation, libelle, reference, montant)
  select v_org, v_id, (l ->> 'date')::date, coalesce(nullif(trim(l ->> 'libelle'), ''), '—'),
         nullif(trim(l ->> 'reference'), ''), (l ->> 'montant')::numeric
  from jsonb_array_elements(p -> 'lignes') l;
  return v_id;
end $$;

-- ============================================================
-- Écritures du compte de la banque pas encore pointées (montant signé = débit − crédit)
-- ============================================================
create or replace view v_ecritures_bancaires as
select ct.id as compte_tresorerie_id, l.id as ligne_ecriture_id, l.organisation_id, e.date_ecriture,
       coalesce(l.libelle, e.libelle) as libelle, e.reference_piece, l.debit - l.credit as montant,
       exists (select 1 from lignes_releve r where r.ligne_ecriture_id = l.id) as pointee
from comptes_tresorerie ct
join lignes_ecritures l on l.compte_id = ct.compte_id and l.organisation_id = ct.organisation_id
join ecritures e on e.id = l.ecriture_id;
alter view v_ecritures_bancaires set (security_invoker = true);

create or replace view v_lignes_releve as
select r.*, b.compte_tresorerie_id, b.date_debut, b.date_fin, r.ligne_ecriture_id is not null as pointee_ok
from lignes_releve r join releves_bancaires b on b.id = r.releve_id;
alter view v_lignes_releve set (security_invoker = true);

-- ============================================================
-- Pointage manuel : { ligne_releve_id, ligne_ecriture_id }
-- ============================================================
create or replace function pointer_ligne(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_lr lignes_releve%rowtype;
  v_ct uuid;
  v_ec record;
begin
  if v_org is null or not has_role('admin', 'comptable') then
    raise exception 'Droits insuffisants';
  end if;
  select * into v_lr from lignes_releve where id = (p ->> 'ligne_releve_id')::uuid and organisation_id = v_org for update;
  if not found then raise exception 'Ligne de relevé introuvable'; end if;
  if v_lr.ligne_ecriture_id is not null then raise exception 'Cette ligne est déjà pointée'; end if;
  select compte_tresorerie_id into v_ct from releves_bancaires where id = v_lr.releve_id;
  select l.id, l.debit - l.credit as montant, ct.id as ct_id into v_ec
    from lignes_ecritures l
    join comptes_tresorerie ct on ct.compte_id = l.compte_id and ct.organisation_id = l.organisation_id
    where l.id = (p ->> 'ligne_ecriture_id')::uuid and l.organisation_id = v_org;
  if not found or v_ec.ct_id <> v_ct then raise exception 'Écriture hors du compte du relevé'; end if;
  if v_ec.montant <> v_lr.montant then
    raise exception 'Montants différents : relevé %, écriture %', v_lr.montant, v_ec.montant;
  end if;
  if exists (select 1 from lignes_releve where ligne_ecriture_id = v_ec.id) then
    raise exception 'Cette écriture est déjà pointée';
  end if;
  update lignes_releve set ligne_ecriture_id = v_ec.id, pointee_le = now() where id = v_lr.id;
end $$;

create or replace function depointer_ligne(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid := current_org_id();
begin
  if v_org is null or not has_role('admin', 'comptable') then
    raise exception 'Droits insuffisants';
  end if;
  update lignes_releve set ligne_ecriture_id = null, pointee_le = null
    where id = (p ->> 'ligne_releve_id')::uuid and organisation_id = v_org;
  if not found then raise exception 'Ligne de relevé introuvable'; end if;
end $$;

-- ============================================================
-- Pointage automatique : { releve_id, tolerance_jours? }
-- Une ligne n'est pointée que si elle a UNE seule écriture candidate (même montant, date à ± tolérance)
-- et que cette écriture n'est candidate d'aucune autre ligne : aucune ambiguïté n'est tranchée à la place de l'utilisateur.
-- ============================================================
create or replace function pointer_automatiquement(p jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_rel uuid := (p ->> 'releve_id')::uuid;
  v_tol integer := coalesce(nullif(p ->> 'tolerance_jours', '')::integer, 5);
  v_ct uuid;
  v_n integer;
begin
  if v_org is null or not has_role('admin', 'comptable') then
    raise exception 'Droits insuffisants';
  end if;
  select compte_tresorerie_id into v_ct from releves_bancaires where id = v_rel and organisation_id = v_org;
  if not found then raise exception 'Relevé introuvable'; end if;

  with candidats as (
    select r.id as lr, e.ligne_ecriture_id as le
    from lignes_releve r
    join v_ecritures_bancaires e
      on e.compte_tresorerie_id = v_ct and e.organisation_id = v_org and not e.pointee
     and e.montant = r.montant and abs(e.date_ecriture - r.date_operation) <= v_tol
    where r.releve_id = v_rel and r.ligne_ecriture_id is null
  ),
  uniques as (
    select lr, min(le::text)::uuid as le from candidats group by lr having count(*) = 1
  ),
  sans_conflit as (
    select lr, le from uniques where le in (select le from uniques group by le having count(*) = 1)
  )
  update lignes_releve r set ligne_ecriture_id = s.le, pointee_le = now()
  from sans_conflit s where r.id = s.lr;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ============================================================
-- Comptabiliser une ligne du relevé absente des livres (frais bancaires, agios, virement reçu non saisi…)
-- { ligne_releve_id, contrepartie_compte_id, libelle?, departement_id?, secteur_id?, campagne_id? }
-- Crée l'opération de trésorerie correspondante puis pointe la ligne sur l'écriture créée.
-- ============================================================
create or replace function comptabiliser_ligne(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_lr lignes_releve%rowtype;
  v_ct uuid;
  v_compte uuid;
  v_op uuid;
  v_le uuid;
begin
  if v_org is null or not has_role('admin', 'comptable') then
    raise exception 'Droits insuffisants';
  end if;
  select * into v_lr from lignes_releve where id = (p ->> 'ligne_releve_id')::uuid and organisation_id = v_org for update;
  if not found then raise exception 'Ligne de relevé introuvable'; end if;
  if v_lr.ligne_ecriture_id is not null then raise exception 'Cette ligne est déjà pointée'; end if;
  select b.compte_tresorerie_id, c.compte_id into v_ct, v_compte
    from releves_bancaires b join comptes_tresorerie c on c.id = b.compte_tresorerie_id where b.id = v_lr.releve_id;

  v_op := enregistrer_operation_tresorerie(jsonb_build_object(
    'date', v_lr.date_operation,
    'sens', case when v_lr.montant > 0 then 'encaissement' else 'decaissement' end,
    'montant', abs(v_lr.montant),
    'compte_tresorerie_id', v_ct,
    'contrepartie_compte_id', p ->> 'contrepartie_compte_id',
    'libelle', coalesce(nullif(trim(p ->> 'libelle'), ''), v_lr.libelle),
    'departement_id', p ->> 'departement_id',
    'secteur_id', p ->> 'secteur_id',
    'campagne_id', p ->> 'campagne_id'));

  select l.id into v_le
    from ecritures e join lignes_ecritures l on l.ecriture_id = e.id
    where e.organisation_id = v_org and e.source_module = 'operations_tresorerie' and e.source_id = v_op
      and l.compte_id = v_compte;
  update lignes_releve set ligne_ecriture_id = v_le, pointee_le = now() where id = v_lr.id;
  return v_op;
end $$;

-- ============================================================
-- Sécurité
-- ============================================================
alter table releves_bancaires enable row level security;
alter table lignes_releve enable row level security;
create policy rb_select on releves_bancaires for select using (organisation_id = current_org_id());
create policy lr_select on lignes_releve for select using (organisation_id = current_org_id());

revoke execute on function
  importer_releve(jsonb), pointer_ligne(jsonb), depointer_ligne(jsonb),
  pointer_automatiquement(jsonb), comptabiliser_ligne(jsonb)
from public, anon;
grant execute on function
  importer_releve(jsonb), pointer_ligne(jsonb), depointer_ligne(jsonb),
  pointer_automatiquement(jsonb), comptabiliser_ligne(jsonb)
to authenticated;
