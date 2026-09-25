-- Corrige la valorisation des sous-produits issus d'un ordre de fabrication (lancer_transformation()).
--
-- Constat : sans prix de référence renseigné sur AUCUNE sortie, le coût total (matière + frais imputés)
-- était réparti au prorata de la QUANTITÉ entre tous les produits — y compris les sous-produits. Un
-- sous-produit (son, brisures…) se retrouvait alors valorisé au même coût au kg que le produit principal,
-- alors qu'il vaut nettement moins sur le marché : la sortie de stock à la vente dépassait largement le
-- prix de vente, avec une perte comptable artificielle à chaque vente du sous-produit.
--
-- Méthode corrigée (méthode de la valeur nette de réalisation, standard pour les sous-produits en
-- comptabilité analytique) : chaque sous-produit est valorisé à SON PROPRE coût normal
-- (quantité × prix_reference du produit, obligatoire pour un sous-produit désormais — l'ordre de
-- fabrication est refusé s'il manque), indépendamment de la quantité de matière transformée. Ce montant
-- est déduit du coût total ; seul le reste est réparti entre les produits finis (au prorata de la valeur
-- si un prix de référence existe, sinon de la quantité comme avant — inchangé pour les produits finis).
--
-- Prérequis : renseigner le prix de référence de chaque sous-produit dans /catalogue/produits avant de
-- lancer une transformation qui en produit.

create or replace function lancer_transformation(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := current_org_id();
  v_id uuid := gen_random_uuid();
  v_date date := (p ->> 'date')::date;
  v_dep uuid := (p ->> 'departement_id')::uuid;
  v_camp uuid := nullif(p ->> 'campagne_id', '')::uuid;
  v_src uuid := (p ->> 'magasin_source_id')::uuid;
  v_dst uuid := (p ->> 'magasin_destination_id')::uuid;
  v_qte numeric := (p ->> 'quantite_matiere')::numeric;
  v_frais numeric := coalesce(nullif(p ->> 'frais_imputes', '')::numeric, 0);
  n nomenclatures%rowtype;
  v_matiere produits%rowtype;
  v_sorties jsonb;
  v_ligne jsonb;
  v_produit produits%rowtype;
  v_valeur_matiere numeric;
  v_total numeric;
  v_total_sous_produits numeric := 0;
  v_a_repartir numeric;
  v_poids_total numeric := 0;
  v_par_valeur boolean;
  v_poids numeric;
  v_reste numeric;
  v_val numeric;
  v_i integer := 0;
  v_nb_principaux integer := 0;
  v_sq numeric;
  v_ec jsonb := '[]'::jsonb;
  v_num text;
begin
  if v_org is null or not has_role('admin', 'comptable', 'chef_departement') then
    raise exception 'Droits insuffisants';
  end if;
  perform assert_org('magasins', v_src, v_org);
  perform assert_org('magasins', v_dst, v_org);
  perform assert_org('departements', v_dep, v_org);
  if v_camp is not null then perform assert_org('campagnes', v_camp, v_org); end if;
  if v_qte is null or v_qte <= 0 then raise exception 'Quantité de matière invalide'; end if;
  if v_frais < 0 then raise exception 'Frais invalides'; end if;

  select * into n from nomenclatures where id = (p ->> 'nomenclature_id')::uuid and organisation_id = v_org and actif;
  if not found then raise exception 'Nomenclature introuvable'; end if;
  select * into v_matiere from produits where id = n.matiere_id;

  v_sorties := p -> 'sorties';
  if v_sorties is null or jsonb_typeof(v_sorties) <> 'array' or jsonb_array_length(v_sorties) = 0 then
    select jsonb_agg(jsonb_build_object('produit_id', produit_id, 'quantite', round(v_qte * rendement_pct / 100, 3)))
      into v_sorties from nomenclature_sorties where nomenclature_id = n.id;
  end if;
  if v_sorties is null then raise exception 'La nomenclature n''a aucune sortie'; end if;

  v_valeur_matiere := sortie_stock(v_org, v_date, v_src, v_matiere.id, v_qte, 'propre', null,
                                   'sortie_transformation', 'ordre_fabrication', v_id);
  v_total := v_valeur_matiere + v_frais;
  v_num := prochain_numero(v_org, 'ordre_fabrication', 'OF', v_date);

  insert into ordres_fabrication (id, organisation_id, numero, date_of, nomenclature_id, magasin_source_id,
      magasin_destination_id, departement_id, campagne_id, quantite_matiere, cout_matiere, frais_imputes,
      valeur_totale, observation)
    values (v_id, v_org, v_num, v_date, n.id, v_src, v_dst, v_dep, v_camp, v_qte, v_valeur_matiere, v_frais,
            v_total, nullif(p ->> 'observation', ''));

  if v_valeur_matiere > 0 then
    v_ec := v_ec
      || ec_ligne(compte_categorie(v_org, v_matiere.categorie, 'variation'), v_valeur_matiere, 0, null, v_dep, null, v_camp, 'Matière ' || v_matiere.nom)
      || ec_ligne(compte_categorie(v_org, v_matiere.categorie, 'stock'), 0, v_valeur_matiere, null, null, null, v_camp, 'Matière ' || v_matiere.nom);
  end if;

  -- Passe 1 : sous-produits à leur coût normal (déduit du coût total), poids de répartition des produits
  -- finis restants (par valeur si un prix de référence existe, sinon par quantité, comme avant).
  for v_ligne in select * from jsonb_array_elements(v_sorties) loop
    select * into v_produit from produits
      where id = (v_ligne ->> 'produit_id')::uuid and organisation_id = v_org and actif;
    if not found or v_produit.categorie not in ('produit_fini', 'sous_produit') then
      raise exception 'Les sorties doivent être des produits finis ou des sous-produits';
    end if;
    v_sq := (v_ligne ->> 'quantite')::numeric;
    if v_sq is null or v_sq <= 0 then raise exception 'Quantité de sortie invalide (%)', v_produit.nom; end if;

    if v_produit.categorie = 'sous_produit' then
      if v_produit.prix_reference is null then
        raise exception 'Coût de valorisation manquant pour le sous-produit « % » : renseignez son prix de référence dans le catalogue des produits avant de lancer cette transformation', v_produit.nom;
      end if;
      v_total_sous_produits := v_total_sous_produits + round(v_sq * v_produit.prix_reference, 2);
    else
      v_nb_principaux := v_nb_principaux + 1;
      v_poids_total := v_poids_total + v_sq * coalesce(v_produit.prix_reference, 0);
    end if;
  end loop;

  if v_nb_principaux = 0 then raise exception 'Un ordre de fabrication doit produire au moins un produit fini'; end if;
  v_a_repartir := v_total - v_total_sous_produits;
  if v_a_repartir < 0 then
    raise exception 'Le coût de valorisation des sous-produits (%) dépasse le coût total de la transformation (%)', v_total_sous_produits, v_total;
  end if;

  v_par_valeur := v_poids_total > 0;
  if not v_par_valeur then
    for v_ligne in select * from jsonb_array_elements(v_sorties) loop
      select * into v_produit from produits where id = (v_ligne ->> 'produit_id')::uuid;
      if v_produit.categorie = 'produit_fini' then
        v_poids_total := v_poids_total + (v_ligne ->> 'quantite')::numeric;
      end if;
    end loop;
  end if;

  -- Passe 2 : valorisation et écritures de sortie, dans le même ordre que la saisie.
  v_reste := v_a_repartir;
  for v_ligne in select * from jsonb_array_elements(v_sorties) loop
    select * into v_produit from produits where id = (v_ligne ->> 'produit_id')::uuid;
    v_sq := (v_ligne ->> 'quantite')::numeric;

    if v_produit.categorie = 'sous_produit' then
      v_val := round(v_sq * v_produit.prix_reference, 2);
    else
      v_i := v_i + 1;
      v_poids := case when v_par_valeur then v_sq * coalesce(v_produit.prix_reference, 0) else v_sq end;
      v_val := case when v_i = v_nb_principaux then v_reste else round(v_a_repartir * v_poids / v_poids_total, 2) end;
      v_reste := v_reste - v_val;
    end if;

    insert into of_sorties (organisation_id, of_id, produit_id, quantite, valeur, rendement_reel_pct)
      values (v_org, v_id, v_produit.id, v_sq, v_val, round(v_sq / v_qte * 100, 2));
    perform entree_stock(v_org, v_date, v_dst, v_produit.id, v_sq, v_val, 'propre', null,
                         'entree_production', 'ordre_fabrication', v_id);
    if v_val > 0 then
      v_ec := v_ec || ec_ligne(compte_categorie(v_org, v_produit.categorie, 'stock'), v_val, 0, null, null, null, v_camp, v_produit.nom);
    end if;
  end loop;

  if v_total > 0 then
    v_ec := v_ec || ec_ligne(param_compte(v_org, 'variation_produits'), 0, v_total, null, v_dep, null, v_camp, 'Production stockée ' || v_num);
    perform ecrire_interne(v_org, journal_de_type(v_org, 'stock'), v_date, 'Ordre de fabrication ' || v_num,
                           null, v_ec, 'ordres_fabrication', v_id, null);
  end if;
  return v_id;
end $$;
