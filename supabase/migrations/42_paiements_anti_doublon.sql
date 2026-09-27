-- Anti double paiement d'abonnement.
--
-- 1. checkout_url : la page de paiement du prestataire est mémorisée pour être renvoyée telle quelle si le client relance le
--    même paiement (double clic, second onglet, retour arrière) au lieu d'ouvrir une seconde transaction.
-- 2. abandonne_le : une tentative en attente remplacée par une nouvelle reste 'pending' (si elle est finalement payée, l'argent
--    n'est pas perdu : elle est traitée, et marquée doublon si l'offre venait d'être réglée) mais ne compte plus comme « le »
--    paiement en cours de l'organisation.
-- 3. doublon : paiement encaissé alors que la même offre venait d'être réglée par une autre tentative. Il ne prolonge pas
--    l'abonnement, est exclu du chiffre d'affaires et signalé à rembourser dans /admin/paiements.
alter table abonnement_paiements
  add column if not exists checkout_url text,
  add column if not exists abandonne_le timestamptz,
  add column if not exists doublon boolean not null default false;

-- Existant : ne garder que la tentative en attente la plus récente de chaque organisation (sinon l'index unique échoue).
update abonnement_paiements a
set abandonne_le = now()
where a.statut = 'pending'
  and a.abandonne_le is null
  and a.provider <> 'manuel'
  and exists (
    select 1 from abonnement_paiements r
    where r.organisation_id = a.organisation_id
      and r.statut = 'pending'
      and r.abandonne_le is null
      and r.provider <> 'manuel'
      and (r.created_at, r.id) > (a.created_at, a.id)
  );

-- Un seul paiement en ligne en cours par organisation : protège contre deux requêtes simultanées (double clic, deux onglets).
-- Les prolongations manuelles de l'admin (provider 'manuel', finalisées aussitôt) n'entrent pas en jeu.
create unique index if not exists abonnement_paiements_un_en_cours_par_org
  on abonnement_paiements (organisation_id)
  where statut = 'pending' and abandonne_le is null and provider <> 'manuel';

-- Finalisation : identique à 31_abonnements.sql, plus le filet anti doublon. La ligne de l'organisation est verrouillée AVANT
-- le contrôle pour sérialiser deux finalisations concurrentes : la seconde voit forcément la première.
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

    -- Une autre tentative pour le même niveau a été payée depuis la création de celle-ci (le client a réglé deux pages de
    -- paiement ouvertes en parallèle) : encaissé, mais sans seconde prolongation.
    if v.provider <> 'manuel' and exists (
      select 1 from abonnement_paiements p
      where p.organisation_id = v.organisation_id
        and p.niveau = v.niveau
        and p.statut = 'completed'
        and not p.doublon
        and p.provider <> 'manuel'
        and p.id <> v.id
        and p.updated_at >= v.created_at
    ) then
      update abonnement_paiements set doublon = true where id = v.id;
      return 'doublon';
    end if;

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
