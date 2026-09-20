-- D-AGROBUSINESS — Abonnements (Standard / Premium) et paiements.
-- Standard : tout sauf les ressources humaines (personnel, pointage, congés, paie, bulletins). Premium : accès complet.
-- Chaque organisation démarre par 7 jours d'essai avec l'accès Premium ; ensuite l'accès exige un abonnement payé.
-- Les paiements (Bictorys, Moneroo, Chariow) sont créés et confirmés par le serveur uniquement (clé de service) : un utilisateur ne peut
-- ni se donner un abonnement ni modifier ses dates d'échéance.

alter table organisations
  add column niveau text not null default 'premium' check (niveau in ('standard', 'premium')),
  add column essai_expire_le timestamptz not null default (now() + interval '7 days'),
  add column abonnement_expire_le timestamptz,
  add column compte_verrouille boolean not null default false;

-- Organisations déjà créées : accès Premium complet pendant un an (aucun client payant n'existe encore).
update organisations set abonnement_expire_le = now() + interval '1 year';

-- Seul le serveur (clé de service, ou SQL Editor) modifie l'abonnement d'une organisation, jamais un utilisateur connecté.
create or replace function proteger_abonnement() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and (
       new.niveau is distinct from old.niveau
    or new.essai_expire_le is distinct from old.essai_expire_le
    or new.abonnement_expire_le is distinct from old.abonnement_expire_le
    or new.compte_verrouille is distinct from old.compte_verrouille
  ) then
    raise exception 'L’abonnement ne peut pas être modifié directement';
  end if;
  return new;
end $$;

create trigger organisations_proteger_abonnement before update on organisations
  for each row execute function proteger_abonnement();

-- ============================================================
-- Paiements
-- ============================================================
create table abonnement_paiements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  niveau text not null check (niveau in ('standard', 'premium')),
  mois integer not null check (mois in (1, 3, 6, 12)),
  montant numeric(18,0) not null check (montant > 0),
  devise text not null default 'XOF',
  provider text not null check (provider in ('bictorys', 'moneroo', 'chariow')),
  moyen_paiement text not null check (moyen_paiement in ('wave', 'orange', 'carte', 'chariow')),
  provider_reference text,
  statut text not null default 'pending' check (statut in ('pending', 'completed', 'failed')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- une seule ligne par transaction distante : les webhooks peuvent être renvoyés plusieurs fois
create unique index abonnement_paiements_reference on abonnement_paiements (provider, provider_reference)
  where provider_reference is not null;
create index on abonnement_paiements (organisation_id, created_at desc);

alter table abonnement_paiements enable row level security;
create policy paiements_select on abonnement_paiements for select
  using (organisation_id = current_org_id() and has_role('admin', 'comptable', 'direction'));

-- Dédoublonnage des webhooks : aucune policy, seule la clé de service y accède.
create table paiement_webhook_events (
  provider text not null,
  event_hash text not null,
  created_at timestamptz not null default now(),
  primary key (provider, event_hash)
);
alter table paiement_webhook_events enable row level security;

-- ============================================================
-- Application d'un paiement (appelée par le serveur uniquement)
-- Transition unique pending → completed/failed ; un paiement abouti prolonge l'abonnement de « mois » mois à partir de
-- l'échéance actuelle (ou de maintenant si elle est dépassée).
-- ============================================================
create or replace function finaliser_paiement_abonnement(p_paiement uuid, p_statut text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v abonnement_paiements%rowtype;
  o organisations%rowtype;
begin
  if p_statut not in ('completed', 'failed') then raise exception 'Statut invalide'; end if;
  update abonnement_paiements set statut = p_statut, updated_at = now()
    where id = p_paiement and statut = 'pending' returning * into v;
  if not found then return 'deja_traite'; end if;

  if p_statut = 'completed' then
    select * into o from organisations where id = v.organisation_id for update;
    update organisations set
      niveau = v.niveau,
      abonnement_expire_le = (
        case when o.niveau = v.niveau and o.abonnement_expire_le is not null and o.abonnement_expire_le > now()
             then o.abonnement_expire_le else now() end
      ) + make_interval(months => v.mois)
    where id = v.organisation_id;
  end if;
  return 'ok';
end $$;

revoke execute on function finaliser_paiement_abonnement(uuid, text) from public, anon, authenticated;
grant execute on function finaliser_paiement_abonnement(uuid, text) to service_role;

-- ============================================================
-- Droits d'accès
-- ============================================================
create or replace function abonnement_actif(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organisations o
    where o.id = p_org and not o.compte_verrouille
      and greatest(o.essai_expire_le, coalesce(o.abonnement_expire_le, o.essai_expire_le)) > now()
  )
$$;

-- Les ressources humaines exigent le niveau Premium (ou l'essai) ; les lignes partagées sans organisation restent lisibles.
create or replace function acces_rh(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_org is null or exists (
    select 1 from organisations o where o.id = p_org and o.niveau = 'premium' and abonnement_actif(o.id)
  )
$$;

create or replace function garde_rh() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- les traitements système (création d'organisation, SQL Editor) n'ont pas d'utilisateur connecté
  if auth.uid() is not null and not acces_rh(case when tg_op = 'DELETE' then old.organisation_id else new.organisation_id end) then
    raise exception 'Cette fonction est réservée à l’abonnement Premium';
  end if;
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'employes', 'contrats_travail', 'pointages', 'demandes_conge', 'parametrage_paie', 'baremes_retenue', 'regles_paie',
    'bareme_ir', 'reductions_famille', 'tranches_forfaitaires', 'periodes_paie', 'bulletins_paie', 'bulletins_lignes',
    'bulletins_imputations'
  ] loop
    -- policy restrictive : s'ajoute (ET) aux policies existantes, en lecture comme en écriture
    execute format('create policy acces_rh on %I as restrictive for all using (acces_rh(organisation_id)) with check (acces_rh(organisation_id))', t);
    -- garde pour les écritures faites par les fonctions métier (security definer) : calcul, validation, paiement des salaires
    execute format('create trigger garde_rh before insert or update or delete on %I for each row execute function garde_rh()', t);
  end loop;
end $$;

revoke execute on function abonnement_actif(uuid), acces_rh(uuid), garde_rh() from public, anon;
grant execute on function abonnement_actif(uuid), acces_rh(uuid) to authenticated;
