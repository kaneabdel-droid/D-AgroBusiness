-- Demandes envoyées depuis la page "Assistance / Support". Chaque demande est enregistrée
-- ici (aucune perdue même si l'email échoue) et transférée par email (Resend) à la boîte
-- support@dembasolution.com commune aux produits, avec Reply-To = email du client
-- (cf. lib/support/transferer.ts). email_envoye trace l'échec éventuel de l'envoi.
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  sujet text not null check (char_length(sujet) between 1 and 200),
  message text not null check (char_length(message) between 1 and 5000),
  statut varchar(20) not null default 'nouveau' check (statut in ('nouveau', 'en_cours', 'resolu')),
  email_envoye boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_messages_organisation_id on public.support_messages (organisation_id, created_at desc);

alter table public.support_messages enable row level security;

-- Tout utilisateur de l'organisation peut écrire au support et relire ses demandes ; ni
-- modification ni suppression (le statut est géré par l'admin plateforme, service role).
create policy support_messages_select on public.support_messages for select
  using (organisation_id = public.current_org_id());

create policy support_messages_insert on public.support_messages for insert
  with check (user_id = auth.uid() and organisation_id = public.current_org_id());
