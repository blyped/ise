-- =====================================================================
-- supabase/tests/rls/0017_opportunities_api_suite.sql
--
-- Suite NEGATIVE de la couche API des OPPORTUNITES (migration 0053).
-- Complete 0006, qui teste les POLITIQUES : celle-ci teste les CHEMINS
-- exposes a l'application, y compris ceux ajoutes par 0053
-- (publish_opportunity, transition_opportunity, get_application,
-- record_opportunity_outbound_click).
--
-- LE COEUR DE CETTE SUITE : verifier qu'AUCUN chemin ne pose
-- « candidature envoyee » sur une opportunite EXTERNE sans declaration
-- explicite du membre (MASTER PROMPT 27, D-55). Trois cas s'en chargent :
--   B09  submit_application refuse une offre externe ;
--   B10  un clic sortant se declare `is_application = false` ;
--   B11  et n'ecrit AUCUNE ligne dans `applications` ;
--   B12  l'insertion directe d'une candidature soumise est refusee ;
--   B13  seule `declare_external_application` la cree ;
--   B14  et la lecture la presente comme AUTO-DECLAREE.
--
-- Modele auto-nettoyant : bloc DO unique, fixtures, assertions,
-- RAISE EXCEPTION final qui annule toute la transaction.
--
--   succes  ->  ERROR:  P0001: OPPORTUNITIES_API_TESTS_OK: N cas, 0 echec
--   echec   ->  ERROR:  P0001: OPPORTUNITIES_API_TESTS_FAILED: N cas, K echec(s)
--
-- FIXTURES (D-104)
--   Ada   auteure des offres, promotion A
--   Ben   candidat, promotion A
--   Cleo  membre actif, promotion B — hors audience, declare une
--         candidature externe
--   Dan   second candidat, promotion A
-- =====================================================================

do $oapi$
declare
  u_ada  uuid := '00000000-0000-4000-8017-000000000001';
  u_ben  uuid := '00000000-0000-4000-8017-000000000002';
  u_cleo uuid := '00000000-0000-4000-8017-000000000003';
  u_dan  uuid := '00000000-0000-4000-8017-000000000004';
  p_ada  uuid := '00000000-0000-4000-8017-0000000000a1';
  p_ben  uuid := '00000000-0000-4000-8017-0000000000a2';
  p_cleo uuid := '00000000-0000-4000-8017-0000000000a3';
  p_dan  uuid := '00000000-0000-4000-8017-0000000000a4';
  o_draft uuid := '00000000-0000-4000-8017-0000000000b1';
  o_int   uuid := '00000000-0000-4000-8017-0000000000b2';
  o_promo uuid := '00000000-0000-4000-8017-0000000000b3';
  o_ext   uuid := '00000000-0000-4000-8017-0000000000b4';
  a_ben   uuid := '00000000-0000-4000-8017-0000000000e1';
  a_dan   uuid := '00000000-0000-4000-8017-0000000000e2';
  v_promo_a bigint;
  v_promo_b bigint;
  v_cases integer := 0;
  v_fail  text[] := array[]::text[];
  v_n     bigint;
  v_ok    boolean;
  v_msg   text;
  v_json  jsonb;
begin
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims','',true);

  select id into v_promo_a from public.promotions order by id limit 1;
  select id into v_promo_b from public.promotions order by id desc limit 1;

  insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_ada ,'authenticated','authenticated','test+oapi.ada@ise.test' ,now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_ben ,'authenticated','authenticated','test+oapi.ben@ise.test' ,now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_cleo,'authenticated','authenticated','test+oapi.cleo@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_dan ,'authenticated','authenticated','test+oapi.dan@ise.test' ,now(),now());

  insert into public.ise_profiles
    (id,user_id,first_name,last_name,promotion_id,profile_status,claim_status,claimed_at,is_test_account) values
    (p_ada ,u_ada ,'Ada' ,'Opp',v_promo_a,'active','claimed',now(),true),
    (p_ben ,u_ben ,'Ben' ,'Opp',v_promo_a,'active','claimed',now(),true),
    (p_cleo,u_cleo,'Cleo','Opp',v_promo_b,'active','claimed',now(),true),
    (p_dan ,u_dan ,'Dan' ,'Opp',v_promo_a,'active','claimed',now(),true);

  insert into public.opportunities
    (id,author_profile_id,opportunity_type,title,description,visibility,status,published_at,
     application_mode,origin,source_type,moderation_status)
  values
    (o_draft,p_ada,'job','Brouillon offre API',
     'Brouillon d''offre servant a verifier que save_opportunity_draft refuse les tiers.',
     'members','draft',null,'internal','internal','ise_member','not_required'),
    (o_int,p_ada,'mission','Mission interne API',
     'Offre a candidature interne : seul chemin ou la plateforme constate reellement un depot.',
     'members','active',now(),'internal','internal','ise_member','not_required'),
    (o_promo,p_ada,'job','Offre promotion API',
     'Offre reservee a la promotion de son auteur : Cleo ne doit la voir par aucun chemin.',
     'promotion','active',now(),'internal','internal','ise_member','not_required');

  insert into public.opportunities
    (id,author_profile_id,opportunity_type,title,description,visibility,status,published_at,
     application_mode,external_application_url,origin,source_type,source_url,moderation_status)
  values
    (o_ext,p_ada,'job','Offre externe API',
     'Offre relayee d''une source exterieure : la plateforme ne transmet aucun dossier (D-55).',
     'members','active',now(),'external_url','https://exemple.test/offre',
     'external','external_source','https://exemple.test/source','approved');

  insert into public.applications
    (id,opportunity_id,applicant_profile_id,channel,is_self_declared,status,submitted_at) values
    (a_ben,o_int,p_ben,'platform',false,'submitted',now()),
    (a_dan,o_int,p_dan,'platform',false,'submitted',now());

  insert into public.opportunity_matches (opportunity_id,profile_id,score,relevance_label,reasons,computed_at)
  values (o_int,p_ben,88.00,'very_relevant',
          '[{"criterion":"skills","label":"Competence recherchee : Stata","evidence":["Stata"]}]'::jsonb, now());

  -- ---- Cleo, hors audience -----------------------------------------
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',
    json_build_object('sub',u_cleo::text,'role','authenticated')::text,true);

  -- B01 — le detail d'une offre hors audience est indistinctement absent.
  v_msg:=null;
  begin
    perform public.get_opportunity(o_promo);
    v_ok:=false; v_msg:='offre hors audience renvoyee';
  exception when others then v_ok:=(sqlerrm='opportunity_not_found');
    if not v_ok then v_msg:='erreur inattendue : '||sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('B01 '||coalesce(v_msg,'')); end if;

  -- B02 — ni listee.
  v_json := public.list_opportunities('all',null,null,null,null,null,false,false,'open',null,50);
  select count(*) into v_n from jsonb_array_elements(v_json->'rows') e
   where (e->>'opportunity_id')::uuid = o_promo;
  v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('B02 offre promotion listee hors promotion (%s)',v_n); end if;

  -- ---- Ben, candidat : il ne voit pas les candidatures des autres ---
  perform set_config('request.jwt.claims',
    json_build_object('sub',u_ben::text,'role','authenticated')::text,true);

  -- B03 — le RPC des candidatures recues est reserve au responsable.
  v_msg:=null;
  begin
    perform public.list_opportunity_applications(o_int);
    v_ok:=false; v_msg:='un candidat a pu lister les candidatures recues';
  exception when others then v_ok:=(sqlerrm='not_authorized');
    if not v_ok then v_msg:='erreur inattendue : '||sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('B03 '||coalesce(v_msg,'')); end if;

  -- B04 — et la lecture directe ne lui rend que la sienne.
  select count(*) into v_n from public.applications where opportunity_id=o_int;
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('B04 un candidat voit %s candidatures au lieu d''une',v_n); end if;

  -- B05 — ni le detail de celle d'un autre.
  v_msg:=null;
  begin
    perform public.get_application(a_dan);
    v_ok:=false; v_msg:='un candidat a pu lire la candidature d''un autre';
  exception when others then v_ok:=(sqlerrm='application_not_found');
    if not v_ok then v_msg:='erreur inattendue : '||sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('B05 '||coalesce(v_msg,'')); end if;

  -- B06 — CLOTURE PAR UN TIERS : refusee.
  v_msg:=null;
  begin
    perform public.close_opportunity(o_int,'ise_hired',1::smallint,true,'direct');
    v_ok:=false; v_msg:='un tiers a pu cloturer une opportunite';
  exception when others then v_ok:=(sqlerrm='not_authorized');
    if not v_ok then v_msg:='erreur inattendue : '||sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('B06 '||coalesce(v_msg,'')); end if;

  -- B07 — publication par un tiers : refusee.
  v_msg:=null;
  begin
    perform public.publish_opportunity(o_draft);
    v_ok:=false; v_msg:='un tiers a pu publier une offre';
  exception when others then v_ok:=(sqlerrm in ('not_authorized','opportunity_not_found'));
    if not v_ok then v_msg:='erreur inattendue : '||sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('B07 '||coalesce(v_msg,'')); end if;

  -- B08 — mise en pause par un tiers : refusee.
  v_msg:=null;
  begin
    perform public.transition_opportunity(o_int,'paused');
    v_ok:=false; v_msg:='un tiers a pu mettre une offre en pause';
  exception when others then v_ok:=(sqlerrm in ('not_authorized','invalid_transition'));
    if not v_ok then v_msg:='erreur inattendue : '||sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('B08 '||coalesce(v_msg,'')); end if;

  -- ===================================================================
  -- D-55 — aucun chemin ne pose « candidature envoyee » sur une offre
  -- EXTERNE sans declaration explicite du membre.
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub',u_cleo::text,'role','authenticated')::text,true);

  -- B09 — le depot interne est refuse sur une offre externe.
  v_msg:=null;
  begin
    perform public.submit_application(o_ext,'Tentative de depot interne.');
    v_ok:=false; v_msg:='submit_application a accepte une offre externe';
  exception when others then v_ok:=(sqlerrm='external_application_must_be_declared');
    if not v_ok then v_msg:='erreur inattendue : '||sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('B09 '||coalesce(v_msg,'')); end if;

  -- B10 — un clic sortant se declare pour ce qu'il est.
  v_json := public.record_opportunity_outbound_click(o_ext);
  v_cases:=v_cases+1;
  if coalesce((v_json->>'is_application')::boolean,true) then
    v_fail:=v_fail||'B10 un clic sortant se declare comme une candidature';
  end if;

  -- B11 — et n'ecrit AUCUNE candidature.
  select count(*) into v_n from public.applications
   where opportunity_id=o_ext and applicant_profile_id=p_cleo;
  v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('B11 un clic sortant a cree %s candidature(s)',v_n); end if;

  -- B12 — l'insertion directe d'une candidature soumise est refusee.
  v_msg:=null;
  begin
    insert into public.applications (opportunity_id,applicant_profile_id,status,submitted_at,channel)
    values (o_ext,p_cleo,'submitted',now(),'external');
    v_ok:=false; v_msg:='candidature externe posee directement, sans declaration';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('B12 '||coalesce(v_msg,'')); end if;

  -- B13 — seule la DECLARATION explicite la cree (positif).
  perform public.declare_external_application(o_ext, now() - interval '1 day', 'Postule via le site.');
  select count(*) into v_n from public.applications
   where opportunity_id=o_ext and applicant_profile_id=p_cleo
     and channel='external' and is_self_declared and status='submitted';
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||'B13 declare_external_application n''a pas produit la candidature declaree'; end if;

  -- B14 — et la lecture la presente comme AUTO-DECLAREE, jamais comme
  --       un fait constate par la plateforme.
  select a.id into a_dan from public.applications a
   where a.opportunity_id=o_ext and a.applicant_profile_id=p_cleo;
  v_json := public.get_application(a_dan);
  v_cases:=v_cases+1;
  if not coalesce((v_json->>'steps_are_self_declared')::boolean,false)
     or coalesce(v_json->>'channel','') <> 'external' then
    v_fail:=v_fail||'B14 une candidature declaree n''est pas presentee comme telle';
  end if;

  -- ---- Le score ne quitte jamais la base (MASTER PROMPT 15) ---------
  perform set_config('request.jwt.claims',
    json_build_object('sub',u_ben::text,'role','authenticated')::text,true);
  v_json := public.get_opportunity(o_int);
  v_cases:=v_cases+1;
  if v_json ? 'score' or v_json ? 'component_scores' or (v_json->'relevance') ? 'score' then
    v_fail:=v_fail||'B15 un score a ete renvoye au client';
  end if;
  v_cases:=v_cases+1;
  if coalesce(v_json->'relevance'->>'label','') <> 'very_relevant' then
    v_fail:=v_fail||'B16 le libelle qualitatif de pertinence est absent';
  end if;

  -- B17 — une seule candidature par couple offre + candidat.
  v_msg:=null;
  begin
    perform public.submit_application(o_int,'Doublon.');
    v_ok:=false; v_msg:='doublon de candidature accepte';
  exception when others then v_ok:=(sqlerrm='already_applied');
    if not v_ok then v_msg:='erreur inattendue : '||sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('B17 '||coalesce(v_msg,'')); end if;

  -- ---- Ada, auteure : les chemins legitimes fonctionnent ------------
  perform set_config('request.jwt.claims',
    json_build_object('sub',u_ada::text,'role','authenticated')::text,true);

  -- B18 — l'auteure voit les DEUX candidatures (positif).
  v_json := public.list_opportunity_applications(o_int);
  v_cases:=v_cases+1;
  if jsonb_array_length(v_json->'rows') <> 2 then
    v_fail:=v_fail||format('B18 l''auteure voit %s candidatures au lieu de 2',
                           jsonb_array_length(v_json->'rows'));
  end if;

  -- B19 — une offre publiee ne se reecrit pas par le chemin brouillon.
  v_msg:=null;
  begin
    perform public.save_opportunity_draft(o_int,'{"title":"Titre modifie apres publication"}'::jsonb);
    v_ok:=false; v_msg:='une offre publiee a ete reecrite par le chemin brouillon';
  exception when others then v_ok:=(sqlerrm='invalid_transition');
    if not v_ok then v_msg:='erreur inattendue : '||sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('B19 '||coalesce(v_msg,'')); end if;

  -- B20 — cloture SANS recrutement : aucun impact attribue (test 13).
  perform public.close_opportunity(o_int,'no_selection',0::smallint,false,'unknown');
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims','',true);
  select count(*) into v_n from public.opportunity_outcomes
   where opportunity_id=o_int and outcome_type='no_selection'
     and hires_count=0 and facilitated_by_platform=false and attribution_level='unknown';
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||'B20 une cloture sans recrutement a produit un impact'; end if;

  -- B21 — le controle de base de securite reste vert.
  select count(*) into v_n from private.security_baseline_violations();
  v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('B21 security_baseline_violations() renvoie %s ligne(s)',v_n); end if;

  if array_length(v_fail,1) is null then
    raise exception 'OPPORTUNITIES_API_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'OPPORTUNITIES_API_TESTS_FAILED: % cas, % echec(s)\n  - %',
      v_cases, array_length(v_fail,1), array_to_string(v_fail,E'\n  - ');
  end if;
end
$oapi$;
