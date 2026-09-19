-- D-AGROBUSINESS — Phase 5 : pilotage.
-- Budgets sectoriels (suivi réalisé / budget, consolidation), TVA (déclaration et liquidation),
-- vues de restitution pour les états financiers, ratios, bilans de campagne et rapports mensuels.

-- ============================================================
-- Comptes de TVA complémentaires
-- ============================================================
insert into modeles_plan_comptable (referentiel, numero, libelle) values
  ('SYSCOHADA', '4449', 'État, crédit de TVA à reporter')
on conflict do nothing;

insert into comptes_comptables (organisation_id, numero, libelle)
select o.id, m.numero, m.libelle
from organisations o
join modeles_plan_comptable m on m.referentiel = o.referentiel
where m.numero = '4449'
on conflict do nothing;

create or replace function initialiser_phase5(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into parametres_comptables (organisation_id, cle, compte_id)
  select p_org, k.cle, c.id
  from (values ('tva_due', '4441'), ('tva_credit', '4449')) as k(cle, numero)
  join comptes_comptables c on c.organisation_id = p_org and c.numero = k.numero
  on conflict do nothing;
end $$;

create or replace function initialiser_modules(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform initialiser_phase1(p_org);
  perform initialiser_phase2(p_org);
  perform initialiser_phase4(p_org);
  perform initialiser_phase5(p_org);
end $$;

do $$
declare o record;
begin
  for o in select id from organisations loop
    perform initialiser_phase5(o.id);
  end loop;
end $$;

-- ============================================================
-- Budgets
-- ============================================================
create table budgets (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  code text not null,
  libelle text not null,
  exercice_id uuid not null references exercices_comptables(id) on delete restrict,
  campagne_id uuid references campagnes(id) on delete restrict,     -- optionnel : limite le réalisé à une campagne
  statut text not null default 'brouillon' check (statut in ('brouillon', 'approuve')),
  created_at timestamptz not null default now(),
  unique (organisation_id, code)
);

create table budget_lignes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  budget_id uuid not null references budgets(id) on delete cascade,
  departement_id uuid not null references departements(id) on delete restrict,
  secteur_id uuid references secteurs_projets(id) on delete restrict,   -- vide : tout le département
  compte_id uuid not null references comptes_comptables(id) on delete restrict,
  montant numeric(18,2) not null check (montant >= 0),
  created_at timestamptz not null default now()
);
create unique index budget_lignes_unique on budget_lignes
  (budget_id, departement_id, coalesce(secteur_id, '00000000-0000-0000-0000-000000000000'::uuid), compte_id);

create or replace function budget_ligne_controle() returns trigger
language plpgsql as $$
declare
  v_statut text;
  v_classe smallint;
  v_dep uuid;
begin
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

create trigger budget_lignes_controle before insert or update or delete on budget_lignes
  for each row execute function budget_ligne_controle();

-- Réalisé issu de la comptabilité analytique : produits (7) = crédit − débit, charges (6) = débit − crédit
create view v_suivi_budget with (security_invoker = true) as
select b.organisation_id, b.id as budget_id, bl.departement_id, bl.secteur_id, bl.compte_id,
       c.numero, c.libelle, c.classe,
       sum(bl.montant) as budget,
       coalesce((
         select sum(case when c2.classe = 7 then l.credit - l.debit else l.debit - l.credit end)
         from lignes_ecritures l
         join ecritures e on e.id = l.ecriture_id
         join comptes_comptables c2 on c2.id = l.compte_id
         where e.exercice_id = b.exercice_id
           and l.compte_id = bl.compte_id
           and l.departement_id = bl.departement_id
           and (bl.secteur_id is null or l.secteur_id = bl.secteur_id)
           and (b.campagne_id is null or l.campagne_id = b.campagne_id)
       ), 0) as realise
from budgets b
join budget_lignes bl on bl.budget_id = b.id
join comptes_comptables c on c.id = bl.compte_id
group by b.organisation_id, b.id, b.exercice_id, b.campagne_id, bl.departement_id, bl.secteur_id,
         bl.compte_id, c.numero, c.libelle, c.classe;

-- ============================================================
-- TVA : mensuelle et liquidation
-- ============================================================
create view v_tva_mensuelle with (security_invoker = true) as
select l.organisation_id,
       extract(year from e.date_ecriture)::integer as annee,
       extract(month from e.date_ecriture)::integer as mois,
       sum(case when pc.cle = 'tva_collectee' then l.credit - l.debit else 0 end) as collectee,
       sum(case when pc.cle = 'tva_deductible' then l.debit - l.credit else 0 end) as deductible_achats,
       sum(case when pc.cle = 'tva_recuperable_immo' then l.debit - l.credit else 0 end) as deductible_immobilisations
from lignes_ecritures l
join ecritures e on e.id = l.ecriture_id
join parametres_comptables pc on pc.organisation_id = l.organisation_id and pc.compte_id = l.compte_id
where pc.cle in ('tva_collectee', 'tva_deductible', 'tva_recuperable_immo')
group by l.organisation_id, extract(year from e.date_ecriture), extract(month from e.date_ecriture);

create table liquidations_tva (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  annee integer not null,
  mois integer not null check (mois between 1 and 12),
  collectee numeric(18,2) not null,
  deductible numeric(18,2) not null,
  credit_precedent numeric(18,2) not null default 0,
  tva_due numeric(18,2) not null default 0,
  credit_a_reporter numeric(18,2) not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (organisation_id, annee, mois)
);
create trigger liquidations_tva_immuables before update or delete on liquidations_tva
  for each row execute function interdire_modification_doc();

-- Liquidation d'un mois : solde la TVA collectée et la TVA récupérable, constate la TVA due (4441)
-- ou le crédit de TVA à reporter (4449). Le règlement de la TVA due se saisit en trésorerie (contrepartie 4441).
create or replace function liquider_tva(p_annee integer, p_mois integer) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_debut date := make_date(p_annee, p_mois, 1);
  v_fin date := (make_date(p_annee, p_mois, 1) + interval '1 month - 1 day')::date;
  v_id uuid := gen_random_uuid();
  v_coll numeric; v_ded_achats numeric; v_ded_immo numeric; v_ded numeric;
  v_prec numeric := 0;
  v_net numeric;
  v_ec jsonb := '[]'::jsonb;
  v_prev liquidations_tva%rowtype;
begin
  if v_org is null or not has_role('admin', 'comptable') then
    raise exception 'Droits insuffisants';
  end if;
  if exists (select 1 from liquidations_tva where organisation_id = v_org and annee = p_annee and mois = p_mois) then
    raise exception 'La TVA de % / % est déjà liquidée', p_mois, p_annee;
  end if;

  select coalesce(sum(case when pc.cle = 'tva_collectee' then l.credit - l.debit else 0 end), 0),
         coalesce(sum(case when pc.cle = 'tva_deductible' then l.debit - l.credit else 0 end), 0),
         coalesce(sum(case when pc.cle = 'tva_recuperable_immo' then l.debit - l.credit else 0 end), 0)
    into v_coll, v_ded_achats, v_ded_immo
    from lignes_ecritures l
    join ecritures e on e.id = l.ecriture_id
    join parametres_comptables pc on pc.organisation_id = l.organisation_id and pc.compte_id = l.compte_id
    where l.organisation_id = v_org and e.date_ecriture between v_debut and v_fin
      and pc.cle in ('tva_collectee', 'tva_deductible', 'tva_recuperable_immo');
  v_ded := v_ded_achats + v_ded_immo;
  if v_coll = 0 and v_ded = 0 then
    raise exception 'Aucune TVA à liquider sur cette période';
  end if;

  select * into v_prev from liquidations_tva
    where organisation_id = v_org and (annee, mois) < (p_annee, p_mois)
    order by annee desc, mois desc limit 1;
  if found then v_prec := v_prev.credit_a_reporter; end if;
  v_net := v_coll - v_ded - v_prec;

  if v_coll > 0 then
    v_ec := v_ec || ec_ligne(param_compte(v_org, 'tva_collectee'), v_coll, 0, null, null, null, null, 'Liquidation TVA collectée');
  end if;
  if v_ded_achats > 0 then
    v_ec := v_ec || ec_ligne(param_compte(v_org, 'tva_deductible'), 0, v_ded_achats, null, null, null, null, 'Liquidation TVA sur achats');
  end if;
  if v_ded_immo > 0 then
    v_ec := v_ec || ec_ligne(param_compte(v_org, 'tva_recuperable_immo'), 0, v_ded_immo, null, null, null, null, 'Liquidation TVA sur immobilisations');
  end if;
  if v_prec > 0 then
    v_ec := v_ec || ec_ligne(param_compte(v_org, 'tva_credit'), 0, v_prec, null, null, null, null, 'Imputation du crédit de TVA antérieur');
  end if;
  if v_net > 0 then
    v_ec := v_ec || ec_ligne(param_compte(v_org, 'tva_due'), 0, v_net, null, null, null, null, 'TVA due');
  elsif v_net < 0 then
    v_ec := v_ec || ec_ligne(param_compte(v_org, 'tva_credit'), -v_net, 0, null, null, null, null, 'Crédit de TVA à reporter');
  end if;

  perform ecrire_interne(v_org, journal_de_type(v_org, 'operations_diverses'), v_fin,
    'Liquidation de la TVA ' || lpad(p_mois::text, 2, '0') || '/' || p_annee, null, v_ec, 'tva', v_id, null);
  insert into liquidations_tva (id, organisation_id, annee, mois, collectee, deductible, credit_precedent, tva_due, credit_a_reporter)
    values (v_id, v_org, p_annee, p_mois, v_coll, v_ded, v_prec, greatest(v_net, 0), greatest(-v_net, 0));
  return v_id;
end $$;

-- ============================================================
-- Vues de restitution
-- ============================================================
-- Évolution mensuelle des produits et charges (comptabilité générale, axes ignorés)
create view v_evolution_mensuelle with (security_invoker = true) as
select l.organisation_id, e.exercice_id,
       extract(month from e.date_ecriture)::integer as mois,
       sum(case when c.classe = 7 then l.credit - l.debit else 0 end) as produits,
       sum(case when c.classe = 6 then l.debit - l.credit else 0 end) as charges
from lignes_ecritures l
join ecritures e on e.id = l.ecriture_id
join comptes_comptables c on c.id = l.compte_id
where c.classe in (6, 7)
group by l.organisation_id, e.exercice_id, extract(month from e.date_ecriture);

-- Mouvements mensuels des comptes de trésorerie (encaissements = débits, décaissements = crédits)
create view v_mouvements_tresorerie with (security_invoker = true) as
select t.organisation_id, t.id as compte_tresorerie_id, t.nom,
       extract(year from e.date_ecriture)::integer as annee,
       extract(month from e.date_ecriture)::integer as mois,
       sum(l.debit) as encaissements, sum(l.credit) as decaissements
from comptes_tresorerie t
join lignes_ecritures l on l.compte_id = t.compte_id
join ecritures e on e.id = l.ecriture_id
group by t.organisation_id, t.id, t.nom, extract(year from e.date_ecriture), extract(month from e.date_ecriture);

-- Activité mensuelle : nombre et montant par rubrique
create view v_activite_mensuelle with (security_invoker = true) as
select organisation_id, 'distribution'::text as rubrique, extract(year from date_vente)::integer as annee,
       extract(month from date_vente)::integer as mois, count(*) as nb, sum(total_ttc) as montant
  from ventes where type = 'distribution' group by 1, 3, 4
union all
select organisation_id, 'vente_marche', extract(year from date_vente)::integer, extract(month from date_vente)::integer,
       count(*), sum(total_ttc) from ventes where type = 'marche' group by 1, 3, 4
union all
select organisation_id, 'achat', extract(year from date_achat)::integer, extract(month from date_achat)::integer,
       count(*), sum(total_ttc) from achats group by 1, 3, 4
union all
select organisation_id, 'remboursement_nature', extract(year from date_reception)::integer, extract(month from date_reception)::integer,
       count(*), sum(montant) from receptions_nature group by 1, 3, 4
union all
select organisation_id, 'recolte', extract(year from date_recolte)::integer, extract(month from date_recolte)::integer,
       count(*), sum(valeur) from recoltes group by 1, 3, 4
union all
select organisation_id, 'transformation', extract(year from date_of)::integer, extract(month from date_of)::integer,
       count(*), sum(valeur_totale) from ordres_fabrication group by 1, 3, 4
union all
select b.organisation_id, 'paie', p.annee, p.mois, count(*), sum(b.cout_total)
  from bulletins_paie b join periodes_paie p on p.id = b.periode_id group by b.organisation_id, p.annee, p.mois;

-- Créances clients/producteurs et dettes fournisseurs rattachées à une campagne (recouvrement)
create view v_campagne_tiers with (security_invoker = true) as
select l.organisation_id, l.campagne_id, pc.cle,
       sum(l.debit) as total_debit, sum(l.credit) as total_credit
from lignes_ecritures l
join parametres_comptables pc on pc.organisation_id = l.organisation_id and pc.compte_id = l.compte_id
where l.campagne_id is not null and pc.cle in ('clients', 'fournisseurs')
group by l.organisation_id, l.campagne_id, pc.cle;

-- ============================================================
-- RLS et droits
-- ============================================================
alter table budgets enable row level security;
alter table budget_lignes enable row level security;
alter table liquidations_tva enable row level security;

create policy budgets_select on budgets for select
  using (organisation_id = current_org_id() and has_role('admin', 'comptable', 'direction', 'chef_departement', 'lecteur'));
create policy budgets_write on budgets for all
  using (organisation_id = current_org_id() and has_role('admin', 'direction', 'comptable'))
  with check (organisation_id = current_org_id());
create policy blignes_select on budget_lignes for select
  using (organisation_id = current_org_id() and has_role('admin', 'comptable', 'direction', 'chef_departement', 'lecteur'));
create policy blignes_write on budget_lignes for all
  using (organisation_id = current_org_id() and has_role('admin', 'direction', 'comptable'))
  with check (organisation_id = current_org_id());
create policy liqtva_select on liquidations_tva for select
  using (organisation_id = current_org_id() and has_role('admin', 'comptable', 'direction'));

revoke execute on function initialiser_phase5(uuid), initialiser_modules(uuid) from public, anon, authenticated;
revoke execute on function liquider_tva(integer, integer) from public, anon;
grant execute on function liquider_tva(integer, integer) to authenticated;
