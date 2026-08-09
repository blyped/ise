-- =====================================================================
-- 0076_admin_core_api
-- Coeur du back-office Superadmin (SA-001 -> SA-039, lot « admin core »).
--
-- Ecrans servis : SA-001 (tableau de bord), SA-002/003/004 (membres &
-- profils), SA-006 (revue des reclamations), SA-008/009/010/011
-- (promotions, delegues, invitations, membres manquants), SA-018
-- (moderation d'un signalement), SA-038/039 (support & signalements).
--
-- REGLES STRUCTURANTES
--   * Aucune donnee d'`ise_profiles` ne sort par un `select *` : les
--     privileges de colonne sont revoques (0020). Tout passe par des
--     fonctions SECURITY DEFINER qui EXIGENT la permission adequate via
--     `private.has_permission()` (D-31), projettent des colonnes
--     ENUMEREES, et journalisent (MASTER PROMPT §38, §40).
--   * D-126 : chaque fonction recoit `revoke ... from public, anon` puis
--     un `grant execute` explicite a `authenticated`.
--   * D-44 : pagination par curseur keyset. Le curseur brut est scelle
--     cote application (`lib/opaque-cursor.ts`) avant d'atteindre le
--     navigateur.
--   * D-85 : aucun SLA. Aucun compteur invente : chaque valeur renvoyee
--     est un decompte reel (MASTER PROMPT §98).
--   * Codes d'erreur D-102 : 28000 / 42501 / P0002 / P0001.
--
-- Cette migration REMPLACE deux fonctions de 0016 a signature identique
-- (`transition_report`, `transition_support_ticket`) pour AJOUTER la
-- journalisation d'audit qui leur manquait : une action de moderation
-- non journalisee n'existe pas (MASTER PROMPT §38). Le corps metier et
-- la machine d'etats sont conserves a l'identique.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Types de notifications reellement emis par ce lot
-- ---------------------------------------------------------------------
insert into public.notification_types (
  code, category, default_priority, trigger_event, label, default_action_label,
  default_in_app, default_email_mode, default_push,
  is_push_allowed, is_email_allowed,
  is_groupable, group_window_minutes,
  is_user_configurable, supports_expiry, sort_order
) values
  ('support_agent_replied', 'system', 'relevant', 'support_ticket.agent_replied',
   'L''equipe support vous a repondu.', 'Voir ma demande',
   true, 'off', false, false, true, false, null, true, false, 133),
  ('moderation_warning', 'system', 'action_required', 'moderation.warning_issued',
   'Un rappel des regles d''usage vous a ete adresse.', 'Consulter',
   true, 'immediate', false, false, true, false, null, false, false, 134)
on conflict (code) do nothing;


-- ---------------------------------------------------------------------
-- 1. Permissions d'administration de l'appelant
--
-- Meme motif que `get_my_cms_permissions` (0067) : `private.permissions`
-- n'est pas exposee, et une matrice recopiee cote application diverge
-- toujours. Sert a la garde serveur du layout `/administration` et au
-- filtrage d'AFFICHAGE de la navigation — jamais a la securite, qui
-- reste dans chaque fonction.
-- ---------------------------------------------------------------------
create or replace function public.get_my_admin_permissions()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select coalesce(jsonb_agg(c.code order by c.code), '[]'::jsonb)
    into v
  from (
    select unnest(array[
      'profiles.read', 'profiles.edit', 'profiles.moderate', 'profiles.verify',
      'promotions.manage', 'calls.moderate', 'opportunities.manage',
      'communities.manage', 'projects.manage', 'mentorship.manage',
      'events.manage', 'content.publish', 'imports.execute', 'imports.review',
      'support.manage', 'analytics.read', 'settings.manage', 'audit.read',
      'roles.manage']) as code
  ) c
  where private.has_permission(c.code);

  return v;
end
$$;

revoke all on function public.get_my_admin_permissions() from public, anon;
grant execute on function public.get_my_admin_permissions() to authenticated;

comment on function public.get_my_admin_permissions() is
  'Permissions d''administration detenues par l''appelant. Alimente la garde du layout /administration (SYS-006) et le filtrage d''affichage de la navigation.';


-- ---------------------------------------------------------------------
-- 2. SA-001 — Compteurs reels du tableau de bord
--
-- Chaque bloc n'est present que si la permission qui y donne acces est
-- detenue. Un compteur a zero vaut zero : rien n'est invente (§98).
-- ---------------------------------------------------------------------
create or replace function public.admin_dashboard_counters()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb := '{}'::jsonb;
  v_any boolean := false;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if private.has_permission('profiles.read') then
    v_any := true;
    select v || jsonb_build_object('profiles', jsonb_build_object(
      'referenced',    count(*) filter (where p.profile_status = 'referenced'),
      'active',        count(*) filter (where p.profile_status = 'active'),
      'suspended',     count(*) filter (where p.profile_status = 'suspended'),
      'archived',      count(*) filter (where p.profile_status = 'archived'),
      'unclaimed',     count(*) filter (where p.claim_status = 'unclaimed'),
      'claim_pending', count(*) filter (where p.claim_status = 'claim_pending')
    )) into v
    from public.ise_profiles p
    where p.deleted_at is null;
  end if;

  if private.has_permission('profiles.verify') then
    v_any := true;
    select v || jsonb_build_object('claims', jsonb_build_object(
      'submitted',    count(*) filter (where c.status = 'submitted'),
      'under_review', count(*) filter (where c.status = 'under_review')
    )) into v
    from public.profile_claims c;
  end if;

  if private.has_permission('profiles.moderate') then
    v_any := true;
    select v || jsonb_build_object('reports', jsonb_build_object(
      'open',      count(*) filter (where r.status = 'open'),
      'reviewing', count(*) filter (where r.status = 'reviewing')
    )) into v
    from public.reports r;
  end if;

  if private.has_permission('support.manage') then
    v_any := true;
    select v || jsonb_build_object('tickets', jsonb_build_object(
      'open',         count(*) filter (where t.status = 'open'),
      'in_progress',  count(*) filter (where t.status = 'in_progress'),
      'waiting_user', count(*) filter (where t.status = 'waiting_user')
    )) into v
    from public.support_tickets t;
  end if;

  if private.has_permission('promotions.manage') then
    v_any := true;
    select v || jsonb_build_object('promotions', jsonb_build_object(
      'active',                  (select count(*) from public.promotions pr where pr.status = 'active'),
      'missing_members_pending', (select count(*) from public.missing_member_suggestions s
                                   where s.status in ('submitted', 'reviewing')),
      'suggestions_pending',     (select count(*) from public.promotion_suggestions s
                                   where s.status in ('submitted', 'under_review'))
    )) into v;
  end if;

  if not v_any then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return v;
end
$$;

revoke all on function public.admin_dashboard_counters() from public, anon;
grant execute on function public.admin_dashboard_counters() to authenticated;

comment on function public.admin_dashboard_counters() is
  'SA-001. Compteurs reels du back-office, par bloc de permission. Aucun chiffre invente (MASTER PROMPT §98).';


-- ---------------------------------------------------------------------
-- 3. SA-002 — Liste administrable des membres et profils
--
-- Lecture : `profiles.read` (moderateur, agent support, gestionnaire
-- d''imports en disposent). Les ACTIONS restent sous `profiles.moderate`.
-- Recherche tolerante par trigramme sur le nom normalise (D-45),
-- jamais d''ILIKE non indexe (§85).
-- ---------------------------------------------------------------------
create or replace function public.admin_list_profiles(
  p_query        text    default null,
  p_status       text    default null,
  p_claim        text    default null,
  p_verification text    default null,
  p_promotion_id bigint  default null,
  p_cursor       text    default null,
  p_limit        integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit  integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  v_query  text    := public.normalize_text(nullif(btrim(coalesce(p_query, '')), ''));
  v_cur_ts timestamptz;
  v_cur_id uuid;
  v_rows   jsonb;
  v_next   text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('profiles.read') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_status is not null
     and p_status not in ('referenced', 'active', 'suspended', 'archived') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_claim is not null
     and p_claim not in ('unclaimed', 'claim_pending', 'claimed') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_verification is not null
     and p_verification not in ('unverified', 'pending', 'verified', 'rejected') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  if p_cursor is not null then
    begin
      v_cur_ts := split_part(p_cursor, '|', 1)::timestamptz;
      v_cur_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then
      raise exception 'validation_failed' using errcode = 'P0001';
    end;
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) - 'cur' order by r.created_at desc, r.profile_id desc), '[]'::jsonb),
         case when count(*) = v_limit
              then max(r.cur) filter (where r.rn = v_limit) end
    into v_rows, v_next
  from (
    select
      p.id as profile_id,
      p.display_name,
      p.profile_status,
      p.claim_status,
      p.verification_status,
      p.profile_type,
      p.user_id is not null as has_account,
      pr.name as promotion_name,
      pr.graduation_year,
      coalesce(o.canonical_name, nullif(btrim(p.current_organization_raw), '')) as organization,
      c.name_fr as country,
      p.created_at,
      p.last_active_at,
      p.created_at::text || '|' || p.id::text as cur,
      row_number() over (order by p.created_at desc, p.id desc) as rn
    from public.ise_profiles p
    left join public.promotions    pr on pr.id  = p.promotion_id
    left join public.organizations o  on o.id   = p.current_organization_id
    left join public.countries     c  on c.code = p.current_country_code
    where p.deleted_at is null
      and (p_status is null or p.profile_status = p_status)
      and (p_claim is null or p.claim_status = p_claim)
      and (p_verification is null or p.verification_status = p_verification)
      and (p_promotion_id is null or p.promotion_id = p_promotion_id)
      and (v_query is null or p.normalized_name operator(extensions.%) v_query)
      and (v_cur_ts is null or (p.created_at, p.id) < (v_cur_ts, v_cur_id))
    order by p.created_at desc, p.id desc
    limit v_limit
  ) r;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$$;

revoke all on function public.admin_list_profiles(text, text, text, text, bigint, text, integer) from public, anon;
grant execute on function public.admin_list_profiles(text, text, text, text, bigint, text, integer) to authenticated;

comment on function public.admin_list_profiles(text, text, text, text, bigint, text, integer) is
  'SA-002. Liste paginee par curseur keyset (D-44) des profils, filtres statut / reclamation / verification / promotion / nom. Exige profiles.read.';


-- ---------------------------------------------------------------------
-- 4. SA-003 — Fiche administrative d'un membre / profil
--
-- L''e-mail du COMPTE n''est projete que pour `profiles.moderate` :
-- c''est la donnee la plus sensible de l''ecran. Aucune coordonnee
-- historique (`private.profile_contacts`) ne sort — seulement l''indice
-- masque construit en base (D-107).
-- ---------------------------------------------------------------------
create or replace function public.admin_get_profile(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_can_moderate boolean;
  v_out jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('profiles.read') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  v_can_moderate := private.has_permission('profiles.moderate');

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'profile_id',          p.id,
      'display_name',        p.display_name,
      'first_name',          p.first_name,
      'last_name',           p.last_name,
      'profile_type',        p.profile_type,
      'headline',            p.headline,
      'profile_status',      p.profile_status,
      'claim_status',        p.claim_status,
      'verification_status', p.verification_status,
      'verification_level',  p.verification_level,
      'promotion_id',        p.promotion_id,
      'promotion_name',      pr.name,
      'graduation_year',     pr.graduation_year,
      'current_position',    p.current_position,
      'organization',        coalesce(o.canonical_name, nullif(btrim(p.current_organization_raw), '')),
      'current_city',        p.current_city,
      'country',             c.name_fr,
      'linkedin_url',        p.linkedin_url,
      'has_account',         p.user_id is not null,
      'account_email',       case when v_can_moderate then u.email end,
      'is_test_account',     p.is_test_account,
      'created_at',          p.created_at,
      'claimed_at',          p.claimed_at,
      'verified_at',         p.verified_at,
      'last_active_at',      p.last_active_at,
      'email_hint',          private.mask_email_hint(pc.primary_email_norm)
    ),
    'claims', coalesce((
      select jsonb_agg(jsonb_build_object(
        'claim_id',     cl.id,
        'status',       cl.status,
        'claim_method', cl.claim_method,
        'submitted_at', cl.submitted_at,
        'reviewed_at',  cl.reviewed_at,
        'reason',       cl.reason
      ) order by cl.submitted_at desc)
      from public.profile_claims cl
      where cl.profile_id = p.id
    ), '[]'::jsonb),
    'verifications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'verification_type',   pv.verification_type,
        'verification_result', pv.verification_result,
        'verified_at',         pv.verified_at
      ) order by pv.verified_at desc)
      from public.profile_verifications pv
      where pv.profile_id = p.id
    ), '[]'::jsonb),
    'moderation_actions', case when v_can_moderate then coalesce((
      select jsonb_agg(jsonb_build_object(
        'action_id',   ma.id,
        'action_type', ma.action_type,
        'reason',      ma.reason,
        'created_at',  ma.created_at,
        'moderator',   mp.display_name
      ) order by ma.created_at desc)
      from public.moderation_actions ma
      left join public.ise_profiles mp on mp.id = ma.moderator_profile_id
      where ma.target_profile_id = p.id
    ), '[]'::jsonb) else '[]'::jsonb end
  )
    into v_out
  from public.ise_profiles p
  left join public.promotions    pr on pr.id  = p.promotion_id
  left join public.organizations o  on o.id   = p.current_organization_id
  left join public.countries     c  on c.code = p.current_country_code
  left join private.profile_contacts pc on pc.profile_id = p.id
  left join auth.users u on u.id = p.user_id
  where p.id = p_profile_id
    and p.deleted_at is null;

  if v_out is null then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  return v_out;
end
$$;

revoke all on function public.admin_get_profile(uuid) from public, anon;
grant execute on function public.admin_get_profile(uuid) to authenticated;

comment on function public.admin_get_profile(uuid) is
  'SA-003. Fiche administrative : etat du profil, lien compte, historique des reclamations, verifications et actions de moderation. Exige profiles.read ; l''e-mail du compte exige profiles.moderate.';


-- ---------------------------------------------------------------------
-- 5. SA-003 — Suspendre / reactiver / archiver / restaurer un profil
--
-- Machine d''etats stricte, motif substantiel obligatoire, action
-- enregistree dans `moderation_actions` quand le vocabulaire de la table
-- la couvre, et TOUJOURS journalisee dans `private.audit_log` — y
-- compris les tentatives refusees.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_profile_status(
  p_profile_id uuid,
  p_action     text,
  p_reason     text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me      uuid := private.current_profile_id();
  v_profile public.ise_profiles;
  v_new     text;
  v_allowed boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('profiles.moderate') then
    perform private.log_audit(
      p_action      => 'admin.profile_status_changed',
      p_object_type => 'profile',
      p_object_id   => p_profile_id::text,
      p_result      => 'denied',
      p_error_code  => '42501'
    );
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_action is null or p_action not in ('suspend', 'reactivate', 'archive', 'restore') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select * into v_profile
  from public.ise_profiles
  where id = p_profile_id and deleted_at is null
  for update;

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  -- Un moderateur ne se suspend pas lui-meme par cette voie.
  if v_profile.id = v_me and p_action in ('suspend', 'archive') then
    raise exception 'cannot_target_self' using errcode = 'P0001';
  end if;

  v_allowed := case p_action
    when 'suspend'    then v_profile.profile_status = 'active'
    when 'reactivate' then v_profile.profile_status = 'suspended'
    when 'archive'    then v_profile.profile_status in ('referenced', 'active', 'suspended')
    when 'restore'    then v_profile.profile_status = 'archived'
  end;

  if not v_allowed then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  v_new := case p_action
    when 'suspend'    then 'suspended'
    when 'reactivate' then 'active'
    when 'archive'    then 'archived'
    when 'restore'    then case when v_profile.user_id is not null then 'active' else 'referenced' end
  end;

  update public.ise_profiles
     set profile_status = v_new
   where id = p_profile_id;

  if p_action in ('suspend', 'reactivate') then
    insert into public.moderation_actions
      (moderator_profile_id, action_type, target_type, target_id, target_profile_id, reason)
    values
      (v_me,
       case p_action when 'suspend' then 'account_suspension' else 'lift_suspension' end,
       'profile', p_profile_id, p_profile_id, btrim(p_reason));
  end if;

  perform private.log_audit(
    p_action      => 'admin.profile_status_changed',
    p_object_type => 'profile',
    p_object_id   => p_profile_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object(
      'action',      p_action,
      'from_status', v_profile.profile_status,
      'to_status',   v_new,
      'reason',      btrim(p_reason)
    )
  );

  return jsonb_build_object('profile_id', p_profile_id, 'profile_status', v_new);
end
$$;

revoke all on function public.admin_set_profile_status(uuid, text, text) from public, anon;
grant execute on function public.admin_set_profile_status(uuid, text, text) to authenticated;

comment on function public.admin_set_profile_status(uuid, text, text) is
  'SA-003. Suspension / reactivation / archivage / restauration d''un profil. Exige profiles.moderate, motif >= 10 caracteres, journalisation systematique (MASTER PROMPT §38).';


-- ---------------------------------------------------------------------
-- 6. SA-006 — File des reclamations de profil
-- ---------------------------------------------------------------------
create or replace function public.admin_list_profile_claims(
  p_status text    default null,
  p_cursor text    default null,
  p_limit  integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit  integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  v_cur_ts timestamptz;
  v_cur_id uuid;
  v_rows   jsonb;
  v_next   text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('profiles.verify') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_status is not null and p_status not in
     ('submitted', 'under_review', 'approved', 'rejected', 'withdrawn', 'expired') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  if p_cursor is not null then
    begin
      v_cur_ts := split_part(p_cursor, '|', 1)::timestamptz;
      v_cur_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then
      raise exception 'validation_failed' using errcode = 'P0001';
    end;
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) - 'cur' order by r.submitted_at desc, r.claim_id desc), '[]'::jsonb),
         case when count(*) = v_limit
              then max(r.cur) filter (where r.rn = v_limit) end
    into v_rows, v_next
  from (
    select
      cl.id as claim_id,
      cl.status,
      cl.claim_method,
      cl.submitted_at,
      p.display_name as profile_name,
      pr.graduation_year,
      u.email as claimant_email,
      cl.submitted_at::text || '|' || cl.id::text as cur,
      row_number() over (order by cl.submitted_at desc, cl.id desc) as rn
    from public.profile_claims cl
    join public.ise_profiles p on p.id = cl.profile_id
    left join public.promotions pr on pr.id = p.promotion_id
    left join auth.users u on u.id = cl.claimant_user_id
    where ((p_status is not null and cl.status = p_status)
       or (p_status is null and cl.status in ('submitted', 'under_review')))
      and (v_cur_ts is null or (cl.submitted_at, cl.id) < (v_cur_ts, v_cur_id))
    order by cl.submitted_at desc, cl.id desc
    limit v_limit
  ) r;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$$;

revoke all on function public.admin_list_profile_claims(text, text, integer) from public, anon;
grant execute on function public.admin_list_profile_claims(text, text, integer) to authenticated;

comment on function public.admin_list_profile_claims(text, text, integer) is
  'SA-006. File des reclamations (defaut : submitted + under_review), curseur keyset. Exige profiles.verify.';


-- ---------------------------------------------------------------------
-- 7. SA-006 — Detail d'une reclamation, elements de concordance
--
-- Les adresses ne se comparent QUE dans la base : le reviseur recoit
-- l''adresse du compte (que la demandeuse a elle-meme saisie), l''indice
-- MASQUE de l''adresse historique, et le verdict `emails_match` calcule
-- ici. L''adresse historique ne sort jamais (D-107).
-- ---------------------------------------------------------------------
create or replace function public.admin_get_profile_claim(p_claim_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_out jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('profiles.verify') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'claim', jsonb_build_object(
      'claim_id',         cl.id,
      'status',           cl.status,
      'claim_method',     cl.claim_method,
      'declared_details', cl.declared_details,
      'submitted_at',     cl.submitted_at,
      'reviewed_at',      cl.reviewed_at,
      'reviewed_by',      rv.display_name,
      'reason',           cl.reason
    ),
    'claimant', jsonb_build_object(
      'account_email',           u.email,
      'account_email_confirmed', u.email_confirmed_at is not null,
      'account_created_at',      u.created_at
    ),
    'profile', jsonb_build_object(
      'profile_id',           p.id,
      'display_name',         p.display_name,
      'headline',             p.headline,
      'profile_status',       p.profile_status,
      'claim_status',         p.claim_status,
      'verification_status',  p.verification_status,
      'promotion_name',       pr.name,
      'graduation_year',      pr.graduation_year,
      'current_position',     p.current_position,
      'organization',         coalesce(o.canonical_name, nullif(btrim(p.current_organization_raw), '')),
      'current_city',         p.current_city,
      'country',              c.name_fr,
      'email_hint',           private.mask_email_hint(pc.primary_email_norm),
      'has_historical_email', pc.primary_email_norm is not null
    ),
    'concordance', jsonb_build_object(
      'emails_match', (u.email_confirmed_at is not null
                       and pc.primary_email_norm is not null
                       and lower(btrim(u.email)) = pc.primary_email_norm),
      'other_pending_claims_on_profile', (
        select count(*) from public.profile_claims c2
        where c2.profile_id = cl.profile_id
          and c2.id <> cl.id
          and c2.status in ('submitted', 'under_review'))
    )
  )
    into v_out
  from public.profile_claims cl
  join public.ise_profiles p on p.id = cl.profile_id
  left join public.promotions    pr on pr.id  = p.promotion_id
  left join public.organizations o  on o.id   = p.current_organization_id
  left join public.countries     c  on c.code = p.current_country_code
  left join private.profile_contacts pc on pc.profile_id = p.id
  left join auth.users u on u.id = cl.claimant_user_id
  left join public.ise_profiles rv on rv.id = cl.reviewed_by
  where cl.id = p_claim_id;

  if v_out is null then
    raise exception 'claim_not_found' using errcode = 'P0002';
  end if;
  return v_out;
end
$$;

revoke all on function public.admin_get_profile_claim(uuid) from public, anon;
grant execute on function public.admin_get_profile_claim(uuid) to authenticated;

comment on function public.admin_get_profile_claim(uuid) is
  'SA-006. Detail d''une reclamation avec elements de concordance calcules en base. L''adresse historique ne sort jamais en clair (D-107). Exige profiles.verify.';


-- ---------------------------------------------------------------------
-- 8. SA-006 — Prise en charge d'une reclamation (submitted -> under_review)
-- ---------------------------------------------------------------------
create or replace function public.admin_start_claim_review(p_claim_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_claim public.profile_claims;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('profiles.verify') then
    perform private.log_audit(
      p_action      => 'profile.claim_review_started',
      p_object_type => 'profile_claim',
      p_object_id   => p_claim_id::text,
      p_result      => 'denied',
      p_error_code  => '42501'
    );
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_claim from public.profile_claims where id = p_claim_id for update;
  if not found then
    raise exception 'claim_not_found' using errcode = 'P0002';
  end if;
  if v_claim.status <> 'submitted' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  update public.profile_claims
     set status = 'under_review'
   where id = p_claim_id;

  perform private.log_audit(
    p_action      => 'profile.claim_review_started',
    p_object_type => 'profile_claim',
    p_object_id   => p_claim_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object('profile_id', v_claim.profile_id)
  );

  return jsonb_build_object('claim_id', p_claim_id, 'status', 'under_review');
end
$$;

revoke all on function public.admin_start_claim_review(uuid) from public, anon;
grant execute on function public.admin_start_claim_review(uuid) to authenticated;

comment on function public.admin_start_claim_review(uuid) is
  'SA-006. Passe une reclamation en revue (submitted -> under_review). Exige profiles.verify, journalisee.';


-- ---------------------------------------------------------------------
-- 9. SA-008 — Liste des promotions avec decomptes reels
-- ---------------------------------------------------------------------
create or replace function public.admin_list_promotions(
  p_query  text    default null,
  p_status text    default null,
  p_cursor text    default null,
  p_limit  integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit    integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  v_query    text    := nullif(btrim(coalesce(p_query, '')), '');
  v_cur_year integer;
  v_cur_id   bigint;
  v_rows     jsonb;
  v_next     text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('promotions.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_status is not null and p_status not in ('active', 'archived') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  if p_cursor is not null then
    begin
      v_cur_year := split_part(p_cursor, '|', 1)::integer;
      v_cur_id   := split_part(p_cursor, '|', 2)::bigint;
    exception when others then
      raise exception 'validation_failed' using errcode = 'P0001';
    end;
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) - 'cur' order by r.graduation_year desc, r.promotion_id desc), '[]'::jsonb),
         case when count(*) = v_limit
              then max(r.cur) filter (where r.rn = v_limit) end
    into v_rows, v_next
  from (
    select
      pr.id as promotion_id,
      pr.name,
      pr.graduation_year,
      pr.status,
      pr.estimated_size,
      counts.total_profiles,
      counts.active_members,
      counts.unclaimed_profiles,
      pending.suggestions_pending,
      pr.graduation_year::text || '|' || pr.id::text as cur,
      row_number() over (order by pr.graduation_year desc, pr.id desc) as rn
    from public.promotions pr
    cross join lateral (
      select
        count(*) as total_profiles,
        count(*) filter (where p.user_id is not null and p.profile_status = 'active') as active_members,
        count(*) filter (where p.claim_status = 'unclaimed') as unclaimed_profiles
      from public.ise_profiles p
      where p.promotion_id = pr.id and p.deleted_at is null
    ) counts
    cross join lateral (
      select count(*) as suggestions_pending
      from public.missing_member_suggestions s
      where s.promotion_id = pr.id and s.status in ('submitted', 'reviewing')
    ) pending
    where (p_status is null or pr.status = p_status)
      and (v_query is null
           or pr.name ilike '%' || v_query || '%'
           or pr.graduation_year::text = v_query)
      and (v_cur_year is null or (pr.graduation_year, pr.id) < (v_cur_year, v_cur_id))
    order by pr.graduation_year desc, pr.id desc
    limit v_limit
  ) r;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$$;

revoke all on function public.admin_list_promotions(text, text, text, integer) from public, anon;
grant execute on function public.admin_list_promotions(text, text, text, integer) to authenticated;

comment on function public.admin_list_promotions(text, text, text, integer) is
  'SA-008. Promotions et decomptes reels (profils, membres actifs, non reclames, suggestions en attente). Exige promotions.manage. Le filtre texte porte sur ~40 lignes : ILIKE assume.';


-- ---------------------------------------------------------------------
-- 10. SA-009 — Fiche d'une promotion
-- ---------------------------------------------------------------------
create or replace function public.admin_get_promotion(p_promotion_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_out jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('promotions.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'promotion', jsonb_build_object(
      'promotion_id',    pr.id,
      'name',            pr.name,
      'program_code',    pr.program_code,
      'graduation_year', pr.graduation_year,
      'description',     pr.description,
      'estimated_size',  pr.estimated_size,
      'status',          pr.status,
      'created_at',      pr.created_at
    ),
    'counts', (
      select jsonb_build_object(
        'total_profiles',     count(*),
        'active_members',     count(*) filter (where p.user_id is not null and p.profile_status = 'active'),
        'unclaimed_profiles', count(*) filter (where p.claim_status = 'unclaimed'),
        'verified_profiles',  count(*) filter (where p.verification_status = 'verified')
      )
      from public.ise_profiles p
      where p.promotion_id = pr.id and p.deleted_at is null
    ),
    'managers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'manager_id',   pm.id,
        'profile_id',   pm.profile_id,
        'display_name', mp.display_name,
        'manager_role', pm.manager_role,
        'active',       pm.active,
        'starts_at',    pm.starts_at,
        'ends_at',      pm.ends_at
      ) order by pm.active desc, pm.starts_at desc)
      from public.promotion_managers pm
      join public.ise_profiles mp on mp.id = pm.profile_id
      where pm.promotion_id = pr.id
    ), '[]'::jsonb),
    'invitations', (
      select jsonb_build_object(
        'sent',    count(*) filter (where i.status = 'sent'),
        'opened',  count(*) filter (where i.status = 'opened'),
        'claimed', count(*) filter (where i.status = 'claimed'),
        'expired', count(*) filter (where i.status = 'expired'),
        'revoked', count(*) filter (where i.status = 'revoked')
      )
      from public.promotion_invitations i
      where i.promotion_id = pr.id
    ),
    'missing_members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'suggestion_id', s.id,
        'first_name',    s.first_name,
        'last_name',     s.last_name,
        'country',       cc.name_fr,
        'status',        s.status,
        'submitted_by',  sp.display_name,
        'created_at',    s.created_at,
        'matched_profile_id', s.matched_profile_id
      ) order by s.created_at desc)
      from public.missing_member_suggestions s
      join public.ise_profiles sp on sp.id = s.submitted_by_profile_id
      left join public.countries cc on cc.code = s.country_code
      where s.promotion_id = pr.id
    ), '[]'::jsonb)
  )
    into v_out
  from public.promotions pr
  where pr.id = p_promotion_id;

  if v_out is null then
    raise exception 'promotion_not_found' using errcode = 'P0002';
  end if;
  return v_out;
end
$$;

revoke all on function public.admin_get_promotion(bigint) from public, anon;
grant execute on function public.admin_get_promotion(bigint) to authenticated;

comment on function public.admin_get_promotion(bigint) is
  'SA-009. Fiche promotion : decomptes reels, delegues, suivi des invitations, suggestions de membres manquants. Exige promotions.manage.';


-- ---------------------------------------------------------------------
-- 11. SA-008 — Creer / modifier une promotion
-- ---------------------------------------------------------------------
create or replace function public.admin_upsert_promotion(
  p_promotion_id    bigint  default null,
  p_name            text    default null,
  p_graduation_year integer default null,
  p_description     text    default null,
  p_estimated_size  integer default null,
  p_status          text    default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('promotions.manage') then
    perform private.log_audit(
      p_action      => 'admin.promotion_upserted',
      p_object_type => 'promotion',
      p_object_id   => coalesce(p_promotion_id::text, 'new'),
      p_result      => 'denied',
      p_error_code  => '42501'
    );
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_status is not null and p_status not in ('active', 'archived') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  if p_promotion_id is null then
    if nullif(btrim(coalesce(p_name, '')), '') is null
       or p_graduation_year is null
       or p_graduation_year not between 1960 and 2100 then
      raise exception 'validation_failed' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.promotions
               where program_code = 'ISE' and graduation_year = p_graduation_year) then
      raise exception 'promotion_already_exists' using errcode = 'P0001';
    end if;

    insert into public.promotions (program_code, graduation_year, name, description, estimated_size)
    values ('ISE', p_graduation_year, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''), p_estimated_size)
    returning id into v_id;

    perform private.log_audit(
      p_action      => 'admin.promotion_created',
      p_object_type => 'promotion',
      p_object_id   => v_id::text,
      p_result      => 'success',
      p_context     => jsonb_build_object('graduation_year', p_graduation_year, 'name', btrim(p_name))
    );
  else
    select id into v_id from public.promotions where id = p_promotion_id for update;
    if not found then
      raise exception 'promotion_not_found' using errcode = 'P0002';
    end if;

    update public.promotions
       set name           = coalesce(nullif(btrim(coalesce(p_name, '')), ''), name),
           description    = case when p_description is not null
                                 then nullif(btrim(p_description), '') else description end,
           estimated_size = coalesce(p_estimated_size, estimated_size),
           status         = coalesce(p_status, status)
     where id = p_promotion_id;

    perform private.log_audit(
      p_action      => 'admin.promotion_updated',
      p_object_type => 'promotion',
      p_object_id   => p_promotion_id::text,
      p_result      => 'success',
      p_context     => jsonb_build_object('status', p_status, 'name', p_name)
    );
  end if;

  return jsonb_build_object('promotion_id', v_id);
end
$$;

revoke all on function public.admin_upsert_promotion(bigint, text, integer, text, integer, text) from public, anon;
grant execute on function public.admin_upsert_promotion(bigint, text, integer, text, integer, text) to authenticated;

comment on function public.admin_upsert_promotion(bigint, text, integer, text, integer, text) is
  'SA-008. Creation (annee + nom) ou edition d''une promotion. L''annee de sortie, identite de la promotion, n''est jamais modifiable apres creation. Exige promotions.manage, journalisee.';


-- ---------------------------------------------------------------------
-- 12. SA-009 — Nommer / desactiver un delegue de promotion
-- ---------------------------------------------------------------------
create or replace function public.admin_set_promotion_manager(
  p_promotion_id bigint,
  p_profile_id   uuid,
  p_manager_role text    default 'delegate',
  p_active       boolean default true
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_role_id smallint;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('promotions.manage') then
    perform private.log_audit(
      p_action      => 'admin.promotion_manager_set',
      p_object_type => 'promotion',
      p_object_id   => p_promotion_id::text,
      p_result      => 'denied',
      p_error_code  => '42501'
    );
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_manager_role not in ('delegate', 'co_delegate', 'referent') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.promotions where id = p_promotion_id) then
    raise exception 'promotion_not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.ise_profiles p
                 where p.id = p_profile_id and p.deleted_at is null
                   and p.user_id is not null and p.profile_status = 'active') then
    -- Un delegue anime sa promotion : il doit etre un membre actif.
    raise exception 'profile_not_eligible' using errcode = 'P0001';
  end if;

  if p_active then
    insert into public.promotion_managers (promotion_id, profile_id, manager_role, active)
    values (p_promotion_id, p_profile_id, p_manager_role, true)
    on conflict (promotion_id, profile_id) where active
    do update set manager_role = excluded.manager_role;

    -- Le role `promotion_manager` porte la permission profiles.verify
    -- (0004) : l''attribution passe par la table de roles, jamais en dur.
    select r.id into v_role_id from private.roles r where r.code = 'promotion_manager';
    if v_role_id is not null then
      insert into private.user_roles (profile_id, role_id, granted_by)
      values (p_profile_id, v_role_id, private.current_profile_id())
      on conflict (profile_id, role_id) do nothing;
    end if;
  else
    update public.promotion_managers
       set active = false, ends_at = now()
     where promotion_id = p_promotion_id and profile_id = p_profile_id and active;
    if not found then
      raise exception 'manager_not_found' using errcode = 'P0002';
    end if;

    -- Retire le role si la personne n''anime plus AUCUNE promotion.
    if not exists (select 1 from public.promotion_managers pm
                   where pm.profile_id = p_profile_id and pm.active) then
      delete from private.user_roles ur
      using private.roles r
      where ur.role_id = r.id and r.code = 'promotion_manager'
        and ur.profile_id = p_profile_id;
    end if;
  end if;

  perform private.log_audit(
    p_action      => 'admin.promotion_manager_set',
    p_object_type => 'promotion',
    p_object_id   => p_promotion_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object(
      'profile_id',   p_profile_id,
      'manager_role', p_manager_role,
      'active',       p_active
    )
  );

  return jsonb_build_object('promotion_id', p_promotion_id, 'profile_id', p_profile_id, 'active', p_active);
end
$$;

revoke all on function public.admin_set_promotion_manager(bigint, uuid, text, boolean) from public, anon;
grant execute on function public.admin_set_promotion_manager(bigint, uuid, text, boolean) to authenticated;

comment on function public.admin_set_promotion_manager(bigint, uuid, text, boolean) is
  'SA-009. Nomme ou desactive un delegue de promotion et synchronise le role promotion_manager (D-31). Exige promotions.manage, journalisee.';


-- ---------------------------------------------------------------------
-- 13. SA-010 — Revue d'une suggestion de membre manquant (ISE-069)
-- ---------------------------------------------------------------------
create or replace function public.admin_review_missing_member_suggestion(
  p_suggestion_id      uuid,
  p_decision           text,
  p_matched_profile_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_s public.missing_member_suggestions;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('promotions.manage') then
    perform private.log_audit(
      p_action      => 'admin.missing_member_reviewed',
      p_object_type => 'missing_member_suggestion',
      p_object_id   => p_suggestion_id::text,
      p_result      => 'denied',
      p_error_code  => '42501'
    );
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_decision not in ('reviewing', 'matched', 'dismissed') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select * into v_s from public.missing_member_suggestions where id = p_suggestion_id for update;
  if not found then
    raise exception 'suggestion_not_found' using errcode = 'P0002';
  end if;

  -- Machine d'etats : submitted -> reviewing -> matched | dismissed
  -- (dismissed est aussi permis depuis submitted). `created` n'est pose
  -- que par le flux de creation de profil reference, hors de ce lot.
  if not (   (p_decision = 'reviewing' and v_s.status = 'submitted')
          or (p_decision = 'matched'   and v_s.status in ('submitted', 'reviewing'))
          or (p_decision = 'dismissed' and v_s.status in ('submitted', 'reviewing'))) then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  if p_decision = 'matched' then
    if p_matched_profile_id is null or not exists (
      select 1 from public.ise_profiles p
      where p.id = p_matched_profile_id and p.deleted_at is null) then
      raise exception 'validation_failed' using errcode = 'P0001';
    end if;
  end if;

  update public.missing_member_suggestions
     set status             = p_decision,
         matched_profile_id = case when p_decision = 'matched' then p_matched_profile_id
                                   else matched_profile_id end,
         reviewed_at        = case when p_decision in ('matched', 'dismissed') then now()
                                   else reviewed_at end
   where id = p_suggestion_id;

  perform private.log_audit(
    p_action      => 'admin.missing_member_reviewed',
    p_object_type => 'missing_member_suggestion',
    p_object_id   => p_suggestion_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object(
      'decision',           p_decision,
      'promotion_id',       v_s.promotion_id,
      'matched_profile_id', p_matched_profile_id
    )
  );

  return jsonb_build_object('suggestion_id', p_suggestion_id, 'status', p_decision);
end
$$;

revoke all on function public.admin_review_missing_member_suggestion(uuid, text, uuid) from public, anon;
grant execute on function public.admin_review_missing_member_suggestion(uuid, text, uuid) to authenticated;

comment on function public.admin_review_missing_member_suggestion(uuid, text, uuid) is
  'SA-010. Revue d''une suggestion « membre manquant » (ISE-069) : reviewing / matched / dismissed. Exige promotions.manage, journalisee.';


-- ---------------------------------------------------------------------
-- 14. SA-010 — File et revue des signalements de promotion (ISE-009)
-- ---------------------------------------------------------------------
create or replace function public.admin_list_promotion_suggestions(
  p_status text    default null,
  p_cursor text    default null,
  p_limit  integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit  integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  v_cur_ts timestamptz;
  v_cur_id uuid;
  v_rows   jsonb;
  v_next   text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('promotions.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_status is not null and p_status not in
     ('submitted', 'under_review', 'accepted', 'rejected', 'duplicate') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  if p_cursor is not null then
    begin
      v_cur_ts := split_part(p_cursor, '|', 1)::timestamptz;
      v_cur_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then
      raise exception 'validation_failed' using errcode = 'P0001';
    end;
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) - 'cur' order by r.created_at desc, r.suggestion_id desc), '[]'::jsonb),
         case when count(*) = v_limit
              then max(r.cur) filter (where r.rn = v_limit) end
    into v_rows, v_next
  from (
    select
      s.id as suggestion_id,
      s.promotion_label,
      s.institution,
      s.approximate_year,
      s.comment,
      s.status,
      s.review_note,
      cc.name_fr as country,
      sp.display_name as submitted_by,
      s.matched_promotion_id,
      s.created_at,
      s.created_at::text || '|' || s.id::text as cur,
      row_number() over (order by s.created_at desc, s.id desc) as rn
    from public.promotion_suggestions s
    join public.ise_profiles sp on sp.id = s.submitted_by_profile_id
    left join public.countries cc on cc.code = s.country_code
    where ((p_status is not null and s.status = p_status)
       or (p_status is null and s.status in ('submitted', 'under_review')))
      and (v_cur_ts is null or (s.created_at, s.id) < (v_cur_ts, v_cur_id))
    order by s.created_at desc, s.id desc
    limit v_limit
  ) r;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$$;

revoke all on function public.admin_list_promotion_suggestions(text, text, integer) from public, anon;
grant execute on function public.admin_list_promotion_suggestions(text, text, integer) to authenticated;

comment on function public.admin_list_promotion_suggestions(text, text, integer) is
  'SA-010. Signalements « ma promotion n''existe pas » (ISE-009, D-113), curseur keyset. Exige promotions.manage.';


create or replace function public.admin_review_promotion_suggestion(
  p_suggestion_id        uuid,
  p_decision             text,
  p_review_note          text   default null,
  p_matched_promotion_id bigint default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_s public.promotion_suggestions;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('promotions.manage') then
    perform private.log_audit(
      p_action      => 'admin.promotion_suggestion_reviewed',
      p_object_type => 'promotion_suggestion',
      p_object_id   => p_suggestion_id::text,
      p_result      => 'denied',
      p_error_code  => '42501'
    );
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_decision not in ('under_review', 'accepted', 'rejected', 'duplicate') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select * into v_s from public.promotion_suggestions where id = p_suggestion_id for update;
  if not found then
    raise exception 'suggestion_not_found' using errcode = 'P0002';
  end if;

  if not (   (p_decision = 'under_review' and v_s.status = 'submitted')
          or (p_decision in ('accepted', 'rejected', 'duplicate')
              and v_s.status in ('submitted', 'under_review'))) then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  -- `accepted` et `duplicate` doivent designer la promotion du referentiel
  -- qui repond a la suggestion : sinon la decision ne produit rien.
  if p_decision in ('accepted', 'duplicate') then
    if p_matched_promotion_id is null or not exists (
      select 1 from public.promotions where id = p_matched_promotion_id) then
      raise exception 'validation_failed' using errcode = 'P0001';
    end if;
  end if;
  if p_decision = 'rejected' and length(btrim(coalesce(p_review_note, ''))) < 5 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  update public.promotion_suggestions
     set status                 = p_decision,
         review_note            = coalesce(nullif(btrim(coalesce(p_review_note, '')), ''), review_note),
         matched_promotion_id   = case when p_decision in ('accepted', 'duplicate')
                                       then p_matched_promotion_id else matched_promotion_id end,
         reviewed_by_profile_id = private.current_profile_id(),
         reviewed_at            = case when p_decision <> 'under_review' then now() else reviewed_at end
   where id = p_suggestion_id;

  perform private.log_audit(
    p_action      => 'admin.promotion_suggestion_reviewed',
    p_object_type => 'promotion_suggestion',
    p_object_id   => p_suggestion_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object(
      'decision',             p_decision,
      'matched_promotion_id', p_matched_promotion_id
    )
  );

  return jsonb_build_object('suggestion_id', p_suggestion_id, 'status', p_decision);
end
$$;

revoke all on function public.admin_review_promotion_suggestion(uuid, text, text, bigint) from public, anon;
grant execute on function public.admin_review_promotion_suggestion(uuid, text, text, bigint) to authenticated;

comment on function public.admin_review_promotion_suggestion(uuid, text, text, bigint) is
  'SA-010. Revue d''un signalement de promotion absente (ISE-009) : under_review / accepted / rejected / duplicate. Exige promotions.manage, journalisee.';


-- ---------------------------------------------------------------------
-- 15. SA-038 — File des signalements pour la moderation
-- ---------------------------------------------------------------------
create or replace function public.admin_list_reports(
  p_status text    default null,
  p_cursor text    default null,
  p_limit  integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit  integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  v_cur_ts timestamptz;
  v_cur_id uuid;
  v_rows   jsonb;
  v_next   text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('profiles.moderate') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_status is not null and p_status not in ('open', 'reviewing', 'resolved', 'dismissed') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  if p_cursor is not null then
    begin
      v_cur_ts := split_part(p_cursor, '|', 1)::timestamptz;
      v_cur_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then
      raise exception 'validation_failed' using errcode = 'P0001';
    end;
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) - 'cur' order by r.created_at desc, r.report_id desc), '[]'::jsonb),
         case when count(*) = v_limit
              then max(r.cur) filter (where r.rn = v_limit) end
    into v_rows, v_next
  from (
    select
      rp.id as report_id,
      rp.target_type,
      rp.target_id,
      rp.reason_code,
      rr.name as reason_name,
      rp.severity,
      rp.status,
      rp.resolution_code,
      rep.display_name as reporter_name,
      own.display_name as target_owner_name,
      rev.display_name as reviewer_name,
      rp.created_at,
      rp.created_at::text || '|' || rp.id::text as cur,
      row_number() over (order by rp.created_at desc, rp.id desc) as rn
    from public.reports rp
    join public.report_reasons rr on rr.code = rp.reason_code
    left join public.ise_profiles rep on rep.id = rp.reporter_profile_id
    left join public.ise_profiles own on own.id = rp.target_owner_profile_id
    left join public.ise_profiles rev on rev.id = rp.reviewer_profile_id
    where ((p_status is not null and rp.status = p_status)
       or (p_status is null and rp.status in ('open', 'reviewing')))
      and (v_cur_ts is null or (rp.created_at, rp.id) < (v_cur_ts, v_cur_id))
    order by rp.created_at desc, rp.id desc
    limit v_limit
  ) r;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$$;

revoke all on function public.admin_list_reports(text, text, integer) from public, anon;
grant execute on function public.admin_list_reports(text, text, integer) to authenticated;

comment on function public.admin_list_reports(text, text, integer) is
  'SA-038. File des signalements (defaut : open + reviewing), curseur keyset. Exige profiles.moderate.';


-- ---------------------------------------------------------------------
-- 16. SA-018 / SA-039 — Detail d'un signalement
-- ---------------------------------------------------------------------
create or replace function public.admin_get_report(p_report_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_out jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('profiles.moderate') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'report', jsonb_build_object(
      'report_id',        rp.id,
      'target_type',      rp.target_type,
      'target_id',        rp.target_id,
      'reason_code',      rp.reason_code,
      'reason_name',      rr.name,
      'description',      rp.description,
      'severity',         rp.severity,
      'status',           rp.status,
      'resolution_code',  rp.resolution_code,
      'resolution_note',  rp.resolution_note,
      'reporter_name',    rep.display_name,
      'target_owner_id',  rp.target_owner_profile_id,
      'target_owner_name', own.display_name,
      'reviewer_name',    rev.display_name,
      'created_at',       rp.created_at,
      'reviewing_at',     rp.reviewing_at,
      'closed_at',        rp.closed_at
    ),
    'evidence', coalesce((
      select jsonb_agg(jsonb_build_object(
        'evidence_id',   e.id,
        'evidence_kind', e.evidence_kind,
        'note',          e.note,
        'created_at',    e.created_at
      ) order by e.created_at)
      from public.report_evidence e
      where e.report_id = rp.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'from_status', ev.from_status,
        'to_status',   ev.to_status,
        'note',        ev.note,
        'actor_name',  ap.display_name,
        'created_at',  ev.created_at
      ) order by ev.created_at)
      from public.report_events ev
      left join public.ise_profiles ap on ap.id = ev.actor_profile_id
      where ev.report_id = rp.id
    ), '[]'::jsonb),
    'actions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'action_id',   ma.id,
        'action_type', ma.action_type,
        'reason',      ma.reason,
        'moderator',   mp.display_name,
        'created_at',  ma.created_at
      ) order by ma.created_at)
      from public.moderation_actions ma
      left join public.ise_profiles mp on mp.id = ma.moderator_profile_id
      where ma.report_id = rp.id
    ), '[]'::jsonb)
  )
    into v_out
  from public.reports rp
  join public.report_reasons rr on rr.code = rp.reason_code
  left join public.ise_profiles rep on rep.id = rp.reporter_profile_id
  left join public.ise_profiles own on own.id = rp.target_owner_profile_id
  left join public.ise_profiles rev on rev.id = rp.reviewer_profile_id
  where rp.id = p_report_id;

  if v_out is null then
    raise exception 'report_not_found' using errcode = 'P0002';
  end if;
  return v_out;
end
$$;

revoke all on function public.admin_get_report(uuid) from public, anon;
grant execute on function public.admin_get_report(uuid) to authenticated;

comment on function public.admin_get_report(uuid) is
  'SA-018/SA-039. Dossier complet d''un signalement : preuves, journal de transitions, actions prises. Exige profiles.moderate.';


-- ---------------------------------------------------------------------
-- 17. transition_report — REMPLACEMENT (audit ajoute, D-30/§38)
--     Machine d'etats et corps de 0016 conserves a l'identique.
-- ---------------------------------------------------------------------
create or replace function public.transition_report(
  p_report_id       uuid,
  p_to_status       text,
  p_resolution_code text default null,
  p_note            text default null
)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := private.current_profile_id();
  v_report  public.reports;
  v_from    text;
  v_allowed boolean := false;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not private.has_permission('profiles.moderate') then
    perform private.log_audit(
      p_action      => 'moderation.report_transitioned',
      p_object_type => 'report',
      p_object_id   => p_report_id::text,
      p_result      => 'denied',
      p_error_code  => '42501'
    );
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select * into v_report from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'report_not_found' using errcode = 'P0002';
  end if;

  -- Machine d'etats imposee : open -> reviewing -> resolved | dismissed.
  v_allowed := case
    when p_to_status = 'reviewing' then v_report.status = 'open'
    when p_to_status = 'resolved'  then v_report.status = 'reviewing'
    when p_to_status = 'dismissed' then v_report.status in ('open', 'reviewing')
    else false
  end;

  if not v_allowed then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  if p_to_status = 'resolved' and p_resolution_code is null then
    raise exception 'resolution_required' using errcode = 'P0001';
  end if;

  v_from := v_report.status;

  update public.reports
     set status            = p_to_status,
         reviewer_profile_id = coalesce(reviewer_profile_id, v_me),
         reviewing_at      = case when p_to_status = 'reviewing' then now() else reviewing_at end,
         closed_at         = case when p_to_status in ('resolved', 'dismissed') then now() else closed_at end,
         resolution_code   = case when p_to_status = 'resolved'  then p_resolution_code
                                  when p_to_status = 'dismissed' then coalesce(p_resolution_code, 'no_violation')
                                  else resolution_code end,
         resolution_note   = coalesce(p_note, resolution_note)
   where id = p_report_id
  returning * into v_report;

  insert into public.report_events (report_id, actor_profile_id, from_status, to_status, note)
  values (p_report_id, v_me, v_from, p_to_status, p_note);

  perform private.log_audit(
    p_action      => 'moderation.report_transitioned',
    p_object_type => 'report',
    p_object_id   => p_report_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object(
      'from_status',     v_from,
      'to_status',       p_to_status,
      'resolution_code', v_report.resolution_code
    )
  );

  return v_report;
end
$$;

revoke all on function public.transition_report(uuid, text, text, text) from public, anon;
grant execute on function public.transition_report(uuid, text, text, text) to authenticated;

comment on function public.transition_report(uuid, text, text, text) is
  'Transition atomique d''un signalement : open -> reviewing -> resolved | dismissed. Exige profiles.moderate. Journalisee dans private.audit_log (0076), y compris en refus.';


-- ---------------------------------------------------------------------
-- 18. SA-018 / SA-039 — Enregistrer une action de moderation
--
-- L''action a un EFFET REEL : une suspension suspend le profil, une
-- levee le retablit, un avertissement notifie le membre. Enregistrer
-- une sanction sans l''appliquer serait un etat invente (§27, §113).
-- ---------------------------------------------------------------------
create or replace function public.admin_record_moderation_action(
  p_action_type       text,
  p_reason            text,
  p_report_id         uuid default null,
  p_target_profile_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me     uuid := private.current_profile_id();
  v_report public.reports;
  v_target_type text;
  v_target_id   uuid;
  v_target_profile uuid;
  v_action_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('profiles.moderate') then
    perform private.log_audit(
      p_action      => 'moderation.action_recorded',
      p_object_type => 'moderation_action',
      p_object_id   => coalesce(p_report_id::text, p_target_profile_id::text),
      p_result      => 'denied',
      p_error_code  => '42501'
    );
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_action_type not in ('warn', 'account_suspension', 'lift_suspension', 'escalate') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  if p_report_id is not null then
    select * into v_report from public.reports where id = p_report_id for update;
    if not found then
      raise exception 'report_not_found' using errcode = 'P0002';
    end if;
    v_target_type    := v_report.target_type;
    v_target_id      := v_report.target_id;
    v_target_profile := coalesce(p_target_profile_id, v_report.target_owner_profile_id,
                                 case when v_report.target_type = 'profile' then v_report.target_id end);
  else
    if p_target_profile_id is null then
      raise exception 'validation_failed' using errcode = 'P0001';
    end if;
    v_target_type    := 'profile';
    v_target_id      := p_target_profile_id;
    v_target_profile := p_target_profile_id;
  end if;

  if p_action_type in ('warn', 'account_suspension', 'lift_suspension') then
    if v_target_profile is null then
      -- Sans membre identifie, la sanction n'a pas de destinataire reel.
      raise exception 'target_profile_required' using errcode = 'P0001';
    end if;
    if v_target_profile = v_me then
      raise exception 'cannot_target_self' using errcode = 'P0001';
    end if;
    perform 1 from public.ise_profiles p
     where p.id = v_target_profile and p.deleted_at is null for update;
    if not found then
      raise exception 'profile_not_found' using errcode = 'P0002';
    end if;
  end if;

  -- Effet reel de l'action.
  if p_action_type = 'account_suspension' then
    update public.ise_profiles
       set profile_status = 'suspended'
     where id = v_target_profile and profile_status in ('referenced', 'active');
    if not found then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
  elsif p_action_type = 'lift_suspension' then
    update public.ise_profiles
       set profile_status = case when user_id is not null then 'active' else 'referenced' end
     where id = v_target_profile and profile_status = 'suspended';
    if not found then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
  elsif p_action_type = 'warn' then
    if exists (select 1 from public.notification_types t
               where t.code = 'moderation_warning' and t.is_active) then
      insert into public.notifications
        (profile_id, notification_type_code, category, priority, title, body,
         entity_type, entity_id, action_type, action_path, deduplication_key)
      values
        (v_target_profile, 'moderation_warning', 'system', 'action_required',
         'Un rappel des règles d''usage vous a été adressé.',
         'La modération vous adresse un rappel formel des règles d''usage du réseau.',
         null, null, 'open', '/aide',
         'moderation_warning:' || coalesce(p_report_id::text, gen_random_uuid()::text))
      on conflict do nothing;
    end if;
  end if;

  insert into public.moderation_actions
    (report_id, moderator_profile_id, action_type, target_type, target_id,
     target_profile_id, reason)
  values
    (p_report_id, v_me, p_action_type, v_target_type, v_target_id,
     v_target_profile, btrim(p_reason))
  returning id into v_action_id;

  perform private.log_audit(
    p_action      => 'moderation.action_recorded',
    p_object_type => 'moderation_action',
    p_object_id   => v_action_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object(
      'action_type',       p_action_type,
      'report_id',         p_report_id,
      'target_profile_id', v_target_profile,
      'reason',            btrim(p_reason)
    )
  );

  return jsonb_build_object('action_id', v_action_id, 'action_type', p_action_type);
end
$$;

revoke all on function public.admin_record_moderation_action(text, text, uuid, uuid) from public, anon;
grant execute on function public.admin_record_moderation_action(text, text, uuid, uuid) to authenticated;

comment on function public.admin_record_moderation_action(text, text, uuid, uuid) is
  'SA-018/SA-039. Action de moderation a effet reel (avertir, suspendre, lever, escalader), motif obligatoire, journalisee. Exige profiles.moderate.';


-- ---------------------------------------------------------------------
-- 19. SA-038 — File des tickets support pour les agents
-- ---------------------------------------------------------------------
create or replace function public.admin_list_support_tickets(
  p_status text    default null,
  p_cursor text    default null,
  p_limit  integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit  integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  v_cur_ts timestamptz;
  v_cur_id uuid;
  v_rows   jsonb;
  v_next   text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('support.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_status is not null and p_status not in
     ('open', 'in_progress', 'waiting_user', 'resolved', 'closed') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  if p_cursor is not null then
    begin
      v_cur_ts := split_part(p_cursor, '|', 1)::timestamptz;
      v_cur_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then
      raise exception 'validation_failed' using errcode = 'P0001';
    end;
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) - 'cur' order by r.created_at desc, r.ticket_id desc), '[]'::jsonb),
         case when count(*) = v_limit
              then max(r.cur) filter (where r.rn = v_limit) end
    into v_rows, v_next
  from (
    select
      t.id as ticket_id,
      t.reference_code,
      t.subject,
      t.category_code,
      sc.name as category_name,
      t.status,
      t.urgency,
      t.reopened_count,
      req.display_name as requester_name,
      agt.display_name as assignee_name,
      (select count(*) from public.support_messages m where m.ticket_id = t.id) as message_count,
      t.created_at,
      t.updated_at,
      t.created_at::text || '|' || t.id::text as cur,
      row_number() over (order by t.created_at desc, t.id desc) as rn
    from public.support_tickets t
    join public.support_categories sc on sc.code = t.category_code
    left join public.ise_profiles req on req.id = t.requester_profile_id
    left join public.ise_profiles agt on agt.id = t.assigned_agent_profile_id
    where ((p_status is not null and t.status = p_status)
       or (p_status is null and t.status in ('open', 'in_progress', 'waiting_user')))
      and (v_cur_ts is null or (t.created_at, t.id) < (v_cur_ts, v_cur_id))
    order by t.created_at desc, t.id desc
    limit v_limit
  ) r;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$$;

revoke all on function public.admin_list_support_tickets(text, text, integer) from public, anon;
grant execute on function public.admin_list_support_tickets(text, text, integer) to authenticated;

comment on function public.admin_list_support_tickets(text, text, integer) is
  'SA-038. File des tickets support (defaut : open + in_progress + waiting_user), curseur keyset. Exige support.manage. Aucun SLA (D-85).';


-- ---------------------------------------------------------------------
-- 20. SA-039 — Detail agent d'un ticket (notes internes comprises)
-- ---------------------------------------------------------------------
create or replace function public.admin_get_support_ticket(p_ticket_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_out jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('support.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'ticket', jsonb_build_object(
      'ticket_id',       t.id,
      'reference_code',  t.reference_code,
      'subject',         t.subject,
      'description',     t.description,
      'category_code',   t.category_code,
      'category_name',   sc.name,
      'status',          t.status,
      'urgency',         t.urgency,
      'reopened_count',  t.reopened_count,
      'correlation_id',  t.correlation_id,
      'technical_context', t.technical_context,
      'requester_profile_id', t.requester_profile_id,
      'requester_name',  req.display_name,
      'assignee_profile_id', t.assigned_agent_profile_id,
      'assignee_name',   agt.display_name,
      'created_at',      t.created_at,
      'resolved_at',     t.resolved_at,
      'closed_at',       t.closed_at
    ),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'message_id',       m.id,
        'author_kind',      m.author_kind,
        'author_name',      ap.display_name,
        'body',             m.body,
        'is_internal_note', m.is_internal_note,
        'created_at',       m.created_at
      ) order by m.created_at)
      from public.support_messages m
      left join public.ise_profiles ap on ap.id = m.author_profile_id
      where m.ticket_id = t.id
    ), '[]'::jsonb)
  )
    into v_out
  from public.support_tickets t
  join public.support_categories sc on sc.code = t.category_code
  left join public.ise_profiles req on req.id = t.requester_profile_id
  left join public.ise_profiles agt on agt.id = t.assigned_agent_profile_id
  where t.id = p_ticket_id;

  if v_out is null then
    raise exception 'ticket_not_found' using errcode = 'P0002';
  end if;
  return v_out;
end
$$;

revoke all on function public.admin_get_support_ticket(uuid) from public, anon;
grant execute on function public.admin_get_support_ticket(uuid) to authenticated;

comment on function public.admin_get_support_ticket(uuid) is
  'SA-039. Vue agent d''un ticket : fil complet, notes internes comprises. Exige support.manage — le demandeur passe par get_support_ticket (0053), qui les exclut.';


-- ---------------------------------------------------------------------
-- 21. SA-039 — Reponse d'agent (publique ou note interne)
-- ---------------------------------------------------------------------
create or replace function public.admin_reply_support_ticket(
  p_ticket_id   uuid,
  p_body        text,
  p_is_internal boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me   uuid := private.current_profile_id();
  v_t    public.support_tickets;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('support.manage') then
    perform private.log_audit(
      p_action      => 'support.agent_replied',
      p_object_type => 'support_ticket',
      p_object_id   => p_ticket_id::text,
      p_result      => 'denied',
      p_error_code  => '42501'
    );
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if length(v_body) = 0 or length(v_body) > 5000 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select * into v_t from public.support_tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'ticket_not_found' using errcode = 'P0002';
  end if;
  if v_t.status = 'closed' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  insert into public.support_messages
    (ticket_id, author_kind, author_profile_id, body, is_internal_note)
  values
    (p_ticket_id, 'agent', v_me, v_body, coalesce(p_is_internal, false));

  if not coalesce(p_is_internal, false)
     and exists (select 1 from public.notification_types nt
                 where nt.code = 'support_agent_replied' and nt.is_active) then
    insert into public.notifications
      (profile_id, notification_type_code, category, priority, title, body,
       entity_type, entity_id, action_type, action_path, deduplication_key)
    values
      (v_t.requester_profile_id, 'support_agent_replied', 'system', 'relevant',
       'L''équipe support vous a répondu.',
       'Demande ' || v_t.reference_code || ' — ' || v_t.subject,
       'support_ticket', v_t.id, 'open',
       '/aide/demandes/' || v_t.id::text,
       'support_agent_replied:' || v_t.id::text || ':' || extract(epoch from clock_timestamp())::bigint::text)
    on conflict do nothing;
  end if;

  perform private.log_audit(
    p_action      => 'support.agent_replied',
    p_object_type => 'support_ticket',
    p_object_id   => p_ticket_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object('is_internal_note', coalesce(p_is_internal, false))
  );

  return jsonb_build_object('replied', true, 'is_internal_note', coalesce(p_is_internal, false));
end
$$;

revoke all on function public.admin_reply_support_ticket(uuid, text, boolean) from public, anon;
grant execute on function public.admin_reply_support_ticket(uuid, text, boolean) to authenticated;

comment on function public.admin_reply_support_ticket(uuid, text, boolean) is
  'SA-039. Reponse d''agent : publique (notifie le demandeur) ou note interne (jamais visible du demandeur, RLS 0049 + get_support_ticket 0053). Exige support.manage, journalisee.';


-- ---------------------------------------------------------------------
-- 22. SA-039 — Assignation d'un ticket
-- ---------------------------------------------------------------------
create or replace function public.admin_assign_support_ticket(
  p_ticket_id        uuid,
  p_agent_profile_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me    uuid := private.current_profile_id();
  v_agent uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('support.manage') then
    perform private.log_audit(
      p_action      => 'support.ticket_assigned',
      p_object_type => 'support_ticket',
      p_object_id   => p_ticket_id::text,
      p_result      => 'denied',
      p_error_code  => '42501'
    );
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  v_agent := coalesce(p_agent_profile_id, v_me);

  if not exists (select 1 from public.support_tickets where id = p_ticket_id) then
    raise exception 'ticket_not_found' using errcode = 'P0002';
  end if;

  update public.support_tickets
     set assigned_agent_profile_id = v_agent
   where id = p_ticket_id;

  perform private.log_audit(
    p_action      => 'support.ticket_assigned',
    p_object_type => 'support_ticket',
    p_object_id   => p_ticket_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object('agent_profile_id', v_agent)
  );

  return jsonb_build_object('ticket_id', p_ticket_id, 'assignee_profile_id', v_agent);
end
$$;

revoke all on function public.admin_assign_support_ticket(uuid, uuid) from public, anon;
grant execute on function public.admin_assign_support_ticket(uuid, uuid) to authenticated;

comment on function public.admin_assign_support_ticket(uuid, uuid) is
  'SA-039. Assigne un ticket a un agent (soi-meme par defaut). Exige support.manage, journalisee.';


-- ---------------------------------------------------------------------
-- 23. transition_support_ticket — REMPLACEMENT (audit + notifications)
--     Machine d'etats de 0016 conservee a l'identique. Ajouts :
--     journalisation d'audit, et notification reelle au demandeur
--     lorsque l'AGENT passe le ticket en waiting_user ou resolved
--     (types du catalogue 0015, deja prevus pour ces evenements).
-- ---------------------------------------------------------------------
create or replace function public.transition_support_ticket(
  p_ticket_id uuid,
  p_to_status text
)
returns public.support_tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := private.current_profile_id();
  v_ticket  public.support_tickets;
  v_is_agent boolean;
  v_allowed boolean := false;
  v_from    text;
  v_notif   text;
  v_title   text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_ticket from public.support_tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'ticket_not_found' using errcode = 'P0002';
  end if;

  v_is_agent := private.has_permission('support.manage');

  if not v_is_agent and v_me <> v_ticket.requester_profile_id then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  -- open -> in_progress -> [waiting_user] -> resolved -> closed.
  -- Le membre peut uniquement rouvrir un ticket resolu et cloturer le sien.
  v_allowed := case
    when p_to_status = 'in_progress'  then v_is_agent and v_ticket.status in ('open', 'waiting_user', 'resolved')
    when p_to_status = 'waiting_user' then v_is_agent and v_ticket.status = 'in_progress'
    when p_to_status = 'resolved'     then v_is_agent and v_ticket.status in ('in_progress', 'waiting_user')
    when p_to_status = 'closed'       then v_ticket.status = 'resolved'
    when p_to_status = 'open'         then v_ticket.status = 'resolved' and v_me = v_ticket.requester_profile_id
    else false
  end;

  if not v_allowed then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  v_from := v_ticket.status;

  update public.support_tickets
     set status         = p_to_status,
         resolved_at    = case
                            when p_to_status in ('resolved', 'closed') then coalesce(resolved_at, now())
                            else null
                          end,
         closed_at      = case when p_to_status = 'closed' then now() else null end,
         reopened_count = case when p_to_status = 'open' then reopened_count + 1 else reopened_count end
   where id = p_ticket_id
  returning * into v_ticket;

  if v_is_agent and v_me <> v_ticket.requester_profile_id then
    v_notif := case p_to_status
      when 'waiting_user' then 'support_information_requested'
      when 'resolved'     then 'support_ticket_resolved'
    end;
    v_title := case p_to_status
      when 'waiting_user' then 'L''équipe support vous demande une information complémentaire.'
      when 'resolved'     then 'Votre demande a été résolue.'
    end;
    if v_notif is not null and exists (
      select 1 from public.notification_types nt where nt.code = v_notif and nt.is_active) then
      insert into public.notifications
        (profile_id, notification_type_code, category,
         priority, title, body, entity_type, entity_id, action_type, action_path,
         deduplication_key)
      values
        (v_ticket.requester_profile_id, v_notif, 'system',
         case when v_notif = 'support_information_requested' then 'action_required' else 'info' end,
         v_title,
         'Demande ' || v_ticket.reference_code || ' — ' || v_ticket.subject,
         'support_ticket', v_ticket.id, 'open',
         '/aide/demandes/' || v_ticket.id::text,
         'support_transition:' || v_ticket.id::text || ':' || p_to_status || ':'
           || extract(epoch from clock_timestamp())::bigint::text)
      on conflict do nothing;
    end if;
  end if;

  perform private.log_audit(
    p_action      => 'support.ticket_transitioned',
    p_object_type => 'support_ticket',
    p_object_id   => p_ticket_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object(
      'from_status', v_from,
      'to_status',   p_to_status,
      'by_agent',    v_is_agent
    )
  );

  return v_ticket;
end
$$;

revoke all on function public.transition_support_ticket(uuid, text) from public, anon;
grant execute on function public.transition_support_ticket(uuid, text) to authenticated;

comment on function public.transition_support_ticket(uuid, text) is
  'Transition atomique d''un ticket support. Aucun delai cible (D-85). Journalisee (0076) ; notifie le demandeur quand l''agent demande une information ou resout.';


-- ---------------------------------------------------------------------
-- 24. Recherche de profils pour les ecrans d'administration
--     (rattacher un membre manquant, nommer un delegue) : reutilise la
--     projection minimale de admin_list_profiles ; rien de plus a creer.
-- ---------------------------------------------------------------------
