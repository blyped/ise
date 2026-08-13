-- =====================================================================
-- 0113_landing_cover_media
--
-- Visuel de couverture pour les cartes « Evenements » et « Opportunites »
-- de la landing (ADDENDUM §12, §13), choisi par l'admin dans la meme
-- mediatheque PUBLIQUE que le carrousel, les actualites et « ISE du jour »
-- (`cms_media_assets`, bucket `landing-media`, CMS-008).
--
-- CONTEXTE
--   `apps/web/src/app/cms/evenements/page.tsx` refusait jusqu'ici tout champ
--   de couverture : « events n'a pas de colonne d'image, et en ajouter une
--   pour la vitrine dupliquerait un champ metier ». C'etait vrai tant
--   qu'aucune mediatheque n'existait. CMS-008 (0067/0068) et D-165 (0112)
--   ont depuis etabli le patron correct : une colonne FK optionnelle vers
--   `cms_media_assets`, jamais un chemin libre recopie a la main. Cette
--   migration applique EXACTEMENT ce patron a `events` et `opportunities`.
--
-- CE QUI EST AJOUTE
--   * events.cover_media_id, opportunities.cover_media_id — FK optionnelle
--     vers cms_media_assets, ON DELETE SET NULL (le retrait d'un media ne
--     casse jamais la ligne metier) ;
--   * set_landing_cover_media(p_entity_type, p_entity_id, p_media_id) —
--     seule fonction qui les ecrit. Meme forme que set_landing_exposure
--     (0067) : dispatch par entity_type, verrou de ligne, audit. Exige
--     cms.edit (poser un visuel n'est pas un acte de publication : la
--     visibilite reste gouvernee par set_landing_exposure) ;
--   * list_cms_events() projette desormais cover_media_id (pre-remplissage
--     du formulaire CMS) ;
--   * list_cms_opportunities() — nouvelle fonction miroir de
--     list_cms_events(), necessaire a l'ecran /cms/opportunites qui
--     n'existait pas encore ;
--   * get_landing_events() / get_landing_opportunities() projettent
--     desormais 'image' via private.landing_media(), la MEME fonction que
--     le carrousel, les actualites et « ISE du jour » — donc les memes
--     garanties (bucket public, alternative textuelle >= 3 caracteres
--     obligatoire, jamais un fichier prive).
--
-- CE QUE CETTE MIGRATION NE FAIT PAS
--   * ne touche a aucune colonne metier (status, moderation_status,
--     landing_visibility, landing_priority, online_url_private, address) ;
--   * n'ouvre aucun privilege supplementaire a anon (list_cms_events /
--     list_cms_opportunities restent reservees a cms.read, authenticated
--     uniquement) ;
--   * la description, la remuneration et le contact des opportunites ne
--     traversent toujours pas cette frontiere (addendum §13, inchange).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Colonnes
-- ---------------------------------------------------------------------
alter table public.events
  add column if not exists cover_media_id uuid references public.cms_media_assets(id) on delete set null;

alter table public.opportunities
  add column if not exists cover_media_id uuid references public.cms_media_assets(id) on delete set null;

comment on column public.events.cover_media_id is
  'Visuel editorial optionnel pour la carte landing (0113). Reference la mediatheque publique (cms_media_assets, bucket landing-media) — jamais un chemin libre.';
comment on column public.opportunities.cover_media_id is
  'Visuel editorial optionnel pour la carte landing (0113). Reference la mediatheque publique (cms_media_assets, bucket landing-media) — jamais un chemin libre.';

-- ---------------------------------------------------------------------
-- 2. Ecriture, reservee a cms.edit, auditee.
-- ---------------------------------------------------------------------
create or replace function public.set_landing_cover_media(
  p_entity_type text,
  p_entity_id   uuid,
  p_media_id    uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table   text;
  v_bucket  text;
  v_alt     text;
  v_deleted timestamptz;
  v_from    uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.edit') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  v_table := case p_entity_type
               when 'event'       then 'events'
               when 'opportunity' then 'opportunities'
             end;
  if v_table is null then
    raise exception 'unknown_entity_type' using errcode = 'P0002';
  end if;

  if p_media_id is not null then
    select m.bucket_id, m.alt_text, m.deleted_at
      into v_bucket, v_alt, v_deleted
      from public.cms_media_assets m
     where m.id = p_media_id;
    if v_bucket is null or v_deleted is not null then
      raise exception 'invalid_media' using errcode = 'P0001';
    end if;
    if v_bucket <> 'landing-media' or char_length(btrim(coalesce(v_alt, ''))) < 3 then
      raise exception 'invalid_media' using errcode = 'P0001';
    end if;
  end if;

  execute format(
    'select cover_media_id from public.%I where id = $1 and deleted_at is null for update', v_table)
    into v_from using p_entity_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  execute format(
    'update public.%I set cover_media_id = $2, updated_at = now() where id = $1', v_table)
  using p_entity_id, p_media_id;

  perform private.log_audit(
    p_action      => 'cms.landing_cover_media',
    p_object_type => p_entity_type,
    p_object_id   => p_entity_id::text,
    p_context     => jsonb_build_object('from_media_id', v_from, 'to_media_id', p_media_id));

  return jsonb_build_object('entity_type', p_entity_type, 'id', p_entity_id, 'media_id', p_media_id);
end
$$;

revoke all on function public.set_landing_cover_media(text, uuid, uuid) from public, anon;
grant execute on function public.set_landing_cover_media(text, uuid, uuid) to authenticated, service_role;

comment on function public.set_landing_cover_media(text, uuid, uuid) is
  'CMS-005 / CMS-006bis (0113). Pose ou retire le visuel de couverture d''un evenement ou d''une opportunite, toujours tire de la mediatheque publique (landing-media, alt_text >= 3 caracteres). Exige cms.edit — poser un visuel n''est pas publier.';

-- ---------------------------------------------------------------------
-- 3. list_cms_events() : ajoute cover_media_id (pre-remplissage du form).
--    Corps identique a 0067, un seul champ ajoute.
-- ---------------------------------------------------------------------
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
           e.cover_media_id,
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
  'CMS-005. online_url_private et address ne sont jamais projetees. Exige cms.read. Depuis 0113 : cover_media_id ajoute pour pre-remplir le formulaire de visuel.';

-- ---------------------------------------------------------------------
-- 4. list_cms_opportunities() : miroir de list_cms_events(), pour l'ecran
--    /cms/opportunites qui n'existait pas avant cette migration. Colonnes
--    ENUMEREES : ni description, ni remuneration, ni contact (addendum §13,
--    meme frontiere que get_landing_opportunities).
-- ---------------------------------------------------------------------
create or replace function public.list_cms_opportunities(
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
  from public.opportunities o
  where o.deleted_at is null
    and (v_like is null or o.title ilike v_like);

  select coalesce(jsonb_agg(to_jsonb(r) - 'ord' order by r.ord), '[]'::jsonb)
    into v_rows
  from (
    select row_number() over (order by o.published_at desc nulls last, o.created_at desc) as ord,
           o.id,
           o.title,
           o.opportunity_type,
           o.contract_type,
           sec.name as sector,
           o.country_code,
           o.city,
           o.remote_allowed,
           o.deadline,
           o.status,
           o.moderation_status,
           o.visibility,
           o.landing_visibility,
           o.landing_priority,
           o.cover_media_id,
           o.published_at,
           case when org.id is not null and org.is_verified then org.canonical_name end as organization,
           exists (select 1 from public.cms_content_overrides ov
                    where ov.override_kind = 'pin' and ov.entity_type = 'opportunity'
                      and ov.entity_id = o.id
                      and ov.starts_at <= now()
                      and (ov.ends_at is null or ov.ends_at > now())) as is_pinned,
           (select jsonb_build_object('id', s.id, 'publish_at', s.publish_at,
                                      'unpublish_at', s.unpublish_at, 'status', s.status)
              from public.cms_publication_schedule s
             where s.entity_type = 'opportunity' and s.entity_id = o.id and s.status = 'pending'
             order by coalesce(s.publish_at, s.unpublish_at)
             limit 1) as pending_schedule
      from public.opportunities o
      left join public.sectors       sec on sec.id = o.sector_id
      left join public.organizations org on org.id = o.organization_id
     where o.deleted_at is null
       and (v_like is null or o.title ilike v_like)
     order by o.published_at desc nulls last, o.created_at desc
     limit v_limit offset v_offset
  ) r;

  return jsonb_build_object('total', v_total, 'limit', v_limit,
                            'offset', v_offset, 'rows', v_rows);
end
$$;

revoke all on function public.list_cms_opportunities(text, integer, integer) from public, anon;
grant execute on function public.list_cms_opportunities(text, integer, integer) to authenticated, service_role;

comment on function public.list_cms_opportunities(text, integer, integer) is
  'CMS-006bis (0113). Catalogue des opportunites vu par le CMS. Colonnes ENUMEREES : ni description, ni remuneration, ni contact, ni URL de candidature externe (meme frontiere que get_landing_opportunities, addendum §13). Exige cms.read.';

-- ---------------------------------------------------------------------
-- 5. get_landing_events() / get_landing_opportunities() : ajoutent 'image'.
--    Corps identique a 0061, un seul champ ajoute a chaque projection.
-- ---------------------------------------------------------------------
create or replace function public.get_landing_events(p_limit integer default 3)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.landing_section_hidden('events') then '[]'::jsonb
         else coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id',              e.id,
                    'entity_type',     'event',
                    'title',           e.title,
                    'slug',            e.slug,
                    'event_type_code', e.event_type_code,
                    'starts_at',       e.starts_at,
                    'ends_at',         e.ends_at,
                    'timezone',        e.timezone,
                    'format',          e.format,
                    'city',            e.city,
                    'country_code',    e.country_code,
                    'image',           private.landing_media(e.cover_media_id),
                    'is_pinned',       private.landing_override_position('events', 'event', e.id) is not null)
                  order by private.landing_override_position('events', 'event', e.id) asc nulls last,
                           e.landing_priority desc, e.starts_at asc, e.id desc)
           from public.events e
           where e.id in (
             select e2.id from public.events e2
             where e2.deleted_at is null
               and e2.status = 'published'
               and e2.cancelled_at is null
               and e2.visibility = 'members'
               and e2.landing_visibility = 'visible'
               and e2.starts_at > now()
               and not private.landing_is_excluded('events', 'event', e2.id)
             order by private.landing_override_position('events', 'event', e2.id) asc nulls last,
                      e2.landing_priority desc, e2.starts_at asc, e2.id desc
             limit least(greatest(coalesce(p_limit, 3), 1), 24))
         ), '[]'::jsonb) end
$$;

comment on function public.get_landing_events(integer) is
  'PUB-001 : prochains evenements publies. Le lien de connexion (online_url_private) n''est jamais projete. Un evenement passe ou annule sort automatiquement (addendum §12). Depuis 0113 : "image" porte un visuel optionnel de la mediatheque publique.';

create or replace function public.get_landing_opportunities(p_limit integer default 3)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.landing_section_hidden('opportunities') then '[]'::jsonb
         else coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id',              o.id,
                    'entity_type',     'opportunity',
                    'title',           o.title,
                    'opportunity_type', o.opportunity_type,
                    'contract_type',   o.contract_type,
                    'sector',          sec.name,
                    'country_code',    o.country_code,
                    'city',            o.city,
                    'remote_allowed',  o.remote_allowed,
                    'deadline',        o.deadline,
                    'organization',    case when org.id is not null and org.is_verified
                                            then org.canonical_name end,
                    'image',           private.landing_media(o.cover_media_id),
                    'is_pinned',       private.landing_override_position('opportunities', 'opportunity', o.id) is not null)
                  order by private.landing_override_position('opportunities', 'opportunity', o.id) asc nulls last,
                           o.landing_priority desc, o.published_at desc, o.id desc)
           from public.opportunities o
           left join public.sectors       sec on sec.id = o.sector_id
           left join public.organizations org on org.id = o.organization_id
           where o.id in (
             select o2.id from public.opportunities o2
             where o2.deleted_at is null
               and o2.status = 'active'
               and o2.visibility = 'members'
               and o2.landing_visibility = 'visible'
               and o2.moderation_status in ('not_required', 'approved')
               and o2.published_at is not null
               and o2.published_at <= now()
               and (o2.deadline is null or o2.deadline > now())
               and not private.landing_is_excluded('opportunities', 'opportunity', o2.id)
             order by private.landing_override_position('opportunities', 'opportunity', o2.id) asc nulls last,
                      o2.landing_priority desc, o2.published_at desc, o2.id desc
             limit least(greatest(coalesce(p_limit, 3), 1), 24))
         ), '[]'::jsonb) end
$$;

comment on function public.get_landing_opportunities(integer) is
  'PUB-001 : TEASER d''opportunites (addendum §13). Ni description, ni remuneration, ni contact, ni URL de candidature. Depuis 0113 : "image" porte un visuel optionnel de la mediatheque publique.';

-- ---------------------------------------------------------------------
-- 6. Verification.
-- ---------------------------------------------------------------------
do $verify$
declare
  v_n            integer;
  v_events_def   text;
  v_opps_def     text;
  v_list_opps    text;
begin
  select pg_get_functiondef(oid) into v_events_def
    from pg_proc where proname = 'get_landing_events' and pronamespace = 'public'::regnamespace;
  select pg_get_functiondef(oid) into v_opps_def
    from pg_proc where proname = 'get_landing_opportunities' and pronamespace = 'public'::regnamespace;
  select pg_get_functiondef(oid) into v_list_opps
    from pg_proc where proname = 'list_cms_opportunities' and pronamespace = 'public'::regnamespace;

  if v_events_def like '%online_url_private%' or v_events_def like '%address%' then
    raise exception '0113: get_landing_events() projette un champ prive';
  end if;
  if v_opps_def like '%description%' or v_opps_def like '%salary%'
     or v_opps_def like '%contact%' or v_opps_def like '%application_url%' then
    raise exception '0113: get_landing_opportunities() projette un champ prive';
  end if;
  if v_list_opps like '%description%' or v_list_opps like '%salary%'
     or v_list_opps like '%contact%' or v_list_opps like '%application_url%' then
    raise exception '0113: list_cms_opportunities() projette un champ prive';
  end if;

  select count(*) into v_n from private.security_baseline_violations();
  if v_n <> 0 then
    raise exception '0113: security_baseline_violations() renvoie % ligne(s)', v_n;
  end if;

  select count(*) into v_n from private.storage_baseline_violations();
  if v_n <> 0 then
    raise exception '0113: storage_baseline_violations() renvoie % ligne(s)', v_n;
  end if;
end
$verify$;
