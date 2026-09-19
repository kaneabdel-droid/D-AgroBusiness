-- D-AGROBUSINESS — Phase 2 (complément) : reprise de subvention au taux de financement du bien.
-- Taux = subvention accordée ÷ coût du matériel (ex. 50 % ou 70 %).
-- Reprise de l'exercice = dotation × taux, débitée au compte 14 et créditée au 865.
-- La reprise cumulée ne dépasse jamais le montant encaissé : le compte 14 ne devient pas débiteur ;
-- si la subvention n'est pas encore entièrement reçue, l'écart est rattrapé à l'encaissement.

create or replace function comptabiliser_amortissements(p_exercice_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  x exercices_comptables%rowtype;
  m record;
  v_ec jsonb := '[]'::jsonb;
  v_n integer := 0;
  s integer; e integer; xe integer;
  v_base numeric; v_cible numeric; v_deja numeric; v_dot numeric;
  v_recu numeric; v_accorde numeric; v_taux numeric; v_rep_deja numeric; v_rep numeric;
begin
  if v_org is null or not has_role('admin', 'comptable') then
    raise exception 'Droits insuffisants';
  end if;
  select * into x from exercices_comptables where id = p_exercice_id and organisation_id = v_org;
  if not found then raise exception 'Exercice introuvable'; end if;
  if x.statut <> 'ouvert' then raise exception 'Exercice clôturé'; end if;
  xe := extract(year from x.date_fin)::integer * 12 + extract(month from x.date_fin)::integer - 1;

  for m in select * from materiels where organisation_id = v_org and statut = 'en_service' order by code loop
    if exists (select 1 from dotations_amortissement where materiel_id = m.id and exercice_id = x.id) then
      continue;
    end if;
    s := extract(year from coalesce(m.date_mise_service, m.date_acquisition))::integer * 12
       + extract(month from coalesce(m.date_mise_service, m.date_acquisition))::integer - 1;
    e := s + m.duree_amortissement_mois - 1;
    if s > xe then continue; end if;

    v_base := m.cout_acquisition - m.valeur_residuelle;
    v_cible := round(v_base * greatest(0, least(e, xe) - s + 1) / m.duree_amortissement_mois, 2);
    select coalesce(sum(d.montant), 0), coalesce(sum(d.reprise_subvention), 0) into v_deja, v_rep_deja
      from dotations_amortissement d
      join exercices_comptables ex on ex.id = d.exercice_id
      where d.materiel_id = m.id and ex.date_fin < x.date_debut;
    v_dot := v_cible - v_deja;
    if v_dot <= 0 then continue; end if;

    select coalesce(sum(su.montant_accorde), 0),
           coalesce((select sum(es.montant) from encaissements_subvention es
                     join subventions s2 on s2.id = es.subvention_id where s2.materiel_id = m.id), 0)
      into v_accorde, v_recu
      from subventions su where su.materiel_id = m.id;
    v_taux := least(1, v_accorde / m.cout_acquisition);

    v_rep := 0;
    if v_taux > 0 and v_recu > 0 then
      v_rep := greatest(0, least(v_recu, round((v_deja + v_dot) * v_taux, 2)) - v_rep_deja);
    end if;

    insert into dotations_amortissement (organisation_id, materiel_id, exercice_id, montant, reprise_subvention)
      values (v_org, m.id, x.id, v_dot, v_rep);
    v_ec := v_ec
      || ec_ligne(param_compte(v_org, 'dotations'), v_dot, 0, null, m.departement_id, m.secteur_id, null, 'Dotation ' || m.code)
      || ec_ligne(param_compte(v_org, 'amortissements'), 0, v_dot, null, null, null, null, 'Amortissement ' || m.code);
    if v_rep > 0 then
      v_ec := v_ec
        || ec_ligne(param_compte(v_org, 'subventions_invest'), v_rep, 0, null, null, null, null, 'Reprise subvention ' || m.code)
        || ec_ligne(param_compte(v_org, 'reprise_subventions'), 0, v_rep, null, null, null, null, 'Reprise subvention ' || m.code);
    end if;
    v_n := v_n + 1;
  end loop;

  if v_n = 0 then raise exception 'Aucune dotation à comptabiliser pour cet exercice'; end if;
  perform ecrire_interne(v_org, journal_de_type(v_org, 'operations_diverses'), x.date_fin,
    'Dotations aux amortissements ' || x.libelle, null, v_ec, 'amortissements', x.id, null);
  return v_n;
end $$;

-- Taux de financement affiché (colonnes ajoutées en fin de vue)
create or replace view v_subventions with (security_invoker = true) as
select s.*,
       coalesce(e.encaisse, 0) as montant_encaisse,
       s.montant_accorde - coalesce(e.encaisse, 0) as reste_a_encaisser,
       coalesce(d.reprises, 0) as reprises_cumulees,
       coalesce(e.encaisse, 0) - coalesce(d.reprises, 0) as solde_compte_14,
       case when mt.cout_acquisition > 0 then round(s.montant_accorde / mt.cout_acquisition * 100, 2) end as taux_financement,
       mt.cout_acquisition as cout_materiel
from subventions s
left join (select subvention_id, sum(montant) as encaisse from encaissements_subvention group by subvention_id) e on e.subvention_id = s.id
left join (select materiel_id, sum(reprise_subvention) as reprises from dotations_amortissement group by materiel_id) d on d.materiel_id = s.materiel_id
left join materiels mt on mt.id = s.materiel_id;
