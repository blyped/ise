-- =====================================================================
-- supabase/tests/rls/0027_communities_api_suite.sql
--
-- Suite de la couche API COMMUNAUTES (migration 0072, ISE-084 -> ISE-087).
--   succes -> ERROR: P0001: COMMUNITIES_API_TESTS_OK: 20 cas, 0 echec
--
-- Auto-nettoyante : le `RAISE EXCEPTION` final annule la transaction.
--
-- FIXTURES : Nina (membre de toutes les communautes) · Rita (membre
--   d'aucune). Sept communautes : privee, ouverte, sur demande (avec
--   moderation prealable), sur invitation, et trois destinees au test
--   anti cross-posting.
-- =====================================================================

do $com$
declare
  u_nina uuid:='00000000-0000-4000-8027-000000000001'; u_rita uuid:='00000000-0000-4000-8027-000000000002';
  p_nina uuid:='00000000-0000-4000-8027-0000000000a1'; p_rita uuid:='00000000-0000-4000-8027-0000000000a2';
  c_priv uuid:='00000000-0000-4000-8027-0000000000b1'; c_open uuid:='00000000-0000-4000-8027-0000000000b2';
  c_req  uuid:='00000000-0000-4000-8027-0000000000b3'; c_inv  uuid:='00000000-0000-4000-8027-0000000000b4';
  c_x1   uuid:='00000000-0000-4000-8027-0000000000b5'; c_x2   uuid:='00000000-0000-4000-8027-0000000000b6';
  c_x3   uuid:='00000000-0000-4000-8027-0000000000b7';
  x_priv uuid:='00000000-0000-4000-8027-0000000000c1'; x_open uuid:='00000000-0000-4000-8027-0000000000c2';
  k_com  uuid:='00000000-0000-4000-8027-0000000000d1';
  v_cases integer:=0; v_fail text[]:=array[]::text[]; v_ok boolean; v_j jsonb; v_fp text;
  v_title text:='Empreinte identique pour le test anti cross-posting';
  v_body  text:='Corps strictement identique repete dans plusieurs communautes.';
begin
  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_nina,'authenticated','authenticated','test+capi.nina@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_rita,'authenticated','authenticated','test+capi.rita@ise.test',now(),now());
  insert into public.ise_profiles (id,user_id,first_name,last_name,profile_status,claim_status,claimed_at,is_test_account) values
    (p_nina,u_nina,'Nina','Capi','active','claimed',now(),true),
    (p_rita,u_rita,'Rita','Capi','active','claimed',now(),true);
  insert into public.communities (id,name,slug,description,community_type,visibility,join_policy,post_moderation_mode,status,created_by_profile_id) values
    (c_priv,'API cercle prive','api-cercle-prive','Communaute privee de test.','thematic','private','invitation','immediate','active',p_nina),
    (c_open,'API cercle ouvert','api-cercle-ouvert','Communaute ouverte de test.','thematic','network','open','immediate','active',p_nina),
    (c_req,'API sur demande','api-sur-demande','Communaute sur demande de test.','thematic','network','request','pre_approval','active',p_nina),
    (c_inv,'API sur invitation','api-sur-invitation','Communaute sur invitation de test.','thematic','network','invitation','immediate','active',p_nina),
    (c_x1,'API cross 1','api-cross-1','Communaute de test cross-posting 1.','thematic','network','open','immediate','active',p_nina),
    (c_x2,'API cross 2','api-cross-2','Communaute de test cross-posting 2.','thematic','network','open','immediate','active',p_nina),
    (c_x3,'API cross 3','api-cross-3','Communaute de test cross-posting 3.','thematic','network','open','immediate','active',p_nina);
  insert into public.community_memberships (community_id,profile_id,role,membership_status,joined_at) values
    (c_priv,p_nina,'manager','active',now()),(c_open,p_nina,'member','active',now()),
    (c_req,p_nina,'member','active',now()),(c_x1,p_nina,'member','active',now()),
    (c_x2,p_nina,'member','active',now()),(c_x3,p_nina,'member','active',now());
  insert into public.community_posts (id,community_id,author_profile_id,post_type,title,body,visibility,status,published_at) values
    (x_priv,c_priv,p_nina,'question','Question interne au cercle prive','Contenu reserve.','community','published',now()),
    (x_open,c_open,p_nina,'question','Question ouverte au cercle reseau','Contenu ouvert.','community','published',now());
  insert into public.community_comments (id,post_id,author_profile_id,body,status) values
    (k_com,x_open,p_nina,'Une reponse de test.','published');
  v_fp := encode(extensions.digest(convert_to(lower(v_title)||'|'||lower(v_body),'UTF8'),'sha256'),'hex');
  insert into public.community_posts (community_id,author_profile_id,post_type,title,body,visibility,status,published_at,content_fingerprint)
  values (c_x1,p_nina,'analysis',v_title,v_body,'community','published',now(),v_fp),
         (c_x2,p_nina,'analysis',v_title,v_body,'community','published',now(),v_fp),
         (c_x3,p_nina,'analysis',v_title,v_body,'community','published',now(),v_fp);

  -- ------------------------------------------------------------------
  -- Rita : membre d'aucune communaute.
  -- ------------------------------------------------------------------
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_rita::text,'role','authenticated')::text,true);

  v_j := public.get_community(c_priv); v_cases:=v_cases+1;
  if v_j is not null then v_fail:=v_fail||'C01 fiche d''une communaute privee visible par un non-membre'::text; end if;

  begin v_j := public.list_community_posts(c_priv); v_ok:=false;
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||'C02 contenu d''une communaute privee lu par un non-membre'::text; end if;

  v_j := public.get_community(c_open); v_cases:=v_cases+1;
  if v_j is null then v_fail:=v_fail||'C03 fiche d''une communaute reseau invisible'::text; end if;

  -- MASTER PROMPT 1 : aucune mecanique de popularite ne doit sortir.
  v_cases:=v_cases+1;
  if (select count(*) from jsonb_object_keys(v_j) k
       where k ~* 'view|like|rank|popular|score|trend') <> 0 then
    v_fail:=v_fail||'C04 la fiche expose une mecanique de popularite'::text; end if;

  begin v_j := public.list_community_members(c_open); v_ok:=false;
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||'C05 annuaire lu par un non-membre'::text; end if;

  begin v_j := public.join_community(c_inv); v_ok:=false;
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||'C06 adhesion forcee a une communaute sur invitation'::text; end if;

  begin v_j := public.create_community_post(c_open,'question','Titre suffisamment long','Corps.'); v_ok:=false;
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||'C07 publication acceptee hors adhesion'::text; end if;

  v_j := public.join_community(c_open); v_cases:=v_cases+1;
  if v_j->>'membership_status' <> 'active' then v_fail:=v_fail||format('C08 adhesion libre : %s',v_j->>'membership_status'); end if;
  v_cases:=v_cases+1;
  if (select m.role from public.community_memberships m where m.community_id=c_open and m.profile_id=p_rita) <> 'member' then
    v_fail:=v_fail||'C09 role different de member apres adhesion'::text; end if;

  v_j := public.join_community(c_req); v_cases:=v_cases+1;
  if v_j->>'membership_status' <> 'pending' then v_fail:=v_fail||format('C10 adhesion sur demande : %s',v_j->>'membership_status'); end if;

  begin v_j := public.mark_comment_helpful(k_com,true); v_ok:=false;
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||'C11 marquage utile par un tiers'::text; end if;

  begin v_j := public.resolve_community_post(x_open,'Synthese suffisamment longue pour passer la validation.'); v_ok:=false;
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||'C12 cloture d''une publication par un tiers'::text; end if;

  begin v_j := public.get_community_post_tracking(x_open); v_ok:=false;
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||'C13 suivi d''une publication lu par un tiers'::text; end if;

  -- ------------------------------------------------------------------
  -- Nina : membre de toutes les communautes.
  -- ------------------------------------------------------------------
  perform set_config('request.jwt.claims',json_build_object('sub',u_nina::text,'role','authenticated')::text,true);

  v_j := public.create_community_post(c_req,'question','Question posee en moderation prealable','Corps de la question.'); v_cases:=v_cases+1;
  if v_j->>'status' <> 'pending_review' then v_fail:=v_fail||format('C14 moderation prealable ignoree : %s',v_j->>'status'); end if;

  begin v_j := public.create_community_post(c_priv,'analysis','Analyse ouverte au reseau depuis un cercle prive','Corps.','network'); v_ok:=false;
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||'C15 billet reseau depuis une communaute privee'::text; end if;

  begin v_j := public.create_community_post(c_open,'analysis',v_title,v_body); v_ok:=false;
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||'C16 cross-posting a l''identique accepte'::text; end if;

  v_j := public.resolve_community_post(x_open,'Synthese suffisamment longue pour passer la validation.'); v_cases:=v_cases+1;
  if coalesce((v_j->>'is_resolved')::boolean,false) is not true then v_fail:=v_fail||'C17 cloture refusee a l''auteur'::text; end if;

  v_j := public.get_community_post_tracking(x_open); v_cases:=v_cases+1;
  if (v_j->'counters'->>'replies')::int <> 1 then v_fail:=v_fail||'C18 decompte des reponses faux'::text; end if;

  v_j := public.list_communities('for_me'); v_cases:=v_cases+1;
  if jsonb_typeof(v_j->'rows') <> 'array' then v_fail:=v_fail||'C19 list_communities(for_me) ne renvoie pas de lignes'::text; end if;

  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  v_cases:=v_cases+1;
  if (select count(*) from private.security_baseline_violations()) <> 0 then
    v_fail:=v_fail||'C20 security_baseline_violations() non vide'::text; end if;

  if array_length(v_fail,1) is null then
    raise exception 'COMMUNITIES_API_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'COMMUNITIES_API_TESTS_FAILED: % cas, % echec(s)\n  - %', v_cases, array_length(v_fail,1), array_to_string(v_fail,E'\n  - ');
  end if;
end
$com$;
