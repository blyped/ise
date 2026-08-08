-- =====================================================================
-- supabase/tests/rls/0011_news_events_suite.sql
--
-- Suite RLS NEGATIVE du lot « Actualites et evenements » (migration 0046).
--   succes -> ERROR: P0001: NEWS_EVENTS_TESTS_OK: 15 cas, 0 echec
--
-- E01 est le cas central : il constate en base que la colonne
-- `events.online_url_private` est protegee par un PRIVILEGE DE COLONNE, et
-- non par la seule RLS — un membre qui voit l'evenement ne doit pas
-- pouvoir lire le lien de connexion reserve aux inscrits.
--
-- FIXTURES : Uma (organisatrice) · Vlad (inscrit) · Wafa (membre non
--   inscrit) · Yann (autre promotion)
-- =====================================================================

do $ne$
declare
  u_uma uuid:='00000000-0000-4000-8007-000000000001'; u_vlad uuid:='00000000-0000-4000-8007-000000000002';
  u_wafa uuid:='00000000-0000-4000-8007-000000000003'; u_yann uuid:='00000000-0000-4000-8007-000000000004';
  p_uma uuid:='00000000-0000-4000-8007-0000000000a1'; p_vlad uuid:='00000000-0000-4000-8007-0000000000a2';
  p_wafa uuid:='00000000-0000-4000-8007-0000000000a3'; p_yann uuid:='00000000-0000-4000-8007-0000000000a4';
  e_on uuid:='00000000-0000-4000-8007-0000000000b1'; e_promo uuid:='00000000-0000-4000-8007-0000000000b2';
  r_reg uuid:='00000000-0000-4000-8007-0000000000c1';
  n_pub uuid:='00000000-0000-4000-8007-0000000000d1'; n_draft uuid:='00000000-0000-4000-8007-0000000000d2';
  v_pa bigint; v_pb bigint; v_et text;
  v_cases integer:=0; v_fail text[]:=array[]::text[]; v_n bigint; v_ok boolean; v_msg text; v_url text;
begin
  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  select id into v_pa from public.promotions order by id limit 1;
  select id into v_pb from public.promotions order by id desc limit 1;
  select code into v_et from public.event_types order by code limit 1;
  insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_uma,'authenticated','authenticated','test+ne.uma@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_vlad,'authenticated','authenticated','test+ne.vlad@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_wafa,'authenticated','authenticated','test+ne.wafa@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_yann,'authenticated','authenticated','test+ne.yann@ise.test',now(),now());
  insert into public.ise_profiles (id,user_id,first_name,last_name,promotion_id,profile_status,claim_status,claimed_at,is_test_account) values
    (p_uma,u_uma,'Uma','Ne',v_pa,'active','claimed',now(),true),
    (p_vlad,u_vlad,'Vlad','Ne',v_pa,'active','claimed',now(),true),
    (p_wafa,u_wafa,'Wafa','Ne',v_pa,'active','claimed',now(),true),
    (p_yann,u_yann,'Yann','Ne',v_pb,'active','claimed',now(),true);
  insert into public.events (id,event_type_code,title,slug,description,organizer_type,organizer_profile_id,format,online_url_private,online_url_visibility,attendee_list_visibility,visibility,status,starts_at,timezone,published_at,created_by_profile_id) values
    (e_on,v_et,'Webinaire test','webinaire-test-rls','Evenement en ligne de test.','profile',p_uma,'online','https://visio.test/salle-privee','registered','registered','members','published',now()+interval '7 day','UTC',now(),p_uma),
    (e_promo,v_et,'Evenement promo','evenement-promo-rls','Evenement reserve a une promotion.','promotion',null,'online','https://visio.test/promo','all_viewers','members','promotion','published',now()+interval '7 day','UTC',now(),p_uma);
  update public.events set organizer_promotion_id=v_pa where id=e_promo;
  insert into public.event_registrations (event_id,profile_id,status,is_listed) values (e_on,p_vlad,'registered',true);
  insert into public.event_resources (id,event_id,title,resource_type,external_url,visibility,created_by_profile_id) values
    (r_reg,e_on,'Support de seance','presentation','https://example.test/slides','registered',p_uma);
  insert into public.news (id,category_code,title,slug,summary,body,visibility,editorial_status,submitted_by_profile_id,published_at) values
    (n_pub,'ise_spotlight','Actualite publiee','actualite-publiee-rls','Resume de l''actualite publiee.','Corps.','members','published',p_uma,now()),
    (n_draft,'ise_spotlight','Brouillon','actualite-brouillon-rls','Resume du brouillon.','Corps.','members','draft',p_uma,null);

  -- Wafa : membre qui VOIT l'evenement mais n'y est pas inscrite.
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_wafa::text,'role','authenticated')::text,true);
  v_msg:=null;
  begin
    select online_url_private into v_url from public.events where id=e_on;
    v_ok:=false; v_msg:=format('lien prive lisible (= %s)',v_url);
  exception when insufficient_privilege then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('E01 events.online_url_private expose : '||coalesce(v_msg,'')); end if;
  select public.get_event_online_url(e_on) into v_url; v_cases:=v_cases+1;
  if v_url is not null then v_fail:=v_fail||'E02 un non-inscrit obtient le lien de connexion'; end if;
  select count(*) into v_n from public.event_resources where id=r_reg; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('E03 ressource reservee aux inscrits visible (%s)',v_n); end if;
  select count(*) into v_n from public.event_registrations where event_id=e_on; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('E04 liste des inscrits visible par un non-inscrit (%s)',v_n); end if;
  select count(*) into v_n from public.news where id=n_draft; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('E05 brouillon d''actualite visible (%s)',v_n); end if;
  select count(*) into v_n from public.news where id=n_pub; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('E06 actualite publiee invisible (%s)',v_n); end if;
  v_msg:=null;
  begin
    insert into public.news (category_code,title,slug,summary,visibility,editorial_status,submitted_by_profile_id,published_at)
    values ('ise_spotlight','Auto-publication','auto-publication-rls','Resume.','members','published',p_wafa,now());
    v_ok:=false; v_msg:='auto-publication acceptee';
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('E07 '||coalesce(v_msg,'')); end if;
  update public.events set title='Detourne par Wafa' where id=e_on;
  get diagnostics v_n=row_count; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('E08 evenement d''un tiers modifie (%s ligne(s))',v_n); end if;

  -- Vlad : inscrit (controles positifs + D-55).
  perform set_config('request.jwt.claims',json_build_object('sub',u_vlad::text,'role','authenticated')::text,true);
  select public.get_event_online_url(e_on) into v_url; v_cases:=v_cases+1;
  if v_url is null then v_fail:=v_fail||'E09 l''inscrit n''obtient pas le lien de connexion'; end if;
  select count(*) into v_n from public.event_resources where id=r_reg; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('E10 l''inscrit ne voit pas la ressource (%s)',v_n); end if;
  v_msg:=null;
  begin
    update public.event_registrations set status='attended', attended_at=now() where event_id=e_on and profile_id=p_vlad;
    get diagnostics v_n=row_count; v_ok:=(v_n=0); v_msg:=format('%s ligne(s) auto-declarees presentes',v_n);
  exception when others then v_ok:=true; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('E11 presence auto-declaree (D-55) : '||coalesce(v_msg,'')); end if;

  -- Yann : autre promotion.
  perform set_config('request.jwt.claims',json_build_object('sub',u_yann::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.events where id=e_promo; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('E12 evenement de promotion visible hors promotion (%s)',v_n); end if;

  -- Uma : organisatrice.
  perform set_config('request.jwt.claims',json_build_object('sub',u_uma::text,'role','authenticated')::text,true);
  select public.get_event_online_url(e_on) into v_url; v_cases:=v_cases+1;
  if v_url is null then v_fail:=v_fail||'E13 l''organisatrice n''obtient pas le lien de son propre evenement'; end if;
  select count(*) into v_n from public.event_registrations where event_id=e_on; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('E14 l''organisatrice ne voit pas ses inscrits (%s)',v_n); end if;

  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);
  select count(*) into v_n from private.security_baseline_violations(); v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('E15 security_baseline_violations() renvoie %s ligne(s)',v_n); end if;

  if array_length(v_fail,1) is null then
    raise exception 'NEWS_EVENTS_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'NEWS_EVENTS_TESTS_FAILED: % cas, % echec(s)\n  - %', v_cases, array_length(v_fail,1), array_to_string(v_fail,E'\n  - ');
  end if;
end
$ne$;
