-- =====================================================================
-- supabase/tests/rls/0016_network_calls_api_suite.sql
--
-- Suite NEGATIVE de la couche API des APPELS AU RESEAU (migration 0052).
-- Complete 0005, qui teste les POLITIQUES : celle-ci teste les CHEMINS
-- exposes a l'application. Une politique correcte ne garantit rien si un
-- RPC `SECURITY DEFINER` la contourne.
--
-- Modele auto-nettoyant : bloc DO unique, fixtures, assertions,
-- RAISE EXCEPTION final qui annule toute la transaction.
--
--   succes  ->  ERROR:  P0001: CALLS_API_TESTS_OK: N cas, 0 echec
--   echec   ->  ERROR:  P0001: CALLS_API_TESTS_FAILED: N cas, K echec(s)
--
-- FIXTURES (D-104)
--   Ada   auteur des appels, promotion A
--   Ben   membre actif, promotion A, repond a l'appel ouvert
--   Cleo  membre actif, promotion B — HORS audience
--   Dan   membre actif, promotion A, repond aussi a l'appel ouvert
-- =====================================================================

do $capi$
declare
  u_ada  uuid := '00000000-0000-4000-8016-000000000001';
  u_ben  uuid := '00000000-0000-4000-8016-000000000002';
  u_cleo uuid := '00000000-0000-4000-8016-000000000003';
  u_dan  uuid := '00000000-0000-4000-8016-000000000004';
  p_ada  uuid := '00000000-0000-4000-8016-0000000000a1';
  p_ben  uuid := '00000000-0000-4000-8016-0000000000a2';
  p_cleo uuid := '00000000-0000-4000-8016-0000000000a3';
  p_dan  uuid := '00000000-0000-4000-8016-0000000000a4';
  c_draft   uuid := '00000000-0000-4000-8016-0000000000c1';
  c_promo   uuid := '00000000-0000-4000-8016-0000000000c2';
  c_members uuid := '00000000-0000-4000-8016-0000000000c3';
  r_ben     uuid := '00000000-0000-4000-8016-0000000000d1';
  r_dan     uuid := '00000000-0000-4000-8016-0000000000d2';
  v_promo_a bigint;
  v_promo_b bigint;
  v_cases   integer := 0;
  v_fail    text[]  := array[]::text[];
  v_n       bigint;
  v_ok      boolean;
  v_msg     text;
  v_json    jsonb;
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  select id into v_promo_a from public.promotions order by id limit 1;
  select id into v_promo_b from public.promotions order by id desc limit 1;

  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', u_ada,  'authenticated', 'authenticated', 'test+capi.ada@ise.test',  now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_ben,  'authenticated', 'authenticated', 'test+capi.ben@ise.test',  now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_cleo, 'authenticated', 'authenticated', 'test+capi.cleo@ise.test', now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_dan,  'authenticated', 'authenticated', 'test+capi.dan@ise.test',  now(), now());

  insert into public.ise_profiles
    (id, user_id, first_name, last_name, promotion_id, profile_status, claim_status, claimed_at, is_test_account)
  values
    (p_ada,  u_ada,  'Ada',  'Api', v_promo_a, 'active', 'claimed', now(), true),
    (p_ben,  u_ben,  'Ben',  'Api', v_promo_a, 'active', 'claimed', now(), true),
    (p_cleo, u_cleo, 'Cleo', 'Api', v_promo_b, 'active', 'claimed', now(), true),
    (p_dan,  u_dan,  'Dan',  'Api', v_promo_a, 'active', 'claimed', now(), true);

  insert into public.network_calls
    (id, author_profile_id, call_type, title, description, visibility, status, published_at)
  values
    (c_draft,   p_ada, 'expert', 'Brouillon API',
     'Brouillon d''appel servant a verifier que save_network_call_draft refuse les tiers.',
     'members', 'draft', null),
    (c_promo,   p_ada, 'expert', 'Appel promotion API',
     'Appel reserve a la promotion de son auteur : Cleo ne doit jamais le voir par aucun chemin.',
     'promotion', 'active', now()),
    (c_members, p_ada, 'contact', 'Appel ouvert API',
     'Appel ouvert a tous les membres verifies, sert de controle positif aux lectures composees.',
     'members', 'active', now());

  insert into public.network_call_responses (id, call_id, author_profile_id, response_type, message, status)
  values
    (r_ben, c_members, p_ben, 'direct', 'Reponse de Ben, privee entre Ben et Ada.', 'new'),
    (r_dan, c_members, p_dan, 'direct', 'Reponse de Dan, privee entre Dan et Ada.', 'new');

  insert into public.network_call_matches (call_id, profile_id, score, relevance_label, reasons, computed_at)
  values (c_members, p_ben, 87.50, 'very_relevant',
          '[{"criterion":"skills","label":"Competence recherchee : Econometrie","evidence":["Econometrie"]}]'::jsonb,
          now());

  -- ===================================================================
  -- Cleo — hors audience. Aucun chemin ne doit lui livrer l'appel.
  -- ===================================================================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_cleo::text, 'role', 'authenticated')::text, true);

  -- A01 — get_network_call sur un appel hors audience.
  v_msg := null;
  begin
    perform public.get_network_call(c_promo);
    v_ok := false; v_msg := 'get_network_call a renvoye un appel hors audience';
  exception when others then v_ok := (sqlerrm = 'network_call_not_found');
    if not v_ok then v_msg := 'erreur inattendue : ' || sqlerrm; end if;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('A01 ' || coalesce(v_msg, '')); end if;

  -- A02 — l'appel hors audience n'apparait pas dans la liste.
  v_json := public.list_network_calls('all', null, null, null, null, null, null, 'open', null, 50);
  select count(*) into v_n
    from jsonb_array_elements(v_json->'rows') e
   where (e->>'call_id')::uuid = c_promo;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('A02 appel promotion liste hors promotion (%s)', v_n); end if;

  -- A03 — repondre a un appel hors audience.
  v_msg := null;
  begin
    perform public.respond_to_network_call(c_promo, 'direct', 'Tentative hors audience.');
    v_ok := false; v_msg := 'reponse acceptee sur un appel hors audience';
  exception when others then v_ok := true; end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('A03 ' || coalesce(v_msg, '')); end if;

  -- A04 — enregistrer un appel hors audience.
  v_msg := null;
  begin
    perform public.toggle_saved_network_call(c_promo, true);
    v_ok := false; v_msg := 'appel hors audience enregistrable';
  exception when others then v_ok := true; end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('A04 ' || coalesce(v_msg, '')); end if;

  -- ===================================================================
  -- Ben — repondant. Il ne voit jamais les reponses des autres.
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_ben::text, 'role', 'authenticated')::text, true);

  -- A05 — le RPC de suivi est reserve a l'auteur de l'appel.
  v_msg := null;
  begin
    perform public.list_network_call_responses(c_members);
    v_ok := false; v_msg := 'un repondant a pu lister les reponses recues';
  exception when others then v_ok := (sqlerrm = 'not_authorized');
    if not v_ok then v_msg := 'erreur inattendue : ' || sqlerrm; end if;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('A05 ' || coalesce(v_msg, '')); end if;

  -- A06 — et la lecture directe ne lui rend que SA reponse.
  select count(*) into v_n from public.network_call_responses where call_id = c_members;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('A06 un repondant voit %s reponses au lieu d''une', v_n); end if;

  -- A07 — il ne trie pas les reponses : ce plan de travail est celui de l'auteur.
  v_msg := null;
  begin
    perform public.set_network_call_response_status(r_ben, 'useful');
    v_ok := false; v_msg := 'un repondant a pu modifier un statut de traitement';
  exception when others then v_ok := (sqlerrm = 'not_authorized');
    if not v_ok then v_msg := 'erreur inattendue : ' || sqlerrm; end if;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('A07 ' || coalesce(v_msg, '')); end if;

  -- A08 — CLOTURE PAR UN TIERS : refusee (D-52 reste au seul auteur).
  v_msg := null;
  begin
    perform public.close_network_call(c_members, 'resolved');
    v_ok := false; v_msg := 'un tiers a pu cloturer un appel';
  exception when others then v_ok := (sqlerrm = 'not_authorized');
    if not v_ok then v_msg := 'erreur inattendue : ' || sqlerrm; end if;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('A08 ' || coalesce(v_msg, '')); end if;

  -- A09 — un tiers ne recalcule pas l'audience d'un appel.
  v_msg := null;
  begin
    perform public.compute_network_call_matches(c_members);
    v_ok := false; v_msg := 'un tiers a pu recalculer l''audience';
  exception when others then v_ok := (sqlerrm = 'not_authorized');
    if not v_ok then v_msg := 'erreur inattendue : ' || sqlerrm; end if;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('A09 ' || coalesce(v_msg, '')); end if;

  -- A10 — ni ne lit la liste des profils cibles.
  v_msg := null;
  begin
    perform public.list_network_call_matches(c_members);
    v_ok := false; v_msg := 'un tiers a pu lire les profils cibles';
  exception when others then v_ok := (sqlerrm = 'not_authorized');
    if not v_ok then v_msg := 'erreur inattendue : ' || sqlerrm; end if;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('A10 ' || coalesce(v_msg, '')); end if;

  -- A11 — ni la liste des repondants proposables a la cloture.
  v_msg := null;
  begin
    perform public.list_network_call_respondents(c_members);
    v_ok := false; v_msg := 'un tiers a pu lire la liste des repondants';
  exception when others then v_ok := true; end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('A11 ' || coalesce(v_msg, '')); end if;

  -- A12 — ni le brouillon d'un tiers.
  v_msg := null;
  begin
    perform public.save_network_call_draft(c_draft, '{"title":"Detournement"}'::jsonb);
    v_ok := false; v_msg := 'un tiers a pu ecrire le brouillon d''un autre';
  exception when others then v_ok := (sqlerrm in ('not_authorized', 'network_call_not_found'));
    if not v_ok then v_msg := 'erreur inattendue : ' || sqlerrm; end if;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('A12 ' || coalesce(v_msg, '')); end if;

  -- A13 — une seule reponse par appel et par membre.
  v_msg := null;
  begin
    perform public.respond_to_network_call(c_members, 'direct', 'Seconde reponse.');
    v_ok := false; v_msg := 'seconde reponse acceptee';
  exception when others then v_ok := (sqlerrm = 'already_responded');
    if not v_ok then v_msg := 'erreur inattendue : ' || sqlerrm; end if;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('A13 ' || coalesce(v_msg, '')); end if;

  -- A14 — le SCORE ne quitte jamais la base (MASTER PROMPT §15).
  --        Ni la carte, ni la pertinence renvoyees a Ben ne le portent.
  v_json := public.get_network_call(c_members);
  v_cases := v_cases + 1;
  if v_json ? 'score' or v_json ? 'component_scores'
     or (v_json->'relevance') ? 'score' then
    v_fail := v_fail || 'A14 un score de pertinence a ete renvoye au client';
  end if;

  -- A15 — mais le LIBELLE qualitatif, lui, est bien present (positif, D-42).
  v_cases := v_cases + 1;
  if coalesce(v_json->'relevance'->>'label', '') <> 'very_relevant' then
    v_fail := v_fail || 'A15 le libelle qualitatif de pertinence est absent';
  end if;

  -- ===================================================================
  -- Ada — auteure. Les chemins legitimes fonctionnent.
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_ada::text, 'role', 'authenticated')::text, true);

  -- A16 — l'auteure voit les DEUX reponses (positif).
  v_json := public.list_network_call_responses(c_members);
  v_cases := v_cases + 1;
  if jsonb_array_length(v_json->'rows') <> 2 then
    v_fail := v_fail || format('A16 l''auteure voit %s reponses au lieu de 2',
                               jsonb_array_length(v_json->'rows'));
  end if;

  -- A17 — l'auteure ne repond pas a son propre appel.
  v_msg := null;
  begin
    perform public.respond_to_network_call(c_members, 'direct', 'Auto-reponse.');
    v_ok := false; v_msg := 'l''auteur a pu repondre a son propre appel';
  exception when others then v_ok := (sqlerrm = 'cannot_target_self');
    if not v_ok then v_msg := 'erreur inattendue : ' || sqlerrm; end if;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('A17 ' || coalesce(v_msg, '')); end if;

  -- A18 — un appel PUBLIE ne se reecrit pas par save_network_call_draft.
  v_msg := null;
  begin
    perform public.save_network_call_draft(c_members, '{"title":"Titre modifie apres publication"}'::jsonb);
    v_ok := false; v_msg := 'un appel publie a ete reecrit par le chemin brouillon';
  exception when others then v_ok := (sqlerrm = 'invalid_transition');
    if not v_ok then v_msg := 'erreur inattendue : ' || sqlerrm; end if;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('A18 ' || coalesce(v_msg, '')); end if;

  -- A19 — CLOTURE TERNAIRE non resolue : statut `closed`, AUCUN resultat
  --        positif enregistre (D-52, test 10 de D26 §143).
  perform public.close_network_call(c_members, 'not_resolved', 'expert_found', 'no_response');
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  select count(*) into v_n
    from public.network_calls
   where id = c_members
     and status = 'closed'
     and resolution = 'not_resolved'
     and closure_result_type is null;
  v_cases := v_cases + 1;
  if v_n <> 1 then
    v_fail := v_fail || 'A19 une cloture non resolue a produit un resultat positif';
  end if;

  -- A20 — le controle de base de securite reste vert.
  select count(*) into v_n from private.security_baseline_violations();
  v_cases := v_cases + 1;
  if v_n <> 0 then
    v_fail := v_fail || format('A20 security_baseline_violations() renvoie %s ligne(s)', v_n);
  end if;

  if array_length(v_fail, 1) is null then
    raise exception 'CALLS_API_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'CALLS_API_TESTS_FAILED: % cas, % echec(s)\n  - %',
      v_cases, array_length(v_fail, 1), array_to_string(v_fail, E'\n  - ');
  end if;
end
$capi$;
