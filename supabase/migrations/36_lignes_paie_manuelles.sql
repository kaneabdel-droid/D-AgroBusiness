-- D-AGROBUSINESS — Le comptable et le RH peuvent ajouter des rubriques libres sur un bulletin déjà calculé
-- (sursalaire, primes et avantages, avances, autres retenues), avant validation de la période.
-- Simplification assumée : ces rubriques manuelles s'ajoutent au brut / aux retenues et donc au net à payer,
-- mais ne redéclenchent PAS le calcul des cotisations sociales ni de l'impôt sur le revenu (IR/TRIMF), qui
-- restent ceux du calcul automatique initial. Seules les rubriques manuelles peuvent être supprimées : les
-- rubriques calculées automatiquement (salaire de base, cotisations, IR…) restent protégées.

alter table bulletins_lignes add column manuelle boolean not null default false;

-- Compte des avances et acomptes sur salaire (SYSCOHADA 421), utilisé pour les retenues manuelles (avances, autres retenues).
insert into parametres_comptables (organisation_id, cle, compte_id)
select o.id, 'avances_personnel', c.id
from organisations o
join comptes_comptables c on c.organisation_id = o.id and c.numero = '421'
on conflict do nothing;

create or replace function ajouter_ligne_bulletin(p_bulletin_id uuid, p_type text, p_libelle text, p_montant numeric)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  b bulletins_paie%rowtype;
  per periodes_paie%rowtype;
  v_ordre integer;
  v_compte_cle text;
  v_id uuid;
begin
  if v_org is null or not has_role('admin', 'comptable', 'rh') then
    raise exception 'Droits insuffisants';
  end if;
  if p_type not in ('gain', 'retenue_salariale') then
    raise exception 'Type de rubrique invalide';
  end if;
  if coalesce(p_montant, 0) <= 0 then
    raise exception 'Le montant doit être positif';
  end if;
  if coalesce(trim(p_libelle), '') = '' then
    raise exception 'Le libellé est obligatoire';
  end if;

  select * into b from bulletins_paie where id = p_bulletin_id and organisation_id = v_org;
  if not found then raise exception 'Bulletin introuvable'; end if;
  if b.statut <> 'calcule' then raise exception 'Ce bulletin n''est plus modifiable'; end if;
  select * into per from periodes_paie where id = b.periode_id;
  if per.statut <> 'ouverte' then raise exception 'Cette période n''est plus ouverte'; end if;

  v_compte_cle := case when p_type = 'retenue_salariale' then 'avances_personnel' end;
  select coalesce(max(ordre), 0) + 1 into v_ordre from bulletins_lignes where bulletin_id = p_bulletin_id;

  insert into bulletins_lignes (organisation_id, bulletin_id, ordre, code, libelle, type, montant, compte_cle, manuelle)
    values (v_org, p_bulletin_id, v_ordre, 'MANUEL', trim(p_libelle), p_type, p_montant, v_compte_cle, true)
    returning id into v_id;

  update bulletins_paie set
    brut = brut + case when p_type = 'gain' then p_montant else 0 end,
    total_retenues = total_retenues + case when p_type = 'retenue_salariale' then p_montant else 0 end
    where id = p_bulletin_id;
  update bulletins_paie set
    net_a_payer = brut - total_retenues,
    cout_total = brut + charges_patronales
    where id = p_bulletin_id;

  return v_id;
end $$;

create or replace function supprimer_ligne_bulletin(p_ligne_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  l bulletins_lignes%rowtype;
  b bulletins_paie%rowtype;
  per periodes_paie%rowtype;
begin
  if v_org is null or not has_role('admin', 'comptable', 'rh') then
    raise exception 'Droits insuffisants';
  end if;
  select * into l from bulletins_lignes where id = p_ligne_id and organisation_id = v_org;
  if not found or not l.manuelle then
    raise exception 'Rubrique introuvable ou non modifiable : seules les rubriques ajoutées manuellement peuvent être supprimées';
  end if;
  select * into b from bulletins_paie where id = l.bulletin_id;
  if b.statut <> 'calcule' then raise exception 'Ce bulletin n''est plus modifiable'; end if;
  select * into per from periodes_paie where id = b.periode_id;
  if per.statut <> 'ouverte' then raise exception 'Cette période n''est plus ouverte'; end if;

  delete from bulletins_lignes where id = p_ligne_id;
  update bulletins_paie set
    brut = brut - case when l.type = 'gain' then l.montant else 0 end,
    total_retenues = total_retenues - case when l.type = 'retenue_salariale' then l.montant else 0 end
    where id = l.bulletin_id;
  update bulletins_paie set
    net_a_payer = brut - total_retenues,
    cout_total = brut + charges_patronales
    where id = l.bulletin_id;
end $$;

revoke execute on function ajouter_ligne_bulletin(uuid, text, text, numeric), supprimer_ligne_bulletin(uuid)
from public, anon;
grant execute on function ajouter_ligne_bulletin(uuid, text, text, numeric), supprimer_ligne_bulletin(uuid)
to authenticated;
