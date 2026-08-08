-- =====================================================================
-- supabase/tests/rls/0029_news_events_api_suite.sql
--
-- Suite de la couche API ACTUALITES & EVENEMENTS (migration 0074,
-- ISE-092 -> ISE-096).
--   succes -> ERROR: P0001: NEWS_EVENTS_API_TESTS_OK: 23 cas, 0 echec
--
-- Trois invariants verifies frontalement :
--   * `events.online_url_private` n'est jamais projete, ni par la
--     fonction, ni par un `select` direct, ni par un `select *`
--     (cas E02, E03, E04, E05) ;
--   * un membre ne modifie pas `news.editorial_status` (cas E07, E08) —
--     D-128 ;
--   * ISE-096 ne renvoie que des decomptes reels (cas E18, E19) —
--     MASTER PROMPT 98.
--
-- FIXTURES : Omar (organisateur) · Rita (participante) · Sami (inscrit a
--   un autre evenement seulement). Trois evenements : en ligne a lien
--   reserve, a capacite atteinte, a validation requise. Deux actualites :
--   publiee et en brouillon.
-- =====================================================================

do $ne$
declare
  u_omar uuid:='00000000-0000-4000-8029-000000000001'; u_rita uuid:='00000000-0000-4000-8029-000000000002';
  u_sami uuid:='00000000-0000-4000-8029-000000000003';
  p_omar uuid:='00000000-0000-4000-8029-0000000000a1'; p_rita uuid:='00000000-0000-4000-8029-0000000000a2';
  p_sami uuid:='00000000-0000-4000-8029-0000000000a3';
  ev_on   uuid:='00000000-0000-4000-8029-0000000000b1'; ev_full uuid:='00000000-0000-4000-8029-0000000000b2';
  ev_appr uuid:='00000000-0000-4000-8029-0000000000b3';
  n_pub uuid:='00000000-0000-4000-8029-0000000000c1'; n_draft uuid:='00000000-0000-4000-8029-0000000000c2';
  v_cases integer:=0; v_fail text[]:=array[]::text[]; v_ok boolean; v_j jsonb; v_n bigint; v_t text; v_o uuid;
begin
  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_omar,'authenticated','authenticated','test+neapi.omar@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_rita,'authenticated','authenticated','test+neapi.rita@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_sami,'authenticated','authenticated','test+neapi.sami@ise.test',now(),now());
  insert into public.ise_profiles (id,user_id,first_name,last_name,profile_status,claim_status,claimed_at,is_test_account) values
    (p_omar,u_omar,'Omar','Neapi','active','claimed',now(),true),
    (p_rita,u_rita,'Rita','Neapi','active','claimed',now(),true),
    (p_sami,u_sami,'Sami','Neapi','active','claimed',now(),true);
  insert into public.events (id,event_type_code,title,slug,description,organizer_type,organizer_profile_id,
      format,online_url_private,online_url_visibility,starts_at,ends_at,timezone,capacity,
      registration_policy,attendee_list_visibility,visibility,status,published_at,created_by_profile_id,
      city,landing_visibility) values
    (ev_on,(select code from public.event_types limit 1),'Webinaire de test API','webinaire-test-api-ne',
      'Description du webinaire.','profile',p_omar,'online','https://exemple.test/lien-prive','registered',
      now()+interval '10 days',now()+interval '10 days 2 hours','Africa/Abidjan',null,'required','members',
      'members','published',now(),p_omar,null,'visible'),
    (ev_full,(select code from public.event_types limit 1),'Rencontre complete de test','rencontre-complete-test-ne',
      'Description de la rencontre.','profile',p_omar,'in_person',null,'registered',
      now()+interval '12 days',now()+interval '12 days 3 hours','Africa/Abidjan',1,'required','members',
      'members','published',now(),p_omar,'Abidjan','hidden'),
    (ev_appr,(select code from public.event_types limit 1),'Atelier sur validation de test','atelier-validation-test-ne',
      'Description de l''atelier.','profile',p_omar,'in_person',null,'registered',
      now()+interval '14 days',now()+interval '14 days 2 hours','Africa/Abidjan',null,'approval_required','members',
      'members','published',now(),p_omar,'Dakar','hidden');
  insert into public.event_registrations (event_id,profile_id,status,registered_at,is_listed)
  values (ev_full,p_sami,'registered',now(),true);
  insert into public.news (id,category_code,title,slug,summary,body,visibility,editorial_status,published_at,
      submitted_by_profile_id,third_party_consent,landing_visibility) values
    (n_pub,'publication','Actualite publiee de test','actualite-publiee-test-ne','Resume de test.','Corps.',
      'members','published',now(),p_omar,'public_information','visible'),
    (n_draft,'publication','Actualite en brouillon de test','actualite-brouillon-test-ne','Resume brouillon.','Corps.',
      'members','draft',null,p_omar,'public_information','hidden');

  -- ------------------------------------------------------------------
  -- Rita : membre du reseau, pas encore inscrite.
  -- ------------------------------------------------------------------
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_rita::text,'role','authenticated')::text,true);

  v_j := public.get_event(ev_on); v_cases:=v_cases+1;
  if v_j is null then v_fail:=v_fail||'E01 evenement invisible pour un membre'::text; end if;
  v_cases:=v_cases+1;
  if v_j::text like '%lien-prive%' or (v_j ? 'online_url_private') then
    v_fail:=v_fail||'E02 online_url_private projete par get_event'::text; end if;
  v_cases:=v_cases+1;
  if public.get_event_online_url(ev_on) is not null then
    v_fail:=v_fail||'E03 lien de connexion lu sans inscription'::text; end if;

  begin select e.online_url_private into v_t from public.events e where e.id=ev_on; v_ok:=false;
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||'E04 select direct sur online_url_private accepte'::text; end if;

  begin perform (select row_to_json(e.*) from public.events e where e.id=ev_on); v_ok:=false;
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||'E05 select * sur events accepte'::text; end if;

  -- L'exposition publique est un FAIT que l'interface doit pouvoir dire.
  v_cases:=v_cases+1;
  if v_j->>'landing_visibility' <> 'visible' then
    v_fail:=v_fail||'E06 landing_visibility absent de la projection'::text; end if;

  -- D-128 : le circuit editorial n'est pas pilotable depuis l'espace membre.
  begin
    update public.news set editorial_status='published', published_at=now() where id=n_draft;
    get diagnostics v_n = row_count; v_ok := (v_n = 0);
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||'E07 editorial_status modifie par un membre'::text; end if;
  v_cases:=v_cases+1;
  if exists (select 1 from public.news n where n.id=n_draft and n.editorial_status <> 'draft') then
    v_fail:=v_fail||'E08 editorial_status a change en base'::text; end if;

  v_cases:=v_cases+1;
  if public.get_news(n_draft) is not null then v_fail:=v_fail||'E09 actualite non publiee visible'::text; end if;
  v_cases:=v_cases+1;
  if public.get_news(n_pub) is null then v_fail:=v_fail||'E10 actualite publiee invisible'::text; end if;

  v_j := public.register_to_event(ev_on); v_cases:=v_cases+1;
  if v_j->>'status' <> 'registered' then v_fail:=v_fail||format('E11 inscription : %s',v_j->>'status'); end if;
  v_cases:=v_cases+1;
  if exists (select 1 from public.event_registrations r
              where r.event_id=ev_on and r.profile_id=p_rita and r.status='attended') then
    v_fail:=v_fail||'E12 presence auto-declaree'::text; end if;
  v_cases:=v_cases+1;
  if public.get_event_online_url(ev_on) is null then
    v_fail:=v_fail||'E13 lien de connexion refuse a un inscrit'::text; end if;

  v_j := public.register_to_event(ev_full); v_cases:=v_cases+1;
  if v_j->>'status' <> 'waitlisted' then v_fail:=v_fail||format('E14 capacite atteinte : %s',v_j->>'status'); end if;
  v_j := public.register_to_event(ev_appr); v_cases:=v_cases+1;
  if v_j->>'status' <> 'pending_approval' then v_fail:=v_fail||format('E15 validation requise : %s',v_j->>'status'); end if;

  v_j := public.cancel_event_registration(ev_appr); v_cases:=v_cases+1;
  if v_j->>'status' <> 'cancelled' then v_fail:=v_fail||'E16 annulation refusee'::text; end if;

  v_j := public.declare_event_outcome(ev_on,'connection','profile',p_sami,'Echanger sur la gouvernance data.');
  v_o := (v_j->>'outcome_id')::uuid;
  v_cases:=v_cases+1; if v_o is null then v_fail:=v_fail||'E17 declaration de suite refusee a un inscrit'::text; end if;
  v_j := public.get_event_followup(ev_on); v_cases:=v_cases+1;
  if (v_j->'my_impact'->>'contacts')::int <> 1 then v_fail:=v_fail||'E18 impact declare faux'::text; end if;
  v_cases:=v_cases+1;
  if v_j->>'event_impact' is not null then v_fail:=v_fail||'E19 instantane d''impact global lu par un participant'::text; end if;

  -- ------------------------------------------------------------------
  -- Sami : ni inscrit a `ev_on`, ni organisateur.
  -- ------------------------------------------------------------------
  perform set_config('request.jwt.claims',json_build_object('sub',u_sami::text,'role','authenticated')::text,true);
  begin v_j := public.declare_event_outcome(ev_on,'project',null,null,'Tentative.'); v_ok:=false;
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||'E20 suite declaree par un non-participant'::text; end if;
  begin v_j := public.get_event_followup(ev_on); v_ok:=false;
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||'E21 apres-evenement lu par un non-participant'::text; end if;
  v_cases:=v_cases+1;
  select count(*) into v_n from public.event_outcomes o where o.id=v_o;
  if v_n <> 0 then v_fail:=v_fail||'E22 suite personnelle d''autrui lisible'::text; end if;

  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  v_cases:=v_cases+1;
  if (select count(*) from private.security_baseline_violations()) <> 0 then
    v_fail:=v_fail||'E23 security_baseline_violations() non vide'::text; end if;

  if array_length(v_fail,1) is null then
    raise exception 'NEWS_EVENTS_API_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'NEWS_EVENTS_API_TESTS_FAILED: % cas, % echec(s)\n  - %', v_cases, array_length(v_fail,1), array_to_string(v_fail,E'\n  - ');
  end if;
end
$ne$;
