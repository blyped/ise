-- =====================================================================
-- supabase/tests/rls/0006_opportunities_suite.sql
--
-- Suite RLS NEGATIVE du lot « Opportunites et candidatures » (0041).
-- Modele auto-nettoyant (voir docs/rls.md).
--   succes -> ERROR: P0001: OPPORTUNITIES_TESTS_OK: 16 cas, 0 echec
--
-- FIXTURES : Ada (auteur, promo A) · Ben (candidat, promo A) ·
--            Cleo (autre candidat, promo B) · Dan (bloque Ada, promo B)
-- =====================================================================

do $opp$
declare
  u_ada uuid:='00000000-0000-4000-8002-000000000001'; u_ben uuid:='00000000-0000-4000-8002-000000000002';
  u_cleo uuid:='00000000-0000-4000-8002-000000000003'; u_dan uuid:='00000000-0000-4000-8002-000000000004';
  p_ada uuid:='00000000-0000-4000-8002-0000000000a1'; p_ben uuid:='00000000-0000-4000-8002-0000000000a2';
  p_cleo uuid:='00000000-0000-4000-8002-0000000000a3'; p_dan uuid:='00000000-0000-4000-8002-0000000000a4';
  o_open uuid:='00000000-0000-4000-8002-0000000000b1'; o_promo uuid:='00000000-0000-4000-8002-0000000000b2';
  a_ben uuid:='00000000-0000-4000-8002-0000000000c1'; a_cleo uuid:='00000000-0000-4000-8002-0000000000c2';
  d_ben uuid:='00000000-0000-4000-8002-0000000000d1';
  v_pa bigint; v_pb bigint;
  v_cases integer:=0; v_fail text[]:=array[]::text[]; v_n bigint; v_ok boolean; v_msg text; v_num numeric;
begin
  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  select id into v_pa from public.promotions order by id limit 1;
  select id into v_pb from public.promotions order by id desc limit 1;
  insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_ada,'authenticated','authenticated','test+opp.ada@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_ben,'authenticated','authenticated','test+opp.ben@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_cleo,'authenticated','authenticated','test+opp.cleo@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_dan,'authenticated','authenticated','test+opp.dan@ise.test',now(),now());
  insert into public.ise_profiles (id,user_id,first_name,last_name,promotion_id,profile_status,claim_status,claimed_at,is_test_account) values
    (p_ada,u_ada,'Ada','Opp',v_pa,'active','claimed',now(),true),
    (p_ben,u_ben,'Ben','Opp',v_pa,'active','claimed',now(),true),
    (p_cleo,u_cleo,'Cleo','Opp',v_pb,'active','claimed',now(),true),
    (p_dan,u_dan,'Dan','Opp',v_pb,'active','claimed',now(),true);
  insert into public.opportunities (id,author_profile_id,opportunity_type,title,description,origin,source_type,application_mode,visibility,status,moderation_status,published_at) values
    (o_open,p_ada,'job','Poste ouvert','Description suffisamment longue pour satisfaire la contrainte de longueur du champ.','internal','ise_member','internal','members','active','approved',now()),
    (o_promo,p_ada,'mission','Mission promotion','Description suffisamment longue pour satisfaire la contrainte de longueur du champ.','internal','ise_member','internal','promotion','active','approved',now());
  insert into public.profile_documents (id,profile_id,document_type,title,storage_path,original_filename,mime_type,size_bytes,visibility) values
    (d_ben,p_ben,'cv','CV de Ben','profile-documents/'||p_ben::text||'/cv.pdf','cv.pdf','application/pdf',1024,'members');
  insert into public.applications (id,opportunity_id,applicant_profile_id,status,message,cv_document_id,submitted_at) values
    (a_ben,o_open,p_ben,'submitted','Candidature soumise par Ben.',d_ben,now()),
    (a_cleo,o_open,p_cleo,'draft','Brouillon de candidature de Cleo.',null,null);
  insert into public.opportunity_matches (opportunity_id,profile_id,score,relevance_label,computed_at)
    values (o_open,p_ben,91.00,'very_relevant',now());
  insert into public.opportunity_interests (opportunity_id,profile_id,interest_level,note)
    values (o_open,p_ben,'interested','Note personnelle de Ben.');
  insert into public.profile_blocks (blocker_profile_id,blocked_profile_id) values (p_dan,p_ada);

  -- Cleo : autre candidate, hors promotion.
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_cleo::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.applications where id=a_ben; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('O01 candidature d''un autre candidat visible (%s)',v_n); end if;
  select count(*) into v_n from public.profile_documents where id=d_ben; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('O02 CV d''un tiers visible (%s)',v_n); end if;
  select count(*) into v_n from public.opportunity_interests where profile_id=p_ben; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('O03 interet declare d''un tiers visible (%s)',v_n); end if;
  select count(*) into v_n from public.opportunities where id=o_promo; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('O04 opportunite promotion visible hors promotion (%s)',v_n); end if;
  -- O05 : submit_application() est le seul chemin draft -> submitted.
  v_msg:=null;
  begin
    update public.applications set status='submitted', submitted_at=now() where id=a_cleo;
    get diagnostics v_n=row_count; v_ok:=(v_n=0); v_msg:=format('%s ligne(s) soumises par UPDATE',v_n);
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('O05 submit_application contourne : '||coalesce(v_msg,'')); end if;

  -- Ben : candidat.
  perform set_config('request.jwt.claims',json_build_object('sub',u_ben::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.applications where id=a_ben; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('O06 le candidat ne voit pas sa candidature (%s)',v_n); end if;
  v_msg:=null;
  begin
    update public.applications set status='selected', decided_at=now() where id=a_ben;
    get diagnostics v_n=row_count; v_ok:=(v_n=0); v_msg:=format('%s ligne(s) auto-selectionnees',v_n);
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('O07 transition_application_status contourne : '||coalesce(v_msg,'')); end if;
  v_msg:=null;
  begin
    select score into v_num from public.opportunity_matches where opportunity_id=o_open and profile_id=p_ben;
    v_ok:=false; v_msg:=format('score lisible (= %s)',v_num);
  exception when insufficient_privilege then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('O08 score de matching expose : '||coalesce(v_msg,'')); end if;

  -- Ada : responsable de l'opportunite.
  perform set_config('request.jwt.claims',json_build_object('sub',u_ada::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.applications where id=a_ben; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('O09 le responsable ne voit pas la candidature soumise (%s)',v_n); end if;
  select count(*) into v_n from public.applications where id=a_cleo; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('O10 le responsable voit un BROUILLON de candidature (%s)',v_n); end if;
  select count(*) into v_n from public.profile_documents where id=d_ben; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('O11 le responsable ne lit pas le CV joint (%s)',v_n); end if;
  select count(*) into v_n from public.opportunity_interests where profile_id=p_ben; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('O12 l''auteur voit l''interet declare d''un membre (%s)',v_n); end if;

  -- Dan : a bloque Ada.
  perform set_config('request.jwt.claims',json_build_object('sub',u_dan::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.opportunities where id=o_open; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('O13 opportunite visible malgre le blocage (%s)',v_n); end if;
  v_msg:=null;
  begin
    insert into public.applications (opportunity_id,applicant_profile_id,status) values (o_open,p_dan,'draft');
    v_ok:=false; v_msg:='candidature acceptee malgre le blocage';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('O14 '||coalesce(v_msg,'')); end if;
  v_msg:=null;
  begin
    insert into public.applications (opportunity_id,applicant_profile_id,status,submitted_at) values (o_open,p_dan,'submitted',now());
    v_ok:=false; v_msg:='candidature directement soumise (sans submit_application)';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('O15 '||coalesce(v_msg,'')); end if;

  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  select count(*) into v_n from private.security_baseline_violations(); v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('O16 security_baseline_violations() renvoie %s ligne(s)',v_n); end if;

  if array_length(v_fail,1) is null then
    raise exception 'OPPORTUNITIES_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'OPPORTUNITIES_TESTS_FAILED: % cas, % echec(s)\n  - %', v_cases, array_length(v_fail,1), array_to_string(v_fail,E'\n  - ');
  end if;
end
$opp$;
