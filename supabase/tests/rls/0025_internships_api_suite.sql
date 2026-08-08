-- =====================================================================
-- supabase/tests/rls/0025_internships_api_suite.sql
--
-- Suite NEGATIVE de la couche API des STAGES (migration 0071).
-- Complete 0007, qui teste les POLITIQUES.
--
-- DEUX INVARIANTS SONT AU COEUR DE CETTE SUITE.
--   1. AUDIENCE — le module de recherche ne s'adresse qu'aux profils
--      `student`. Un diplome recoit `42501` sur chacun de ses chemins
--      (B01 -> B04) et dispose du sien (B05).
--   2. D-55 — AUCUN chemin ne pose « candidature envoyee » sans
--      declaration explicite de l'eleve :
--        B07  la fiche d'offre annonce `platform_transmits = false` ;
--        B10  le brouillon reste `to_prepare` ;
--        B11  aucune ligne soumise n'existe apres la preparation ;
--        B12  la machine de transitions n'offre pas de second chemin
--             vers `submitted` ;
--        B13  sans date declaree, l'envoi est refuse ;
--        B14  une date future est refusee ;
--        B15  la declaration est attribuee a l'eleve ;
--        B16  et tracee comme telle dans l'historique ;
--        B17  un placement ne s'enregistre pas sur une etape non
--             constatee ;
--        B18  et sans contribution declaree, aucun impact reseau
--             n'est attribue (B19).
--
--   succes  ->  ERROR:  P0001: INTERNSHIPS_API_TESTS_OK: N cas, 0 echec
--   echec   ->  ERROR:  P0001: INTERNSHIPS_API_TESTS_FAILED: N cas, K echec(s)
--
-- FIXTURES (D-104)
--   Sam  eleve ISE (`profile_type = 'student'`)
--   Gil  diplome, employe de l'organisation qui publie l'offre
-- =====================================================================

do $stage$
declare
  u_sam uuid := '00000000-0000-4000-8029-000000000001';
  u_gil uuid := '00000000-0000-4000-8029-000000000002';
  p_sam uuid := '00000000-0000-4000-8029-0000000000a1';
  p_gil uuid := '00000000-0000-4000-8029-0000000000a2';
  o_org uuid := '00000000-0000-4000-8029-0000000000b1';
  o_off uuid := '00000000-0000-4000-8029-0000000000c1';
  v_a bigint; v_sec bigint; v_sk bigint;
  v_cases integer := 0; v_fail text[] := array[]::text[];
  v_ok boolean; v_msg text; v_json jsonb; v_n bigint; v_app uuid; v_req uuid;
begin
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims','',true);

  select id into v_a from public.promotions order by id limit 1;
  select id into v_sec from public.sectors order by id limit 1;
  select id into v_sk  from public.skills order by id limit 1;

  insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_sam,'authenticated','authenticated','test+stage.sam@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_gil,'authenticated','authenticated','test+stage.gil@ise.test',now(),now());

  insert into public.organizations (id, canonical_name, slug, organization_type)
  values (o_org,'Banque regionale test','banque-regionale-test-8029','commercial_bank');

  insert into public.ise_profiles
    (id,user_id,first_name,last_name,promotion_id,profile_type,profile_status,claim_status,claimed_at,is_test_account) values
    (p_sam,u_sam,'Sam','Stage',v_a,'student','active','claimed',now(),true);
  insert into public.ise_profiles
    (id,user_id,first_name,last_name,promotion_id,profile_type,profile_status,claim_status,claimed_at,
     current_organization_id,is_test_account) values
    (p_gil,u_gil,'Gil','Stage',v_a,'graduate','active','claimed',now(),o_org,true);

  insert into public.profile_sectors (profile_id, sector_id, is_primary) values (p_gil, v_sec, true);
  insert into public.profile_availabilities (profile_id, availability_type, active)
  values (p_gil, (select code from public.availability_types limit 1), true);

  insert into public.internship_offers
    (id, offer_type, created_by_profile_id, organization_id, title, description,
     sector_id, country_code, city, work_mode, start_date, duration_months,
     application_mode, source, status, published_at)
  values (o_off,'official_offer',p_gil,o_org,'Data Analyst - suivi de portefeuille',
          'Stage de suivi de portefeuille.', v_sec,'CI','Abidjan','hybrid',
          current_date + 30, 6, 'email','member_direct','published', now());
  insert into public.internship_offer_skills (offer_id, skill_id, is_required) values (o_off, v_sk, true);

  -- ---- Gil, DIPLOME : le module de recherche lui est ferme ---------
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',u_gil::text,'role','authenticated')::text,true);

  v_msg:=null;
  begin perform public.get_internship_home(); v_ok:=false;
  exception when others then v_ok:=(sqlerrm='not_authorized'); if not v_ok then v_msg:=sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('B01 un diplome accede a l''espace stages : '||coalesce(v_msg,'')); end if;

  v_msg:=null;
  begin perform public.list_internship_offers(); v_ok:=false;
  exception when others then v_ok:=(sqlerrm='not_authorized'); if not v_ok then v_msg:=sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('B02 '||coalesce(v_msg,'')); end if;

  v_msg:=null;
  begin perform public.save_internship_need('{"objective_text":"x"}'::jsonb); v_ok:=false;
  exception when others then v_ok:=(sqlerrm='not_authorized'); if not v_ok then v_msg:=sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('B03 '||coalesce(v_msg,'')); end if;

  v_msg:=null;
  begin perform public.save_internship_application_draft(null,o_off,'{}'::jsonb); v_ok:=false;
  exception when others then v_ok:=(sqlerrm='not_authorized'); if not v_ok then v_msg:=sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('B04 '||coalesce(v_msg,'')); end if;

  -- B05 — chemin positif : l'ancien a son propre espace.
  v_json := public.get_internship_alumni_home();
  v_cases:=v_cases+1;
  if v_json->>'audience' <> 'alumni' then v_fail:=v_fail||'B05 l''espace ancien n''est pas accessible'; end if;

  -- ---- Sam, eleve ---------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub',u_sam::text,'role','authenticated')::text,true);

  v_json := public.save_internship_need(jsonb_build_object(
    'status','active','internship_type','final_year','objective','Acquerir une experience Data.',
    'start_date',(current_date+25)::text,'end_date',(current_date+200)::text,
    'work_mode','hybrid','sector_ids',jsonb_build_array(v_sec::text),
    'country_codes',jsonb_build_array('CI'),'skill_ids',jsonb_build_array(v_sk::text)));
  v_cases:=v_cases+1;
  if v_json->>'status' <> 'active' then v_fail:=v_fail||'B06 la recherche n''a pas ete activee'; end if;

  v_json := public.get_internship_offer(o_off);
  v_cases:=v_cases+1;
  if (v_json->>'platform_transmits')::boolean then
    v_fail:=v_fail||'B07 la plateforme se declare transmettrice de dossier (D-55)';
  end if;
  v_cases:=v_cases+1;
  if (v_json->'relevance'->>'label') is null or jsonb_array_length(v_json->'relevance'->'reasons') = 0 then
    v_fail:=v_fail||'B08 aucune raison affichable pour une offre proposee (D-43)';
  end if;
  v_cases:=v_cases+1;
  if v_json::text like '%"score"%' then
    v_fail:=v_fail||'B09 un score numerique atteint le client';
  end if;

  v_json := public.save_internship_application_draft(null,o_off,'{"message":"Bonjour"}'::jsonb);
  v_app := (v_json->>'application_id')::uuid;
  v_cases:=v_cases+1;
  if v_json->>'status' <> 'to_prepare' or (v_json->>'is_sent')::boolean then
    v_fail:=v_fail||'B10 le brouillon est pose autrement qu''en to_prepare';
  end if;

  perform set_config('role','postgres',true);
  select count(*) into v_n from public.internship_applications a
   where a.student_profile_id = p_sam and a.status <> 'to_prepare';
  v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||'B11 une candidature est deja consideree envoyee (D-55)'; end if;
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',u_sam::text,'role','authenticated')::text,true);

  v_msg:=null;
  begin perform public.declare_internship_application_step(v_app,'submitted'); v_ok:=false;
  exception when others then v_ok:=(sqlerrm='invalid_transition'); if not v_ok then v_msg:=sqlerrm; end if; end;
  v_cases:=v_cases+1;
  if not v_ok then v_fail:=v_fail||('B12 un second chemin mene a submitted : '||coalesce(v_msg,'')); end if;

  v_msg:=null;
  begin perform public.declare_internship_application_sent(v_app,'email',null); v_ok:=false;
  exception when others then v_ok:=(sqlerrm='validation_failed'); if not v_ok then v_msg:=sqlerrm; end if; end;
  v_cases:=v_cases+1;
  if not v_ok then v_fail:=v_fail||('B13 envoi accepte sans date declaree : '||coalesce(v_msg,'')); end if;

  v_msg:=null;
  begin perform public.declare_internship_application_sent(v_app,'email',current_date+5); v_ok:=false;
  exception when others then v_ok:=(sqlerrm='validation_failed'); if not v_ok then v_msg:=sqlerrm; end if; end;
  v_cases:=v_cases+1;
  if not v_ok then v_fail:=v_fail||('B14 date d''envoi future acceptee : '||coalesce(v_msg,'')); end if;

  v_json := public.declare_internship_application_sent(v_app,'email',current_date);
  v_cases:=v_cases+1;
  if v_json->>'status' <> 'submitted' or v_json->>'declared_by' <> 'student' then
    v_fail:=v_fail||'B15 la declaration d''envoi n''est pas attribuee a l''eleve';
  end if;

  perform set_config('role','postgres',true);
  select count(*) into v_n from public.internship_application_events e
   where e.application_id = v_app and e.to_status = 'submitted' and e.declared_by_profile_id = p_sam;
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||'B16 l''envoi n''est pas trace comme declaration de l''eleve'; end if;
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',u_sam::text,'role','authenticated')::text,true);

  v_msg:=null;
  begin perform public.record_internship_result(v_app, jsonb_build_object(
    'start_date',(current_date+30)::text,'end_date',(current_date+200)::text,'country_code','CI'));
    v_ok:=false;
  exception when others then v_ok:=(sqlerrm='invalid_transition'); if not v_ok then v_msg:=sqlerrm; end if; end;
  v_cases:=v_cases+1;
  if not v_ok then v_fail:=v_fail||('B17 un placement est enregistre sans etape constatee : '||coalesce(v_msg,'')); end if;

  perform public.declare_internship_application_step(v_app,'interview');
  perform public.declare_internship_application_step(v_app,'offered');
  v_json := public.record_internship_result(v_app, jsonb_build_object(
    'start_date',(current_date+30)::text,'end_date',(current_date+200)::text,
    'country_code','CI','placement_source','personal_search','network_attribution','none'));
  v_cases:=v_cases+1;
  if (v_json->>'impact_recorded')::boolean then
    v_fail:=v_fail||'B18 un impact reseau est attribue sans contribution declaree';
  end if;

  perform set_config('role','postgres',true);
  select count(*) into v_n from analytics.impact_events i where i.beneficiary_profile_id = p_sam;
  v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||'B19 une ligne d''impact a ete ecrite malgre network_attribution = none'; end if;
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',u_sam::text,'role','authenticated')::text,true);

  -- B20 / B21 — les anciens proposes portent des RAISONS, pas un score.
  v_json := public.list_internship_helpers(o_off);
  v_cases:=v_cases+1;
  if jsonb_array_length(v_json->'rows') < 1 then
    v_fail:=v_fail||'B20 aucun ancien propose alors qu''un signal existe';
  elsif jsonb_array_length(v_json->'rows'->0->'reasons') = 0 then
    v_fail:=v_fail||'B20 un ancien est propose sans raison (D-43)';
  end if;
  v_cases:=v_cases+1;
  if v_json::text like '%"signals"%' or v_json::text like '%"score"%' then
    v_fail:=v_fail||'B21 un decompte de signaux ou un score atteint le client';
  end if;

  -- B22 / B23 — solliciter n'engage pas ; un ancien refuse sans motif.
  v_json := public.request_internship_help(p_gil,'cv_review','Bonjour, pourriez-vous relire mon dossier ?',o_off);
  v_req := (v_json->>'request_id')::uuid;
  v_cases:=v_cases+1;
  if (v_json->>'commits_alumni')::boolean then
    v_fail:=v_fail||'B22 la sollicitation engage l''ancien';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub',u_gil::text,'role','authenticated')::text,true);
  v_json := public.respond_to_internship_help_request(v_req,'decline');
  v_cases:=v_cases+1;
  if v_json->>'status' <> 'declined' then
    v_fail:=v_fail||'B23 un ancien ne peut pas refuser sans justification';
  end if;

  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims','',true);
  select count(*) into v_n from private.security_baseline_violations();
  v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('B24 security_baseline_violations() renvoie %s ligne(s)',v_n); end if;

  if array_length(v_fail,1) is null then
    raise exception 'INTERNSHIPS_API_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'INTERNSHIPS_API_TESTS_FAILED: % cas, % echec(s)\n  - %',
      v_cases, array_length(v_fail,1), array_to_string(v_fail,E'\n  - ');
  end if;
end
$stage$;
