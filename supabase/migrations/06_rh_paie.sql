-- D-AGROBUSINESS — Phase 4 : RH et paie.
--
-- Employés (permanent, saisonnier, journalier, prestataire), contrats, pointage, congés, bulletins de paie
-- avec cotisations et impôts PARAMÉTRABLES par organisation (aucun taux légal n'est codé en dur).
-- Verrou : la paie ne se calcule qu'après validation explicite du paramétrage par un administrateur ;
-- toute modification des règles ou du barème invalide cette validation.
--
-- Impôt et TRIMF : lus dans un barème de retenue à la source (table baremes_retenue) ou calculés (mode « calcul »).
-- Sénégal : barème officiel SN-2013 (annuel pour les permanents, mensuel pour les saisonniers, journalier pour les
-- journaliers) à importer depuis supabase/seed/bareme_retenue_sn_2013.csv ; cotisations IPRES / CSS / CFCE pré-remplies.
-- Autres pays : tables vides à renseigner (règles, barèmes importables et modifiables depuis l'application).

-- ============================================================
-- Comptes complémentaires SYSCOHADA
-- ============================================================
insert into modeles_plan_comptable (referentiel, numero, libelle) values
  ('SYSCOHADA', '442', 'État, impôts et taxes'),
  ('SYSCOHADA', '661', 'Rémunérations directes versées au personnel national'),
  ('SYSCOHADA', '664', 'Charges sociales')
on conflict do nothing;

insert into comptes_comptables (organisation_id, numero, libelle)
select o.id, m.numero, m.libelle
from organisations o
join modeles_plan_comptable m on m.referentiel = o.referentiel
where m.numero in ('442', '661', '664')
on conflict do nothing;

-- ============================================================
-- Personnel
-- ============================================================
create table employes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  matricule text not null,
  nom text not null,
  prenom text,
  statut text not null check (statut in ('permanent', 'saisonnier', 'journalier', 'prestataire')),
  poste text,
  date_embauche date not null,
  date_sortie date,
  departement_id uuid not null references departements(id) on delete restrict,
  secteur_id uuid references secteurs_projets(id) on delete restrict,
  situation_familiale text not null default 'celibataire'
    check (situation_familiale in ('celibataire', 'marie', 'divorce', 'veuf')),
  nombre_enfants integer not null default 0 check (nombre_enfants >= 0),
  nombre_conjoints integer not null default 0 check (nombre_conjoints between 0 and 4),   -- base de la TRIMF
  parts_ir numeric(3,1) not null default 1 check (parts_ir between 1 and 10),
  regime_ipres text not null default 'general' check (regime_ipres in ('general', 'cadre')),
  telephone text,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organisation_id, matricule)
);

create table contrats_travail (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  employe_id uuid not null references employes(id) on delete restrict,
  type text not null check (type in ('cdi', 'cdd', 'saisonnier', 'journalier', 'prestation')),
  date_debut date not null,
  date_fin date,
  salaire_base numeric(18,2) not null default 0 check (salaire_base >= 0),      -- mensuel (ou forfait prestataire)
  primes_mensuelles numeric(18,2) not null default 0 check (primes_mensuelles >= 0),
  taux_journalier numeric(18,2) check (taux_journalier >= 0),
  created_at timestamptz not null default now(),
  check (date_fin is null or date_fin >= date_debut)
);
create index on contrats_travail (employe_id, date_debut);

create table pointages (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  employe_id uuid not null references employes(id) on delete restrict,
  date_pointage date not null,
  statut text not null check (statut in (
    'present', 'demi_journee', 'conge_paye', 'maladie', 'absent', 'conge_sans_solde'
  )),
  departement_id uuid references departements(id) on delete restrict,   -- imputation du jour (sinon affectation de l'employé)
  secteur_id uuid references secteurs_projets(id) on delete restrict,
  campagne_id uuid references campagnes(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (employe_id, date_pointage)
);
create index on pointages (organisation_id, date_pointage);

create table demandes_conge (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  employe_id uuid not null references employes(id) on delete restrict,
  type text not null check (type in ('annuel', 'maladie', 'maternite', 'sans_solde', 'autre')),
  date_debut date not null,
  date_fin date not null,
  jours numeric(5,1) not null default 0,
  motif text,
  statut text not null default 'demande' check (statut in ('demande', 'approuve', 'refuse')),
  traite_par uuid,
  created_at timestamptz not null default now(),
  check (date_fin >= date_debut)
);

create or replace function jours_ouvrables(d1 date, d2 date) returns numeric
language sql immutable as $$
  select count(*)::numeric
  from generate_series(d1::timestamp, d2::timestamp, interval '1 day') g
  where extract(dow from g) <> 0
$$;

create or replace function conge_calculer_jours() returns trigger
language plpgsql as $$
begin
  new.jours := jours_ouvrables(new.date_debut, new.date_fin);
  return new;
end $$;
create trigger conge_jours before insert on demandes_conge
  for each row execute function conge_calculer_jours();

-- ============================================================
-- Paramétrage de la paie (par organisation)
-- ============================================================
create table parametrage_paie (
  organisation_id uuid primary key references organisations(id) on delete cascade,
  pays text not null,
  jours_par_mois numeric(4,1) not null default 30 check (jours_par_mois > 0),
  jours_conge_par_mois numeric(4,2) not null default 2,
  abattement_pct numeric(5,2) not null default 0 check (abattement_pct between 0 and 100),
  abattement_plafond_annuel numeric(18,2),
  statuts_ir text[] not null default '{permanent,saisonnier,journalier}',
  -- 'table' : impôt et TRIMF lus dans un barème de retenue à la source (baremes_retenue) ;
  -- 'calcul' : barème progressif + abattement + réductions de famille (tables bareme_ir, reductions_famille…)
  mode_ir text not null default 'calcul' check (mode_ir in ('table', 'calcul')),
  bareme_version text,
  -- barème de lecture selon le statut (Sénégal : permanent → annuel, saisonnier → mensuel, journalier → journalier)
  periodicite_par_statut jsonb not null
    default '{"permanent":"annuel","saisonnier":"mensuel","journalier":"journalier"}',
  valide_le timestamptz,
  valide_par uuid
);

-- Barèmes de retenue à la source lus par ligne de revenu brut (impôt selon le nombre de parts + TRIMF par personne).
-- organisation_id null : référence globale (importée depuis supabase/seed/*.csv, lecture seule) ;
-- non null : version propre à l'organisation, importable et modifiable depuis l'application.
create table baremes_retenue (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references organisations(id) on delete cascade,
  version text not null,                                -- ex. 'SN-2013'
  pays text not null default 'SN',
  periodicite text not null check (periodicite in ('annuel', 'mensuel', 'journalier')),
  revenu_brut numeric(18,2) not null,
  trimf numeric(18,2) not null default 0,
  ir_1 numeric(18,2) not null,
  ir_1_5 numeric(18,2) not null,
  ir_2 numeric(18,2) not null,
  ir_2_5 numeric(18,2) not null,
  ir_3 numeric(18,2) not null,
  ir_3_5 numeric(18,2) not null,
  ir_4 numeric(18,2) not null,
  ir_4_5 numeric(18,2) not null,
  ir_5 numeric(18,2) not null
);
create unique index baremes_retenue_unique on baremes_retenue
  ((coalesce(organisation_id, '00000000-0000-0000-0000-000000000000'::uuid)), version, periodicite, revenu_brut);
create index on baremes_retenue (version, periodicite, revenu_brut);

create table regles_paie (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  code text not null,
  libelle text not null,
  taux_salarie numeric(6,3) not null default 0 check (taux_salarie >= 0),
  taux_employeur numeric(6,3) not null default 0 check (taux_employeur >= 0),
  plancher_mensuel numeric(18,2) not null default 0,       -- assiette = min(brut, plafond) − plancher
  plafond_mensuel numeric(18,2),
  statuts text[] not null default '{permanent,saisonnier,journalier}',
  regime text check (regime in ('general', 'cadre')),      -- null : tous
  deductible_ir boolean not null default false,
  compte_cle text not null default 'organismes_sociaux',   -- clé de parametres_comptables (431, 442…)
  ordre integer not null default 10,
  date_debut date not null default '2000-01-01',
  date_fin date,
  actif boolean not null default true,
  unique (organisation_id, code, date_debut)
);

create table bareme_ir (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  tranche_min numeric(18,2) not null,
  tranche_max numeric(18,2),
  taux numeric(6,3) not null check (taux >= 0 and taux <= 100),
  unique (organisation_id, tranche_min)
);

create table reductions_famille (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  parts numeric(3,1) not null,
  taux numeric(6,3) not null check (taux >= 0 and taux <= 100),
  minimum numeric(18,2) not null default 0,
  maximum numeric(18,2),
  unique (organisation_id, parts)
);

-- Forfaits par tranche de salaire annuel (ex. TRIMF), retenus mensuellement à 1/12
create table tranches_forfaitaires (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  code text not null default 'TRIMF',
  libelle text not null default 'TRIMF',
  salaire_min_annuel numeric(18,2) not null,
  salaire_max_annuel numeric(18,2),
  montant_annuel numeric(18,2) not null check (montant_annuel >= 0),
  unique (organisation_id, code, salaire_min_annuel)
);

create or replace function invalider_parametrage_paie() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update parametrage_paie set valide_le = null, valide_par = null
    where organisation_id = case when tg_op = 'DELETE' then old.organisation_id else new.organisation_id end;
  return null;
end $$;

create trigger regles_invalident after insert or update or delete on regles_paie
  for each row execute function invalider_parametrage_paie();
create trigger bareme_invalide after insert or update or delete on bareme_ir
  for each row execute function invalider_parametrage_paie();
-- Les modifications du barème de lecture propre à l'organisation invalident aussi la validation
-- (les lignes de la référence globale n'ont pas d'organisation : le déclencheur ne les traite pas).
create trigger baremes_retenue_invalident after insert or update or delete on baremes_retenue
  for each row execute function invalider_parametrage_paie();
create trigger reductions_invalident after insert or update or delete on reductions_famille
  for each row execute function invalider_parametrage_paie();
create trigger forfaits_invalident after insert or update or delete on tranches_forfaitaires
  for each row execute function invalider_parametrage_paie();

create or replace function parametrage_modifie() returns trigger
language plpgsql as $$
begin
  if (new.jours_par_mois, new.jours_conge_par_mois, new.abattement_pct, new.abattement_plafond_annuel,
      new.statuts_ir, new.mode_ir, new.bareme_version, new.periodicite_par_statut)
     is distinct from
     (old.jours_par_mois, old.jours_conge_par_mois, old.abattement_pct, old.abattement_plafond_annuel,
      old.statuts_ir, old.mode_ir, old.bareme_version, old.periodicite_par_statut) then
    new.valide_le := null;
    new.valide_par := null;
  end if;
  return new;
end $$;
create trigger parametrage_invalide before update on parametrage_paie
  for each row execute function parametrage_modifie();

-- ============================================================
-- Périodes et bulletins
-- ============================================================
create table periodes_paie (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  annee integer not null check (annee between 2000 and 2100),
  mois integer not null check (mois between 1 and 12),
  statut text not null default 'ouverte' check (statut in ('ouverte', 'validee', 'payee')),
  created_at timestamptz not null default now(),
  unique (organisation_id, annee, mois)
);

create table bulletins_paie (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  periode_id uuid not null references periodes_paie(id) on delete cascade,
  employe_id uuid not null references employes(id) on delete restrict,
  jours_payes numeric(6,1) not null default 0,
  jours_non_payes numeric(6,1) not null default 0,
  brut numeric(18,2) not null,
  total_retenues numeric(18,2) not null,
  net_a_payer numeric(18,2) not null,
  charges_patronales numeric(18,2) not null,
  cout_total numeric(18,2) not null,
  avertissements text,
  statut text not null default 'calcule' check (statut in ('calcule', 'valide', 'paye')),
  created_at timestamptz not null default now(),
  unique (periode_id, employe_id)
);

create table bulletins_lignes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  bulletin_id uuid not null references bulletins_paie(id) on delete cascade,
  ordre integer not null,
  code text not null,
  libelle text not null,
  type text not null check (type in ('gain', 'retenue_absence', 'retenue_salariale', 'charge_patronale')),
  base numeric(18,2),
  taux numeric(6,3),
  montant numeric(18,2) not null,
  compte_cle text
);
create index on bulletins_lignes (bulletin_id);

create table bulletins_imputations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  bulletin_id uuid not null references bulletins_paie(id) on delete cascade,
  departement_id uuid not null references departements(id) on delete restrict,
  secteur_id uuid references secteurs_projets(id) on delete restrict,
  campagne_id uuid references campagnes(id) on delete restrict,
  quote_part numeric(12,8) not null check (quote_part > 0 and quote_part <= 1)
);
create index on bulletins_imputations (bulletin_id);

-- ============================================================
-- Calcul de la paie d'une période
-- ============================================================
create or replace function calculer_paie(p_periode_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  per periodes_paie%rowtype;
  par parametrage_paie%rowtype;
  e employes%rowtype;
  c contrats_travail%rowtype;
  r regles_paie%rowtype;
  rf reductions_famille%rowtype;
  v_dec integer;
  d_debut date; d_fin date;
  v_n integer := 0;
  v_id uuid;
  v_jp numeric; v_jnp numeric;
  v_base numeric; v_prime numeric; v_abs numeric; v_brut numeric;
  v_assiette numeric; v_sal numeric; v_pat numeric;
  v_ordre integer;
  v_tot_sal numeric; v_tot_pat numeric; v_ded_ir numeric;
  v_annuel numeric; v_abatt numeric; v_imp_brut numeric; v_ricf numeric; v_ir numeric;
  v_forfait numeric;
  v_avert text;
  br baremes_retenue%rowtype;
  v_bar_org uuid;
  v_per text;
  v_ref numeric;
  v_parts numeric;
  v_ir_u numeric;
  v_max_brut numeric;
begin
  if v_org is null or not has_role('admin', 'rh') then
    raise exception 'Droits insuffisants';
  end if;
  select * into per from periodes_paie where id = p_periode_id and organisation_id = v_org;
  if not found then raise exception 'Période introuvable'; end if;
  if per.statut <> 'ouverte' then raise exception 'Cette période est déjà validée'; end if;
  select * into par from parametrage_paie where organisation_id = v_org;
  if not found or par.valide_le is null then
    raise exception 'Le paramétrage de la paie doit être validé (Paie → Paramètres) avant tout calcul';
  end if;
  select case when devise = 'XOF' then 0 else 2 end into v_dec from organisations where id = v_org;

  -- Barème de lecture : version propre à l'organisation si elle existe, sinon référence globale
  if par.mode_ir = 'table' then
    v_bar_org := case when exists (select 1 from baremes_retenue
                                   where organisation_id = v_org and version = par.bareme_version) then v_org end;
    if v_bar_org is null and not exists (select 1 from baremes_retenue
                                         where organisation_id is null and version = par.bareme_version) then
      raise exception 'Barème de retenue à la source introuvable (version %) : importez-le dans Paie → Paramètres', par.bareme_version;
    end if;
  end if;

  d_debut := make_date(per.annee, per.mois, 1);
  d_fin := (d_debut + interval '1 month - 1 day')::date;
  delete from bulletins_paie where periode_id = per.id;

  for e in select * from employes
           where organisation_id = v_org and actif and date_embauche <= d_fin
             and (date_sortie is null or date_sortie >= d_debut)
           order by matricule loop
    select * into c from contrats_travail
      where employe_id = e.id and date_debut <= d_fin and (date_fin is null or date_fin >= d_debut)
      order by date_debut desc limit 1;
    if not found then continue; end if;

    select coalesce(sum(case statut when 'present' then 1 when 'demi_journee' then 0.5
                                    when 'conge_paye' then 1 when 'maladie' then 1 else 0 end), 0),
           coalesce(sum(case when statut in ('absent', 'conge_sans_solde') then 1 else 0 end), 0)
      into v_jp, v_jnp
      from pointages where employe_id = e.id and date_pointage between d_debut and d_fin;

    v_abs := 0; v_prime := 0; v_avert := null;
    if e.statut in ('saisonnier', 'journalier') or (e.statut = 'prestataire' and c.salaire_base = 0) then
      v_base := round(coalesce(c.taux_journalier, 0) * v_jp, v_dec);
      if coalesce(c.taux_journalier, 0) = 0 then v_avert := 'Taux journalier non renseigné'; end if;
      if v_jp = 0 then v_avert := coalesce(v_avert || ' ; ', '') || 'Aucun jour pointé'; end if;
    else
      v_base := c.salaire_base;
      v_prime := c.primes_mensuelles;
      v_abs := round((v_base + v_prime) / par.jours_par_mois * v_jnp, v_dec);
    end if;
    v_brut := v_base + v_prime - v_abs;
    if v_brut <= 0 then continue; end if;

    v_id := gen_random_uuid();
    insert into bulletins_paie (id, organisation_id, periode_id, employe_id, jours_payes, jours_non_payes,
                                brut, total_retenues, net_a_payer, charges_patronales, cout_total)
      values (v_id, v_org, per.id, e.id, v_jp, v_jnp, v_brut, 0, v_brut, 0, v_brut);

    v_ordre := 1;
    insert into bulletins_lignes (organisation_id, bulletin_id, ordre, code, libelle, type, base, taux, montant)
      values (v_org, v_id, v_ordre,
              case when e.statut in ('saisonnier', 'journalier') then 'JOURN' else 'SALBASE' end,
              case when e.statut in ('saisonnier', 'journalier') then 'Salaire (jours travaillés)' else 'Salaire de base' end,
              'gain', case when e.statut in ('saisonnier', 'journalier') then v_jp end, c.taux_journalier, v_base);
    if v_prime > 0 then
      v_ordre := v_ordre + 1;
      insert into bulletins_lignes (organisation_id, bulletin_id, ordre, code, libelle, type, montant)
        values (v_org, v_id, v_ordre, 'PRIMES', 'Primes et indemnités', 'gain', v_prime);
    end if;
    if v_abs > 0 then
      v_ordre := v_ordre + 1;
      insert into bulletins_lignes (organisation_id, bulletin_id, ordre, code, libelle, type, base, montant)
        values (v_org, v_id, v_ordre, 'ABSENCES', 'Retenue pour absences non payées', 'retenue_absence', v_jnp, v_abs);
    end if;

    v_tot_sal := 0; v_tot_pat := 0; v_ded_ir := 0;
    for r in select * from regles_paie
             where organisation_id = v_org and actif and date_debut <= d_fin
               and (date_fin is null or date_fin >= d_debut)
               and e.statut = any(statuts) and (regime is null or regime = e.regime_ipres)
             order by ordre, code loop
      v_assiette := greatest(0, least(v_brut, coalesce(r.plafond_mensuel, v_brut)) - r.plancher_mensuel);
      v_sal := round(v_assiette * r.taux_salarie / 100, v_dec);
      v_pat := round(v_assiette * r.taux_employeur / 100, v_dec);
      if v_sal > 0 then
        v_ordre := v_ordre + 1;
        insert into bulletins_lignes (organisation_id, bulletin_id, ordre, code, libelle, type, base, taux, montant, compte_cle)
          values (v_org, v_id, v_ordre, r.code, r.libelle, 'retenue_salariale', v_assiette, r.taux_salarie, v_sal, r.compte_cle);
        v_tot_sal := v_tot_sal + v_sal;
        if r.deductible_ir then v_ded_ir := v_ded_ir + v_sal; end if;
      end if;
      if v_pat > 0 then
        v_ordre := v_ordre + 1;
        insert into bulletins_lignes (organisation_id, bulletin_id, ordre, code, libelle, type, base, taux, montant, compte_cle)
          values (v_org, v_id, v_ordre, r.code, r.libelle || ' (part employeur)', 'charge_patronale', v_assiette, r.taux_employeur, v_pat, r.compte_cle);
        v_tot_pat := v_tot_pat + v_pat;
      end if;
    end loop;

    if e.statut = any(par.statuts_ir) and par.mode_ir = 'table' then
      -- Barème de retenue à la source : la ligne retenue est celle du plus grand revenu brut ≤ revenu de lecture.
      -- Le barème lu dépend du statut (annuel : brut × 12 puis retenue / 12 ; mensuel ; journalier : × jours payés).
      -- TRIMF : montant « par personne » × (1 + nombre de conjoints).
      v_per := par.periodicite_par_statut ->> e.statut;
      if v_per is null or v_per not in ('annuel', 'mensuel', 'journalier') then
        v_avert := coalesce(v_avert || ' ; ', '') || 'Aucun barème de lecture défini pour le statut ' || e.statut;
      else
        v_ref := case v_per when 'annuel' then v_brut * 12 when 'mensuel' then v_brut
                            else v_brut / nullif(v_jp, 0) end;
        if v_ref is not null then
          select * into br from baremes_retenue
            where version = par.bareme_version and periodicite = v_per
              and organisation_id is not distinct from v_bar_org and revenu_brut <= v_ref
            order by revenu_brut desc limit 1;
          if found then
            select max(revenu_brut) into v_max_brut from baremes_retenue
              where version = par.bareme_version and periodicite = v_per
                and organisation_id is not distinct from v_bar_org;
            if v_ref > v_max_brut then
              v_avert := coalesce(v_avert || ' ; ', '') || 'Revenu supérieur au barème (' || v_per || ') : dernière ligne utilisée';
            end if;
            if e.parts_ir > 5 then
              v_avert := coalesce(v_avert || ' ; ', '') || 'Parts limitées à 5 pour la lecture du barème';
            end if;
            v_parts := floor(greatest(1, least(5, e.parts_ir)) * 2) / 2;
            v_ir_u := case v_parts
              when 1 then br.ir_1 when 1.5 then br.ir_1_5 when 2 then br.ir_2 when 2.5 then br.ir_2_5
              when 3 then br.ir_3 when 3.5 then br.ir_3_5 when 4 then br.ir_4 when 4.5 then br.ir_4_5
              else br.ir_5 end;
            v_ir := round(case v_per when 'annuel' then v_ir_u / 12 when 'mensuel' then v_ir_u
                                     else v_ir_u * v_jp end, v_dec);
            v_forfait := round((case v_per when 'annuel' then br.trimf / 12 when 'mensuel' then br.trimf
                                           else br.trimf * v_jp end) * (1 + e.nombre_conjoints), v_dec);
            if v_forfait > 0 then
              v_ordre := v_ordre + 1;
              insert into bulletins_lignes (organisation_id, bulletin_id, ordre, code, libelle, type, base, montant, compte_cle)
                values (v_org, v_id, v_ordre, 'TRIMF', 'TRIMF (' || (1 + e.nombre_conjoints) || ' personne(s))',
                        'retenue_salariale', v_ref, v_forfait, 'etat_retenues');
              v_tot_sal := v_tot_sal + v_forfait;
            end if;
            if v_ir > 0 then
              v_ordre := v_ordre + 1;
              insert into bulletins_lignes (organisation_id, bulletin_id, ordre, code, libelle, type, base, montant, compte_cle)
                values (v_org, v_id, v_ordre, 'IR', 'Impôt sur le revenu (' || e.parts_ir || ' parts, barème ' || v_per || ')',
                        'retenue_salariale', v_ref, v_ir, 'etat_retenues');
              v_tot_sal := v_tot_sal + v_ir;
            end if;
          end if;
        end if;
      end if;
    elsif e.statut = any(par.statuts_ir) then
      -- Mode « calcul » : forfaits par tranche (TRIMF, montant annuel / 12), puis barème progressif
      select montant_annuel into v_forfait from tranches_forfaitaires
        where organisation_id = v_org and code = 'TRIMF'
          and v_brut * 12 >= salaire_min_annuel
          and (salaire_max_annuel is null or v_brut * 12 <= salaire_max_annuel)
        order by salaire_min_annuel desc limit 1;
      if found and v_forfait > 0 then
        v_ordre := v_ordre + 1;
        v_sal := round(v_forfait / 12, v_dec);
        insert into bulletins_lignes (organisation_id, bulletin_id, ordre, code, libelle, type, montant, compte_cle)
          values (v_org, v_id, v_ordre, 'TRIMF', 'TRIMF', 'retenue_salariale', v_sal, 'etat_retenues');
        v_tot_sal := v_tot_sal + v_sal;
      end if;

      -- Impôt sur le revenu : barème progressif sur le revenu annualisé après abattement ;
      -- réduction pour charges de famille selon les parts de l'employé (si paramétrée).
      if exists (select 1 from bareme_ir where organisation_id = v_org) then
        v_annuel := (v_brut - v_ded_ir) * 12;
        v_abatt := least(par.abattement_pct / 100 * v_annuel, coalesce(par.abattement_plafond_annuel, 1e18));
        v_annuel := greatest(0, v_annuel - v_abatt);
        select coalesce(sum(greatest(0, least(v_annuel, coalesce(tranche_max, 1e18)) - tranche_min) * taux / 100), 0)
          into v_imp_brut from bareme_ir where organisation_id = v_org;
        v_ricf := 0;
        select * into rf from reductions_famille where organisation_id = v_org and parts = e.parts_ir;
        if found then
          v_ricf := least(v_imp_brut, greatest(rf.minimum, least(coalesce(rf.maximum, 1e18), v_imp_brut * rf.taux / 100)));
        elsif e.parts_ir > 1 then
          v_avert := coalesce(v_avert || ' ; ', '') || 'Aucune réduction pour charges de famille paramétrée pour ' || e.parts_ir || ' parts';
        end if;
        v_ir := round(greatest(0, v_imp_brut - v_ricf) / 12, v_dec);
        if v_ir > 0 then
          v_ordre := v_ordre + 1;
          insert into bulletins_lignes (organisation_id, bulletin_id, ordre, code, libelle, type, base, montant, compte_cle)
            values (v_org, v_id, v_ordre, 'IR', 'Impôt sur le revenu (retenue à la source)', 'retenue_salariale',
                    round(v_annuel / 12, v_dec), v_ir, 'etat_retenues');
          v_tot_sal := v_tot_sal + v_ir;
        end if;
      end if;
    end if;

    update bulletins_paie set total_retenues = v_tot_sal, net_a_payer = v_brut - v_tot_sal,
           charges_patronales = v_tot_pat, cout_total = v_brut + v_tot_pat, avertissements = v_avert
      where id = v_id;

    -- Imputation analytique : jours pointés par (département, secteur, campagne), sinon affectation de l'employé
    insert into bulletins_imputations (organisation_id, bulletin_id, departement_id, secteur_id, campagne_id, quote_part)
    select v_org, v_id, x.dep, x.sec, x.camp, round(x.poids / sum(x.poids) over (), 8)
    from (
      select coalesce(p.departement_id, e.departement_id) as dep,
             case when p.departement_id is null then e.secteur_id else p.secteur_id end as sec,
             p.campagne_id as camp,
             sum(case p.statut when 'present' then 1 when 'demi_journee' then 0.5
                               when 'conge_paye' then 1 when 'maladie' then 1 else 0 end) as poids
      from pointages p
      where p.employe_id = e.id and p.date_pointage between d_debut and d_fin
      group by 1, 2, 3
      having sum(case p.statut when 'present' then 1 when 'demi_journee' then 0.5
                               when 'conge_paye' then 1 when 'maladie' then 1 else 0 end) > 0
    ) x;
    if not exists (select 1 from bulletins_imputations where bulletin_id = v_id) then
      insert into bulletins_imputations (organisation_id, bulletin_id, departement_id, secteur_id, quote_part)
        values (v_org, v_id, e.departement_id, e.secteur_id, 1);
    end if;
    v_n := v_n + 1;
  end loop;

  if v_n = 0 then
    raise exception 'Aucun bulletin à calculer : vérifiez les employés actifs, leurs contrats et les pointages de la période';
  end if;
  return v_n;
end $$;

-- ============================================================
-- Validation (écriture comptable) et paiement des salaires
-- Dr 661 salaires bruts + Dr 664 charges patronales (imputés département × secteur × campagne)
-- Cr 422 net à payer, Cr 431 / 447 / 442 selon la nature de chaque retenue et charge
-- ============================================================
create or replace function valider_paie(p_periode_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  per periodes_paie%rowtype;
  a record;
  v_ec jsonb := '[]'::jsonb;
  v_net numeric;
  d_fin date;
  v_id uuid;
begin
  if v_org is null or not has_role('admin', 'comptable') then
    raise exception 'Droits insuffisants';
  end if;
  select * into per from periodes_paie where id = p_periode_id and organisation_id = v_org;
  if not found then raise exception 'Période introuvable'; end if;
  if per.statut <> 'ouverte' then raise exception 'Cette période est déjà validée'; end if;
  if not exists (select 1 from bulletins_paie where periode_id = per.id) then
    raise exception 'Calculez d''abord les bulletins de la période';
  end if;
  d_fin := (make_date(per.annee, per.mois, 1) + interval '1 month - 1 day')::date;

  for a in
    with alloc as (
      select b.id as bid, i.departement_id as dep, i.secteur_id as sec, i.campagne_id as camp, i.quote_part,
             b.brut, b.charges_patronales,
             row_number() over (partition by b.id order by i.id) as rn,
             count(*) over (partition by b.id) as nb
      from bulletins_paie b join bulletins_imputations i on i.bulletin_id = b.id
      where b.periode_id = per.id
    ), calc as (
      select *,
        case when rn < nb then round(brut * quote_part, 2)
             else brut - coalesce(sum(round(brut * quote_part, 2)) over (partition by bid order by rn rows between unbounded preceding and 1 preceding), 0) end as part_brut,
        case when rn < nb then round(charges_patronales * quote_part, 2)
             else charges_patronales - coalesce(sum(round(charges_patronales * quote_part, 2)) over (partition by bid order by rn rows between unbounded preceding and 1 preceding), 0) end as part_pat
      from alloc
    )
    select dep, sec, camp, sum(part_brut) as brut, sum(part_pat) as pat from calc group by dep, sec, camp
  loop
    if a.brut > 0 then
      v_ec := v_ec || ec_ligne(param_compte(v_org, 'salaires'), a.brut, 0, null, a.dep, a.sec, a.camp, 'Salaires ' || per.mois || '/' || per.annee);
    end if;
    if a.pat > 0 then
      v_ec := v_ec || ec_ligne(param_compte(v_org, 'charges_sociales'), a.pat, 0, null, a.dep, a.sec, a.camp, 'Charges patronales ' || per.mois || '/' || per.annee);
    end if;
  end loop;

  select sum(net_a_payer) into v_net from bulletins_paie where periode_id = per.id;
  if v_net > 0 then
    v_ec := v_ec || ec_ligne(param_compte(v_org, 'personnel'), 0, v_net, null, null, null, null, 'Net à payer ' || per.mois || '/' || per.annee);
  end if;
  for a in
    select l.compte_cle, sum(l.montant) as montant
    from bulletins_lignes l join bulletins_paie b on b.id = l.bulletin_id
    where b.periode_id = per.id and l.type in ('retenue_salariale', 'charge_patronale')
    group by l.compte_cle
  loop
    if a.montant > 0 then
      v_ec := v_ec || ec_ligne(param_compte(v_org, a.compte_cle), 0, a.montant, null, null, null, null, 'Cotisations et impôts ' || per.mois || '/' || per.annee);
    end if;
  end loop;

  v_id := ecrire_interne(v_org, journal_de_type(v_org, 'paie'), d_fin,
    'Paie ' || lpad(per.mois::text, 2, '0') || '/' || per.annee, null, v_ec, 'paie', per.id, null);
  update bulletins_paie set statut = 'valide' where periode_id = per.id;
  update periodes_paie set statut = 'validee' where id = per.id;
  return v_id;
end $$;

-- payload : { periode_id, date, compte_tresorerie_id }
create or replace function payer_salaires(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  per periodes_paie%rowtype;
  v_ct comptes_tresorerie%rowtype;
  v_net numeric;
  v_date date := (p ->> 'date')::date;
  v_id uuid;
begin
  if v_org is null or not has_role('admin', 'comptable') then
    raise exception 'Droits insuffisants';
  end if;
  select * into per from periodes_paie where id = (p ->> 'periode_id')::uuid and organisation_id = v_org;
  if not found then raise exception 'Période introuvable'; end if;
  if per.statut <> 'validee' then raise exception 'Seule une période validée et non encore payée peut être réglée'; end if;
  select * into v_ct from comptes_tresorerie where id = (p ->> 'compte_tresorerie_id')::uuid
    and organisation_id = v_org and actif;
  if not found then raise exception 'Compte de trésorerie introuvable'; end if;
  select sum(net_a_payer) into v_net from bulletins_paie where periode_id = per.id;
  if coalesce(v_net, 0) <= 0 then raise exception 'Aucun net à payer'; end if;

  v_id := ecrire_interne(v_org, v_ct.journal_id, v_date,
    'Paiement des salaires ' || lpad(per.mois::text, 2, '0') || '/' || per.annee, null,
    jsonb_build_array(
      ec_ligne(param_compte(v_org, 'personnel'), v_net, 0, null, null, null, null, 'Salaires nets'),
      ec_ligne(v_ct.compte_id, 0, v_net, null, null, null, null, 'Salaires nets')),
    'paie_paiement', per.id, null);
  update bulletins_paie set statut = 'paye' where periode_id = per.id;
  update periodes_paie set statut = 'payee' where id = per.id;
  return v_id;
end $$;

-- ============================================================
-- Congés et paramétrage
-- ============================================================
create or replace function traiter_conge(p_id uuid, p_decision text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  d demandes_conge%rowtype;
  v_jour date;
  v_statut text;
begin
  if v_org is null or not has_role('admin', 'rh') then
    raise exception 'Droits insuffisants';
  end if;
  if p_decision not in ('approuve', 'refuse') then raise exception 'Décision invalide'; end if;
  select * into d from demandes_conge where id = p_id and organisation_id = v_org;
  if not found then raise exception 'Demande introuvable'; end if;
  if d.statut <> 'demande' then raise exception 'Demande déjà traitée'; end if;

  if p_decision = 'approuve' then
    v_statut := case d.type when 'maladie' then 'maladie' when 'sans_solde' then 'conge_sans_solde' else 'conge_paye' end;
    for v_jour in select g::date from generate_series(d.date_debut::timestamp, d.date_fin::timestamp, interval '1 day') g
                  where extract(dow from g) <> 0 loop
      insert into pointages (organisation_id, employe_id, date_pointage, statut)
        values (v_org, d.employe_id, v_jour, v_statut)
        on conflict (employe_id, date_pointage) do update set statut = excluded.statut;
    end loop;
  end if;
  update demandes_conge set statut = p_decision, traite_par = auth.uid() where id = d.id;
end $$;

create or replace function valider_parametrage_paie() returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid := current_org_id();
begin
  if v_org is null or not has_role('admin') then
    raise exception 'Seul un administrateur peut valider le paramétrage de la paie';
  end if;
  if not exists (select 1 from regles_paie where organisation_id = v_org and actif) then
    raise exception 'Aucune règle de cotisation active : paramétrez-les avant de valider';
  end if;
  if exists (select 1 from parametrage_paie where organisation_id = v_org and mode_ir = 'table') then
    if not exists (
      select 1 from baremes_retenue b join parametrage_paie p on p.bareme_version = b.version
      where p.organisation_id = v_org and (b.organisation_id is null or b.organisation_id = v_org)
    ) then
      raise exception 'Le barème de retenue à la source n''est pas importé (version %)',
        (select bareme_version from parametrage_paie where organisation_id = v_org);
    end if;
  end if;
  update parametrage_paie set valide_le = now(), valide_par = auth.uid() where organisation_id = v_org;
end $$;

-- ============================================================
-- Vues
-- ============================================================
-- Congés de l'année civile en cours : jours acquis (mois travaillés × jours par mois) et jours pris (annuels approuvés)
create view v_soldes_conges with (security_invoker = true) as
select e.organisation_id, e.id as employe_id,
       extract(year from current_date)::integer as annee,
       least(12, greatest(0,
         (extract(year from w.fin_a) * 12 + extract(month from w.fin_a))
         - (extract(year from w.debut_a) * 12 + extract(month from w.debut_a)) + 1))
         * coalesce(par.jours_conge_par_mois, 2) as jours_acquis,
       coalesce((select sum(d.jours) from demandes_conge d
                 where d.employe_id = e.id and d.statut = 'approuve' and d.type = 'annuel'
                   and extract(year from d.date_debut) = extract(year from current_date)), 0) as jours_pris
from employes e
cross join lateral (
  select greatest(e.date_embauche, make_date(extract(year from current_date)::integer, 1, 1)) as debut_a,
         least(coalesce(e.date_sortie, current_date), current_date) as fin_a
) w
left join parametrage_paie par on par.organisation_id = e.organisation_id
where e.actif;

create view v_baremes_versions with (security_invoker = true) as
select organisation_id, version, pays, periodicite,
       count(*) as nb_lignes, min(revenu_brut) as brut_min, max(revenu_brut) as brut_max
from baremes_retenue
group by organisation_id, version, pays, periodicite;

create view v_cotisations_periode with (security_invoker = true) as
select b.organisation_id, b.periode_id, l.code, l.libelle, l.type, l.compte_cle,
       count(distinct b.employe_id) as nb_employes,
       sum(l.montant) as montant
from bulletins_lignes l join bulletins_paie b on b.id = l.bulletin_id
where l.type in ('retenue_salariale', 'charge_patronale')
group by b.organisation_id, b.periode_id, l.code, l.libelle, l.type, l.compte_cle;

-- ============================================================
-- Initialisation (idempotente) : comptes, paramètres, modèle Sénégal
-- ============================================================
create or replace function initialiser_phase4(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_pays text;
begin
  select pays into v_pays from organisations where id = p_org;

  insert into parametres_comptables (organisation_id, cle, compte_id)
  select p_org, k.cle, c.id
  from (values
    ('salaires', '661'), ('charges_sociales', '664'), ('personnel', '422'),
    ('organismes_sociaux', '431'), ('etat_retenues', '447'), ('etat_impots_taxes', '442')
  ) as k(cle, numero)
  join comptes_comptables c on c.organisation_id = p_org and c.numero = k.numero
  on conflict do nothing;

  -- Sénégal : impôt et TRIMF lus dans le barème officiel de retenue à la source (référence globale SN-2013).
  -- Autres pays : mode « calcul » vide, à paramétrer ou à basculer en « table » après import d'un barème.
  insert into parametrage_paie (organisation_id, pays, mode_ir, bareme_version)
    values (p_org, v_pays,
            case when v_pays = 'SN' then 'table' else 'calcul' end,
            case when v_pays = 'SN' then 'SN-2013' end)
    on conflict do nothing;

  if v_pays = 'SN' and not exists (select 1 from regles_paie where organisation_id = p_org) then
    insert into regles_paie (organisation_id, code, libelle, taux_salarie, taux_employeur, plancher_mensuel,
                             plafond_mensuel, regime, deductible_ir, compte_cle, ordre) values
      (p_org, 'IPRES_RG', 'IPRES régime général', 5.6, 8.4, 0, 432000, null, true, 'organismes_sociaux', 10),
      (p_org, 'IPRES_RC', 'IPRES régime complémentaire cadres', 2.4, 3.6, 432000, 1296000, 'cadre', true, 'organismes_sociaux', 11),
      (p_org, 'CSS_PF', 'CSS prestations familiales', 0, 7, 0, 63000, null, false, 'organismes_sociaux', 20),
      (p_org, 'CSS_AT', 'CSS accidents du travail (1 %, 3 % ou 5 % selon le risque)', 0, 1, 0, 63000, null, false, 'organismes_sociaux', 21),
      (p_org, 'CFCE', 'CFCE (contribution forfaitaire à la charge de l''employeur, 3 % du brut imposable)', 0, 3, 0, null, null, false, 'etat_impots_taxes', 30);
  end if;
end $$;

-- Point d'entrée unique de l'initialisation des modules (remplace la version de 03)
create or replace function initialiser_modules(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform initialiser_phase1(p_org);
  perform initialiser_phase2(p_org);
  perform initialiser_phase4(p_org);
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

  perform initialiser_modules(p_org);
end $$;

do $$
declare o record;
begin
  for o in select id from organisations loop
    perform initialiser_phase4(o.id);
  end loop;
end $$;

-- ============================================================
-- RLS : données RH sensibles (admin, rh, comptable, direction)
-- ============================================================
alter table employes enable row level security;
alter table contrats_travail enable row level security;
alter table pointages enable row level security;
alter table demandes_conge enable row level security;
alter table parametrage_paie enable row level security;
alter table baremes_retenue enable row level security;
alter table regles_paie enable row level security;
alter table bareme_ir enable row level security;
alter table reductions_famille enable row level security;
alter table tranches_forfaitaires enable row level security;
alter table periodes_paie enable row level security;
alter table bulletins_paie enable row level security;
alter table bulletins_lignes enable row level security;
alter table bulletins_imputations enable row level security;

create policy emp_select on employes for select
  using (organisation_id = current_org_id() and has_role('admin', 'rh', 'comptable', 'direction'));
create policy emp_write on employes for all
  using (organisation_id = current_org_id() and has_role('admin', 'rh'))
  with check (organisation_id = current_org_id());
create policy ctr_select on contrats_travail for select
  using (organisation_id = current_org_id() and has_role('admin', 'rh', 'comptable', 'direction'));
create policy ctr_write on contrats_travail for all
  using (organisation_id = current_org_id() and has_role('admin', 'rh'))
  with check (organisation_id = current_org_id());
create policy ptg_select on pointages for select
  using (organisation_id = current_org_id() and has_role('admin', 'rh', 'comptable', 'direction', 'chef_departement'));
create policy ptg_write on pointages for all
  using (organisation_id = current_org_id() and has_role('admin', 'rh', 'chef_departement'))
  with check (organisation_id = current_org_id());
create policy cge_select on demandes_conge for select
  using (organisation_id = current_org_id() and has_role('admin', 'rh', 'direction', 'chef_departement'));
create policy cge_insert on demandes_conge for insert
  with check (organisation_id = current_org_id() and has_role('admin', 'rh', 'chef_departement'));

create policy par_select on parametrage_paie for select
  using (organisation_id = current_org_id() and has_role('admin', 'rh', 'comptable', 'direction'));
create policy par_write on parametrage_paie for update
  using (organisation_id = current_org_id() and has_role('admin'))
  with check (organisation_id = current_org_id());
create policy baremes_select on baremes_retenue for select to authenticated
  using (organisation_id is null or (organisation_id = current_org_id() and has_role('admin', 'rh', 'comptable', 'direction')));
create policy baremes_write on baremes_retenue for all
  using (organisation_id = current_org_id() and has_role('admin'))
  with check (organisation_id = current_org_id());
create policy reg_select on regles_paie for select
  using (organisation_id = current_org_id() and has_role('admin', 'rh', 'comptable', 'direction'));
create policy reg_write on regles_paie for all
  using (organisation_id = current_org_id() and has_role('admin'))
  with check (organisation_id = current_org_id());
create policy bir_select on bareme_ir for select
  using (organisation_id = current_org_id() and has_role('admin', 'rh', 'comptable', 'direction'));
create policy bir_write on bareme_ir for all
  using (organisation_id = current_org_id() and has_role('admin'))
  with check (organisation_id = current_org_id());
create policy red_select on reductions_famille for select
  using (organisation_id = current_org_id() and has_role('admin', 'rh', 'comptable', 'direction'));
create policy red_write on reductions_famille for all
  using (organisation_id = current_org_id() and has_role('admin'))
  with check (organisation_id = current_org_id());
create policy for_select on tranches_forfaitaires for select
  using (organisation_id = current_org_id() and has_role('admin', 'rh', 'comptable', 'direction'));
create policy for_write on tranches_forfaitaires for all
  using (organisation_id = current_org_id() and has_role('admin'))
  with check (organisation_id = current_org_id());

create policy per_select on periodes_paie for select
  using (organisation_id = current_org_id() and has_role('admin', 'rh', 'comptable', 'direction'));
create policy per_write on periodes_paie for insert
  with check (organisation_id = current_org_id() and has_role('admin', 'rh', 'comptable'));
create policy bul_select on bulletins_paie for select
  using (organisation_id = current_org_id() and has_role('admin', 'rh', 'comptable', 'direction'));
create policy bull_select on bulletins_lignes for select
  using (organisation_id = current_org_id() and has_role('admin', 'rh', 'comptable', 'direction'));
create policy buli_select on bulletins_imputations for select
  using (organisation_id = current_org_id() and has_role('admin', 'rh', 'comptable', 'direction'));

-- ============================================================
-- Droits d'exécution
-- ============================================================
revoke execute on function initialiser_phase4(uuid), initialiser_modules(uuid), initialiser_organisation(uuid),
  invalider_parametrage_paie()
from public, anon, authenticated;

revoke execute on function
  calculer_paie(uuid), valider_paie(uuid), payer_salaires(jsonb), traiter_conge(uuid, text),
  valider_parametrage_paie()
from public, anon;
grant execute on function
  calculer_paie(uuid), valider_paie(uuid), payer_salaires(jsonb), traiter_conge(uuid, text),
  valider_parametrage_paie()
to authenticated;
