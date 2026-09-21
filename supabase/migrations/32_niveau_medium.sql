-- D-AGROBUSINESS — Troisième niveau d'abonnement : Medium.
-- Standard : sans l'usine de transformation ni les ressources humaines ; Medium : tout sauf les ressources humaines ; Premium : tout.
-- Les organisations existantes sont Premium : rien ne change pour elles.

alter table organisations drop constraint if exists organisations_niveau_check;
alter table organisations add constraint organisations_niveau_check check (niveau in ('standard', 'medium', 'premium'));

alter table abonnement_paiements drop constraint if exists abonnement_paiements_niveau_check;
alter table abonnement_paiements add constraint abonnement_paiements_niveau_check check (niveau in ('standard', 'medium', 'premium'));

-- Durées vendues : 1, 6 et 12 mois
alter table abonnement_paiements drop constraint if exists abonnement_paiements_mois_check;
alter table abonnement_paiements add constraint abonnement_paiements_mois_check check (mois in (1, 6, 12));

-- L'usine de transformation exige le niveau Medium ou Premium (l'essai donne l'accès Premium).
create or replace function acces_usine(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_org is null or exists (
    select 1 from organisations o where o.id = p_org and o.niveau in ('medium', 'premium') and abonnement_actif(o.id)
  )
$$;

create or replace function garde_usine() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not acces_usine(case when tg_op = 'DELETE' then old.organisation_id else new.organisation_id end) then
    raise exception 'Cette fonction est réservée aux abonnements Medium et Premium';
  end if;
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['nomenclatures', 'nomenclature_sorties', 'ordres_fabrication', 'of_sorties'] loop
    execute format('create policy acces_usine on %I as restrictive for all using (acces_usine(organisation_id)) with check (acces_usine(organisation_id))', t);
    -- garde pour les écritures faites par la fonction métier (security definer) : lancement d'une transformation
    execute format('create trigger garde_usine before insert or update or delete on %I for each row execute function garde_usine()', t);
  end loop;
end $$;

revoke execute on function acces_usine(uuid), garde_usine() from public, anon;
grant execute on function acces_usine(uuid) to authenticated;
