-- D-AGROBUSINESS — Phase 4 (complément) : calcul automatique de l'impôt sur le revenu et de la TRIMF.
--
-- Plutôt que d'importer un barème de retenue de plusieurs milliers de lignes, l'impôt est calculé à partir du
-- brut, du nombre de parts et des conjoints. La formule reproduit exactement le barème officiel de retenue à la
-- source du Sénégal (vérifié sur les 19 823 lignes des barèmes annuel, mensuel et journalier) :
--   1. base = brut − min(abattement % × brut, plafond de l'abattement), arrondie à l'inférieur (1 000) ;
--   2. impôt brut = barème progressif appliqué à la base ;
--   3. réduction pour charges de famille selon les parts : clamp(taux × impôt, minimum, maximum), plafonnée à l'impôt ;
--   4. TRIMF = palier du brut de la période × (1 + nombre de conjoints).
-- Par périodicité : annuel et mensuel se calculent au niveau de la période ; le journalier se calcule sur le brut
-- annualisé (× 360) puis se divise par 360. Tous les paramètres (tranches, réductions, paliers, abattement,
-- arrondi, facteurs) sont des données modifiables par organisation, donc adaptables à chaque pays.
-- Le mode « table » (lecture d'un barème importé) reste disponible pour les pays qui publient une grille.

-- ============================================================
-- Paramètres du calcul
-- ============================================================
alter table parametrage_paie
  add column arrondi_base numeric(12,2) not null default 0 check (arrondi_base >= 0),
  add column calcul_par_periodicite jsonb not null
    default '{"annuel":{"n":1,"niveau":"periode"},"mensuel":{"n":12,"niveau":"periode"},"journalier":{"n":360,"niveau":"annuel"}}';

create or replace function parametrage_modifie() returns trigger
language plpgsql as $$
begin
  if (new.jours_par_mois, new.jours_conge_par_mois, new.abattement_pct, new.abattement_plafond_annuel,
      new.statuts_ir, new.mode_ir, new.bareme_version, new.periodicite_par_statut,
      new.arrondi_base, new.calcul_par_periodicite)
     is distinct from
     (old.jours_par_mois, old.jours_conge_par_mois, old.abattement_pct, old.abattement_plafond_annuel,
      old.statuts_ir, old.mode_ir, old.bareme_version, old.periodicite_par_statut,
      old.arrondi_base, old.calcul_par_periodicite) then
    new.valide_le := null;
    new.valide_par := null;
  end if;
  return new;
end $$;

-- Paliers de TRIMF : un jeu par périodicité, exprimés dans l'unité de la période (annuel, mensuel ou journalier)
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'tranches_forfaitaires'::regclass and contype = 'u' loop
    execute format('alter table tranches_forfaitaires drop constraint %I', c.conname);
  end loop;
end $$;
alter table tranches_forfaitaires rename column salaire_min_annuel to seuil_min;
alter table tranches_forfaitaires rename column salaire_max_annuel to seuil_max;
alter table tranches_forfaitaires rename column montant_annuel to montant;
alter table tranches_forfaitaires
  add column periodicite text not null default 'annuel' check (periodicite in ('annuel', 'mensuel', 'journalier'));
alter table tranches_forfaitaires
  add constraint tranches_forfaitaires_unique unique (organisation_id, code, periodicite, seuil_min);

-- ============================================================
-- Calcul de la retenue (impôt + TRIMF par personne) pour un brut de la périodicité donnée
-- ============================================================
create or replace function retenue_calculee(p_org uuid, p_periodicite text, p_brut numeric, p_parts numeric)
returns table (ir numeric, trimf numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  par parametrage_paie%rowtype;
  rf reductions_famille%rowtype;
  v_cfg jsonb;
  v_n numeric;
  v_niveau text;
  v_b numeric;
  v_f numeric;
  v_net numeric;
  v_base numeric;
  v_impot numeric;
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
  v_f := case when v_niveau = 'annuel' then 1 else v_n end;

  v_net := v_b - least(par.abattement_pct / 100 * v_b, coalesce(par.abattement_plafond_annuel, 1e18) / v_f);
  v_base := case when par.arrondi_base > 0 then floor(v_net / par.arrondi_base) * par.arrondi_base else v_net end;

  select coalesce(sum(greatest(0, least(v_base, coalesce(tranche_max / v_f, 1e18)) - tranche_min / v_f) * taux / 100), 0)
    into v_impot from bareme_ir where organisation_id = p_org;

  -- Réduction pour charges de famille : ligne des parts immédiatement inférieures ou égales
  select * into rf from reductions_famille
    where organisation_id = p_org and parts <= p_parts order by parts desc limit 1;
  if found then
    v_impot := v_impot - least(v_impot, greatest(rf.minimum / v_f,
                 least(coalesce(rf.maximum / v_f, 1e18), v_impot * rf.taux / 100)));
  end if;

  ir := case when v_niveau = 'annuel' then v_impot / v_n else v_impot end;

  select t.montant into v_montant from tranches_forfaitaires t
    where t.organisation_id = p_org and t.code = 'TRIMF' and t.periodicite = p_periodicite
      and t.seuil_min <= p_brut and (t.seuil_max is null or p_brut <= t.seuil_max)
    order by t.seuil_min desc limit 1;
  trimf := coalesce(v_montant, 0);
  return next;
end $$;

revoke execute on function retenue_calculee(uuid, text, numeric, numeric) from public, anon, authenticated;

-- ============================================================
-- Calcul des bulletins (remplace la version de 06 : la branche « calcul » utilise retenue_calculee)
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
  v_trimf_u numeric;
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
      -- Mode « calcul » : impôt et TRIMF calculés à partir du brut, du nombre de parts et des conjoints
      -- (fonction retenue_calculee, paramétrée par organisation). Le barème lu dépend du statut.
      v_per := par.periodicite_par_statut ->> e.statut;
      if v_per is null or v_per not in ('annuel', 'mensuel', 'journalier') then
        v_avert := coalesce(v_avert || ' ; ', '') || 'Aucune périodicité de calcul définie pour le statut ' || e.statut;
      else
        v_ref := case v_per when 'annuel' then v_brut * 12 when 'mensuel' then v_brut
                            else v_brut / nullif(v_jp, 0) end;
        if v_ref is not null then
          select rc.ir, rc.trimf into v_ir_u, v_trimf_u from retenue_calculee(v_org, v_per, v_ref, e.parts_ir) rc;
          v_ir := round(case v_per when 'annuel' then v_ir_u / 12 when 'mensuel' then v_ir_u
                                   else v_ir_u * v_jp end, v_dec);
          v_forfait := round((case v_per when 'annuel' then v_trimf_u / 12 when 'mensuel' then v_trimf_u
                                         else v_trimf_u * v_jp end) * (1 + e.nombre_conjoints), v_dec);
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
              values (v_org, v_id, v_ordre, 'IR', 'Impôt sur le revenu (' || e.parts_ir || ' parts, calcul ' || v_per || ')',
                      'retenue_salariale', v_ref, v_ir, 'etat_retenues');
            v_tot_sal := v_tot_sal + v_ir;
          end if;
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
-- Initialisation Sénégal : paramètres du calcul automatique
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

  insert into parametrage_paie (organisation_id, pays, mode_ir, abattement_pct, abattement_plafond_annuel, arrondi_base)
    values (p_org, v_pays, 'calcul',
            case when v_pays = 'SN' then 30 else 0 end,
            case when v_pays = 'SN' then 900000 end,
            case when v_pays = 'SN' then 1000 else 0 end)
    on conflict do nothing;

  if v_pays = 'SN' then
    if not exists (select 1 from regles_paie where organisation_id = p_org) then
      insert into regles_paie (organisation_id, code, libelle, taux_salarie, taux_employeur, plancher_mensuel,
                               plafond_mensuel, regime, deductible_ir, compte_cle, ordre) values
        (p_org, 'IPRES_RG', 'IPRES régime général', 5.6, 8.4, 0, 432000, null, false, 'organismes_sociaux', 10),
        (p_org, 'IPRES_RC', 'IPRES régime complémentaire cadres', 2.4, 3.6, 432000, 1296000, 'cadre', false, 'organismes_sociaux', 11),
        (p_org, 'CSS_PF', 'CSS prestations familiales', 0, 7, 0, 63000, null, false, 'organismes_sociaux', 20),
        (p_org, 'CSS_AT', 'CSS accidents du travail (1 %, 3 % ou 5 % selon le risque)', 0, 1, 0, 63000, null, false, 'organismes_sociaux', 21),
        (p_org, 'CFCE', 'CFCE (contribution forfaitaire à la charge de l''employeur, 3 % du brut imposable)', 0, 3, 0, null, null, false, 'etat_impots_taxes', 30);
    end if;

    if not exists (select 1 from bareme_ir where organisation_id = p_org) then
      insert into bareme_ir (organisation_id, tranche_min, tranche_max, taux) values
        (p_org, 0, 630000, 0), (p_org, 630000, 1500000, 20), (p_org, 1500000, 4000000, 30),
        (p_org, 4000000, 8000000, 35), (p_org, 8000000, 13500000, 37), (p_org, 13500000, null, 40);
    end if;

    if not exists (select 1 from reductions_famille where organisation_id = p_org) then
      insert into reductions_famille (organisation_id, parts, taux, minimum, maximum) values
        (p_org, 1.5, 10, 100000, 300000), (p_org, 2, 15, 200000, 650000), (p_org, 2.5, 20, 300000, 1100000),
        (p_org, 3, 25, 400000, 1650000), (p_org, 3.5, 30, 500000, 2030000), (p_org, 4, 35, 600000, 2490000),
        (p_org, 4.5, 40, 700000, 2755000), (p_org, 5, 45, 800000, 3180000);
    end if;

    if not exists (select 1 from tranches_forfaitaires where organisation_id = p_org) then
      insert into tranches_forfaitaires (organisation_id, code, libelle, periodicite, seuil_min, seuil_max, montant) values
        (p_org, 'TRIMF', 'TRIMF', 'annuel', 600000, null, 3600),
        (p_org, 'TRIMF', 'TRIMF', 'annuel', 1000000, null, 4800),
        (p_org, 'TRIMF', 'TRIMF', 'annuel', 2000000, null, 12000),
        (p_org, 'TRIMF', 'TRIMF', 'annuel', 7000000, null, 18000),
        (p_org, 'TRIMF', 'TRIMF', 'annuel', 12000000, null, 36000),
        (p_org, 'TRIMF', 'TRIMF', 'mensuel', 50000, null, 300),
        (p_org, 'TRIMF', 'TRIMF', 'mensuel', 84000, null, 400),
        (p_org, 'TRIMF', 'TRIMF', 'mensuel', 167000, null, 500),
        (p_org, 'TRIMF', 'TRIMF', 'mensuel', 1000000, null, 1500),
        (p_org, 'TRIMF', 'TRIMF', 'journalier', 1000, null, 2.5),
        (p_org, 'TRIMF', 'TRIMF', 'journalier', 1700, null, 10),
        (p_org, 'TRIMF', 'TRIMF', 'journalier', 2800, null, 13.333333),
        (p_org, 'TRIMF', 'TRIMF', 'journalier', 5600, null, 33.333333),
        (p_org, 'TRIMF', 'TRIMF', 'journalier', 19500, null, 50),
        (p_org, 'TRIMF', 'TRIMF', 'journalier', 33400, null, 100);
    end if;
  end if;
end $$;

-- Organisations sénégalaises existantes : bascule vers le calcul automatique
update parametrage_paie
   set mode_ir = 'calcul', bareme_version = null,
       abattement_pct = 30, abattement_plafond_annuel = 900000, arrondi_base = 1000
 where pays = 'SN';

-- L'impôt étant calculé sur le brut, les cotisations salariales ne sont pas déduites de la base
update regles_paie set deductible_ir = false where code in ('IPRES_RG', 'IPRES_RC');

do $$
declare o record;
begin
  for o in select id from organisations loop
    perform initialiser_phase4(o.id);
  end loop;
end $$;
