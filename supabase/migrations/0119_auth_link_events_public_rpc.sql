-- =====================================================================
-- 0119_auth_link_events_public_rpc
--
-- CORRECTIF de 0118 : `private.log_auth_link_event` n'est PAS
-- appelable en RPC. PostgREST n'expose que le schema `public` (aucune
-- configuration `db-extra-search-path` / schemas additionnels dans ce
-- projet — verifie : aucun `private.*` n'est appele via `supabase.rpc()`
-- nulle part dans `apps/web`, uniquement des fonctions `public.*`). Un
-- test fonctionnel a confirme le blocage : `anon` n'a PAS `USAGE` sur le
-- schema `private` (`has_schema_privilege('anon', 'private', 'USAGE')`
-- renvoie `false`), donc meme avec `EXECUTE` accorde par 0118, l'appel
-- `set role anon; select private.log_auth_link_event(...)` echoue par
-- `permission denied for schema private` avant meme d'atteindre la
-- verification interne de la fonction. Le meme blocage se serait produit
-- en production via `supabase.rpc('log_auth_link_event', ...)`.
--
-- CORRECTIF : la fonction appelable devient `public.log_auth_link_event`
-- (meme corps, memes garanties). La TABLE reste `private.auth_link_events`
-- — schema prive, jamais expose a l'API, seule la fonction y ecrit
-- (D-16 inchange). Seul le point d'entree RPC change de schema.
-- L'ancienne fonction `private.log_auth_link_event` est supprimee pour
-- ne laisser aucune trace inerte. Documente en D-173 (addendum).
-- =====================================================================

drop function if exists private.log_auth_link_event(text, text, uuid, text);

create or replace function public.log_auth_link_event(
  p_link_type  text,
  p_outcome    text,
  p_user_id    uuid default null,
  p_error_code text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_link_type not in (
       'signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email', 'code') then
    raise exception 'invalid_link_type' using errcode = 'P0001';
  end if;
  if p_outcome not in ('success', 'error') then
    raise exception 'invalid_outcome' using errcode = 'P0001';
  end if;

  insert into private.auth_link_events (link_type, outcome, user_id, error_code)
  values (p_link_type, p_outcome, p_user_id, p_error_code);
end
$$;

revoke all on function public.log_auth_link_event(text, text, uuid, text) from public;
grant execute on function public.log_auth_link_event(text, text, uuid, text)
  to anon, authenticated, service_role;

comment on function public.log_auth_link_event(text, text, uuid, text) is
  '0119 (corrige 0118). Journalise un atterrissage sur /auth/callback (succes ou echec). Doit vivre dans public : PostgREST n''expose pas le schema private aux appels RPC. Exposee a anon ET authenticated. Ecrit dans private.auth_link_events (schema prive, table non exposee). Liste blanche anon_function_grant, D-173.';

-- ---------------------------------------------------------------------
-- Verification.
-- ---------------------------------------------------------------------
do $verify$
declare
  v_n integer;
begin
  select count(*) into v_n from private.security_baseline_violations();
  if v_n <> 0 then
    raise exception '0119: security_baseline_violations() renvoie % ligne(s)', v_n;
  end if;

  if exists (
       select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'private' and p.proname = 'log_auth_link_event') then
    raise exception '0119: private.log_auth_link_event devrait avoir disparu';
  end if;

  if not pg_catalog.has_function_privilege(
       'anon', 'public.log_auth_link_event(text, text, uuid, text)', 'EXECUTE') then
    raise exception '0119: anon devrait avoir EXECUTE sur public.log_auth_link_event';
  end if;
end
$verify$;
