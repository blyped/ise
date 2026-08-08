-- =====================================================================
-- supabase/tests/rls/0009_communities_suite.sql
--
-- Suite RLS NEGATIVE du lot « Communautes » (migration 0044).
--   succes -> ERROR: P0001: COMMUNITIES_TESTS_OK: 16 cas, 0 echec
--
-- FIXTURES : Nina (creatrice/gestionnaire des deux communautes) ·
--   Omar (membre du cercle prive) · Rita (non-membre) ·
--   Sami (membre du cercle ouvert, BLOQUE par Nina)
-- =====================================================================

do $com$
declare
  u_nina uuid:='00000000-0000-4000-8005-000000000001'; u_omar uuid:='00000000-0000-4000-8005-000000000002';
  u_rita uuid:='00000000-0000-4000-8005-000000000003'; u_sami uuid:='00000000-0000-4000-8005-000000000004';
  p_nina uuid:='00000000-0000-4000-8005-0000000000a1'; p_omar uuid:='00000000-0000-4000-8005-0000000000a2';
  p_rita uuid:='00000000-0000-4000-8005-0000000000a3'; p_sami uuid:='00000000-0000-4000-8005-0000000000a4';
  c_priv uuid:='00000000-0000-4000-8005-0000000000b1'; c_net uuid:='00000000-0000-4000-8005-0000000000b2';
  x_priv uuid:='00000000-0000-4000-8005-0000000000c1'; x_net uuid:='00000000-0000-4000-8005-0000000000c2';
  k_com uuid:='00000000-0000-4000-8005-0000000000d1'; mo uuid:='00000000-0000-4000-8005-0000000000e1';
  v_cases integer:=0; v_fail text[]:=array[]::text[]; v_n bigint; v_ok boolean; v_msg text;
begin
  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_nina,'authenticated','authenticated','test+com.nina@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_omar,'authenticated','authenticated','test+com.omar@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_rita,'authenticated','authenticated','test+com.rita@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_sami,'authenticated','authenticated','test+com.sami@ise.test',now(),now());
  insert into public.ise_profiles (id,user_id,first_name,last_name,profile_status,claim_status,claimed_at,is_test_account) values
    (p_nina,u_nina,'Nina','Com','active','claimed',now(),true),
    (p_omar,u_omar,'Omar','Com','active','claimed',now(),true),
    (p_rita,u_rita,'Rita','Com','active','claimed',now(),true),
    (p_sami,u_sami,'Sami','Com','active','claimed',now(),true);
  insert into public.communities (id,name,slug,description,community_type,visibility,join_policy,status,created_by_profile_id) values
    (c_priv,'Cercle prive','cercle-prive-test','Communaute privee de test, invisible hors de ses membres.','thematic','private','invitation','active',p_nina),
    (c_net,'Cercle ouvert','cercle-ouvert-test','Communaute ouverte au reseau, adhesion libre.','thematic','network','open','active',p_nina);
  insert into public.community_memberships (community_id,profile_id,role,membership_status,joined_at) values
    (c_priv,p_nina,'manager','active',now()),
    (c_priv,p_omar,'member','active',now()),
    (c_net,p_nina,'manager','active',now()),
    (c_net,p_sami,'member','active',now());
  insert into public.community_posts (id,community_id,author_profile_id,post_type,title,body,visibility,status,published_at) values
    (x_priv,c_priv,p_nina,'question','Question interne','Contenu reserve aux membres du cercle prive.','community','published',now()),
    (x_net,c_net,p_nina,'analysis','Analyse ouverte','Contenu explicitement ouvert au reseau.','network','published',now());
  insert into public.community_comments (id,post_id,author_profile_id,body,status) values
    (k_com,x_priv,p_omar,'Commentaire interne au cercle prive.','published');
  insert into public.community_moderation_actions (id,community_id,actor_profile_id,target_type,target_post_id,action,reason_text) values
    (mo,c_priv,p_nina,'post',x_priv,'lock','Motif interne de moderation.');
  insert into public.profile_blocks (blocker_profile_id,blocked_profile_id) values (p_nina,p_sami);

  -- Rita : membre de la plateforme, membre d'aucune communaute.
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_rita::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.communities where id=c_priv; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('C01 communaute privee visible par un non-membre (%s)',v_n); end if;
  select count(*) into v_n from public.communities where id=c_net; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('C02 communaute reseau invisible (%s)',v_n); end if;
  select count(*) into v_n from public.community_posts where id=x_priv; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('C03 billet d''une communaute privee visible (%s)',v_n); end if;
  select count(*) into v_n from public.community_posts where id=x_net; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('C04 billet ouvert au reseau invisible (%s)',v_n); end if;
  select count(*) into v_n from public.community_comments where id=k_com; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('C05 commentaire d''un cercle prive visible (%s)',v_n); end if;
  select count(*) into v_n from public.community_moderation_actions where id=mo; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('C06 journal de moderation visible par un non-moderateur (%s)',v_n); end if;
  select count(*) into v_n from public.community_memberships where community_id=c_priv; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('C07 liste des membres d''un cercle prive visible (%s)',v_n); end if;
  v_msg:=null;
  begin
    insert into public.community_posts (community_id,author_profile_id,post_type,title,body,visibility,status,published_at)
    values (c_priv,p_rita,'question','Intrusion','Publication dans une communaute dont on n''est pas membre.','community','published',now());
    v_ok:=false; v_msg:='publication acceptee';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('C08 '||coalesce(v_msg,'')); end if;
  v_msg:=null;
  begin
    insert into public.community_memberships (community_id,profile_id,role,membership_status,joined_at)
    values (c_priv,p_rita,'member','active',now());
    v_ok:=false; v_msg:='adhesion forcee a une communaute sur invitation';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('C09 '||coalesce(v_msg,'')); end if;
  v_msg:=null;
  begin
    insert into public.community_memberships (community_id,profile_id,role,membership_status,joined_at)
    values (c_net,p_rita,'moderator','active',now());
    v_ok:=false; v_msg:='auto-promotion en moderateur acceptee';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('C10 '||coalesce(v_msg,'')); end if;
  -- C11 : controle POSITIF — l'adhesion libre a une communaute ouverte marche.
  v_msg:=null;
  begin
    insert into public.community_memberships (community_id,profile_id,role,membership_status,joined_at)
    values (c_net,p_rita,'member','active',now());
    v_ok:=true;
  exception when others then v_ok:=false; v_msg:=sqlerrm; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('C11 adhesion libre refusee : '||coalesce(v_msg,'')); end if;

  -- Omar : membre simple du cercle prive.
  perform set_config('request.jwt.claims',json_build_object('sub',u_omar::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.community_posts where id=x_priv; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('C12 le membre ne voit pas le billet de sa communaute (%s)',v_n); end if;
  update public.community_posts set title='Detourne par Omar' where id=x_priv;
  get diagnostics v_n=row_count; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('C13 billet d''un tiers modifie (%s ligne(s))',v_n); end if;
  select count(*) into v_n from public.community_moderation_actions where id=mo; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('C14 journal de moderation lu par un simple membre (%s)',v_n); end if;

  -- Sami : membre du cercle ouvert, mais bloque par l'auteur du billet.
  perform set_config('request.jwt.claims',json_build_object('sub',u_sami::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.community_posts where id=x_net; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('C15 billet visible malgre le blocage de son auteur (%s)',v_n); end if;

  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  select count(*) into v_n from private.security_baseline_violations(); v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('C16 security_baseline_violations() renvoie %s ligne(s)',v_n); end if;

  if array_length(v_fail,1) is null then
    raise exception 'COMMUNITIES_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'COMMUNITIES_TESTS_FAILED: % cas, % echec(s)\n  - %', v_cases, array_length(v_fail,1), array_to_string(v_fail,E'\n  - ');
  end if;
end
$com$;
