-- 0144 — l'« encart Evenement » de l'accueil ne projetait jamais public.events.description
-- (colonne existante depuis 0013, jamais lue par get_landing_events()). Meme role que
-- 0137/opportunities.summary : bref descriptif redige dans le module Evenements, affiche
-- sur la carte de la landing avant les faits (ville, date), comme NewsCard/OpportunityCard.
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
                    'description',     e.description,
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
