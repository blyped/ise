-- 0107 — Façades PostgREST du provisioning (D-161), reservees a service_role.
--
-- Le schema `private` n'est pas expose a PostgREST : l'Edge Function de
-- provisioning passe par ces deux façades du schema `public`, dont
-- l'execution est refusee a anon et authenticated (grant service_role
-- uniquement — meme modele que les autres fonctions reservees).

create or replace function public.srv_list_provisionable_profiles(p_limit integer default 25)
returns table (profile_id uuid, primary_email text, display_name text)
language sql
security definer
set search_path to ''
as $$
  select * from private.list_provisionable_profiles(p_limit);
$$;

create or replace function public.srv_provision_referenced_account(
  p_profile_id uuid,
  p_user_id uuid
) returns void
language sql
security definer
set search_path to ''
as $$
  select private.provision_referenced_account(p_profile_id, p_user_id);
$$;

revoke all on function public.srv_list_provisionable_profiles(integer) from public;
revoke all on function public.srv_list_provisionable_profiles(integer) from anon;
revoke all on function public.srv_list_provisionable_profiles(integer) from authenticated;
grant execute on function public.srv_list_provisionable_profiles(integer) to service_role;

revoke all on function public.srv_provision_referenced_account(uuid, uuid) from public;
revoke all on function public.srv_provision_referenced_account(uuid, uuid) from anon;
revoke all on function public.srv_provision_referenced_account(uuid, uuid) from authenticated;
grant execute on function public.srv_provision_referenced_account(uuid, uuid) to service_role;
