-- 0106 — Provisioning direct des comptes des profils references (D-161).
--
-- Pivot produit du 2026-08-12 : plutot que d'attendre que chaque ancien ISE
-- retrouve et reclame son profil (ISE-005 -> ISE-007), la plateforme
-- pre-cree son compte auth (email du recensement) et le lie immediatement
-- a son profil. L'interesse recoit un lien d'activation (Supabase invite),
-- choisit son mot de passe, et atterrit sur son profil pre-rempli.
-- Le parcours de reclamation existant DEMEURE, en filet de secours pour
-- les emails de recensement invalides.
--
-- Cette fonction reproduit EXACTEMENT les effets de
-- private.apply_claim_approval (0028+) hors mecanique de reclamation :
-- liaison user_id, claim_status='claimed', profile_status='active',
-- verification 'email' (le compte est cree sur l'adresse du recensement,
-- la preuve de possession est apportee par le clic sur le lien d'activation
-- envoye a cette meme adresse), role 'member', trace d'audit, evenement.
--
-- SECURITY DEFINER, appelable UNIQUEMENT par service_role (l'Edge Function
-- de provisioning) : aucune exposition a authenticated/anon.

create or replace function private.provision_referenced_account(
  p_profile_id uuid,
  p_user_id uuid
) returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_role_id smallint;
begin
  perform 1 from public.ise_profiles where id = p_profile_id for update;
  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.ise_profiles p
    where p.id = p_profile_id
      and (p.user_id is not null or p.claim_status = 'claimed')
  ) then
    raise exception 'profile_already_claimed' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.ise_profiles p
    where p.user_id = p_user_id and p.deleted_at is null
  ) then
    raise exception 'account_already_linked' using errcode = 'P0001';
  end if;

  -- Toute reclamation en cours sur ce profil devient sans objet.
  update public.profile_claims
     set status      = 'rejected',
         reviewed_at = now(),
         reason      = 'profile_provisioned_directly'
   where profile_id = p_profile_id
     and status in ('submitted', 'under_review');

  update public.ise_profiles
     set user_id             = p_user_id,
         claim_status        = 'claimed',
         claimed_at          = now(),
         profile_status      = 'active',
         verification_status = 'verified',
         verification_level  = 'email',
         verified_at         = now()
   where id = p_profile_id;

  insert into public.profile_verifications
    (profile_id, verification_type, verification_result, verified_by)
  values
    (p_profile_id, 'email', 'passed', null);

  select r.id into v_role_id from private.roles r where r.code = 'member';
  if v_role_id is not null then
    insert into private.user_roles (profile_id, role_id, granted_by)
    values (p_profile_id, v_role_id, null)
    on conflict (profile_id, role_id) do nothing;
  end if;

  perform private.log_audit(
    p_action      => 'profile.account_provisioned',
    p_object_type => 'profile',
    p_object_id   => p_profile_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object(
                       'user_id',   p_user_id,
                       'mechanism', 'invite_link',
                       'automatic', true
                     ),
    p_actor_profile_id => p_profile_id
  );

  insert into public.domain_events
    (event_type, aggregate_type, aggregate_id, actor_profile_id, payload, dedupe_key)
  values
    ('profile.claimed', 'profile', p_profile_id, p_profile_id,
     jsonb_build_object('method', 'provisioned', 'automatic', true),
     'profile.provisioned:' || p_profile_id::text)
  on conflict do nothing;
end
$$;

revoke all on function private.provision_referenced_account(uuid, uuid) from public;
revoke all on function private.provision_referenced_account(uuid, uuid) from anon;
revoke all on function private.provision_referenced_account(uuid, uuid) from authenticated;
grant execute on function private.provision_referenced_account(uuid, uuid) to service_role;

-- Liste de travail de l'Edge Function : profils eligibles au provisioning.
create or replace function private.list_provisionable_profiles(p_limit integer default 25)
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
  order by p.created_at
  limit greatest(1, least(p_limit, 50));
$$;

revoke all on function private.list_provisionable_profiles(integer) from public;
revoke all on function private.list_provisionable_profiles(integer) from anon;
revoke all on function private.list_provisionable_profiles(integer) from authenticated;
grant execute on function private.list_provisionable_profiles(integer) to service_role;
