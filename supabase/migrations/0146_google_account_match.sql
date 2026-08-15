-- 0146 — Rattachement automatique d'un compte Google a un profil ISE
-- deja reference et non reclame (D-201).
--
-- Jusqu'ici, un compte auth.users n'etait rattache a un ise_profiles que
-- par deux voies : le provisioning direct par l'Edge Function
-- (private.provision_referenced_account, 0106, service_role uniquement)
-- ou la reclamation manuelle (private.apply_claim_approval, 0029).
-- Le bouton "Se connecter avec Google" (GoogleSignInButton.tsx) ne fait
-- QUE de l'authentification : si la personne n'a jamais clique un lien
-- d'activation ni depose de reclamation, elle atterrit sur un compte
-- SANS profil rattache, meme si son adresse Google correspond exactement
-- a un profil du recensement qui l'attend.
--
-- Cette migration ferme cet ecart : a la toute premiere connexion Google
-- reussie, si l'adresse e-mail du FOURNISSEUR (pas auth.users.email, qui
-- est mutable et pas necessairement issue de Google) est marquee verifiee
-- par Google ET correspond exactement (apres normalisation) a l'e-mail
-- d'un profil `unclaimed`/`user_id is null`, le compte est rattache
-- automatiquement — memes effets exacts que le provisioning direct.
--
-- Preuve de possession acceptee : l'e-mail Google verifie est traite
-- comme l'exact equivalent du clic sur le lien d'activation Supabase
-- (0106) — dans les deux cas, la preuve vient d'un tiers de confiance
-- (Supabase pour le lien signe envoye a l'adresse du recensement, Google
-- pour `email_verified` sur l'identite OAuth) et jamais d'une simple
-- declaration de l'utilisateur.
--
-- Architecture retenue : private.provision_referenced_account reste
-- INCHANGEE dans ses effets et INTOUCHEE dans sa restriction a
-- service_role (aucune ouverture de sa surface a authenticated). Elle
-- gagne un unique parametre optionnel p_mechanism (defaut 'invite_link',
-- donc 0 changement de comportement pour l'Edge Function existante), qui
-- ne fait que qualifier la piste d'audit. Un NOUVEAU point d'entree,
-- public.match_google_account_to_profile(), SECURITY DEFINER et accorde
-- a authenticated (meme schema de securite que public.bootstrap_admin_
-- profile, 0086) :
--   * ne lit JAMAIS de parametre fourni par le client — uniquement
--     auth.uid() et auth.identities de la session en cours, pour eviter
--     toute usurpation (memes garanties qu'un appel service_role) ;
--   * verifie l'identite `google` de l'utilisateur courant, exige
--     identity_data->>'email_verified' = 'true' ;
--   * ne rattache que si AUCUN profil n'est deja lie a ce compte (no-op
--     silencieux sinon) ;
--   * recherche par egalite EXACTE sur private.profile_contacts.
--     primary_email_norm (colonne generee, deja normalisee) — jamais de
--     correspondance approximative ;
--   * ne rattache que si le profil trouve est `unclaimed`, `user_id is
--     null`, non supprime et non fusionne (memes gardes que
--     private.list_provisionable_profiles, 0106) ;
--   * delegue TOUS les effets (liaison, claim_status, role, verifications,
--     audit, domain_events) a private.provision_referenced_account, qui
--     revalide elle-meme ses propres gardes (profil deja reclame, compte
--     deja lie a un autre profil) — aucune logique dupliquee ;
--   * avale toute exception inattendue (ex. condition de course) dans un
--     bloc EXCEPTION qui journalise puis termine en silence : cette
--     fonction est appelee depuis /auth/callback juste apres l'echange
--     OAuth et ne doit jamais faire echouer une connexion legitime, meme
--     en cas d'anomalie interne.
--
-- Si aucun profil ne correspond (e-mail inconnu du recensement), la
-- fonction ne fait rien : l'utilisateur atterrit sur le tableau de bord
-- sans profil rattache (comportement deja gere par loadViewerContext /
-- loadMemberContext, withoutProfile = true), exactement comme avant
-- cette migration.

-- ---------------------------------------------------------------------
-- 1. private.provision_referenced_account : parametre p_mechanism,
--    retro-compatible (defaut 'invite_link' = comportement actuel
--    inchange pour l'Edge Function de provisioning).
-- ---------------------------------------------------------------------

create or replace function private.provision_referenced_account(
  p_profile_id uuid,
  p_user_id uuid,
  p_mechanism text default 'invite_link'
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
                       'mechanism', p_mechanism,
                       'automatic', true
                     ),
    p_actor_profile_id => p_profile_id
  );

  insert into public.domain_events
    (event_type, aggregate_type, aggregate_id, actor_profile_id, payload, dedupe_key)
  values
    ('profile.claimed', 'profile', p_profile_id, p_profile_id,
     jsonb_build_object('method', 'provisioned', 'mechanism', p_mechanism, 'automatic', true),
     'profile.provisioned:' || p_profile_id::text)
  on conflict do nothing;
end
$$;

-- Signature elargie : re-verrouiller les privileges (une fonction avec un
-- parametre supplementaire est une entite distincte cote Postgres).
revoke all on function private.provision_referenced_account(uuid, uuid, text) from public;
revoke all on function private.provision_referenced_account(uuid, uuid, text) from anon;
revoke all on function private.provision_referenced_account(uuid, uuid, text) from authenticated;
grant execute on function private.provision_referenced_account(uuid, uuid, text) to service_role;

comment on function private.provision_referenced_account(uuid, uuid, text) is
  'Rattache un compte auth.users a un profil ISE reference (D-161). p_mechanism qualifie la piste d''audit ("invite_link" par defaut, "google_oauth_verified_email" pour D-201) sans changer les effets. SECURITY DEFINER, service_role uniquement.';

-- ---------------------------------------------------------------------
-- 2. public.match_google_account_to_profile() — point d'entree cote
--    authenticated, sans aucun parametre fourni par le client.
-- ---------------------------------------------------------------------

create or replace function public.match_google_account_to_profile()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user_id        uuid := (select auth.uid());
  v_identity_email text;
  v_email_verified boolean;
  v_email_norm     text;
  v_profile_id     uuid;
begin
  if v_user_id is null then
    return;
  end if;

  -- Deja rattache a un profil ? rien a faire — evite un travail inutile
  -- et une exception previsible de provision_referenced_account.
  if exists (
    select 1 from public.ise_profiles p
    where p.user_id = v_user_id and p.deleted_at is null
  ) then
    return;
  end if;

  -- Identite Google de la session en cours UNIQUEMENT : jamais
  -- auth.users.email (mutable, pas necessairement issu de Google), et
  -- jamais un parametre fourni par l'appelant. La plus recente si
  -- plusieurs identites google existent (cas theorique).
  select i.identity_data ->> 'email',
         coalesce((i.identity_data ->> 'email_verified')::boolean, false)
    into v_identity_email, v_email_verified
  from auth.identities i
  where i.user_id = v_user_id
    and i.provider = 'google'
  order by i.created_at desc
  limit 1;

  if v_identity_email is null or v_email_verified is not true then
    return;
  end if;

  v_email_norm := lower(btrim(v_identity_email));
  if v_email_norm = '' then
    return;
  end if;

  select p.id into v_profile_id
  from public.ise_profiles p
  join private.profile_contacts pc on pc.profile_id = p.id
  where pc.primary_email_norm = v_email_norm
    and p.claim_status = 'unclaimed'
    and p.user_id is null
    and p.deleted_at is null
    and p.merged_into_profile_id is null
    and p.is_test_account = false
  limit 1;

  if v_profile_id is null then
    return;
  end if;

  perform private.provision_referenced_account(
    v_profile_id, v_user_id, 'google_oauth_verified_email'
  );
exception
  when others then
    -- Ne doit jamais faire echouer /auth/callback (meme philosophie que
    -- logAuthLinkEvent cote application) : une condition de course avec
    -- un autre rattachement concurrent, ou toute anomalie imprevue, est
    -- journalisee puis avalee.
    perform private.log_audit(
      p_action      => 'profile.google_match_failed',
      p_object_type => 'profile',
      p_object_id   => coalesce(v_profile_id::text, 'unknown'),
      p_result      => 'failure',
      p_context     => jsonb_build_object(
                         'user_id',  v_user_id,
                         'sqlstate', sqlstate
                       ),
      p_actor_kind  => 'system'
    );
end
$$;

comment on function public.match_google_account_to_profile() is
  'D-201 — rattache automatiquement le compte authenticated courant a un profil ISE unclaimed dont l''e-mail correspond exactement a l''identite Google verifiee (identity_data->>''email_verified''). Aucun parametre client : tout est derive de auth.uid()/auth.identities. No-op silencieux si deja rattache, si l''e-mail n''est pas verifie, ou si aucun profil ne correspond. Delegue les effets a private.provision_referenced_account.';

revoke all on function public.match_google_account_to_profile() from public, anon;
grant execute on function public.match_google_account_to_profile() to authenticated;

-- 'profile.google_match_failed' n'est pas un evenement de domaine (pas de
-- consommateur asynchrone) : uniquement une trace d'audit d'echec, meme
-- registre que d'autres actions '*_failed' deja loguees ailleurs sans
-- entree dans domain_event_types.
