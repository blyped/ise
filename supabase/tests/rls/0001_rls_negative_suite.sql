-- =====================================================================
-- supabase/tests/rls/0001_rls_negative_suite.sql
--
-- Suite de tests RLS NEGATIFS, auto-nettoyante.
-- MASTER PROMPT §80 : « une politique RLS non testee n'est pas terminee ».
--
-- FONCTIONNEMENT
--   Un unique bloc DO. Il cree ses fixtures, execute les assertions en
--   collectant les echecs, puis leve TOUJOURS une exception finale :
--   la transaction est annulee et AUCUNE donnee de test ne subsiste.
--   L'exception est le mecanisme de rollback, pas un signal d'erreur.
--
--     succes  ->  ERROR:  P0001: RLS_TESTS_OK: 30 cas, 0 echec
--     echec   ->  ERROR:  P0001: RLS_TESTS_FAILED: 30 cas, K echec(s)
--                           - Cnn ...
--
-- IMPERSONATION
--   set_config('role', 'authenticated', true) + request.jwt.claims,
--   puis retour a `postgres` (BYPASSRLS) pour les operations de fixture.
--
-- FIXTURES (D-104 : is_test_account = true, e-mails prefixes `test+`)
--   Alice   membre actif, en relation avec Bob et Fatou
--   Bob     membre actif, en relation avec Alice et Fatou
--   Carole  membre actif, sans relation initiale avec Alice
--   David   profil reference non reclame, sans compte Auth (MASTER PROMPT §6)
--   Eric    membre actif, superadmin
--   Fatou   membre actif, intermediaire relie a Alice et a Bob
--
-- REJOUER : voir docs/rls.md, section « Rejouer la suite de tests ».
-- =====================================================================

do $rls$
declare
  -- ---- Identifiants de fixture (fixes, hors plage de production) ----
  u_alice  uuid := '00000000-0000-4000-8000-000000000001';
  u_bob    uuid := '00000000-0000-4000-8000-000000000002';
  u_carole uuid := '00000000-0000-4000-8000-000000000003';
  u_eric   uuid := '00000000-0000-4000-8000-000000000005';
  u_fatou  uuid := '00000000-0000-4000-8000-000000000006';
  p_alice  uuid := '00000000-0000-4000-8000-0000000000a1';
  p_bob    uuid := '00000000-0000-4000-8000-0000000000a2';
  p_carole uuid := '00000000-0000-4000-8000-0000000000a3';
  p_david  uuid := '00000000-0000-4000-8000-0000000000a4';
  p_eric   uuid := '00000000-0000-4000-8000-0000000000a5';
  p_fatou  uuid := '00000000-0000-4000-8000-0000000000a6';
  x_exp_bob_priv    uuid := '00000000-0000-4000-8000-0000000000b1';
  x_exp_bob_conn    uuid := '00000000-0000-4000-8000-0000000000b2';
  x_exp_car_conn    uuid := '00000000-0000-4000-8000-0000000000b3';
  x_conv            uuid := '00000000-0000-4000-8000-0000000000c1';
  x_req_bob_car     uuid := '00000000-0000-4000-8000-0000000000d1';
  x_req_car_alice   uuid := '00000000-0000-4000-8000-0000000000d2';
  x_intro_req       uuid := '00000000-0000-4000-8000-0000000000e1';
  x_intro_withdrawn uuid := '00000000-0000-4000-8000-0000000000e2';
  -- ---- Etat du harnais ----
  v_cases integer := 0;
  v_fail  text[]  := array[]::text[];
  v_n     bigint;
  v_ok    boolean;
  v_msg   text;
  v_score smallint;
  -- Depuis 0032, `profile_completion` est recalcule par trigger : la valeur
  -- inseree en fixture ne survit pas. On releve donc la valeur effective.
  v_score_expected smallint;
  v_role  smallint;
begin
  -- ===================================================================
  -- FIXTURES (role postgres, BYPASSRLS)
  -- ===================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', u_alice,  'authenticated', 'authenticated', 'test+alice@ise.test',  now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_bob,    'authenticated', 'authenticated', 'test+bob@ise.test',    now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_carole, 'authenticated', 'authenticated', 'test+carole@ise.test', now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_eric,   'authenticated', 'authenticated', 'test+eric@ise.test',   now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_fatou,  'authenticated', 'authenticated', 'test+fatou@ise.test',  now(), now());

  insert into public.ise_profiles
    (id, user_id, first_name, last_name, profile_status, claim_status, claimed_at,
     profile_completion, is_test_account)
  values
    (p_alice,  u_alice,  'Alice',  'Test', 'active',     'claimed',   now(), 81, true),
    (p_bob,    u_bob,    'Bob',    'Test', 'active',     'claimed',   now(), 42, true),
    (p_carole, u_carole, 'Carole', 'Test', 'active',     'claimed',   now(), 55, true),
    (p_david,  null,     'David',  'Test', 'referenced', 'unclaimed', null,   7, true),
    (p_eric,   u_eric,   'Eric',   'Test', 'active',     'claimed',   now(), 90, true),
    (p_fatou,  u_fatou,  'Fatou',  'Test', 'active',     'claimed',   now(), 66, true);

  -- Eric est superadmin (D-31 : l'autorisation se resout par has_permission).
  select id into v_role from private.roles where code = 'superadmin';
  insert into private.user_roles (profile_id, role_id) values (p_eric, v_role);

  -- Relations : Alice-Bob, Alice-Fatou, Bob-Fatou (paires ordonnees).
  insert into public.connections (profile_a_id, profile_b_id) values
    (least(p_alice, p_bob),   greatest(p_alice, p_bob)),
    (least(p_alice, p_fatou), greatest(p_alice, p_fatou)),
    (least(p_bob,   p_fatou), greatest(p_bob,   p_fatou));

  -- Experiences a visibilites contrastees.
  insert into public.experiences
    (id, profile_id, organization_name_raw, position_title, start_date, visibility)
  values
    (x_exp_bob_priv, p_bob,    'Org secrete', 'Mission confidentielle', date '2020-01-01', 'private'),
    (x_exp_bob_conn, p_bob,    'Org reseau',  'Mission reseau',         date '2021-01-01', 'connections'),
    (x_exp_car_conn, p_carole, 'Org Carole',  'Mission Carole',         date '2021-01-01', 'connections');

  -- Donnee strictement personnelle de Bob.
  insert into public.saved_searches (profile_id, name, criteria)
  values (p_bob, 'Recherche privee de Bob', '{"skills":["stat"]}'::jsonb);

  -- Conversation Bob <-> Carole : Alice n'y participe pas.
  insert into public.conversations (id, conversation_type, created_by_profile_id)
  values (x_conv, 'direct', p_bob);
  insert into public.conversation_participants (conversation_id, profile_id)
  values (x_conv, p_bob), (x_conv, p_carole);

  -- Demandes de connexion en attente.
  insert into public.connection_requests (id, requester_profile_id, addressee_profile_id, status)
  values
    (x_req_bob_car,   p_bob,    p_carole, 'pending'),
    (x_req_car_alice, p_carole, p_alice,  'pending');

  -- Introductions : une en `requested`, une en `withdrawn`.
  insert into public.introduction_requests
    (id, requester_profile_id, intermediary_profile_id, target_profile_id,
     purpose, message_to_intermediary, status)
  values
    (x_intro_req,       p_alice, p_fatou, p_carole, 'advice',
     'Bonjour Fatou, peux-tu me presenter Carole pour un echange methodologique ?', 'requested'),
    (x_intro_withdrawn, p_alice, p_fatou, p_bob,    'advice',
     'Bonjour Fatou, demande retiree servant de fixture de test de transition.',    'withdrawn');

  -- Une ligne d'audit a lire par Eric.
  insert into private.audit_log (actor_kind, actor_profile_id, action, object_type, object_id, result)
  values ('user', p_alice, 'test.fixture', 'ise_profile', p_alice::text, 'success');

  -- Score de completion effectif d'Alice apres passage des triggers de 0032.
  select p.profile_completion into v_score_expected
  from public.ise_profiles p where p.id = p_alice;

  -- ===================================================================
  -- CAS 01 — Non authentifie (role anon) : aucune ligne de ise_profiles.
  -- ===================================================================
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '', true);
  v_msg := null;
  begin
    select count(*) into v_n from public.ise_profiles;
    v_ok := (v_n = 0);
    v_msg := format('anon a lu %s ligne(s) de ise_profiles', v_n);
  exception when others then
    v_ok := true;  -- refus au niveau privilege : encore plus strict que 0 ligne
  end;
  perform set_config('role', 'postgres', true);
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('C01 anon/ise_profiles : ' || coalesce(v_msg, '')); end if;

  -- ===================================================================
  -- A partir d'ici : Alice authentifiee.
  -- ===================================================================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_alice::text, 'role', 'authenticated')::text, true);

  -- CAS 02 — private.profile_contacts de Bob : schema non expose.
  v_msg := null;
  begin
    select count(*) into v_n from private.profile_contacts where profile_id = p_bob;
    v_ok := (v_n = 0);
    v_msg := format('%s ligne(s) lues dans private.profile_contacts', v_n);
  exception when others then
    v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('C02 private.profile_contacts : ' || coalesce(v_msg, '')); end if;

  -- CAS 03 — Alice met a jour le profil de Bob.
  update public.ise_profiles set headline = 'detourne par Alice' where id = p_bob;
  get diagnostics v_n = row_count;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('C03 update profil tiers : %s ligne(s) affectee(s)', v_n); end if;

  -- CAS 04 — Experience de Bob en visibilite `private`.
  select count(*) into v_n from public.experiences where id = x_exp_bob_priv;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('C04 experience private de Bob visible (%s)', v_n); end if;

  -- CAS 05 — Experience de Carole en `connections`, sans relation.
  select count(*) into v_n from public.experiences where id = x_exp_car_conn;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('C05 experience connections d''un non-contact visible (%s)', v_n); end if;

  -- CAS 06 — Experience de Bob en `connections`, relation existante (positif).
  select count(*) into v_n from public.experiences where id = x_exp_bob_conn;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('C06 experience connections d''une relation invisible (%s)', v_n); end if;

  -- CAS 07a — profile_completion d'un tiers (D-72). La RLS est un controle de
  -- LIGNE : la protection du score repose sur un privilege de COLONNE (0028).
  v_msg := null;
  begin
    select profile_completion into v_score from public.ise_profiles where id = p_bob;
    v_ok := false;
    v_msg := format('score de Bob lisible par Alice (= %s)', v_score);
  exception when insufficient_privilege then
    v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('C07a profile_completion expose a un tiers : ' || coalesce(v_msg, '')); end if;

  -- CAS 07b — le proprietaire garde acces a son score par la voie dediee.
  v_msg := null;
  begin
    select public.my_profile_completion() into v_score;
    v_ok := (v_score is not null and v_score = v_score_expected);
    v_msg := format('score propre inattendu : %s (attendu %s)', v_score, v_score_expected);
  exception when others then
    v_ok := false;
    v_msg := 'public.my_profile_completion() indisponible : ' || sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('C07b score propre : ' || coalesce(v_msg, '')); end if;

  -- CAS 08 — private.audit_log.
  v_msg := null;
  begin
    select count(*) into v_n from private.audit_log;
    v_ok := false;
    v_msg := format('%s ligne(s) lues', v_n);
  exception when others then
    v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('C08 private.audit_log lisible par un membre : ' || coalesce(v_msg, '')); end if;

  -- CAS 09 — private.user_roles (D-32 : aucune donnee d'autorisation exposee).
  v_msg := null;
  begin
    select count(*) into v_n from private.user_roles;
    v_ok := false;
    v_msg := format('%s ligne(s) lues', v_n);
  exception when others then
    v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('C09 private.user_roles lisible par un membre : ' || coalesce(v_msg, '')); end if;

  -- CAS 10 — saved_searches de Bob.
  select count(*) into v_n from public.saved_searches where profile_id = p_bob;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('C10 saved_searches d''un tiers visibles (%s)', v_n); end if;

  -- CAS 11 — conversation dont Alice n'est pas participante.
  -- La table messagerie n'a encore AUCUNE politique : elle est totalement
  -- fermee a `authenticated`. Le test constate ce fait, il ne le presuppose pas.
  select count(*) into v_n from public.conversations where id = x_conv;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('C11 conversation tierce visible (%s)', v_n); end if;

  -- CAS 12 — Alice cree une demande en se faisant passer pour Bob.
  v_msg := null;
  begin
    insert into public.connection_requests (requester_profile_id, addressee_profile_id)
    values (p_bob, p_fatou);
    v_ok := false;
    v_msg := 'insertion acceptee';
  exception when others then
    v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('C12 usurpation de demandeur : ' || coalesce(v_msg, '')); end if;

  -- CAS 13 — Alice accepte une demande adressee a Carole.
  v_msg := null;
  begin
    perform public.accept_connection_request(x_req_bob_car);
    v_ok := false;
    v_msg := 'acceptation reussie';
  exception when others then
    v_ok := (sqlerrm = 'not_addressee');
    v_msg := 'erreur attendue not_addressee, obtenue : ' || sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('C13 accept par un tiers : ' || coalesce(v_msg, '')); end if;

  -- CAS 14 — double acceptation : une seule relation (MASTER PROMPT §100).
  v_msg := null;
  begin
    perform public.accept_connection_request(x_req_car_alice);
    v_ok := true;
  exception when others then
    v_ok := false;
    v_msg := 'premiere acceptation refusee : ' || sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('C14a ' || coalesce(v_msg, '')); end if;

  v_msg := null;
  begin
    perform public.accept_connection_request(x_req_car_alice);
    v_ok := false;
    v_msg := 'seconde acceptation acceptee';
  exception when others then
    v_ok := (sqlerrm = 'invalid_transition');
    v_msg := 'erreur attendue invalid_transition, obtenue : ' || sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('C14b ' || coalesce(v_msg, '')); end if;

  perform set_config('role', 'postgres', true);
  select count(*) into v_n from public.connections
   where profile_a_id = least(p_alice, p_carole) and profile_b_id = greatest(p_alice, p_carole);
  perform set_config('role', 'authenticated', true);
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('C14c %s ligne(s) dans connections au lieu de 1', v_n); end if;

  -- CAS 15 — introduction via un intermediaire non relie (D-51).
  v_msg := null;
  begin
    insert into public.introduction_requests
      (requester_profile_id, intermediary_profile_id, target_profile_id, purpose, message_to_intermediary)
    values (p_alice, p_david, p_bob, 'advice',
            'David n''est pas une relation d''Alice : cette insertion doit etre refusee.');
    v_ok := false;
    v_msg := 'insertion acceptee';
  exception when others then
    v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('C15 intermediaire non relie : ' || coalesce(v_msg, '')); end if;

  -- CAS 16 — transition `requested -> introduced` tentee par le demandeur.
  v_msg := null;
  begin
    perform public.transition_introduction(x_intro_req, 'introduced');
    v_ok := false;
    v_msg := 'transition acceptee';
  exception when others then
    v_ok := (sqlerrm = 'invalid_transition');
    v_msg := 'erreur attendue invalid_transition, obtenue : ' || sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('C16 ' || coalesce(v_msg, '')); end if;

  -- CAS 17 — depuis `withdrawn`, aucune transition n'est possible.
  v_msg := null;
  begin
    perform public.transition_introduction(x_intro_withdrawn, 'intermediary_accepted');
    v_ok := false;
    v_msg := 'transition acceptee vers intermediary_accepted';
  exception when others then
    v_ok := (sqlerrm = 'invalid_transition');
    v_msg := 'erreur attendue invalid_transition, obtenue : ' || sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('C17a ' || coalesce(v_msg, '')); end if;

  v_msg := null;
  begin
    perform public.transition_introduction(x_intro_withdrawn, 'no_outcome');
    v_ok := false;
    v_msg := 'transition acceptee vers no_outcome';
  exception when others then
    v_ok := (sqlerrm = 'invalid_transition');
    v_msg := 'erreur attendue invalid_transition, obtenue : ' || sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('C17b ' || coalesce(v_msg, '')); end if;

  -- CAS 18 — la cible ne voit pas la demande tant qu'elle est `requested`.
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_carole::text, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.introduction_requests where id = x_intro_req;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('C18 la cible voit la demande en statut requested (%s)', v_n); end if;

  -- CAS 19 — Bob bloque Alice.
  perform set_config('role', 'postgres', true);
  insert into public.profile_blocks (blocker_profile_id, blocked_profile_id) values (p_bob, p_alice);
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_alice::text, 'role', 'authenticated')::text, true);

  select count(*) into v_n from public.ise_profiles where id = p_bob;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('C19a profil du bloqueur encore visible (%s)', v_n); end if;

  v_msg := null;
  begin
    insert into public.connection_requests (requester_profile_id, addressee_profile_id)
    values (p_alice, p_bob);
    v_ok := false;
    v_msg := 'demande de connexion acceptee malgre le blocage';
  exception when others then
    v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('C19b ' || coalesce(v_msg, '')); end if;

  select count(*) into v_n from public.experiences where id = x_exp_bob_conn;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('C19c contenu du bloqueur encore visible (%s)', v_n); end if;

  -- CAS 20 — Eric (superadmin).
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_eric::text, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.ise_profiles where id = p_david;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('C20a superadmin ne voit pas le profil de David (%s)', v_n); end if;

  v_msg := null;
  begin
    select count(*) into v_n from private.read_audit_log(100, null);
    v_ok := (v_n >= 1);
    v_msg := format('journal d''audit lu mais vide (%s)', v_n);
  exception when others then
    v_ok := false;
    v_msg := 'lecture du journal d''audit impossible : ' || sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('C20b ' || coalesce(v_msg, '')); end if;

  -- CAS 20c — controle negatif symetrique : Alice reste refusee.
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_alice::text, 'role', 'authenticated')::text, true);
  v_msg := null;
  begin
    select count(*) into v_n from private.read_audit_log(100, null);
    v_ok := false;
    v_msg := format('Alice a lu %s ligne(s) du journal d''audit', v_n);
  exception when others then
    v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('C20c ' || coalesce(v_msg, '')); end if;

  -- CAS 21 — lignes de base de securite.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  select count(*) into v_n from private.security_baseline_violations();
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('C21a security_baseline_violations() renvoie %s ligne(s)', v_n); end if;

  select count(*) into v_n from private.storage_baseline_violations();
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('C21b storage_baseline_violations() renvoie %s ligne(s)', v_n); end if;

  -- ===================================================================
  -- RAPPORT + ROLLBACK
  -- L'exception est volontaire : elle annule toute la transaction et
  -- garantit qu'aucune fixture ne subsiste en base.
  -- ===================================================================
  if array_length(v_fail, 1) is null then
    raise exception 'RLS_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'RLS_TESTS_FAILED: % cas, % echec(s)\n  - %',
      v_cases, array_length(v_fail, 1), array_to_string(v_fail, E'\n  - ');
  end if;
end
$rls$;
