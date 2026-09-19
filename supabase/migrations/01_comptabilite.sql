-- D-AGROBUSINESS — Phase 0 : moteur comptable analytique
-- Écritures immuables (append-only), équilibrées, imputées sur 3 axes :
-- département × secteur/projet × campagne. Correction uniquement par contre-passation.

-- ============================================================
-- Plan comptable
-- ============================================================
create table modeles_plan_comptable (
  referentiel referentiel_comptable not null,
  numero text not null,
  libelle text not null,
  primary key (referentiel, numero)
);

create table comptes_comptables (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  numero text not null check (numero ~ '^[0-9]{1,10}$'),
  libelle text not null,
  classe smallint generated always as (left(numero, 1)::smallint) stored,
  lettrable boolean not null default false,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organisation_id, numero)
);
create index on comptes_comptables (organisation_id, classe);

create table journaux (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  code text not null,
  libelle text not null,
  type text not null check (type in (
    'achats', 'ventes', 'banque', 'caisse', 'operations_diverses', 'paie', 'stock', 'a_nouveaux'
  )),
  actif boolean not null default true,
  unique (organisation_id, code)
);

-- ============================================================
-- Écritures
-- ============================================================
create table compteurs_ecritures (
  organisation_id uuid not null,
  exercice_id uuid not null,
  journal_id uuid not null,
  dernier_numero integer not null default 0,
  primary key (organisation_id, exercice_id, journal_id)
);

create table ecritures (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  exercice_id uuid not null references exercices_comptables(id) on delete restrict,
  journal_id uuid not null references journaux(id) on delete restrict,
  numero integer not null,
  date_ecriture date not null,
  reference_piece text,
  libelle text not null,
  source_module text,                       -- ex. 'achats', 'paie', 'amortissements'
  source_id uuid,
  contrepassation_de uuid references ecritures(id),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (organisation_id, exercice_id, journal_id, numero)
);
create unique index ecritures_une_seule_contrepassation on ecritures (contrepassation_de)
  where contrepassation_de is not null;
create index on ecritures (organisation_id, exercice_id, date_ecriture);
create index on ecritures (organisation_id, source_module, source_id);

create table lignes_ecritures (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  ecriture_id uuid not null references ecritures(id) on delete restrict,
  compte_id uuid not null references comptes_comptables(id) on delete restrict,
  tiers_id uuid references tiers(id) on delete restrict,
  libelle text,
  debit numeric(18,2) not null default 0 check (debit >= 0),
  credit numeric(18,2) not null default 0 check (credit >= 0),
  departement_id uuid references departements(id) on delete restrict,
  secteur_id uuid references secteurs_projets(id) on delete restrict,
  campagne_id uuid references campagnes(id) on delete restrict,
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);
create index on lignes_ecritures (ecriture_id);
create index on lignes_ecritures (organisation_id, compte_id);
create index on lignes_ecritures (organisation_id, departement_id, secteur_id, campagne_id);
create index on lignes_ecritures (tiers_id) where tiers_id is not null;

-- ============================================================
-- Garde-fous
-- ============================================================
create or replace function interdire_modification() returns trigger
language plpgsql as $$
begin
  raise exception 'Les écritures comptables sont immuables : utilisez une contre-passation (table %)', tg_table_name;
end $$;

create trigger ecritures_immuables before update or delete on ecritures
  for each row execute function interdire_modification();
create trigger lignes_immuables before update or delete on lignes_ecritures
  for each row execute function interdire_modification();

create or replace function controler_ligne_ecriture() returns trigger
language plpgsql as $$
declare
  v_ecr ecritures%rowtype;
  v_classe smallint;
  v_compte_org uuid;
  v_dep_secteur uuid;
begin
  select * into v_ecr from ecritures where id = new.ecriture_id;
  if v_ecr.organisation_id <> new.organisation_id then
    raise exception 'Ligne et écriture appartiennent à des organisations différentes';
  end if;

  select classe, organisation_id into v_classe, v_compte_org from comptes_comptables where id = new.compte_id;
  if v_compte_org <> new.organisation_id then
    raise exception 'Compte hors de l''organisation';
  end if;

  -- Double imputation : toute charge (6) / tout produit (7) doit porter un département.
  if v_classe in (6, 7) and new.departement_id is null then
    raise exception 'Imputation analytique obligatoire (département) sur les comptes de classe 6 et 7';
  end if;

  if new.secteur_id is not null then
    select departement_id into v_dep_secteur from secteurs_projets
      where id = new.secteur_id and organisation_id = new.organisation_id;
    if v_dep_secteur is null then
      raise exception 'Secteur/projet inconnu pour cette organisation';
    end if;
    if new.departement_id is distinct from v_dep_secteur then
      raise exception 'Le secteur/projet n''appartient pas au département imputé';
    end if;
  end if;

  return new;
end $$;

create trigger lignes_controle before insert on lignes_ecritures
  for each row execute function controler_ligne_ecriture();

-- Équilibre débit = crédit, vérifié en fin de transaction.
create or replace function controler_equilibre() returns trigger
language plpgsql as $$
declare
  v_debit numeric;
  v_credit numeric;
  v_nb integer;
begin
  select coalesce(sum(debit), 0), coalesce(sum(credit), 0), count(*)
    into v_debit, v_credit, v_nb
    from lignes_ecritures where ecriture_id = new.ecriture_id;
  if v_nb < 2 then
    raise exception 'Une écriture comporte au moins deux lignes';
  end if;
  if v_debit <> v_credit then
    raise exception 'Écriture déséquilibrée : débit % <> crédit %', v_debit, v_credit;
  end if;
  return null;
end $$;

create constraint trigger lignes_equilibre after insert on lignes_ecritures
  deferrable initially deferred
  for each row execute function controler_equilibre();

-- ============================================================
-- Saisie et contre-passation (seul chemin d'écriture)
-- ============================================================
create or replace function enregistrer_ecriture(
  p_journal_id uuid,
  p_date date,
  p_libelle text,
  p_reference text,
  p_lignes jsonb,
  p_source_module text default null,
  p_source_id uuid default null,
  p_contrepassation_de uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_exercice exercices_comptables%rowtype;
  v_numero integer;
  v_id uuid := gen_random_uuid();
  v_ligne jsonb;
begin
  if v_org is null or not has_role('admin', 'comptable') then
    raise exception 'Droits insuffisants pour saisir une écriture';
  end if;
  if not exists (select 1 from journaux where id = p_journal_id and organisation_id = v_org and actif) then
    raise exception 'Journal introuvable';
  end if;
  if jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) < 2 then
    raise exception 'Une écriture comporte au moins deux lignes';
  end if;

  select * into v_exercice from exercices_comptables
    where organisation_id = v_org and p_date between date_debut and date_fin;
  if not found then
    raise exception 'Aucun exercice ne couvre la date %', p_date;
  end if;
  if v_exercice.statut <> 'ouvert' then
    raise exception 'L''exercice % est clôturé', v_exercice.libelle;
  end if;

  insert into compteurs_ecritures (organisation_id, exercice_id, journal_id, dernier_numero)
    values (v_org, v_exercice.id, p_journal_id, 1)
    on conflict (organisation_id, exercice_id, journal_id)
    do update set dernier_numero = compteurs_ecritures.dernier_numero + 1
    returning dernier_numero into v_numero;

  insert into ecritures (id, organisation_id, exercice_id, journal_id, numero, date_ecriture,
                         reference_piece, libelle, source_module, source_id, contrepassation_de)
  values (v_id, v_org, v_exercice.id, p_journal_id, v_numero, p_date,
          p_reference, p_libelle, p_source_module, p_source_id, p_contrepassation_de);

  for v_ligne in select * from jsonb_array_elements(p_lignes) loop
    insert into lignes_ecritures (organisation_id, ecriture_id, compte_id, tiers_id, libelle,
                                  debit, credit, departement_id, secteur_id, campagne_id)
    values (
      v_org, v_id,
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

create or replace function contrepasser_ecriture(p_ecriture_id uuid, p_date date, p_motif text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_ecr ecritures%rowtype;
  v_lignes jsonb;
begin
  if v_org is null or not has_role('admin', 'comptable') then
    raise exception 'Droits insuffisants';
  end if;
  select * into v_ecr from ecritures where id = p_ecriture_id and organisation_id = v_org;
  if not found then
    raise exception 'Écriture introuvable';
  end if;
  if v_ecr.contrepassation_de is not null then
    raise exception 'Une contre-passation ne peut pas être elle-même contre-passée';
  end if;
  if exists (select 1 from ecritures where contrepassation_de = p_ecriture_id) then
    raise exception 'Cette écriture a déjà été contre-passée';
  end if;

  select jsonb_agg(jsonb_build_object(
      'compte_id', compte_id, 'tiers_id', tiers_id, 'libelle', libelle,
      'debit', credit, 'credit', debit,
      'departement_id', departement_id, 'secteur_id', secteur_id, 'campagne_id', campagne_id))
    into v_lignes from lignes_ecritures where ecriture_id = p_ecriture_id;

  return enregistrer_ecriture(
    v_ecr.journal_id, p_date,
    'Contre-passation écr. n°' || v_ecr.numero || ' — ' || coalesce(p_motif, v_ecr.libelle),
    v_ecr.reference_piece, v_lignes, v_ecr.source_module, v_ecr.source_id, p_ecriture_id);
end $$;

revoke all on function enregistrer_ecriture from public;
revoke all on function contrepasser_ecriture from public;
grant execute on function enregistrer_ecriture to authenticated;
grant execute on function contrepasser_ecriture to authenticated;

-- ============================================================
-- Vues de restitution (RLS de l'appelant appliquée)
-- ============================================================
create view v_balance with (security_invoker = true) as
select l.organisation_id, e.exercice_id, c.id as compte_id, c.numero, c.libelle, c.classe,
       sum(l.debit) as total_debit, sum(l.credit) as total_credit,
       sum(l.debit) - sum(l.credit) as solde
from lignes_ecritures l
join ecritures e on e.id = l.ecriture_id
join comptes_comptables c on c.id = l.compte_id
group by l.organisation_id, e.exercice_id, c.id, c.numero, c.libelle, c.classe;

create view v_resultat_analytique with (security_invoker = true) as
select l.organisation_id, e.exercice_id, l.departement_id, l.secteur_id, l.campagne_id,
       sum(case when c.classe = 7 then l.credit - l.debit else 0 end) as produits,
       sum(case when c.classe = 6 then l.debit - l.credit else 0 end) as charges,
       sum(case when c.classe = 7 then l.credit - l.debit else 0 end)
         - sum(case when c.classe = 6 then l.debit - l.credit else 0 end) as resultat
from lignes_ecritures l
join ecritures e on e.id = l.ecriture_id
join comptes_comptables c on c.id = l.compte_id
where c.classe in (6, 7)
group by l.organisation_id, e.exercice_id, l.departement_id, l.secteur_id, l.campagne_id;

-- ============================================================
-- Audit + RLS
-- ============================================================
create trigger audit_comptes after insert or update or delete on comptes_comptables
  for each row execute function audit_trigger();
create trigger audit_journaux after insert or update or delete on journaux
  for each row execute function audit_trigger();

alter table modeles_plan_comptable enable row level security;
alter table comptes_comptables enable row level security;
alter table journaux enable row level security;
alter table compteurs_ecritures enable row level security;
alter table ecritures enable row level security;
alter table lignes_ecritures enable row level security;

create policy modeles_select on modeles_plan_comptable for select to authenticated using (true);

create policy comptes_select on comptes_comptables for select using (organisation_id = current_org_id());
create policy comptes_write on comptes_comptables for all
  using (organisation_id = current_org_id() and has_role('admin', 'comptable'))
  with check (organisation_id = current_org_id());

create policy journaux_select on journaux for select using (organisation_id = current_org_id());
create policy journaux_write on journaux for all
  using (organisation_id = current_org_id() and has_role('admin', 'comptable'))
  with check (organisation_id = current_org_id());

-- Aucune policy d'écriture sur compteurs/écritures/lignes : seules les RPC (security definer) écrivent.
create or replace function departements_accessibles() returns setof uuid
language sql stable security definer set search_path = public as $$
  select departement_id from utilisateur_departements where utilisateur_id = auth.uid()
$$;

create policy lignes_select on lignes_ecritures for select using (
  organisation_id = current_org_id() and (
    has_role('admin', 'comptable', 'direction', 'lecteur')
    or (has_role('chef_departement') and departement_id in (select departements_accessibles()))
  )
);

create policy ecritures_select on ecritures for select using (
  organisation_id = current_org_id() and (
    has_role('admin', 'comptable', 'direction', 'lecteur')
    or (has_role('chef_departement') and exists (
      select 1 from lignes_ecritures l
      where l.ecriture_id = ecritures.id and l.departement_id in (select departements_accessibles())
    ))
  )
);

-- ============================================================
-- Modèles de plan comptable (à faire valider par un expert-comptable local)
-- ============================================================
insert into modeles_plan_comptable (referentiel, numero, libelle) values
-- SYSCOHADA révisé — comptes principaux
('SYSCOHADA','10','Capital'),
('SYSCOHADA','11','Réserves'),
('SYSCOHADA','12','Report à nouveau'),
('SYSCOHADA','13','Résultat net de l''exercice'),
('SYSCOHADA','14','Subventions d''investissement'),
('SYSCOHADA','15','Provisions réglementées'),
('SYSCOHADA','16','Emprunts et dettes assimilées'),
('SYSCOHADA','17','Dettes de location-acquisition (crédit-bail)'),
('SYSCOHADA','21','Immobilisations incorporelles'),
('SYSCOHADA','22','Terrains'),
('SYSCOHADA','23','Bâtiments, installations techniques et agencements'),
('SYSCOHADA','24','Matériel, mobilier et actifs biologiques'),
('SYSCOHADA','245','Matériel de transport'),
('SYSCOHADA','28','Amortissements'),
('SYSCOHADA','31','Marchandises'),
('SYSCOHADA','32','Matières premières et fournitures liées'),
('SYSCOHADA','33','Autres approvisionnements'),
('SYSCOHADA','36','Produits finis'),
('SYSCOHADA','37','Produits intermédiaires et résiduels'),
('SYSCOHADA','39','Dépréciations des stocks'),
('SYSCOHADA','401','Fournisseurs, dettes en compte'),
('SYSCOHADA','409','Fournisseurs débiteurs'),
('SYSCOHADA','411','Clients'),
('SYSCOHADA','419','Clients créditeurs'),
('SYSCOHADA','421','Personnel, avances et acomptes'),
('SYSCOHADA','422','Personnel, rémunérations dues'),
('SYSCOHADA','431','Sécurité sociale'),
('SYSCOHADA','4431','État, TVA facturée sur ventes'),
('SYSCOHADA','4441','État, TVA due'),
('SYSCOHADA','4451','État, TVA récupérable sur immobilisations'),
('SYSCOHADA','4452','État, TVA récupérable sur achats'),
('SYSCOHADA','447','État, impôts retenus à la source'),
('SYSCOHADA','462','Associés, comptes courants'),
('SYSCOHADA','47','Débiteurs et créditeurs divers'),
('SYSCOHADA','521','Banques locales'),
('SYSCOHADA','571','Caisse'),
('SYSCOHADA','601','Achats de marchandises'),
('SYSCOHADA','602','Achats de matières premières et fournitures liées'),
('SYSCOHADA','604','Achats stockés de matières et fournitures consommables'),
('SYSCOHADA','61','Transports'),
('SYSCOHADA','62','Services extérieurs A'),
('SYSCOHADA','63','Services extérieurs B'),
('SYSCOHADA','64','Impôts et taxes'),
('SYSCOHADA','66','Charges de personnel'),
('SYSCOHADA','67','Frais financiers et charges assimilées'),
('SYSCOHADA','68','Dotations aux amortissements'),
('SYSCOHADA','701','Ventes de marchandises'),
('SYSCOHADA','702','Ventes de produits finis'),
('SYSCOHADA','703','Ventes de produits intermédiaires et résiduels'),
('SYSCOHADA','706','Services vendus'),
('SYSCOHADA','707','Produits accessoires'),
('SYSCOHADA','71','Subventions d''exploitation'),
('SYSCOHADA','73','Variations de stocks de biens et services produits'),
('SYSCOHADA','77','Revenus financiers et produits assimilés'),
-- Plan comptable marocain (CGNC) — squelette par classes, à compléter
('PCM_MA','11','Capitaux propres'),
('PCM_MA','13','Capitaux propres assimilés (subventions d''investissement)'),
('PCM_MA','14','Dettes de financement'),
('PCM_MA','23','Immobilisations corporelles'),
('PCM_MA','28','Amortissements des immobilisations'),
('PCM_MA','31','Stocks'),
('PCM_MA','34','Créances de l''actif circulant'),
('PCM_MA','44','Dettes du passif circulant'),
('PCM_MA','51','Trésorerie - actif'),
('PCM_MA','61','Charges d''exploitation'),
('PCM_MA','63','Charges financières'),
('PCM_MA','71','Produits d''exploitation'),
('PCM_MA','73','Produits financiers'),
-- Plan comptable mauritanien — squelette par classes, à compléter
('PCM_MR','10','Capital et réserves'),
('PCM_MR','16','Emprunts et dettes assimilées'),
('PCM_MR','21','Immobilisations incorporelles'),
('PCM_MR','24','Matériel'),
('PCM_MR','28','Amortissements'),
('PCM_MR','31','Matières premières'),
('PCM_MR','35','Produits finis'),
('PCM_MR','40','Fournisseurs'),
('PCM_MR','41','Clients'),
('PCM_MR','42','Personnel'),
('PCM_MR','44','État et collectivités'),
('PCM_MR','52','Banques'),
('PCM_MR','57','Caisse'),
('PCM_MR','60','Achats'),
('PCM_MR','64','Charges de personnel'),
('PCM_MR','66','Charges financières'),
('PCM_MR','70','Ventes'),
('PCM_MR','74','Subventions d''exploitation');

-- ============================================================
-- Initialisation d'une organisation + inscription
-- ============================================================
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
end $$;
revoke all on function initialiser_organisation from public;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_pays text := upper(coalesce(new.raw_user_meta_data ->> 'pays', 'SN'));
  v_ref referentiel_comptable;
  v_devise text;
begin
  if new.raw_user_meta_data ->> 'organisation_nom' is null then
    return new;   -- utilisateur invité : rattachement manuel à une organisation
  end if;

  v_ref := case v_pays when 'MA' then 'PCM_MA' when 'MR' then 'PCM_MR' else 'SYSCOHADA' end;
  v_devise := case v_pays when 'MA' then 'MAD' when 'MR' then 'MRU' else 'XOF' end;

  insert into organisations (nom, pays, devise, referentiel)
    values (new.raw_user_meta_data ->> 'organisation_nom', v_pays, v_devise, v_ref)
    returning id into v_org;

  insert into utilisateurs (id, organisation_id, nom_complet, role)
    values (new.id, v_org, new.raw_user_meta_data ->> 'nom_complet', 'admin');

  perform initialiser_organisation(v_org);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
