-- =====================================================================
-- supabase/tests/rls/0026_mentorship_api_suite.sql
--
-- Suite NEGATIVE de la couche API du MENTORAT (migration 0075).
-- Complete 0008, qui teste les POLITIQUES.
--
-- QUATRE INVARIANTS SONT AU COEUR DE CETTE SUITE.
--   1. AUCUN SCORE DE MENTOR N'ATTEINT LE CLIENT (MASTER PROMPT 30,
--      CA-MENT-09) : C04, C06, C23. Les recommandations portent un
--      libelle qualitatif et des raisons, et rien d'autre (C05).
--   2. `alternative_proposed` EST ATTEIGNABLE (D-54) : C10, C11, C12.
--   3. CHACUN PEUT REFUSER SANS JUSTIFICATION ([F 59]) : C14, C15 —
--      et arreter sans negocier ([U 102]) : C20.
--   4. LA CAPACITE EST VERIFIEE COTE SERVEUR ([U 131]) : C13.
--
-- S'y ajoutent les deux confidentialites internes au binome (rls.md
-- 10.4) : la note privee du mentore reste invisible du mentor (C18)
-- alors que la synthese partagee est commune (C19).
--
--   succes  ->  ERROR:  P0001: MENTORSHIP_API_TESTS_OK: N cas, 0 echec
--   echec   ->  ERROR:  P0001: MENTORSHIP_API_TESTS_FAILED: N cas, K echec(s)
--
-- FIXTURES (D-104)
--   Mia  ISE verifiee, mentor de capacite 1
--   Oza  ISE verifie, mentor de capacite 3
--   Lea  mentoree
--   Noe  second mentore, se heurte a la capacite de Mia
-- =====================================================================

do $ment$
declare
  u_mia uuid := '00000000-0000-4000-8030-000000000001';
  u_lea uuid := '00000000-0000-4000-8030-000000000002';
  u_noe uuid := '00000000-0000-4000-8030-000000000003';
  u_oza uuid := '00000000-0000-4000-8030-000000000004';
  p_mia uuid := '00000000-0000-4000-8030-0000000000a1';
  p_lea uuid := '00000000-0000-4000-8030-0000000000a2';
  p_noe uuid := '00000000-0000-4000-8030-0000000000a3';
  p_oza uuid := '00000000-0000-4000-8030-0000000000a4';
  v_a bigint; v_sec bigint; v_sk bigint;
  v_cases integer := 0; v_fail text[] := array[]::text[];
  v_ok boolean; v_msg text; v_json jsonb; v_n bigint; v_req uuid; v_ment uuid; v_ses uuid;
begin
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims','',true);

  select id into v_a from public.promotions order by id limit 1;
  select id into v_sec from public.sectors order by id limit 1;
  select id into v_sk  from public.skills order by id limit 1;

  insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_mia,'authenticated','authenticated','test+ment.mia@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_lea,'authenticated','authenticated','test+ment.lea@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_noe,'authenticated','authenticated','test+ment.noe@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_oza,'authenticated','authenticated','test+ment.oza@ise.test',now(),now());

  insert into public.ise_profiles
    (id,user_id,first_name,last_name,promotion_id,profile_status,claim_status,claimed_at,
     verification_status,is_test_account) values
    (p_mia,u_mia,'Mia','Ment',v_a,'active','claimed',now(),'verified',true),
    (p_oza,u_oza,'Oza','Ment',v_a,'active','claimed',now(),'verified',true),
    (p_lea,u_lea,'Lea','Ment',v_a,'active','claimed',now(),'unverified',true),
    (p_noe,u_noe,'Noe','Ment',v_a,'active','claimed',now(),'unverified',true);

  insert into public.profile_sectors (profile_id, sector_id, is_primary) values
    (p_mia, v_sec, true), (p_oza, v_sec, true);
  insert into public.profile_skills (profile_id, skill_id, level) values
    (p_lea, v_sk, 'intermediate'), (p_noe, v_sk, 'intermediate');

  -- C01 — un profil non verifie ne peut pas activer un profil mentor ([F 95]).
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',u_lea::text,'role','authenticated')::text,true);
  v_msg:=null;
  begin perform public.save_mentor_profile('{"is_active":true}'::jsonb); v_ok:=false;
  exception when others then v_ok:=(sqlerrm='not_authorized'); if not v_ok then v_msg:=sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('C01 '||coalesce(v_msg,'')); end if;

  -- C02 — Mia active son profil mentor, capacite 1.
  perform set_config('request.jwt.claims', json_build_object('sub',u_mia::text,'role','authenticated')::text,true);
  v_json := public.save_mentor_profile(jsonb_build_object(
    'is_active',true,'max_active_mentees',1,'mentor_statement','J''accompagne sur la prise de poste.',
    'preferred_formats',jsonb_build_array('three_months','single_session'),
    'accepted_objectives',jsonb_build_array('career_progression','management_leadership'),
    'preferred_frequency','monthly'));
  v_cases:=v_cases+1;
  if not (v_json->>'is_active')::boolean or not (v_json->>'ongoing_mentorships_unaffected')::boolean then
    v_fail:=v_fail||'C02 l''activation du profil mentor a echoue';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub',u_oza::text,'role','authenticated')::text,true);
  perform public.save_mentor_profile(jsonb_build_object(
    'is_active',true,'max_active_mentees',3,
    'preferred_formats',jsonb_build_array('three_months'),
    'accepted_objectives',jsonb_build_array('career_progression')));

  perform set_config('role','postgres',true);
  insert into public.mentor_domains (mentor_profile_id, skill_id, mentoring_interest)
  values (p_mia, v_sk, 'high'), (p_oza, v_sk, 'high');
  perform set_config('role','authenticated',true);

  -- C03 -> C05 — recommandations : presentes, sans score, avec raisons.
  perform set_config('request.jwt.claims', json_build_object('sub',u_lea::text,'role','authenticated')::text,true);
  perform public.save_mentorship_need(jsonb_build_object(
    'objective_type','career_progression',
    'objective_text','Evoluer vers un poste de responsable Data dans une institution financiere.',
    'preferred_format','three_months','sector_id',v_sec::text,
    'topics',jsonb_build_array('leadership')));

  v_json := public.list_recommended_mentors();
  v_cases:=v_cases+1;
  if jsonb_array_length(v_json->'rows') < 1 then
    v_fail:=v_fail||'C03 aucun mentor recommande alors que les criteres correspondent';
  end if;
  v_cases:=v_cases+1;
  if v_json::text like '%"score"%' then
    v_fail:=v_fail||'C04 un score de mentor atteint le client (MASTER PROMPT 30)';
  end if;
  v_cases:=v_cases+1;
  if (v_json->'rows'->0->'relevance'->>'label') is null
     or jsonb_array_length(v_json->'rows'->0->'relevance'->'reasons') = 0 then
    v_fail:=v_fail||'C05 un mentor est propose sans libelle qualitatif ni raison (D-42, D-43)';
  end if;

  v_json := public.get_mentor_profile(p_mia);
  v_cases:=v_cases+1;
  if v_json::text like '%"score"%' or v_json ? 'rating' or v_json ? 'requests_received' then
    v_fail:=v_fail||'C06 la fiche mentor expose une note ou un decompte de demandes';
  end if;
  v_cases:=v_cases+1;
  if v_json->>'availability' <> 'available' or not (v_json->>'can_request')::boolean then
    v_fail:=v_fail||'C07 la disponibilite du mentor est mal projetee';
  end if;

  -- C08 / C09 — la demande ne cree aucune relation ; une seule par couple.
  v_json := public.submit_mentorship_request(p_mia,'career_progression',
    'Passer d''un poste d''analyste a une fonction de responsable Data.',
    array['practical_advice','interview_prep']::text[], 'three_months','monthly',3::smallint,
    'Je termine une mission de conseil.','Votre parcours correspond a la transition que je prepare.');
  v_req := (v_json->>'request_id')::uuid;
  v_cases:=v_cases+1;
  if v_json->>'status' <> 'pending' or (v_json->>'creates_mentorship')::boolean then
    v_fail:=v_fail||'C08 une relation de mentorat est creee avant l''accord du mentor';
  end if;

  v_msg:=null;
  begin perform public.submit_mentorship_request(p_mia,'career_progression','Deuxieme demande.'); v_ok:=false;
  exception when others then v_ok:=(sqlerrm='request_already_sent'); if not v_ok then v_msg:=sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('C09 '||coalesce(v_msg,'')); end if;

  -- C10 / C11 — « proposer un autre format » (D-54).
  perform set_config('request.jwt.claims', json_build_object('sub',u_mia::text,'role','authenticated')::text,true);
  v_json := public.respond_to_mentorship_request(v_req,'propose_alternative',null,'single_session',
    'Je ne peux pas assurer trois mois, mais une session unique est possible.');
  v_cases:=v_cases+1;
  if v_json->>'status' <> 'alternative_proposed' or v_json->>'alternative_format' <> 'single_session' then
    v_fail:=v_fail||'C10 l''etat alternative_proposed n''est pas atteignable (D-54)';
  end if;
  perform set_config('role','postgres',true);
  select count(*) into v_n from public.mentorship_events e
   where e.request_id = v_req and e.event_type = 'alternative_proposed';
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||'C11 la proposition d''un autre format n''est pas tracee'; end if;
  perform set_config('role','authenticated',true);

  -- C12 — le mentore accepte : le mentorat demarre AU FORMAT PROPOSE.
  perform set_config('request.jwt.claims', json_build_object('sub',u_lea::text,'role','authenticated')::text,true);
  v_json := public.accept_mentorship_alternative(v_req, true);
  v_ment := (v_json->>'mentorship_id')::uuid;
  v_cases:=v_cases+1;
  if v_json->>'status' <> 'accepted' or v_json->>'format' <> 'single_session' or v_ment is null then
    v_fail:=v_fail||'C12 l''acceptation de l''alternative ne cree pas le mentorat au bon format';
  end if;

  -- C13 — capacite atteinte, refus cote serveur ([U 131]).
  perform set_config('request.jwt.claims', json_build_object('sub',u_noe::text,'role','authenticated')::text,true);
  v_msg:=null;
  begin perform public.submit_mentorship_request(p_mia,'career_progression','Je souhaite un accompagnement.');
    v_ok:=false;
  exception when others then v_ok:=(sqlerrm='invalid_transition'); if not v_ok then v_msg:=sqlerrm; end if; end;
  v_cases:=v_cases+1;
  if not v_ok then v_fail:=v_fail||('C13 un mentor a capacite atteinte recoit une demande : '||coalesce(v_msg,'')); end if;

  -- C14 / C15 — un mentor refuse SANS justification.
  v_json := public.submit_mentorship_request(p_oza,'career_progression','Je prepare une transition.');
  v_req := (v_json->>'request_id')::uuid;
  perform set_config('request.jwt.claims', json_build_object('sub',u_oza::text,'role','authenticated')::text,true);
  v_json := public.respond_to_mentorship_request(v_req,'decline');
  v_cases:=v_cases+1;
  if v_json->>'status' <> 'declined' or (v_json->>'reason_required')::boolean then
    v_fail:=v_fail||'C14 un mentor ne peut pas refuser sans justification';
  end if;
  perform set_config('role','postgres',true);
  select count(*) into v_n from public.mentorship_requests r
   where r.id = v_req and r.status='declined' and r.decline_reason is null;
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||'C15 un motif a ete impose au refus'; end if;
  perform set_config('role','authenticated',true);

  -- C16 — un tiers n'accede pas au mentorat d'autrui.
  perform set_config('request.jwt.claims', json_build_object('sub',u_oza::text,'role','authenticated')::text,true);
  v_msg:=null;
  begin perform public.get_mentorship(v_ment); v_ok:=false;
  exception when others then v_ok:=(sqlerrm='not_found'); if not v_ok then v_msg:=sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('C16 '||coalesce(v_msg,'')); end if;

  -- C17 -> C19 — deux confidentialites A L'INTERIEUR du binome.
  perform set_config('request.jwt.claims', json_build_object('sub',u_lea::text,'role','authenticated')::text,true);
  v_json := public.log_mentorship_session(v_ment,null,now()+interval '7 days','video','Cadrage',
    'Synthese partagee du premier echange.','Note strictement personnelle de Lea.','planned');
  v_ses := (v_json->>'session_id')::uuid;
  v_cases:=v_cases+1;
  if public.get_mentorship(v_ment)::text not like '%Note strictement personnelle de Lea.%' then
    v_fail:=v_fail||'C17 le mentore ne retrouve pas sa propre note';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub',u_mia::text,'role','authenticated')::text,true);
  v_cases:=v_cases+1;
  if public.get_mentorship(v_ment)::text like '%Note strictement personnelle de Lea.%' then
    v_fail:=v_fail||'C18 le mentor lit la note privee de son mentore';
  end if;
  v_cases:=v_cases+1;
  if public.get_mentorship(v_ment)::text not like '%Synthese partagee du premier echange.%' then
    v_fail:=v_fail||'C19 la synthese partagee n''est pas visible des deux parties';
  end if;

  -- C20 — chacun peut arreter, sans negociation ([U 102]).
  perform set_config('request.jwt.claims', json_build_object('sub',u_lea::text,'role','authenticated')::text,true);
  v_json := public.transition_mentorship(v_ment,'stopped');
  v_cases:=v_cases+1;
  if v_json->>'status' <> 'stopped' or (v_json->>'reason_required')::boolean then
    v_fail:=v_fail||'C20 un participant ne peut pas arreter sans motif';
  end if;

  -- C21 / C22 — bilan : aucune note publique, aucun impact fabrique.
  v_json := public.submit_mentorship_feedback(v_ment, jsonb_build_object(
    'usefulness','yes','objective_progress','yes','outcome_type','career_plan_clarified'));
  v_cases:=v_cases+1;
  if (v_json->>'is_public_rating')::boolean then
    v_fail:=v_fail||'C21 le bilan produit une note publique (CA-MENT-09)';
  end if;
  perform set_config('role','postgres',true);
  select count(*) into v_n from analytics.impact_events i
   where i.beneficiary_profile_id = p_lea and i.impact_type = 'mentorship_completed';
  v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||'C22 un mentorat arrete est compte comme termine'; end if;

  -- C23 — le privilege de colonne sur `mentorship_matches.score` reste retire.
  select count(*) into v_n from information_schema.column_privileges
   where table_schema='public' and table_name='mentorship_matches' and column_name='score'
     and grantee in ('authenticated','anon') and privilege_type='SELECT';
  v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||'C23 le score de mentor est lisible par authenticated'; end if;

  select count(*) into v_n from private.security_baseline_violations();
  v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('C24 security_baseline_violations() renvoie %s ligne(s)',v_n); end if;

  if array_length(v_fail,1) is null then
    raise exception 'MENTORSHIP_API_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'MENTORSHIP_API_TESTS_FAILED: % cas, % echec(s)\n  - %',
      v_cases, array_length(v_fail,1), array_to_string(v_fail,E'\n  - ');
  end if;
end
$ment$;
