-- D-AGROBUSINESS — Phase 3 : production agricole propre et usine de transformation.
--
-- Production : une « production » = un secteur/projet × une campagne. Son coût de production est lu
-- dans la comptabilité analytique (toutes les charges de classe 6 imputées à ce secteur et cette
-- campagne : intrants consommés, dotations du matériel affecté, main-d'œuvre, services…).
-- La récolte est valorisée par défaut au coût de production restant à absorber.
--
-- Usine : un ordre de fabrication consomme une matière première (stock propre, CUMP) et produit des
-- produits finis et sous-produits ; la valeur totale (matière + frais imputés) est répartie entre
-- les sorties au prorata de leur valeur de marché (quantité × prix de référence).

-- ============================================================
-- Production
-- ============================================================
create table productions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  code text not null,
  secteur_id uuid not null references secteurs_projets(id) on delete restrict,
  campagne_id uuid not null references campagnes(id) on delete restrict,
  produit_id uuid not null references produits(id) on delete restrict,       -- culture / produit attendu
  superficie_ha numeric(12,2) check (superficie_ha > 0),
  date_semis date,
  date_recolte_prevue date,
  statut text not null default 'en_cours' check (statut in ('en_cours', 'recoltee', 'cloturee')),
  created_at timestamptz not null default now(),
  unique (organisation_id, code),
  unique (secteur_id, campagne_id)
);

create table consommations_production (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  production_id uuid not null references productions(id) on delete restrict,
  date_consommation date not null,
  magasin_id uuid not null references magasins(id) on delete restrict,
  produit_id uuid not null references produits(id) on delete restrict,
  quantite numeric(18,3) not null check (quantite > 0),
  valeur numeric(18,2) not null,
  created_at timestamptz not null default now()
);

create table recoltes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  numero text not null,
  production_id uuid not null references productions(id) on delete restrict,
  date_recolte date not null,
  magasin_id uuid not null references magasins(id) on delete restrict,
  produit_id uuid not null references produits(id) on delete restrict,
  quantite numeric(18,3) not null check (quantite > 0),
  valeur numeric(18,2) not null check (valeur >= 0),
  observation text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (organisation_id, numero)
);

-- ============================================================
-- Usine : nomenclatures et ordres de fabrication
-- ============================================================
create table nomenclatures (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  code text not null,
  libelle text not null,
  matiere_id uuid not null references produits(id) on delete restrict,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organisation_id, code)
);

create table nomenclature_sorties (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  nomenclature_id uuid not null references nomenclatures(id) on delete cascade,
  produit_id uuid not null references produits(id) on delete restrict,
  rendement_pct numeric(6,2) not null check (rendement_pct > 0 and rendement_pct <= 100),
  principal boolean not null default false,
  unique (nomenclature_id, produit_id)
);

create table ordres_fabrication (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  numero text not null,
  date_of date not null,
  nomenclature_id uuid not null references nomenclatures(id) on delete restrict,
  magasin_source_id uuid not null references magasins(id) on delete restrict,
  magasin_destination_id uuid not null references magasins(id) on delete restrict,
  departement_id uuid not null references departements(id) on delete restrict,
  campagne_id uuid references campagnes(id) on delete restrict,
  quantite_matiere numeric(18,3) not null check (quantite_matiere > 0),
  cout_matiere numeric(18,2) not null,
  frais_imputes numeric(18,2) not null default 0 check (frais_imputes >= 0),
  valeur_totale numeric(18,2) not null,
  observation text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (organisation_id, numero)
);

create table of_sorties (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  of_id uuid not null references ordres_fabrication(id) on delete restrict,
  produit_id uuid not null references produits(id) on delete restrict,
  quantite numeric(18,3) not null check (quantite > 0),
  valeur numeric(18,2) not null,
  rendement_reel_pct numeric(7,2) not null
);

create index on consommations_production (production_id);
create index on recoltes (production_id);
create index on of_sorties (of_id);

create trigger consommations_prod_immuables before update or delete on consommations_production
  for each row execute function interdire_modification_doc();
create trigger recoltes_immuables before update or delete on recoltes
  for each row execute function interdire_modification_doc();
create trigger of_immuables before update or delete on ordres_fabrication
  for each row execute function interdire_modification_doc();
create trigger of_sorties_immuables before update or delete on of_sorties
  for each row execute function interdire_modification_doc();

-- ============================================================
-- Consommation d'intrants par une production
-- payload : { production_id, date, magasin_id, lignes: [{ produit_id, quantite }] }
-- Sortie de stock au CUMP ; charge imputée au département, au secteur et à la campagne de la production.
-- ============================================================
create or replace function consommer_intrants_production(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_date date := (p ->> 'date')::date;
  v_mag uuid := (p ->> 'magasin_id')::uuid;
  v_prod productions%rowtype;
  v_sec secteurs_projets%rowtype;
  v_ligne jsonb;
  v_produit produits%rowtype;
  v_qte numeric;
  v_valeur numeric;
  v_ec jsonb := '[]'::jsonb;
begin
  if v_org is null or not has_role('admin', 'comptable', 'chef_departement') then
    raise exception 'Droits insuffisants';
  end if;
  select * into v_prod from productions where id = (p ->> 'production_id')::uuid and organisation_id = v_org;
  if not found then raise exception 'Production introuvable'; end if;
  if v_prod.statut = 'cloturee' then raise exception 'Production clôturée'; end if;
  perform assert_org('magasins', v_mag, v_org);
  select * into v_sec from secteurs_projets where id = v_prod.secteur_id;
  if jsonb_typeof(p -> 'lignes') <> 'array' or jsonb_array_length(p -> 'lignes') = 0 then
    raise exception 'Ajoutez au moins une ligne';
  end if;

  for v_ligne in select * from jsonb_array_elements(p -> 'lignes') loop
    select * into v_produit from produits
      where id = (v_ligne ->> 'produit_id')::uuid and organisation_id = v_org and actif;
    if not found or v_produit.categorie = 'service' then raise exception 'Produit invalide'; end if;
    v_qte := (v_ligne ->> 'quantite')::numeric;
    if v_qte <= 0 then raise exception 'Quantité invalide (%)', v_produit.nom; end if;

    v_valeur := sortie_stock(v_org, v_date, v_mag, v_produit.id, v_qte, 'propre', null,
                             'sortie_production', 'production', v_prod.id);
    insert into consommations_production (organisation_id, production_id, date_consommation, magasin_id,
                                          produit_id, quantite, valeur)
      values (v_org, v_prod.id, v_date, v_mag, v_produit.id, v_qte, v_valeur);
    if v_valeur > 0 then
      v_ec := v_ec
        || ec_ligne(compte_categorie(v_org, v_produit.categorie, 'variation'), v_valeur, 0, null,
                    v_sec.departement_id, v_sec.id, v_prod.campagne_id, 'Consommation ' || v_produit.nom)
        || ec_ligne(compte_categorie(v_org, v_produit.categorie, 'stock'), 0, v_valeur, null,
                    null, null, v_prod.campagne_id, 'Consommation ' || v_produit.nom);
    end if;
  end loop;

  if jsonb_array_length(v_ec) > 0 then
    perform ecrire_interne(v_org, journal_de_type(v_org, 'stock'), v_date,
      'Intrants consommés ' || v_prod.code, null, v_ec, 'productions', v_prod.id, null);
  end if;
  return v_prod.id;
end $$;

-- ============================================================
-- Récolte
-- payload : { production_id, date, magasin_id, produit_id, quantite, valeur_totale?, observation? }
-- Sans valeur_totale : valorisation au coût de production restant à absorber (charges analytiques
-- du secteur × campagne moins les récoltes déjà valorisées).
-- Écriture : Dr stock du produit récolté / Cr 73 (production stockée).
-- ============================================================
create or replace function enregistrer_recolte(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_id uuid := gen_random_uuid();
  v_date date := (p ->> 'date')::date;
  v_mag uuid := (p ->> 'magasin_id')::uuid;
  v_qte numeric := (p ->> 'quantite')::numeric;
  v_prod productions%rowtype;
  v_sec secteurs_projets%rowtype;
  v_produit produits%rowtype;
  v_cout numeric;
  v_deja numeric;
  v_valeur numeric;
  v_num text;
begin
  if v_org is null or not has_role('admin', 'comptable', 'chef_departement') then
    raise exception 'Droits insuffisants';
  end if;
  select * into v_prod from productions where id = (p ->> 'production_id')::uuid and organisation_id = v_org;
  if not found then raise exception 'Production introuvable'; end if;
  if v_prod.statut = 'cloturee' then raise exception 'Production clôturée'; end if;
  perform assert_org('magasins', v_mag, v_org);
  select * into v_sec from secteurs_projets where id = v_prod.secteur_id;
  select * into v_produit from produits
    where id = (p ->> 'produit_id')::uuid and organisation_id = v_org and actif;
  if not found or v_produit.categorie in ('service', 'intrant') then raise exception 'Produit récolté invalide'; end if;
  if v_qte is null or v_qte <= 0 then raise exception 'Quantité invalide'; end if;

  select coalesce(sum(l.debit - l.credit), 0) into v_cout
    from lignes_ecritures l join comptes_comptables c on c.id = l.compte_id
    where l.organisation_id = v_org and c.classe = 6
      and l.secteur_id = v_prod.secteur_id and l.campagne_id = v_prod.campagne_id;
  select coalesce(sum(valeur), 0) into v_deja from recoltes where production_id = v_prod.id;
  v_valeur := coalesce(nullif(p ->> 'valeur_totale', '')::numeric, greatest(0, v_cout - v_deja));
  if v_valeur < 0 then raise exception 'Valeur invalide'; end if;

  v_num := prochain_numero(v_org, 'recolte', 'REC', v_date);
  insert into recoltes (id, organisation_id, numero, production_id, date_recolte, magasin_id, produit_id,
                        quantite, valeur, observation)
    values (v_id, v_org, v_num, v_prod.id, v_date, v_mag, v_produit.id, v_qte, v_valeur, nullif(p ->> 'observation', ''));
  perform entree_stock(v_org, v_date, v_mag, v_produit.id, v_qte, v_valeur, 'propre', null,
                       'entree_recolte', 'recolte', v_id);

  if v_valeur > 0 then
    perform ecrire_interne(v_org, journal_de_type(v_org, 'stock'), v_date, 'Récolte ' || v_num, null,
      jsonb_build_array(
        ec_ligne(compte_categorie(v_org, v_produit.categorie, 'stock'), v_valeur, 0, null, null, null, v_prod.campagne_id, v_produit.nom),
        ec_ligne(param_compte(v_org, 'variation_produits'), 0, v_valeur, null, v_sec.departement_id, v_sec.id, v_prod.campagne_id, 'Production stockée ' || v_prod.code)),
      'recoltes', v_id, null);
  end if;

  update productions set statut = 'recoltee' where id = v_prod.id and statut = 'en_cours';
  return v_id;
end $$;

-- ============================================================
-- Transformation (ordre de fabrication)
-- payload : { date, nomenclature_id, magasin_source_id, magasin_destination_id, departement_id,
--             campagne_id?, quantite_matiere, frais_imputes?, observation?,
--             sorties?: [{ produit_id, quantite }] }        (par défaut : rendements de la nomenclature)
-- Écritures : Dr variation de stock matière / Cr stock matière (consommation, valeur CUMP)
--             Dr stock produits finis ou résiduels / Cr 73 production stockée (matière + frais imputés)
-- Les frais imputés (main-d'œuvre, énergie, amortissement usine…) sont déjà en charges dans
-- la comptabilité ; ils ne font ici qu'augmenter la valeur du stock produit.
-- ============================================================
create or replace function lancer_transformation(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_id uuid := gen_random_uuid();
  v_date date := (p ->> 'date')::date;
  v_dep uuid := (p ->> 'departement_id')::uuid;
  v_camp uuid := nullif(p ->> 'campagne_id', '')::uuid;
  v_src uuid := (p ->> 'magasin_source_id')::uuid;
  v_dst uuid := (p ->> 'magasin_destination_id')::uuid;
  v_qte numeric := (p ->> 'quantite_matiere')::numeric;
  v_frais numeric := coalesce(nullif(p ->> 'frais_imputes', '')::numeric, 0);
  n nomenclatures%rowtype;
  v_matiere produits%rowtype;
  v_sorties jsonb;
  v_ligne jsonb;
  v_produit produits%rowtype;
  v_valeur_matiere numeric;
  v_total numeric;
  v_poids_total numeric := 0;
  v_par_valeur boolean;
  v_poids numeric;
  v_reste numeric;
  v_val numeric;
  v_i integer := 0;
  v_nb integer;
  v_sq numeric;
  v_ec jsonb := '[]'::jsonb;
  v_num text;
begin
  if v_org is null or not has_role('admin', 'comptable', 'chef_departement') then
    raise exception 'Droits insuffisants';
  end if;
  perform assert_org('magasins', v_src, v_org);
  perform assert_org('magasins', v_dst, v_org);
  perform assert_org('departements', v_dep, v_org);
  if v_camp is not null then perform assert_org('campagnes', v_camp, v_org); end if;
  if v_qte is null or v_qte <= 0 then raise exception 'Quantité de matière invalide'; end if;
  if v_frais < 0 then raise exception 'Frais invalides'; end if;

  select * into n from nomenclatures where id = (p ->> 'nomenclature_id')::uuid and organisation_id = v_org and actif;
  if not found then raise exception 'Nomenclature introuvable'; end if;
  select * into v_matiere from produits where id = n.matiere_id;

  v_sorties := p -> 'sorties';
  if v_sorties is null or jsonb_typeof(v_sorties) <> 'array' or jsonb_array_length(v_sorties) = 0 then
    select jsonb_agg(jsonb_build_object('produit_id', produit_id, 'quantite', round(v_qte * rendement_pct / 100, 3)))
      into v_sorties from nomenclature_sorties where nomenclature_id = n.id;
  end if;
  if v_sorties is null then raise exception 'La nomenclature n''a aucune sortie'; end if;
  v_nb := jsonb_array_length(v_sorties);

  -- Poids de répartition : quantité × prix de référence (à défaut, quantité seule)
  for v_ligne in select * from jsonb_array_elements(v_sorties) loop
    select * into v_produit from produits
      where id = (v_ligne ->> 'produit_id')::uuid and organisation_id = v_org and actif;
    if not found or v_produit.categorie not in ('produit_fini', 'sous_produit') then
      raise exception 'Les sorties doivent être des produits finis ou des sous-produits';
    end if;
    v_sq := (v_ligne ->> 'quantite')::numeric;
    if v_sq is null or v_sq <= 0 then raise exception 'Quantité de sortie invalide (%)', v_produit.nom; end if;
    v_poids_total := v_poids_total + v_sq * coalesce(v_produit.prix_reference, 0);
  end loop;
  v_par_valeur := v_poids_total > 0;
  if not v_par_valeur then
    for v_ligne in select * from jsonb_array_elements(v_sorties) loop
      v_poids_total := v_poids_total + (v_ligne ->> 'quantite')::numeric;
    end loop;
  end if;

  v_valeur_matiere := sortie_stock(v_org, v_date, v_src, v_matiere.id, v_qte, 'propre', null,
                                   'sortie_transformation', 'ordre_fabrication', v_id);
  v_total := v_valeur_matiere + v_frais;
  v_num := prochain_numero(v_org, 'ordre_fabrication', 'OF', v_date);

  insert into ordres_fabrication (id, organisation_id, numero, date_of, nomenclature_id, magasin_source_id,
      magasin_destination_id, departement_id, campagne_id, quantite_matiere, cout_matiere, frais_imputes,
      valeur_totale, observation)
    values (v_id, v_org, v_num, v_date, n.id, v_src, v_dst, v_dep, v_camp, v_qte, v_valeur_matiere, v_frais,
            v_total, nullif(p ->> 'observation', ''));

  if v_valeur_matiere > 0 then
    v_ec := v_ec
      || ec_ligne(compte_categorie(v_org, v_matiere.categorie, 'variation'), v_valeur_matiere, 0, null, v_dep, null, v_camp, 'Matière ' || v_matiere.nom)
      || ec_ligne(compte_categorie(v_org, v_matiere.categorie, 'stock'), 0, v_valeur_matiere, null, null, null, v_camp, 'Matière ' || v_matiere.nom);
  end if;

  v_reste := v_total;
  for v_ligne in select * from jsonb_array_elements(v_sorties) loop
    v_i := v_i + 1;
    select * into v_produit from produits where id = (v_ligne ->> 'produit_id')::uuid;
    v_sq := (v_ligne ->> 'quantite')::numeric;
    v_poids := case when v_par_valeur then v_sq * coalesce(v_produit.prix_reference, 0) else v_sq end;
    v_val := case when v_i = v_nb then v_reste else round(v_total * v_poids / v_poids_total, 2) end;
    v_reste := v_reste - v_val;

    insert into of_sorties (organisation_id, of_id, produit_id, quantite, valeur, rendement_reel_pct)
      values (v_org, v_id, v_produit.id, v_sq, v_val, round(v_sq / v_qte * 100, 2));
    perform entree_stock(v_org, v_date, v_dst, v_produit.id, v_sq, v_val, 'propre', null,
                         'entree_production', 'ordre_fabrication', v_id);
    if v_val > 0 then
      v_ec := v_ec || ec_ligne(compte_categorie(v_org, v_produit.categorie, 'stock'), v_val, 0, null, null, null, v_camp, v_produit.nom);
    end if;
  end loop;

  if v_total > 0 then
    v_ec := v_ec || ec_ligne(param_compte(v_org, 'variation_produits'), 0, v_total, null, v_dep, null, v_camp, 'Production stockée ' || v_num);
    perform ecrire_interne(v_org, journal_de_type(v_org, 'stock'), v_date, 'Ordre de fabrication ' || v_num,
                           null, v_ec, 'ordres_fabrication', v_id, null);
  end if;
  return v_id;
end $$;

-- ============================================================
-- Vues
-- ============================================================
create view v_production_secteurs with (security_invoker = true) as
select p.*,
       s.nom as secteur_nom,
       s.departement_id,
       coalesce(p.superficie_ha, s.superficie_ha) as superficie,
       coalesce(ch.charges, 0) as charges,
       coalesce(r.quantite, 0) as quantite_recoltee,
       coalesce(r.valeur, 0) as valeur_recoltee,
       case when coalesce(p.superficie_ha, s.superficie_ha) > 0 and coalesce(r.quantite, 0) > 0
            then round(r.quantite / coalesce(p.superficie_ha, s.superficie_ha), 2) end as rendement_par_ha,
       case when coalesce(p.superficie_ha, s.superficie_ha) > 0
            then round(coalesce(ch.charges, 0) / coalesce(p.superficie_ha, s.superficie_ha), 2) end as cout_par_ha,
       case when coalesce(r.quantite, 0) > 0 then round(coalesce(ch.charges, 0) / r.quantite, 2) end as cout_unitaire
from productions p
join secteurs_projets s on s.id = p.secteur_id
left join lateral (
  select sum(l.debit - l.credit) as charges
  from lignes_ecritures l join comptes_comptables c on c.id = l.compte_id
  where c.classe = 6 and l.secteur_id = p.secteur_id and l.campagne_id = p.campagne_id
) ch on true
left join (select production_id, sum(quantite) as quantite, sum(valeur) as valeur from recoltes group by production_id) r
  on r.production_id = p.id;

-- ============================================================
-- RLS et droits d'exécution
-- ============================================================
alter table productions enable row level security;
alter table consommations_production enable row level security;
alter table recoltes enable row level security;
alter table nomenclatures enable row level security;
alter table nomenclature_sorties enable row level security;
alter table ordres_fabrication enable row level security;
alter table of_sorties enable row level security;

create policy prod_select on productions for select using (organisation_id = current_org_id());
create policy prod_write on productions for all
  using (organisation_id = current_org_id() and has_role('admin', 'direction', 'chef_departement'))
  with check (organisation_id = current_org_id());
create policy cprod_select on consommations_production for select using (organisation_id = current_org_id());
create policy rec_select on recoltes for select using (organisation_id = current_org_id());
create policy nom_select on nomenclatures for select using (organisation_id = current_org_id());
create policy nom_write on nomenclatures for all
  using (organisation_id = current_org_id() and has_role('admin', 'comptable', 'chef_departement'))
  with check (organisation_id = current_org_id());
create policy noms_select on nomenclature_sorties for select using (organisation_id = current_org_id());
create policy noms_write on nomenclature_sorties for all
  using (organisation_id = current_org_id() and has_role('admin', 'comptable', 'chef_departement'))
  with check (organisation_id = current_org_id());
create policy of_select on ordres_fabrication for select using (organisation_id = current_org_id());
create policy ofs_select on of_sorties for select using (organisation_id = current_org_id());

revoke execute on function
  consommer_intrants_production(jsonb), enregistrer_recolte(jsonb), lancer_transformation(jsonb)
from public, anon;
grant execute on function
  consommer_intrants_production(jsonb), enregistrer_recolte(jsonb), lancer_transformation(jsonb)
to authenticated;
