-- D-AGROBUSINESS — Super-administration de la plateforme.
-- Produits Chariow (un par niveau et par durée), activation des moyens de paiement, marquage de l'organisation de démonstration.
-- Ces tables n'ont aucune policy : seule la clé de service (espace /admin, webhooks) y accède.

create table chariow_produits (
  niveau text not null check (niveau in ('standard', 'medium', 'premium')),
  mois integer not null check (mois in (1, 6, 12)),
  product_id text not null check (length(trim(product_id)) > 0),
  updated_at timestamptz not null default now(),
  primary key (niveau, mois)
);
alter table chariow_produits enable row level security;

-- Un moyen de paiement n'est proposé aux clients que s'il est actif ici ET que ses clés sont présentes sur le serveur.
create table paiement_moyens (
  moyen text primary key check (moyen in ('wave', 'orange', 'carte', 'chariow')),
  actif boolean not null default false,
  note text,
  updated_at timestamptz not null default now()
);
alter table paiement_moyens enable row level security;
insert into paiement_moyens (moyen, actif, note) values
  ('chariow', true, 'Mobile Money et carte — actif'),
  ('wave', false, 'Bictorys — en attente des clés'),
  ('orange', false, 'Bictorys — en attente des clés'),
  ('carte', false, 'Moneroo — en attente des clés')
on conflict do nothing;

-- Organisation de démonstration (compte public partagé : jamais verrouillée, exclue des chiffres réels)
alter table organisations add column demo boolean not null default false;

create or replace function proteger_abonnement() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and (
       new.niveau is distinct from old.niveau
    or new.essai_expire_le is distinct from old.essai_expire_le
    or new.abonnement_expire_le is distinct from old.abonnement_expire_le
    or new.compte_verrouille is distinct from old.compte_verrouille
    or new.demo is distinct from old.demo
  ) then
    raise exception 'L’abonnement ne peut pas être modifié directement';
  end if;
  return new;
end $$;

-- Abonnement accordé à la main par le super-administrateur (virement, geste commercial)
alter table abonnement_paiements drop constraint if exists abonnement_paiements_provider_check;
alter table abonnement_paiements add constraint abonnement_paiements_provider_check check (provider in ('bictorys', 'moneroo', 'chariow', 'manuel'));
alter table abonnement_paiements drop constraint if exists abonnement_paiements_moyen_paiement_check;
alter table abonnement_paiements add constraint abonnement_paiements_moyen_paiement_check check (moyen_paiement in ('wave', 'orange', 'carte', 'chariow', 'manuel'));
