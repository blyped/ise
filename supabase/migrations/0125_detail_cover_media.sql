-- =============================================================================
-- 0125 — Image de couverture sur les pages de detail (evenement, opportunite)
-- =============================================================================
--
-- D-174. `events.cover_media_id` et `opportunities.cover_media_id` existent
-- depuis 0113 (D-166) et alimentent deja les cartes de la page d'accueil, mais
-- `private.event_card()` et `private.opportunity_card()` ne les projetaient
-- pas : la page de detail affichait donc un contenu sans visuel alors que le
-- visuel etait deja choisi et stocke. Exactement le meme ecart que celui
-- corrige pour les actualites en 0117 (D-172).
--
-- Les deux fonctions sont recreees a l'identique de leur definition d'origine
-- (0074 et 0056), a la seule difference de la cle `cover`, resolue par
-- `private.landing_media()` — la meme fonction que `get_landing_events()` et
-- `get_landing_opportunities()`, ce qui garantit les memes garde-fous : bucket
-- `landing-media` et alternative textuelle non vide, sinon `null` et aucune
-- balise image emise (D-136).
--
-- Aucun champ « image mobile » n'est ajoute : une seule image par contenu,
-- servie en plusieurs resolutions par `next/image` (D-138, D-172).
-- =============================================================================

create or replace function private.event_card(p_event uuid, p_full boolean default false)
returns jsonb language plpgsql stable security definer set search_path = ''
as $fn$
declare v_me uuid := private.current_profile_id(); v_row record; v_out jsonb; v_reg record;
begin
  if p_event is null or not private.can_see_event(p_event) then return null; end if;
  select e.id, e.event_type_code, e.title, e.slug, e.description, e.target_audience,
         e.organizer_type, e.organizer_profile_id, e.organizer_promotion_id,
         e.organizer_community_id, e.organizer_project_id, e.organizer_external_name,
         e.format, e.country_code, e.city, e.venue_name, e.address,
         e.online_url_visibility, e.starts_at, e.ends_at, e.timezone, e.capacity,
         e.registration_policy, e.attendee_list_visibility, e.visibility, e.status,
         e.published_at, e.cancelled_at, e.cancellation_reason, e.completed_at,
         e.landing_visibility, e.cover_media_id, e.created_at
    into v_row
  from public.events e where e.id = p_event and e.deleted_at is null;
  if not found then return null; end if;

  select r.status, r.registered_at, r.is_listed, r.attended_at into v_reg
    from public.event_registrations r where r.event_id = p_event and r.profile_id = v_me;

  v_out := jsonb_build_object(
    'event_id', v_row.id, 'event_type_code', v_row.event_type_code,
    'event_type_name', (select t.name from public.event_types t where t.code = v_row.event_type_code),
    'title', v_row.title, 'slug', v_row.slug, 'format', v_row.format,
    'country_code', v_row.country_code,
    'country', (select c.name_fr from public.countries c where c.code = v_row.country_code),
    'city', v_row.city, 'venue_name', v_row.venue_name,
    'starts_at', v_row.starts_at, 'ends_at', v_row.ends_at, 'timezone', v_row.timezone,
    'capacity', v_row.capacity, 'registration_policy', v_row.registration_policy,
    'visibility', v_row.visibility, 'status', v_row.status,
    'published_at', v_row.published_at, 'cancelled_at', v_row.cancelled_at,
    'completed_at', v_row.completed_at, 'created_at', v_row.created_at,
    'landing_visibility', v_row.landing_visibility,
    -- D-174 : meme visuel unique que la carte d'accueil, resolu par la meme
    -- fonction que les evenements de la vitrine (D-166). Aucun second
    -- televersement, aucune variante mobile distincte.
    'cover', private.landing_media(v_row.cover_media_id),
    'organizer_type', v_row.organizer_type,
    'organizer_label', coalesce(
      (select c.name from public.communities c where c.id = v_row.organizer_community_id),
      (select concat_ws(' ', pr.program_code, pr.graduation_year::text)
         from public.promotions pr where pr.id = v_row.organizer_promotion_id),
      v_row.organizer_external_name,
      (select coalesce(p.display_name, concat_ws(' ', p.first_name, p.last_name))
         from public.ise_profiles p where p.id = v_row.organizer_profile_id)),
    'is_organizer', private.is_event_organizer(p_event),
    'registered_count', (select count(*) from public.event_registrations r
                          where r.event_id = p_event and r.status in ('registered','attended')),
    'known_registered_count', (select count(*) from public.event_registrations r
                                 join public.connections cn
                                   on (cn.profile_a_id = r.profile_id and cn.profile_b_id = v_me)
                                   or (cn.profile_b_id = r.profile_id and cn.profile_a_id = v_me)
                                where r.event_id = p_event and r.status in ('registered','attended')
                                  and r.is_listed),
    'my_registration', case when v_reg.status is null then null
                            else jsonb_build_object('status', v_reg.status,
                                   'registered_at', v_reg.registered_at,
                                   'is_listed', v_reg.is_listed,
                                   'attended_at', v_reg.attended_at) end,
    'online_url_visibility', v_row.online_url_visibility,
    'online_url_available', (v_row.format <> 'in_person'
                             and (private.is_event_organizer(p_event)
                                  or v_row.online_url_visibility = 'all_viewers'
                                  or private.is_event_registered(p_event))));

  if p_full then
    v_out := v_out || jsonb_build_object(
      'description', v_row.description, 'target_audience', v_row.target_audience,
      'address', case when private.is_event_registered(p_event) or private.is_event_organizer(p_event)
                      then v_row.address else null end,
      'cancellation_reason', v_row.cancellation_reason,
      'attendee_list_visibility', v_row.attendee_list_visibility,
      'agenda', coalesce((select jsonb_agg(jsonb_build_object('item_id', a.id, 'starts_at', a.starts_at,
                                   'title', a.title, 'description', a.description)
                                 order by a.sort_order, a.starts_at)
                            from public.event_agenda_items a where a.event_id = p_event), '[]'::jsonb),
      'speakers', coalesce((select jsonb_agg(jsonb_build_object(
                              'speaker_id', s.id, 'speaker_role', s.speaker_role, 'status', s.status,
                              'external_name', s.external_name, 'external_title', s.external_title,
                              'external_organization', s.external_organization,
                              'profile', private.network_profile_card(s.profile_id))
                            order by s.sort_order)
                              from public.event_speakers s
                             where s.event_id = p_event and s.status in ('invited','confirmed')), '[]'::jsonb),
      'questions', coalesce((select jsonb_agg(jsonb_build_object('question_id', q.id,
                                     'question', q.question, 'is_required', q.is_required)
                                   order by q.sort_order)
                               from public.event_questions q where q.event_id = p_event), '[]'::jsonb),
      'communities', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name)
                                 from public.event_communities ec
                                 join public.communities c on c.id = ec.community_id
                                where ec.event_id = p_event), '[]'::jsonb),
      'known_attendees', coalesce((select jsonb_agg(private.network_profile_card(r.profile_id))
                                     from public.event_registrations r
                                     join public.connections cn
                                       on (cn.profile_a_id = r.profile_id and cn.profile_b_id = v_me)
                                       or (cn.profile_b_id = r.profile_id and cn.profile_a_id = v_me)
                                    where r.event_id = p_event and r.is_listed
                                      and r.status in ('registered','attended')
                                      and private.network_profile_card(r.profile_id) is not null), '[]'::jsonb));
  end if;
  return v_out;
end
$fn$;

create or replace function private.opportunity_card(p_opportunity uuid, p_full boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me  uuid := private.current_profile_id();
  v_o   public.opportunities;
  v_out jsonb;
begin
  select * into v_o from public.opportunities where id = p_opportunity;
  if not found then return null; end if;

  v_out := jsonb_build_object(
    'opportunity_id',   v_o.id,
    'opportunity_type', v_o.opportunity_type,
    'contract_type',    v_o.contract_type,
    'title',            v_o.title,
    'summary',          v_o.summary,
    'status',           v_o.status,
    'moderation_status',v_o.moderation_status,
    'visibility',       v_o.visibility,
    'origin',           v_o.origin,
    'source_type',      v_o.source_type,
    'source_verified',  (v_o.source_verified_at is not null),
    'organization',     coalesce((select org.canonical_name from public.organizations org
                                   where org.id = v_o.organization_id),
                                 v_o.organization_name_raw),
    'country',          (select cn.name_fr from public.countries cn where cn.code = v_o.country_code),
    'city',             v_o.city,
    'remote_mode',      v_o.remote_mode,
    'remote_allowed',   v_o.remote_allowed,
    'sector',           (select s.name from public.sectors s where s.id = v_o.sector_id),
    'job_function',     (select f.name from public.job_functions f where f.id = v_o.job_function_id),
    'experience_level', v_o.experience_level,
    'min_experience_years', v_o.min_experience_years,
    'suitable_for_new_graduates', v_o.suitable_for_new_graduates,
    'start_date',       v_o.start_date,
    'duration_days',    v_o.duration_days,
    'deadline',         v_o.deadline,
    'positions_count',  v_o.positions_count,
    'published_at',     v_o.published_at,
    'created_at',       v_o.created_at,
    -- D-174 : voir event_card, meme raisonnement.
    'cover',            private.landing_media(v_o.cover_media_id),
    'closed_at',        v_o.closed_at,
    'application_mode', v_o.application_mode,
    -- D-55 : seul le mode `internal` permet a la plateforme de constater
    -- le resultat. Partout ailleurs, elle ne peut que renvoyer vers la
    -- source et attendre la declaration du membre.
    'can_apply_internally', (v_o.application_mode = 'internal'),
    'is_manager',       private.is_opportunity_manager(v_o.id),
    'author',           private.network_profile_card(v_o.author_profile_id),
    'skills',           coalesce((select jsonb_agg(jsonb_build_object('name', s.name,
                                                                     'importance', os.importance)
                                                   order by os.importance, s.name)
                                    from public.opportunity_skills os
                                    join public.skills s on s.id = os.skill_id
                                   where os.opportunity_id = v_o.id), '[]'::jsonb),
    'is_saved',         exists (select 1 from public.saved_opportunities sv
                                 where sv.opportunity_id = v_o.id and sv.profile_id = v_me),
    -- Le libelle qualitatif et les raisons, jamais le score (D-42, D-43).
    'relevance',        (select jsonb_build_object('label', m.relevance_label, 'reasons', m.reasons)
                           from public.opportunity_matches m
                          where m.opportunity_id = v_o.id and m.profile_id = v_me),
    'my_application',   (select jsonb_build_object(
                                  'application_id',   a.id,
                                  'status',           a.status,
                                  'channel',          a.channel,
                                  'is_self_declared', a.is_self_declared,
                                  'submitted_at',     a.submitted_at)
                           from public.applications a
                          where a.opportunity_id = v_o.id and a.applicant_profile_id = v_me));

  if v_o.compensation_disclosed then
    v_out := v_out || jsonb_build_object(
      'compensation_min', v_o.compensation_min,
      'compensation_max', v_o.compensation_max,
      'currency',         v_o.currency);
  end if;

  if v_o.application_mode = 'external_url' then
    v_out := v_out || jsonb_build_object('external_application_url', v_o.external_application_url);
  end if;
  if v_o.application_mode = 'external_email' then
    v_out := v_out || jsonb_build_object('external_application_email', v_o.external_application_email);
  end if;
  if v_o.application_mode = 'contact_recruiter' then
    v_out := v_out || jsonb_build_object(
      'contact', private.network_profile_card(v_o.contact_profile_id));
  end if;

  if p_full then
    v_out := v_out || jsonb_build_object(
      'description', v_o.description,
      'source_url',  case when v_o.origin = 'external' then v_o.source_url end,
      'tools',     coalesce((select jsonb_agg(jsonb_build_object('name', t.name,
                                                                'importance', ot.importance)
                                              order by ot.importance, t.name)
                               from public.opportunity_tools ot
                               join public.tools t on t.id = ot.tool_id
                              where ot.opportunity_id = v_o.id), '[]'::jsonb),
      'languages', coalesce((select jsonb_agg(jsonb_build_object('name', lg.name_fr,
                                                                'min_proficiency', ol.min_proficiency,
                                                                'importance', ol.importance)
                                              order by ol.importance, lg.name_fr)
                               from public.opportunity_languages ol
                               join public.languages lg on lg.code = ol.language_code
                              where ol.opportunity_id = v_o.id), '[]'::jsonb),
      'countries', coalesce((select jsonb_agg(jsonb_build_object('name', cn.name_fr,
                                                                'scope', oc.scope,
                                                                'importance', oc.importance)
                                              order by oc.scope, cn.name_fr)
                               from public.opportunity_countries oc
                               join public.countries cn on cn.code = oc.country_code
                              where oc.opportunity_id = v_o.id), '[]'::jsonb),
      'questions', coalesce((select jsonb_agg(jsonb_build_object('question_id', q.id,
                                                                'question', q.question,
                                                                'is_required', q.is_required)
                                              order by q.display_order)
                               from public.opportunity_questions q
                              where q.opportunity_id = v_o.id), '[]'::jsonb),
      'audience_promotions', coalesce((select jsonb_agg(concat_ws(' ', pr.program_code,
                                                                  pr.graduation_year::text)
                                                        order by pr.graduation_year)
                                         from public.opportunity_audience_promotions ap
                                         join public.promotions pr on pr.id = ap.promotion_id
                                        where ap.opportunity_id = v_o.id), '[]'::jsonb),
      'outcome', (select jsonb_build_object(
                           'outcome_type',            oo.outcome_type,
                           'hires_count',             oo.hires_count,
                           'facilitated_by_platform', oo.facilitated_by_platform,
                           'attribution_level',       oo.attribution_level,
                           'notes',                   oo.notes)
                    from public.opportunity_outcomes oo where oo.opportunity_id = v_o.id));
  end if;

  return v_out;
end
$fn$;
