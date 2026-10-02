-- D-AGROBUSINESS — Prestations du matériel : pointage sur le terrain et exécution budgétaire.
--
-- Chaque prestation (labour, moisson, nivellement, terrassement…) est pointée dans son unité de travail : hectares
-- (tracteur, moissonneuse), heures (niveleuse, pelle), sacs (moissonneuse payée en part de récolte) ou une autre unité
-- libre. Le pointeur renseigne la quantité traitée, la quantité obtenue (récolte) avec son produit et, quand le produit
-- l'exige (produits.variete_obligatoire), sa variété, ainsi que le téléphone du client.
--
-- Paiement en part de récolte : part_quantite = quantite_obtenue × taux_part / 100 (colonne calculée) ; le montant est
-- la valorisation de cette part (part × prix_unitaire_part), proposée par le formulaire.
--
-- Exécution budgétaire : le réalisé des budgets vient des écritures (v_suivi_budget). Chaque prestation d'un montant
-- non nul est donc comptabilisée comme une facture de service, au journal des ventes :
--   Dr Clients (tiers = client)  /  Cr Ventes de services (département et secteur du matériel, campagne de la prestation)
-- La créance se solde comme les autres : règlement en espèces, ou remboursement en nature pour une part de récolte.
-- Une modification contre-passe l'écriture puis la repasse ; une suppression la contre-passe.
-- Un client occasionnel (nom + téléphone) est enregistré comme tiers client, retrouvé ensuite par son téléphone.

alter table produits add column if not exists variete_obligatoire boolean not null default false;

create table prestations_materiel (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  numero text not null,
  materiel_id uuid not null references materiels(id) on delete restrict,
  campagne_id uuid references campagnes(id) on delete restrict,
  date_prestation date not null,
  type_prestation text not null,
  client_id uuid not null references tiers(id) on delete restrict,
  client_nom text,
  client_telephone text not null check (length(regexp_replace(client_telephone, '\D', '', 'g')) >= 7),
  unite text not null default 'ha' check (unite in ('ha', 'h', 'sac', 'autre')),
  unite_autre text,
  quantite_traitee numeric(14,2) not null check (quantite_traitee > 0),
  tarif_unitaire numeric(18,2) check (tarif_unitaire >= 0),
  produit_id uuid references produits(id) on delete restrict,
  variete text,
  quantite_obtenue numeric(14,2) check (quantite_obtenue >= 0),
  unite_obtenue text,
  mode_paiement text not null default 'especes' check (mode_paiement in ('especes', 'part_recolte')),
  taux_part numeric(5,2) check (taux_part > 0 and taux_part <= 100),
  prix_unitaire_part numeric(18,2) check (prix_unitaire_part >= 0),
  part_quantite numeric(14,2) generated always as (
    case when mode_paiement = 'part_recolte' then round(coalesce(quantite_obtenue, 0) * coalesce(taux_part, 0) / 100, 2) end
  ) stored,
  montant numeric(18,2) not null default 0 check (montant >= 0),
  ecriture_id uuid references ecritures(id) on delete restrict,
  pointe_par uuid default auth.uid() references utilisateurs(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organisation_id, numero),
  check (unite <> 'autre' or nullif(trim(unite_autre), '') is not null),
  check (mode_paiement <> 'part_recolte' or (quantite_obtenue > 0 and taux_part is not null))
);

create index on prestations_materiel (organisation_id, date_prestation desc);
create index on prestations_materiel (materiel_id);
create index on prestations_materiel (produit_id);
create index on prestations_materiel (client_id);
create index on prestations_materiel (campagne_id);

-- Écriture de la prestation : Dr Clients / Cr Ventes de services, imputée au département et au secteur du matériel.
create or replace function ecriture_prestation_materiel(p prestations_materiel) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_mat materiels%rowtype;
  v_libelle text;
begin
  if p.montant <= 0 then return null; end if;
  select * into v_mat from materiels where id = p.materiel_id and organisation_id = p.organisation_id;
  v_libelle := 'Prestation ' || p.numero || ' — ' || p.type_prestation || ' (' || v_mat.code || ')';
  return ecrire_interne(
    p.organisation_id, journal_de_type(p.organisation_id, 'ventes'), p.date_prestation, v_libelle, p.numero,
    jsonb_build_array(
      ec_ligne(param_compte(p.organisation_id, 'clients'), p.montant, 0, p.client_id, null, null, p.campagne_id, v_libelle),
      ec_ligne(compte_categorie(p.organisation_id, 'service', 'vente'), 0, p.montant, null, v_mat.departement_id, v_mat.secteur_id, p.campagne_id, v_libelle)
    ),
    'prestations_materiel', p.id, null);
end $$;

-- Contre-passation d'une écriture de prestation (même date que l'écriture d'origine).
create or replace function contrepasser_prestation_materiel(p_ecriture uuid, p_motif text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ecr ecritures%rowtype;
  v_lignes jsonb;
begin
  if p_ecriture is null then return; end if;
  select * into v_ecr from ecritures where id = p_ecriture;
  select jsonb_agg(jsonb_build_object(
      'compte_id', compte_id, 'tiers_id', tiers_id, 'libelle', libelle, 'debit', credit, 'credit', debit,
      'departement_id', departement_id, 'secteur_id', secteur_id, 'campagne_id', campagne_id))
    into v_lignes from lignes_ecritures where ecriture_id = p_ecriture;
  perform ecrire_interne(v_ecr.organisation_id, v_ecr.journal_id, v_ecr.date_ecriture,
    'Contre-passation écr. n°' || v_ecr.numero || ' — ' || p_motif, v_ecr.reference_piece, v_lignes,
    v_ecr.source_module, v_ecr.source_id, p_ecriture);
end $$;

create or replace function prestation_materiel_avant() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_tel text;
begin
  if tg_op = 'DELETE' then
    -- Suppression de l'organisation entière : ses écritures partent avec elle, rien à contre-passer.
    if suppression_organisation_autorisee(old.organisation_id) then return old; end if;
    perform contrepasser_prestation_materiel(old.ecriture_id, 'suppression de la prestation ' || old.numero);
    return old;
  end if;

  perform assert_org('materiels', new.materiel_id, new.organisation_id);
  if new.campagne_id is not null then perform assert_org('campagnes', new.campagne_id, new.organisation_id); end if;

  -- Variété obligatoire : contrôlée aussi en base, pour toute saisie (formulaire, import, API).
  if new.produit_id is null then
    new.variete := null;
  elsif nullif(trim(coalesce(new.variete, '')), '') is null
        and exists (select 1 from produits where id = new.produit_id and organisation_id = new.organisation_id and variete_obligatoire) then
    raise exception 'Ce produit exige de préciser la variété.';
  end if;

  -- Client occasionnel : retrouvé par son téléphone, sinon enregistré comme tiers client.
  if new.client_id is null then
    if nullif(trim(coalesce(new.client_nom, '')), '') is null then raise exception 'Indiquez le client.'; end if;
    v_tel := regexp_replace(new.client_telephone, '\D', '', 'g');
    select id into new.client_id from tiers
      where organisation_id = new.organisation_id and regexp_replace(coalesce(telephone, ''), '\D', '', 'g') = v_tel
      order by created_at limit 1;
    if new.client_id is null then
      insert into tiers (organisation_id, code, nom, types, telephone)
        values (new.organisation_id, prochain_numero(new.organisation_id, 'client_prestation', 'CLP', new.date_prestation),
                trim(new.client_nom), '{client}', new.client_telephone)
        returning id into new.client_id;
    end if;
  else
    perform assert_org('tiers', new.client_id, new.organisation_id);
    if nullif(trim(coalesce(new.client_nom, '')), '') is null then
      select nom into new.client_nom from tiers where id = new.client_id;
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.numero := prochain_numero(new.organisation_id, 'prestation_materiel', 'PRE', new.date_prestation);
    new.ecriture_id := ecriture_prestation_materiel(new);
    return new;
  end if;

  -- Modification : l'écriture ne change que si un élément comptable change.
  new.numero := old.numero;
  if (new.montant, new.client_id, new.campagne_id, new.materiel_id, new.date_prestation, new.type_prestation)
     is distinct from (old.montant, old.client_id, old.campagne_id, old.materiel_id, old.date_prestation, old.type_prestation) then
    perform contrepasser_prestation_materiel(old.ecriture_id, 'modification de la prestation ' || old.numero);
    new.ecriture_id := ecriture_prestation_materiel(new);
  else
    new.ecriture_id := old.ecriture_id;
  end if;
  return new;
end $$;

create trigger prestations_materiel_avant before insert or update or delete on prestations_materiel
  for each row execute function prestation_materiel_avant();

create trigger audit_prestations_materiel after insert or update or delete on prestations_materiel
  for each row execute function audit_trigger();

revoke execute on function ecriture_prestation_materiel(prestations_materiel), contrepasser_prestation_materiel(uuid, text)
  from public, anon, authenticated;

alter table prestations_materiel enable row level security;
create policy pm_select on prestations_materiel for select using (organisation_id = current_org_id());
create policy pm_write on prestations_materiel for all
  using (organisation_id = current_org_id() and has_role('admin', 'direction', 'comptable', 'chef_departement'))
  with check (organisation_id = current_org_id());
