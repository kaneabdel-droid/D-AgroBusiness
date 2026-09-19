-- D-AGROBUSINESS — Correctif paie : le taux journalier n'est plus écrit dans la colonne « taux » des lignes de bulletin
-- (numeric(6,3), prévue pour des pourcentages) ; il provoquait un dépassement de capacité pour les saisonniers et
-- journaliers. La ligne de salaire indique désormais le nombre de jours en base et le montant ; le taux journalier reste
-- lisible sur le contrat.

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
              case when e.statut in ('saisonnier', 'journalier') then 'Salaire (jours travaillés × taux journalier)' else 'Salaire de base' end,
              'gain', case when e.statut in ('saisonnier', 'journalier') then v_jp end, null, v_base);
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
