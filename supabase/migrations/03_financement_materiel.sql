-- D-AGROBUSINESS — Phase 2 : financement (emprunts, crédit de campagne, fonds de
-- commercialisation, crédit-bail), subventions d'investissement et parc matériel.
-- Traitement SYSCOHADA : matériel inscrit au coût global, amortissement normal,
-- subvention en compte 14 reprise au résultat (865) au rythme de l'amortissement.

-- ============================================================
-- Comptes complémentaires SYSCOHADA
-- ============================================================
insert into modeles_plan_comptable (referentiel, numero, libelle) values
  ('SYSCOHADA', '173', 'Dettes de location-acquisition / crédit-bail mobilier'),
  ('SYSCOHADA', '284', 'Amortissements du matériel'),
  ('SYSCOHADA', '481', 'Fournisseurs d''investissements'),
  ('SYSCOHADA', '561', 'Crédits de trésorerie (dont crédits de campagne)'),
  ('SYSCOHADA', '671', 'Intérêts des emprunts'),
  ('SYSCOHADA', '681', 'Dotations aux amortissements d''exploitation'),
  ('SYSCOHADA', '865', 'Reprises de subventions d''investissement')
on conflict do nothing;

insert into comptes_comptables (organisation_id, numero, libelle)
select o.id, m.numero, m.libelle
from organisations o
join modeles_plan_comptable m on m.referentiel = o.referentiel
where m.numero in ('173', '284', '481', '561', '671', '681', '865')
on conflict do nothing;

update comptes_comptables set lettrable = true where numero = '481';

-- ============================================================
-- Contrats de financement
-- ============================================================
create table contrats_financement (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  code text not null,
  libelle text not null,
  type text not null check (type in (
    'emprunt_investissement', 'credit_campagne', 'fonds_commercialisation', 'credit_bail'
  )),
  bailleur_id uuid not null references tiers(id) on delete restrict,
  campagne_id uuid references campagnes(id) on delete restrict,
  departement_id uuid not null references departements(id) on delete restrict,   -- imputation des intérêts
  montant_accorde numeric(18,2) not null check (montant_accorde > 0),
  taux_annuel numeric(6,3) not null default 0 check (taux_annuel >= 0),
  duree_mois integer not null check (duree_mois > 0),
  periodicite_mois integer not null default 1 check (periodicite_mois in (1, 2, 3, 6, 12)),
  mode_remboursement text not null default 'annuite_constante'
    check (mode_remboursement in ('annuite_constante', 'capital_constant', 'in_fine')),
  date_debut date not null,
  garantie text,
  statut text not null default 'actif' check (statut in ('actif', 'solde')),
  created_at timestamptz not null default now(),
  unique (organisation_id, code)
);

create table tirages_financement (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  contrat_id uuid not null references contrats_financement(id) on delete restrict,
  date_tirage date not null,
  montant numeric(18,2) not null check (montant > 0),
  compte_tresorerie_id uuid references comptes_tresorerie(id) on delete restrict,   -- null : crédit-bail
  reference text,
  created_at timestamptz not null default now()
);

create table echeances_financement (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  contrat_id uuid not null references contrats_financement(id) on delete cascade,
  numero integer not null,
  date_echeance date not null,
  capital numeric(18,2) not null check (capital >= 0),
  interets numeric(18,2) not null check (interets >= 0),
  statut text not null default 'a_payer' check (statut in ('a_payer', 'payee')),
  date_paiement date,
  unique (contrat_id, numero)
);

create table remboursements_financement (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  contrat_id uuid not null references contrats_financement(id) on delete restrict,
  echeance_id uuid not null references echeances_financement(id) on delete restrict,
  date_remboursement date not null,
  capital numeric(18,2) not null,
  interets numeric(18,2) not null,
  compte_tresorerie_id uuid not null references comptes_tresorerie(id) on delete restrict,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- Le règlement d'un fournisseur peut être imputé sur un crédit de campagne ou un fonds de
-- commercialisation (montant consommé) et viser une dette d'investissement (compte 481).
alter table reglements
  add column contrat_financement_id uuid references contrats_financement(id) on delete restrict,
  add column nature text not null default 'courant' check (nature in ('courant', 'immobilisation'));

create trigger tirages_immuables before update or delete on tirages_financement
  for each row execute function interdire_modification_doc();
create trigger remboursements_immuables before update or delete on remboursements_financement
  for each row execute function interdire_modification_doc();

-- ============================================================
-- Matériel et subventions
-- ============================================================
create table materiels (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  code text not null,
  designation text not null,
  categorie text not null check (categorie in ('hydraulique', 'agricole', 'transport', 'usine', 'autre')),
  mode_acquisition text not null check (mode_acquisition in ('achat', 'credit_bail')),
  fournisseur_id uuid not null references tiers(id) on delete restrict,
  date_acquisition date not null,
  date_mise_service date,
  cout_acquisition numeric(18,2) not null check (cout_acquisition > 0),      -- coût global (subvention incluse)
  valeur_residuelle numeric(18,2) not null default 0 check (valeur_residuelle >= 0),
  duree_amortissement_mois integer not null check (duree_amortissement_mois > 0),
  departement_id uuid not null references departements(id) on delete restrict,
  secteur_id uuid references secteurs_projets(id) on delete restrict,
  contrat_financement_id uuid references contrats_financement(id) on delete restrict,
  statut text not null default 'en_service' check (statut in ('en_service', 'hors_service', 'cede')),
  created_at timestamptz not null default now(),
  unique (organisation_id, code),
  check (valeur_residuelle < cout_acquisition)
);

create table dotations_amortissement (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  materiel_id uuid not null references materiels(id) on delete restrict,
  exercice_id uuid not null references exercices_comptables(id) on delete restrict,
  montant numeric(18,2) not null check (montant > 0),
  reprise_subvention numeric(18,2) not null default 0 check (reprise_subvention >= 0),
  created_at timestamptz not null default now(),
  unique (materiel_id, exercice_id)
);
create trigger dotations_immuables before update or delete on dotations_amortissement
  for each row execute function interdire_modification_doc();

create table subventions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  code text not null,
  libelle text not null,
  bailleur_id uuid not null references tiers(id) on delete restrict,
  materiel_id uuid references materiels(id) on delete restrict,
  montant_accorde numeric(18,2) not null check (montant_accorde > 0),
  date_octroi date not null,
  created_at timestamptz not null default now(),
  unique (organisation_id, code)
);

create table encaissements_subvention (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  subvention_id uuid not null references subventions(id) on delete restrict,
  date_encaissement date not null,
  montant numeric(18,2) not null check (montant > 0),
  compte_tresorerie_id uuid not null references comptes_tresorerie(id) on delete restrict,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create trigger encaissements_subv_immuables before update or delete on encaissements_subvention
  for each row execute function interdire_modification_doc();

create index on echeances_financement (contrat_id, statut);
create index on tirages_financement (contrat_id);
create index on dotations_amortissement (materiel_id);

-- ============================================================
-- Paramétrage comptable Phase 2 (idempotent)
-- ============================================================
create or replace function initialiser_phase2(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into parametres_comptables (organisation_id, cle, compte_id)
  select p_org, k.cle, c.id
  from (values
    ('emprunts', '16'), ('credit_tresorerie', '561'), ('credit_bail', '173'),
    ('interets_emprunts', '671'), ('fournisseurs_immo', '481'),
    ('immo_materiel', '24'), ('immo_transport', '245'), ('immo_installations', '23'),
    ('amortissements', '284'), ('dotations', '681'),
    ('subventions_invest', '14'), ('reprise_subventions', '865'),
    ('tva_recuperable_immo', '4451')
  ) as k(cle, numero)
  join comptes_comptables c on c.organisation_id = p_org and c.numero = k.numero
  on conflict do nothing;
end $$;

create or replace function initialiser_organisation(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ref referentiel_comptable;
begin
  select referentiel into v_ref from organisations where id = p_org;

  insert into comptes_comptables (organisation_id, numero, libelle, lettrable)
  select p_org, numero, libelle, left(numero, 3) in ('401', '411', '409', '419', '421', '422', '481')
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
  perform initialiser_phase2(p_org);
end $$;

do $$
declare o record;
begin
  for o in select id from organisations loop
    perform initialiser_phase2(o.id);
  end loop;
end $$;

-- ============================================================
-- Règlement de tiers : ajout de la nature (immobilisation) et de l'imputation sur un financement
-- (remplace la version de 02 ; même signature)
-- ============================================================
create or replace function enregistrer_reglement(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_id uuid := gen_random_uuid();
  v_date date := (p ->> 'date')::date;
  v_sens text := p ->> 'sens';
  v_tiers uuid := (p ->> 'tiers_id')::uuid;
  v_montant numeric := (p ->> 'montant')::numeric;
  v_nature text := coalesce(nullif(p ->> 'nature', ''), 'courant');
  v_ct comptes_tresorerie%rowtype;
  v_achat uuid := nullif(p ->> 'achat_id', '')::uuid;
  v_vente uuid := nullif(p ->> 'vente_id', '')::uuid;
  v_fin uuid := nullif(p ->> 'contrat_financement_id', '')::uuid;
  v_num text;
  v_ec jsonb;
  v_compte_tiers uuid;
begin
  if v_org is null or not has_role('admin', 'comptable') then
    raise exception 'Droits insuffisants';
  end if;
  if v_sens not in ('encaissement', 'paiement') then raise exception 'Sens invalide'; end if;
  if v_nature not in ('courant', 'immobilisation') then raise exception 'Nature invalide'; end if;
  if v_nature = 'immobilisation' and v_sens <> 'paiement' then
    raise exception 'La nature « immobilisation » ne concerne que les paiements de fournisseurs';
  end if;
  if v_montant is null or v_montant <= 0 then raise exception 'Montant invalide'; end if;
  perform assert_org('tiers', v_tiers, v_org);
  select * into v_ct from comptes_tresorerie where id = (p ->> 'compte_tresorerie_id')::uuid
    and organisation_id = v_org and actif;
  if not found then raise exception 'Compte de trésorerie introuvable'; end if;
  if v_achat is not null then perform assert_org('achats', v_achat, v_org); end if;
  if v_vente is not null then perform assert_org('ventes', v_vente, v_org); end if;
  if v_fin is not null then
    if v_sens <> 'paiement' then raise exception 'Seul un paiement peut consommer un financement'; end if;
    if not exists (select 1 from contrats_financement
                   where id = v_fin and organisation_id = v_org
                     and type in ('credit_campagne', 'fonds_commercialisation')) then
      raise exception 'Financement invalide : choisissez un crédit de campagne ou un fonds de commercialisation';
    end if;
  end if;

  v_num := prochain_numero(v_org, 'reglement', case v_sens when 'encaissement' then 'ENC' else 'PAY' end, v_date);
  insert into reglements (id, organisation_id, numero, date_reglement, sens, tiers_id, montant,
                          compte_tresorerie_id, reference, achat_id, vente_id, nature, contrat_financement_id)
    values (v_id, v_org, v_num, v_date, v_sens, v_tiers, v_montant, v_ct.id,
            nullif(p ->> 'reference', ''), v_achat, v_vente, v_nature, v_fin);

  if v_sens = 'encaissement' then
    v_ec := jsonb_build_array(
      ec_ligne(v_ct.compte_id, v_montant, 0, null, null, null, null, 'Encaissement ' || v_num),
      ec_ligne(param_compte(v_org, 'clients'), 0, v_montant, v_tiers, null, null, null, 'Encaissement ' || v_num));
  else
    v_compte_tiers := param_compte(v_org, case v_nature when 'immobilisation' then 'fournisseurs_immo' else 'fournisseurs' end);
    v_ec := jsonb_build_array(
      ec_ligne(v_compte_tiers, v_montant, 0, v_tiers, null, null, null, 'Paiement ' || v_num),
      ec_ligne(v_ct.compte_id, 0, v_montant, null, null, null, null, 'Paiement ' || v_num));
  end if;
  perform ecrire_interne(v_org, v_ct.journal_id, v_date,
    case v_sens when 'encaissement' then 'Encaissement ' else 'Paiement ' end || v_num,
    nullif(p ->> 'reference', ''), v_ec, 'reglements', v_id, null);
  return v_id;
end $$;

-- ============================================================
-- Financements : compte de passif selon le type
-- ============================================================
create or replace function compte_passif_financement(p_org uuid, p_type text) returns uuid
language plpgsql stable set search_path = public as $$
begin
  return param_compte(p_org, case p_type
    when 'emprunt_investissement' then 'emprunts'
    when 'credit_campagne' then 'credit_tresorerie'
    when 'fonds_commercialisation' then 'credit_tresorerie'
    when 'credit_bail' then 'credit_bail'
  end);
end $$;

-- Échéancier : annuité constante, capital constant ou in fine. Régénérable tant qu'aucune échéance n'est payée.
create or replace function generer_echeancier(p_contrat_id uuid, p_montant numeric default null,
                                              p_premiere date default null) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  c contrats_financement%rowtype;
  v_m numeric;
  n integer;
  r numeric;
  a numeric;
  solde numeric;
  k integer;
  v_int numeric;
  v_cap numeric;
  v_date date;
begin
  if v_org is null or not has_role('admin', 'comptable', 'direction') then
    raise exception 'Droits insuffisants';
  end if;
  select * into c from contrats_financement where id = p_contrat_id and organisation_id = v_org;
  if not found then raise exception 'Contrat introuvable'; end if;
  if exists (select 1 from echeances_financement where contrat_id = c.id and statut = 'payee') then
    raise exception 'Des échéances sont déjà payées : l''échéancier ne peut plus être régénéré';
  end if;
  delete from echeances_financement where contrat_id = c.id;

  v_m := coalesce(p_montant, c.montant_accorde);
  n := greatest(1, ceil(c.duree_mois::numeric / c.periodicite_mois)::integer);
  r := c.taux_annuel / 100 * c.periodicite_mois / 12;
  solde := v_m;
  if c.mode_remboursement = 'annuite_constante' and r > 0 then
    a := v_m * r / (1 - power(1 + r, -n));
  end if;

  for k in 1..n loop
    v_int := round(solde * r, 2);
    v_cap := case c.mode_remboursement
      when 'annuite_constante' then case when r > 0 then a - v_int else v_m / n end
      when 'capital_constant' then v_m / n
      else case when k = n then v_m else 0 end
    end;
    v_cap := round(v_cap, 2);
    if k = n then v_cap := solde; end if;
    v_date := (coalesce(p_premiere, (c.date_debut + make_interval(months => c.periodicite_mois))::date)
               + make_interval(months => (k - 1) * c.periodicite_mois))::date;
    insert into echeances_financement (organisation_id, contrat_id, numero, date_echeance, capital, interets)
      values (v_org, c.id, k, v_date, v_cap, v_int);
    solde := solde - v_cap;
  end loop;
  return n;
end $$;

-- payload : { contrat_id, date, montant, compte_tresorerie_id, reference? }
create or replace function enregistrer_tirage(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_id uuid := gen_random_uuid();
  v_date date := (p ->> 'date')::date;
  v_montant numeric := (p ->> 'montant')::numeric;
  c contrats_financement%rowtype;
  v_ct comptes_tresorerie%rowtype;
  v_deja numeric;
begin
  if v_org is null or not has_role('admin', 'comptable') then
    raise exception 'Droits insuffisants';
  end if;
  select * into c from contrats_financement where id = (p ->> 'contrat_id')::uuid and organisation_id = v_org;
  if not found then raise exception 'Contrat introuvable'; end if;
  if c.type = 'credit_bail' then
    raise exception 'Un crédit-bail est constaté à l''acquisition du matériel, sans tirage';
  end if;
  if v_montant is null or v_montant <= 0 then raise exception 'Montant invalide'; end if;
  select * into v_ct from comptes_tresorerie where id = (p ->> 'compte_tresorerie_id')::uuid
    and organisation_id = v_org and actif;
  if not found then raise exception 'Compte de trésorerie introuvable'; end if;
  select coalesce(sum(montant), 0) into v_deja from tirages_financement where contrat_id = c.id;
  if v_deja + v_montant > c.montant_accorde then
    raise exception 'Le total des tirages (%) dépasserait le montant accordé (%)', v_deja + v_montant, c.montant_accorde;
  end if;

  insert into tirages_financement (id, organisation_id, contrat_id, date_tirage, montant, compte_tresorerie_id, reference)
    values (v_id, v_org, c.id, v_date, v_montant, v_ct.id, nullif(p ->> 'reference', ''));
  perform ecrire_interne(v_org, v_ct.journal_id, v_date, 'Déblocage ' || c.code, nullif(p ->> 'reference', ''),
    jsonb_build_array(
      ec_ligne(v_ct.compte_id, v_montant, 0, null, null, null, null, 'Déblocage ' || c.code),
      ec_ligne(compte_passif_financement(v_org, c.type), 0, v_montant, c.bailleur_id, null, null, c.campagne_id, 'Déblocage ' || c.code)),
    'financements', v_id, null);
  return v_id;
end $$;

-- payload : { echeance_id, date, compte_tresorerie_id }
create or replace function rembourser_echeance(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_id uuid := gen_random_uuid();
  v_date date := (p ->> 'date')::date;
  e echeances_financement%rowtype;
  c contrats_financement%rowtype;
  v_ct comptes_tresorerie%rowtype;
  v_ec jsonb := '[]'::jsonb;
begin
  if v_org is null or not has_role('admin', 'comptable') then
    raise exception 'Droits insuffisants';
  end if;
  select * into e from echeances_financement where id = (p ->> 'echeance_id')::uuid and organisation_id = v_org;
  if not found then raise exception 'Échéance introuvable'; end if;
  if e.statut = 'payee' then raise exception 'Cette échéance est déjà payée'; end if;
  select * into c from contrats_financement where id = e.contrat_id;
  select * into v_ct from comptes_tresorerie where id = (p ->> 'compte_tresorerie_id')::uuid
    and organisation_id = v_org and actif;
  if not found then raise exception 'Compte de trésorerie introuvable'; end if;

  if e.capital > 0 then
    v_ec := v_ec || ec_ligne(compte_passif_financement(v_org, c.type), e.capital, 0, c.bailleur_id, null, null, c.campagne_id, 'Capital ' || c.code || ' éch. ' || e.numero);
  end if;
  if e.interets > 0 then
    v_ec := v_ec || ec_ligne(param_compte(v_org, 'interets_emprunts'), e.interets, 0, null, c.departement_id, null, c.campagne_id, 'Intérêts ' || c.code || ' éch. ' || e.numero);
  end if;
  if e.capital + e.interets <= 0 then raise exception 'Échéance nulle'; end if;
  v_ec := v_ec || ec_ligne(v_ct.compte_id, 0, e.capital + e.interets, null, null, null, null, 'Échéance ' || c.code || ' n°' || e.numero);

  perform ecrire_interne(v_org, v_ct.journal_id, v_date, 'Échéance ' || c.code || ' n°' || e.numero, null,
                         v_ec, 'financements', v_id, null);
  insert into remboursements_financement (id, organisation_id, contrat_id, echeance_id, date_remboursement,
                                          capital, interets, compte_tresorerie_id)
    values (v_id, v_org, c.id, e.id, v_date, e.capital, e.interets, v_ct.id);
  update echeances_financement set statut = 'payee', date_paiement = v_date where id = e.id;
  if not exists (select 1 from echeances_financement where contrat_id = c.id and statut = 'a_payer') then
    update contrats_financement set statut = 'solde' where id = c.id;
  end if;
  return v_id;
end $$;

-- ============================================================
-- Subventions d'investissement
-- payload : { subvention_id, date, montant, compte_tresorerie_id }
-- Constatée à l'encaissement : Dr banque / Cr 14. La reprise annuelle (865) suit l'amortissement du matériel lié.
-- ============================================================
create or replace function encaisser_subvention(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_id uuid := gen_random_uuid();
  v_date date := (p ->> 'date')::date;
  v_montant numeric := (p ->> 'montant')::numeric;
  s subventions%rowtype;
  v_ct comptes_tresorerie%rowtype;
  v_deja numeric;
begin
  if v_org is null or not has_role('admin', 'comptable') then
    raise exception 'Droits insuffisants';
  end if;
  select * into s from subventions where id = (p ->> 'subvention_id')::uuid and organisation_id = v_org;
  if not found then raise exception 'Subvention introuvable'; end if;
  if v_montant is null or v_montant <= 0 then raise exception 'Montant invalide'; end if;
  select * into v_ct from comptes_tresorerie where id = (p ->> 'compte_tresorerie_id')::uuid
    and organisation_id = v_org and actif;
  if not found then raise exception 'Compte de trésorerie introuvable'; end if;
  select coalesce(sum(montant), 0) into v_deja from encaissements_subvention where subvention_id = s.id;
  if v_deja + v_montant > s.montant_accorde then
    raise exception 'Le total encaissé dépasserait la subvention accordée';
  end if;

  insert into encaissements_subvention (id, organisation_id, subvention_id, date_encaissement, montant, compte_tresorerie_id)
    values (v_id, v_org, s.id, v_date, v_montant, v_ct.id);
  perform ecrire_interne(v_org, v_ct.journal_id, v_date, 'Subvention ' || s.code, null,
    jsonb_build_array(
      ec_ligne(v_ct.compte_id, v_montant, 0, null, null, null, null, 'Subvention ' || s.code),
      ec_ligne(param_compte(v_org, 'subventions_invest'), 0, v_montant, s.bailleur_id, null, null, null, 'Subvention ' || s.code)),
    'subventions', v_id, null);
  return v_id;
end $$;

-- ============================================================
-- Acquisition de matériel
-- payload : { code, designation, categorie, mode_acquisition: 'achat'|'credit_bail', fournisseur_id,
--             date_acquisition, date_mise_service?, cout, taux_tva?, valeur_residuelle?, duree_mois,
--             departement_id, secteur_id?,
--             (crédit-bail) taux_annuel, duree_contrat_mois, periodicite_mois, mode_remboursement }
-- achat      : Dr immobilisation (+ TVA récupérable) / Cr 481 fournisseur d'investissements
-- crédit-bail : Dr immobilisation / Cr 173 (valeur inscrite à l'actif) + contrat et échéancier
-- ============================================================
create or replace function acquerir_materiel(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_id uuid := gen_random_uuid();
  v_mode text := p ->> 'mode_acquisition';
  v_cat text := p ->> 'categorie';
  v_four uuid := (p ->> 'fournisseur_id')::uuid;
  v_date date := (p ->> 'date_acquisition')::date;
  v_cout numeric := (p ->> 'cout')::numeric;
  v_tva_taux numeric := coalesce(nullif(p ->> 'taux_tva', '')::numeric, 0);
  v_tva numeric;
  v_dep uuid := (p ->> 'departement_id')::uuid;
  v_sec uuid := nullif(p ->> 'secteur_id', '')::uuid;
  v_code text := upper(trim(p ->> 'code'));
  v_contrat uuid;
  v_compte_immo uuid;
  v_ec jsonb;
begin
  if v_org is null or not has_role('admin', 'comptable') then
    raise exception 'Droits insuffisants';
  end if;
  if v_mode not in ('achat', 'credit_bail') then raise exception 'Mode d''acquisition invalide'; end if;
  if v_cout is null or v_cout <= 0 then raise exception 'Coût invalide'; end if;
  perform assert_org('tiers', v_four, v_org);
  perform assert_org('departements', v_dep, v_org);
  if v_sec is not null then perform assert_org('secteurs_projets', v_sec, v_org); end if;

  v_compte_immo := param_compte(v_org, case v_cat
    when 'transport' then 'immo_transport'
    when 'usine' then 'immo_installations'
    else 'immo_materiel' end);

  if v_mode = 'credit_bail' then
    insert into contrats_financement (organisation_id, code, libelle, type, bailleur_id, departement_id,
        montant_accorde, taux_annuel, duree_mois, periodicite_mois, mode_remboursement, date_debut)
      values (v_org, 'CB-' || v_code, 'Crédit-bail ' || (p ->> 'designation'), 'credit_bail', v_four, v_dep,
        v_cout, coalesce(nullif(p ->> 'taux_annuel', '')::numeric, 0), (p ->> 'duree_contrat_mois')::integer,
        coalesce(nullif(p ->> 'periodicite_mois', '')::integer, 1),
        coalesce(nullif(p ->> 'mode_remboursement', ''), 'annuite_constante'), v_date)
      returning id into v_contrat;
    insert into tirages_financement (organisation_id, contrat_id, date_tirage, montant, reference)
      values (v_org, v_contrat, v_date, v_cout, 'Valeur d''entrée du bien');
  end if;

  insert into materiels (id, organisation_id, code, designation, categorie, mode_acquisition, fournisseur_id,
      date_acquisition, date_mise_service, cout_acquisition, valeur_residuelle, duree_amortissement_mois,
      departement_id, secteur_id, contrat_financement_id)
    values (v_id, v_org, v_code, p ->> 'designation', v_cat, v_mode, v_four, v_date,
      coalesce(nullif(p ->> 'date_mise_service', '')::date, v_date), v_cout,
      coalesce(nullif(p ->> 'valeur_residuelle', '')::numeric, 0), (p ->> 'duree_mois')::integer,
      v_dep, v_sec, v_contrat);

  if v_mode = 'achat' then
    v_tva := round(v_cout * v_tva_taux / 100, 2);
    v_ec := jsonb_build_array(ec_ligne(v_compte_immo, v_cout, 0, null, v_dep, v_sec, null, p ->> 'designation'));
    if v_tva > 0 then
      v_ec := v_ec || ec_ligne(param_compte(v_org, 'tva_recuperable_immo'), v_tva, 0, null, null, null, null, 'TVA sur immobilisation');
    end if;
    v_ec := v_ec || ec_ligne(param_compte(v_org, 'fournisseurs_immo'), 0, v_cout + v_tva, v_four, null, null, null, 'Acquisition ' || v_code);
    perform ecrire_interne(v_org, journal_de_type(v_org, 'achats'), v_date, 'Acquisition ' || v_code, null,
                           v_ec, 'materiels', v_id, null);
  else
    perform ecrire_interne(v_org, journal_de_type(v_org, 'operations_diverses'), v_date,
      'Acquisition en crédit-bail ' || v_code, null,
      jsonb_build_array(
        ec_ligne(v_compte_immo, v_cout, 0, null, v_dep, v_sec, null, p ->> 'designation'),
        ec_ligne(param_compte(v_org, 'credit_bail'), 0, v_cout, v_four, null, null, null, 'Crédit-bail ' || v_code)),
      'materiels', v_id, null);
    perform generer_echeancier(v_contrat);
  end if;
  return v_id;
end $$;

-- ============================================================
-- Dotations aux amortissements d'un exercice (linéaire, au mois) + reprise des subventions
-- Cumul cible = base × mois écoulés / durée ; la dotation est l'écart avec les exercices antérieurs
-- (le dernier exercice solde donc exactement la base amortissable).
-- ============================================================
create or replace function comptabiliser_amortissements(p_exercice_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  x exercices_comptables%rowtype;
  m record;
  v_ec jsonb := '[]'::jsonb;
  v_n integer := 0;
  s integer; e integer; xe integer;
  v_base numeric; v_cible numeric; v_deja numeric; v_dot numeric;
  v_recu numeric; v_rep_deja numeric; v_rep numeric;
begin
  if v_org is null or not has_role('admin', 'comptable') then
    raise exception 'Droits insuffisants';
  end if;
  select * into x from exercices_comptables where id = p_exercice_id and organisation_id = v_org;
  if not found then raise exception 'Exercice introuvable'; end if;
  if x.statut <> 'ouvert' then raise exception 'Exercice clôturé'; end if;
  xe := extract(year from x.date_fin)::integer * 12 + extract(month from x.date_fin)::integer - 1;

  for m in select * from materiels where organisation_id = v_org and statut = 'en_service' order by code loop
    if exists (select 1 from dotations_amortissement where materiel_id = m.id and exercice_id = x.id) then
      continue;
    end if;
    s := extract(year from coalesce(m.date_mise_service, m.date_acquisition))::integer * 12
       + extract(month from coalesce(m.date_mise_service, m.date_acquisition))::integer - 1;
    e := s + m.duree_amortissement_mois - 1;
    if s > xe then continue; end if;

    v_base := m.cout_acquisition - m.valeur_residuelle;
    v_cible := round(v_base * greatest(0, least(e, xe) - s + 1) / m.duree_amortissement_mois, 2);
    select coalesce(sum(d.montant), 0), coalesce(sum(d.reprise_subvention), 0) into v_deja, v_rep_deja
      from dotations_amortissement d
      join exercices_comptables ex on ex.id = d.exercice_id
      where d.materiel_id = m.id and ex.date_fin < x.date_debut;
    v_dot := v_cible - v_deja;
    if v_dot <= 0 then continue; end if;

    select coalesce(sum(es.montant), 0) into v_recu
      from encaissements_subvention es
      join subventions su on su.id = es.subvention_id
      where su.materiel_id = m.id;
    v_rep := 0;
    if v_recu > 0 then
      v_rep := greatest(0, least(v_recu, round(v_recu * (v_deja + v_dot) / m.cout_acquisition, 2)) - v_rep_deja);
    end if;

    insert into dotations_amortissement (organisation_id, materiel_id, exercice_id, montant, reprise_subvention)
      values (v_org, m.id, x.id, v_dot, v_rep);
    v_ec := v_ec
      || ec_ligne(param_compte(v_org, 'dotations'), v_dot, 0, null, m.departement_id, m.secteur_id, null, 'Dotation ' || m.code)
      || ec_ligne(param_compte(v_org, 'amortissements'), 0, v_dot, null, null, null, null, 'Amortissement ' || m.code);
    if v_rep > 0 then
      v_ec := v_ec
        || ec_ligne(param_compte(v_org, 'subventions_invest'), v_rep, 0, null, null, null, null, 'Reprise subvention ' || m.code)
        || ec_ligne(param_compte(v_org, 'reprise_subventions'), 0, v_rep, null, null, null, null, 'Reprise subvention ' || m.code);
    end if;
    v_n := v_n + 1;
  end loop;

  if v_n = 0 then raise exception 'Aucune dotation à comptabiliser pour cet exercice'; end if;
  perform ecrire_interne(v_org, journal_de_type(v_org, 'operations_diverses'), x.date_fin,
    'Dotations aux amortissements ' || x.libelle, null, v_ec, 'amortissements', x.id, null);
  return v_n;
end $$;

-- ============================================================
-- Vues et plan théorique
-- ============================================================
create view v_financements with (security_invoker = true) as
select c.*,
       coalesce(t.recu, 0) as montant_recu,
       coalesce(r.capital, 0) as capital_rembourse,
       coalesce(r.interets, 0) as interets_payes,
       coalesce(t.recu, 0) - coalesce(r.capital, 0) as encours,
       coalesce(g.consomme, 0) as montant_consomme,
       case when coalesce(t.recu, 0) > 0 then round(coalesce(g.consomme, 0) / t.recu * 100, 1) end as taux_utilisation,
       (select min(e.date_echeance) from echeances_financement e where e.contrat_id = c.id and e.statut = 'a_payer') as prochaine_echeance
from contrats_financement c
left join (select contrat_id, sum(montant) as recu from tirages_financement group by contrat_id) t on t.contrat_id = c.id
left join (select contrat_id, sum(capital) as capital, sum(interets) as interets from remboursements_financement group by contrat_id) r on r.contrat_id = c.id
left join (select contrat_financement_id as contrat_id, sum(montant) as consomme from reglements
           where contrat_financement_id is not null group by contrat_financement_id) g on g.contrat_id = c.id;

create view v_subventions with (security_invoker = true) as
select s.*,
       coalesce(e.encaisse, 0) as montant_encaisse,
       s.montant_accorde - coalesce(e.encaisse, 0) as reste_a_encaisser,
       coalesce(d.reprises, 0) as reprises_cumulees,
       coalesce(e.encaisse, 0) - coalesce(d.reprises, 0) as solde_compte_14
from subventions s
left join (select subvention_id, sum(montant) as encaisse from encaissements_subvention group by subvention_id) e on e.subvention_id = s.id
left join (select materiel_id, sum(reprise_subvention) as reprises from dotations_amortissement group by materiel_id) d on d.materiel_id = s.materiel_id;

create view v_materiels with (security_invoker = true) as
select m.*,
       coalesce(a.cumul, 0) as cumul_amortissement,
       m.cout_acquisition - coalesce(a.cumul, 0) as valeur_nette_comptable
from materiels m
left join (select materiel_id, sum(montant) as cumul from dotations_amortissement group by materiel_id) a on a.materiel_id = m.id;

create or replace function plan_amortissement(p_materiel uuid)
returns table (annee integer, mois integer, dotation numeric, cumul numeric, vnc numeric)
language sql stable set search_path = public as $$
  with m as (
    select cout_acquisition as cout, cout_acquisition - valeur_residuelle as base,
           duree_amortissement_mois as duree,
           extract(year from coalesce(date_mise_service, date_acquisition))::integer * 12
             + extract(month from coalesce(date_mise_service, date_acquisition))::integer - 1 as s
    from materiels where id = p_materiel
  ),
  annees as (
    select m.*, m.s + m.duree - 1 as e, generate_series(m.s / 12, (m.s + m.duree - 1) / 12) as y from m
  ),
  calc as (
    select y, cout,
           least(e, y * 12 + 11) - greatest(s, y * 12) + 1 as mois,
           round(base * (least(e, y * 12 + 11) - s + 1) / duree, 2) as cumul
    from annees
  )
  select y, mois, cumul - coalesce(lag(cumul) over (order by y), 0), cumul, cout - cumul
  from calc order by y
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table contrats_financement enable row level security;
alter table tirages_financement enable row level security;
alter table echeances_financement enable row level security;
alter table remboursements_financement enable row level security;
alter table materiels enable row level security;
alter table dotations_amortissement enable row level security;
alter table subventions enable row level security;
alter table encaissements_subvention enable row level security;

create policy cf_select on contrats_financement for select using (organisation_id = current_org_id());
create policy cf_write on contrats_financement for all
  using (organisation_id = current_org_id() and has_role('admin', 'comptable', 'direction'))
  with check (organisation_id = current_org_id());
create policy tf_select on tirages_financement for select using (organisation_id = current_org_id());
create policy ef_select on echeances_financement for select using (organisation_id = current_org_id());
create policy rf_select on remboursements_financement for select using (organisation_id = current_org_id());
create policy mat_select on materiels for select using (organisation_id = current_org_id());
create policy dot_select on dotations_amortissement for select using (organisation_id = current_org_id());
create policy subv_select on subventions for select using (organisation_id = current_org_id());
create policy subv_write on subventions for all
  using (organisation_id = current_org_id() and has_role('admin', 'comptable', 'direction'))
  with check (organisation_id = current_org_id());
create policy es_select on encaissements_subvention for select using (organisation_id = current_org_id());

-- ============================================================
-- Droits d'exécution
-- ============================================================
revoke execute on function initialiser_phase2(uuid), compte_passif_financement(uuid, text)
  from public, anon, authenticated;

revoke execute on function
  generer_echeancier(uuid, numeric, date), enregistrer_tirage(jsonb), rembourser_echeance(jsonb),
  encaisser_subvention(jsonb), acquerir_materiel(jsonb), comptabiliser_amortissements(uuid),
  plan_amortissement(uuid)
from public, anon;

grant execute on function
  generer_echeancier(uuid, numeric, date), enregistrer_tirage(jsonb), rembourser_echeance(jsonb),
  encaisser_subvention(jsonb), acquerir_materiel(jsonb), comptabiliser_amortissements(uuid),
  plan_amortissement(uuid)
to authenticated;

revoke execute on function enregistrer_reglement(jsonb) from public, anon;
grant execute on function enregistrer_reglement(jsonb) to authenticated;
revoke execute on function initialiser_organisation(uuid) from public, anon, authenticated;
