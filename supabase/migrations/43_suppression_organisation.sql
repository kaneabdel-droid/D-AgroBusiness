-- Suppression définitive d'une entreprise par le super-admin (inscriptions jamais payées, comptes de test).
--
-- Une simple suppression de la ligne `organisations` échoue : la plupart des tables la référencent en ON DELETE RESTRICT,
-- et les écritures, mouvements, règlements… sont protégés par des déclencheurs d'immuabilité. supprimer_organisation()
-- efface donc toutes les tables portant organisation_id, par passes successives (une table encore référencée par une
-- autre est retentée à la passe suivante), puis l'organisation elle-même.
--
-- Les garde-fous d'immuabilité ne s'effacent que pour CETTE organisation et pendant CETTE transaction : la fonction pose
-- le réglage local `dagro.suppression_organisation` (set_config(..., true)), que ni un utilisateur ni l'API REST ne peuvent
-- poser. Toute autre modification reste refusée comme avant.
--
-- Réservée au service_role (actions serveur de l'espace /admin). Renvoie les identifiants des utilisateurs de
-- l'organisation : l'appelant supprime ensuite leurs comptes auth.users.

create or replace function suppression_organisation_autorisee(p_organisation uuid) returns boolean
language sql stable as $$
  select coalesce(current_setting('dagro.suppression_organisation', true), '') = p_organisation::text
$$;

create or replace function interdire_modification() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and suppression_organisation_autorisee(old.organisation_id) then return old; end if;
  raise exception 'Les écritures comptables sont immuables : utilisez une contre-passation (table %)', tg_table_name;
end $$;

create or replace function interdire_modification_doc() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and suppression_organisation_autorisee(old.organisation_id) then return old; end if;
  raise exception 'Enregistrement immuable (table %) : passez une opération inverse', tg_table_name;
end $$;

-- Identique à 09_pilotage.sql, sauf la première ligne : les lignes d'un budget approuvé partent avec leur organisation.
create or replace function budget_ligne_controle() returns trigger
language plpgsql as $$
declare
  v_statut text;
  v_classe smallint;
  v_dep uuid;
begin
  if tg_op = 'DELETE' and suppression_organisation_autorisee(old.organisation_id) then return old; end if;
  select statut into v_statut from budgets where id = coalesce(new.budget_id, old.budget_id);
  if v_statut = 'approuve' then
    raise exception 'Budget approuvé : les lignes ne sont plus modifiables';
  end if;
  if tg_op = 'DELETE' then return old; end if;

  select classe into v_classe from comptes_comptables where id = new.compte_id and organisation_id = new.organisation_id;
  if v_classe is null or v_classe not in (6, 7) then
    raise exception 'Un budget porte sur des comptes de charges (6) ou de produits (7)';
  end if;
  if new.secteur_id is not null then
    select departement_id into v_dep from secteurs_projets where id = new.secteur_id and organisation_id = new.organisation_id;
    if v_dep is distinct from new.departement_id then
      raise exception 'Le secteur/projet n''appartient pas au département choisi';
    end if;
  end if;
  return new;
end $$;

create or replace function supprimer_organisation(p_organisation uuid) returns uuid[]
language plpgsql security definer set search_path = public as $$
declare
  v_demo boolean;
  v_utilisateurs uuid[];
  v_tables text[];
  v_table text;
  v_lignes bigint;
  v_bloquees int;
  v_progres boolean;
  v_passe int := 0;
begin
  select demo into v_demo from organisations where id = p_organisation;
  if not found then raise exception 'Entreprise introuvable'; end if;
  if v_demo then raise exception 'L’organisation de démonstration ne peut pas être supprimée'; end if;

  select coalesce(array_agg(id), '{}') into v_utilisateurs from utilisateurs where organisation_id = p_organisation;
  perform set_config('dagro.suppression_organisation', p_organisation::text, true);

  -- journal_audit n'a pas de clé étrangère : vidé en dernier (les suppressions ci-dessous y écrivent encore).
  select array_agg(c.table_name::text order by c.table_name) into v_tables
  from information_schema.columns c
  join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public' and c.column_name = 'organisation_id' and t.table_type = 'BASE TABLE'
    and c.table_name not in ('organisations', 'journal_audit');

  loop
    v_passe := v_passe + 1;
    v_bloquees := 0;
    v_progres := false;
    foreach v_table in array v_tables loop
      begin
        execute format('delete from public.%I where organisation_id = $1', v_table) using p_organisation;
        get diagnostics v_lignes = row_count;
        if v_lignes > 0 then v_progres := true; end if;
      exception when foreign_key_violation then
        v_bloquees := v_bloquees + 1;   -- encore référencée par une table pas encore vidée : retentée à la passe suivante
      end;
    end loop;
    exit when v_bloquees = 0;
    if not v_progres or v_passe >= 100 then
      raise exception 'Suppression impossible : % table(s) restent liées à cette entreprise', v_bloquees;
    end if;
  end loop;

  delete from organisations where id = p_organisation;
  delete from journal_audit where organisation_id = p_organisation;
  return v_utilisateurs;
end $$;

revoke execute on function supprimer_organisation(uuid) from public, anon, authenticated;
grant execute on function supprimer_organisation(uuid) to service_role;
