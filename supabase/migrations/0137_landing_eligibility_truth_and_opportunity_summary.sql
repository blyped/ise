-- =====================================================================
-- 0137 — LA LANDING ET LE CMS DISENT LA MEME CHOSE
-- =====================================================================
--
-- DEUX BUGS DU PORTEUR, UNE MEME RACINE POUR LE PREMIER.
--
-- BUG 1 — « j'ai mis sur le landing, mais ca ne s'affiche pas dans l'encart
-- Evenement ». Constate : l'evenement « Prochaine sortie de la Promo 2027 »
-- est publie, epingle, `landing_visibility = 'visible'` — et commence le
-- 2026-08-14, soit hier. `get_landing_events()` exige `starts_at > now()`.
-- L'evenement est donc legitimement ecarte, mais /cms/evenements continuait
-- d'afficher « Visible sur la landing ». L'ECRAN MENTAIT.
--
-- REGLE TRANCHEE : un evenement PASSE ne parait pas, meme epingle.
--   · une carte d'evenement est une invitation a s'y rendre ; annoncer une
--     date revolue sur une page publique est une desinformation ;
--   · l'epinglage est deja documente comme un override de PLACEMENT borne
--     dans le temps (frCms.events.pinHelp, ADDENDUM §43) : il reordonne
--     l'ensemble eligible, il ne cree pas l'eligibilite. D-128 trace deja
--     cette ligne : publier n'est pas mettre en avant ;
--   · pour celebrer un evenement passe, l'outil existe deja et n'a aucune
--     borne temporelle : une actualite retrospective.
--
-- MAIS LA REGLE ETAIT MAL ECRITE. `starts_at > now()` ecarte aussi un
-- evenement EN COURS (commence hier, se termine demain), qui n'est pas
-- passe. Corrige en `coalesce(ends_at, starts_at) > now()`.
--
-- LE VRAI DEFAUT : DEUX PREDICATS QUI POUVAIENT DIVERGER. La projection
-- decidait dans son `where`, le CMS affichait un drapeau brut. On extrait
-- donc le predicat dans une fonction unique par entite, qui renvoie le
-- MOTIF de non-parution (`null` = paraitra). La projection s'en sert pour
-- filtrer, le CMS pour l'expliquer. Ils ne peuvent plus se contredire.
--
-- BUG 2 — « Aucun petit descriptif ne vient dans l'encart » Opportunite.
-- Constate : `opportunities.summary` est renseigne, mais
-- `get_landing_opportunities()` ne le projetait pas, alors que
-- `get_landing_news()` projette `summary` depuis toujours. Ajoute, a
-- l'identique de la carte Actualite.
--
-- CE QUE 0137 NE FAIT PAS, ET POURQUOI. Le porteur signale aussi que
-- « l'image proposee par l'ISE » n'arrive pas sur l'opportunite. Verification
-- faite : le circuit de proposition de 0132 ne couvre QUE `news` et `event`
-- (`moderate_content_proposal(p_kind)` n'accepte pas d'autre valeur), et
-- `public.opportunities` n'a ni `proposed_cover_path` ni `proposed_cover_alt`.
-- Une opportunite proposee par un membre passe par le circuit anterieur
-- (`publish_opportunity` / `moderate_opportunity`, 0077), qui n'a jamais
-- transporte d'image. Il n'y a donc pas d'image perdue : la voie n'existe
-- pas. L'ouvrir est une evolution a part entiere (colonne, contrainte de
-- portee, politique Storage, formulaire membre, ecran de revue) et non un
-- correctif ; elle n'est pas improvisee ici.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Motif de non-parution — source unique de verite
-- ---------------------------------------------------------------------
-- Les colonnes sont passees en arguments plutot que l'identifiant : la
-- fonction reste inlinable par le planificateur et n'ajoute aucun
-- aller-retour par ligne dans le `where` de la projection.

create or replace function private.landing_event_block_reason(
  p_status             text,
  p_cancelled_at       timestamptz,
  p_visibility         text,
  p_landing_visibility text,
  p_starts_at          timestamptz,
  p_ends_at            timestamptz,
  p_excluded           boolean
) returns text
language sql
stable
set search_path to ''
as $$
  select case
           when p_status is distinct from 'published'          then 'not_published'
           when p_cancelled_at is not null                     then 'cancelled'
           -- Un evenement EN COURS n'est pas passe : on borne sur la fin
           -- quand elle est connue, sur le debut sinon.
           when coalesce(p_ends_at, p_starts_at) <= now()      then 'past'
           when p_visibility is distinct from 'members'        then 'not_members'
           when p_landing_visibility is distinct from 'visible' then 'landing_hidden'
           when coalesce(p_excluded, false)                    then 'excluded'
         end
$$;

comment on function private.landing_event_block_reason(text, timestamptz, text, text, timestamptz, timestamptz, boolean) is
  '0137 — motif pour lequel un evenement ne paraitra PAS sur la landing, ou NULL s''il paraitra. Predicat unique partage par get_landing_events() (qui filtre) et list_cms_events() (qui explique) : les deux ecrans ne peuvent plus se contredire.';

create or replace function private.landing_opportunity_block_reason(
  p_status             text,
  p_visibility         text,
  p_landing_visibility text,
  p_moderation_status  text,
  p_published_at       timestamptz,
  p_deadline           timestamptz,
  p_excluded           boolean
) returns text
language sql
stable
set search_path to ''
as $$
  select case
           when p_status is distinct from 'active'             then 'not_active'
           when coalesce(p_moderation_status, '')
                not in ('not_required', 'approved')            then 'moderation_pending'
           when p_published_at is null
                or p_published_at > now()                      then 'not_published_yet'
           when p_deadline is not null and p_deadline <= now() then 'deadline_passed'
           when p_visibility is distinct from 'members'        then 'not_members'
           when p_landing_visibility is distinct from 'visible' then 'landing_hidden'
           when coalesce(p_excluded, false)                    then 'excluded'
         end
$$;

comment on function private.landing_opportunity_block_reason(text, text, text, text, timestamptz, timestamptz, boolean) is
  '0137 — miroir de landing_event_block_reason pour les opportunites.';

-- `create function` accorde EXECUTE a PUBLIC par defaut, donc a `anon` et
-- `authenticated` : `private.security_baseline_violations()` le refuse, et
-- avec raison. Seules les projections `public-safe` de la liste blanche ont
-- le droit d'etre appelables par un visiteur anonyme. Ces deux predicats
-- sont des rouages internes, appeles uniquement depuis des fonctions
-- SECURITY DEFINER qui s'executent avec les droits du proprietaire.

revoke all on function private.landing_event_block_reason(
  text, timestamptz, text, text, timestamptz, timestamptz, boolean) from public, anon, authenticated;

revoke all on function private.landing_opportunity_block_reason(
  text, text, text, text, timestamptz, timestamptz, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Projection landing des evenements — meme predicat, borne corrigee
-- ---------------------------------------------------------------------

create or replace function public.get_landing_events(p_limit integer default 3)
returns jsonb
language sql
stable security definer
set search_path to ''
as $function$
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
               and private.landing_event_block_reason(
                     e2.status, e2.cancelled_at, e2.visibility, e2.landing_visibility,
                     e2.starts_at, e2.ends_at,
                     private.landing_is_excluded('events', 'event', e2.id)) is null
             order by private.landing_override_position('events', 'event', e2.id) asc nulls last,
                      e2.landing_priority desc, e2.starts_at asc, e2.id desc
             limit least(greatest(coalesce(p_limit, 3), 1), 24))
         ), '[]'::jsonb) end
$function$;

-- ---------------------------------------------------------------------
-- 3. Projection landing des opportunites — meme predicat + `summary`
-- ---------------------------------------------------------------------
-- `summary` est le resume public deja saisi dans le module Opportunites.
-- Il est projete exactement comme `news.summary` l'est depuis l'origine :
-- la carte Opportunite pourra enfin dire de quoi il s'agit. Ni la
-- description longue, ni la remuneration, ni le contact ne suivent.

create or replace function public.get_landing_opportunities(p_limit integer default 3)
returns jsonb
language sql
stable security definer
set search_path to ''
as $function$
  select case when private.landing_section_hidden('opportunities') then '[]'::jsonb
         else coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id',              o.id,
                    'entity_type',     'opportunity',
                    'title',           o.title,
                    'summary',         o.summary,
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
               and private.landing_opportunity_block_reason(
                     o2.status, o2.visibility, o2.landing_visibility,
                     o2.moderation_status, o2.published_at, o2.deadline,
                     private.landing_is_excluded('opportunities', 'opportunity', o2.id)) is null
             order by private.landing_override_position('opportunities', 'opportunity', o2.id) asc nulls last,
                      o2.landing_priority desc, o2.published_at desc, o2.id desc
             limit least(greatest(coalesce(p_limit, 3), 1), 24))
         ), '[]'::jsonb) end
$function$;

-- ---------------------------------------------------------------------
-- 4. Le CMS expose le motif — il ne peut plus annoncer une contre-verite
-- ---------------------------------------------------------------------

create or replace function public.list_cms_events(
  p_query text default null, p_limit integer default 25, p_offset integer default 0)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
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
           -- 0137 — aligne sur la projection : un evenement EN COURS reste
           -- « a venir » tant qu'il n'est pas termine.
           (coalesce(e.ends_at, e.starts_at) > now()) as is_upcoming,
           -- 0137 — NULL si la landing l'affichera reellement.
           private.landing_event_block_reason(
             e.status, e.cancelled_at, e.visibility, e.landing_visibility,
             e.starts_at, e.ends_at,
             private.landing_is_excluded('events', 'event', e.id)) as landing_blocked_reason,
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
$function$;

create or replace function public.list_cms_opportunities(
  p_query text default null, p_limit integer default 25, p_offset integer default 0)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
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
           -- 0137 — le CMS montre le resume que la carte affichera desormais.
           o.summary,
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
           private.landing_opportunity_block_reason(
             o.status, o.visibility, o.landing_visibility,
             o.moderation_status, o.published_at, o.deadline,
             private.landing_is_excluded('opportunities', 'opportunity', o.id)) as landing_blocked_reason,
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
$function$;

commit;
