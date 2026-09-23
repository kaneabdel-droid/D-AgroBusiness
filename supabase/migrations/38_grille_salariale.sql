-- D-AGROBUSINESS — Grille salariale par catégorie, sursalaire, heures supplémentaires et prime d'ancienneté.
--
-- Salaire brut = salaire de base (barème de la catégorie professionnelle) + sursalaire (libre : ce que
-- l'employeur et l'employé conviennent en plus du salaire catégoriel pour atteindre le brut négocié) +
-- heures supplémentaires + prime d'ancienneté, moins la retenue d'absence.
--
-- Prime d'ancienneté : barème % par palier d'années de service, propre à chaque organisation (aucun taux légal
-- n'est codé en dur, comme pour le reste du moteur de paie). Base de la prime : le salaire catégoriel de base ;
-- si des heures supplémentaires existent sur la période, la base devient (heures normales du mois + heures
-- supplémentaires) × le salaire horaire de la catégorie. Modèle Sénégal fourni comme donnée initiale
-- (Convention collective interprofessionnelle) : 2 % après 2 ans de service, +1 point par an ensuite.
--
-- Heures supplémentaires : saisies par période et par employé (Paie → fiche de la période, avant le calcul des
-- bulletins). Deux modes au choix de l'organisation (Paie → Paramètres) : « forfait » (montant saisi directement)
-- ou « pourcentage » (nombre d'heures × salaire horaire de la catégorie × majoration).

-- ============================================================
-- Catégories salariales (grille de salaire de base par catégorie professionnelle)
-- ============================================================
create table categories_salariales (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  code text not null,
  libelle text not null,
  salaire_base numeric(18,2) not null check (salaire_base >= 0),
  salaire_horaire numeric(18,2) not null check (salaire_horaire >= 0),
  ordre integer not null default 10,
  actif boolean not null default true,
  unique (organisation_id, code)
);
create index on categories_salariales (organisation_id, ordre);

alter table categories_salariales enable row level security;
create policy cat_sal_select on categories_salariales for select
  using (organisation_id = current_org_id() and has_role('admin', 'rh', 'comptable', 'direction'));
create policy cat_sal_write on categories_salariales for all
  using (organisation_id = current_org_id() and has_role('admin', 'rh'))
  with check (organisation_id = current_org_id());

-- ============================================================
-- Contrats : catégorie (facultative, donne le salaire de base) et sursalaire (libre, monétaire)
-- ============================================================
alter table contrats_travail add column categorie_id uuid references categories_salariales(id) on delete restrict;
alter table contrats_travail add column sursalaire numeric(18,2) not null default 0 check (sursalaire >= 0);

-- ============================================================
-- Paramétrage : mode des heures supplémentaires et heures normales du mois (pour la base de la prime d'ancienneté)
-- ============================================================
alter table parametrage_paie add column mode_heures_sup text not null default 'pourcentage' check (mode_heures_sup in ('forfait', 'pourcentage'));
alter table parametrage_paie add column majoration_heures_sup_pct numeric(6,2) not null default 0 check (majoration_heures_sup_pct >= 0);
alter table parametrage_paie add column heures_normales_mois numeric(6,2) not null default 173.33 check (heures_normales_mois > 0);

-- ============================================================
-- Heures supplémentaires saisies par période, avant le calcul des bulletins
-- ============================================================
create table heures_supplementaires (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  employe_id uuid not null references employes(id) on delete restrict,
  periode_id uuid not null references periodes_paie(id) on delete cascade,
  nombre_heures numeric(6,2) not null default 0 check (nombre_heures >= 0),
  montant_forfait numeric(18,2) check (montant_forfait >= 0),
  unique (employe_id, periode_id)
);
create index on heures_supplementaires (periode_id);

alter table heures_supplementaires enable row level security;
create policy hsup_select on heures_supplementaires for select
  using (organisation_id = current_org_id() and has_role('admin', 'rh', 'comptable', 'direction'));
-- Pas de policy d'écriture directe : la saisie passe uniquement par enregistrer_heures_sup() (sécurité définisseur),
-- qui vérifie le rôle et que la période est encore ouverte.

-- ============================================================
-- Prime d'ancienneté : barème % par palier d'années de service, propre à l'organisation
-- ============================================================
create table primes_anciennete (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  annees_min integer not null check (annees_min >= 0),
  taux_pct numeric(6,3) not null check (taux_pct >= 0),
  unique (organisation_id, annees_min)
);

alter table primes_anciennete enable row level security;
create policy prime_anc_select on primes_anciennete for select
  using (organisation_id = current_org_id() and has_role('admin', 'rh', 'comptable', 'direction'));
create policy prime_anc_write on primes_anciennete for all
  using (organisation_id = current_org_id() and has_role('admin'))
  with check (organisation_id = current_org_id());

-- ============================================================
-- Saisie groupée des heures supplémentaires d'une période (avant calcul des bulletins)
-- p : tableau [{ employe_id, heures, montant }] — montant n'est utilisé qu'en mode « forfait ».
-- ============================================================
create or replace function enregistrer_heures_sup(p_periode_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  per periodes_paie%rowtype;
  x jsonb;
begin
  if v_org is null or not has_role('admin', 'rh', 'comptable') then
    raise exception 'Droits insuffisants';
  end if;
  select * into per from periodes_paie where id = p_periode_id and organisation_id = v_org;
  if not found then raise exception 'Période introuvable'; end if;
  if per.statut <> 'ouverte' then raise exception 'Cette période n''est plus ouverte'; end if;

  for x in select * from jsonb_array_elements(p) loop
    if coalesce((x ->> 'heures')::numeric, 0) <= 0 and coalesce((x ->> 'montant')::numeric, 0) <= 0 then
      delete from heures_supplementaires where employe_id = (x ->> 'employe_id')::uuid and periode_id = p_periode_id;
    else
      insert into heures_supplementaires (organisation_id, employe_id, periode_id, nombre_heures, montant_forfait)
        values (v_org, (x ->> 'employe_id')::uuid, p_periode_id, coalesce((x ->> 'heures')::numeric, 0), nullif((x ->> 'montant')::numeric, 0))
      on conflict (employe_id, periode_id) do update
        set nombre_heures = excluded.nombre_heures, montant_forfait = excluded.montant_forfait;
    end if;
  end loop;
end $$;

revoke execute on function enregistrer_heures_sup(uuid, jsonb) from public, anon;
grant execute on function enregistrer_heures_sup(uuid, jsonb) to authenticated;

-- ============================================================
-- Calcul de la paie : salaire de base par catégorie, sursalaire, heures supplémentaires et prime d'ancienneté
-- ============================================================
create or replace function calculer_paie(p_periode_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  per periodes_paie%rowtype;
  par parametrage_paie%rowtype;
  e employes%rowtype;
  c contrats_travail%rowtype;
  cat categories_salariales%rowtype;
  hs heures_supplementaires%rowtype;
  pa primes_anciennete%rowtype;
  r regles_paie%rowtype;
  rf reductions_famille%rowtype;
  v_dec integer;
  d_debut date; d_fin date;
  v_n integer := 0;
  v_id uuid;
  v_jp numeric; v_jnp numeric;
  v_base numeric; v_prime numeric; v_abs numeric; v_brut numeric;
  v_sursalaire numeric; v_heures_sup numeric; v_montant_hsup numeric;
  v_prime_anciennete numeric; v_base_anciennete numeric; v_annees_service integer;
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
  v_ded_ref numeric;
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
    cat := null; v_sursalaire := 0; v_heures_sup := 0; v_montant_hsup := 0;
    v_prime_anciennete := 0; v_base_anciennete := 0; v_annees_service := 0;
    if e.statut in ('saisonnier', 'journalier') or (e.statut = 'prestataire' and c.salaire_base = 0) then
      v_base := round(coalesce(c.taux_journalier, 0) * v_jp, v_dec);
      if coalesce(c.taux_journalier, 0) = 0 then v_avert := 'Taux journalier non renseigné'; end if;
      if v_jp = 0 then v_avert := coalesce(v_avert || ' ; ', '') || 'Aucun jour pointé'; end if;
    else
      if c.categorie_id is not null then
        select * into cat from categories_salariales where id = c.categorie_id and organisation_id = v_org;
      end if;
      v_base := coalesce(cat.salaire_base, c.salaire_base);
      v_prime := c.primes_mensuelles;
      v_sursalaire := coalesce(c.sursalaire, 0);

      -- Heures supplémentaires saisies pour cette période (Paie → fiche de la période, avant le calcul)
      select * into hs from heures_supplementaires where employe_id = e.id and periode_id = per.id;
      if found then
        v_heures_sup := coalesce(hs.nombre_heures, 0);
        if par.mode_heures_sup = 'forfait' and hs.montant_forfait is not null then
          v_montant_hsup := hs.montant_forfait;
        elsif v_heures_sup > 0 and cat.id is not null and cat.salaire_horaire > 0 then
          v_montant_hsup := round(v_heures_sup * cat.salaire_horaire * (1 + par.majoration_heures_sup_pct / 100), v_dec);
        end if;
      end if;

      -- Prime d'ancienneté : barème de l'organisation par palier d'années de service, sur le salaire catégoriel
      -- de base ; avec des heures supplémentaires, la base devient (heures normales + heures sup) × salaire
      -- horaire de la catégorie. Ne s'applique qu'aux contrats rattachés à une catégorie.
      if cat.id is not null then
        v_annees_service := extract(year from age(d_fin, e.date_embauche))::integer;
        select * into pa from primes_anciennete
          where organisation_id = v_org and annees_min <= v_annees_service
          order by annees_min desc limit 1;
        if found then
          v_base_anciennete := case when v_heures_sup > 0 then (par.heures_normales_mois + v_heures_sup) * cat.salaire_horaire
                                     else cat.salaire_base end;
          v_prime_anciennete := round(v_base_anciennete * pa.taux_pct / 100, v_dec);
        end if;
      end if;

      v_abs := round((v_base + v_prime + v_sursalaire) / par.jours_par_mois * v_jnp, v_dec);
    end if;
    v_brut := v_base + v_prime + v_sursalaire + v_montant_hsup + v_prime_anciennete - v_abs;
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
    if v_sursalaire > 0 then
      v_ordre := v_ordre + 1;
      insert into bulletins_lignes (organisation_id, bulletin_id, ordre, code, libelle, type, montant)
        values (v_org, v_id, v_ordre, 'SURSAL', 'Sursalaire', 'gain', v_sursalaire);
    end if;
    if v_montant_hsup > 0 then
      v_ordre := v_ordre + 1;
      insert into bulletins_lignes (organisation_id, bulletin_id, ordre, code, libelle, type, base, taux, montant)
        values (v_org, v_id, v_ordre, 'HSUP', 'Heures supplémentaires', 'gain', v_heures_sup,
                case when par.mode_heures_sup = 'pourcentage' then par.majoration_heures_sup_pct end, v_montant_hsup);
    end if;
    if v_prime_anciennete > 0 then
      v_ordre := v_ordre + 1;
      insert into bulletins_lignes (organisation_id, bulletin_id, ordre, code, libelle, type, base, taux, montant)
        values (v_org, v_id, v_ordre, 'ANCIEN', 'Prime d''ancienneté (' || v_annees_service || ' ans)', 'gain', v_base_anciennete, pa.taux_pct, v_prime_anciennete);
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
          -- Déductions de la base (cotisations salariales déductibles + déduction forfaitaire de l'employé), ramenées à l'unité du brut de lecture
          v_ded_ref := case v_per when 'annuel' then (v_ded_ir + e.deduction_fixe_mensuelle) * 12
                                  when 'mensuel' then v_ded_ir + e.deduction_fixe_mensuelle
                                  else (v_ded_ir + e.deduction_fixe_mensuelle) / nullif(v_jp, 0) end;
          select rc.ir, rc.trimf into v_ir_u, v_trimf_u
            from retenue_calculee(v_org, v_per, v_ref, e.parts_ir, coalesce(v_ded_ref, 0),
                                  e.situation_familiale = 'marie', e.nombre_enfants) rc;
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
-- Modèles de paie par pays : ajout du barème de prime d'ancienneté (Sénégal uniquement pour l'instant)
-- ============================================================
create or replace function appliquer_modele_paie(p_org uuid, p_pays text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_pays not in ('SN', 'CI', 'ML', 'NE', 'BJ', 'GH', 'BF', 'TG', 'MA', 'MR', 'GN', 'NG', 'GM') then
    raise exception 'Aucun modèle de paie pour le pays %', p_pays;
  end if;

  delete from regles_paie where organisation_id = p_org;
  delete from bareme_ir where organisation_id = p_org;
  delete from reductions_famille where organisation_id = p_org;
  delete from tranches_forfaitaires where organisation_id = p_org;
  delete from primes_anciennete where organisation_id = p_org;

  if p_pays = 'SN' then
    update parametrage_paie
       set deduction_forfaitaire_mensuelle = 0, abattement_seuil_annuel = null, abattement_pct_bas = 0, deduction_par_charge_annuelle = 0, abattement_sur_brut = false, mode_ir = 'calcul', bareme_version = null, ricf_mode = 'parts', reduction_pression_points = 0, abattement_pct = 30, abattement_plafond_annuel = 900000,
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

    -- Prime d'ancienneté (Convention collective interprofessionnelle) : 2 % du salaire catégoriel de base après
    -- 2 ans de service, +1 point par an ensuite (3 ans → 3 %, 4 ans → 4 %…) ; modifiable dans Paie → Paramètres.
    insert into primes_anciennete (organisation_id, annees_min, taux_pct)
      select p_org, n, n from generate_series(2, 30) as n;

  elsif p_pays = 'CI' then
    -- Cotisations CNPS (communiqué CNPS, plafonds au 1er janvier 2023 ; taux : brochure « Recouvrement », éd. 2018) :
    --  retraite 14 % (6,3 % salarié + 7,7 % employeur) plafonnée à 3 375 000 F/mois ; prestations familiales 5 %, maternité 0,75 %
    --  et accidents du travail (2 à 5 %) à la charge de l'employeur, plafonnés à 75 000 F/mois. Le plancher de cotisation
    --  (75 000 F) n'est pas géré par le moteur. Déductibilité de la retenue retraite dans l'assiette de l'ITS : non appliquée.
    -- Côte d'Ivoire : barème mensuel appliqué au brut mensuel, sans abattement ; les paliers sont saisis en montants
    -- annuels (× 12) car le moteur les ramène à la période. RICF : montant fixe (taux 100 %, minimum = maximum),
    -- plafonné à l'impôt brut comme le prévoit le texte (impôt = IB − RICF, jamais négatif).
    update parametrage_paie
       set deduction_forfaitaire_mensuelle = 0, abattement_seuil_annuel = null, abattement_pct_bas = 0, deduction_par_charge_annuelle = 0, abattement_sur_brut = false, mode_ir = 'calcul', bareme_version = null, ricf_mode = 'parts', reduction_pression_points = 0, abattement_pct = 0, abattement_plafond_annuel = null,
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
    update parametrage_paie
       set deduction_forfaitaire_mensuelle = 0, abattement_seuil_annuel = null, abattement_pct_bas = 0, deduction_par_charge_annuelle = 0, abattement_sur_brut = false, mode_ir = 'calcul', bareme_version = null, abattement_pct = 0, abattement_plafond_annuel = null,
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
    update parametrage_paie
       set deduction_forfaitaire_mensuelle = 0, abattement_seuil_annuel = null, abattement_pct_bas = 0, deduction_par_charge_annuelle = 0, abattement_sur_brut = false, mode_ir = 'calcul', bareme_version = null, abattement_pct = 10, abattement_plafond_annuel = null,
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
    update parametrage_paie
       set deduction_forfaitaire_mensuelle = 0, abattement_seuil_annuel = null, abattement_pct_bas = 0, deduction_par_charge_annuelle = 0, abattement_sur_brut = false, mode_ir = 'calcul', bareme_version = null, abattement_pct = 0, abattement_plafond_annuel = null,
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
    update parametrage_paie
       set deduction_forfaitaire_mensuelle = 0, abattement_seuil_annuel = null, abattement_pct_bas = 0, deduction_par_charge_annuelle = 0, abattement_sur_brut = false, mode_ir = 'calcul', bareme_version = null, abattement_pct = 0, abattement_plafond_annuel = null,
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
    update parametrage_paie
       set deduction_forfaitaire_mensuelle = 0, abattement_seuil_annuel = null, abattement_pct_bas = 0, deduction_par_charge_annuelle = 0, abattement_sur_brut = true, mode_ir = 'calcul', bareme_version = null, abattement_pct = 25, abattement_plafond_annuel = null,
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
    update parametrage_paie
       set deduction_forfaitaire_mensuelle = 0, abattement_seuil_annuel = null, abattement_pct_bas = 0, deduction_par_charge_annuelle = 120000, abattement_sur_brut = false, mode_ir = 'calcul', bareme_version = null,
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
  elsif p_pays = 'MA' then
    update parametrage_paie
       set deduction_forfaitaire_mensuelle = 0, abattement_seuil_annuel = 78000, abattement_pct_bas = 35, deduction_par_charge_annuelle = 600, abattement_sur_brut = true,
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
  elsif p_pays = 'MR' then
    update parametrage_paie
       set deduction_forfaitaire_mensuelle = 6000, abattement_seuil_annuel = null, abattement_pct_bas = 0, deduction_par_charge_annuelle = 0,
           abattement_sur_brut = false, mode_ir = 'calcul', bareme_version = null, abattement_pct = 0, abattement_plafond_annuel = null,
           arrondi_base = 10, ricf_mode = 'parts', ricf_marie_pct = 0, ricf_par_enfant_pct = 0,
           ricf_max_enfants = 10, reduction_pression_points = 0,
           periodicite_par_statut = '{"permanent":"mensuel","saisonnier":"mensuel","journalier":"mensuel"}',
           calcul_par_periodicite = '{"annuel":{"n":1,"niveau":"periode"},"mensuel":{"n":12,"niveau":"periode"},"journalier":{"n":360,"niveau":"annuel"}}'
     where organisation_id = p_org;

    insert into bareme_ir (organisation_id, tranche_min, tranche_max, taux) values
      (p_org, 0, 108000, 15), (p_org, 108000, 252000, 25), (p_org, 252000, null, 40);

    insert into regles_paie (organisation_id, code, libelle, taux_salarie, taux_employeur, plancher_mensuel,
                             plafond_mensuel, regime, deductible_ir, compte_cle, ordre) values
      (p_org, 'CNSS', 'CNSS retraite, accidents du travail et prestations familiales (1 % salarié, déductible de l''ITS ; 13 % employeur ; plafond 70 000 MRU)', 1, 13, 0, 70000, null, true, 'organismes_sociaux', 10),
      (p_org, 'CNAM', 'CNAM assurance maladie (4 % salarié, déductible de l''ITS ; 5 % employeur)', 4, 5, 0, null, null, true, 'organismes_sociaux', 11),
      (p_org, 'ONMT', 'Office national de médecine du travail (2 % employeur ; plafond 70 000 MRU)', 0, 2, 0, 70000, null, false, 'organismes_sociaux', 12);
  elsif p_pays = 'GN' then
    update parametrage_paie
       set deduction_forfaitaire_mensuelle = 0, abattement_seuil_annuel = null, abattement_pct_bas = 0, deduction_par_charge_annuelle = 0,
           abattement_sur_brut = false, mode_ir = 'calcul', bareme_version = null, abattement_pct = 0, abattement_plafond_annuel = null,
           arrondi_base = 0, ricf_mode = 'parts', ricf_marie_pct = 0, ricf_par_enfant_pct = 0,
           ricf_max_enfants = 10, reduction_pression_points = 0,
           periodicite_par_statut = '{"permanent":"mensuel","saisonnier":"mensuel","journalier":"mensuel"}',
           calcul_par_periodicite = '{"annuel":{"n":1,"niveau":"periode"},"mensuel":{"n":12,"niveau":"periode"},"journalier":{"n":360,"niveau":"annuel"}}'
     where organisation_id = p_org;

    insert into bareme_ir (organisation_id, tranche_min, tranche_max, taux) values
      (p_org, 0, 12000000, 0), (p_org, 12000000, 36000000, 5), (p_org, 36000000, 60000000, 8),
      (p_org, 60000000, 120000000, 10), (p_org, 120000000, 240000000, 15), (p_org, 240000000, null, 20);

    insert into regles_paie (organisation_id, code, libelle, taux_salarie, taux_employeur, plancher_mensuel,
                             plafond_mensuel, regime, deductible_ir, compte_cle, ordre) values
      (p_org, 'CNSS_RET', 'CNSS retraite (5 % salarié, déductible de la RTS ; 1,5 % employeur ; plafond 2 500 000 GNF)', 5, 1.5, 0, 2500000, null, true, 'organismes_sociaux', 10),
      (p_org, 'CNSS_PF', 'CNSS prestations familiales (6 % employeur ; plafond 2 500 000 GNF)', 0, 6, 0, 2500000, null, false, 'organismes_sociaux', 11),
      (p_org, 'CNSS_AT', 'CNSS accidents du travail (4 % employeur ; plafond 2 500 000 GNF)', 0, 4, 0, 2500000, null, false, 'organismes_sociaux', 12),
      (p_org, 'CNSS_MAL', 'CNSS assurance maladie (6,5 % employeur ; plafond 2 500 000 GNF)', 0, 6.5, 0, 2500000, null, false, 'organismes_sociaux', 13),
      (p_org, 'VF', 'Versement forfaitaire sur les salaires (6 % employeur, art. 201 du CGI)', 0, 6, 0, null, null, false, 'etat_impots_taxes', 30);
  elsif p_pays = 'NG' then
    update parametrage_paie
       set deduction_forfaitaire_mensuelle = 0, abattement_seuil_annuel = null, abattement_pct_bas = 0, deduction_par_charge_annuelle = 0,
           abattement_sur_brut = false, mode_ir = 'calcul', bareme_version = null, abattement_pct = 0, abattement_plafond_annuel = null,
           arrondi_base = 0, ricf_mode = 'parts', ricf_marie_pct = 0, ricf_par_enfant_pct = 0,
           ricf_max_enfants = 10, reduction_pression_points = 0,
           periodicite_par_statut = '{"permanent":"mensuel","saisonnier":"mensuel","journalier":"mensuel"}',
           calcul_par_periodicite = '{"annuel":{"n":1,"niveau":"periode"},"mensuel":{"n":12,"niveau":"annuel"},"journalier":{"n":360,"niveau":"annuel"}}'
     where organisation_id = p_org;

    insert into bareme_ir (organisation_id, tranche_min, tranche_max, taux) values
      (p_org, 0, 800000, 0), (p_org, 800000, 3000000, 15), (p_org, 3000000, 12000000, 18),
      (p_org, 12000000, 25000000, 21), (p_org, 25000000, 50000000, 23), (p_org, 50000000, null, 25);

    insert into regles_paie (organisation_id, code, libelle, taux_salarie, taux_employeur, plancher_mensuel,
                             plafond_mensuel, regime, deductible_ir, compte_cle, ordre) values
      (p_org, 'PENSION', 'Pension Reform Act (8 % salarié, déductible ; 10 % employeur — minimums légaux)', 8, 10, 0, null, null, true, 'organismes_sociaux', 10),
      (p_org, 'NHF', 'National Housing Fund (2,5 % salarié, déductible)', 2.5, 0, 0, null, null, true, 'organismes_sociaux', 11);
  else
    -- Gambie
    update parametrage_paie
       set deduction_forfaitaire_mensuelle = 0, abattement_seuil_annuel = null, abattement_pct_bas = 0, deduction_par_charge_annuelle = 0,
           abattement_sur_brut = false, mode_ir = 'calcul', bareme_version = null, abattement_pct = 0, abattement_plafond_annuel = null,
           arrondi_base = 0, ricf_mode = 'parts', ricf_marie_pct = 0, ricf_par_enfant_pct = 0,
           ricf_max_enfants = 10, reduction_pression_points = 0,
           periodicite_par_statut = '{"permanent":"mensuel","saisonnier":"mensuel","journalier":"mensuel"}',
           calcul_par_periodicite = '{"annuel":{"n":1,"niveau":"periode"},"mensuel":{"n":12,"niveau":"annuel"},"journalier":{"n":360,"niveau":"annuel"}}'
     where organisation_id = p_org;

    insert into bareme_ir (organisation_id, tranche_min, tranche_max, taux) values
      (p_org, 0, 36000, 0), (p_org, 36000, 46000, 5), (p_org, 46000, 56000, 10),
      (p_org, 56000, 66000, 15), (p_org, 66000, 76000, 20), (p_org, 76000, null, 25);

    insert into regles_paie (organisation_id, code, libelle, taux_salarie, taux_employeur, plancher_mensuel,
                             plafond_mensuel, regime, deductible_ir, compte_cle, ordre) values
      (p_org, 'SSHFC', 'SSHFC — National Provident Fund (5 % salarié, non déductible du PAYE ; 10 % employeur)', 5, 10, 0, null, null, false, 'organismes_sociaux', 10);
  end if;
end $$;

-- ============================================================
-- Organisations sénégalaises déjà créées : même barème de prime d'ancienneté, sans toucher au reste de leur
-- paramétrage (une réapplication du modèle pays réinitialiserait leurs cotisations déjà éventuellement ajustées).
-- ============================================================
insert into primes_anciennete (organisation_id, annees_min, taux_pct)
select o.id, n, n
from organisations o, generate_series(2, 30) as n
where o.pays = 'SN'
  and not exists (select 1 from primes_anciennete where organisation_id = o.id);

-- ============================================================
-- Droits d'exécution
-- ============================================================
revoke execute on function calculer_paie(uuid) from public, anon;
grant execute on function calculer_paie(uuid) to authenticated;
