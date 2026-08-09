-- =====================================================================
-- 0087_promotion_invitation_redemption
-- ISE-070 (suite) : `promotion_invitations.status` prevoyait deja la valeur
-- 'claimed' depuis 0003, sans qu'aucune fonction ne sache jamais y mener.
-- Le jeton etait genere et affiche une fois a l'inviteur (`create_promotion_
-- invitation`, 0070), mais rien ne le verifiait cote invite : un lien ou un
-- e-mail d'invitation n'aboutissait nulle part.
--
-- Deux fonctions, toutes deux reservees a `authenticated` (D-126) : la
-- personne invitee doit d'abord avoir un compte (creation ou connexion,
-- Google inclus) pour que le jeton puisse etre rattache a son `user_id`.
-- Aucune n'est ouverte a `anon` : pas d'ajout a la liste blanche des
-- projections publiques (0061/0063).
--   * get_promotion_invitation_preview : lecture seule, pour afficher qui
--     invite avant confirmation.
--   * redeem_promotion_invitation : reclame le profil cible pour le compte
--     courant. Reutilise le verrouillage en deux temps (invitation puis
--     profil) deja etabli par `approve_profile_claim` (0029).
-- =====================================================================

create or replace function public.get_promotion_invitation_preview(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_hash text;
  v_inv  public.promotion_invitations;
  v_prof public.ise_profiles;
  v_promo public.promotions;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_token is null or btrim(p_token) = '' then
    raise exception 'invitation_invalid' using errcode = 'P0002';
  end if;

  v_hash := encode(extensions.digest(btrim(p_token), 'sha256'), 'hex');

  select * into v_inv from public.promotion_invitations where token_hash = v_hash;
  if not found or v_inv.profile_id is null then
    raise exception 'invitation_invalid' using errcode = 'P0002';
  end if;
  if v_inv.status = 'claimed' then
    raise exception 'profile_already_claimed' using errcode = 'P0001';
  end if;
  if v_inv.status not in ('sent', 'opened') or v_inv.expires_at <= now() then
    raise exception 'invitation_expired' using errcode = 'P0001';
  end if;

  select * into v_prof from public.ise_profiles where id = v_inv.profile_id and deleted_at is null;
  if not found then
    raise exception 'invitation_invalid' using errcode = 'P0002';
  end if;
  select * into v_promo from public.promotions where id = v_inv.promotion_id;

  update public.promotion_invitations
     set status = 'opened', opened_at = coalesce(opened_at, now())
   where id = v_inv.id and status = 'sent';

  return jsonb_build_object(
    'invited_first_name', v_prof.first_name,
    'promotion_label',    v_promo.name,
    'expires_at',         v_inv.expires_at
  );
end;
$fn$;

comment on function public.get_promotion_invitation_preview(text) is
  'Apercu en lecture seule d''une invitation de promotion, avant confirmation par l''invite (ISE-070 suite).';

revoke all on function public.get_promotion_invitation_preview(text) from public, anon;
grant execute on function public.get_promotion_invitation_preview(text) to authenticated;


create or replace function public.redeem_promotion_invitation(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me      uuid := (select auth.uid());
  v_hash    text;
  v_inv     public.promotion_invitations;
  v_role_id smallint;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_token is null or btrim(p_token) = '' then
    raise exception 'invitation_invalid' using errcode = 'P0002';
  end if;

  -- Un compte ne peut deja etre rattache a un profil (D-20).
  if exists (
    select 1 from public.ise_profiles where user_id = v_me and deleted_at is null
  ) then
    raise exception 'account_already_linked' using errcode = 'P0001';
  end if;

  v_hash := encode(extensions.digest(btrim(p_token), 'sha256'), 'hex');

  select * into v_inv
  from public.promotion_invitations
  where token_hash = v_hash
  for update;

  if not found or v_inv.profile_id is null then
    raise exception 'invitation_invalid' using errcode = 'P0002';
  end if;
  if v_inv.status = 'claimed' then
    raise exception 'profile_already_claimed' using errcode = 'P0001';
  end if;
  if v_inv.status not in ('sent', 'opened') or v_inv.expires_at <= now() then
    raise exception 'invitation_expired' using errcode = 'P0001';
  end if;

  -- Verrou sur le profil cible : il a pu etre reclame entre-temps par un autre canal.
  perform 1 from public.ise_profiles where id = v_inv.profile_id for update;
  if exists (
    select 1 from public.ise_profiles p
    where p.id = v_inv.profile_id
      and (p.user_id is not null or p.claim_status = 'claimed')
  ) then
    update public.promotion_invitations set status = 'expired' where id = v_inv.id;
    raise exception 'profile_already_claimed' using errcode = 'P0001';
  end if;

  update public.ise_profiles
     set user_id        = v_me,
         claim_status   = 'claimed',
         claimed_at     = now(),
         profile_status = 'active'
   where id = v_inv.profile_id;

  update public.promotion_invitations
     set status = 'claimed', claimed_at = now()
   where id = v_inv.id;

  -- Toute autre invitation en cours vers ce meme profil tombe (coherence avec 0029).
  update public.promotion_invitations
     set status = 'expired'
   where profile_id = v_inv.profile_id
     and id <> v_inv.id
     and status in ('sent', 'opened');

  select r.id into v_role_id from private.roles r where r.code = 'member';
  if v_role_id is not null then
    insert into private.user_roles (profile_id, role_id, granted_by)
    values (v_inv.profile_id, v_role_id, v_inv.inviter_profile_id)
    on conflict (profile_id, role_id) do nothing;
  end if;

  perform private.log_audit(
    p_action           => 'promotion_invitation.redeemed',
    p_object_type      => 'ise_profiles',
    p_object_id        => v_inv.profile_id::text,
    p_actor_profile_id => v_inv.profile_id,
    p_actor_kind       => 'user',
    p_context          => jsonb_build_object('invitation_id', v_inv.id)
  );

  return jsonb_build_object('profile_id', v_inv.profile_id);
end;
$fn$;

comment on function public.redeem_promotion_invitation(text) is
  'ISE-070 (suite). Rattache le profil cible au compte courant a partir du jeton d''invitation en clair, une seule fois.';

revoke all on function public.redeem_promotion_invitation(text) from public, anon;
grant execute on function public.redeem_promotion_invitation(text) to authenticated;
