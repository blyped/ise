-- =====================================================================
-- supabase/tests/rls/0003_profile_sections_suite.sql
--
-- Suite de tests RLS NEGATIFS de la tranche
-- « Onboarding ISE-008 -> ISE-014 » et « Profil ISE-016 -> ISE-023 ».
-- MASTER PROMPT §80 : « une politique RLS non testee n'est pas terminee ».
--
-- Meme modele auto-nettoyant que 0001 et 0002 : un unique bloc DO, des
-- fixtures creees sous `postgres` (BYPASSRLS), des assertions executees
-- en changeant d'identite, et une exception finale qui annule TOUT.
--
--   succes  ->  ERROR:  P0001: PROFILE_TESTS_OK: 30 cas, 0 echec
--   echec   ->  ERROR:  P0001: PROFILE_TESTS_FAILED: 30 cas, K echec(s)
--
-- Verdict du 8 aout 2026 : PROFILE_TESTS_OK: 30 cas, 0 echec.
--
-- FIXTURES (D-104 : is_test_account = true, e-mails prefixes `test+`)
--   Nadia   membre actif, en relation avec Omar
--   Omar    membre actif, en relation avec Nadia
--   Sarah   membre actif, SANS relation avec Nadia
-- =====================================================================

do $profile$
declare
  u_nadia uuid := '00000000-0000-4000-8000-0000000001f1';
  u_omar  uuid := '00000000-0000-4000-8000-0000000001f2';
  u_sarah uuid := '00000000-0000-4000-8000-0000000001f3';
  p_nadia uuid := '00000000-0000-4000-8000-0000000002f1';
  p_omar  uuid := '00000000-0000-4000-8000-0000000002f2';
  p_sarah uuid := '00000000-0000-4000-8000-0000000002f3';

  x_exp_omar_priv    uuid := '00000000-0000-4000-8000-0000000003f1';
  x_exp_nadia_public uuid := '00000000-0000-4000-8000-0000000003f2';
  x_edu_omar_conn    uuid := '00000000-0000-4000-8000-0000000003f3';
  x_sugg_omar        uuid := '00000000-0000-4000-8000-0000000003f4';

  v_promotion bigint;
  v_skill_a   bigint;
  v_skill_b   bigint;
  v_avail     text;

  v_cases  integer := 0;
  v_fail   text[]  := array[]::text[];
  v_n      bigint;
  v_ok     boolean;
  v_msg    text;
  v_ts     timestamptz;
  v_ts2    timestamptz;
  v_score  smallint;
  v_level  text;
begin
  -- ===================================================================
  -- FIXTURES
  -- ===================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  select id into v_promotion from public.promotions order by graduation_year desc limit 1;
  select id into v_skill_a from public.skills where is_active order by id limit 1;
  select id into v_skill_b from public.skills where is_active order by id desc limit 1;
  select code into v_avail from public.availability_types where is_active order by sort_order limit 1;

  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', u_nadia, 'authenticated', 'authenticated', 'test+nadia@ise.test', now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_omar,  'authenticated', 'authenticated', 'test+omar@ise.test',  now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_sarah, 'authenticated', 'authenticated', 'test+sarah@ise.test', now(), now());

  insert into public.ise_profiles
    (id, user_id, promotion_id, first_name, last_name, profile_status, claim_status, claimed_at, is_test_account)
  values
    (p_nadia, u_nadia, v_promotion, 'Nadia', 'Test', 'active', 'claimed', now(), true),
    (p_omar,  u_omar,  v_promotion, 'Omar',  'Test', 'active', 'claimed', now(), true),
    -- Sarah n'a PAS de promotion : elle sert au cas « finalisation refusee ».
    (p_sarah, u_sarah, null,        'Sarah', 'Test', 'active', 'claimed', now(), true);

  insert into public.connections (profile_a_id, profile_b_id)
  values (least(p_nadia, p_omar), greatest(p_nadia, p_omar));

  insert into public.experiences
    (id, profile_id, organization_name_raw, position_title, start_date, visibility)
  values
    (x_exp_omar_priv,    p_omar,  'Org Omar',  'Mission privee d''Omar', date '2019-01-01', 'private'),
    (x_exp_nadia_public, p_nadia, 'Org Nadia', 'Mission visible',        date '2020-01-01', 'members');

  insert into public.educations
    (id, profile_id, institution, degree, visibility)
  values
    (x_edu_omar_conn, p_omar, 'ENSEA', 'Diplome d''Omar', 'connections');

  insert into public.profile_skills (profile_id, skill_id, level, is_primary)
  values (p_omar, v_skill_a, 'advanced', true);

  insert into public.profile_availabilities (profile_id, availability_type, active, visibility)
  values (p_omar, v_avail, true, 'private');

  insert into public.profile_visibility (profile_id, field_key, visibility)
  values (p_omar, 'city', 'private');

  insert into public.profile_onboarding_progress (profile_id, current_step, furthest_step)
  values (p_omar, 4, 4);

  insert into public.promotion_suggestions
    (id, submitted_by_profile_id, promotion_label, status)
  values (x_sugg_omar, p_omar, 'ISE 1998 Omar', 'submitted');

  -- ===================================================================
  -- Nadia authentifiee (en relation avec Omar).
  -- ===================================================================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_nadia::text, 'role', 'authenticated')::text, true);

  -- P01 — progression d'onboarding d'un tiers : strictement personnelle.
  select count(*) into v_n from public.profile_onboarding_progress where profile_id = p_omar;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('P01 progression d''onboarding d''un tiers visible (%s)', v_n); end if;

  -- P02 — ecrire une progression au nom d'un tiers.
  v_msg := null;
  begin
    insert into public.profile_onboarding_progress (profile_id, current_step, furthest_step)
    values (p_sarah, 7, 7);
    v_ok := false;
    v_msg := 'insertion acceptee';
  exception when others then
    v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('P02 progression ecrite au nom d''un tiers : ' || coalesce(v_msg, '')); end if;

  -- P03 — mettre a jour la progression d'un tiers.
  update public.profile_onboarding_progress set current_step = 1 where profile_id = p_omar;
  get diagnostics v_n = row_count;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('P03 progression d''un tiers modifiee (%s ligne(s))', v_n); end if;

  -- P04 — ajouter une competence a un autre membre.
  v_msg := null;
  begin
    insert into public.profile_skills (profile_id, skill_id, level)
    values (p_omar, v_skill_b, 'expert');
    v_ok := false;
    v_msg := 'insertion acceptee';
  exception when others then
    v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('P04 competence ajoutee a un tiers : ' || coalesce(v_msg, '')); end if;

  -- P05 — modifier le niveau declare d'une competence d'un tiers.
  update public.profile_skills set level = 'notion'
   where profile_id = p_omar and skill_id = v_skill_a;
  get diagnostics v_n = row_count;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('P05 niveau d''un tiers modifie (%s ligne(s))', v_n); end if;

  -- P06 — supprimer une competence d'un tiers.
  delete from public.profile_skills where profile_id = p_omar and skill_id = v_skill_a;
  get diagnostics v_n = row_count;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('P06 competence d''un tiers supprimee (%s ligne(s))', v_n); end if;

  -- P07 — controle positif : la competence d'Omar est bien restee intacte.
  perform set_config('role', 'postgres', true);
  select level into v_level from public.profile_skills
   where profile_id = p_omar and skill_id = v_skill_a;
  perform set_config('role', 'authenticated', true);
  v_cases := v_cases + 1;
  if v_level is distinct from 'advanced' then
    v_fail := v_fail || format('P07 niveau d''Omar altere (%s)', coalesce(v_level, 'NULL'));
  end if;

  -- P08 — experience `private` d'une RELATION : invisible malgre la relation.
  select count(*) into v_n from public.experiences where id = x_exp_omar_priv;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('P08 experience private d''une relation visible (%s)', v_n); end if;

  -- P09 — formation `connections` d'une relation : visible (controle positif).
  select count(*) into v_n from public.educations where id = x_edu_omar_conn;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('P09 formation connections d''une relation invisible (%s)', v_n); end if;

  -- P10 — modifier la formation d'un tiers.
  update public.educations set degree = 'detourne' where id = x_edu_omar_conn;
  get diagnostics v_n = row_count;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('P10 formation d''un tiers modifiee (%s ligne(s))', v_n); end if;

  -- P11 — supprimer la formation d'un tiers.
  delete from public.educations where id = x_edu_omar_conn;
  get diagnostics v_n = row_count;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('P11 formation d''un tiers supprimee (%s ligne(s))', v_n); end if;

  -- P12 — disponibilite `private` d'une relation.
  select count(*) into v_n from public.profile_availabilities
   where profile_id = p_omar and visibility = 'private';
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('P12 disponibilite private d''une relation visible (%s)', v_n); end if;

  -- P13 — choix de visibilite d'un tiers : jamais lisible.
  select count(*) into v_n from public.profile_visibility where profile_id = p_omar;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('P13 profile_visibility d''un tiers visible (%s)', v_n); end if;

  -- P14 — poser un choix de visibilite au nom d'un tiers.
  v_msg := null;
  begin
    insert into public.profile_visibility (profile_id, field_key, visibility)
    values (p_omar, 'bio', 'members');
    v_ok := false;
    v_msg := 'insertion acceptee';
  exception when others then
    v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('P14 visibilite posee au nom d''un tiers : ' || coalesce(v_msg, '')); end if;

  -- P15 — signalement de promotion d'un tiers.
  select count(*) into v_n from public.promotion_suggestions where id = x_sugg_omar;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('P15 signalement d''un tiers visible (%s)', v_n); end if;

  -- P16 — deposer un signalement au nom d'un tiers.
  v_msg := null;
  begin
    insert into public.promotion_suggestions (submitted_by_profile_id, promotion_label)
    values (p_omar, 'ISE 1999 usurpe');
    v_ok := false;
    v_msg := 'insertion acceptee';
  exception when others then
    v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('P16 signalement depose au nom d''un tiers : ' || coalesce(v_msg, '')); end if;

  -- P17 — deposer un signalement DEJA accepte (statut initial impose).
  v_msg := null;
  begin
    insert into public.promotion_suggestions (submitted_by_profile_id, promotion_label, status)
    values (p_nadia, 'ISE 2000 auto-acceptee', 'accepted');
    v_ok := false;
    v_msg := 'insertion acceptee';
  exception when others then
    v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('P17 signalement auto-accepte : ' || coalesce(v_msg, '')); end if;

  -- P18 — controle positif : Nadia depose son propre signalement.
  v_msg := null;
  begin
    insert into public.promotion_suggestions (submitted_by_profile_id, promotion_label)
    values (p_nadia, 'ISE 2001 signalee par Nadia');
    v_ok := true;
  exception when others then
    v_ok := false;
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('P18 signalement propre refuse : ' || coalesce(v_msg, '')); end if;

  -- ===================================================================
  -- P19 — la visibilite par champ est REELLEMENT appliquee.
  -- Nadia passe son experience `members` en `private` ; Sarah, qui la
  -- voyait, ne doit plus la voir. La verification porte sur la base, pas
  -- sur l'interface.
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_sarah::text, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.experiences where id = x_exp_nadia_public;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('P19a experience `members` invisible avant bascule (%s)', v_n); end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', u_nadia::text, 'role', 'authenticated')::text, true);
  update public.experiences set visibility = 'private' where id = x_exp_nadia_public;
  get diagnostics v_n = row_count;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('P19b le proprietaire ne peut pas changer sa visibilite (%s)', v_n); end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', u_sarah::text, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.experiences where id = x_exp_nadia_public;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('P19c experience passee en private encore visible (%s)', v_n); end if;

  -- P20 — `my_profile_missing_items()` ne parle que du membre courant.
  -- Sarah n'a ni promotion ni contenu : sa liste ne peut pas etre vide.
  select count(*) into v_n from public.my_profile_missing_items();
  v_cases := v_cases + 1;
  if v_n = 0 then v_fail := v_fail || 'P20 my_profile_missing_items() vide pour un profil vide'; end if;

  -- ===================================================================
  -- P21 -> P24 — finalisation de l'onboarding.
  -- ===================================================================

  -- P21 — Sarah n'a pas de promotion : la finalisation doit etre refusee.
  v_msg := null;
  begin
    perform public.complete_onboarding();
    v_ok := false;
    v_msg := 'finalisation acceptee sans promotion';
  exception when others then
    v_ok := (sqlerrm = 'onboarding_promotion_required');
    v_msg := 'code inattendu : ' || sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('P21 ' || coalesce(v_msg, '')); end if;

  -- P22 — Nadia a une promotion : la finalisation aboutit.
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_nadia::text, 'role', 'authenticated')::text, true);
  v_msg := null;
  begin
    select completion, completed_at into v_score, v_ts from public.complete_onboarding();
    v_ok := (v_ts is not null and v_score is not null);
    v_msg := 'sortie inattendue';
  exception when others then
    v_ok := false;
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('P22 finalisation refusee a un profil complet : ' || coalesce(v_msg, '')); end if;

  -- P23 — la base porte reellement la marque de fin d'onboarding.
  perform set_config('role', 'postgres', true);
  select onboarding_completed_at into v_ts2 from public.ise_profiles where id = p_nadia;
  perform set_config('role', 'authenticated', true);
  v_cases := v_cases + 1;
  if v_ts2 is null then v_fail := v_fail || 'P23 onboarding_completed_at non pose'; end if;

  -- P24 — idempotence : un second appel ne repousse pas la date.
  begin
    perform public.complete_onboarding();
  exception when others then
    null;
  end;
  perform set_config('role', 'postgres', true);
  select onboarding_completed_at into v_ts from public.ise_profiles where id = p_nadia;
  perform set_config('role', 'authenticated', true);
  v_cases := v_cases + 1;
  if v_ts is distinct from v_ts2 then v_fail := v_fail || 'P24 second appel de complete_onboarding() a repousse la date'; end if;

  -- P25 — `search_skills` est refusee a `anon`.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '', true);
  v_msg := null;
  begin
    select count(*) into v_n from public.search_skills('econo', 5);
    v_ok := false;
    v_msg := format('%s ligne(s) lues par anon', v_n);
  exception when others then
    v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('P25 search_skills ouverte a anon : ' || coalesce(v_msg, '')); end if;

  -- P26 — controle positif : un membre authentifie y a acces, alias resolus.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_nadia::text, 'role', 'authenticated')::text, true);
  v_msg := null;
  begin
    select count(*) into v_n from public.search_skills('econometrie', 10);
    v_ok := (v_n >= 1);
    v_msg := format('%s resultat(s)', v_n);
  exception when others then
    v_ok := false;
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('P26 search_skills inutilisable par un membre : ' || coalesce(v_msg, '')); end if;

  -- P27 — lignes de base de securite, apres 0035 et 0036.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  select count(*) into v_n from private.security_baseline_violations();
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('P27a security_baseline_violations() renvoie %s ligne(s)', v_n); end if;

  select count(*) into v_n from private.tables_without_rls();
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('P27b tables_without_rls() renvoie %s ligne(s)', v_n); end if;

  -- ===================================================================
  -- RAPPORT + ROLLBACK
  -- ===================================================================
  if array_length(v_fail, 1) is null then
    raise exception 'PROFILE_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'PROFILE_TESTS_FAILED: % cas, % echec(s)\n  - %',
      v_cases, array_length(v_fail, 1), array_to_string(v_fail, E'\n  - ');
  end if;
end
$profile$;
