-- =====================================================================
-- 0074_news_events_api
--
-- Couche base de donnees de la tranche ACTUALITES & EVENEMENTS
-- (ISE-092 -> ISE-096). Tables 0013, politiques 0046 : ni l'une ni
-- l'autre n'est modifiee.
--
-- INVARIANTS TENUS ICI
--  * `news` et `events` alimentent AUSSI la vitrine publique
--    (docs/cms.md). Les lectures projettent `landing_visibility` pour que
--    l'interface membre puisse le DIRE explicitement ; aucune ecriture
--    ne la touche. Rendre un contenu visible du web ouvert exige
--    `cms.publish` et passe par `public.set_landing_exposure()` (D-131).
--  * `news.editorial_status` n'est JAMAIS ecrit depuis l'espace membre
--    (D-128). Aucune fonction de ce fichier ne le modifie.
--  * `events.online_url_private` n'est JAMAIS projete : ni dans
--    `private.event_card`, ni ailleurs. Le lien se lit uniquement par
--    `public.get_event_online_url()` (0046, privilege de colonne).
--    Les colonnes d'`events` sont enumerees une par une : aucun
--    `select *` n'est possible sur cette table depuis 0046.
--  * Aucune presence auto-declaree : `register_to_event` n'ecrit jamais
--    `attended` (D-55, cas E11 de `0011_news_events_suite.sql`).
--  * ISE-096 ne fabrique aucun chiffre : chaque valeur est un decompte
--    de lignes reellement ecrites, ou `null` (MASTER PROMPT 98).
--
-- References : MASTER PROMPT 15, 27, 43, 47, 53, 98, 100, 101, 113 ;
--              D-44, D-55, D-73, D-93, D-101, D-102, D-123, D-128,
--              D-131 ; docs/rls.md 10.7 ; docs/cms.md.
-- =====================================================================

insert into public.domain_event_types (code, description, aggregate, sort_order) values
  ('event.registration_cancelled', 'Un membre a annule son inscription a un evenement.',              'event', 130),
  ('event.outcome_declared',       'Un participant a declare une suite concrete apres un evenement.', 'event', 131)
on conflict (code) do nothing;


-- ---------------------------------------------------------------------
-- ISE-096 : le PARTICIPANT declare SES suites.
--
-- 0046 reservait `event_outcomes` a l'organisateur. La maquette
-- « Apres l'evenement » est pourtant celle du participant : sans ces
-- politiques, l'ecran n'aurait rien a ecrire ni rien a lire. Trois
-- politiques additives, strictement personnelles — elles n'ouvrent
-- aucune declaration d'autrui, et la politique d'origine
-- (`event_outcomes_select`, organisateur / `analytics.read`) reste
-- inchangee.
-- ---------------------------------------------------------------------
drop policy if exists event_outcomes_declare_own on public.event_outcomes;
create policy event_outcomes_declare_own on public.event_outcomes
  for insert to authenticated
  with check (declared_by_profile_id = private.current_profile_id()
              and private.is_event_registered(event_id)
              and private.can_see_event(event_id));

drop policy if exists event_outcomes_select_own on public.event_outcomes;
create policy event_outcomes_select_own on public.event_outcomes
  for select to authenticated
  using (declared_by_profile_id = private.current_profile_id());

drop policy if exists event_outcomes_delete_own on public.event_outcomes;
create policy event_outcomes_delete_own on public.event_outcomes
  for delete to authenticated
  using (declared_by_profile_id = private.current_profile_id());

create index if not exists event_outcomes_declared_by_idx
  on public.event_outcomes (declared_by_profile_id, event_id, declared_at desc);
create index if not exists news_published_idx
  on public.news (published_at desc, id desc) where deleted_at is null;
create index if not exists events_starts_at_idx
  on public.events (starts_at desc, id desc) where deleted_at is null;


-- ---------------------------------------------------------------------
-- private.news_card(p_news, p_full)
-- ---------------------------------------------------------------------
create or replace function private.news_card(p_news uuid, p_full boolean default false)
returns jsonb language plpgsql stable security definer set search_path = ''
as $fn$
declare v_me uuid := private.current_profile_id(); v_row record; v_out jsonb;
begin
  if p_news is null or not private.can_see_news(p_news) then return null; end if;
  select n.id, n.category_code, n.title, n.slug, n.summary, n.body, n.event_date,
         n.image_path, n.source_type, n.source_url, n.visibility, n.promotion_id,
         n.community_id, n.is_featured, n.editorial_status, n.published_at,
         n.submitted_by_profile_id, n.landing_visibility, n.created_at
    into v_row
  from public.news n where n.id = p_news and n.deleted_at is null;
  if not found then return null; end if;

  v_out := jsonb_build_object(
    'news_id', v_row.id, 'category_code', v_row.category_code,
    'category_name', (select c.name from public.news_categories c where c.code = v_row.category_code),
    'title', v_row.title, 'slug', v_row.slug, 'summary', v_row.summary,
    'event_date', v_row.event_date, 'image_path', v_row.image_path,
    'source_type', v_row.source_type, 'source_url', v_row.source_url,
    'visibility', v_row.visibility, 'is_featured', v_row.is_featured,
    'editorial_status', v_row.editorial_status, 'published_at', v_row.published_at,
    'created_at', v_row.created_at,
    'is_submitter', (v_row.submitted_by_profile_id = v_me),
    -- Fait editorial affiche tel quel par l'interface (D-123, D-131).
    'landing_visibility', v_row.landing_visibility,
    'promotion', (select concat_ws(' ', pr.program_code, pr.graduation_year::text)
                    from public.promotions pr where pr.id = v_row.promotion_id),
    'community', (select c.name from public.communities c where c.id = v_row.community_id),
    'profiles', coalesce((select jsonb_agg(private.network_profile_card(np.profile_id)
                                           || jsonb_build_object('profile_role', np.profile_role))
                            from public.news_profiles np
                           where np.news_id = p_news
                             and private.network_profile_card(np.profile_id) is not null), '[]'::jsonb),
    'skills', coalesce((select jsonb_agg(s.name order by s.name)
                          from public.news_skills ns join public.skills s on s.id = ns.skill_id
                         where ns.news_id = p_news), '[]'::jsonb));

  if p_full then
    v_out := v_out || jsonb_build_object(
      'body', v_row.body,
      'organizations', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.canonical_name)
                                                  order by o.canonical_name)
                                   from public.news_organizations no2
                                   join public.organizations o on o.id = no2.organization_id
                                  where no2.news_id = p_news), '[]'::jsonb),
      'communities', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name)
                                 from public.news_communities nc
                                 join public.communities c on c.id = nc.community_id
                                where nc.news_id = p_news), '[]'::jsonb),
      'sources', coalesce((select jsonb_agg(jsonb_build_object('source_type', s.source_type,
                                     'source_url', s.source_url, 'title', s.title,
                                     'verified_at', s.verified_at) order by s.created_at)
                             from public.news_sources s where s.news_id = p_news), '[]'::jsonb),
      -- Trois actualites connexes au maximum (DIGEST D 6.8, F 29).
      'related', coalesce((select jsonb_agg(jsonb_build_object('news_id', r.id, 'title', r.title,
                                     'category_code', r.category_code, 'published_at', r.published_at)
                                   order by r.published_at desc)
                             from (select n2.id, n2.title, n2.category_code, n2.published_at
                                     from public.news n2
                                    where n2.id <> p_news and n2.deleted_at is null
                                      and n2.editorial_status = 'published'
                                      and n2.category_code = v_row.category_code
                                      and private.can_see_news(n2.id)
                                    order by n2.published_at desc limit 3) r), '[]'::jsonb));
  end if;
  return v_out;
end
$fn$;
revoke all on function private.news_card(uuid, boolean) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- private.event_card(p_event, p_full)
--
-- `online_url_private` n'apparait PAS dans la liste des colonnes lues.
-- Seul un booleen `online_url_available` sort ; l'URL elle-meme passe
-- par `public.get_event_online_url()`.
-- ---------------------------------------------------------------------
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
         e.landing_visibility, e.created_at
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
revoke all on function private.event_card(uuid, boolean) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- ISE-092 — fil mixte actualites + evenements, curseur chronologique.
--
-- La maquette montre un fil unique ou cohabitent une prise de poste, un
-- evenement et une ressource. Deux listes separees auraient oblige a
-- inventer un ordre d'entrelacement cote client ; une union keyset le
-- fait en base, avec la meme regle de tri partout (D-44).
-- ---------------------------------------------------------------------
create or replace function public.list_network_feed(
  p_scope text default 'for_me', p_query text default null,
  p_cursor text default null, p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_scope text := coalesce(p_scope, 'for_me');
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
  v_rows jsonb := '[]'::jsonb; v_next text; v_c_at timestamptz; v_c_id uuid;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_scope not in ('for_me','network','careers','publications','events') then
    raise exception 'invalid_scope' using errcode = 'P0001'; end if;
  select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

  with entries as (
    select 'news'::text as kind, n.id, coalesce(n.published_at, n.created_at) as at
      from public.news n
     where v_scope <> 'events'
       and n.deleted_at is null and n.editorial_status = 'published'
       and private.can_see_news(n.id)
       and (v_scope <> 'careers' or n.category_code in
              ('appointment','new_position','career_path','distinction','major_mission'))
       and (v_scope <> 'publications' or n.category_code in ('publication','research'))
       -- REGLE ANTI-BULLE (DIGEST D 6.9, U 9) : l'onglet « Pour moi »
       -- conserve toutes les actualites adressees a tout le reseau.
       and (v_scope <> 'for_me' or
            n.visibility = 'members'
            or (n.promotion_id is not null and private.is_in_promotion(n.promotion_id))
            or (n.community_id is not null and private.is_community_member(n.community_id)))
       and (v_q is null or n.title ilike '%' || v_q || '%' or n.summary ilike '%' || v_q || '%')
    union all
    select 'event'::text, e.id, e.starts_at
      from public.events e
     where v_scope in ('for_me','network','events')
       and e.deleted_at is null and e.status in ('published','full','completed')
       and private.can_see_event(e.id)
       and (v_q is null or e.title ilike '%' || v_q || '%')
  ),
  base as (
    select en.kind, en.id, en.at from entries en
     where (v_c_at is null or (en.at, en.id) < (v_c_at, v_c_id))
     order by en.at desc, en.id desc limit v_limit
  )
  select coalesce(jsonb_agg(
           case b.kind when 'news' then jsonb_build_object('kind','news','at',b.at,'news',private.news_card(b.id,false))
                       else jsonb_build_object('kind','event','at',b.at,'event',private.event_card(b.id,false)) end
           order by b.at desc, b.id desc), '[]'::jsonb),
         private.encode_keyset_cursor(min(b.at), (array_agg(b.id order by b.at, b.id))[1])
    into v_rows, v_next from base b;

  if jsonb_array_length(v_rows) < v_limit then v_next := null; end if;
  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$fn$;
revoke all on function public.list_network_feed(text, text, text, integer) from public, anon;
grant execute on function public.list_network_feed(text, text, text, integer) to authenticated;


-- ISE-093.
create or replace function public.get_news(p_news uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$ select private.news_card(p_news, true) $$;
revoke all on function public.get_news(uuid) from public, anon;
grant execute on function public.get_news(uuid) to authenticated;


-- ISE-094.
create or replace function public.list_events(
  p_scope text default 'for_me', p_query text default null, p_format text default null,
  p_country_code char(2) default null, p_cursor text default null, p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_scope text := coalesce(p_scope, 'for_me');
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
  v_country char(2);
  v_rows jsonb := '[]'::jsonb; v_next text; v_c_at timestamptz; v_c_id uuid;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if v_scope not in ('for_me','upcoming','online','nearby','mine','past') then
    raise exception 'invalid_scope' using errcode = 'P0001'; end if;
  select p.current_country_code into v_country from public.ise_profiles p where p.id = v_me;
  select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

  with base as (
    select e.id, e.starts_at as at
      from public.events e
     where e.deleted_at is null and private.can_see_event(e.id)
       and e.status in ('published','full','completed','cancelled')
       and case v_scope
             when 'past' then e.starts_at < now()
             when 'mine' then private.is_event_registered(e.id) or private.is_event_organizer(e.id)
             else e.starts_at >= now() - interval '2 hours'
           end
       and (v_scope <> 'online' or e.format in ('online','hybrid'))
       and (v_scope <> 'nearby' or (v_country is not null and e.country_code = v_country))
       and (v_scope <> 'for_me' or
            e.visibility = 'members'
            or (e.organizer_community_id is not null and private.is_community_member(e.organizer_community_id))
            or (e.organizer_promotion_id is not null and private.is_in_promotion(e.organizer_promotion_id))
            or (v_country is not null and e.country_code = v_country))
       and (p_format is null or e.format = p_format)
       and (p_country_code is null or e.country_code = p_country_code)
       and (v_q is null or e.title ilike '%' || v_q || '%' or coalesce(e.city, '') ilike '%' || v_q || '%')
       and (v_c_at is null or (e.starts_at, e.id) < (v_c_at, v_c_id))
     order by e.starts_at desc, e.id desc limit v_limit)
  select coalesce(jsonb_agg(private.event_card(b.id, false) order by b.at desc, b.id desc), '[]'::jsonb),
         private.encode_keyset_cursor(min(b.at), (array_agg(b.id order by b.at, b.id))[1])
    into v_rows, v_next from base b;

  if jsonb_array_length(v_rows) < v_limit then v_next := null; end if;
  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$fn$;
revoke all on function public.list_events(text, text, text, char(2), text, integer) from public, anon;
grant execute on function public.list_events(text, text, text, char(2), text, integer) to authenticated;


-- ISE-095.
create or replace function public.get_event(p_event uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$ select private.event_card(p_event, true) $$;
revoke all on function public.get_event(uuid) from public, anon;
grant execute on function public.get_event(uuid) to authenticated;


-- Inscription en un clic (DIGEST D 6.8, U 75). Ne pose JAMAIS `attended`.
create or replace function public.register_to_event(p_event uuid, p_answers jsonb default '[]'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
  v_row record; v_status text; v_taken integer; v_answer jsonb;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not private.is_active_member() then raise exception 'not_active_member' using errcode = '42501'; end if;
  if not private.can_see_event(p_event) then
    raise exception 'event_not_visible' using errcode = '42501'; end if;

  select e.registration_policy, e.capacity, e.status, e.starts_at into v_row
    from public.events e where e.id = p_event and e.deleted_at is null;
  if v_row.status is null then raise exception 'event_not_found' using errcode = 'P0001'; end if;
  if v_row.status in ('cancelled','archived') then
    raise exception 'event_closed' using errcode = 'P0001'; end if;
  if v_row.registration_policy = 'none' then
    raise exception 'registration_not_required' using errcode = 'P0001'; end if;

  select count(*) into v_taken from public.event_registrations r
   where r.event_id = p_event and r.status in ('registered','attended');

  v_status := case
                when v_row.registration_policy = 'approval_required' then 'pending_approval'
                when v_row.capacity is not null and v_taken >= v_row.capacity then 'waitlisted'
                else 'registered'
              end;

  insert into public.event_registrations as er (event_id, profile_id, status, registered_at, is_listed)
  values (p_event, v_me, v_status, clock_timestamp(), true)
  on conflict (event_id, profile_id) do update
    set status = case when er.status = 'attended' then er.status else excluded.status end,
        cancelled_at = null,
        registered_at = coalesce(er.registered_at, excluded.registered_at);

  if jsonb_typeof(p_answers) = 'array' then
    for v_answer in select * from jsonb_array_elements(p_answers) loop
      insert into public.event_registration_answers (event_id, profile_id, question_id, answer)
      select p_event, v_me, q.id, nullif(btrim(coalesce(v_answer ->> 'answer', '')), '')
        from public.event_questions q
       where q.event_id = p_event and q.id = (v_answer ->> 'question_id')::uuid
      on conflict (event_id, profile_id, question_id) do update set answer = excluded.answer;
    end loop;
  end if;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('event.registration_created', 'event', p_event, v_me,
          jsonb_build_object('status', v_status));

  return jsonb_build_object('status', v_status);
end
$fn$;
revoke all on function public.register_to_event(uuid, jsonb) from public, anon;
grant execute on function public.register_to_event(uuid, jsonb) to authenticated;


create or replace function public.cancel_event_registration(p_event uuid)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $fn$
declare v_me uuid := private.current_profile_id(); v_n integer;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update public.event_registrations
     set status = 'cancelled', cancelled_at = clock_timestamp()
   where event_id = p_event and profile_id = v_me
     and status in ('registered','pending_approval','waitlisted');
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'no_registration_to_cancel' using errcode = 'P0001'; end if;
  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('event.registration_cancelled', 'event', p_event, v_me, '{}'::jsonb);
  return jsonb_build_object('status', 'cancelled');
end
$fn$;
revoke all on function public.cancel_event_registration(uuid) from public, anon;
grant execute on function public.cancel_event_registration(uuid) to authenticated;


-- Apparaitre ou non dans la liste des inscrits (D-73 transpose aux evenements).
create or replace function public.set_event_registration_listed(p_event uuid, p_listed boolean)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $fn$
declare v_me uuid := private.current_profile_id(); v_n integer;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update public.event_registrations set is_listed = coalesce(p_listed, true)
   where event_id = p_event and profile_id = v_me;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'no_registration' using errcode = 'P0001'; end if;
  return jsonb_build_object('is_listed', coalesce(p_listed, true));
end
$fn$;
revoke all on function public.set_event_registration_listed(uuid, boolean) from public, anon;
grant execute on function public.set_event_registration_listed(uuid, boolean) to authenticated;


-- ---------------------------------------------------------------------
-- ISE-096 — apres l'evenement.
--
-- AUCUN chiffre invente : chaque valeur est un decompte de lignes
-- reellement ecrites, ou `null`. L'instantane d'impact global
-- (`event_impact_snapshots`) reste reserve a l'organisateur, comme en
-- 0046 ; un participant ne voit que SON impact declare.
-- ---------------------------------------------------------------------
create or replace function public.get_event_followup(p_event uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $fn$
declare v_me uuid := private.current_profile_id(); v_card jsonb;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  v_card := private.event_card(p_event, true);
  if v_card is null then return null; end if;
  if not (private.is_event_registered(p_event) or private.is_event_organizer(p_event)) then
    raise exception 'not_event_participant' using errcode = '42501'; end if;

  return v_card || jsonb_build_object(
    'followup', (select jsonb_build_object('summary', f.summary, 'conclusions', f.conclusions,
                          'decisions', f.decisions, 'next_steps', f.next_steps,
                          'replay_url', f.replay_url, 'published_at', f.published_at)
                   from public.event_followups f
                  where f.id = p_event
                    and (f.published_at is not null or private.is_event_organizer(p_event))),
    'resources', coalesce((select jsonb_agg(jsonb_build_object('resource_id', r.id, 'title', r.title,
                                   'resource_type', r.resource_type, 'external_url', r.external_url,
                                   'storage_path', r.storage_path) order by r.sort_order, r.title)
                             from public.event_resources r
                            where r.event_id = p_event
                              and (private.is_event_organizer(p_event)
                                   or case r.visibility
                                        when 'members' then true
                                        when 'registered' then private.is_event_registered(p_event)
                                        else false end)), '[]'::jsonb),
    'my_outcomes', coalesce((select jsonb_agg(jsonb_build_object('outcome_id', o.id,
                                    'outcome_type', o.outcome_type,
                                    'target_entity_type', o.target_entity_type,
                                    'target_entity_id', o.target_entity_id,
                                    'notes', o.notes, 'declared_at', o.declared_at,
                                    'target_profile', case when o.target_entity_type = 'profile'
                                                           then private.network_profile_card(o.target_entity_id)
                                                           else null end)
                                  order by o.declared_at desc)
                              from public.event_outcomes o
                             where o.event_id = p_event and o.declared_by_profile_id = v_me), '[]'::jsonb),
    'my_impact', jsonb_build_object(
      'contacts',   (select count(*) from public.event_outcomes o
                      where o.event_id = p_event and o.declared_by_profile_id = v_me
                        and o.outcome_type = 'connection'),
      'follow_ups', (select count(*) from public.event_outcomes o
                      where o.event_id = p_event and o.declared_by_profile_id = v_me
                        and o.outcome_type <> 'connection'),
      'resources',  (select count(*) from public.event_resources r
                      where r.event_id = p_event
                        and (private.is_event_organizer(p_event)
                             or case r.visibility
                                  when 'members' then true
                                  when 'registered' then private.is_event_registered(p_event)
                                  else false end))),
    'event_impact', case when private.is_event_organizer(p_event) then
      (select jsonb_build_object('snapshot_at', s.snapshot_at, 'registered_count', s.registered_count,
                'attended_count', s.attended_count, 'no_show_count', s.no_show_count,
                'promotions_represented', s.promotions_represented,
                'countries_represented', s.countries_represented,
                'connections_created', s.connections_created,
                'projects_initiated', s.projects_initiated,
                'mentorships_initiated', s.mentorships_initiated,
                'resources_produced', s.resources_produced)
         from public.event_impact_snapshots s
        where s.event_id = p_event order by s.snapshot_at desc limit 1)
      else null end);
end
$fn$;
revoke all on function public.get_event_followup(uuid) from public, anon;
grant execute on function public.get_event_followup(uuid) to authenticated;


-- ISE-096 : le participant DECLARE une suite constatee (D-55).
create or replace function public.declare_event_outcome(
  p_event uuid, p_outcome_type text, p_target_entity_type text default null,
  p_target_entity_id uuid default null, p_notes text default null)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $fn$
declare v_me uuid := private.current_profile_id(); v_id uuid;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_outcome_type not in ('working_group','project','news','community_discussion',
                            'connection','publication','mentorship','other') then
    raise exception 'invalid_outcome_type' using errcode = 'P0001'; end if;
  if not (private.is_event_registered(p_event) or private.is_event_organizer(p_event)) then
    raise exception 'not_event_participant' using errcode = '42501'; end if;
  if p_target_entity_type = 'profile' and p_target_entity_id is not null
     and private.is_blocked_between(p_target_entity_id, v_me) then
    raise exception 'blocked_profile' using errcode = '42501'; end if;

  insert into public.event_outcomes
    (event_id, outcome_type, target_entity_type, target_entity_id, notes,
     declared_by_profile_id, declared_at)
  values (p_event, p_outcome_type, p_target_entity_type, p_target_entity_id,
     nullif(btrim(coalesce(p_notes, '')), ''), v_me, clock_timestamp())
  returning id into v_id;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('event.outcome_declared', 'event', p_event, v_me,
          jsonb_build_object('outcome_id', v_id, 'outcome_type', p_outcome_type));
  return jsonb_build_object('outcome_id', v_id);
end
$fn$;
revoke all on function public.declare_event_outcome(uuid, text, text, uuid, text) from public, anon;
grant execute on function public.declare_event_outcome(uuid, text, text, uuid, text) to authenticated;


create or replace function public.delete_event_outcome(p_outcome uuid)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $fn$
declare v_me uuid := private.current_profile_id(); v_n integer;
begin
  if v_me is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  delete from public.event_outcomes where id = p_outcome and declared_by_profile_id = v_me;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'outcome_not_found' using errcode = 'P0001'; end if;
  return jsonb_build_object('deleted', true);
end
$fn$;
revoke all on function public.delete_event_outcome(uuid) from public, anon;
grant execute on function public.delete_event_outcome(uuid) to authenticated;
