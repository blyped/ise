-- =====================================================================
-- 0066_default_privileges_guard
-- Applique le 2026-08-08. Export fidele de la migration appliquee.
-- Ne pas editer : toute correction passe par une nouvelle migration.
--
-- DEFAUT TROUVE PAR supabase/tests/rls/0021_cms_suite.sql (cas J01).
--
--   0062 posait le garde-fou anti-regression par un REVOKE seul, sans GRANT
--   prealable. Ce REVOKE n'a cree AUCUNE entree dans `pg_default_acl` pour
--   le schema `private`. Constate, pas suppose : apres 0062, la requete
--   `select defaclacl from pg_default_acl where defaclnamespace =
--   'private'::regnamespace and defaclobjtype = 'f'` ne renvoyait rien, et
--   la premiere fonction creee ensuite dans `private` portait
--   `proacl = NULL` — c'est-a-dire le defaut natif de PostgreSQL, qui
--   accorde EXECUTE a PUBLIC, donc a `anon`.
--
--   Le controle `anon_function_grant` ajoute en 0061 l'a signale dans la
--   seconde qui a suivi, pendant la suite de tests. C'est exactement son role.
--
-- CORRECTIF
--   Poser d'abord un GRANT explicite — ce qui materialise l'entree
--   pg_default_acl — puis retirer PUBLIC et `anon`. Le schema `public`
--   disposait deja d'une entree conforme ; elle est reaffirmee ici pour que
--   les deux schemas soient traites de la meme facon et pour que la
--   migration se lise seule.
--
-- CHOIX ASSUME
--   Dans `private`, le defaut n'accorde EXECUTE qu'a `postgres`. Un helper
--   RLS destine a `authenticated` doit donc porter son GRANT explicite,
--   comme le font deja 0004, 0028 et 0062. L'oubli se traduit par un refus
--   42501 bruyant, jamais par une ouverture silencieuse : la defaillance
--   est du bon cote. Dans `public`, le defaut existant est reaffirme a
--   l'identique (postgres, authenticated, service_role).
-- =====================================================================

alter default privileges in schema private
  grant execute on functions to postgres;
alter default privileges in schema private
  revoke execute on functions from public;
alter default privileges in schema private
  revoke execute on functions from anon;

alter default privileges in schema public
  grant execute on functions to postgres, authenticated, service_role;
alter default privileges in schema public
  revoke execute on functions from public;
alter default privileges in schema public
  revoke execute on functions from anon;

-- ---------------------------------------------------------------------
-- Verification immediate : si le garde-fou n'a pas pris, la migration
-- echoue plutot que de laisser croire qu'il protege quelque chose.
-- Une entree PUBLIC se rend `=X/...` juste apres `{` ou une virgule.
-- ---------------------------------------------------------------------
do $$
declare
  v_private text;
  v_public  text;
begin
  select defaclacl::text into v_private from pg_default_acl
   where defaclnamespace = 'private'::regnamespace and defaclobjtype = 'f'
     and defaclrole = 'postgres'::regrole;
  select defaclacl::text into v_public from pg_default_acl
   where defaclnamespace = 'public'::regnamespace and defaclobjtype = 'f'
     and defaclrole = 'postgres'::regrole;

  if v_private is null or v_private ~ '[{,]=X/' or v_private like '%anon=%' then
    raise exception 'default_privileges_guard_ineffective_private: %',
      coalesce(v_private, '(aucune entree pg_default_acl)') using errcode = 'P0001';
  end if;
  if v_public is null or v_public ~ '[{,]=X/' or v_public like '%anon=%' then
    raise exception 'default_privileges_guard_ineffective_public: %',
      coalesce(v_public, '(aucune entree pg_default_acl)') using errcode = 'P0001';
  end if;
end $$;
