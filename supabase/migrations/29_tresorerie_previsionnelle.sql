-- D-AGROBUSINESS — Trésorerie prévisionnelle.
-- Prévisions saisies à la main (ventes attendues, salaires, impôts, investissements…), uniques ou mensuelles.
-- Le plan à 12 mois combine ces lignes avec les soldes de trésorerie, les échéances de financement et les créances / dettes ouvertes (calcul dans l'application).

create table previsions_tresorerie (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete restrict,
  libelle text not null,
  categorie text not null default 'autre' check (categorie in (
    'vente', 'subvention', 'paie', 'fournisseur', 'impot', 'financement', 'investissement', 'autre'
  )),
  sens text not null check (sens in ('encaissement', 'decaissement')),
  montant numeric(18,2) not null check (montant > 0),
  date_debut date not null,
  date_fin date,
  recurrence text not null default 'unique' check (recurrence in ('unique', 'mensuelle')),
  actif boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (date_fin is null or date_fin >= date_debut)
);
create index on previsions_tresorerie (organisation_id);

alter table previsions_tresorerie enable row level security;
create policy prev_select on previsions_tresorerie for select using (organisation_id = current_org_id());
create policy prev_write on previsions_tresorerie for all
  using (organisation_id = current_org_id() and has_role('admin', 'comptable', 'direction'))
  with check (organisation_id = current_org_id());
