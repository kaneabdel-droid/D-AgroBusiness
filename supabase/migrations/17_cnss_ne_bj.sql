-- D-AGROBUSINESS — Niger et Bénin : cotisations CNSS (source : CLEISS, taux au 1er janvier 2024).
-- Niger : la retenue pension salarié (5,25 %) est désormais déduite de la base de l'impôt (modèle précédemment sans CNSS).
-- Les organisations déjà créées rechargent le modèle depuis RH > Paramètres, puis revalident.

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
    -- Cotisations CNPS (communiqué CNPS, plafonds au 1er janvier 2023 ; taux : brochure « Recouvrement », éd. 2018) :
    --  retraite 14 % (6,3 % salarié + 7,7 % employeur) plafonnée à 3 375 000 F/mois ; prestations familiales 5 %, maternité 0,75 %
    --  et accidents du travail (2 à 5 %) à la charge de l'employeur, plafonnés à 75 000 F/mois. Le plancher de cotisation
    --  (75 000 F) n'est pas géré par le moteur. Déductibilité de la retenue retraite dans l'assiette de l'ITS : non appliquée.
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
      (p_org, 'CNSS_RET', 'CNSS vieillesse-invalidité-décès (3,6 % salarié, 6,4 % employeur)', 3.6, 6.4, 0, null, null, false, 'organismes_sociaux', 10),
      (p_org, 'CNSS_PF', 'CNSS prestations familiales et maternité (9 % employeur)', 0, 9, 0, null, null, false, 'organismes_sociaux', 11),
      (p_org, 'CNSS_AT', 'CNSS accidents du travail (1 à 4 % selon le risque : 1 % par défaut, à ajuster)', 0, 1, 0, null, null, false, 'organismes_sociaux', 12),
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
