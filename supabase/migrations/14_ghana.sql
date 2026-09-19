-- D-AGROBUSINESS — Ghana, étape 2 : plan comptable, monnaie (GHS) et modèle de paie PAYE.
-- À exécuter APRÈS 13_ghana_referentiel.sql (validé séparément).
--
-- Plan comptable IFRS_GH : plan interne à numérotation par classes (1 capitaux et emprunts, 2 immobilisations, 3 stocks,
-- 4 tiers, 5 trésorerie, 6 charges, 7 produits), libellés en anglais. Le Ghana n'impose pas de numérotation : les
-- états sont présentés selon IFRS / IFRS for SMEs, et ce plan reprend les numéros utilisés par tous les modules
-- (stocks, ventes, financement, paie, TVA, amortissements) pour qu'ils fonctionnent sans adaptation.
-- L'interface reste en français à ce stade (une traduction est un chantier distinct).

insert into modeles_plan_comptable (referentiel, numero, libelle) values
  ('IFRS_GH', '10', 'Share capital'),
  ('IFRS_GH', '11', 'Reserves'),
  ('IFRS_GH', '12', 'Retained earnings brought forward'),
  ('IFRS_GH', '13', 'Profit or loss for the year'),
  ('IFRS_GH', '14', 'Capital grants (deferred income)'),
  ('IFRS_GH', '15', 'Regulatory provisions'),
  ('IFRS_GH', '16', 'Borrowings and similar liabilities'),
  ('IFRS_GH', '17', 'Lease liabilities (finance leases)'),
  ('IFRS_GH', '173', 'Lease liabilities — equipment'),
  ('IFRS_GH', '21', 'Intangible assets'),
  ('IFRS_GH', '22', 'Land'),
  ('IFRS_GH', '23', 'Buildings, plant and installations'),
  ('IFRS_GH', '24', 'Machinery, furniture and biological assets'),
  ('IFRS_GH', '245', 'Motor vehicles'),
  ('IFRS_GH', '28', 'Accumulated depreciation'),
  ('IFRS_GH', '284', 'Accumulated depreciation — machinery and equipment'),
  ('IFRS_GH', '31', 'Goods for resale and inputs'),
  ('IFRS_GH', '32', 'Raw materials (agricultural produce)'),
  ('IFRS_GH', '33', 'Other supplies'),
  ('IFRS_GH', '36', 'Finished goods'),
  ('IFRS_GH', '37', 'By-products and residual products'),
  ('IFRS_GH', '39', 'Inventory impairment'),
  ('IFRS_GH', '401', 'Trade payables'),
  ('IFRS_GH', '409', 'Supplier advances'),
  ('IFRS_GH', '411', 'Trade receivables (customers and farmers)'),
  ('IFRS_GH', '419', 'Customer advances'),
  ('IFRS_GH', '421', 'Staff advances'),
  ('IFRS_GH', '422', 'Net salaries payable'),
  ('IFRS_GH', '431', 'Social security payable (SSNIT)'),
  ('IFRS_GH', '4431', 'VAT output'),
  ('IFRS_GH', '4441', 'VAT payable'),
  ('IFRS_GH', '4449', 'VAT credit carried forward'),
  ('IFRS_GH', '442', 'Taxes and levies payable'),
  ('IFRS_GH', '4451', 'VAT recoverable on assets'),
  ('IFRS_GH', '4452', 'VAT recoverable on purchases'),
  ('IFRS_GH', '447', 'Income tax withheld at source (PAYE)'),
  ('IFRS_GH', '462', 'Shareholders current accounts'),
  ('IFRS_GH', '47', 'Sundry debtors and creditors'),
  ('IFRS_GH', '481', 'Capital asset suppliers'),
  ('IFRS_GH', '521', 'Bank accounts'),
  ('IFRS_GH', '561', 'Short-term bank facilities (incl. seasonal credit)'),
  ('IFRS_GH', '571', 'Cash on hand'),
  ('IFRS_GH', '601', 'Purchases of goods for resale'),
  ('IFRS_GH', '602', 'Purchases of raw materials and supplies'),
  ('IFRS_GH', '604', 'Purchases of consumable supplies'),
  ('IFRS_GH', '6031', 'Change in inventory of goods'),
  ('IFRS_GH', '6032', 'Change in inventory of raw materials and supplies'),
  ('IFRS_GH', '61', 'Transport'),
  ('IFRS_GH', '62', 'External services A'),
  ('IFRS_GH', '63', 'External services B'),
  ('IFRS_GH', '64', 'Taxes and duties'),
  ('IFRS_GH', '66', 'Staff costs'),
  ('IFRS_GH', '661', 'Salaries and wages'),
  ('IFRS_GH', '664', 'Employer social contributions'),
  ('IFRS_GH', '67', 'Finance costs'),
  ('IFRS_GH', '671', 'Interest on borrowings'),
  ('IFRS_GH', '68', 'Depreciation and amortisation'),
  ('IFRS_GH', '681', 'Depreciation expense'),
  ('IFRS_GH', '701', 'Sales of goods'),
  ('IFRS_GH', '702', 'Sales of finished goods'),
  ('IFRS_GH', '703', 'Sales of by-products'),
  ('IFRS_GH', '706', 'Services sold'),
  ('IFRS_GH', '707', 'Other operating income'),
  ('IFRS_GH', '7072', 'Commissions and brokerage'),
  ('IFRS_GH', '71', 'Operating grants'),
  ('IFRS_GH', '73', 'Change in inventory of goods produced'),
  ('IFRS_GH', '77', 'Finance income'),
  ('IFRS_GH', '865', 'Release of capital grants to income')
on conflict do nothing;

-- Inscription : le Ghana reçoit le référentiel IFRS_GH et la monnaie GHS
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

  v_ref := case v_pays when 'MA' then 'PCM_MA' when 'MR' then 'PCM_MR' when 'GH' then 'IFRS_GH' else 'SYSCOHADA' end;
  v_devise := case v_pays when 'MA' then 'MAD' when 'MR' then 'MRU' when 'GH' then 'GHS' else 'XOF' end;

  insert into organisations (nom, pays, devise, referentiel)
    values (new.raw_user_meta_data ->> 'organisation_nom', v_pays, v_devise, v_ref)
    returning id into v_org;

  insert into utilisateurs (id, organisation_id, nom_complet, role)
    values (new.id, v_org, new.raw_user_meta_data ->> 'nom_complet', 'admin');

  perform initialiser_organisation(v_org);
  return new;
end $$;

-- Création d'organisation : le modèle de paie du pays est chargé d'office (Sénégal : déjà fait par initialiser_phase4)
create or replace function initialiser_modules(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_pays text;
begin
  perform initialiser_phase1(p_org);
  perform initialiser_phase2(p_org);
  perform initialiser_phase4(p_org);
  perform initialiser_phase5(p_org);
  select pays into v_pays from organisations where id = p_org;
  if v_pays in ('CI', 'ML', 'NE', 'BJ', 'GH') and not exists (select 1 from regles_paie where organisation_id = p_org) then
    perform appliquer_modele_paie(p_org, v_pays);
  end if;
end $$;

revoke execute on function initialiser_modules(uuid) from public, anon, authenticated;

-- ============================================================
-- Modèles de paie par pays : SN, CI, ML, NE, BJ, GH
-- ============================================================
create or replace function appliquer_modele_paie(p_org uuid, p_pays text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_pays not in ('SN', 'CI', 'ML', 'NE', 'BJ', 'GH') then
    raise exception 'Aucun modèle de paie pour le pays %', p_pays;
  end if;

  delete from regles_paie where organisation_id = p_org;
  delete from bareme_ir where organisation_id = p_org;
  delete from reductions_famille where organisation_id = p_org;
  delete from tranches_forfaitaires where organisation_id = p_org;

  if p_pays = 'SN' then
    update parametrage_paie
       set mode_ir = 'calcul', bareme_version = null, ricf_mode = 'parts', reduction_pression_points = 0, abattement_pct = 30, abattement_plafond_annuel = 900000,
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
    -- Côte d'Ivoire : barème mensuel appliqué au brut mensuel, sans abattement ; les paliers sont saisis en montants
    -- annuels (× 12) car le moteur les ramène à la période. RICF : montant fixe (taux 100 %, minimum = maximum),
    -- plafonné à l'impôt brut comme le prévoit le texte (impôt = IB − RICF, jamais négatif).
    update parametrage_paie
       set mode_ir = 'calcul', bareme_version = null, ricf_mode = 'parts', reduction_pression_points = 0, abattement_pct = 0, abattement_plafond_annuel = null,
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
      (p_org, 'CN', 'Contribution nationale (CN)', 0, 1.2, 0, null, null, false, 'etat_impots_taxes', 30),
      (p_org, 'TA', 'Taxe d''apprentissage', 0, 0.4, 0, null, null, false, 'etat_impots_taxes', 31),
      (p_org, 'FPC', 'Taxe additionnelle à la formation professionnelle continue', 0, 1.2, 0, null, null, false, 'etat_impots_taxes', 32);
  elsif p_pays = 'ML' then
    -- Mali (DGI, brochure « L'impôt sur les traitements et salaires n° 2 », avril 2020) :
    --  base = salaire − cotisation INPS retraite (3,6 %) − indemnité spéciale de solidarité (déduction forfaitaire de l'employé),
    --  arrondie à 250 F inférieurs (niveau mensuel), barème progressif annuel ramené au mois ;
    --  réduction pour charges de famille = 10 % de l'impôt brut si marié + 2,5 % par enfant (jusqu'au 10e) ;
    --  puis diminution de 2 points du taux de pression fiscale (impôt net ÷ revenu imposable).
    -- Non fournis par la brochure, donc à paramétrer : taux patronaux INPS / AMO, taxes patronales.
    update parametrage_paie
       set mode_ir = 'calcul', bareme_version = null, abattement_pct = 0, abattement_plafond_annuel = null,
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
      (p_org, 'INPS_RET', 'INPS — retenue pour pension (déductible de l''ITS dans la limite de 3,6 %)', 3.6, 0, 0, null, null, true, 'organismes_sociaux', 10);
  elsif p_pays = 'NE' then
    -- Niger (Code général des impôts, art. 60 à 66) :
    --  base mensuelle = salaire − retenue pour pension (limitée à 6 % de la rémunération principale brute) − abattement de 10 %
    --  pour frais professionnels − abattement pour charges de famille (0 / 5 / 10 / 12 / 13 / 14 / 15 / 30 % selon 0 à 7 charges),
    --  arrondie au millier inférieur ; barème progressif mensuel de 1 % à 35 %.
    -- Non fournis par le CGI, donc à paramétrer : taux CNSS (salarié et employeur) et taxes patronales.
    update parametrage_paie
       set mode_ir = 'calcul', bareme_version = null, abattement_pct = 10, abattement_plafond_annuel = null,
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
      (p_org, 'CNSS', 'CNSS — taux à paramétrer (retenue pension déductible dans la limite de 6 % du salaire)', 0, 0, 0, null, null, true, 'organismes_sociaux', 10);

  elsif p_pays = 'BJ' then
    -- Bénin (Code général des impôts 2025, art. 122 à 125 et 191 à 194) :
    --  base = salaire mensuel imposable brut (aucun abattement ni réduction familiale dans le texte) ;
    --  barème progressif mensuel : 0 % jusqu'à 60 000, 10 % jusqu'à 150 000, 15 % jusqu'à 250 000, 19 % jusqu'à 500 000, 30 % au-delà ;
    --  versement patronal sur salaires (VPS) : 4 % de la même base à la charge de l'employeur.
    -- Non gérés / à paramétrer : redevance ORTB (1 000 F en mars, 3 000 F en juin), cotisations CNSS.
    update parametrage_paie
       set mode_ir = 'calcul', bareme_version = null, abattement_pct = 0, abattement_plafond_annuel = null,
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
      (p_org, 'VPS', 'Versement patronal sur salaires (VPS, art. 194 du CGI)', 0, 4, 0, null, null, false, 'etat_impots_taxes', 30);
  else
    -- Ghana (Ghana Revenue Authority, « PAYE » — résidents, barèmes en vigueur depuis le 1er janvier 2024) :
    --  revenu imposable mensuel = salaire brut − cotisation SSNIT salarié (5,5 % du salaire de base) ;
    --  tranches mensuelles : 490 à 0 %, 110 à 5 %, 130 à 10 %, 3 166,67 à 17,5 %, 16 000 à 25 %, 30 520 à 30 %, puis 35 %
    --  (saisies en montants annuels × 12 : 5 880 / 7 200 / 8 760 / 46 760 / 238 760 / 605 000).
    --  Aucune réduction familiale dans ce régime. Non gérés : taux de 25 % des non-résidents, fonds de prévoyance et autres
    --  déductions facultatives (à saisir comme règles déductibles).
    -- Taux patronal SSNIT de 13 % : taux légal connu, mais NON fourni par la page de la GRA — à valider.
    -- La page arrondit le dernier seuil à 50 000 / 600 000 ; les tranches détaillées s'additionnent à 50 416,67 / 605 000 (retenu ici).
    update parametrage_paie
       set mode_ir = 'calcul', bareme_version = null, abattement_pct = 0, abattement_plafond_annuel = null,
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
  end if;
end $$;
