-- D-AGROBUSINESS — Traçabilité et qualité.
-- Lots (récolte, fabrication, achat, autre), liens de filiation (matière → produit fini), expéditions aux clients,
-- contrôles qualité (blocage automatique d'un lot non conforme) et rappel de lot (amont / aval).
-- Ce module n'écrit pas dans la comptabilité ni dans les stocks : il ajoute la traçabilité par-dessus les mouvements existants.

-- ============================================================
-- Lots
-- ============================================================
create table lots (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  numero text not null,
  produit_id uuid not null references produits(id) on delete restrict,
  origine text not null check (origine in ('recolte', 'fabrication', 'achat', 'autre')),
  source_type text,
  source_id uuid,
  date_creation date not null,
  quantite_initiale numeric(18,3) not null check (quantite_initiale > 0),
  date_peremption date,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'libere', 'bloque')),
  observation text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (organisation_id, numero),
  unique (source_type, source_id, produit_id)
);
create index on lots (organisation_id, produit_id);

create table lot_liens (   -- filiation : « ce lot amont a servi à produire ce lot aval »
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  lot_amont_id uuid not null references lots(id) on delete restrict,
  lot_aval_id uuid not null references lots(id) on delete restrict,
  quantite numeric(18,3) check (quantite > 0),
  created_at timestamptz not null default now(),
  check (lot_amont_id <> lot_aval_id),
  unique (lot_amont_id, lot_aval_id)
);
create index on lot_liens (lot_aval_id);

create table lot_expeditions (   -- sortie d'un lot vers un client (ou autre destinataire)
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  lot_id uuid not null references lots(id) on delete restrict,
  tiers_id uuid references tiers(id) on delete restrict,
  vente_id uuid references ventes(id) on delete restrict,
  date_expedition date not null,
  quantite numeric(18,3) not null check (quantite > 0),
  observation text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on lot_expeditions (lot_id);

create table controles_qualite (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  lot_id uuid not null references lots(id) on delete restrict,
  date_controle date not null,
  parametre text not null,          -- humidité, taux d'impuretés, aflatoxines, calibre…
  valeur numeric(18,4) not null,
  minimum numeric(18,4),
  maximum numeric(18,4),
  conforme boolean not null,
  observation text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (minimum is null or maximum is null or minimum <= maximum)
);
create index on controles_qualite (lot_id);

create trigger lot_liens_immuables before update or delete on lot_liens
  for each row execute function interdire_modification_doc();
create trigger lot_exp_immuables before update or delete on lot_expeditions
  for each row execute function interdire_modification_doc();
create trigger controles_immuables before update or delete on controles_qualite
  for each row execute function interdire_modification_doc();

-- ============================================================
-- Création automatique des lots : une récolte ou une sortie de fabrication crée son lot
-- ============================================================
create or replace function lot_depuis_recolte() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into lots (organisation_id, numero, produit_id, origine, source_type, source_id, date_creation, quantite_initiale)
  values (new.organisation_id, prochain_numero(new.organisation_id, 'lot', 'LOT', new.date_recolte), new.produit_id,
          'recolte', 'recolte', new.id, new.date_recolte, new.quantite)
  on conflict do nothing;
  return new;
end $$;

create or replace function lot_depuis_sortie_of() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_date date;
begin
  select date_of into v_date from ordres_fabrication where id = new.of_id;
  insert into lots (organisation_id, numero, produit_id, origine, source_type, source_id, date_creation, quantite_initiale)
  values (new.organisation_id, prochain_numero(new.organisation_id, 'lot', 'LOT', v_date), new.produit_id,
          'fabrication', 'of', new.of_id, v_date, new.quantite)
  on conflict do nothing;
  return new;
end $$;

create trigger recoltes_lot after insert on recoltes for each row execute function lot_depuis_recolte();
create trigger of_sorties_lot after insert on of_sorties for each row execute function lot_depuis_sortie_of();

-- Lots des récoltes et fabrications déjà enregistrées
insert into lots (organisation_id, numero, produit_id, origine, source_type, source_id, date_creation, quantite_initiale)
select r.organisation_id, prochain_numero(r.organisation_id, 'lot', 'LOT', r.date_recolte), r.produit_id,
       'recolte', 'recolte', r.id, r.date_recolte, r.quantite
from recoltes r order by r.date_recolte, r.created_at
on conflict do nothing;

insert into lots (organisation_id, numero, produit_id, origine, source_type, source_id, date_creation, quantite_initiale)
select s.organisation_id, prochain_numero(s.organisation_id, 'lot', 'LOT', o.date_of), s.produit_id,
       'fabrication', 'of', s.of_id, o.date_of, s.quantite
from of_sorties s join ordres_fabrication o on o.id = s.of_id order by o.date_of, s.id
on conflict do nothing;

-- ============================================================
-- RPC
-- ============================================================
-- Lot manuel (achat, stock initial…) : { produit_id, date, quantite, origine?, date_peremption?, observation? }
create or replace function creer_lot(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_id uuid := gen_random_uuid();
  v_date date := (p ->> 'date')::date;
  v_qte numeric := (p ->> 'quantite')::numeric;
  v_origine text := coalesce(nullif(p ->> 'origine', ''), 'autre');
begin
  if v_org is null or not has_role('admin', 'comptable', 'chef_departement') then
    raise exception 'Droits insuffisants';
  end if;
  perform assert_org('produits', (p ->> 'produit_id')::uuid, v_org);
  if v_qte is null or v_qte <= 0 then raise exception 'Quantité invalide'; end if;
  if v_origine not in ('achat', 'autre') then raise exception 'Type invalide'; end if;
  insert into lots (id, organisation_id, numero, produit_id, origine, date_creation, quantite_initiale,
                    date_peremption, observation)
  values (v_id, v_org, prochain_numero(v_org, 'lot', 'LOT', v_date), (p ->> 'produit_id')::uuid, v_origine, v_date, v_qte,
          nullif(p ->> 'date_peremption', '')::date, nullif(p ->> 'observation', ''));
  return v_id;
end $$;

-- Filiation : { lot_amont_id, lot_aval_id, quantite? }
create or replace function lier_lots(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_id uuid := gen_random_uuid();
  v_amont uuid := (p ->> 'lot_amont_id')::uuid;
  v_aval uuid := (p ->> 'lot_aval_id')::uuid;
begin
  if v_org is null or not has_role('admin', 'comptable', 'chef_departement') then
    raise exception 'Droits insuffisants';
  end if;
  perform assert_org('lots', v_amont, v_org);
  perform assert_org('lots', v_aval, v_org);
  if v_amont = v_aval then raise exception 'Un lot ne peut pas être son propre ascendant'; end if;
  -- refuse les boucles : l'aval ne doit pas déjà être un ascendant de l'amont
  if exists (
    with recursive asc_ as (
      select lot_amont_id from lot_liens where lot_aval_id = v_amont
      union
      select l.lot_amont_id from lot_liens l join asc_ a on l.lot_aval_id = a.lot_amont_id
    ) select 1 from asc_ where lot_amont_id = v_aval
  ) then
    raise exception 'Ce lien créerait une boucle de filiation';
  end if;
  insert into lot_liens (id, organisation_id, lot_amont_id, lot_aval_id, quantite)
  values (v_id, v_org, v_amont, v_aval, nullif(p ->> 'quantite', '')::numeric);
  return v_id;
end $$;

-- Contrôle qualité : { lot_id, date, parametre, valeur, minimum?, maximum?, observation? }
-- Un résultat hors limites rend le contrôle non conforme et bloque le lot.
create or replace function enregistrer_controle(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_id uuid := gen_random_uuid();
  v_lot uuid := (p ->> 'lot_id')::uuid;
  v_val numeric := (p ->> 'valeur')::numeric;
  v_min numeric := nullif(p ->> 'minimum', '')::numeric;
  v_max numeric := nullif(p ->> 'maximum', '')::numeric;
  v_ok boolean;
begin
  if v_org is null or not has_role('admin', 'comptable', 'chef_departement') then
    raise exception 'Droits insuffisants';
  end if;
  perform assert_org('lots', v_lot, v_org);
  if v_val is null or coalesce(trim(p ->> 'parametre'), '') = '' then raise exception 'Valeur invalide'; end if;
  v_ok := (v_min is null or v_val >= v_min) and (v_max is null or v_val <= v_max);
  insert into controles_qualite (id, organisation_id, lot_id, date_controle, parametre, valeur, minimum, maximum,
                                 conforme, observation)
  values (v_id, v_org, v_lot, (p ->> 'date')::date, trim(p ->> 'parametre'), v_val, v_min, v_max, v_ok,
          nullif(p ->> 'observation', ''));
  if not v_ok then update lots set statut = 'bloque' where id = v_lot; end if;
  return v_id;
end $$;

-- Décision qualité : { lot_id, statut: libere | bloque }. Un lot ne se libère que si tous ses contrôles sont conformes.
create or replace function changer_statut_lot(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_lot uuid := (p ->> 'lot_id')::uuid;
  v_statut text := p ->> 'statut';
begin
  if v_org is null or not has_role('admin', 'comptable', 'chef_departement') then
    raise exception 'Droits insuffisants';
  end if;
  perform assert_org('lots', v_lot, v_org);
  if v_statut not in ('libere', 'bloque') then raise exception 'Décision invalide'; end if;
  if v_statut = 'libere' and exists (select 1 from controles_qualite where lot_id = v_lot and not conforme) then
    raise exception 'Libération impossible : le lot a un contrôle non conforme';
  end if;
  update lots set statut = v_statut where id = v_lot;
end $$;

-- Expédition : { lot_id, date, quantite, tiers_id?, vente_id?, observation? }
create or replace function enregistrer_expedition(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_id uuid := gen_random_uuid();
  v_lot lots%rowtype;
  v_qte numeric := (p ->> 'quantite')::numeric;
  v_deja numeric;
  v_tiers uuid := nullif(p ->> 'tiers_id', '')::uuid;
  v_vente uuid := nullif(p ->> 'vente_id', '')::uuid;
begin
  if v_org is null or not has_role('admin', 'comptable', 'chef_departement') then
    raise exception 'Droits insuffisants';
  end if;
  select * into v_lot from lots where id = (p ->> 'lot_id')::uuid and organisation_id = v_org for update;
  if not found then raise exception 'Lot introuvable'; end if;
  if v_lot.statut = 'bloque' then raise exception 'Lot bloqué : expédition impossible'; end if;
  if v_lot.date_peremption is not null and v_lot.date_peremption < (p ->> 'date')::date then
    raise exception 'Lot périmé : expédition impossible';
  end if;
  if v_qte is null or v_qte <= 0 then raise exception 'Quantité invalide'; end if;
  select coalesce(sum(quantite), 0) into v_deja from lot_expeditions where lot_id = v_lot.id;
  if v_deja + v_qte > v_lot.quantite_initiale then
    raise exception 'Quantité expédiée supérieure à la quantité du lot (%)', v_lot.quantite_initiale - v_deja;
  end if;
  if v_tiers is not null then perform assert_org('tiers', v_tiers, v_org); end if;
  if v_vente is not null then perform assert_org('ventes', v_vente, v_org); end if;
  insert into lot_expeditions (id, organisation_id, lot_id, tiers_id, vente_id, date_expedition, quantite, observation)
  values (v_id, v_org, v_lot.id, v_tiers, v_vente, (p ->> 'date')::date, v_qte, nullif(p ->> 'observation', ''));
  return v_id;
end $$;

-- ============================================================
-- Rappel de lot : lots liés (amont ou aval) et destinataires touchés
-- ============================================================
create or replace function tracer_lot(p_lot uuid, p_sens text)
returns table (lot_id uuid, niveau integer)
language sql stable security invoker set search_path = public as $$
  with recursive arbre(lot_id, niveau) as (
    select p_lot, 0
    union
    select case when p_sens = 'aval' then l.lot_aval_id else l.lot_amont_id end, a.niveau + 1
    from lot_liens l
    join arbre a on a.lot_id = case when p_sens = 'aval' then l.lot_amont_id else l.lot_aval_id end
    where a.niveau < 20
  )
  select lot_id, min(niveau)::integer from arbre group by lot_id
$$;

create or replace view v_lots as
select l.*, p.code as produit_code, p.nom as produit_nom, p.unite,
       coalesce((select sum(e.quantite) from lot_expeditions e where e.lot_id = l.id), 0) as quantite_expediee,
       (select count(*) from controles_qualite c where c.lot_id = l.id) as nb_controles,
       (select count(*) from controles_qualite c where c.lot_id = l.id and not c.conforme) as nb_non_conformes
from lots l join produits p on p.id = l.produit_id;
alter view v_lots set (security_invoker = true);

-- ============================================================
-- Sécurité
-- ============================================================
alter table lots enable row level security;
alter table lot_liens enable row level security;
alter table lot_expeditions enable row level security;
alter table controles_qualite enable row level security;

create policy lots_select on lots for select using (organisation_id = current_org_id());
create policy liens_select on lot_liens for select using (organisation_id = current_org_id());
create policy lexp_select on lot_expeditions for select using (organisation_id = current_org_id());
create policy cq_select on controles_qualite for select using (organisation_id = current_org_id());

revoke execute on function lot_depuis_recolte(), lot_depuis_sortie_of() from public, anon, authenticated;
revoke execute on function
  creer_lot(jsonb), lier_lots(jsonb), enregistrer_controle(jsonb), changer_statut_lot(jsonb),
  enregistrer_expedition(jsonb), tracer_lot(uuid, text)
from public, anon;
grant execute on function
  creer_lot(jsonb), lier_lots(jsonb), enregistrer_controle(jsonb), changer_statut_lot(jsonb),
  enregistrer_expedition(jsonb), tracer_lot(uuid, text)
to authenticated;
