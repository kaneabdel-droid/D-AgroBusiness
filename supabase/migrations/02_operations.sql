-- D-AGROBUSINESS — Phase 1 : boucle opérationnelle
-- Catalogue, stocks (CUMP, propre vs consigné), achats, dépôt-vente, ventes/distribution,
-- remboursement en nature, trésorerie. Chaque opération génère son écriture comptable
-- (inventaire permanent) via les RPC ci-dessous ; aucune écriture directe sur les tables.

-- ============================================================
-- Comptes complémentaires SYSCOHADA (à faire valider par un expert-comptable)
-- ============================================================
insert into modeles_plan_comptable (referentiel, numero, libelle) values
  ('SYSCOHADA', '6031', 'Variations des stocks de marchandises'),
  ('SYSCOHADA', '6032', 'Variations des stocks de matières premières et fournitures liées'),
  ('SYSCOHADA', '7072', 'Commissions et courtages')
on conflict do nothing;

insert into comptes_comptables (organisation_id, numero, libelle)
select o.id, m.numero, m.libelle
from organisations o
join modeles_plan_comptable m on m.referentiel = o.referentiel
where m.numero in ('6031', '6032', '7072')
on conflict do nothing;

-- ============================================================
-- Tables de référence
-- ============================================================
create table parametres_comptables (
  organisation_id uuid not null references organisations(id) on delete cascade,
  cle text not null,
  compte_id uuid not null references comptes_comptables(id) on delete restrict,
  primary key (organisation_id, cle)
);

create table produits (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  code text not null,
  nom text not null,
  categorie text not null check (categorie in (
    'intrant', 'semence', 'produit_agricole', 'produit_fini', 'sous_produit', 'service'
  )),
  unite text not null default 'kg',
  taux_tva numeric(5,2) not null default 0 check (taux_tva between 0 and 100),
  prix_reference numeric(18,2),
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organisation_id, code)
);

create table magasins (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  code text not null,
  nom text not null,
  departement_id uuid references departements(id) on delete restrict,
  actif boolean not null default true,
  unique (organisation_id, code)
);

create table contrats_depot (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  code text not null,
  fournisseur_id uuid not null references tiers(id) on delete restrict,
  taux_commission numeric(5,2) not null check (taux_commission between 0 and 100),
  date_debut date not null,
  date_fin date,
  statut text not null default 'actif' check (statut in ('actif', 'termine')),
  created_at timestamptz not null default now(),
  unique (organisation_id, code)
);

create table compteurs_documents (
  organisation_id uuid not null,
  type_document text not null,
  annee integer not null,
  dernier integer not null default 0,
  primary key (organisation_id, type_document, annee)
);

-- ============================================================
-- Stocks (journal de mouvements append-only)
-- ============================================================
create table mouvements_stock (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  date_mouvement date not null,
  magasin_id uuid not null references magasins(id) on delete restrict,
  produit_id uuid not null references produits(id) on delete restrict,
  propriete text not null check (propriete in ('propre', 'consigne')),
  contrat_depot_id uuid references contrats_depot(id) on delete restrict,
  quantite numeric(18,3) not null check (quantite <> 0),   -- + entrée, − sortie
  valeur numeric(18,2) not null default 0,                 -- 0 pour le stock consigné (hors bilan)
  type text not null,
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now(),
  check ((propriete = 'consigne') = (contrat_depot_id is not null)),
  check (propriete = 'propre' or valeur = 0)
);
create index on mouvements_stock (organisation_id, produit_id, magasin_id);
create index on mouvements_stock (source_type, source_id);

create or replace function interdire_modification_doc() returns trigger
language plpgsql as $$
begin
  raise exception 'Enregistrement immuable (table %) : passez une opération inverse', tg_table_name;
end $$;

create trigger mouvements_immuables before update or delete on mouvements_stock
  for each row execute function interdire_modification_doc();

-- ============================================================
-- Documents
-- ============================================================
create table achats (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  numero text not null,
  date_achat date not null,
  fournisseur_id uuid not null references tiers(id) on delete restrict,
  magasin_id uuid not null references magasins(id) on delete restrict,
  campagne_id uuid references campagnes(id) on delete restrict,
  reference_facture text,
  total_ht numeric(18,2) not null default 0,
  total_tva numeric(18,2) not null default 0,
  total_ttc numeric(18,2) not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (organisation_id, numero)
);

create table achats_lignes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  achat_id uuid not null references achats(id) on delete restrict,
  produit_id uuid not null references produits(id) on delete restrict,
  quantite numeric(18,3) not null check (quantite > 0),
  prix_unitaire numeric(18,2) not null check (prix_unitaire >= 0),
  taux_tva numeric(5,2) not null default 0,
  montant_ht numeric(18,2) not null
);

create table ventes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  numero text not null,
  date_vente date not null,
  type text not null check (type in ('distribution', 'marche')),
  client_id uuid not null references tiers(id) on delete restrict,
  campagne_id uuid references campagnes(id) on delete restrict,
  magasin_id uuid references magasins(id) on delete restrict,
  departement_id uuid not null references departements(id) on delete restrict,
  secteur_id uuid references secteurs_projets(id) on delete restrict,
  reference text,
  total_ht numeric(18,2) not null default 0,
  total_tva numeric(18,2) not null default 0,
  total_ttc numeric(18,2) not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (organisation_id, numero)
);
create index on ventes (organisation_id, client_id);

create table ventes_lignes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  vente_id uuid not null references ventes(id) on delete restrict,
  produit_id uuid not null references produits(id) on delete restrict,
  quantite numeric(18,3) not null check (quantite > 0),
  prix_unitaire numeric(18,2) not null check (prix_unitaire >= 0),
  taux_tva numeric(5,2) not null default 0,
  montant_ht numeric(18,2) not null,
  contrat_depot_id uuid references contrats_depot(id) on delete restrict,
  commission numeric(18,2) not null default 0
);

create table receptions_depot (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  numero text not null,
  date_reception date not null,
  contrat_id uuid not null references contrats_depot(id) on delete restrict,
  magasin_id uuid not null references magasins(id) on delete restrict,
  reference text,
  created_at timestamptz not null default now(),
  unique (organisation_id, numero)
);

-- Remboursement en nature : un producteur livre un produit qui vient en déduction de sa créance.
create table receptions_nature (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  numero text not null,
  date_reception date not null,
  producteur_id uuid not null references tiers(id) on delete restrict,
  campagne_id uuid references campagnes(id) on delete restrict,
  magasin_id uuid not null references magasins(id) on delete restrict,
  produit_id uuid not null references produits(id) on delete restrict,
  quantite numeric(18,3) not null check (quantite > 0),
  prix_unitaire numeric(18,2) not null check (prix_unitaire >= 0),   -- valorisation retenue
  montant numeric(18,2) not null,
  observation text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (organisation_id, numero)
);

-- ============================================================
-- Trésorerie
-- ============================================================
create table comptes_tresorerie (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  code text not null,
  nom text not null,
  type text not null check (type in ('banque', 'caisse')),
  compte_id uuid not null references comptes_comptables(id) on delete restrict,
  journal_id uuid not null references journaux(id) on delete restrict,
  actif boolean not null default true,
  unique (organisation_id, code)
);

create table reglements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  numero text not null,
  date_reglement date not null,
  sens text not null check (sens in ('encaissement', 'paiement')),
  tiers_id uuid not null references tiers(id) on delete restrict,
  montant numeric(18,2) not null check (montant > 0),
  compte_tresorerie_id uuid not null references comptes_tresorerie(id) on delete restrict,
  reference text,
  achat_id uuid references achats(id) on delete restrict,
  vente_id uuid references ventes(id) on delete restrict,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (organisation_id, numero)
);

create table operations_tresorerie (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  numero text not null,
  date_operation date not null,
  sens text not null check (sens in ('encaissement', 'decaissement')),
  montant numeric(18,2) not null check (montant > 0),
  compte_tresorerie_id uuid not null references comptes_tresorerie(id) on delete restrict,
  contrepartie_compte_id uuid not null references comptes_comptables(id) on delete restrict,
  libelle text not null,
  departement_id uuid references departements(id) on delete restrict,
  secteur_id uuid references secteurs_projets(id) on delete restrict,
  campagne_id uuid references campagnes(id) on delete restrict,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (organisation_id, numero)
);

create trigger reglements_immuables before update or delete on reglements
  for each row execute function interdire_modification_doc();
create trigger operations_immuables before update or delete on operations_tresorerie
  for each row execute function interdire_modification_doc();

-- ============================================================
-- Fonctions internes (non exposées)
-- ============================================================
create or replace function assert_org(p_table text, p_id uuid, p_org uuid) returns void
language plpgsql stable set search_path = public as $$
declare v_ok boolean;
begin
  if p_id is null then
    raise exception 'Référence manquante (%)', p_table;
  end if;
  execute format('select exists (select 1 from %I where id = $1 and organisation_id = $2)', p_table)
    into v_ok using p_id, p_org;
  if not v_ok then
    raise exception 'Référence invalide (%)', p_table;
  end if;
end $$;

create or replace function param_compte(p_org uuid, p_cle text) returns uuid
language plpgsql stable set search_path = public as $$
declare v_id uuid;
begin
  select compte_id into v_id from parametres_comptables where organisation_id = p_org and cle = p_cle;
  if v_id is null then
    raise exception 'Paramétrage comptable manquant : %', p_cle;
  end if;
  return v_id;
end $$;

create or replace function compte_categorie(p_org uuid, p_categorie text, p_usage text) returns uuid
language plpgsql stable set search_path = public as $$
declare v_cle text;
begin
  v_cle := case
    when p_usage = 'stock' and p_categorie in ('intrant', 'semence') then 'stock_marchandises'
    when p_usage = 'stock' and p_categorie = 'produit_agricole' then 'stock_matieres'
    when p_usage = 'stock' and p_categorie = 'produit_fini' then 'stock_produits_finis'
    when p_usage = 'stock' and p_categorie = 'sous_produit' then 'stock_residuels'
    when p_usage = 'variation' and p_categorie in ('intrant', 'semence') then 'variation_marchandises'
    when p_usage = 'variation' and p_categorie = 'produit_agricole' then 'variation_matieres'
    when p_usage = 'variation' and p_categorie in ('produit_fini', 'sous_produit') then 'variation_produits'
    when p_usage = 'vente' and p_categorie in ('intrant', 'semence', 'produit_agricole') then 'vente_marchandises'
    when p_usage = 'vente' and p_categorie = 'produit_fini' then 'vente_produits_finis'
    when p_usage = 'vente' and p_categorie = 'sous_produit' then 'vente_residuels'
    when p_usage = 'vente' and p_categorie = 'service' then 'vente_services'
  end;
  if v_cle is null then
    raise exception 'Aucun compte pour la catégorie % (usage %)', p_categorie, p_usage;
  end if;
  return param_compte(p_org, v_cle);
end $$;

create or replace function prochain_numero(p_org uuid, p_type text, p_prefixe text, p_date date)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_annee integer := extract(year from p_date)::integer;
  v_n integer;
begin
  insert into compteurs_documents (organisation_id, type_document, annee, dernier)
    values (p_org, p_type, v_annee, 1)
    on conflict (organisation_id, type_document, annee)
    do update set dernier = compteurs_documents.dernier + 1
    returning dernier into v_n;
  return p_prefixe || '-' || v_annee || '-' || lpad(v_n::text, 4, '0');
end $$;

create or replace function ec_ligne(
  p_compte uuid, p_debit numeric, p_credit numeric,
  p_tiers uuid default null, p_dep uuid default null, p_sec uuid default null,
  p_camp uuid default null, p_libelle text default null
) returns jsonb
language sql stable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'compte_id', p_compte, 'debit', p_debit, 'credit', p_credit, 'tiers_id', p_tiers,
    'departement_id', p_dep, 'secteur_id', p_sec, 'campagne_id', p_camp, 'libelle', p_libelle))
$$;

-- Entrée en stock (propre ou consigné).
create or replace function entree_stock(
  p_org uuid, p_date date, p_magasin uuid, p_produit uuid, p_qte numeric, p_valeur numeric,
  p_propriete text, p_contrat uuid, p_type text, p_source_type text, p_source_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into mouvements_stock (organisation_id, date_mouvement, magasin_id, produit_id, propriete,
                                contrat_depot_id, quantite, valeur, type, source_type, source_id)
  values (p_org, p_date, p_magasin, p_produit, p_propriete, p_contrat, p_qte,
          case when p_propriete = 'propre' then p_valeur else 0 end, p_type, p_source_type, p_source_id);
end $$;

-- Sortie de stock valorisée au CUMP (stock propre). Retourne la valeur sortie.
create or replace function sortie_stock(
  p_org uuid, p_date date, p_magasin uuid, p_produit uuid, p_qte numeric,
  p_propriete text, p_contrat uuid, p_type text, p_source_type text, p_source_id uuid
) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_qte numeric;
  v_val numeric;
  v_valeur numeric := 0;
  v_nom text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_org::text || p_produit::text, 0));

  select coalesce(sum(quantite), 0), coalesce(sum(valeur), 0) into v_qte, v_val
    from mouvements_stock
    where organisation_id = p_org and magasin_id = p_magasin and produit_id = p_produit
      and propriete = p_propriete and contrat_depot_id is not distinct from p_contrat;

  if v_qte < p_qte then
    select nom into v_nom from produits where id = p_produit;
    raise exception 'Stock insuffisant pour % (disponible %, demandé %)', v_nom, v_qte, p_qte;
  end if;

  if p_propriete = 'propre' then
    v_valeur := case when p_qte = v_qte then v_val else round(v_val * p_qte / v_qte, 2) end;
  end if;

  insert into mouvements_stock (organisation_id, date_mouvement, magasin_id, produit_id, propriete,
                                contrat_depot_id, quantite, valeur, type, source_type, source_id)
  values (p_org, p_date, p_magasin, p_produit, p_propriete, p_contrat, -p_qte, -v_valeur,
          p_type, p_source_type, p_source_id);
  return v_valeur;
end $$;

-- ============================================================
-- Écriture : noyau interne + enveloppe publique (remplace la version de 01)
-- ============================================================
create or replace function ecrire_interne(
  p_org uuid, p_journal_id uuid, p_date date, p_libelle text, p_reference text, p_lignes jsonb,
  p_source_module text, p_source_id uuid, p_contrepassation_de uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_exercice exercices_comptables%rowtype;
  v_numero integer;
  v_id uuid := gen_random_uuid();
  v_ligne jsonb;
begin
  if not exists (select 1 from journaux where id = p_journal_id and organisation_id = p_org and actif) then
    raise exception 'Journal introuvable';
  end if;
  if jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) < 2 then
    raise exception 'Une écriture comporte au moins deux lignes';
  end if;

  select * into v_exercice from exercices_comptables
    where organisation_id = p_org and p_date between date_debut and date_fin;
  if not found then
    raise exception 'Aucun exercice ne couvre la date %', p_date;
  end if;
  if v_exercice.statut <> 'ouvert' then
    raise exception 'L''exercice % est clôturé', v_exercice.libelle;
  end if;

  insert into compteurs_ecritures (organisation_id, exercice_id, journal_id, dernier_numero)
    values (p_org, v_exercice.id, p_journal_id, 1)
    on conflict (organisation_id, exercice_id, journal_id)
    do update set dernier_numero = compteurs_ecritures.dernier_numero + 1
    returning dernier_numero into v_numero;

  insert into ecritures (id, organisation_id, exercice_id, journal_id, numero, date_ecriture,
                         reference_piece, libelle, source_module, source_id, contrepassation_de)
  values (v_id, p_org, v_exercice.id, p_journal_id, v_numero, p_date,
          p_reference, p_libelle, p_source_module, p_source_id, p_contrepassation_de);

  for v_ligne in select * from jsonb_array_elements(p_lignes) loop
    insert into lignes_ecritures (organisation_id, ecriture_id, compte_id, tiers_id, libelle,
                                  debit, credit, departement_id, secteur_id, campagne_id)
    values (
      p_org, v_id,
      (v_ligne ->> 'compte_id')::uuid,
      nullif(v_ligne ->> 'tiers_id', '')::uuid,
      v_ligne ->> 'libelle',
      coalesce((v_ligne ->> 'debit')::numeric, 0),
      coalesce((v_ligne ->> 'credit')::numeric, 0),
      nullif(v_ligne ->> 'departement_id', '')::uuid,
      nullif(v_ligne ->> 'secteur_id', '')::uuid,
      nullif(v_ligne ->> 'campagne_id', '')::uuid
    );
  end loop;

  return v_id;
end $$;

create or replace function enregistrer_ecriture(
  p_journal_id uuid, p_date date, p_libelle text, p_reference text, p_lignes jsonb,
  p_source_module text default null, p_source_id uuid default null,
  p_contrepassation_de uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if current_org_id() is null or not has_role('admin', 'comptable') then
    raise exception 'Droits insuffisants pour saisir une écriture';
  end if;
  return ecrire_interne(current_org_id(), p_journal_id, p_date, p_libelle, p_reference,
                        p_lignes, p_source_module, p_source_id, p_contrepassation_de);
end $$;

create or replace function journal_de_type(p_org uuid, p_type text) returns uuid
language plpgsql stable set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from journaux where organisation_id = p_org and type = p_type and actif order by code limit 1;
  if v_id is null then
    raise exception 'Aucun journal de type %', p_type;
  end if;
  return v_id;
end $$;

-- ============================================================
-- Achats fermes d'intrants
-- payload : { date, fournisseur_id, magasin_id, campagne_id?, reference?,
--             lignes: [{ produit_id, quantite, prix_unitaire, taux_tva? }] }
-- ============================================================
create or replace function enregistrer_achat(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_id uuid := gen_random_uuid();
  v_date date := (p ->> 'date')::date;
  v_four uuid := (p ->> 'fournisseur_id')::uuid;
  v_mag uuid := (p ->> 'magasin_id')::uuid;
  v_camp uuid := nullif(p ->> 'campagne_id', '')::uuid;
  v_ligne jsonb;
  v_prod produits%rowtype;
  v_qte numeric; v_pu numeric; v_taux numeric; v_ht numeric; v_tva numeric;
  v_tot_ht numeric := 0; v_tot_tva numeric := 0;
  v_ec jsonb := '[]'::jsonb;
  v_num text;
begin
  if v_org is null or not has_role('admin', 'comptable') then
    raise exception 'Droits insuffisants';
  end if;
  perform assert_org('magasins', v_mag, v_org);
  if v_camp is not null then perform assert_org('campagnes', v_camp, v_org); end if;
  if not exists (select 1 from tiers where id = v_four and organisation_id = v_org and 'fournisseur' = any(types::text[])) then
    raise exception 'Le tiers choisi n''est pas un fournisseur';
  end if;
  if jsonb_typeof(p -> 'lignes') <> 'array' or jsonb_array_length(p -> 'lignes') = 0 then
    raise exception 'Ajoutez au moins une ligne';
  end if;

  v_num := prochain_numero(v_org, 'achat', 'ACH', v_date);
  insert into achats (id, organisation_id, numero, date_achat, fournisseur_id, magasin_id, campagne_id, reference_facture)
    values (v_id, v_org, v_num, v_date, v_four, v_mag, v_camp, nullif(p ->> 'reference', ''));

  for v_ligne in select * from jsonb_array_elements(p -> 'lignes') loop
    select * into v_prod from produits
      where id = (v_ligne ->> 'produit_id')::uuid and organisation_id = v_org and actif;
    if not found then raise exception 'Produit inconnu'; end if;
    if v_prod.categorie = 'service' then
      raise exception 'Un service ne s''achète pas ici (%) : utilisez une écriture manuelle', v_prod.nom;
    end if;
    v_qte := (v_ligne ->> 'quantite')::numeric;
    v_pu := (v_ligne ->> 'prix_unitaire')::numeric;
    v_taux := coalesce(nullif(v_ligne ->> 'taux_tva', '')::numeric, v_prod.taux_tva);
    if v_qte <= 0 or v_pu < 0 then raise exception 'Quantité ou prix invalide (%)', v_prod.nom; end if;
    v_ht := round(v_qte * v_pu, 2);
    v_tva := round(v_ht * v_taux / 100, 2);

    insert into achats_lignes (organisation_id, achat_id, produit_id, quantite, prix_unitaire, taux_tva, montant_ht)
      values (v_org, v_id, v_prod.id, v_qte, v_pu, v_taux, v_ht);
    perform entree_stock(v_org, v_date, v_mag, v_prod.id, v_qte, v_ht, 'propre', null, 'entree_achat', 'achat', v_id);

    if v_ht > 0 then
      v_ec := v_ec || ec_ligne(compte_categorie(v_org, v_prod.categorie, 'stock'), v_ht, 0, null, null, null, v_camp, v_prod.nom);
    end if;
    v_tot_ht := v_tot_ht + v_ht;
    v_tot_tva := v_tot_tva + v_tva;
  end loop;

  if v_tot_ht + v_tot_tva <= 0 then raise exception 'Montant total nul'; end if;
  if v_tot_tva > 0 then
    v_ec := v_ec || ec_ligne(param_compte(v_org, 'tva_deductible'), v_tot_tva, 0, null, null, null, v_camp, 'TVA déductible');
  end if;
  v_ec := v_ec || ec_ligne(param_compte(v_org, 'fournisseurs'), 0, v_tot_ht + v_tot_tva, v_four, null, null, v_camp, 'Achat ' || v_num);

  perform ecrire_interne(v_org, journal_de_type(v_org, 'achats'), v_date, 'Achat ' || v_num,
                         nullif(p ->> 'reference', ''), v_ec, 'achats', v_id, null);
  update achats set total_ht = v_tot_ht, total_tva = v_tot_tva, total_ttc = v_tot_ht + v_tot_tva where id = v_id;
  return v_id;
end $$;

-- ============================================================
-- Dépôt-vente : réception de marchandises consignées (aucune écriture : hors bilan)
-- payload : { date, contrat_id, magasin_id, reference?, lignes: [{ produit_id, quantite }] }
-- ============================================================
create or replace function recevoir_depot(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_id uuid := gen_random_uuid();
  v_date date := (p ->> 'date')::date;
  v_contrat uuid := (p ->> 'contrat_id')::uuid;
  v_mag uuid := (p ->> 'magasin_id')::uuid;
  v_ligne jsonb;
  v_prod produits%rowtype;
  v_qte numeric;
begin
  if v_org is null or not has_role('admin', 'comptable', 'chef_departement') then
    raise exception 'Droits insuffisants';
  end if;
  perform assert_org('magasins', v_mag, v_org);
  if not exists (select 1 from contrats_depot where id = v_contrat and organisation_id = v_org and statut = 'actif') then
    raise exception 'Contrat de dépôt introuvable ou terminé';
  end if;
  if jsonb_typeof(p -> 'lignes') <> 'array' or jsonb_array_length(p -> 'lignes') = 0 then
    raise exception 'Ajoutez au moins une ligne';
  end if;

  insert into receptions_depot (id, organisation_id, numero, date_reception, contrat_id, magasin_id, reference)
    values (v_id, v_org, prochain_numero(v_org, 'reception_depot', 'RD', v_date), v_date, v_contrat, v_mag,
            nullif(p ->> 'reference', ''));

  for v_ligne in select * from jsonb_array_elements(p -> 'lignes') loop
    select * into v_prod from produits
      where id = (v_ligne ->> 'produit_id')::uuid and organisation_id = v_org and actif;
    if not found or v_prod.categorie = 'service' then raise exception 'Produit invalide'; end if;
    v_qte := (v_ligne ->> 'quantite')::numeric;
    if v_qte <= 0 then raise exception 'Quantité invalide (%)', v_prod.nom; end if;
    perform entree_stock(v_org, v_date, v_mag, v_prod.id, v_qte, 0, 'consigne', v_contrat,
                         'entree_depot', 'reception_depot', v_id);
  end loop;
  return v_id;
end $$;

-- ============================================================
-- Ventes marché et distribution aux producteurs (crédit)
-- payload : { date, type: 'distribution'|'marche', client_id, campagne_id?, magasin_id?,
--             departement_id, secteur_id?, reference?,
--             lignes: [{ produit_id, quantite, prix_unitaire, taux_tva?, contrat_depot_id? }] }
-- Vente d'un produit consigné : dette envers le fournisseur = HT − commission ;
-- la commission est un produit (7072). Traitement TVA simplifié : à valider avec l'expert-comptable.
-- ============================================================
create or replace function enregistrer_vente(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_id uuid := gen_random_uuid();
  v_type text := p ->> 'type';
  v_date date := (p ->> 'date')::date;
  v_client uuid := (p ->> 'client_id')::uuid;
  v_camp uuid := nullif(p ->> 'campagne_id', '')::uuid;
  v_mag uuid := nullif(p ->> 'magasin_id', '')::uuid;
  v_dep uuid := (p ->> 'departement_id')::uuid;
  v_sec uuid := nullif(p ->> 'secteur_id', '')::uuid;
  v_ligne jsonb;
  v_prod produits%rowtype;
  v_contrat contrats_depot%rowtype;
  v_contrat_id uuid;
  v_qte numeric; v_pu numeric; v_taux numeric; v_ht numeric; v_tva numeric;
  v_commission numeric; v_valeur numeric;
  v_tot_ht numeric := 0; v_tot_tva numeric := 0;
  v_ec jsonb := '[]'::jsonb;
  v_num text;
  v_type_tiers text;
begin
  if v_org is null or not has_role('admin', 'comptable', 'chef_departement') then
    raise exception 'Droits insuffisants';
  end if;
  if v_type not in ('distribution', 'marche') then raise exception 'Type de vente invalide'; end if;
  perform assert_org('departements', v_dep, v_org);
  if v_mag is not null then perform assert_org('magasins', v_mag, v_org); end if;
  if v_camp is not null then perform assert_org('campagnes', v_camp, v_org); end if;
  if v_sec is not null then perform assert_org('secteurs_projets', v_sec, v_org); end if;

  v_type_tiers := case v_type when 'distribution' then 'producteur' else 'client' end;
  if not exists (select 1 from tiers where id = v_client and organisation_id = v_org and v_type_tiers = any(types::text[])) then
    raise exception 'Le tiers choisi n''est pas de type %', v_type_tiers;
  end if;
  if jsonb_typeof(p -> 'lignes') <> 'array' or jsonb_array_length(p -> 'lignes') = 0 then
    raise exception 'Ajoutez au moins une ligne';
  end if;

  v_num := prochain_numero(v_org, 'vente_' || v_type, case v_type when 'distribution' then 'DIS' else 'VTE' end, v_date);
  insert into ventes (id, organisation_id, numero, date_vente, type, client_id, campagne_id, magasin_id,
                      departement_id, secteur_id, reference)
    values (v_id, v_org, v_num, v_date, v_type, v_client, v_camp, v_mag, v_dep, v_sec, nullif(p ->> 'reference', ''));

  for v_ligne in select * from jsonb_array_elements(p -> 'lignes') loop
    select * into v_prod from produits
      where id = (v_ligne ->> 'produit_id')::uuid and organisation_id = v_org and actif;
    if not found then raise exception 'Produit inconnu'; end if;
    v_qte := (v_ligne ->> 'quantite')::numeric;
    v_pu := (v_ligne ->> 'prix_unitaire')::numeric;
    v_taux := coalesce(nullif(v_ligne ->> 'taux_tva', '')::numeric, v_prod.taux_tva);
    if v_qte <= 0 or v_pu < 0 then raise exception 'Quantité ou prix invalide (%)', v_prod.nom; end if;
    v_ht := round(v_qte * v_pu, 2);
    v_tva := round(v_ht * v_taux / 100, 2);
    v_contrat_id := nullif(v_ligne ->> 'contrat_depot_id', '')::uuid;
    v_commission := 0;

    if v_prod.categorie = 'service' then
      if v_contrat_id is not null then raise exception 'Un service ne peut pas être en dépôt-vente'; end if;
      v_ec := v_ec || ec_ligne(compte_categorie(v_org, 'service', 'vente'), 0, v_ht, null, v_dep, v_sec, v_camp, v_prod.nom);
    else
      if v_mag is null then raise exception 'Magasin requis pour vendre du stock'; end if;
      if v_contrat_id is null then
        v_valeur := sortie_stock(v_org, v_date, v_mag, v_prod.id, v_qte, 'propre', null,
                                 'sortie_' || v_type, 'vente', v_id);
        if v_valeur > 0 then
          v_ec := v_ec
            || ec_ligne(compte_categorie(v_org, v_prod.categorie, 'variation'), v_valeur, 0, null, v_dep, v_sec, v_camp, 'Sortie stock ' || v_prod.nom)
            || ec_ligne(compte_categorie(v_org, v_prod.categorie, 'stock'), 0, v_valeur, null, null, null, v_camp, 'Sortie stock ' || v_prod.nom);
        end if;
        v_ec := v_ec || ec_ligne(compte_categorie(v_org, v_prod.categorie, 'vente'), 0, v_ht, null, v_dep, v_sec, v_camp, v_prod.nom);
      else
        select * into v_contrat from contrats_depot
          where id = v_contrat_id and organisation_id = v_org and statut = 'actif';
        if not found then raise exception 'Contrat de dépôt introuvable ou terminé'; end if;
        perform sortie_stock(v_org, v_date, v_mag, v_prod.id, v_qte, 'consigne', v_contrat_id,
                             'sortie_' || v_type, 'vente', v_id);
        v_commission := round(v_ht * v_contrat.taux_commission / 100, 2);
        v_ec := v_ec
          || ec_ligne(param_compte(v_org, 'fournisseurs'), 0, v_ht - v_commission, v_contrat.fournisseur_id, null, null, v_camp, 'Dépôt-vente ' || v_prod.nom)
          || ec_ligne(param_compte(v_org, 'commission'), 0, v_commission, null, v_dep, v_sec, v_camp, 'Commission ' || v_prod.nom);
      end if;
    end if;

    insert into ventes_lignes (organisation_id, vente_id, produit_id, quantite, prix_unitaire, taux_tva,
                               montant_ht, contrat_depot_id, commission)
      values (v_org, v_id, v_prod.id, v_qte, v_pu, v_taux, v_ht, v_contrat_id, v_commission);
    v_tot_ht := v_tot_ht + v_ht;
    v_tot_tva := v_tot_tva + v_tva;
  end loop;

  if v_tot_ht + v_tot_tva <= 0 then raise exception 'Montant total nul'; end if;
  if v_tot_tva > 0 then
    v_ec := v_ec || ec_ligne(param_compte(v_org, 'tva_collectee'), 0, v_tot_tva, null, null, null, v_camp, 'TVA collectée');
  end if;
  v_ec := v_ec || ec_ligne(param_compte(v_org, 'clients'), v_tot_ht + v_tot_tva, 0, v_client, null, null, v_camp, 'Facture ' || v_num);

  perform ecrire_interne(v_org, journal_de_type(v_org, 'ventes'), v_date, 'Facture ' || v_num,
                         nullif(p ->> 'reference', ''), v_ec, 'ventes', v_id, null);
  update ventes set total_ht = v_tot_ht, total_tva = v_tot_tva, total_ttc = v_tot_ht + v_tot_tva where id = v_id;
  return v_id;
end $$;

-- ============================================================
-- Remboursement en nature
-- payload : { date, producteur_id, magasin_id, produit_id, quantite, prix_unitaire,
--             campagne_id?, observation? }
-- Écriture : Dr stock du produit reçu / Cr client (producteur) → vient en déduction de sa créance.
-- ============================================================
create or replace function enregistrer_reception_nature(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_id uuid := gen_random_uuid();
  v_date date := (p ->> 'date')::date;
  v_prod_id uuid := (p ->> 'producteur_id')::uuid;
  v_mag uuid := (p ->> 'magasin_id')::uuid;
  v_camp uuid := nullif(p ->> 'campagne_id', '')::uuid;
  v_produit produits%rowtype;
  v_qte numeric := (p ->> 'quantite')::numeric;
  v_pu numeric := (p ->> 'prix_unitaire')::numeric;
  v_montant numeric;
  v_num text;
begin
  if v_org is null or not has_role('admin', 'comptable', 'chef_departement') then
    raise exception 'Droits insuffisants';
  end if;
  perform assert_org('magasins', v_mag, v_org);
  if v_camp is not null then perform assert_org('campagnes', v_camp, v_org); end if;
  if not exists (select 1 from tiers where id = v_prod_id and organisation_id = v_org and 'producteur' = any(types::text[])) then
    raise exception 'Le tiers choisi n''est pas un producteur';
  end if;
  select * into v_produit from produits
    where id = (p ->> 'produit_id')::uuid and organisation_id = v_org and actif;
  if not found or v_produit.categorie = 'service' then raise exception 'Produit invalide'; end if;
  if v_qte <= 0 or v_pu <= 0 then raise exception 'Quantité et valorisation doivent être positives'; end if;

  v_montant := round(v_qte * v_pu, 2);
  v_num := prochain_numero(v_org, 'reception_nature', 'RN', v_date);
  insert into receptions_nature (id, organisation_id, numero, date_reception, producteur_id, campagne_id,
                                 magasin_id, produit_id, quantite, prix_unitaire, montant, observation)
    values (v_id, v_org, v_num, v_date, v_prod_id, v_camp, v_mag, v_produit.id, v_qte, v_pu, v_montant,
            nullif(p ->> 'observation', ''));
  perform entree_stock(v_org, v_date, v_mag, v_produit.id, v_qte, v_montant, 'propre', null,
                       'entree_reception_nature', 'reception_nature', v_id);

  perform ecrire_interne(v_org, journal_de_type(v_org, 'operations_diverses'), v_date,
    'Remboursement en nature ' || v_num,
    null,
    jsonb_build_array(
      ec_ligne(compte_categorie(v_org, v_produit.categorie, 'stock'), v_montant, 0, null, null, null, v_camp, v_produit.nom),
      ec_ligne(param_compte(v_org, 'clients'), 0, v_montant, v_prod_id, null, null, v_camp, 'Remboursement en nature ' || v_num)),
    'receptions_nature', v_id, null);
  return v_id;
end $$;

-- ============================================================
-- Trésorerie
-- ============================================================
create or replace function creer_compte_tresorerie(p_nom text, p_type text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_num_base text;
  v_n integer;
  v_num text;
  v_code text;
  v_compte uuid;
  v_journal uuid;
  v_id uuid;
begin
  if v_org is null or not has_role('admin', 'comptable') then
    raise exception 'Droits insuffisants';
  end if;
  if p_type not in ('banque', 'caisse') then raise exception 'Type invalide'; end if;
  if coalesce(trim(p_nom), '') = '' then raise exception 'Nom obligatoire'; end if;

  select numero into v_num_base from comptes_comptables where id = param_compte(v_org, p_type);
  select count(*) + 1 into v_n from comptes_tresorerie where organisation_id = v_org and type = p_type;

  loop
    v_num := v_num_base || v_n;
    v_code := case p_type when 'banque' then 'BQ' else 'CA' end || v_n;
    exit when not exists (select 1 from comptes_comptables where organisation_id = v_org and numero = v_num)
          and not exists (select 1 from journaux where organisation_id = v_org and code = v_code)
          and not exists (select 1 from comptes_tresorerie where organisation_id = v_org and code = v_code);
    v_n := v_n + 1;
  end loop;

  insert into comptes_comptables (organisation_id, numero, libelle) values (v_org, v_num, trim(p_nom))
    returning id into v_compte;
  insert into journaux (organisation_id, code, libelle, type) values (v_org, v_code, trim(p_nom), p_type)
    returning id into v_journal;
  insert into comptes_tresorerie (organisation_id, code, nom, type, compte_id, journal_id)
    values (v_org, v_code, trim(p_nom), p_type, v_compte, v_journal) returning id into v_id;
  return v_id;
end $$;

-- payload : { date, sens: 'encaissement'|'paiement', tiers_id, montant, compte_tresorerie_id,
--             reference?, achat_id?, vente_id? }
create or replace function enregistrer_reglement(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_id uuid := gen_random_uuid();
  v_date date := (p ->> 'date')::date;
  v_sens text := p ->> 'sens';
  v_tiers uuid := (p ->> 'tiers_id')::uuid;
  v_montant numeric := (p ->> 'montant')::numeric;
  v_ct comptes_tresorerie%rowtype;
  v_achat uuid := nullif(p ->> 'achat_id', '')::uuid;
  v_vente uuid := nullif(p ->> 'vente_id', '')::uuid;
  v_num text;
  v_ec jsonb;
begin
  if v_org is null or not has_role('admin', 'comptable') then
    raise exception 'Droits insuffisants';
  end if;
  if v_sens not in ('encaissement', 'paiement') then raise exception 'Sens invalide'; end if;
  if v_montant is null or v_montant <= 0 then raise exception 'Montant invalide'; end if;
  perform assert_org('tiers', v_tiers, v_org);
  select * into v_ct from comptes_tresorerie where id = (p ->> 'compte_tresorerie_id')::uuid
    and organisation_id = v_org and actif;
  if not found then raise exception 'Compte de trésorerie introuvable'; end if;
  if v_achat is not null then perform assert_org('achats', v_achat, v_org); end if;
  if v_vente is not null then perform assert_org('ventes', v_vente, v_org); end if;

  v_num := prochain_numero(v_org, 'reglement', case v_sens when 'encaissement' then 'ENC' else 'PAY' end, v_date);
  insert into reglements (id, organisation_id, numero, date_reglement, sens, tiers_id, montant,
                          compte_tresorerie_id, reference, achat_id, vente_id)
    values (v_id, v_org, v_num, v_date, v_sens, v_tiers, v_montant, v_ct.id, nullif(p ->> 'reference', ''), v_achat, v_vente);

  if v_sens = 'encaissement' then
    v_ec := jsonb_build_array(
      ec_ligne(v_ct.compte_id, v_montant, 0, null, null, null, null, 'Encaissement ' || v_num),
      ec_ligne(param_compte(v_org, 'clients'), 0, v_montant, v_tiers, null, null, null, 'Encaissement ' || v_num));
  else
    v_ec := jsonb_build_array(
      ec_ligne(param_compte(v_org, 'fournisseurs'), v_montant, 0, v_tiers, null, null, null, 'Paiement ' || v_num),
      ec_ligne(v_ct.compte_id, 0, v_montant, null, null, null, null, 'Paiement ' || v_num));
  end if;
  perform ecrire_interne(v_org, v_ct.journal_id, v_date,
    case v_sens when 'encaissement' then 'Encaissement ' else 'Paiement ' end || v_num,
    nullif(p ->> 'reference', ''), v_ec, 'reglements', v_id, null);
  return v_id;
end $$;

-- payload : { date, sens: 'encaissement'|'decaissement', montant, compte_tresorerie_id,
--             contrepartie_compte_id, libelle, departement_id?, secteur_id?, campagne_id? }
create or replace function enregistrer_operation_tresorerie(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_id uuid := gen_random_uuid();
  v_date date := (p ->> 'date')::date;
  v_sens text := p ->> 'sens';
  v_montant numeric := (p ->> 'montant')::numeric;
  v_ct comptes_tresorerie%rowtype;
  v_contre uuid := (p ->> 'contrepartie_compte_id')::uuid;
  v_dep uuid := nullif(p ->> 'departement_id', '')::uuid;
  v_sec uuid := nullif(p ->> 'secteur_id', '')::uuid;
  v_camp uuid := nullif(p ->> 'campagne_id', '')::uuid;
  v_libelle text := coalesce(nullif(trim(p ->> 'libelle'), ''), 'Opération de trésorerie');
  v_num text;
  v_ec jsonb;
begin
  if v_org is null or not has_role('admin', 'comptable') then
    raise exception 'Droits insuffisants';
  end if;
  if v_sens not in ('encaissement', 'decaissement') then raise exception 'Sens invalide'; end if;
  if v_montant is null or v_montant <= 0 then raise exception 'Montant invalide'; end if;
  perform assert_org('comptes_comptables', v_contre, v_org);
  if v_dep is not null then perform assert_org('departements', v_dep, v_org); end if;
  if v_sec is not null then perform assert_org('secteurs_projets', v_sec, v_org); end if;
  if v_camp is not null then perform assert_org('campagnes', v_camp, v_org); end if;
  select * into v_ct from comptes_tresorerie where id = (p ->> 'compte_tresorerie_id')::uuid
    and organisation_id = v_org and actif;
  if not found then raise exception 'Compte de trésorerie introuvable'; end if;

  v_num := prochain_numero(v_org, 'operation_tresorerie', 'OPT', v_date);
  insert into operations_tresorerie (id, organisation_id, numero, date_operation, sens, montant,
      compte_tresorerie_id, contrepartie_compte_id, libelle, departement_id, secteur_id, campagne_id)
    values (v_id, v_org, v_num, v_date, v_sens, v_montant, v_ct.id, v_contre, v_libelle, v_dep, v_sec, v_camp);

  if v_sens = 'encaissement' then
    v_ec := jsonb_build_array(
      ec_ligne(v_ct.compte_id, v_montant, 0, null, null, null, null, v_libelle),
      ec_ligne(v_contre, 0, v_montant, null, v_dep, v_sec, v_camp, v_libelle));
  else
    v_ec := jsonb_build_array(
      ec_ligne(v_contre, v_montant, 0, null, v_dep, v_sec, v_camp, v_libelle),
      ec_ligne(v_ct.compte_id, 0, v_montant, null, null, null, null, v_libelle));
  end if;
  perform ecrire_interne(v_org, v_ct.journal_id, v_date, v_libelle || ' (' || v_num || ')', null,
                         v_ec, 'operations_tresorerie', v_id, null);
  return v_id;
end $$;

-- ============================================================
-- Vues de restitution
-- ============================================================
create view v_stock with (security_invoker = true) as
select organisation_id, magasin_id, produit_id, propriete, contrat_depot_id,
       sum(quantite) as quantite, sum(valeur) as valeur,
       case when sum(quantite) > 0 and propriete = 'propre' then round(sum(valeur) / sum(quantite), 2) end as cump
from mouvements_stock
group by organisation_id, magasin_id, produit_id, propriete, contrat_depot_id
having sum(quantite) <> 0;

-- solde > 0 : créance sur le tiers ; solde < 0 : dette envers le tiers
create view v_soldes_tiers with (security_invoker = true) as
select l.organisation_id, l.tiers_id, c.numero as compte_numero, c.libelle as compte_libelle,
       sum(l.debit) as total_debit, sum(l.credit) as total_credit,
       sum(l.debit) - sum(l.credit) as solde
from lignes_ecritures l
join comptes_comptables c on c.id = l.compte_id
where l.tiers_id is not null and c.lettrable
group by l.organisation_id, l.tiers_id, c.numero, c.libelle
having sum(l.debit) - sum(l.credit) <> 0;

create view v_soldes_tresorerie with (security_invoker = true) as
select t.organisation_id, t.id as compte_tresorerie_id, t.code, t.nom, t.type,
       coalesce(sum(l.debit) - sum(l.credit), 0) as solde
from comptes_tresorerie t
left join lignes_ecritures l on l.compte_id = t.compte_id
group by t.organisation_id, t.id, t.code, t.nom, t.type;

-- ============================================================
-- Initialisation Phase 1 (idempotente), appelée à la création d'une organisation
-- ============================================================
create or replace function initialiser_phase1(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_dep uuid;
begin
  insert into parametres_comptables (organisation_id, cle, compte_id)
  select p_org, k.cle, c.id
  from (values
    ('stock_marchandises', '31'), ('stock_matieres', '32'),
    ('stock_produits_finis', '36'), ('stock_residuels', '37'),
    ('variation_marchandises', '6031'), ('variation_matieres', '6032'), ('variation_produits', '73'),
    ('vente_marchandises', '701'), ('vente_produits_finis', '702'),
    ('vente_residuels', '703'), ('vente_services', '706'), ('commission', '7072'),
    ('clients', '411'), ('fournisseurs', '401'),
    ('tva_collectee', '4431'), ('tva_deductible', '4452'),
    ('banque', '521'), ('caisse', '571')
  ) as k(cle, numero)
  join comptes_comptables c on c.organisation_id = p_org and c.numero = k.numero
  on conflict do nothing;

  select id into v_dep from departements where organisation_id = p_org and code = 'DIST';
  insert into magasins (organisation_id, code, nom, departement_id)
    values (p_org, 'MAG1', 'Magasin central', v_dep)
    on conflict do nothing;

  insert into comptes_tresorerie (organisation_id, code, nom, type, compte_id, journal_id)
  select p_org, j.code, j.libelle, j.type, pc.compte_id, j.id
  from journaux j
  join parametres_comptables pc on pc.organisation_id = p_org and pc.cle = j.type
  where j.organisation_id = p_org and j.code in ('BQ1', 'CAI')
  on conflict do nothing;
end $$;

create or replace function initialiser_organisation(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ref referentiel_comptable;
begin
  select referentiel into v_ref from organisations where id = p_org;

  insert into comptes_comptables (organisation_id, numero, libelle, lettrable)
  select p_org, numero, libelle, left(numero, 3) in ('401', '411', '409', '419', '421', '422')
  from modeles_plan_comptable where referentiel = v_ref;

  insert into departements (organisation_id, code, nom, type) values
    (p_org, 'FONC', 'Fonctionnement', 'fonctionnement'),
    (p_org, 'DIST', 'Distribution d''intrants', 'distribution'),
    (p_org, 'PROD', 'Production', 'production'),
    (p_org, 'USIN', 'Usine de transformation', 'usine'),
    (p_org, 'MATE', 'Parc matériel', 'materiel');

  insert into journaux (organisation_id, code, libelle, type) values
    (p_org, 'ACH', 'Journal des achats', 'achats'),
    (p_org, 'VTE', 'Journal des ventes', 'ventes'),
    (p_org, 'BQ1', 'Banque principale', 'banque'),
    (p_org, 'CAI', 'Caisse', 'caisse'),
    (p_org, 'PAI', 'Journal de paie', 'paie'),
    (p_org, 'STK', 'Journal des stocks', 'stock'),
    (p_org, 'OD', 'Opérations diverses', 'operations_diverses'),
    (p_org, 'AN', 'À-nouveaux', 'a_nouveaux');

  perform initialiser_phase1(p_org);
end $$;

-- Organisations déjà créées (Phase 0)
do $$
declare o record;
begin
  for o in select id from organisations loop
    perform initialiser_phase1(o.id);
  end loop;
end $$;

-- ============================================================
-- RLS : lecture par organisation ; écriture des référentiels selon le rôle ;
-- les documents ne s'écrivent que par les RPC ci-dessus.
-- ============================================================
alter table parametres_comptables enable row level security;
alter table produits enable row level security;
alter table magasins enable row level security;
alter table contrats_depot enable row level security;
alter table compteurs_documents enable row level security;
alter table mouvements_stock enable row level security;
alter table achats enable row level security;
alter table achats_lignes enable row level security;
alter table ventes enable row level security;
alter table ventes_lignes enable row level security;
alter table receptions_depot enable row level security;
alter table receptions_nature enable row level security;
alter table comptes_tresorerie enable row level security;
alter table reglements enable row level security;
alter table operations_tresorerie enable row level security;

create policy param_select on parametres_comptables for select using (organisation_id = current_org_id());
create policy param_write on parametres_comptables for all
  using (organisation_id = current_org_id() and has_role('admin', 'comptable'))
  with check (organisation_id = current_org_id());

create policy produits_select on produits for select using (organisation_id = current_org_id());
create policy produits_write on produits for all
  using (organisation_id = current_org_id() and has_role('admin', 'comptable', 'chef_departement'))
  with check (organisation_id = current_org_id());

create policy magasins_select on magasins for select using (organisation_id = current_org_id());
create policy magasins_write on magasins for all
  using (organisation_id = current_org_id() and has_role('admin', 'comptable', 'chef_departement'))
  with check (organisation_id = current_org_id());

create policy contrats_select on contrats_depot for select using (organisation_id = current_org_id());
create policy contrats_write on contrats_depot for all
  using (organisation_id = current_org_id() and has_role('admin', 'comptable', 'chef_departement'))
  with check (organisation_id = current_org_id());

create policy mouvements_select on mouvements_stock for select using (organisation_id = current_org_id());
create policy achats_select on achats for select using (organisation_id = current_org_id());
create policy achats_lignes_select on achats_lignes for select using (organisation_id = current_org_id());
create policy ventes_select on ventes for select using (organisation_id = current_org_id());
create policy ventes_lignes_select on ventes_lignes for select using (organisation_id = current_org_id());
create policy rdepot_select on receptions_depot for select using (organisation_id = current_org_id());
create policy rnature_select on receptions_nature for select using (organisation_id = current_org_id());
create policy ctres_select on comptes_tresorerie for select using (organisation_id = current_org_id());
create policy reglements_select on reglements for select using (organisation_id = current_org_id());
create policy optres_select on operations_tresorerie for select using (organisation_id = current_org_id());

-- ============================================================
-- Droits d'exécution : seules les RPC métier sont appelables par les utilisateurs connectés.
-- (Supabase accorde par défaut EXECUTE à anon/authenticated sur les nouvelles fonctions.)
-- ============================================================
revoke execute on function
  initialiser_organisation(uuid), initialiser_phase1(uuid), handle_new_user(),
  ecrire_interne(uuid, uuid, date, text, text, jsonb, text, uuid, uuid),
  entree_stock(uuid, date, uuid, uuid, numeric, numeric, text, uuid, text, text, uuid),
  sortie_stock(uuid, date, uuid, uuid, numeric, text, uuid, text, text, uuid),
  prochain_numero(uuid, text, text, date),
  param_compte(uuid, text), compte_categorie(uuid, text, text),
  assert_org(text, uuid, uuid), journal_de_type(uuid, text),
  audit_trigger()
from public, anon, authenticated;

revoke execute on function
  enregistrer_ecriture(uuid, date, text, text, jsonb, text, uuid, uuid),
  contrepasser_ecriture(uuid, date, text),
  enregistrer_achat(jsonb), recevoir_depot(jsonb), enregistrer_vente(jsonb),
  enregistrer_reception_nature(jsonb), creer_compte_tresorerie(text, text),
  enregistrer_reglement(jsonb), enregistrer_operation_tresorerie(jsonb)
from public, anon;

grant execute on function
  enregistrer_ecriture(uuid, date, text, text, jsonb, text, uuid, uuid),
  contrepasser_ecriture(uuid, date, text),
  enregistrer_achat(jsonb), recevoir_depot(jsonb), enregistrer_vente(jsonb),
  enregistrer_reception_nature(jsonb), creer_compte_tresorerie(text, text),
  enregistrer_reglement(jsonb), enregistrer_operation_tresorerie(jsonb)
to authenticated;
