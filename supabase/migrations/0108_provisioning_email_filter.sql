-- 0108 — Filtre e-mail du provisioning (D-161).
--
-- `list_provisionable_profiles` triait par anciennete et plafonnait a 50 :
-- un pilotage `onlyEmail` sur un profil recent (cree apres les 252 du
-- recensement) ne le trouvait jamais. Le filtre descend en SQL : quand un
-- e-mail est fourni, il est selectionne directement, sans fenetre.

create or replace function private.list_provisionable_profiles(
  p_limit integer default 25,
  p_email text default null
)
returns table (profile_id uuid, primary_email text, display_name text)
language sql
security definer
set search_path to ''
as $$
  select p.id, pc.primary_email, p.display_name
  from public.ise_profiles p
  join private.profile_contacts pc on pc.profile_id = p.id
  where p.claim_status = 'unclaimed'
    and p.user_id is null
    and p.deleted_at is null
    and p.merged_into_profile_id is null
    and p.is_test_account = false
    and pc.primary_email is not null
    and pc.primary_email <> ''
    and (p_email is null or lower(pc.primary_email) = lower(p_email))
  order by p.created_at
  limit greatest(1, least(p_limit, 50));
$$;

create or replace function public.srv_list_provisionable_profiles(
  p_limit integer default 25,
  p_email text default null
)
returns table (profile_id uuid, primary_email text, display_name text)
language sql
security definer
set search_path to ''
as $$
  select * from private.list_provisionable_profiles(p_limit, p_email);
$$;

revoke all on function private.list_provisionable_profiles(integer, text) from public;
revoke all on function private.list_provisionable_profiles(integer, text) from anon;
revoke all on function private.list_provisionable_profiles(integer, text) from authenticated;
grant execute on function private.list_provisionable_profiles(integer, text) to service_role;

revoke all on function public.srv_list_provisionable_profiles(integer, text) from public;
revoke all on function public.srv_list_provisionable_profiles(integer, text) from anon;
revoke all on function public.srv_list_provisionable_profiles(integer, text) from authenticated;
grant execute on function public.srv_list_provisionable_profiles(integer, text) to service_role;

-- Les anciennes signatures a un seul argument sont retirees : une seule
-- forme appelable, pas d'ambiguite de surcharge cote PostgREST.
drop function if exists private.list_provisionable_profiles(integer);
drop function if exists public.srv_list_provisionable_profiles(integer);
