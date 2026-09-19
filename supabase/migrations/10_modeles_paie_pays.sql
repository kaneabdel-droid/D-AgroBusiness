-- D-AGROBUSINESS — Modèles de paramétrage de paie par pays.
-- Un modèle remplit les règles de cotisations, le barème d'impôt, les réductions de famille, les paliers de forfait et
-- les paramètres de calcul. Modèles disponibles :
--   SN : Sénégal — barème officiel de retenue à la source (formule vérifiée sur les 19 823 lignes de la grille DGID).
--   CI : Côte d'Ivoire — ITS = impôt brut (barème mensuel) − RICF (montant fixe par nombre de parts), art. 116 et 119 bis du CGI
--        (source : DGI, « Impôts et taxes en Côte d'Ivoire »), et contributions patronales CN 1,2 %, taxe d'apprentissage 0,4 %,
--        taxe additionnelle de formation professionnelle continue 1,2 % (art. 146). Non fournis par ce document, donc à paramétrer :
--        les cotisations CNPS et la règle de détermination du nombre de parts selon la situation familiale.
-- Le chargement invalide la validation du paramétrage : un administrateur doit la confirmer à nouveau.

create or replace function appliquer_modele_paie(p_org uuid, p_pays text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_pays not in ('SN', 'CI') then
    raise exception 'Aucun modèle de paie pour le pays %', p_pays;
  end if;

  delete from regles_paie where organisation_id = p_org;
  delete from bareme_ir where organisation_id = p_org;
  delete from reductions_famille where organisation_id = p_org;
  delete from tranches_forfaitaires where organisation_id = p_org;

  if p_pays = 'SN' then
    update parametrage_paie
       set mode_ir = 'calcul', bareme_version = null, abattement_pct = 30, abattement_plafond_annuel = 900000,
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

  else
    -- Côte d'Ivoire : barème mensuel appliqué au brut mensuel, sans abattement ; les paliers sont saisis en montants
    -- annuels (× 12) car le moteur les ramène à la période. RICF : montant fixe (taux 100 %, minimum = maximum),
    -- plafonné à l'impôt brut comme le prévoit le texte (impôt = IB − RICF, jamais négatif).
    update parametrage_paie
       set mode_ir = 'calcul', bareme_version = null, abattement_pct = 0, abattement_plafond_annuel = null,
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
  end if;
end $$;

-- Chargement d'un modèle par un administrateur (remplace les règles, barèmes et paramètres de l'organisation)
create or replace function charger_modele_paie(p_pays text) returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid := current_org_id();
begin
  if v_org is null or not has_role('admin') then
    raise exception 'Seul un administrateur peut charger un modèle de paie';
  end if;
  perform appliquer_modele_paie(v_org, upper(p_pays));
end $$;

-- À la création d'une organisation ivoirienne, le modèle est chargé d'office (Sénégal : déjà fait par initialiser_phase4)
create or replace function initialiser_modules(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_pays text;
begin
  perform initialiser_phase1(p_org);
  perform initialiser_phase2(p_org);
  perform initialiser_phase4(p_org);
  perform initialiser_phase5(p_org);
  select pays into v_pays from organisations where id = p_org;
  if v_pays = 'CI' and not exists (select 1 from regles_paie where organisation_id = p_org) then
    perform appliquer_modele_paie(p_org, 'CI');
  end if;
end $$;

revoke execute on function appliquer_modele_paie(uuid, text), initialiser_modules(uuid)
  from public, anon, authenticated;
revoke execute on function charger_modele_paie(text) from public, anon;
grant execute on function charger_modele_paie(text) to authenticated;
