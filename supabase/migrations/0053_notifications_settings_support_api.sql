-- =====================================================================
-- 0053_notifications_settings_support_api
--
-- Suite de 0052. Meme cadre : toutes les fonctions sont SECURITY DEFINER
-- et REVERIFIENT l'appartenance, la RLS ne s'appliquant pas a l'interieur
-- d'une fonction definer.
--
--   PARTIE 4 — ISE-098 Centre de notifications (D-81 : « Action requise »
--              est une PRIORITE, pas une categorie ; aucun compteur
--              fictif, tout vient de public.notifications)
--   PARTIE 5 — ISE-099 Parametres, confidentialite, preferences
--              (D-73/D-74 visibilite par champ et `allowed_levels`,
--               D-80 preferences par type, SYS-008 suppression du
--               compte conforme a D-19, SYS-009 consentements)
--   PARTIE 6 — ISE-100 Aide & Support (D-85 : aucun SLA ; D-66 : motifs
--              de signalement filtres par type d'objet)
-- =====================================================================


-- =====================================================================
-- PARTIE 4 — ISE-098 CENTRE DE NOTIFICATIONS
--
-- « Action requise » est une PRIORITE (D-81) : `p_scope` et `p_category`
-- sont donc deux filtres distincts, jamais confondus.
-- Aucun compteur n'est fabrique : tout est compte dans
-- `public.notifications`.
-- =====================================================================

create or replace function public.list_my_notifications(
  p_scope    text default 'all',
  p_category text default null,
  p_cursor   text default null,
  p_limit    integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me    uuid := private.current_profile_id();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_scope text := coalesce(p_scope, 'all');
  v_c_at  timestamptz;
  v_c_id  uuid;
  v_rows  jsonb;
  v_next  text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_scope not in ('all', 'action_required', 'unread', 'archived') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_category is not null and not exists (
       select 1 from public.notification_types t where t.category = p_category) then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

  with page as (
    select n.*
      from public.notifications n
     where n.profile_id = v_me
       and (case v_scope
              when 'archived'        then n.archived_at is not null
              when 'unread'          then n.archived_at is null and n.read_at is null
              when 'action_required' then n.archived_at is null
                                      and n.priority in ('critical', 'action_required')
              else                        n.archived_at is null
            end)
       and (p_category is null or n.category = p_category)
       and (v_c_at is null or (n.created_at, n.id) < (v_c_at, v_c_id))
     order by n.created_at desc, n.id desc
     limit v_limit + 1
  ),
  kept as (
    select * from page order by created_at desc, id desc limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'notification_id', k.id,
           'type_code',       k.notification_type_code,
           'category',        k.category,
           'priority',        k.priority,
           'title',           k.title,
           'body',            k.body,
           'reason_code',     k.reason_code,
           'reason_text',     k.reason_text,
           'entity_type',     k.entity_type,
           'entity_id',       k.entity_id,
           'action_type',     k.action_type,
           'action_path',     k.action_path,
           'action_label',    (select t.default_action_label
                                 from public.notification_types t
                                where t.code = k.notification_type_code),
           'group_count',     k.group_count,
           'read',            (k.read_at is not null),
           'archived',        (k.archived_at is not null),
           'expired',         (k.expires_at is not null and k.expires_at <= now()),
           'created_at',      k.created_at)
           order by k.created_at desc, k.id desc), '[]'::jsonb),
         case when (select count(*) from page) > v_limit
              then (array_agg(private.encode_keyset_cursor(k.created_at, k.id)
                                  order by k.created_at asc, k.id asc))[1]
              else null end
    into v_rows, v_next
  from kept k;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$$;
revoke all on function public.list_my_notifications(text, text, text, integer) from public;
grant execute on function public.list_my_notifications(text, text, text, integer) to authenticated;
comment on function public.list_my_notifications(text, text, text, integer) is
  'ISE-098 — liste paginee par curseur. `action_required` est un filtre de PRIORITE, pas de categorie (D-81).';


create or replace function public.my_notification_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'unread', (select count(*) from public.notifications n
                where n.profile_id = v_me and n.read_at is null and n.archived_at is null),
    'action_required', (select count(*) from public.notifications n
                         where n.profile_id = v_me and n.archived_at is null
                           and n.read_at is null
                           and n.priority in ('critical', 'action_required')),
    'read_not_archived', (select count(*) from public.notifications n
                           where n.profile_id = v_me and n.archived_at is null
                             and n.read_at is not null),
    'total', (select count(*) from public.notifications n
               where n.profile_id = v_me and n.archived_at is null),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object('category', x.category,
                                          'total',    x.total,
                                          'unread',   x.unread)
                       order by x.total desc, x.category)
        from (select n.category,
                     count(*) as total,
                     count(*) filter (where n.read_at is null) as unread
                from public.notifications n
               where n.profile_id = v_me and n.archived_at is null
               group by n.category) x), '[]'::jsonb),
    'by_priority', coalesce((
      select jsonb_agg(jsonb_build_object('priority', x.priority, 'total', x.total)
                       order by x.total desc, x.priority)
        from (select n.priority, count(*) as total
                from public.notifications n
               where n.profile_id = v_me and n.archived_at is null
               group by n.priority) x), '[]'::jsonb),
    'unread_messages', (select coalesce(sum(cp.unread_count), 0)
                          from public.conversation_participants cp
                         where cp.profile_id = v_me
                           and cp.membership_status = 'active'
                           and cp.archived_at is null));
end
$$;
revoke all on function public.my_notification_summary() from public;
grant execute on function public.my_notification_summary() to authenticated;
comment on function public.my_notification_summary() is
  'ISE-098 — compteurs REELS issus de public.notifications. Aucun chiffre estime ni arrondi (MASTER PROMPT §98).';


create or replace function public.set_notification_read(
  p_notification_id uuid,
  p_read boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  update public.notifications
     set read_at = case when p_read then coalesce(read_at, now()) else null end
   where id = p_notification_id and profile_id = v_me;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object('read', p_read);
end
$$;
revoke all on function public.set_notification_read(uuid, boolean) from public;
grant execute on function public.set_notification_read(uuid, boolean) to authenticated;


create or replace function public.mark_all_notifications_read()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_n  bigint;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  with updated as (
    update public.notifications
       set read_at = now()
     where profile_id = v_me and read_at is null and archived_at is null
     returning 1)
  select count(*) into v_n from updated;

  return jsonb_build_object('marked', v_n);
end
$$;
revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated;


create or replace function public.archive_read_notifications()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_n  bigint;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  with updated as (
    update public.notifications
       set archived_at = now()
     where profile_id = v_me and read_at is not null and archived_at is null
     returning 1)
  select count(*) into v_n from updated;

  return jsonb_build_object('archived', v_n);
end
$$;
revoke all on function public.archive_read_notifications() from public;
grant execute on function public.archive_read_notifications() to authenticated;


-- =====================================================================
-- PARTIE 5 — ISE-099 PARAMETRES, CONFIDENTIALITE ET PREFERENCES
-- =====================================================================

-- ---------------------------------------------------------------------
-- Reglages transverses. L'absence de ligne `user_settings` n'est pas une
-- erreur : les valeurs par defaut de la table font foi tant que le
-- membre n'a rien change.
-- ---------------------------------------------------------------------
create or replace function public.get_my_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_s  public.user_settings;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_s from public.user_settings where profile_id = v_me;

  return jsonb_build_object(
    'has_row',                  found,
    'interface_language',       coalesce(v_s.interface_language, 'fr'),
    'timezone',                 coalesce(v_s.timezone, 'UTC'),
    'notification_preset',      coalesce(v_s.notification_preset, 'recommended'),
    'email_digest_frequency',   coalesce(v_s.email_digest_frequency, 'weekly'),
    'direct_message_policy',    coalesce(v_s.direct_message_policy, 'connections'),
    'show_read_receipts',       coalesce(v_s.show_read_receipts, true),
    'appear_in_matching',       coalesce(v_s.appear_in_matching, true),
    'appear_in_attendee_lists', coalesce(v_s.appear_in_attendee_lists, false),
    'allow_public_profile',     coalesce(v_s.allow_public_profile, false),
    'is_paused',                coalesce(v_s.is_paused, false),
    'paused_at',                v_s.paused_at,
    'pause_reason',             v_s.pause_reason,
    'deletion_requested_at',    v_s.deletion_requested_at);
end
$$;
revoke all on function public.get_my_settings() from public;
grant execute on function public.get_my_settings() to authenticated;


create or replace function public.update_my_settings(
  p_direct_message_policy    text default null,
  p_show_read_receipts       boolean default null,
  p_appear_in_matching       boolean default null,
  p_appear_in_attendee_lists boolean default null,
  p_email_digest_frequency   text default null,
  p_notification_preset      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_direct_message_policy is not null
     and p_direct_message_policy not in ('members', 'connections', 'none') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_email_digest_frequency is not null
     and p_email_digest_frequency not in ('daily', 'weekly', 'off') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_notification_preset is not null
     and p_notification_preset not in ('recommended', 'minimal', 'all', 'custom') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  insert into public.user_settings (profile_id) values (v_me)
  on conflict (profile_id) do nothing;

  update public.user_settings
     set direct_message_policy    = coalesce(p_direct_message_policy, direct_message_policy),
         show_read_receipts       = coalesce(p_show_read_receipts, show_read_receipts),
         appear_in_matching       = coalesce(p_appear_in_matching, appear_in_matching),
         appear_in_attendee_lists = coalesce(p_appear_in_attendee_lists, appear_in_attendee_lists),
         email_digest_frequency   = coalesce(p_email_digest_frequency, email_digest_frequency),
         notification_preset      = coalesce(p_notification_preset, notification_preset)
   where profile_id = v_me;

  return public.get_my_settings();
end
$$;
revoke all on function public.update_my_settings(text, boolean, boolean, boolean, text, text) from public;
grant execute on function public.update_my_settings(text, boolean, boolean, boolean, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- Visibilite par champ (D-73, D-74). Les niveaux proposes sont ceux de
-- `allowed_levels` : le formulaire n'invente aucun niveau, et la base
-- refuse celui qui n'y figure pas.
-- ---------------------------------------------------------------------
create or replace function public.list_my_field_visibility()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'field_key',      d.field_key,
             'label',          d.label,
             'default_level',  d.default_visibility,
             'allowed_levels', to_jsonb(d.allowed_levels),
             'level',          coalesce(v.visibility, d.default_visibility),
             'is_default',     (v.visibility is null),
             'sort_order',     d.sort_order)
             order by d.sort_order)
      from public.profile_visibility_defaults d
      left join public.profile_visibility v
             on v.profile_id = v_me and v.field_key = d.field_key), '[]'::jsonb);
end
$$;
revoke all on function public.list_my_field_visibility() from public;
grant execute on function public.list_my_field_visibility() to authenticated;
comment on function public.list_my_field_visibility() is
  'ISE-099 — visibilite par champ. Renvoie la valeur courante, le defaut du referentiel et les seuls niveaux autorises (D-73, D-74).';


create or replace function public.set_field_visibility(
  p_field_key  text,
  p_visibility text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := private.current_profile_id();
  v_allowed text[];
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select d.allowed_levels into v_allowed
    from public.profile_visibility_defaults d
   where d.field_key = p_field_key;

  if v_allowed is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_visibility is null or not (p_visibility = any (v_allowed)) then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  insert into public.profile_visibility (profile_id, field_key, visibility)
  values (v_me, p_field_key, p_visibility)
  on conflict (profile_id, field_key) do update set visibility = excluded.visibility;

  return jsonb_build_object('field_key', p_field_key, 'level', p_visibility);
end
$$;
revoke all on function public.set_field_visibility(text, text) from public;
grant execute on function public.set_field_visibility(text, text) to authenticated;
comment on function public.set_field_visibility(text, text) is
  'ISE-099 — ecrit la visibilite d''un champ. Un niveau hors `allowed_levels` est refuse en base, pas seulement dans le formulaire (CA-SET-01).';


-- ---------------------------------------------------------------------
-- Preferences de notification par TYPE (D-80). Absence de ligne =
-- valeurs du catalogue : la fonction resout, elle n'invente pas.
-- ---------------------------------------------------------------------
create or replace function public.list_my_notification_preferences()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'type_code',        t.code,
             'category',         t.category,
             'label',            t.label,
             'description',      t.description,
             'default_priority', t.default_priority,
             'configurable',     t.is_user_configurable,
             'email_allowed',    t.is_email_allowed,
             'push_allowed',     t.is_push_allowed,
             'default_in_app',   t.default_in_app,
             'default_email_mode', t.default_email_mode,
             'default_push',     t.default_push,
             'in_app',           coalesce(p.in_app_enabled, t.default_in_app),
             'email_mode',       coalesce(p.email_mode, t.default_email_mode),
             'push',             coalesce(p.push_enabled, t.default_push),
             'is_default',       (p.profile_id is null),
             'sort_order',       t.sort_order)
             order by t.sort_order, t.code)
      from public.notification_types t
      left join public.notification_preferences p
             on p.profile_id = v_me and p.notification_type_code = t.code
     where t.is_active), '[]'::jsonb);
end
$$;
revoke all on function public.list_my_notification_preferences() from public;
grant execute on function public.list_my_notification_preferences() to authenticated;
comment on function public.list_my_notification_preferences() is
  'ISE-099 — 33 types seedes en 0015, resolus avec les valeurs par defaut du catalogue (D-80).';


create or replace function public.set_notification_preference(
  p_type_code  text,
  p_in_app     boolean default null,
  p_email_mode text default null,
  p_push       boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_t  public.notification_types;
  v_in boolean;
  v_em text;
  v_pu boolean;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_t from public.notification_types where code = p_type_code and is_active;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not v_t.is_user_configurable then
    -- Securite du compte, annulation d'evenement : ces types ne se coupent pas.
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_email_mode is not null
     and p_email_mode not in ('immediate', 'daily_digest', 'weekly_digest', 'off') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_email_mode is not null and p_email_mode <> 'off' and not v_t.is_email_allowed then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if coalesce(p_push, false) and not v_t.is_push_allowed then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select coalesce(p_in_app, p.in_app_enabled, v_t.default_in_app),
         coalesce(p_email_mode, p.email_mode, v_t.default_email_mode),
         coalesce(p_push, p.push_enabled, v_t.default_push)
    into v_in, v_em, v_pu
    from (select 1) dummy
    left join public.notification_preferences p
           on p.profile_id = v_me and p.notification_type_code = p_type_code;

  insert into public.notification_preferences
    (profile_id, notification_type_code, in_app_enabled, email_mode, push_enabled)
  values (v_me, p_type_code, v_in, v_em, v_pu)
  on conflict (profile_id, notification_type_code) do update
     set in_app_enabled = excluded.in_app_enabled,
         email_mode     = excluded.email_mode,
         push_enabled   = excluded.push_enabled;

  -- Toute modification fine sort des presets documentes (DIGEST E2 §C.4).
  insert into public.user_settings (profile_id, notification_preset)
  values (v_me, 'custom')
  on conflict (profile_id) do update set notification_preset = 'custom';

  return jsonb_build_object('type_code', p_type_code,
                            'in_app', v_in, 'email_mode', v_em, 'push', v_pu);
end
$$;
revoke all on function public.set_notification_preference(text, boolean, text, boolean) from public;
grant execute on function public.set_notification_preference(text, boolean, text, boolean) to authenticated;
comment on function public.set_notification_preference(text, boolean, text, boolean) is
  'ISE-099 — le catalogue borde les canaux : aucune push sur un type qui l''interdit, aucun e-mail sur un type qui l''interdit (D-80).';


-- ---------------------------------------------------------------------
-- Consentements et conditions acceptees — APPEND-ONLY (0048).
-- ---------------------------------------------------------------------
create or replace function public.list_my_consents()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'consents', coalesce((
      select jsonb_agg(jsonb_build_object(
               'consent_type', x.consent_type,
               'version',      x.version,
               'granted',      x.is_granted,
               'granted_at',   x.granted_at,
               'revoked_at',   x.revoked_at,
               'recorded_at',  x.created_at,
               'source',       x.source)
               order by x.consent_type)
        from (select distinct on (c.consent_type) c.*
                from public.consent_records c
               where c.profile_id = v_me
               order by c.consent_type, c.created_at desc) x), '[]'::jsonb),
    'terms', coalesce((
      select jsonb_agg(jsonb_build_object(
               'document_type', y.document_type,
               'version',       y.version,
               'accepted_at',   y.accepted_at)
               order by y.document_type)
        from (select distinct on (t.document_type) t.*
                from public.terms_acceptances t
               where t.profile_id = v_me
               order by t.document_type, t.accepted_at desc) y), '[]'::jsonb));
end
$$;
revoke all on function public.list_my_consents() from public;
grant execute on function public.list_my_consents() to authenticated;


create or replace function public.record_consent(
  p_consent_type text,
  p_version      text,
  p_granted      boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_consent_type not in ('terms_of_service', 'privacy_policy', 'marketing_communication',
                            'testimonial_use', 'public_profile', 'data_processing') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if nullif(btrim(coalesce(p_version, '')), '') is null then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  insert into public.consent_records
    (profile_id, consent_type, version, is_granted, granted_at, revoked_at, source)
  values
    (v_me, p_consent_type, btrim(p_version), p_granted,
     case when p_granted then now() else null end,
     case when p_granted then null else now() end,
     'settings');

  return jsonb_build_object('consent_type', p_consent_type, 'granted', p_granted);
end
$$;
revoke all on function public.record_consent(text, text, boolean) from public;
grant execute on function public.record_consent(text, text, boolean) to authenticated;
comment on function public.record_consent(text, text, boolean) is
  'SYS-009 — une revocation est une NOUVELLE ligne : la trace precedente n''est jamais reecrite (0048).';


create or replace function public.accept_terms(p_document_type text, p_version text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_document_type not in ('terms_of_service', 'privacy_policy', 'code_of_conduct', 'cookie_policy') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  insert into public.terms_acceptances (profile_id, document_type, version)
  values (v_me, p_document_type, btrim(p_version))
  on conflict (profile_id, document_type, version) do nothing;

  return jsonb_build_object('document_type', p_document_type, 'version', p_version);
end
$$;
revoke all on function public.accept_terms(text, text) from public;
grant execute on function public.accept_terms(text, text) to authenticated;


-- ---------------------------------------------------------------------
-- Mise en pause du profil (desactivation TEMPORAIRE, DIGEST E2 §C.8).
-- Distincte de la suppression, qui est definitive.
-- ---------------------------------------------------------------------
create or replace function public.set_profile_paused(p_paused boolean, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.user_settings (profile_id) values (v_me)
  on conflict (profile_id) do nothing;

  update public.user_settings
     set is_paused    = p_paused,
         paused_at    = case when p_paused then now() else null end,
         pause_reason = case when p_paused then nullif(btrim(coalesce(p_reason, '')), '') else null end,
         appear_in_matching = case when p_paused then false else appear_in_matching end
   where profile_id = v_me;

  return public.get_my_settings();
end
$$;
revoke all on function public.set_profile_paused(boolean, text) from public;
grant execute on function public.set_profile_paused(boolean, text) to authenticated;


-- ---------------------------------------------------------------------
-- SYS-008 — SUPPRESSION DU COMPTE (D-19, MASTER PROMPT §7 et §48).
--
-- Ce que la fonction supprime : le COMPTE (`auth.users`), les donnees
-- strictement personnelles du compte (coordonnees privees, reglages,
-- preferences, jetons d'appareil, recherches enregistrees, roles).
-- Ce qu'elle NE supprime PAS : le PROFIL REFERENCE. `ise_profiles.user_id`
-- repasse a NULL par la cle etrangere `ON DELETE SET NULL`, le profil
-- redevient `referenced` / `unclaimed` et reste reclamable. C'est
-- exactement D-19 : « le profil reference subsiste ».
--
-- Les traces de consentement (`consent_records`, `terms_acceptances`)
-- sont conservees : ce sont des preuves append-only, elles ne se
-- reecrivent pas.
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := private.current_profile_id();
  v_user uuid := (select auth.uid());
begin
  if v_me is null or v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  -- Confirmation explicite, jamais implicite (MASTER PROMPT §48).
  if upper(btrim(coalesce(p_confirmation, ''))) <> 'SUPPRIMER' then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  perform private.log_audit(
    'account.deleted', 'ise_profile', v_me::text, 'success',
    jsonb_build_object('decision', 'compte supprime, profil reference conserve (D-19)'),
    null, v_me, null, 'user');

  update public.user_settings set deletion_requested_at = now() where profile_id = v_me;

  delete from private.profile_contacts    where profile_id = v_me;
  delete from public.device_tokens        where profile_id = v_me;
  delete from public.notification_preferences where profile_id = v_me;
  delete from public.notification_community_preferences where profile_id = v_me;
  delete from public.notifications        where profile_id = v_me;
  delete from public.saved_searches       where profile_id = v_me;
  delete from public.user_settings        where profile_id = v_me;
  delete from private.user_roles          where profile_id = v_me;

  -- Le profil redevient un profil reference non reclame.
  update public.ise_profiles
     set claim_status            = 'unclaimed',
         profile_status          = 'referenced',
         claimed_at              = null,
         onboarding_completed_at = null,
         verification_status     = 'unverified',
         verification_level      = null,
         verified_at             = null
   where id = v_me;

  -- `ise_profiles.user_id` -> NULL par ON DELETE SET NULL.
  delete from auth.users where id = v_user;

  return jsonb_build_object('deleted', true, 'profile_kept', true);
end
$$;
revoke all on function public.delete_my_account(text) from public;
grant execute on function public.delete_my_account(text) to authenticated;
comment on function public.delete_my_account(text) is
  'SYS-008 — supprime le COMPTE. Le profil ISE reference subsiste et redevient reclamable : ise_profiles.user_id repasse a NULL (D-19).';


-- =====================================================================
-- PARTIE 6 — ISE-100 AIDE & SUPPORT
--
-- D-85 : AUCUN delai cible n'est calcule ni renvoye. Aucune fonction de
-- cette partie n'expose de duree d'engagement — il n'en existe aucune
-- dans les documents, en inventer une serait un faux KPI.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Creation d'un ticket. L'urgence n'est PAS choisie par le demandeur
-- (0049) : elle reste `standard` / `system`, sauf requalification par un
-- agent. La notification « Votre demande a ete recue. » est emise ici :
-- `notifications` n'a aucune politique INSERT (0048), une notification
-- ne peut naitre que d'une fonction serveur.
-- ---------------------------------------------------------------------
create or replace function public.create_support_ticket(
  p_category_code     text,
  p_subject           text,
  p_description       text,
  p_technical_context jsonb default '{}'::jsonb,
  p_correlation_id    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := private.current_profile_id();
  v_ticket public.support_tickets;
  v_type   text := 'support_ticket_created';
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from public.support_categories c
                 where c.code = p_category_code and c.is_active) then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_subject, ''))) < 3
     or length(btrim(coalesce(p_subject, ''))) > 200
     or length(btrim(coalesce(p_description, ''))) < 10 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if not private.consume_rate_limit(v_me::text, 'support.ticket', 10, 86400) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.support_tickets
    (requester_profile_id, category_code, subject, description,
     technical_context, correlation_id)
  values
    (v_me, p_category_code, btrim(p_subject), btrim(p_description),
     coalesce(p_technical_context, '{}'::jsonb),
     nullif(btrim(coalesce(p_correlation_id, '')), ''))
  returning * into v_ticket;

  insert into public.support_messages (ticket_id, author_kind, author_profile_id, body)
  values (v_ticket.id, 'member', v_me, btrim(p_description));

  if exists (select 1 from public.notification_types t where t.code = v_type and t.is_active) then
    insert into public.notifications
      (profile_id, notification_type_code, category, priority, title, body,
       entity_type, entity_id, action_type, action_path, deduplication_key)
    values
      (v_me, v_type, 'system', 'info',
       'Votre demande a été reçue.',
       'Demande ' || v_ticket.reference_code || ' — ' || v_ticket.subject,
       'support_ticket', v_ticket.id, 'open',
       '/aide/demandes/' || v_ticket.id::text,
       'support_ticket_created:' || v_ticket.id::text)
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'ticket_id',      v_ticket.id,
    'reference_code', v_ticket.reference_code,
    'status',         v_ticket.status,
    'created_at',     v_ticket.created_at);
end
$$;
revoke all on function public.create_support_ticket(text, text, text, jsonb, text) from public;
grant execute on function public.create_support_ticket(text, text, text, jsonb, text) to authenticated;
comment on function public.create_support_ticket(text, text, text, jsonb, text) is
  'ISE-100 — creation d''un ticket. Aucun delai cible n''est pose ni renvoye (D-85). L''urgence reste `system` (0049).';


create or replace function public.list_my_support_tickets(
  p_cursor text default null,
  p_limit  integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me    uuid := private.current_profile_id();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_c_at  timestamptz;
  v_c_id  uuid;
  v_rows  jsonb;
  v_next  text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

  with page as (
    select t.*
      from public.support_tickets t
     where t.requester_profile_id = v_me
       and (v_c_at is null or (t.created_at, t.id) < (v_c_at, v_c_id))
     order by t.created_at desc, t.id desc
     limit v_limit + 1
  ),
  kept as (select * from page order by created_at desc, id desc limit v_limit)
  select coalesce(jsonb_agg(jsonb_build_object(
           'ticket_id',      k.id,
           'reference_code', k.reference_code,
           'subject',        k.subject,
           'category_code',  k.category_code,
           'category_name',  (select c.name from public.support_categories c
                               where c.code = k.category_code),
           'status',         k.status,
           'created_at',     k.created_at,
           'updated_at',     k.updated_at,
           'resolved_at',    k.resolved_at,
           'reopened_count', k.reopened_count,
           'message_count',  (select count(*) from public.support_messages m
                               where m.ticket_id = k.id and m.is_internal_note = false))
           order by k.created_at desc, k.id desc), '[]'::jsonb),
         case when (select count(*) from page) > v_limit
              then (array_agg(private.encode_keyset_cursor(k.created_at, k.id)
                                  order by k.created_at asc, k.id asc))[1]
              else null end
    into v_rows, v_next
  from kept k;

  return jsonb_build_object(
    'rows', v_rows,
    'next_cursor', v_next,
    'open_total', (select count(*) from public.support_tickets t
                    where t.requester_profile_id = v_me
                      and t.status in ('open', 'in_progress', 'waiting_user')));
end
$$;
revoke all on function public.list_my_support_tickets(text, integer) from public;
grant execute on function public.list_my_support_tickets(text, integer) to authenticated;


-- ---------------------------------------------------------------------
-- Detail d'un ticket. `is_internal_note = false` est filtre ICI parce
-- qu'une fonction SECURITY DEFINER ne passe pas par la RLS : la note
-- interne du support ne doit atteindre le demandeur en aucun cas.
-- ---------------------------------------------------------------------
create or replace function public.get_support_ticket(p_ticket_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me     uuid := private.current_profile_id();
  v_ticket public.support_tickets;
  v_agent  boolean;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_ticket from public.support_tickets where id = p_ticket_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  v_agent := private.has_permission('support.manage');
  if v_ticket.requester_profile_id <> v_me and not v_agent then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'ticket_id',      v_ticket.id,
    'reference_code', v_ticket.reference_code,
    'subject',        v_ticket.subject,
    'description',    v_ticket.description,
    'category_code',  v_ticket.category_code,
    'category_name',  (select c.name from public.support_categories c
                        where c.code = v_ticket.category_code),
    'status',         v_ticket.status,
    'created_at',     v_ticket.created_at,
    'updated_at',     v_ticket.updated_at,
    'resolved_at',    v_ticket.resolved_at,
    'closed_at',      v_ticket.closed_at,
    'reopened_count', v_ticket.reopened_count,
    'is_mine',        (v_ticket.requester_profile_id = v_me),
    'can_reply',      v_ticket.status in ('open', 'in_progress', 'waiting_user'),
    'can_close',      (v_ticket.status = 'resolved'),
    'can_reopen',     (v_ticket.status = 'resolved' and v_ticket.requester_profile_id = v_me),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
               'message_id',  m.id,
               'author_kind', m.author_kind,
               'from_me',     (m.author_profile_id is not null and m.author_profile_id = v_me),
               'body',        m.body,
               'created_at',  m.created_at)
               order by m.created_at, m.id)
        from public.support_messages m
       where m.ticket_id = p_ticket_id
         and (m.is_internal_note = false or v_agent)), '[]'::jsonb));
end
$$;
revoke all on function public.get_support_ticket(uuid) from public;
grant execute on function public.get_support_ticket(uuid) to authenticated;
comment on function public.get_support_ticket(uuid) is
  'ISE-100 — fil d''un ticket. Les notes internes sont filtrees explicitement : une fonction definer ne passe pas par la RLS (0049).';


create or replace function public.reply_to_support_ticket(p_ticket_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := private.current_profile_id();
  v_t    public.support_tickets;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if length(v_body) = 0 or length(v_body) > 5000 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select * into v_t from public.support_tickets where id = p_ticket_id;
  if not found or v_t.requester_profile_id <> v_me then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_t.status not in ('open', 'in_progress', 'waiting_user') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  insert into public.support_messages (ticket_id, author_kind, author_profile_id, body)
  values (p_ticket_id, 'member', v_me, v_body);

  return jsonb_build_object('replied', true);
end
$$;
revoke all on function public.reply_to_support_ticket(uuid, text) from public;
grant execute on function public.reply_to_support_ticket(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- Signalement d'un objet (D-66). Le motif doit s'appliquer au type
-- d'objet : la base refuse « Faux profil » sur un message.
-- ---------------------------------------------------------------------
create or replace function public.create_report(
  p_target_type text,
  p_target_id   uuid,
  p_reason_code text,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_id uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_active_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_target_type = 'profile' and p_target_id = v_me then
    raise exception 'cannot_target_self' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.report_reasons r
                 where r.code = p_reason_code and r.is_active
                   and p_target_type = any (r.applies_to)) then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.reports r
             where r.reporter_profile_id = v_me
               and r.target_type = p_target_type
               and r.target_id = p_target_id
               and r.status in ('open', 'reviewing')) then
    raise exception 'request_already_sent' using errcode = 'P0001';
  end if;
  if not private.consume_rate_limit(v_me::text, 'report.create', 10, 86400) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.reports
    (reporter_profile_id, target_type, target_id, reason_code, description)
  values
    (v_me, p_target_type, p_target_id, p_reason_code,
     nullif(btrim(coalesce(p_description, '')), ''))
  returning id into v_id;

  return jsonb_build_object('report_id', v_id, 'status', 'open');
end
$$;
revoke all on function public.create_report(text, uuid, text, text) from public;
grant execute on function public.create_report(text, uuid, text, text) to authenticated;
comment on function public.create_report(text, uuid, text, text) is
  'ISE-100 — signalement. Motifs issus du referentiel unique `report_reasons`, filtres par `applies_to` (D-66).';


create or replace function public.list_my_reports(p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'report_id',   r.id,
             'target_type', r.target_type,
             'reason_code', r.reason_code,
             'reason_name', (select rr.name from public.report_reasons rr
                              where rr.code = r.reason_code),
             'status',      r.status,
             'created_at',  r.created_at,
             'closed_at',   r.closed_at)
             order by r.created_at desc)
      from (select * from public.reports
             where reporter_profile_id = v_me
             order by created_at desc
             limit least(greatest(coalesce(p_limit, 20), 1), 50)) r), '[]'::jsonb);
end
$$;
revoke all on function public.list_my_reports(integer) from public;
grant execute on function public.list_my_reports(integer) to authenticated;
