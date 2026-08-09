-- =====================================================================
-- 0086_admin_bootstrap
-- Amorce du tout premier compte administrateur (decision du porteur,
-- 09/08/2026). La base ne contient aucun profil : sans ce mecanisme,
-- personne ne peut jamais devenir superadmin, la reclamation de profil
-- (ISE-005 -> ISE-007) exigeant un profil DEJA reference a reclamer, et
-- la creation de compte (ISE-002) ne cree volontairement aucun profil
-- (MASTER PROMPT §6).
--
-- Portee volontairement etroite :
--   * une liste blanche d'e-mails EN BASE (`private.platform_bootstrap_admins`),
--     jamais une valeur codee en dur dans une fonction ;
--   * la fonction est idempotente et NE FAIT RIEN pour un e-mail hors liste ;
--   * elle cree le PROFIL minimal (prenom/nom depuis les metadonnees du
--     fournisseur OAuth) et attribue le role 'superadmin' (0004) ;
--   * `onboarding_completed_at` reste NULL : le porteur complete son propre
--     profil via le parcours normal /bienvenue (ISE-008 -> ISE-014), comme
--     tout le monde. Aucune donnee inventee (MASTER PROMPT §9) ;
--   * D-126 : revoke public/anon puis grant explicite a authenticated.
-- =====================================================================

create table if not exists private.platform_bootstrap_admins (
  email      text primary key,
  note       text,
  created_at timestamptz not null default now()
);

comment on table private.platform_bootstrap_admins is
  'Liste blanche des e-mails autorises a s''auto-amorcer superadmin a la premiere connexion. A vider une fois l''equipe d''administration en place.';

insert into private.platform_bootstrap_admins (email, note) values
  ('blyped@gmail.com', 'Porteur du projet - premier compte, connexion Google (09/08/2026).')
on conflict (email) do nothing;

create or replace function public.bootstrap_admin_profile()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id    uuid := (select auth.uid());
  v_email      text;
  v_full_name  text;
  v_first_name text;
  v_last_name  text;
  v_space_pos  int;
  v_profile_id uuid;
  v_role_id    smallint;
begin
  if v_user_id is null then
    return;
  end if;

  select lower(btrim(u.email)),
         coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')
    into v_email, v_full_name
  from auth.users u
  where u.id = v_user_id;

  if v_email is null or not exists (
    select 1 from private.platform_bootstrap_admins b where b.email = v_email
  ) then
    return;
  end if;

  select p.id into v_profile_id
  from public.ise_profiles p
  where p.user_id = v_user_id;

  if v_profile_id is null then
    v_full_name := nullif(btrim(coalesce(v_full_name, '')), '');
    v_space_pos := case when v_full_name is not null then position(' ' in v_full_name) else 0 end;

    if v_full_name is null then
      v_first_name := 'Administrateur';
      v_last_name  := 'ISE';
    elsif v_space_pos = 0 then
      v_first_name := v_full_name;
      v_last_name  := 'ISE';
    else
      v_first_name := left(v_full_name, v_space_pos - 1);
      v_last_name  := btrim(substring(v_full_name from v_space_pos + 1));
    end if;

    insert into public.ise_profiles (
      user_id, first_name, last_name, profile_type,
      profile_status, claim_status, verification_status, verification_level,
      claimed_at, verified_at, last_confirmed_at
    ) values (
      v_user_id, v_first_name, v_last_name, 'graduate',
      'active', 'claimed', 'verified', 'admin',
      now(), now(), now()
    )
    returning id into v_profile_id;

    insert into private.profile_contacts (profile_id, primary_email, email_verified_at)
    values (v_profile_id, v_email, now())
    on conflict (profile_id) do update
      set primary_email     = excluded.primary_email,
          email_verified_at = excluded.email_verified_at;
  end if;

  select r.id into v_role_id from private.roles r where r.code = 'superadmin';

  insert into private.user_roles (profile_id, role_id)
  values (v_profile_id, v_role_id)
  on conflict (profile_id, role_id) do nothing;

  perform private.log_audit(
    p_action           => 'admin.bootstrap_self',
    p_object_type      => 'ise_profiles',
    p_object_id        => v_profile_id::text,
    p_actor_profile_id => v_profile_id,
    p_actor_kind       => 'user',
    p_context          => jsonb_build_object('email', v_email)
  );
end;
$$;

comment on function public.bootstrap_admin_profile() is
  'Amorce le premier compte superadmin depuis la liste blanche private.platform_bootstrap_admins. No-op pour tout autre compte (D-126, MASTER PROMPT §6).';

revoke all on function public.bootstrap_admin_profile() from public, anon;
grant execute on function public.bootstrap_admin_profile() to authenticated;
