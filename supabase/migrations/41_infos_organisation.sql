-- D-AGROBUSINESS — Informations de l'entreprise modifiables par son administrateur (Administration → Entreprise).
--
-- nom, nif, adresse et telephone existaient déjà ; on ajoute l'e-mail de contact et le numéro de registre du commerce.
-- Le pays, la devise et le référentiel comptable restent fixés à la création (ils déterminent le plan comptable et
-- les règles de paie) : ils ne sont affichés qu'en lecture. La mise à jour reste protégée par la policy org_update
-- (administrateur de l'organisation) et par le trigger proteger_abonnement (aucune modification de l'abonnement).

alter table organisations
  add column if not exists email text,
  add column if not exists rccm text;

-- Trace dans le journal d'audit tout changement des informations d'identité de l'entreprise (ancien et nouveau contenu).
create or replace function audit_organisation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (old.nom, old.nif, old.rccm, old.adresse, old.telephone, old.email)
     is distinct from (new.nom, new.nif, new.rccm, new.adresse, new.telephone, new.email) then
    insert into journal_audit (organisation_id, table_name, ligne_id, action, anciennes_valeurs, nouvelles_valeurs)
    values (
      new.id,
      'organisations',
      new.id::text,
      'UPDATE',
      jsonb_build_object('nom', old.nom, 'nif', old.nif, 'rccm', old.rccm, 'adresse', old.adresse, 'telephone', old.telephone, 'email', old.email),
      jsonb_build_object('nom', new.nom, 'nif', new.nif, 'rccm', new.rccm, 'adresse', new.adresse, 'telephone', new.telephone, 'email', new.email)
    );
  end if;
  return new;
end $$;

drop trigger if exists audit_organisations on organisations;
create trigger audit_organisations after update on organisations
  for each row execute function audit_organisation();
