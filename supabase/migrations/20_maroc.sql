-- D-AGROBUSINESS — Maroc : modèle de paie IR (salaires) + CNSS + AMO.
-- Sources : Code général des impôts 2026 publié par la DGI du Maroc (art. 58-59, 73-I, 74) et CLEISS (taux 2024).
-- Nouveautés du moteur : taux d'abattement selon le niveau du revenu (abattement_seuil_annuel / abattement_pct_bas) et mode de
-- charges de famille « reduction_charge » (somme fixe par personne à charge déduite de l'impôt annuel).
-- Les organisations existantes chargent le modèle depuis RH > Paramètres, puis revalident.

alter table parametrage_paie
  add column if not exists abattement_seuil_annuel numeric(18,2),
  add column if not exists abattement_pct_bas numeric(6,3) not null default 0;

do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'parametrage_paie'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%ricf_mode%' loop
    execute format('alter table parametrage_paie drop constraint %I', c.conname);
  end loop;
end $$;
alter table parametrage_paie
  add constraint parametrage_paie_ricf_mode_check
  check (ricf_mode in ('parts', 'familial', 'abattement_base', 'charges_impot', 'deduction_charge', 'reduction_charge'));

create or replace function parametrage_modifie() returns trigger
language plpgsql as $$
begin
  if (new.jours_par_mois, new.jours_conge_par_mois, new.abattement_pct, new.abattement_plafond_annuel,
      new.statuts_ir, new.mode_ir, new.bareme_version, new.periodicite_par_statut,
      new.arrondi_base, new.calcul_par_periodicite,
      new.ricf_mode, new.ricf_marie_pct, new.ricf_par_enfant_pct, new.ricf_max_enfants, new.reduction_pression_points,
      new.abattement_sur_brut, new.deduction_par_charge_annuelle, new.abattement_seuil_annuel, new.abattement_pct_bas)
     is distinct from
     (old.jours_par_mois, old.jours_conge_par_mois, old.abattement_pct, old.abattement_plafond_annuel,
      old.statuts_ir, old.mode_ir, old.bareme_version, old.periodicite_par_statut,
      old.arrondi_base, old.calcul_par_periodicite,
      old.ricf_mode, old.ricf_marie_pct, old.ricf_par_enfant_pct, old.ricf_max_enfants, old.reduction_pression_points,
      old.abattement_sur_brut, old.deduction_par_charge_annuelle, old.abattement_seuil_annuel, old.abattement_pct_bas) then
    new.valide_le := null;
    new.valide_par := null;
  end if;
  return new;
end $$;

create or replace function retenue_calculee(
  p_org uuid, p_periodicite text, p_brut numeric, p_parts numeric,
  p_deduction numeric default 0, p_marie boolean default false, p_enfants integer default 0
) returns table (ir numeric, trimf numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  par parametrage_paie%rowtype;
  rf reductions_famille%rowtype;
  v_cfg jsonb;
  v_n numeric;
  v_niveau text;
  v_b numeric;
  v_d numeric;
  v_f numeric;
  v_net numeric;
  v_base numeric;
  v_impot numeric;
  v_taux numeric;
  v_montant numeric;
begin
  select * into par from parametrage_paie where organisation_id = p_org;
  v_cfg := par.calcul_par_periodicite -> p_periodicite;
  if v_cfg is null then
    raise exception 'Périodicité % non configurée dans le paramétrage de la paie', p_periodicite;
  end if;
  v_n := (v_cfg ->> 'n')::numeric;
  v_niveau := coalesce(v_cfg ->> 'niveau', 'periode');
  v_b := case when v_niveau = 'annuel' then p_brut * v_n else p_brut end;
  v_d := case when v_niveau = 'annuel' then p_deduction * v_n else p_deduction end;
  v_f := case when v_niveau = 'annuel' then 1 else v_n end;

  -- Base = (brut − déductions) − abattement, arrondie à l'inférieur
  v_net := greatest(0, v_b - v_d);
  -- (Burkina Faso : l'abattement pour frais professionnels porte sur le salaire de base, avant déduction de la pension)
  -- (Maroc : le taux de l'abattement dépend du niveau du revenu brut annuel : taux réduit jusqu'au seuil, taux normal au-delà)
  v_net := greatest(0, v_net - least(case when par.abattement_seuil_annuel is not null and v_b * v_f <= par.abattement_seuil_annuel
                                          then par.abattement_pct_bas else par.abattement_pct end
                                     / 100 * case when par.abattement_sur_brut then v_b else v_net end,
                                     coalesce(par.abattement_plafond_annuel, 1e18) / v_f));
  -- Togo (CGI art. 72-73) : le revenu net est réduit d'un montant fixe par personne à charge (conjoint sans ressource + enfants,
  -- au plus ricf_max_enfants personnes au total), après l'abattement forfaitaire de 28 %
  if par.ricf_mode = 'deduction_charge' then
    v_net := greatest(0, v_net - least(least(greatest(p_enfants, 0) + case when p_marie then 1 else 0 end, par.ricf_max_enfants)
                                       * par.deduction_par_charge_annuelle, 1e18) / v_f);
  end if;
  -- Abattement pour charges de famille en pourcentage de la base (Niger, art. 64-65 CGI) : taux selon le nombre de
  -- personnes à charge (enfants retenus + conjoint sans revenu si marié), lu dans reductions_famille (parts = nombre de charges)
  if par.ricf_mode = 'abattement_base' then
    select r.taux into v_taux from reductions_famille r
      where r.organisation_id = p_org
        and r.parts <= least(greatest(p_enfants, 0), par.ricf_max_enfants) + case when p_marie then 1 else 0 end
      order by r.parts desc limit 1;
    v_net := v_net * (1 - coalesce(v_taux, 0) / 100);
  end if;
  v_base := case when par.arrondi_base > 0 then floor(v_net / par.arrondi_base) * par.arrondi_base else v_net end;

  select coalesce(sum(greatest(0, least(v_base, coalesce(tranche_max / v_f, 1e18)) - tranche_min / v_f) * taux / 100), 0)
    into v_impot from bareme_ir where organisation_id = p_org;

  -- Réduction pour charges de famille
  if par.ricf_mode = 'charges_impot' then
    -- pourcentage de l'impôt brut selon le nombre de charges (enfants retenus + conjoint sans revenu si marié), lu dans
    -- reductions_famille (parts = nombre de charges ; au-delà de la dernière ligne, le dernier taux s'applique)
    select r.taux into v_taux from reductions_famille r
      where r.organisation_id = p_org
        and r.parts <= least(greatest(p_enfants, 0), par.ricf_max_enfants) + case when p_marie then 1 else 0 end
      order by r.parts desc limit 1;
    v_impot := v_impot - least(v_impot, v_impot * coalesce(v_taux, 0) / 100);
  elsif par.ricf_mode = 'reduction_charge' then
    -- Maroc (CGI art. 74) : somme fixe par personne à charge déduite de l'impôt annuel, sans le rendre négatif
    v_impot := greatest(0, v_impot - least(greatest(p_enfants, 0) + case when p_marie then 1 else 0 end, par.ricf_max_enfants)
                                     * par.deduction_par_charge_annuelle / v_f);
  elsif par.ricf_mode = 'familial' then
    -- pourcentage de l'impôt brut : taux « marié » + taux par enfant (dans la limite du nombre d'enfants retenus)
    v_taux := (case when p_marie then par.ricf_marie_pct else 0 end)
              + least(greatest(p_enfants, 0), par.ricf_max_enfants) * par.ricf_par_enfant_pct;
    v_impot := v_impot - least(v_impot, v_impot * v_taux / 100);
  elsif par.ricf_mode = 'parts' then
    -- par nombre de parts : ligne des parts immédiatement inférieures ou égales
    select * into rf from reductions_famille
      where organisation_id = p_org and parts <= p_parts order by parts desc limit 1;
    if found then
      v_impot := v_impot - least(v_impot, greatest(rf.minimum / v_f,
                   least(coalesce(rf.maximum / v_f, 1e18), v_impot * rf.taux / 100)));
    end if;
  end if;

  -- Diminution du taux de pression fiscale (impôt ÷ base) d'un nombre de points
  if par.reduction_pression_points > 0 and v_base > 0 then
    v_impot := greatest(0, v_impot - v_base * par.reduction_pression_points / 100);
  end if;

  ir := case when v_niveau = 'annuel' then v_impot / v_n else v_impot end;

  select t.montant into v_montant from tranches_forfaitaires t
    where t.organisation_id = p_org and t.code = 'TRIMF' and t.periodicite = p_periodicite
      and t.seuil_min <= p_brut and (t.seuil_max is null or p_brut <= t.seuil_max)
    order by t.seuil_min desc limit 1;
  trimf := coalesce(v_montant, 0);
  return next;
end $$;

create or replace function appliquer_modele_paie(p_org uuid, p_pays text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_pays not in ('SN', 'CI', 'ML', 'NE', 'BJ', 'GH', 'BF', 'TG', 'MA') then
    raise exception 'Aucun modèle de paie pour le pays %', p_pays;
  end if;

  delete from regles_paie where organisation_id = p_org;
  delete from bareme_ir where organisation_id = p_org;
  delete from reductions_famille where organisation_id = p_org;
  delete from tranches_forfaitaires where organisation_id = p_org;

  if p_pays = 'SN' then
    update parametrage_paie
       set abattement_seuil_annuel = null, abattement_pct_bas = 0, deduction_par_charge_annuelle = 0, abattement_sur_brut = false, mode_ir = 'calcul', bareme_version = null, ricf_mode = 'parts', reduction_pression_points = 0, abattement_pct = 30, abattement_plafond_annuel = 900000,
           arrondi_base = 1000,
           periodicite_par_statut = '{"permanent":"annuel","saisonnier":"mensuel","journalier":"journalier"}',
           calcul_par_periodicite = '{"annuel":{"n":1,"niveau":"periode"},"mensuel":{"n":12,"niveau":"periode"},"journalier":{"n":360,"niveau":"annuel"}}'
     where organisation_id = p_org;

    insert into regles_paie (organisation_id, code, libelle, taux_salarie, taux_employeur, plancher_mensuel,
                             plafond_mensuel, regime, deductible_ir, compte_cle, ordre) values
      (p_org, 'IPRES_RG', 'IPRES régime général', 5.6, 8.4, 0, 432000, null, false, 'organismes_sociaux', 10),
      (p_org, 'IPRES_RC', 'IPRES régime complémentaire cadres', 2.4, 3.6, 432000, 1296000, 'cadre', false, 'organismes_sociaux', 11),
      (p_org, 'CSS_PF', 'CSS prestations familiales', 0, 7, 0, 63000, null, false, 'organismes_sociaux', 20),
      (p_org, 'CSS_AT', 'CSS accidents du travail (1 %, 3 % ou 5 % selon le risque)', 0, 1, 0, 63000, null, false, 'organismes_sociaux', 21),
      (p_org, 'CFCE', 'CFCE (contribution forfaitaire à la charge de l''employeur, 3 % du brut imposable)', 0, 3, 0, null, null, false, 'etat_impots_taxes', 30);

    insert into bareme_ir (organisation_id, tranche_min, tranche_max, taux) values
      (p_org, 0, 630000, 0), (p_org, 630000, 1500000, 20), (p_org, 1500000, 4000000, 30),
      (p_org, 4000000, 8000000, 35), (p_org, 8000000, 13500000, 37), (p_org, 13500000, null, 40);

    insert into reductions_famille (organisation_id, parts, taux, minimum, maximum) values
      (p_org, 1.5, 10, 100000, 300000), (p_org, 2, 15, 200000, 650000), (p_org, 2.5, 20, 300000, 1100000),
      (p_org, 3, 25, 400000, 1650000), (p_org, 3.5, 30, 500000, 2030000), (p_org, 4, 35, 600000, 2490000),
      (p_org, 4.5, 40, 700000, 2755000), (p_org, 5, 45, 800000, 3180000);

    insert into tranches_forfaitaires (organisation_id, code, libelle, periodicite, seuil_min, seuil_max, montant) values
      (p_org, 'TRIMF', 'TRIMF', 'annuel', 600000, null, 3600), (p_org, 'TRIMF', 'TRIMF', 'annuel', 1000000, null, 4800),
      (p_org, 'TRIMF', 'TRIMF', 'annuel', 2000000, null, 12000), (p_org, 'TRIMF', 'TRIMF', 'annuel', 7000000, null, 18000),
      (p_org, 'TRIMF', 'TRIMF', 'annuel', 12000000, null, 36000),
      (p_org, 'TRIMF', 'TRIMF', 'mensuel', 50000, null, 300), (p_org, 'TRIMF', 'TRIMF', 'mensuel', 84000, null, 400),
      (p_org, 'TRIMF', 'TRIMF', 'mensuel', 167000, null, 500), (p_org, 'TRIMF', 'TRIMF', 'mensuel', 1000000, null, 1500),
      (p_org, 'TRIMF', 'TRIMF', 'journalier', 1000, null, 2.5), (p_org, 'TRIMF', 'TRIMF', 'journalier', 1700, null, 10),
      (p_org, 'TRIMF', 'TRIMF', 'journalier', 2800, null, 13.333333), (p_org, 'TRIMF', 'TRIMF', 'journalier', 5600, null, 33.333333),
      (p_org, 'TRIMF', 'TRIMF', 'journalier', 19500, null, 50), (p_org, 'TRIMF', 'TRIMF', 'journalier', 33400, null, 100);

  elsif p_pays = 'CI' then
    -- Cotisations CNPS (communiqué CNPS, plafonds au 1er janvier 2023 ; taux : brochure « Recouvrement », éd. 2018) :
    --  retraite 14 % (6,3 % salarié + 7,7 % employeur) plafonnée à 3 375 000 F/mois ; prestations familiales 5 %, maternité 0,75 %
    --  et accidents du travail (2 à 5 %) à la charge de l'employeur, plafonnés à 75 000 F/mois. Le plancher de cotisation
    --  (75 000 F) n'est pas géré par le moteur. Déductibilité de la retenue retraite dans l'assiette de l'ITS : non appliquée.
    -- Côte d'Ivoire : barème mensuel appliqué au brut mensuel, sans abattement ; les paliers sont saisis en montants
    -- annuels (× 12) car le moteur les ramène à la période. RICF : montant fixe (taux 100 %, minimum = maximum),
    -- plafonné à l'impôt brut comme le prévoit le texte (impôt = IB − RICF, jamais négatif).
    update parametrage_paie
       set abattement_seuil_annuel = null, abattement_pct_bas = 0, deduction_par_charge_annuelle = 0, abattement_sur_brut = false, mode_ir = 'calcul', bareme_version = null, ricf_mode = 'parts', reduction_pression_points = 0, abattement_pct = 0, abattement_plafond_annuel = null,
           arrondi_base = 0,
           periodicite_par_statut = '{"permanent":"mensuel","saisonnier":"mensuel","journalier":"mensuel"}',
           calcul_par_periodicite = '{"annuel":{"n":1,"niveau":"periode"},"mensuel":{"n":12,"niveau":"periode"},"journalier":{"n":360,"niveau":"annuel"}}'
     where organisation_id = p_org;

    insert into bareme_ir (organisation_id, tranche_min, tranche_max, taux) values
      (p_org, 0, 900000, 0),
      (p_org, 900000, 2880000, 16),
      (p_org, 2880000, 9600000, 21),
      (p_org, 9600000, 28800000, 24),
      (p_org, 28800000, 96000000, 28),
      (p_org, 96000000, null, 32);

    insert into reductions_famille (organisation_id, parts, taux, minimum, maximum) values
      (p_org, 1.5, 100, 66000, 66000), (p_org, 2, 100, 132000, 132000), (p_org, 2.5, 100, 198000, 198000),
      (p_org, 3, 100, 264000, 264000), (p_org, 3.5, 100, 330000, 330000), (p_org, 4, 100, 396000, 396000),
      (p_org, 4.5, 100, 462000, 462000), (p_org, 5, 100, 528000, 528000);

    insert into regles_paie (organisation_id, code, libelle, taux_salarie, taux_employeur, plancher_mensuel,
                             plafond_mensuel, regime, deductible_ir, compte_cle, ordre) values
      (p_org, 'CNPS_RET', 'CNPS retraite (6,3 % salarié, 7,7 % employeur)', 6.3, 7.7, 0, 3375000, null, false, 'organismes_sociaux', 10),
      (p_org, 'CNPS_PF', 'CNPS prestations familiales (5 %)', 0, 5, 0, 75000, null, false, 'organismes_sociaux', 11),
      (p_org, 'CNPS_MAT', 'CNPS assurance maternité (0,75 %)', 0, 0.75, 0, 75000, null, false, 'organismes_sociaux', 12),
      (p_org, 'CNPS_AT', 'CNPS accidents du travail (2 à 5 % selon le secteur : 2 % par défaut, à ajuster)', 0, 2, 0, 75000, null, false, 'organismes_sociaux', 13),
      (p_org, 'CN', 'Contribution nationale (CN)', 0, 1.2, 0, null, null, false, 'etat_impots_taxes', 30),
      (p_org, 'TA', 'Taxe d''apprentissage', 0, 0.4, 0, null, null, false, 'etat_impots_taxes', 31),
      (p_org, 'FPC', 'Taxe additionnelle à la formation professionnelle continue', 0, 1.2, 0, null, null, false, 'etat_impots_taxes', 32);
  elsif p_pays = 'ML' then
    -- Mali (DGI, brochure « L'impôt sur les traitements et salaires n° 2 », avril 2020) :
    --  base = salaire − cotisation INPS retraite (3,6 %) − indemnité spéciale de solidarité (déduction forfaitaire de l'employé),
    --  arrondie à 250 F inférieurs (niveau mensuel), barème progressif annuel ramené au mois ;
    --  réduction pour charges de famille = 10 % de l'impôt brut si marié + 2,5 % par enfant (jusqu'au 10e) ;
    --  puis diminution de 2 points du taux de pression fiscale (impôt net ÷ revenu imposable).
    -- Cotisations sociales (CLEISS, « Les cotisations au Mali », mise à jour du 01/01/2025, salariés sans plafond) :
    --  retraite 3,6 % salarié + 3,4 % employeur, invalidité 2 %, prestations familiales/maternité 8 %, accidents du travail 1 à 4 %,
    --  AMO 3,06 % salarié + 3,5 % employeur, taxe ANPE 1 % (employeur). L'AMO salarié n'est pas déduite de l'ITS (seule l'INPS l'est,
    --  selon la brochure DGI).
    update parametrage_paie
       set abattement_seuil_annuel = null, abattement_pct_bas = 0, deduction_par_charge_annuelle = 0, abattement_sur_brut = false, mode_ir = 'calcul', bareme_version = null, abattement_pct = 0, abattement_plafond_annuel = null,
           arrondi_base = 250, ricf_mode = 'familial', ricf_marie_pct = 10, ricf_par_enfant_pct = 2.5,
           ricf_max_enfants = 10, reduction_pression_points = 2,
           periodicite_par_statut = '{"permanent":"mensuel","saisonnier":"mensuel","journalier":"mensuel"}',
           calcul_par_periodicite = '{"annuel":{"n":1,"niveau":"periode"},"mensuel":{"n":12,"niveau":"periode"},"journalier":{"n":360,"niveau":"annuel"}}'
     where organisation_id = p_org;

    insert into bareme_ir (organisation_id, tranche_min, tranche_max, taux) values
      (p_org, 0, 330000, 0), (p_org, 330000, 578400, 5), (p_org, 578400, 1176400, 12),
      (p_org, 1176400, 1789733, 18), (p_org, 1789733, 2384195, 26), (p_org, 2384195, 3494130, 31),
      (p_org, 3494130, null, 37);

    insert into regles_paie (organisation_id, code, libelle, taux_salarie, taux_employeur, plancher_mensuel,
                             plafond_mensuel, regime, deductible_ir, compte_cle, ordre) values
      (p_org, 'INPS_RET', 'INPS retraite (3,6 % salarié, déductible de l''ITS ; 3,4 % employeur)', 3.6, 3.4, 0, null, null, true, 'organismes_sociaux', 10),
      (p_org, 'INPS_INV', 'INPS invalidité et survivants (2 % employeur)', 0, 2, 0, null, null, false, 'organismes_sociaux', 11),
      (p_org, 'INPS_PF', 'INPS prestations familiales et maternité (8 % employeur)', 0, 8, 0, null, null, false, 'organismes_sociaux', 12),
      (p_org, 'INPS_AT', 'INPS accidents du travail (1 à 4 % selon le risque : 1 % par défaut, à ajuster)', 0, 1, 0, null, null, false, 'organismes_sociaux', 13),
      (p_org, 'AMO', 'Assurance maladie obligatoire (3,06 % salarié, 3,5 % employeur)', 3.06, 3.5, 0, null, null, false, 'organismes_sociaux', 14),
      (p_org, 'ANPE', 'Taxe ANPE (1 % employeur)', 0, 1, 0, null, null, false, 'etat_impots_taxes', 30);
  elsif p_pays = 'NE' then
    -- Niger (Code général des impôts, art. 60 à 66) :
    --  base mensuelle = salaire − retenue pour pension (limitée à 6 % de la rémunération principale brute) − abattement de 10 %
    --  pour frais professionnels − abattement pour charges de famille (0 / 5 / 10 / 12 / 13 / 14 / 15 / 30 % selon 0 à 7 charges),
    --  arrondie au millier inférieur ; barème progressif mensuel de 1 % à 35 %.
    -- Cotisations (CLEISS, « Les cotisations au Niger », taux au 01/01/2024, plafond 500 000 F/mois) : vieillesse-invalidité-décès
    --  5,25 % salarié + 6,25 % employeur, prestations familiales/maternité 8,4 %, accidents du travail 1,75 %, ANPE 1 % (employeur).
    --  La retenue pension salarié (5,25 %) reste sous la limite de 6 % déductible du CGI.
    update parametrage_paie
       set abattement_seuil_annuel = null, abattement_pct_bas = 0, deduction_par_charge_annuelle = 0, abattement_sur_brut = false, mode_ir = 'calcul', bareme_version = null, abattement_pct = 10, abattement_plafond_annuel = null,
           arrondi_base = 1000, ricf_mode = 'abattement_base', ricf_marie_pct = 0, ricf_par_enfant_pct = 0,
           ricf_max_enfants = 6, reduction_pression_points = 0,
           periodicite_par_statut = '{"permanent":"mensuel","saisonnier":"mensuel","journalier":"mensuel"}',
           calcul_par_periodicite = '{"annuel":{"n":1,"niveau":"periode"},"mensuel":{"n":12,"niveau":"periode"},"journalier":{"n":360,"niveau":"annuel"}}'
     where organisation_id = p_org;

    insert into bareme_ir (organisation_id, tranche_min, tranche_max, taux) values
      (p_org, 0, 300000, 1), (p_org, 300000, 600000, 2), (p_org, 600000, 1200000, 6),
      (p_org, 1200000, 1800000, 13), (p_org, 1800000, 3600000, 25), (p_org, 3600000, 4800000, 30),
      (p_org, 4800000, 8400000, 32), (p_org, 8400000, 12000000, 34), (p_org, 12000000, null, 35);

    insert into reductions_famille (organisation_id, parts, taux, minimum, maximum) values
      (p_org, 1, 5, 0, null), (p_org, 2, 10, 0, null), (p_org, 3, 12, 0, null), (p_org, 4, 13, 0, null),
      (p_org, 5, 14, 0, null), (p_org, 6, 15, 0, null), (p_org, 7, 30, 0, null);

    insert into regles_paie (organisation_id, code, libelle, taux_salarie, taux_employeur, plancher_mensuel,
                             plafond_mensuel, regime, deductible_ir, compte_cle, ordre) values
      (p_org, 'CNSS_RET', 'CNSS vieillesse-invalidité-décès (5,25 % salarié, déductible de l''impôt ; 6,25 % employeur)', 5.25, 6.25, 0, 500000, null, true, 'organismes_sociaux', 10),
      (p_org, 'CNSS_PF', 'CNSS prestations familiales et maternité (8,4 % employeur)', 0, 8.4, 0, 500000, null, false, 'organismes_sociaux', 11),
      (p_org, 'CNSS_AT', 'CNSS accidents du travail (1,75 % employeur)', 0, 1.75, 0, 500000, null, false, 'organismes_sociaux', 12),
      (p_org, 'ANPE', 'Agence nationale pour la promotion de l''emploi (1 % employeur)', 0, 1, 0, 500000, null, false, 'etat_impots_taxes', 30);

  elsif p_pays = 'BJ' then
    -- Bénin (Code général des impôts 2025, art. 122 à 125 et 191 à 194) :
    --  base = salaire mensuel imposable brut (aucun abattement ni réduction familiale dans le texte) ;
    --  barème progressif mensuel : 0 % jusqu'à 60 000, 10 % jusqu'à 150 000, 15 % jusqu'à 250 000, 19 % jusqu'à 500 000, 30 % au-delà ;
    --  versement patronal sur salaires (VPS) : 4 % de la même base à la charge de l'employeur.
    -- Cotisations CNSS (CLEISS, « Les cotisations au Bénin », taux au 01/01/2024, sur le salaire brut, plafond non indiqué) :
    --  vieillesse-invalidité-décès 3,6 % salarié + 6,4 % employeur, prestations familiales/maternité 9 %, accidents du travail 1 à 4 %.
    --  La retenue salarié n'est pas déduite de l'impôt (le texte n'en prévoit pas).
    -- Non géré : redevance ORTB (1 000 F en mars, 3 000 F en juin).
    update parametrage_paie
       set abattement_seuil_annuel = null, abattement_pct_bas = 0, deduction_par_charge_annuelle = 0, abattement_sur_brut = false, mode_ir = 'calcul', bareme_version = null, abattement_pct = 0, abattement_plafond_annuel = null,
           arrondi_base = 0, ricf_mode = 'parts', ricf_marie_pct = 0, ricf_par_enfant_pct = 0,
           ricf_max_enfants = 10, reduction_pression_points = 0,
           periodicite_par_statut = '{"permanent":"mensuel","saisonnier":"mensuel","journalier":"mensuel"}',
           calcul_par_periodicite = '{"annuel":{"n":1,"niveau":"periode"},"mensuel":{"n":12,"niveau":"periode"},"journalier":{"n":360,"niveau":"annuel"}}'
     where organisation_id = p_org;

    insert into bareme_ir (organisation_id, tranche_min, tranche_max, taux) values
      (p_org, 0, 720000, 0), (p_org, 720000, 1800000, 10), (p_org, 1800000, 3000000, 15),
      (p_org, 3000000, 6000000, 19), (p_org, 6000000, null, 30);

    insert into regles_paie (organisation_id, code, libelle, taux_salarie, taux_employeur, plancher_mensuel,
                             plafond_mensuel, regime, deductible_ir, compte_cle, ordre) values
      (p_org, 'CNSS_RET', 'CNSS vieillesse-invalidité-décès (3,6 % salarié, 6,4 % employeur)', 3.6, 6.4, 0, null, null, false, 'organismes_sociaux', 10),
      (p_org, 'CNSS_PF', 'CNSS prestations familiales et maternité (9 % employeur)', 0, 9, 0, null, null, false, 'organismes_sociaux', 11),
      (p_org, 'CNSS_AT', 'CNSS accidents du travail (1 à 4 % selon le risque : 1 % par défaut, à ajuster)', 0, 1, 0, null, null, false, 'organismes_sociaux', 12),
      (p_org, 'VPS', 'Versement patronal sur salaires (VPS, art. 194 du CGI)', 0, 4, 0, null, null, false, 'etat_impots_taxes', 30);
  elsif p_pays = 'GH' then
    -- Ghana (Ghana Revenue Authority, « PAYE » — résidents, barèmes en vigueur depuis le 1er janvier 2024) :
    --  revenu imposable mensuel = salaire brut − cotisation SSNIT salarié (5,5 % du salaire de base) ;
    --  tranches mensuelles : 490 à 0 %, 110 à 5 %, 130 à 10 %, 3 166,67 à 17,5 %, 16 000 à 25 %, 30 520 à 30 %, puis 35 %
    --  (saisies en montants annuels × 12 : 5 880 / 7 200 / 8 760 / 46 760 / 238 760 / 605 000).
    --  Aucune réduction familiale dans ce régime. Non gérés : taux de 25 % des non-résidents, fonds de prévoyance et autres
    --  déductions facultatives (à saisir comme règles déductibles).
    -- Taux patronal SSNIT de 13 % : taux légal connu, mais NON fourni par la page de la GRA — à valider.
    -- La page arrondit le dernier seuil à 50 000 / 600 000 ; les tranches détaillées s'additionnent à 50 416,67 / 605 000 (retenu ici).
    update parametrage_paie
       set abattement_seuil_annuel = null, abattement_pct_bas = 0, deduction_par_charge_annuelle = 0, abattement_sur_brut = false, mode_ir = 'calcul', bareme_version = null, abattement_pct = 0, abattement_plafond_annuel = null,
           arrondi_base = 0, ricf_mode = 'parts', ricf_marie_pct = 0, ricf_par_enfant_pct = 0,
           ricf_max_enfants = 10, reduction_pression_points = 0,
           periodicite_par_statut = '{"permanent":"mensuel","saisonnier":"mensuel","journalier":"mensuel"}',
           calcul_par_periodicite = '{"annuel":{"n":1,"niveau":"periode"},"mensuel":{"n":12,"niveau":"periode"},"journalier":{"n":360,"niveau":"annuel"}}'
     where organisation_id = p_org;

    insert into bareme_ir (organisation_id, tranche_min, tranche_max, taux) values
      (p_org, 0, 5880, 0), (p_org, 5880, 7200, 5), (p_org, 7200, 8760, 10), (p_org, 8760, 46760, 17.5),
      (p_org, 46760, 238760, 25), (p_org, 238760, 605000, 30), (p_org, 605000, null, 35);

    insert into regles_paie (organisation_id, code, libelle, taux_salarie, taux_employeur, plancher_mensuel,
                             plafond_mensuel, regime, deductible_ir, compte_cle, ordre) values
      (p_org, 'SSNIT', 'SSNIT — pension (5,5 % salarié, déductible du PAYE ; 13 % employeur à valider)', 5.5, 13, 0, null, null, true, 'organismes_sociaux', 10);
  elsif p_pays = 'BF' then
    -- Burkina Faso (Code général des impôts, art. 60 à 62 — recueil de textes fiscaux DGI, éd. 2014 — modifié depuis 2018 pour les
    -- charges de famille ; art. 122 à 124 pour la taxe patronale et d'apprentissage) :
    --  base mensuelle = salaire − retenue pension (limitée à 8 % du salaire de base) − abattement forfaitaire pour frais et charges
    --  professionnelles sur le salaire de base : 20 % pour les catégories supérieures, 25 % pour les autres (25 % retenu ici :
    --  les cadres supérieurs doivent être ajustés à 20 % dans les paramètres) ;
    --  barème mensuel : 0 % jusqu'à 30 000, 12,1 % jusqu'à 50 000, 13,9 % jusqu'à 80 000, 15,7 % jusqu'à 120 000, 18,4 % jusqu'à 170 000,
    --  21,7 % jusqu'à 250 000, 25 % au-delà (montants saisis × 12) ;
    --  réduction de l'impôt pour charges de famille : 8 / 10 / 12 / 14 % pour 1 / 2 / 3 / 4 charges (un conjoint et jusqu'à 3 enfants ;
    --  la réforme de 2018 plafonne à 14 % les foyers de 5 à 7 charges, qui relevaient de 16 / 18 / 20 %) ;
    --  taxe patronale et d'apprentissage (TPA) : 3 % de la masse salariale à la charge de l'employeur.
    -- CNSS (site cnssbf.org, décret du 24/02/2023) : pension 5,5 % salarié + 8,5 % employeur, prestations familiales 6 %,
    --  risques professionnels 1,5 % (employeur), plafond 800 000 F/mois (arrêté d'août 2022).
    -- Non gérés : différenciation cadre supérieur / autres (un seul taux d'abattement) et salaire de base distinct des indemnités
    --  (le salaire du contrat sert de base).
    update parametrage_paie
       set abattement_seuil_annuel = null, abattement_pct_bas = 0, deduction_par_charge_annuelle = 0, abattement_sur_brut = true, mode_ir = 'calcul', bareme_version = null, abattement_pct = 25, abattement_plafond_annuel = null,
           arrondi_base = 0, ricf_mode = 'charges_impot', ricf_marie_pct = 0, ricf_par_enfant_pct = 0,
           ricf_max_enfants = 3, reduction_pression_points = 0,
           periodicite_par_statut = '{"permanent":"mensuel","saisonnier":"mensuel","journalier":"mensuel"}',
           calcul_par_periodicite = '{"annuel":{"n":1,"niveau":"periode"},"mensuel":{"n":12,"niveau":"periode"},"journalier":{"n":360,"niveau":"annuel"}}'
     where organisation_id = p_org;

    insert into bareme_ir (organisation_id, tranche_min, tranche_max, taux) values
      (p_org, 0, 360000, 0), (p_org, 360000, 600000, 12.1), (p_org, 600000, 960000, 13.9),
      (p_org, 960000, 1440000, 15.7), (p_org, 1440000, 2040000, 18.4), (p_org, 2040000, 3000000, 21.7),
      (p_org, 3000000, null, 25);

    insert into reductions_famille (organisation_id, parts, taux, minimum, maximum) values
      (p_org, 1, 8, 0, null), (p_org, 2, 10, 0, null), (p_org, 3, 12, 0, null), (p_org, 4, 14, 0, null);

    insert into regles_paie (organisation_id, code, libelle, taux_salarie, taux_employeur, plancher_mensuel,
                             plafond_mensuel, regime, deductible_ir, compte_cle, ordre) values
      (p_org, 'CNSS_RET', 'CNSS pension (5,5 % salarié, déductible de l''IUTS ; 8,5 % employeur)', 5.5, 8.5, 0, 800000, null, true, 'organismes_sociaux', 10),
      (p_org, 'CNSS_PF', 'CNSS prestations familiales (6 % employeur)', 0, 6, 0, 800000, null, false, 'organismes_sociaux', 11),
      (p_org, 'CNSS_AT', 'CNSS risques professionnels (1,5 % employeur)', 0, 1.5, 0, 800000, null, false, 'organismes_sociaux', 12),
      (p_org, 'TPA', 'Taxe patronale et d''apprentissage (3 % employeur, art. 124 du CGI)', 0, 3, 0, null, null, false, 'etat_impots_taxes', 30);
  elsif p_pays = 'TG' then
    -- Togo (Code général des impôts, mise à jour 2023 : art. 26 base, art. 72-73 charges de famille, art. 74 barème annuel) :
    --  la retenue est calculée sur l'année (salaire mensuel × 12) puis ramenée au mois ;
    --  revenu net = salaire − retenue pension obligatoire (limitée à 6 % du brut) − cotisation salariale d'assurance maladie
    --  obligatoire, puis déduction forfaitaire de 28 % sur la fraction du revenu n'excédant pas 10 000 000 F (abattement plafonné
    --  à 2 800 000 F par an), puis 10 000 F par mois (120 000 F par an) et par personne à charge, au plus 6 (conjoint sans ressource
    --  compris), puis arrondi au millier inférieur ;
    --  barème annuel : 0 % jusqu'à 900 000, 3 % jusqu'à 3 000 000, 10 % jusqu'à 6 000 000, 15 % jusqu'à 9 000 000, 20 % jusqu'à 12 000 000,
    --  25 % jusqu'à 15 000 000, 30 % jusqu'à 20 000 000, 35 % au-delà.
    -- CNSS (CLEISS, taux 2026) : vieillesse-invalidité-décès 4 % salarié + 12,5 % employeur, prestations familiales 3 %, risques
    --  professionnels 2 % (employeur). Assurance maladie universelle (décret 2023-096, art. 12) : 10 % de la rémunération dont 50 %
    --  au moins à la charge de l'employeur : 5 % / 5 % retenu ici (part salariale maximale) — à ajuster selon la convention.
    -- Non gérés : arrondi de l'impôt à la dizaine, plancher de cotisation au SMIG, déductions facultatives (assurance-vie, intérêts
    --  d'emprunt), plafond éventuel de la CNSS (non indiqué par le CLEISS).
    update parametrage_paie
       set abattement_seuil_annuel = null, abattement_pct_bas = 0, deduction_par_charge_annuelle = 120000, abattement_sur_brut = false, mode_ir = 'calcul', bareme_version = null,
           abattement_pct = 28, abattement_plafond_annuel = 2800000,
           arrondi_base = 1000, ricf_mode = 'deduction_charge', ricf_marie_pct = 0, ricf_par_enfant_pct = 0,
           ricf_max_enfants = 6, reduction_pression_points = 0,
           periodicite_par_statut = '{"permanent":"mensuel","saisonnier":"mensuel","journalier":"mensuel"}',
           calcul_par_periodicite = '{"annuel":{"n":1,"niveau":"periode"},"mensuel":{"n":12,"niveau":"annuel"},"journalier":{"n":360,"niveau":"annuel"}}'
     where organisation_id = p_org;

    insert into bareme_ir (organisation_id, tranche_min, tranche_max, taux) values
      (p_org, 0, 900000, 0), (p_org, 900000, 3000000, 3), (p_org, 3000000, 6000000, 10),
      (p_org, 6000000, 9000000, 15), (p_org, 9000000, 12000000, 20), (p_org, 12000000, 15000000, 25),
      (p_org, 15000000, 20000000, 30), (p_org, 20000000, null, 35);

    insert into regles_paie (organisation_id, code, libelle, taux_salarie, taux_employeur, plancher_mensuel,
                             plafond_mensuel, regime, deductible_ir, compte_cle, ordre) values
      (p_org, 'CNSS_RET', 'CNSS vieillesse-invalidité-décès (4 % salarié, déductible de l''IRPP ; 12,5 % employeur)', 4, 12.5, 0, null, null, true, 'organismes_sociaux', 10),
      (p_org, 'CNSS_PF', 'CNSS prestations familiales (3 % employeur)', 0, 3, 0, null, null, false, 'organismes_sociaux', 11),
      (p_org, 'CNSS_AT', 'CNSS risques professionnels (2 % employeur)', 0, 2, 0, null, null, false, 'organismes_sociaux', 12),
      (p_org, 'AMU', 'Assurance maladie universelle (5 % salarié, déductible de l''IRPP ; 5 % employeur — répartition à ajuster)', 5, 5, 0, null, null, true, 'organismes_sociaux', 13);
  else
    -- Maroc (Code général des impôts 2026, publié par la DGI : art. 58-59 base, art. 73-I barème, art. 74 charges de famille) :
    --  la retenue est calculée sur l'année (salaire mensuel × 12) puis ramenée au mois ;
    --  revenu net = salaire brut imposable − frais professionnels forfaitaires (35 % si le brut annuel n'excède pas 78 000 DH,
    --  sinon 25 %, dans la limite de 35 000 DH par an) − cotisations salariales de sécurité sociale (CNSS) et d'AMO ;
    --  barème annuel : 0 % jusqu'à 40 000, 10 % jusqu'à 60 000, 20 % jusqu'à 80 000, 30 % jusqu'à 100 000, 34 % jusqu'à 180 000, 37 % au-delà ;
    --  réduction de l'impôt de 600 DH par an et par personne à charge (épouse, enfants), au plus 3 600 DH (6 personnes).
    -- Cotisations (CLEISS, « Les cotisations au Maroc », taux au 01/01/2024) : prestations à court terme 0,52 % salarié + 1,05 % employeur
    --  et retraite 3,96 % + 7,93 % (plafond 6 000 DH/mois) ; prestations familiales 6,40 % employeur ; AMO 2,26 % salarié + 2,26 % employeur
    --  et 1,85 % employeur (solidarité) ; taxe de formation professionnelle 1,6 % employeur.
    -- Non gérés : catégories professionnelles à taux de frais spécifiques (journalistes, navigants…), retraite complémentaire (CIMR),
    --  prêts logement et assurance-groupe déductibles, avantages en nature (à saisir en règles). Le Maroc utilise le plan comptable
    --  PCM_MA et la monnaie MAD (attribués à l'inscription).
    update parametrage_paie
       set abattement_seuil_annuel = 78000, abattement_pct_bas = 35, deduction_par_charge_annuelle = 600, abattement_sur_brut = true,
           mode_ir = 'calcul', bareme_version = null, abattement_pct = 25, abattement_plafond_annuel = 35000,
           arrondi_base = 0, ricf_mode = 'reduction_charge', ricf_marie_pct = 0, ricf_par_enfant_pct = 0,
           ricf_max_enfants = 6, reduction_pression_points = 0,
           periodicite_par_statut = '{"permanent":"mensuel","saisonnier":"mensuel","journalier":"mensuel"}',
           calcul_par_periodicite = '{"annuel":{"n":1,"niveau":"periode"},"mensuel":{"n":12,"niveau":"annuel"},"journalier":{"n":360,"niveau":"annuel"}}'
     where organisation_id = p_org;

    insert into bareme_ir (organisation_id, tranche_min, tranche_max, taux) values
      (p_org, 0, 40000, 0), (p_org, 40000, 60000, 10), (p_org, 60000, 80000, 20),
      (p_org, 80000, 100000, 30), (p_org, 100000, 180000, 34), (p_org, 180000, null, 37);

    insert into regles_paie (organisation_id, code, libelle, taux_salarie, taux_employeur, plancher_mensuel,
                             plafond_mensuel, regime, deductible_ir, compte_cle, ordre) values
      (p_org, 'CNSS_RET', 'CNSS retraite (3,96 % salarié, déductible de l''IR ; 7,93 % employeur ; plafond 6 000 DH)', 3.96, 7.93, 0, 6000, null, true, 'organismes_sociaux', 10),
      (p_org, 'CNSS_PST', 'CNSS prestations sociales à court terme (0,52 % salarié, déductible ; 1,05 % employeur ; plafond 6 000 DH)', 0.52, 1.05, 0, 6000, null, true, 'organismes_sociaux', 11),
      (p_org, 'CNSS_PF', 'CNSS allocations familiales (6,4 % employeur)', 0, 6.4, 0, null, null, false, 'organismes_sociaux', 12),
      (p_org, 'AMO', 'Assurance maladie obligatoire (2,26 % salarié, déductible de l''IR ; 2,26 % employeur)', 2.26, 2.26, 0, null, null, true, 'organismes_sociaux', 13),
      (p_org, 'AMO_SOL', 'AMO — participation de solidarité (1,85 % employeur)', 0, 1.85, 0, null, null, false, 'organismes_sociaux', 14),
      (p_org, 'TFP', 'Taxe de formation professionnelle (1,6 % employeur)', 0, 1.6, 0, null, null, false, 'organismes_sociaux', 15);
  end if;
end $$;

create or replace function initialiser_modules(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_pays text;
begin
  perform initialiser_phase1(p_org);
  perform initialiser_phase2(p_org);
  perform initialiser_phase4(p_org);
  perform initialiser_phase5(p_org);
  select pays into v_pays from organisations where id = p_org;
  if v_pays in ('CI', 'ML', 'NE', 'BJ', 'GH', 'BF', 'TG', 'MA') and not exists (select 1 from regles_paie where organisation_id = p_org) then
    perform appliquer_modele_paie(p_org, v_pays);
  end if;
end $$;
