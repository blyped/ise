-- =====================================================================
-- supabase/tests/rls/0005_network_calls_suite.sql
--
-- Suite RLS NEGATIVE du lot « Appels au reseau » (migration 0040).
-- Modele auto-nettoyant : bloc DO unique, fixtures, assertions,
-- RAISE EXCEPTION final qui annule toute la transaction.
--
--   succes  ->  ERROR:  P0001: CALLS_TESTS_OK: N cas, 0 echec
--   echec   ->  ERROR:  P0001: CALLS_TESTS_FAILED: N cas, K echec(s)
--
-- FIXTURES (D-104)
--   Ada   auteur des appels, promotion A
--   Ben   membre actif, promotion A (meme promotion qu'Ada)
--   Cleo  membre actif, promotion B — hors audience
--   Dan   membre actif qui BLOQUE Ada
--   Eve   membre actif porteur de `calls.moderate` (superadmin)
-- =====================================================================

do $calls$
declare
  u_ada  uuid := '00000000-0000-4000-8001-000000000001';
  u_ben  uuid := '00000000-0000-4000-8001-000000000002';
  u_cleo uuid := '00000000-0000-4000-8001-000000000003';
  u_dan  uuid := '00000000-0000-4000-8001-000000000004';
  u_eve  uuid := '00000000-0000-4000-8001-000000000005';
  p_ada  uuid := '00000000-0000-4000-8001-0000000000a1';
  p_ben  uuid := '00000000-0000-4000-8001-0000000000a2';
  p_cleo uuid := '00000000-0000-4000-8001-0000000000a3';
  p_dan  uuid := '00000000-0000-4000-8001-0000000000a4';
  p_eve  uuid := '00000000-0000-4000-8001-0000000000a5';
  c_draft   uuid := '00000000-0000-4000-8001-0000000000c1';  -- brouillon d'Ada
  c_promo   uuid := '00000000-0000-4000-8001-0000000000c2';  -- actif, visibilite promotion
  c_target  uuid := '00000000-0000-4000-8001-0000000000c3';  -- actif, members, cible sur Ben
  c_members uuid := '00000000-0000-4000-8001-0000000000c4';  -- actif, members, sans ciblage
  r_ben     uuid := '00000000-0000-4000-8001-0000000000d1';
  v_promo_a bigint;
  v_promo_b bigint;
  v_role    smallint;
  v_cases   integer := 0;
  v_fail    text[]  := array[]::text[];
  v_n       bigint;
  v_ok      boolean;
  v_msg     text;
  v_num     numeric;
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  select id into v_promo_a from public.promotions order by id limit 1;
  select id into v_promo_b from public.promotions order by id desc limit 1;

  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', u_ada,  'authenticated', 'authenticated', 'test+calls.ada@ise.test',  now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_ben,  'authenticated', 'authenticated', 'test+calls.ben@ise.test',  now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_cleo, 'authenticated', 'authenticated', 'test+calls.cleo@ise.test', now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_dan,  'authenticated', 'authenticated', 'test+calls.dan@ise.test',  now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_eve,  'authenticated', 'authenticated', 'test+calls.eve@ise.test',  now(), now());

  insert into public.ise_profiles
    (id, user_id, first_name, last_name, promotion_id, profile_status, claim_status, claimed_at, is_test_account)
  values
    (p_ada,  u_ada,  'Ada',  'Test', v_promo_a, 'active', 'claimed', now(), true),
    (p_ben,  u_ben,  'Ben',  'Test', v_promo_a, 'active', 'claimed', now(), true),
    (p_cleo, u_cleo, 'Cleo', 'Test', v_promo_b, 'active', 'claimed', now(), true),
    (p_dan,  u_dan,  'Dan',  'Test', v_promo_b, 'active', 'claimed', now(), true),
    (p_eve,  u_eve,  'Eve',  'Test', v_promo_b, 'active', 'claimed', now(), true);

  select id into v_role from private.roles where code = 'superadmin';
  insert into private.user_roles (profile_id, role_id) values (p_eve, v_role);

  insert into public.network_calls
    (id, author_profile_id, call_type, title, description, visibility, status, published_at)
  values
    (c_draft,   p_ada, 'expert',  'Brouillon Ada',
     'Appel encore en brouillon, il ne doit atteindre personne d''autre que son auteur.',
     'members', 'draft', null),
    (c_promo,   p_ada, 'expert',  'Appel promotion',
     'Appel reserve a la promotion de son auteur : Cleo ne doit jamais le voir apparaitre.',
     'promotion', 'active', now()),
    (c_target,  p_ada, 'contact', 'Appel cible',
     'Appel members mais explicitement cible sur Ben : le ciblage restreint l''audience.',
     'members', 'active', now()),
    (c_members, p_ada, 'expert',  'Appel ouvert',
     'Appel ouvert a tous les membres, sert de controle positif et de test de blocage.',
     'members', 'active', now());

  insert into public.network_call_audience_profiles (call_id, profile_id) values (c_target, p_ben);

  insert into public.network_call_responses (id, call_id, author_profile_id, response_type, message, status)
  values (r_ben, c_members, p_ben, 'direct', 'Reponse de Ben, lisible par Ada et par Ben seuls.', 'new');

  insert into public.network_call_matches (call_id, profile_id, score, relevance_label, computed_at)
  values (c_members, p_ben, 87.50, 'very_relevant', now());

  insert into public.saved_network_calls (profile_id, call_id) values (p_ben, c_members);

  -- Dan bloque Ada : plus aucun contenu d'Ada ne l'atteint.
  insert into public.profile_blocks (blocker_profile_id, blocked_profile_id) values (p_dan, p_ada);

  -- ===================================================================
  -- Cleo : hors audience.
  -- ===================================================================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_cleo::text, 'role', 'authenticated')::text, true);

  -- N01 — appel en visibilite `promotion`, promotion differente.
  select count(*) into v_n from public.network_calls where id = c_promo;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('N01 appel promotion visible hors promotion (%s)', v_n); end if;

  -- N02 — appel `members` CIBLE sur Ben : le ciblage restreint.
  select count(*) into v_n from public.network_calls where id = c_target;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('N02 appel cible visible hors cible (%s)', v_n); end if;

  -- N03 — brouillon d'un tiers.
  select count(*) into v_n from public.network_calls where id = c_draft;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('N03 brouillon d''un tiers visible (%s)', v_n); end if;

  -- N04 — reponse d'un tiers a un appel d'un tiers.
  select count(*) into v_n from public.network_call_responses where id = r_ben;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('N04 reponse d''un tiers visible (%s)', v_n); end if;

  -- N05 — appels enregistres d'un tiers (D-72).
  select count(*) into v_n from public.saved_network_calls where profile_id = p_ben;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('N05 saved_network_calls d''un tiers visibles (%s)', v_n); end if;

  -- N06 — Cleo tente de repondre a un appel qu'elle ne voit pas.
  v_msg := null;
  begin
    insert into public.network_call_responses (call_id, author_profile_id, response_type, message)
    values (c_promo, p_cleo, 'direct', 'Reponse a un appel hors audience : doit etre refusee.');
    v_ok := false; v_msg := 'insertion acceptee';
  exception when others then v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('N06 reponse hors audience : ' || coalesce(v_msg, '')); end if;

  -- ===================================================================
  -- Ben : dans l'audience — controles POSITIFS.
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_ben::text, 'role', 'authenticated')::text, true);

  -- N07 — appel promotion, meme promotion (positif).
  select count(*) into v_n from public.network_calls where id = c_promo;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('N07 appel de sa propre promotion invisible (%s)', v_n); end if;

  -- N08 — appel cible sur lui (positif).
  select count(*) into v_n from public.network_calls where id = c_target;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('N08 appel cible invisible pour sa cible (%s)', v_n); end if;

  -- N09 — le score de pertinence n'atteint aucun client (MASTER PROMPT §15).
  v_msg := null;
  begin
    select score into v_num from public.network_call_matches
     where call_id = c_members and profile_id = p_ben;
    v_ok := false; v_msg := format('score lisible (= %s)', v_num);
  exception when insufficient_privilege then v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('N09 score de matching expose : ' || coalesce(v_msg, '')); end if;

  -- N10 — mais la ligne elle-meme est bien lisible (positif).
  select count(*) into v_n from public.network_call_matches
   where call_id = c_members and profile_id = p_ben;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('N10 ligne de matching propre invisible (%s)', v_n); end if;

  -- N11 — Ben ne modifie pas l'appel d'Ada.
  update public.network_calls set title = 'Detourne par Ben' where id = c_members;
  get diagnostics v_n = row_count;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('N11 update de l''appel d''un tiers : %s ligne(s)', v_n); end if;

  -- ===================================================================
  -- Ada : auteur — la machine d'etats reste hors de portee.
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_ada::text, 'role', 'authenticated')::text, true);

  -- N12 — l'auteur ne publie pas son appel par un simple UPDATE :
  -- publish_network_call() est le seul chemin.
  v_msg := null;
  begin
    update public.network_calls set status = 'active', published_at = now() where id = c_draft;
    get diagnostics v_n = row_count;
    v_ok := (v_n = 0);
    v_msg := format('%s ligne(s) passees en active par UPDATE', v_n);
  exception when others then v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('N12 machine d''etats contournee : ' || coalesce(v_msg, '')); end if;

  -- N13 — l'auteur ne cloture pas non plus par UPDATE (close_network_call).
  v_msg := null;
  begin
    update public.network_calls
       set status = 'resolved', resolution = 'resolved', closed_at = now()
     where id = c_members;
    get diagnostics v_n = row_count;
    v_ok := (v_n = 0);
    v_msg := format('%s ligne(s) cloturees par UPDATE', v_n);
  exception when others then v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('N13 cloture par UPDATE : ' || coalesce(v_msg, '')); end if;

  -- N14 — l'auteur voit bien la reponse qui lui est adressee (positif).
  select count(*) into v_n from public.network_call_responses where id = r_ben;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('N14 l''auteur ne voit pas la reponse a son appel (%s)', v_n); end if;

  -- ===================================================================
  -- Dan : bloqueur d'Ada.
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_dan::text, 'role', 'authenticated')::text, true);

  -- N15 — aucun contenu du bloque n'atteint le bloqueur.
  select count(*) into v_n from public.network_calls where id = c_members;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('N15 appel visible malgre le blocage (%s)', v_n); end if;

  -- N16 — et aucune sollicitation ne franchit le blocage.
  v_msg := null;
  begin
    insert into public.network_call_responses (call_id, author_profile_id, response_type, message)
    values (c_members, p_dan, 'direct', 'Reponse malgre un blocage : doit etre refusee.');
    v_ok := false; v_msg := 'insertion acceptee';
  exception when others then v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('N16 sollicitation a travers un blocage : ' || coalesce(v_msg, '')); end if;

  -- ===================================================================
  -- Eve : moderation.
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_eve::text, 'role', 'authenticated')::text, true);

  -- N17 — la moderation voit tout, y compris le brouillon (positif).
  select count(*) into v_n from public.network_calls where author_profile_id = p_ada;
  v_cases := v_cases + 1;
  if v_n <> 4 then v_fail := v_fail || format('N17 la moderation voit %s appels au lieu de 4', v_n); end if;

  -- N18 — mais elle non plus ne lit pas le score.
  v_msg := null;
  begin
    select score into v_num from public.network_call_matches where call_id = c_members;
    v_ok := false; v_msg := format('score lisible par la moderation (= %s)', v_num);
  exception when insufficient_privilege then v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('N18 ' || coalesce(v_msg, '')); end if;

  -- ===================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  select count(*) into v_n from private.security_baseline_violations();
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('N19 security_baseline_violations() renvoie %s ligne(s)', v_n); end if;

  if array_length(v_fail, 1) is null then
    raise exception 'CALLS_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'CALLS_TESTS_FAILED: % cas, % echec(s)\n  - %',
      v_cases, array_length(v_fail, 1), array_to_string(v_fail, E'\n  - ');
  end if;
end
$calls$;
