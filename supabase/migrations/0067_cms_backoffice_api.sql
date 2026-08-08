-- =====================================================================
-- 0067_cms_backoffice_api
--
-- API SERVEUR DU BACK-OFFICE CMS (ecrans CMS-001 -> CMS-010).
--
-- Les migrations 0057 -> 0066 ont pose le modele, les permissions, la RLS,
-- les transitions atomiques et les automatisations. Il manquait aux ecrans
-- d'administration cinq choses, et cinq seulement. Chacune est ici parce
-- qu'elle ne pouvait PAS etre resolue cote application :
--
--   1. CONNAITRE SES PROPRES PERMISSIONS
--      `private.permissions` et `private.user_roles` ne sont pas exposees a
--      PostgREST (schema `private`). Sans point de lecture, la couche web
--      ne peut pas decider d'une redirection vers SYS-006 avant meme de
--      rendre la route. Masquer un bouton ne protege rien (§29) : la
--      redirection doit s'appuyer sur la BASE, pas sur une supposition.
--
--   2. LIRE `news` ET `events` DEPUIS LE CMS (CMS-004, CMS-005)
--      La RLS de 0046 accorde la lecture d'une actualite par
--      `private.can_see_news(id)` et l'ecriture par `content.publish`. Un
--      porteur de `cms.read` / `cms.publish` n'a donc AUCUN acces au
--      catalogue editorial. Deux projections `SECURITY DEFINER` bornees
--      resolvent le probleme sans toucher a la RLS du module Actualites
--      ni elargir `content.publish`.
--      Elles n'exposent jamais `news.body`, `events.online_url_private`
--      ni `events.address`.
--
--   3. ECRIRE L'EXPOSITION SUR LA LANDING (D-128)
--      Meme cause. `set_landing_exposure()` ne touche QUE
--      `landing_visibility` et `landing_priority` ; elle ne touche jamais
--      `news.editorial_status`, `events.status` ni `opportunities.status`.
--      Rendre un contenu visible sur le web ouvert EST un acte de
--      publication : la fonction exige `cms.publish` des que
--      `landing_visibility` change, et se contente de `cms.edit` quand
--      seule la priorite editoriale bouge.
--
--   4. AGREGER LE TABLEAU DE BORD (CMS-001, §31)
--      Les compteurs melangent des tables lisibles avec `cms.read` et des
--      tables qui ne le sont pas. Une seule fonction, un seul aller-retour,
--      des comptages REELS. Un compteur qui vaut 0 renvoie 0 : aucune
--      valeur de maquette (MASTER PROMPT §98).
--
--   5. TELEVERSER DANS `public-assets` AVEC `cms.media.manage` (CMS-008)
--      DEFAUT REEL CONSTATE : la politique `ise_public_assets_write` de
--      0027 exige `content.publish`. Un `cms_publisher` porteur des sept
--      permissions CMS ne pouvait donc PAS deposer un media dans le seul
--      bucket que le CMS utilise. La mediatheque etait inutilisable.
--      Une seconde politique, additive, ouvre le bucket a
--      `cms.media.manage`. L'ancienne n'est pas modifiee.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS
--   * aucune table creee ; aucune colonne ajoutee ;
--   * aucune politique RLS existante modifiee ou affaiblie ;
--   * aucun privilege accorde a `anon` — le garde-fou `anon_function_grant`
--     de `private.security_baseline_violations()` reste a zero. Les
--     defauts poses par 0066 accordent EXECUTE a `postgres`,
--     `authenticated` et `service_role`, jamais a `anon`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Permissions CMS de l'appelant
-- ---------------------------------------------------------------------
create or replace function public.get_my_cms_permissions()
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
    select unnest(array['cms.read', 'cms.edit', 'cms.publish', 'cms.schedule',
                        'cms.media.manage', 'cms.partners.manage',
                        'cms.featured_profile.manage']) as code
  ) c
  where private.has_permission(c.code);

  return v;
end
$$;

comment on function public.get_my_cms_permissions() is
  'Permissions CMS reellement detenues par l''appelant. Seul point de lecture possible : private.permissions n''est pas exposee a PostgREST. Sert a la redirection serveur vers SYS-006 (ADDENDUM 29).';

-- ---------------------------------------------------------------------
-- 2. Catalogue editorial vu par le CMS
-- ---------------------------------------------------------------------
create or replace function public.list_cms_news(
  p_query  text    default null,
  p_limit  integer default 25,
  p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit  integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_like   text    := case when nullif(btrim(coalesce(p_query, '')), '') is null
                           then null else '%' || btrim(p_query) || '%' end;
  v_total  bigint;
  v_rows   jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.read') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select count(*) into v_total
  from public.news n
  where n.deleted_at is null
    and (v_like is null or n.title ilike v_like or n.summary ilike v_like);

  select coalesce(jsonb_agg(to_jsonb(r) - 'ord' order by r.ord), '[]'::jsonb)
    into v_rows
  from (
    select row_number() over (order by n.landing_priority desc,
                                       coalesce(n.published_at, n.created_at) desc) as ord,
           n.id,
           n.title,
           n.slug,
           n.summary,
           n.category_code,
           n.image_path,
           n.editorial_status,
           n.visibility,
           n.landing_visibility,
           n.landing_priority,
           n.is_featured,
           n.featured_at,
           n.published_at,
           n.created_at,
           (select jsonb_build_object('id', s.id, 'publish_at', s.publish_at,
                                      'unpublish_at', s.unpublish_at, 'status', s.status)
              from public.cms_publication_schedule s
             where s.entity_type = 'news' and s.entity_id = n.id and s.status = 'pending'
             order by coalesce(s.publish_at, s.unpublish_at)
             limit 1) as pending_schedule
      from public.news n
     where n.deleted_at is null
       and (v_like is null or n.title ilike v_like or n.summary ilike v_like)
     order by n.landing_priority desc, coalesce(n.published_at, n.created_at) desc
     limit v_limit offset v_offset
  ) r;

  return jsonb_build_object('total', v_total, 'limit', v_limit,
                            'offset', v_offset, 'rows', v_rows);
end
$$;

comment on function public.list_cms_news(text, integer, integer) is
  'CMS-004. Colonnes ENUMEREES : news.body ne franchit jamais cette frontiere. Exige cms.read, sans exiger content.publish.';

create or replace function public.list_cms_events(
  p_query  text    default null,
  p_limit  integer default 25,
  p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit  integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_like   text    := case when nullif(btrim(coalesce(p_query, '')), '') is null
                           then null else '%' || btrim(p_query) || '%' end;
  v_total  bigint;
  v_rows   jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.read') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select count(*) into v_total
  from public.events e
  where e.deleted_at is null
    and (v_like is null or e.title ilike v_like or coalesce(e.city, '') ilike v_like);

  select coalesce(jsonb_agg(to_jsonb(r) - 'ord' order by r.ord), '[]'::jsonb)
    into v_rows
  from (
    select row_number() over (order by e.starts_at asc) as ord,
           e.id,
           e.title,
           e.slug,
           e.event_type_code,
           e.format,
           e.city,
           e.country_code,
           e.starts_at,
           e.ends_at,
           e.timezone,
           e.status,
           e.visibility,
           e.cancelled_at,
           e.landing_visibility,
           e.landing_priority,
           (e.starts_at > now()) as is_upcoming,
           exists (select 1 from public.cms_content_overrides o
                    where o.override_kind = 'pin' and o.entity_type = 'event'
                      and o.entity_id = e.id
                      and o.starts_at <= now()
                      and (o.ends_at is null or o.ends_at > now())) as is_pinned,
           (select jsonb_build_object('id', s.id, 'publish_at', s.publish_at,
                                      'unpublish_at', s.unpublish_at, 'status', s.status)
              from public.cms_publication_schedule s
             where s.entity_type = 'event' and s.entity_id = e.id and s.status = 'pending'
             order by coalesce(s.publish_at, s.unpublish_at)
             limit 1) as pending_schedule
      from public.events e
     where e.deleted_at is null
       and (v_like is null or e.title ilike v_like or coalesce(e.city, '') ilike v_like)
     order by e.starts_at asc
     limit v_limit offset v_offset
  ) r;

  return jsonb_build_object('total', v_total, 'limit', v_limit,
                            'offset', v_offset, 'rows', v_rows);
end
$$;

comment on function public.list_cms_events(text, integer, integer) is
  'CMS-005. online_url_private et address ne sont jamais projetees. Exige cms.read.';

-- ---------------------------------------------------------------------
-- 3. Exposition d'un contenu metier sur la landing (D-128)
-- ---------------------------------------------------------------------
create or replace function public.set_landing_exposure(
  p_entity_type        text,
  p_entity_id          uuid,
  p_landing_visibility text     default null,
  p_landing_priority   smallint default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table   text;
  v_current text;
  v_prio    smallint;
  v_changes_visibility boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  v_table := case p_entity_type
               when 'news'        then 'news'
               when 'event'       then 'events'
               when 'opportunity' then 'opportunities'
             end;
  if v_table is null then
    raise exception 'unknown_entity_type' using errcode = 'P0002';
  end if;

  if p_landing_visibility is not null
     and p_landing_visibility not in ('hidden', 'visible') then
    raise exception 'invalid_landing_visibility' using errcode = 'P0001';
  end if;
  if p_landing_priority is not null
     and (p_landing_priority < 0 or p_landing_priority > 1000) then
    raise exception 'invalid_landing_priority' using errcode = 'P0001';
  end if;
  if p_landing_visibility is null and p_landing_priority is null then
    raise exception 'nothing_to_change' using errcode = 'P0001';
  end if;

  execute format(
    'select landing_visibility, landing_priority from public.%I'
    || ' where id = $1 and deleted_at is null for update', v_table)
    into v_current, v_prio using p_entity_id;
  if v_current is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  v_changes_visibility := p_landing_visibility is not null
                          and p_landing_visibility is distinct from v_current;

  -- Exposer sur le web ouvert EST une publication : cms.edit n'y suffit pas.
  if v_changes_visibility then
    if not private.has_permission('cms.publish') then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
  elsif not private.has_permission('cms.edit') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  execute format(
    'update public.%I set landing_visibility = coalesce($2, landing_visibility),'
    || ' landing_priority = coalesce($3, landing_priority), updated_at = now()'
    || ' where id = $1', v_table)
  using p_entity_id, p_landing_visibility, p_landing_priority;

  perform private.log_audit(
    p_action      => 'cms.landing_exposure',
    p_object_type => p_entity_type,
    p_object_id   => p_entity_id::text,
    p_context     => jsonb_build_object(
                       'from_landing_visibility', v_current,
                       'to_landing_visibility', coalesce(p_landing_visibility, v_current),
                       'from_landing_priority', v_prio,
                       'to_landing_priority', coalesce(p_landing_priority, v_prio)));

  return jsonb_build_object('entity_type', p_entity_type, 'id', p_entity_id,
                            'landing_visibility', coalesce(p_landing_visibility, v_current),
                            'landing_priority', coalesce(p_landing_priority, v_prio));
end
$$;

comment on function public.set_landing_exposure(text, uuid, text, smallint) is
  'D-128. Ne modifie QUE landing_visibility / landing_priority. Ne touche jamais news.editorial_status, events.status ni opportunities.status. cms.publish des que la visibilite change, cms.edit sinon.';

create or replace function public.set_news_featured(
  p_news_id     uuid,
  p_is_featured boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.publish') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_is_featured is null then
    raise exception 'nothing_to_change' using errcode = 'P0001';
  end if;

  select n.is_featured into v_current
    from public.news n where n.id = p_news_id and n.deleted_at is null for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  update public.news
     set is_featured = p_is_featured,
         featured_at = case when p_is_featured then now() else null end,
         updated_at  = now()
   where id = p_news_id;

  perform private.log_audit(
    p_action      => 'cms.news_featured',
    p_object_type => 'news',
    p_object_id   => p_news_id::text,
    p_context     => jsonb_build_object('from', v_current, 'to', p_is_featured));

  return jsonb_build_object('id', p_news_id, 'is_featured', p_is_featured);
end
$$;

comment on function public.set_news_featured(uuid, boolean) is
  'CMS-004, mise a la une. Reutilise news.is_featured / news.featured_at (0013) : aucune colonne ajoutee. Exige cms.publish.';

-- ---------------------------------------------------------------------
-- 4. Tableau de bord CMS-001 — comptages reels, jamais de valeur de maquette
-- ---------------------------------------------------------------------
create or replace function public.get_cms_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_day    date := (now() at time zone 'utc')::date;
  v_out    jsonb;
  v_alerts jsonb;
  v_sched_failed   bigint;
  v_sched_overdue  bigint;
  v_orphan_sponsor bigint;
  v_media_novar    bigint;
  v_no_featured    bigint;
  v_expiring       bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.read') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select count(*) into v_sched_failed
    from public.cms_publication_schedule where status = 'failed';

  select count(*) into v_sched_overdue
    from public.cms_publication_schedule
   where status = 'pending'
     and least(coalesce(publish_at, 'infinity'::timestamptz),
               coalesce(unpublish_at, 'infinity'::timestamptz)) < now();

  select count(*) into v_orphan_sponsor
    from public.cms_carousel_items i
    left join public.cms_partner_campaigns c on c.id = i.partner_campaign_id
   where i.status = 'published' and i.is_sponsored
     and (c.id is null or c.status <> 'published' or c.start_at > now() or c.end_at <= now());

  select count(*) into v_media_novar
    from public.cms_media_assets m
   where m.deleted_at is null and m.variant_kind = 'original'
     and not exists (select 1 from public.cms_media_assets v
                      where v.source_media_id = m.id and v.deleted_at is null
                        and v.variant_kind in ('desktop', 'mobile'));

  v_no_featured := case when exists (select 1 from public.cms_featured_profile_history
                                      where featured_date = v_day and status = 'published')
                        then 0 else 1 end;

  select count(*) into v_expiring
    from public.cms_partner_campaigns
   where status = 'published' and end_at > now() and end_at <= now() + interval '7 days';

  select coalesce(jsonb_agg(jsonb_build_object('code', a.code, 'severity', a.severity,
                                               'count', a.count)
                            order by a.code), '[]'::jsonb)
    into v_alerts
  from (
    values
      ('schedule_failed',   'error',   v_sched_failed),
      ('schedule_overdue',  'warning', v_sched_overdue),
      ('sponsored_orphan',  'error',   v_orphan_sponsor),
      ('media_no_variant',  'warning', v_media_novar),
      ('featured_missing',  'warning', v_no_featured),
      ('campaign_expiring', 'info',    v_expiring)
  ) as a(code, severity, count)
  where a.count > 0;

  select jsonb_build_object(
    'read_at', now(),
    'day', v_day,
    'carousel', (
      select jsonb_build_object(
        'total',     count(*),
        'published', count(*) filter (where status = 'published'),
        'scheduled', count(*) filter (where status = 'scheduled'),
        'draft',     count(*) filter (where status = 'draft'),
        'expired',   count(*) filter (where status = 'expired'),
        'archived',  count(*) filter (where status = 'archived'),
        'sponsored', count(*) filter (where is_sponsored),
        'live_now',  count(*) filter (where status = 'published'
                                        and (start_at is null or start_at <= now())
                                        and (end_at   is null or end_at   >  now())))
      from public.cms_carousel_items),
    'sections', (
      select jsonb_build_object(
        'total',     count(*),
        'published', count(*) filter (where status = 'published'),
        'enabled',   count(*) filter (where is_enabled),
        'manual',    count(*) filter (where source_mode <> 'automatic'))
      from public.cms_sections),
    'news', (
      select jsonb_build_object(
        'total',           count(*),
        'landing_visible', count(*) filter (where landing_visibility = 'visible'),
        'featured',        count(*) filter (where is_featured),
        'drafts',          count(*) filter (where editorial_status = 'draft'),
        'published',       count(*) filter (where editorial_status = 'published'))
      from public.news where deleted_at is null),
    'events', (
      select jsonb_build_object(
        'total',            count(*),
        'upcoming',         count(*) filter (where starts_at > now() and cancelled_at is null),
        'upcoming_visible', count(*) filter (where starts_at > now() and cancelled_at is null
                                               and landing_visibility = 'visible'))
      from public.events where deleted_at is null),
    'partners', (
      select jsonb_build_object(
        'total',     count(*),
        'active',    count(*) filter (where status = 'published'
                                        and start_at <= now() and end_at > now()),
        'scheduled', count(*) filter (where status = 'scheduled'
                                         or (status = 'published' and start_at > now())),
        'expired',   count(*) filter (where status = 'expired'),
        'draft',     count(*) filter (where status = 'draft'))
      from public.cms_partner_campaigns),
    'media', (
      select jsonb_build_object(
        'total',      count(*) filter (where variant_kind = 'original'),
        'variants',   count(*) filter (where variant_kind <> 'original'),
        'no_variant', v_media_novar)
      from public.cms_media_assets where deleted_at is null),
    'schedule', (
      select jsonb_build_object(
        'pending',   count(*) filter (where status = 'pending'),
        'applied',   count(*) filter (where status = 'applied'),
        'failed',    count(*) filter (where status = 'failed'),
        'cancelled', count(*) filter (where status = 'cancelled'),
        'overdue',   v_sched_overdue)
      from public.cms_publication_schedule),
    'featured_profile', jsonb_build_object(
      'automation_enabled', coalesce((select r.is_automation_enabled
                                        from public.cms_featured_profile_rules r
                                       where r.is_active limit 1), false),
      'today_status',       (select h.status from public.cms_featured_profile_history h
                              where h.featured_date = v_day limit 1),
      'today_mode',         (select h.selection_mode from public.cms_featured_profile_history h
                              where h.featured_date = v_day limit 1),
      'active_override',    exists (select 1 from public.cms_content_overrides o
                                     where o.section_key = 'featured_profile'
                                       and o.override_kind = 'pin'
                                       and o.starts_at <= now()
                                       and (o.ends_at is null or o.ends_at > now())),
      'history_count',      (select count(*) from public.cms_featured_profile_history)),
    'published_today', (
      select coalesce(sum(t.n), 0) from (
        select count(*) as n from public.cms_carousel_items
         where published_at is not null and (published_at at time zone 'utc')::date = v_day
        union all
        select count(*) from public.cms_sections
         where published_at is not null and (published_at at time zone 'utc')::date = v_day
        union all
        select count(*) from public.cms_partner_campaigns
         where published_at is not null and (published_at at time zone 'utc')::date = v_day
      ) t),
    'last_published_at', (
      select max(t.p) from (
        select max(published_at) as p from public.cms_carousel_items
        union all select max(published_at) from public.cms_sections
        union all select max(published_at) from public.cms_partner_campaigns
      ) t),
    'alerts', v_alerts
  ) into v_out;

  return v_out;
end
$$;

comment on function public.get_cms_dashboard() is
  'CMS-001 (31). Comptages REELS. Un compteur a zero renvoie zero : aucune valeur de maquette n''est fabriquee (MASTER PROMPT 98). Les alertes sont des conditions observees.';

-- ---------------------------------------------------------------------
-- 5. ISE du jour — vue d'ensemble et vivier (CMS-006)
-- ---------------------------------------------------------------------
create or replace function public.get_cms_featured_profile_overview(
  p_history_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_history_limit, 20), 1), 100);
  v_day   date := (now() at time zone 'utc')::date;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.read') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'read_at', now(),
    'day', v_day,
    'rules', (
      select to_jsonb(r) from public.cms_featured_profile_rules r where r.is_active limit 1),
    'current', (
      select jsonb_build_object(
               'history_id',        h.id,
               'featured_date',     h.featured_date,
               'selection_mode',    h.selection_mode,
               'status',            h.status,
               'published_at',      h.published_at,
               'selection_context', h.selection_context,
               'profile_id',        p.id,
               'display_name',      coalesce(nullif(btrim(p.display_name), ''),
                                             btrim(p.first_name || ' ' || p.last_name)),
               'current_position',  p.current_position,
               'organization',      org.canonical_name,
               'promotion',         case when pr.id is not null
                                         then pr.name || ' ' || pr.graduation_year::text end,
               'public_summary',    p.public_summary,
               'avatar_path',       p.avatar_path)
        from public.cms_featured_profile_history h
        join public.ise_profiles p on p.id = h.profile_id
        left join public.promotions pr on pr.id = p.promotion_id
        left join public.organizations org on org.id = p.current_organization_id
       where h.featured_date <= v_day
       order by h.featured_date desc, h.created_at desc
       limit 1),
    'history', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.featured_date desc)
        from (
          select h.featured_date,
                 h.selection_mode,
                 h.status,
                 h.published_at,
                 h.profile_id,
                 coalesce(nullif(btrim(p.display_name), ''),
                          btrim(p.first_name || ' ' || p.last_name)) as display_name,
                 p.current_position,
                 coalesce(nullif(btrim(a.display_name), ''),
                          btrim(a.first_name || ' ' || a.last_name)) as selected_by,
                 h.selection_context
            from public.cms_featured_profile_history h
            join public.ise_profiles p on p.id = h.profile_id
            left join public.ise_profiles a on a.id = h.selected_by_profile_id
           order by h.featured_date desc, h.created_at desc
           limit v_limit) x), '[]'::jsonb),
    'overrides', coalesce((
      select jsonb_agg(to_jsonb(y) order by y.starts_at desc)
        from (
          select o.id,
                 o.override_kind,
                 o.entity_id as profile_id,
                 coalesce(nullif(btrim(p.display_name), ''),
                          btrim(p.first_name || ' ' || p.last_name)) as display_name,
                 o.starts_at,
                 o.ends_at,
                 o.reason,
                 (o.starts_at <= now() and (o.ends_at is null or o.ends_at > now())) as is_active,
                 coalesce(nullif(btrim(a.display_name), ''),
                          btrim(a.first_name || ' ' || a.last_name)) as created_by
            from public.cms_content_overrides o
            left join public.ise_profiles p on p.id = o.entity_id
            left join public.ise_profiles a on a.id = o.created_by_profile_id
           where o.section_key = 'featured_profile'
           order by o.starts_at desc
           limit v_limit) y), '[]'::jsonb),
    'eligible_count', (
      select count(*) from public.ise_profiles p
       where p.deleted_at is null and private.featured_profile_eligible(p.id, v_day)));
end
$$;

comment on function public.get_cms_featured_profile_overview(integer) is
  'CMS-006. Regle active, selection courante, historique et overrides avec leur auteur (22 : un override est auditable). Ne projette AUCUNE donnee privee.';

create or replace function public.list_cms_featured_profile_candidates(
  p_query text    default null,
  p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_like  text    := case when nullif(btrim(coalesce(p_query, '')), '') is null
                          then null else '%' || btrim(p_query) || '%' end;
  v_day   date := (now() at time zone 'utc')::date;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.featured_profile.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.display_name)
      from (
        select p.id,
               coalesce(nullif(btrim(p.display_name), ''),
                        btrim(p.first_name || ' ' || p.last_name)) as display_name,
               p.current_position,
               org.canonical_name as organization,
               case when pr.id is not null
                    then pr.name || ' ' || pr.graduation_year::text end as promotion,
               (select max(h.featured_date) from public.cms_featured_profile_history h
                 where h.profile_id = p.id) as last_featured_date
          from public.ise_profiles p
          left join public.promotions pr on pr.id = p.promotion_id
          left join public.organizations org on org.id = p.current_organization_id
         where p.deleted_at is null
           and private.featured_profile_eligible(p.id, v_day)
           and (v_like is null
                or p.display_name ilike v_like
                or (p.first_name || ' ' || p.last_name) ilike v_like)
         limit v_limit) x), '[]'::jsonb);
end
$$;

comment on function public.list_cms_featured_profile_candidates(text, integer) is
  'CMS-006, vivier de l''override. N''affiche que des profils REELLEMENT eligibles : le meme predicat que la selection automatique, private.featured_profile_eligible.';

-- ---------------------------------------------------------------------
-- 6. Storage — le CMS peut enfin deposer un media (CMS-008)
--    Politique ADDITIVE. ise_public_assets_write (0027) est conservee a
--    l'identique : le circuit content.publish continue de fonctionner.
-- ---------------------------------------------------------------------
drop policy if exists ise_public_assets_cms_write on storage.objects;
create policy ise_public_assets_cms_write
  on storage.objects
  as permissive
  for all
  to authenticated
  using (bucket_id = 'public-assets' and private.has_permission('cms.media.manage'))
  with check (bucket_id = 'public-assets' and private.has_permission('cms.media.manage'));

-- ---------------------------------------------------------------------
-- 7. Privileges explicites — DEFAUT CONSTATE PENDANT L'APPLICATION
--
--    Le bloc de verification ci-dessous a echoue au premier essai, en
--    signalant les huit fonctions comme executables par `anon`. Le
--    garde-fou `pg_default_acl` de 0066 ne s'applique QUE lorsque le role
--    createur est celui de l'entree (`defaclrole = postgres`) ; la
--    connexion de migration n'est pas `postgres`, donc les fonctions sont
--    nees avec `proacl = NULL`, c'est-a-dire EXECUTE pour PUBLIC.
--
--    C'est exactement le defaut D-126, reapparu par un autre chemin. La
--    lecon de 0062 s'applique telle quelle : ne jamais compter sur un
--    defaut, poser le privilege explicitement. Le garde-fou de 0066 reste
--    utile — il couvre les creations faites sous `postgres` — mais il ne
--    dispense pas du GRANT/REVOKE explicite.
-- ---------------------------------------------------------------------
do $$
declare
  v_fn text;
begin
  for v_fn in
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_my_cms_permissions', 'list_cms_news', 'list_cms_events',
                        'set_landing_exposure', 'set_news_featured', 'get_cms_dashboard',
                        'get_cms_featured_profile_overview',
                        'list_cms_featured_profile_candidates')
  loop
    execute format('grant execute on function %s to authenticated, service_role', v_fn);
    execute format('revoke execute on function %s from public', v_fn);
    execute format('revoke execute on function %s from anon', v_fn);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 8. Verification : aucune des fonctions ajoutees n'est exposee a `anon`.
-- ---------------------------------------------------------------------
do $$
declare
  v_leak text;
begin
  select string_agg(p.proname, ', ')
    into v_leak
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('get_my_cms_permissions', 'list_cms_news', 'list_cms_events',
                      'set_landing_exposure', 'set_news_featured', 'get_cms_dashboard',
                      'get_cms_featured_profile_overview',
                      'list_cms_featured_profile_candidates')
    and has_function_privilege('anon', p.oid, 'execute');

  if v_leak is not null then
    raise exception 'cms_backoffice_api_exposed_to_anon: %', v_leak using errcode = 'P0001';
  end if;
end $$;
