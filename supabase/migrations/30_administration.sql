-- D-AGROBUSINESS — Administration : équipe, invitations, journal d'audit.
-- Un administrateur invite une personne par son email avec un rôle ; à son inscription (sans nom d'entreprise), la personne
-- rejoint automatiquement l'organisation. L'équipe se gère depuis l'application (rôle, activation) sans jamais retirer le dernier administrateur.

create table invitations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  email text not null check (email = lower(email) and email like '%_@_%.__%'),
  role role_utilisateur not null,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'acceptee', 'annulee')),
  invite_par uuid default auth.uid(),
  created_at timestamptz not null default now(),
  acceptee_le timestamptz
);
-- une adresse ne peut avoir qu'une invitation en attente (toutes organisations confondues) : le rattachement reste sans ambiguïté
create unique index invitations_une_en_attente on invitations (email) where statut = 'en_attente';
create index on invitations (organisation_id);

alter table invitations enable row level security;
create policy invitations_select on invitations for select
  using (organisation_id = current_org_id() and has_role('admin'));

create trigger audit_invitations after insert or update or delete on invitations
  for each row execute function audit_trigger();

-- ============================================================
-- Garde-fou : une organisation garde toujours au moins un administrateur actif
-- ============================================================
create or replace function garder_un_administrateur() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and old.actif and (new.role <> 'admin' or not new.actif) then
    if not exists (
      select 1 from utilisateurs
      where organisation_id = old.organisation_id and id <> old.id and role = 'admin' and actif
    ) then
      raise exception 'Il doit rester au moins un administrateur actif';
    end if;
  end if;
  return new;
end $$;

create trigger utilisateurs_dernier_admin before update on utilisateurs
  for each row execute function garder_un_administrateur();

-- ============================================================
-- Rattachement à l'inscription (remplace la version de 26_gambie.sql : seule la branche « invité » change)
-- ============================================================
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_pays text := upper(coalesce(new.raw_user_meta_data ->> 'pays', 'SN'));
  v_ref referentiel_comptable;
  v_devise text;
  v_inv invitations%rowtype;
begin
  if new.raw_user_meta_data ->> 'organisation_nom' is null then
    -- inscription sans nom d'entreprise : la personne rejoint l'organisation qui l'a invitée
    select * into v_inv from invitations where email = lower(new.email) and statut = 'en_attente';
    if found then
      insert into utilisateurs (id, organisation_id, nom_complet, role)
        values (new.id, v_inv.organisation_id, new.raw_user_meta_data ->> 'nom_complet', v_inv.role);
      update invitations set statut = 'acceptee', acceptee_le = now() where id = v_inv.id;
    end if;
    return new;
  end if;

  v_ref := case v_pays when 'MA' then 'PCM_MA' when 'MR' then 'PCM_MR' when 'GH' then 'IFRS_GH' when 'NG' then 'IFRS_NG' when 'GM' then 'IFRS_GM' else 'SYSCOHADA' end;
  v_devise := case v_pays when 'MA' then 'MAD' when 'MR' then 'MRU' when 'GH' then 'GHS' when 'GN' then 'GNF' when 'NG' then 'NGN' when 'GM' then 'GMD' else 'XOF' end;

  insert into organisations (nom, pays, devise, referentiel)
    values (new.raw_user_meta_data ->> 'organisation_nom', v_pays, v_devise, v_ref)
    returning id into v_org;

  insert into utilisateurs (id, organisation_id, nom_complet, role)
    values (new.id, v_org, new.raw_user_meta_data ->> 'nom_complet', 'admin');

  perform initialiser_organisation(v_org);
  return new;
end $$;

-- ============================================================
-- RPC (administrateur de l'organisation)
-- ============================================================
-- Équipe avec adresses email (auth.users n'est pas lisible depuis l'application)
create or replace function liste_equipe()
returns table (id uuid, nom_complet text, email text, role role_utilisateur, actif boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if current_org_id() is null or not has_role('admin') then
    raise exception 'Droits insuffisants';
  end if;
  return query
    select u.id, u.nom_complet, a.email::text, u.role, u.actif, u.created_at
    from utilisateurs u join auth.users a on a.id = u.id
    where u.organisation_id = current_org_id()
    order by u.created_at;
end $$;

-- { email, role }
create or replace function inviter_utilisateur(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_email text := lower(trim(p ->> 'email'));
  v_role role_utilisateur;
  v_id uuid := gen_random_uuid();
begin
  if v_org is null or not has_role('admin') then
    raise exception 'Droits insuffisants';
  end if;
  begin
    v_role := (p ->> 'role')::role_utilisateur;
  exception when others then
    raise exception 'Rôle invalide';
  end;
  if v_email is null or v_email not like '%_@_%.__%' then raise exception 'Adresse email invalide'; end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Cette adresse a déjà un compte : elle ne peut pas être invitée';
  end if;
  if exists (select 1 from invitations where email = v_email and statut = 'en_attente') then
    raise exception 'Cette adresse a déjà une invitation en attente';
  end if;
  insert into invitations (id, organisation_id, email, role) values (v_id, v_org, v_email, v_role);
  return v_id;
end $$;

-- { id }
create or replace function annuler_invitation(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if current_org_id() is null or not has_role('admin') then
    raise exception 'Droits insuffisants';
  end if;
  update invitations set statut = 'annulee'
    where id = (p ->> 'id')::uuid and organisation_id = current_org_id() and statut = 'en_attente';
  if not found then raise exception 'Invitation introuvable'; end if;
end $$;

-- { utilisateur_id, role?, actif? }
create or replace function modifier_utilisateur(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_id uuid := (p ->> 'utilisateur_id')::uuid;
begin
  if v_org is null or not has_role('admin') then
    raise exception 'Droits insuffisants';
  end if;
  if not exists (select 1 from utilisateurs where id = v_id and organisation_id = v_org) then
    raise exception 'Utilisateur introuvable';
  end if;
  if p ? 'role' then
    begin
      update utilisateurs set role = (p ->> 'role')::role_utilisateur where id = v_id;
    exception when invalid_text_representation then
      raise exception 'Rôle invalide';
    end;
  end if;
  if p ? 'actif' then
    update utilisateurs set actif = (p ->> 'actif')::boolean where id = v_id;
  end if;
end $$;

-- Utilisée avant l'inscription (utilisateur non connecté) : une invitation attend-elle cette adresse ?
create or replace function invitation_en_attente(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from invitations where email = lower(trim(p_email)) and statut = 'en_attente')
$$;

revoke execute on function garder_un_administrateur() from public, anon, authenticated;
revoke execute on function
  liste_equipe(), inviter_utilisateur(jsonb), annuler_invitation(jsonb), modifier_utilisateur(jsonb)
from public, anon;
grant execute on function
  liste_equipe(), inviter_utilisateur(jsonb), annuler_invitation(jsonb), modifier_utilisateur(jsonb)
to authenticated;
grant execute on function invitation_en_attente(text) to anon, authenticated;
