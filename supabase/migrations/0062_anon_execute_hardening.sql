-- =====================================================================
-- 0062_anon_execute_hardening
-- Applique le 2026-08-08. Export fidele de la migration appliquee.
-- Ne pas editer : toute correction passe par une nouvelle migration.
--
-- DEFAUT REEL TROUVE PAR LE NOUVEAU CONTROLE DE 0061.
--
--   Le controle `anon_function_grant` ajoute en 0061 a immediatement
--   revele 53 fonctions de `public` et `private` executables par `anon`.
--   Cause : en PostgreSQL, `EXECUTE` est accorde a PUBLIC par defaut sur
--   toute fonction. Les ACL le montrent sans ambiguite —
--   `private.has_permission` porte `{=X/postgres, postgres=X, authenticated=X}` :
--   l'entree `=X` EST le privilege de PUBLIC, dont `anon` herite.
--
--   Les migrations 0028, 0029, 0039, 0052-0056 revoquaient bien
--   `from public, anon` fonction par fonction ; les lots anterieurs
--   (0001-0027, 0030-0051) ne le faisaient pas.
--
-- PORTEE REELLE DU DEFAUT
--   La plupart de ces fonctions commencent par `if auth.uid() is null then
--   raise 28000`, donc un appel `anon` echoue. Mais pas toutes :
--   `private.security_baseline_violations()`, `private.tables_without_rls()`,
--   `private.tables_without_policy()`, `private.storage_baseline_violations()`
--   decrivent la structure de securite du schema, et
--   `private.mask_email_hint()` est une fonction pure. Un porteur de la cle
--   publiable pouvait les appeler. C'est une fuite de structure, pas de
--   donnees, et elle est corrigee ici.
--
-- PRINCIPE APPLIQUE (0026 §1, D-16, addendum §44, §45)
--   `anon` n'a rien, sauf les NEUF projections public-safe de 0061.
--   La correction est conservatrice : elle rend EXPLICITE le privilege que
--   `authenticated` et `service_role` detenaient deja via PUBLIC, PUIS
--   retire PUBLIC et `anon`. Aucune fonction ne perd un appelant legitime.
--   Les fonctions deja fermees (private.log_audit, private.consume_rate_limit,
--   private.run_daily_featured_profile, ...) ne sont pas touchees : PUBLIC
--   n'y figure pas.
-- =====================================================================

do $$
declare
  r record;
  v_sig  text;
  v_white text[] := array[
    'get_landing_carousel', 'get_landing_sections', 'get_landing_news',
    'get_landing_events', 'get_landing_opportunities', 'get_landing_featured_profile',
    'get_landing_expertises', 'get_landing_partners', 'get_landing_stats'];
  v_fixed integer := 0;
begin
  for r in
    select p.oid,
           n.nspname,
           p.proname,
           pg_catalog.pg_get_function_identity_arguments(p.oid) as args,
           pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_x,
           pg_catalog.has_function_privilege('service_role',  p.oid, 'EXECUTE') as svc_x
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prokind in ('f', 'p')
      and p.proname <> all (v_white)
      and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
  loop
    v_sig := quote_ident(r.nspname) || '.' || quote_ident(r.proname) || '(' || r.args || ')';

    -- 1. Rendre explicite ce qui etait implicite, AVANT de retirer PUBLIC.
    if r.auth_x then
      execute format('grant execute on function %s to authenticated', v_sig);
    end if;
    if r.svc_x then
      execute format('grant execute on function %s to service_role', v_sig);
    end if;

    -- 2. Retirer PUBLIC (donc anon) et anon nommement.
    execute format('revoke execute on function %s from public', v_sig);
    execute format('revoke execute on function %s from anon',   v_sig);

    v_fixed := v_fixed + 1;
  end loop;

  raise notice 'anon_execute_hardening: % fonction(s) refermee(s)', v_fixed;
end $$;

-- ---------------------------------------------------------------------
-- Garde-fou contre la regression.
--
-- CONSTAT POSTERIEUR (voir 0066) : la forme REVOKE seule n'a PAS cree
-- d'entree `pg_default_acl` pour le schema `private`. Une fonction creee
-- ensuite dans `private` naissait encore avec `proacl = NULL`, donc avec
-- EXECUTE pour PUBLIC. Le controle `anon_function_grant` de 0061 l'a
-- immediatement signale lors de la suite de tests 0021. La migration 0066
-- pose le garde-fou dans sa forme effective (GRANT puis REVOKE).
-- Pour `public`, l'entree existait deja et exclut PUBLIC et `anon`.
-- ---------------------------------------------------------------------
alter default privileges in schema public  revoke execute on functions from public;
alter default privileges in schema public  revoke execute on functions from anon;
alter default privileges in schema private revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from anon;

-- ---------------------------------------------------------------------
-- Les helpers RLS restent joignables par `authenticated` : une politique
-- qui appelle private.has_permission() est evaluee avec les privileges de
-- l'appelant. Sans ce GRANT, toute la RLS tomberait en 42501.
-- Reaffirme explicitement, independamment de ce que la boucle a fait.
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select p.oid, p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) as args
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in (
        'current_profile_id', 'has_role', 'has_permission', 'is_admin', 'is_active_member',
        'is_connected_to', 'shares_promotion_with', 'is_blocked_between',
        'can_see_profile', 'can_see_field', 'field_is_visible',
        'can_see_news', 'can_see_event', 'is_event_organizer', 'is_event_registered',
        'can_see_opportunity', 'can_see_application', 'is_opportunity_author',
        'is_opportunity_manager', 'can_see_network_call', 'is_network_call_author',
        'can_see_community', 'can_see_community_post', 'is_community_member',
        'is_community_moderator', 'can_see_project', 'can_see_project_application',
        'is_project_member', 'is_project_owner', 'is_in_promotion',
        'can_see_internship_need', 'can_see_internship_offer', 'can_see_internship_placement',
        'is_internship_offer_owner', 'can_see_mentor_profile', 'is_mentorship_party',
        'is_conversation_participant', 'can_message_profile', 'can_access_support_ticket',
        'can_upload_verification_document', 'storage_segment', 'storage_segment_uuid')
  loop
    execute format('grant execute on function %s.%s(%s) to authenticated',
                   quote_ident('private'), quote_ident(r.proname), r.args);
  end loop;
end $$;
