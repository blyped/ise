-- =====================================================================
-- 0077_admin_moderation_roles_api
-- Complement du coeur du back-office Superadmin (0076) :
--   * SA-016 / SA-017 — file de moderation des APPELS au reseau
--     (liste, detail, decision motivee `moderate_network_call`) ;
--   * SA-019 / SA-020 — file de moderation des OPPORTUNITES
--     (liste, detail ; `moderate_opportunity` (0056) est REMPLACEE a
--     signature identique pour exiger un motif au rejet et journaliser
--     dans `private.audit_log` — meme precedent que 0076 avec
--     `transition_report`) ;
--   * SA-003 — attribution de roles (`roles.manage`, JAMAIS sur
--     soi-meme) et notes administratives (`private.admin_profile_notes`,
--     jamais visibles d'un membre) ;
--   * SA-009 — indice de contact d'un membre manquant
--     (`private.missing_member_contact_hints`), lisible UNIQUEMENT avec
--     `promotions.manage`, lecture journalisee.
--
-- REGLES : identiques a 0076 — permission verifiee DANS chaque fonction
-- via `private.has_permission()`, projections a colonnes ENUMEREES
-- (jamais de select * sur ise_profiles / events / *_matches), curseur
-- keyset (D-44), REVOKE ... FROM PUBLIC, anon puis GRANT explicite
-- (D-126), codes d'erreur D-102, journalisation MASTER PROMPT §38.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. SA-016 — Liste administrable des appels au reseau
--
-- Le statut `draft` est EXCLU : un brouillon est un espace de travail
-- prive du membre, pas un objet publie — le moderer serait de la
-- surveillance, pas de la moderation. Chaque ligne porte le nombre REEL
-- de signalements ouverts.
-- ---------------------------------------------------------------------
create or replace function public.admin_list_network_calls(
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
  if not private.has_permission('calls.moderate') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_status is not null and p_status not in
     ('active', 'paused', 'resolved', 'closed', 'expired', 'cancelled', 'moderated', 'reported') then
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

  select coalesce(jsonb_agg(to_jsonb(r) - 'cur' order by r.created_at desc, r.call_id desc), '[]'::jsonb),
         case when count(*) = v_limit
              then max(r.cur) filter (where r.rn = v_limit) end
    into v_rows, v_next
  from (
    select
      c.id as call_id,
      c.title,
      c.call_family,
      c.call_type,
      c.status,
      c.urgency,
      c.deadline,
      c.published_at,
      c.created_at,
      p.display_name as author_name,
      p.id as author_profile_id,
      (select count(*) from public.reports rp
        where rp.target_type = 'network_call' and rp.target_id = c.id
          and rp.status in ('open', 'reviewing')) as open_reports,
      c.created_at::text || '|' || c.id::text as cur,
      row_number() over (order by c.created_at desc, c.id desc) as rn
    from public.network_calls c
    join public.ise_profiles p on p.id = c.author_profile_id
    where c.deleted_at is null
      and c.status <> 'draft'
      and (p_status is null
           or (p_status = 'reported' and exists (
                 select 1 from public.reports rp
                 where rp.target_type = 'network_call' and rp.target_id = c.id
                   and rp.status in ('open', 'reviewing')))
           or c.status = p_status)
      and (v_cur_ts is null or (c.created_at, c.id) < (v_cur_ts, v_cur_id))
    order by c.created_at desc, c.id desc
    limit v_limit
  ) r;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$$;

revoke all on function public.admin_list_network_calls(text, text, integer) from public, anon;
grant execute on function public.admin_list_network_calls(text, text, integer) to authenticated;

comment on function public.admin_list_network_calls(text, text, integer) is
  'SA-016. Liste administrable des appels au reseau (hors brouillons), filtre par statut ou "reported", decompte reel des signalements ouverts. Exige calls.moderate.';


-- ---------------------------------------------------------------------
-- 2. SA-017 — Detail d'un appel pour decision de moderation
-- ---------------------------------------------------------------------
create or replace function public.admin_get_network_call(p_call_id uuid)
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
  if not private.has_permission('calls.moderate') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'call', jsonb_build_object(
      'call_id',        c.id,
      'title',          c.title,
      'description',    c.description,
      'context',        c.context,
      'wanted_profile', c.wanted_profile,
      'call_family',    c.call_family,
      'call_type',      c.call_type,
      'status',         c.status,
      'urgency',        c.urgency,
      'visibility',     c.visibility,
      'sector',         s.name,
      'country',        co.name_fr,
      'city',           c.city,
      'remote_allowed', c.remote_allowed,
      'deadline',       c.deadline,
      'published_at',   c.published_at,
      'created_at',     c.created_at,
      'author_profile_id', c.author_profile_id,
      'author_name',    p.display_name
    ),
    'reports', coalesce((
      select jsonb_agg(jsonb_build_object(
        'report_id',   rp.id,
        'reason_code', rp.reason_code,
        'reason_name', rr.name,
        'status',      rp.status,
        'severity',    rp.severity,
        'created_at',  rp.created_at
      ) order by rp.created_at desc)
      from public.reports rp
      left join public.report_reasons rr on rr.code = rp.reason_code
      where rp.target_type = 'network_call' and rp.target_id = c.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_type',  e.event_type,
        'from_status', e.from_status,
        'to_status',   e.to_status,
        'note',        e.note,
        'actor_name',  ap.display_name,
        'created_at',  e.created_at
      ) order by e.created_at desc)
      from (
        select * from public.network_call_events ev
        where ev.call_id = c.id
        order by ev.created_at desc
        limit 20
      ) e
      left join public.ise_profiles ap on ap.id = e.actor_profile_id
    ), '[]'::jsonb)
  )
    into v_out
  from public.network_calls c
  join public.ise_profiles p on p.id = c.author_profile_id
  left join public.sectors    s  on s.id   = c.sector_id
  left join public.countries  co on co.code = c.country_code
  where c.id = p_call_id
    and c.deleted_at is null
    and c.status <> 'draft';

  if v_out is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return v_out;
end
$$;

revoke all on function public.admin_get_network_call(uuid) from public, anon;
grant execute on function public.admin_get_network_call(uuid) to authenticated;

comment on function public.admin_get_network_call(uuid) is
  'SA-017. Detail d''un appel au reseau pour decision de moderation : contenu, signalements, chronologie. Exige calls.moderate.';


-- ---------------------------------------------------------------------
-- 3. SA-017 — Decision de moderation motivee sur un appel
--
-- Equivalent appels de `moderate_opportunity` (le RPC manquait) :
--   * `rejected` : l'appel passe en `moderated` (retire du reseau),
--     action `hide_content` dans moderation_actions ;
--   * `approved` sur un appel `moderated` : restauration en `active`,
--     action `restore_content` ;
--   * `approved` sur un appel en ligne : decision « conforme » tracee
--     (`dismiss`), aucun changement d'etat.
-- Motif substantiel OBLIGATOIRE dans tous les cas, journalisation
-- systematique — y compris les tentatives refusees.
-- ---------------------------------------------------------------------
create or replace function public.moderate_network_call(
  p_call_id  uuid,
  p_decision text,
  p_reason   text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me   uuid := private.current_profile_id();
  v_call public.network_calls;
  v_new  text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('calls.moderate') then
    perform private.log_audit(
      p_action      => 'admin.call_moderated',
      p_object_type => 'network_call',
      p_object_id   => p_call_id::text,
      p_result      => 'denied',
      p_error_code  => '42501');
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select * into v_call
  from public.network_calls
  where id = p_call_id and deleted_at is null and status <> 'draft'
  for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if p_decision = 'rejected' then
    if v_call.status = 'moderated' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    v_new := 'moderated';
  else
    -- approved : restauration si modere, sinon « conforme » sans effet d'etat.
    v_new := case when v_call.status = 'moderated' then 'active' else v_call.status end;
  end if;

  if v_new <> v_call.status then
    update public.network_calls set status = v_new where id = p_call_id;
    insert into public.network_call_events (call_id, event_type, actor_profile_id, from_status, to_status, note)
    values (p_call_id, v_new, v_me, v_call.status, v_new, btrim(p_reason));
  end if;

  insert into public.moderation_actions
    (moderator_profile_id, action_type, target_type, target_id, target_profile_id, reason)
  values
    (v_me,
     case
       when p_decision = 'rejected' then 'hide_content'
       when v_call.status = 'moderated' then 'restore_content'
       else 'dismiss'
     end,
     'network_call', p_call_id, v_call.author_profile_id, btrim(p_reason));

  perform private.log_audit(
    p_action      => 'admin.call_moderated',
    p_object_type => 'network_call',
    p_object_id   => p_call_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object(
      'decision',    p_decision,
      'from_status', v_call.status,
      'to_status',   v_new,
      'reason',      btrim(p_reason)));

  return jsonb_build_object('call_id', p_call_id, 'decision', p_decision, 'status', v_new);
end
$$;

revoke all on function public.moderate_network_call(uuid, text, text) from public, anon;
grant execute on function public.moderate_network_call(uuid, text, text) to authenticated;

comment on function public.moderate_network_call(uuid, text, text) is
  'SA-017. Decision de moderation motivee sur un appel au reseau (approbation / rejet / restauration). Exige calls.moderate, motif >= 10 caracteres, journalisee (MASTER PROMPT §38).';


-- ---------------------------------------------------------------------
-- 4. SA-019 — Liste administrable des opportunites
--
-- File de moderation par defaut cote ecran : `moderation_status =
-- 'pending'` (offres relayees d'un partenaire externe, D7 §62).
-- ---------------------------------------------------------------------
create or replace function public.admin_list_opportunities(
  p_moderation text    default null,
  p_status     text    default null,
  p_cursor     text    default null,
  p_limit      integer default 25
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
  if not private.has_permission('opportunities.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_moderation is not null and p_moderation not in
     ('not_required', 'pending', 'approved', 'rejected') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_status is not null and p_status not in
     ('draft', 'active', 'paused', 'closed', 'expired', 'cancelled', 'moderated') then
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

  select coalesce(jsonb_agg(to_jsonb(r) - 'cur' order by r.created_at desc, r.opportunity_id desc), '[]'::jsonb),
         case when count(*) = v_limit
              then max(r.cur) filter (where r.rn = v_limit) end
    into v_rows, v_next
  from (
    select
      o.id as opportunity_id,
      o.title,
      o.opportunity_type,
      o.contract_type,
      o.origin,
      o.source_type,
      o.status,
      o.moderation_status,
      o.deadline,
      o.published_at,
      o.created_at,
      coalesce(org.canonical_name, nullif(btrim(o.organization_name_raw), '')) as organization,
      p.display_name as author_name,
      o.created_at::text || '|' || o.id::text as cur,
      row_number() over (order by o.created_at desc, o.id desc) as rn
    from public.opportunities o
    left join public.ise_profiles  p   on p.id   = o.author_profile_id
    left join public.organizations org on org.id = o.organization_id
    where o.deleted_at is null
      and (p_moderation is null or o.moderation_status = p_moderation)
      and (p_status is null or o.status = p_status)
      and (v_cur_ts is null or (o.created_at, o.id) < (v_cur_ts, v_cur_id))
    order by o.created_at desc, o.id desc
    limit v_limit
  ) r;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$$;

revoke all on function public.admin_list_opportunities(text, text, text, integer) from public, anon;
grant execute on function public.admin_list_opportunities(text, text, text, integer) to authenticated;

comment on function public.admin_list_opportunities(text, text, text, integer) is
  'SA-019. Liste administrable des opportunites, filtres moderation_status / statut, curseur keyset (D-44). Exige opportunities.manage.';


-- ---------------------------------------------------------------------
-- 5. SA-020 — Detail d'une opportunite pour validation
-- ---------------------------------------------------------------------
create or replace function public.admin_get_opportunity(p_opportunity_id uuid)
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
  if not private.has_permission('opportunities.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'opportunity', jsonb_build_object(
      'opportunity_id',    o.id,
      'title',             o.title,
      'summary',           o.summary,
      'description',       o.description,
      'opportunity_type',  o.opportunity_type,
      'contract_type',     o.contract_type,
      'origin',            o.origin,
      'source_type',       o.source_type,
      'source_url',        o.source_url,
      'status',            o.status,
      'moderation_status', o.moderation_status,
      'visibility',        o.visibility,
      'sector',            s.name,
      'country',           co.name_fr,
      'city',              o.city,
      'remote_allowed',    o.remote_allowed,
      'experience_level',  o.experience_level,
      'deadline',          o.deadline,
      'positions_count',   o.positions_count,
      'application_mode',  o.application_mode,
      'external_application_url', o.external_application_url,
      'published_at',      o.published_at,
      'created_at',        o.created_at,
      'organization',      coalesce(org.canonical_name, nullif(btrim(o.organization_name_raw), '')),
      'author_profile_id', o.author_profile_id,
      'author_name',       p.display_name
    ),
    'moderation_history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'decision',   de.payload->>'decision',
        'note',       de.payload->>'note',
        'actor_name', ap.display_name,
        'created_at', de.created_at
      ) order by de.created_at desc)
      from public.domain_events de
      left join public.ise_profiles ap on ap.id = de.actor_profile_id
      where de.aggregate_type = 'opportunity'
        and de.aggregate_id = o.id
        and de.event_type = 'opportunity.moderated'
    ), '[]'::jsonb),
    'open_reports', (
      select count(*) from public.reports rp
      where rp.target_type = 'opportunity' and rp.target_id = o.id
        and rp.status in ('open', 'reviewing'))
  )
    into v_out
  from public.opportunities o
  left join public.ise_profiles  p   on p.id   = o.author_profile_id
  left join public.organizations org on org.id = o.organization_id
  left join public.sectors       s   on s.id   = o.sector_id
  left join public.countries     co  on co.code = o.country_code
  where o.id = p_opportunity_id
    and o.deleted_at is null;

  if v_out is null then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;
  return v_out;
end
$$;

revoke all on function public.admin_get_opportunity(uuid) from public, anon;
grant execute on function public.admin_get_opportunity(uuid) to authenticated;

comment on function public.admin_get_opportunity(uuid) is
  'SA-020. Detail d''une opportunite pour validation : contenu, source, historique de moderation, signalements ouverts. Exige opportunities.manage.';


-- ---------------------------------------------------------------------
-- 6. REMPLACEMENT de `moderate_opportunity` (0056), signature identique.
--
-- Ce qui change — et rien d'autre :
--   * le REJET exige desormais un motif substantiel (« rejet motive »,
--     SA-020) ;
--   * la decision est journalisee dans `private.audit_log`, y compris
--     les tentatives refusees (MASTER PROMPT §38) — l'evenement de
--     domaine, lui, existait deja et est conserve ;
--   * correction d'un defaut reel de 0056, revele par le cas G07 du
--     harnais 0030 : rejeter une offre JAMAIS publiee (`status='draft'`,
--     `published_at` nul) violait `opportunities_published_state` en la
--     forcant a `moderated`. Un brouillon rejete RESTE `draft` :
--     `moderation_status='rejected'` suffit a lui fermer toute
--     publication.
-- ---------------------------------------------------------------------
create or replace function public.moderate_opportunity(
  p_opportunity_id uuid,
  p_decision       text,
  p_note           text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('opportunities.manage') then
    perform private.log_audit(
      p_action      => 'admin.opportunity_moderated',
      p_object_type => 'opportunity',
      p_object_id   => p_opportunity_id::text,
      p_result      => 'denied',
      p_error_code  => '42501');
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if p_decision = 'rejected' and length(btrim(coalesce(p_note, ''))) < 10 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  update public.opportunities
     set moderation_status = p_decision,
         status = case when p_decision = 'rejected' and status <> 'draft'
                       then 'moderated' else status end
   where id = p_opportunity_id and deleted_at is null;

  if not found then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('opportunity.moderated', 'opportunity', p_opportunity_id, v_me,
          jsonb_build_object('decision', p_decision, 'note', p_note));

  perform private.log_audit(
    p_action      => 'admin.opportunity_moderated',
    p_object_type => 'opportunity',
    p_object_id   => p_opportunity_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object('decision', p_decision, 'note', nullif(btrim(coalesce(p_note, '')), '')));

  return jsonb_build_object('opportunity_id', p_opportunity_id, 'moderation_status', p_decision);
end
$fn$;

revoke all on function public.moderate_opportunity(uuid, text, text) from public, anon;
grant execute on function public.moderate_opportunity(uuid, text, text) to authenticated;

comment on function public.moderate_opportunity(uuid, text, text) is
  'SA-020. Decision de moderation d''une opportunite relayee. Exige opportunities.manage ; rejet motive obligatoire ; journalisee (0077).';


-- ---------------------------------------------------------------------
-- 7. SA-003 — Referentiel des roles attribuables
-- ---------------------------------------------------------------------
create or replace function public.admin_list_roles()
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
  if not private.has_permission('roles.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'code',          r.code,
    'name',          r.name,
    'description',   r.description,
    'is_admin_role', r.is_admin_role,
    'holders',       (select count(*) from private.user_roles ur where ur.role_id = r.id),
    'permissions',   coalesce((
      select jsonb_agg(pm.code order by pm.code)
      from private.role_permissions rp
      join private.permissions pm on pm.id = rp.permission_id
      where rp.role_id = r.id), '[]'::jsonb)
  ) order by r.sort_order), '[]'::jsonb)
    into v
  from private.roles r
  where r.code <> 'member';

  return v;
end
$$;

revoke all on function public.admin_list_roles() from public, anon;
grant execute on function public.admin_list_roles() to authenticated;

comment on function public.admin_list_roles() is
  'SA-003. Referentiel des roles attribuables (hors role de base member), permissions portees et effectifs reels. Exige roles.manage.';


-- ---------------------------------------------------------------------
-- 8. SA-003 — Roles detenus par un profil
-- ---------------------------------------------------------------------
create or replace function public.admin_get_profile_roles(p_profile_id uuid)
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
  if not private.has_permission('roles.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.ise_profiles p where p.id = p_profile_id and p.deleted_at is null) then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'code',        r.code,
    'name',        r.name,
    'granted_at',  ur.granted_at,
    'granted_by',  gp.display_name,
    'expires_at',  ur.expires_at
  ) order by r.sort_order), '[]'::jsonb)
    into v
  from private.user_roles ur
  join private.roles r on r.id = ur.role_id
  left join public.ise_profiles gp on gp.id = ur.granted_by
  where ur.profile_id = p_profile_id;

  return v;
end
$$;

revoke all on function public.admin_get_profile_roles(uuid) from public, anon;
grant execute on function public.admin_get_profile_roles(uuid) to authenticated;

comment on function public.admin_get_profile_roles(uuid) is
  'SA-003. Roles detenus par un profil, avec attribution et attributaire. Exige roles.manage.';


-- ---------------------------------------------------------------------
-- 9. SA-003 — Attribution / retrait d'un role
--
-- REGLES NON NEGOCIABLES
--   * `roles.manage` obligatoire — un moderateur ne peut PAS attribuer ;
--   * JAMAIS sur soi-meme, dans les deux sens : un administrateur ne
--     s'attribue ni ne se retire un role par cette voie ;
--   * le role de base `member` n'est pas attribuable : il est pose par
--     la reclamation de profil, pas par un geste administratif ;
--   * motif substantiel obligatoire, journalisation systematique.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_profile_role(
  p_profile_id uuid,
  p_role_code  text,
  p_grant      boolean,
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
  v_role_id smallint;
  v_changed boolean := false;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('roles.manage') then
    perform private.log_audit(
      p_action      => case when p_grant then 'admin.role_granted' else 'admin.role_revoked' end,
      p_object_type => 'profile',
      p_object_id   => p_profile_id::text,
      p_result      => 'denied',
      p_error_code  => '42501',
      p_context     => jsonb_build_object('role', p_role_code));
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  if p_profile_id = v_me then
    perform private.log_audit(
      p_action      => case when p_grant then 'admin.role_granted' else 'admin.role_revoked' end,
      p_object_type => 'profile',
      p_object_id   => p_profile_id::text,
      p_result      => 'denied',
      p_error_code  => 'P0001',
      p_context     => jsonb_build_object('role', p_role_code, 'refusal', 'self_target'));
    raise exception 'cannot_target_self' using errcode = 'P0001';
  end if;

  select r.id into v_role_id from private.roles r where r.code = p_role_code;
  if v_role_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_role_code = 'member' then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.ise_profiles p where p.id = p_profile_id and p.deleted_at is null) then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  if p_grant then
    insert into private.user_roles (profile_id, role_id, granted_by)
    values (p_profile_id, v_role_id, v_me)
    on conflict (profile_id, role_id) do nothing;
    v_changed := found;
  else
    delete from private.user_roles
    where profile_id = p_profile_id and role_id = v_role_id;
    v_changed := found;
  end if;

  perform private.log_audit(
    p_action      => case when p_grant then 'admin.role_granted' else 'admin.role_revoked' end,
    p_object_type => 'profile',
    p_object_id   => p_profile_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object(
      'role',    p_role_code,
      'changed', v_changed,
      'reason',  btrim(p_reason)));

  return jsonb_build_object(
    'profile_id', p_profile_id,
    'role',       p_role_code,
    'granted',    p_grant,
    'changed',    v_changed);
end
$$;

revoke all on function public.admin_set_profile_role(uuid, text, boolean, text) from public, anon;
grant execute on function public.admin_set_profile_role(uuid, text, boolean, text) to authenticated;

comment on function public.admin_set_profile_role(uuid, text, boolean, text) is
  'SA-003. Attribution / retrait d''un role (D-31, D-32). Exige roles.manage, refuse le self-service, motif >= 10 caracteres, journalisee — y compris les refus.';


-- ---------------------------------------------------------------------
-- 10. SA-003 — Notes administratives internes
--
-- Schema `private` : AUCUNE politique RLS ne les expose, aucun GRANT a
-- `authenticated`. Elles ne sortent que par les deux fonctions ci-
-- dessous, qui exigent `profiles.moderate`. Un membre ne voit jamais
-- une note ecrite sur son profil.
-- ---------------------------------------------------------------------
create table if not exists private.admin_profile_notes (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references public.ise_profiles(id) on delete cascade,
  author_profile_id uuid references public.ise_profiles(id) on delete set null,
  body              text not null check (length(btrim(body)) between 3 and 4000),
  created_at        timestamptz not null default now()
);

create index if not exists admin_profile_notes_profile_idx
  on private.admin_profile_notes(profile_id, created_at desc);

comment on table private.admin_profile_notes is
  'SA-003. Notes administratives internes sur un profil. Jamais exposees a l''API ni visibles d''un membre : lecture/ecriture uniquement via admin_list_profile_notes / admin_add_profile_note (profiles.moderate).';

create or replace function public.admin_list_profile_notes(p_profile_id uuid)
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
  if not private.has_permission('profiles.moderate') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'note_id',    n.id,
    'body',       n.body,
    'author',     ap.display_name,
    'created_at', n.created_at
  ) order by n.created_at desc), '[]'::jsonb)
    into v
  from (
    select * from private.admin_profile_notes an
    where an.profile_id = p_profile_id
    order by an.created_at desc
    limit 100
  ) n
  left join public.ise_profiles ap on ap.id = n.author_profile_id;

  return v;
end
$$;

revoke all on function public.admin_list_profile_notes(uuid) from public, anon;
grant execute on function public.admin_list_profile_notes(uuid) to authenticated;

comment on function public.admin_list_profile_notes(uuid) is
  'SA-003. Notes administratives d''un profil (100 dernieres). Exige profiles.moderate.';

create or replace function public.admin_add_profile_note(
  p_profile_id uuid,
  p_body       text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('profiles.moderate') then
    perform private.log_audit(
      p_action      => 'admin.profile_note_added',
      p_object_type => 'profile',
      p_object_id   => p_profile_id::text,
      p_result      => 'denied',
      p_error_code  => '42501');
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_body, ''))) < 3 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.ise_profiles p where p.id = p_profile_id and p.deleted_at is null) then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  insert into private.admin_profile_notes (profile_id, author_profile_id, body)
  values (p_profile_id, v_me, btrim(p_body))
  returning id into v_id;

  perform private.log_audit(
    p_action      => 'admin.profile_note_added',
    p_object_type => 'profile',
    p_object_id   => p_profile_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object('note_id', v_id));

  return jsonb_build_object('note_id', v_id);
end
$$;

revoke all on function public.admin_add_profile_note(uuid, text) from public, anon;
grant execute on function public.admin_add_profile_note(uuid, text) to authenticated;

comment on function public.admin_add_profile_note(uuid, text) is
  'SA-003. Ajout d''une note administrative interne. Exige profiles.moderate, journalisee. La note ne sort jamais vers un membre.';


-- ---------------------------------------------------------------------
-- 11. SA-009 — Indice de contact d'un membre manquant signale
--
-- L'indice fourni par le camarade (ISE-069) est une donnee personnelle
-- d'un TIERS (`private.missing_member_contact_hints`, 0003). Il n'est
-- lisible QU'ICI, avec `promotions.manage`, et chaque lecture est
-- journalisee : consulter la coordonnee d'un tiers est un acte, pas un
-- affichage.
-- ---------------------------------------------------------------------
create or replace function public.admin_get_missing_member_contact_hint(p_suggestion_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hint text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('promotions.manage') then
    perform private.log_audit(
      p_action      => 'admin.contact_hint_read',
      p_object_type => 'missing_member_suggestion',
      p_object_id   => p_suggestion_id::text,
      p_result      => 'denied',
      p_error_code  => '42501');
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if not exists (select 1 from public.missing_member_suggestions s where s.id = p_suggestion_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select h.contact_hint into v_hint
  from private.missing_member_contact_hints h
  where h.suggestion_id = p_suggestion_id;

  perform private.log_audit(
    p_action      => 'admin.contact_hint_read',
    p_object_type => 'missing_member_suggestion',
    p_object_id   => p_suggestion_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object('has_hint', v_hint is not null));

  return jsonb_build_object('suggestion_id', p_suggestion_id, 'contact_hint', v_hint);
end
$$;

revoke all on function public.admin_get_missing_member_contact_hint(uuid) from public, anon;
grant execute on function public.admin_get_missing_member_contact_hint(uuid) to authenticated;

comment on function public.admin_get_missing_member_contact_hint(uuid) is
  'SA-009. Indice de contact d''un membre manquant signale (ISE-069). Exige promotions.manage ; chaque lecture est journalisee (MASTER PROMPT §38, §47).';
