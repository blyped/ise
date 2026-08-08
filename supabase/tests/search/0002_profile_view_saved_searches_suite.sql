-- =====================================================================
-- supabase/tests/search/0002_profile_view_saved_searches_suite.sql
--
-- Suite de tests NEGATIFS de la migration 0035 :
--   · public.get_member_profile(uuid)        -- ISE-037
--   · public.save_search_with_alert(...)     -- ISE-036
--   · public.set_search_alert_status(...)    -- ISE-036
--   · public.delete_saved_search(uuid)       -- ISE-036
--   · public.list_saved_searches()           -- ISE-036
--
-- Auto-nettoyante, sur le modele de tests/rls/0001_rls_negative_suite.sql
-- et de tests/search/0001_search_matching_suite.sql.
--
-- FONCTIONNEMENT
--   Un unique bloc DO. Il cree ses fixtures sous `postgres` (BYPASSRLS),
--   execute les assertions en changeant d'identite, collecte les echecs,
--   puis leve TOUJOURS une exception finale : la transaction est annulee
--   et AUCUNE donnee de test ne subsiste. L'exception est le mecanisme
--   de rollback, pas un signal d'erreur.
--
--     succes  ->  ERROR:  P0001: PROFILE_VIEW_TESTS_OK: 27 cas, 0 echec
--     echec   ->  ERROR:  P0001: PROFILE_VIEW_TESTS_FAILED: 27 cas, K echec(s)
--
-- CE QUE LA SUITE VERIFIE VRAIMENT
--   L'affirmation centrale d'ISE-037 est : « une donnee non autorisee
--   n'est pas recuperee, pas simplement masquee ». Elle ne se teste pas
--   en regardant l'ecran : elle se teste en constatant que la CLE est
--   ABSENTE de la charge utile jsonb. C'est ce que font V03, V04, V06 et
--   V07, avec `? 'cle'` (operateur d'existence de cle jsonb) et non une
--   comparaison a NULL.
--
-- COUVERTURE (27 cas)
--   V01  compte sans profil : get_member_profile refuse (42501)
--   V02  membre actif : profil d'un tiers lisible
--   V03  champ en `private` : cle ABSENTE de la charge utile
--   V04a champ en `connections` vu par une relation : present
--   V04b le meme champ vu par un non-contact : cle ABSENTE
--   V05  bio en `promotion` : visible pour la meme promotion
--   V06a experience `members` : presente
--   V06b experience `private` : absente de la liste
--   V07  aucune cle de coordonnees ni de score dans la charge utile
--   V08  profil bloquant : NULL (indistinguable d'un profil inexistant)
--   V09  profil suspendu : NULL
--   V10  identifiant inexistant : NULL
--   V11  contexte relationnel : relation directe, promotion, organisation
--   V12  relations communes : compte exact, sans les deux interesses
--   V13  disponibilite expiree exclue, disponibilite active incluse
--   V14  save_search_with_alert : recherche ET alerte reellement en base
--   V15  list_saved_searches : uniquement les miennes
--   V16  set_search_alert_status : suspension par le proprietaire
--   V17  set_search_alert_status sur la recherche d'un tiers : not_found
--   V18  delete_saved_search sur la recherche d'un tiers : not_found
--   V18b la recherche du tiers a survecu a la tentative
--   V19  frequence hors contrainte CHECK : validation_failed
--   V20  canal hors contrainte CHECK : validation_failed
--   V21  nom vide : validation_failed
--   V22  delete_saved_search : l'alerte part en cascade
--   V23  compte sans profil : save_search_with_alert refuse (42501)
--   V24  private.security_baseline_violations() : 0 ligne
--
-- REJOUER : voir docs/rls.md, section « Rejouer la suite de tests ».
-- =====================================================================

do $suite$
declare
  -- ---- Identifiants de fixture (fixes, hors plage de production) ----
  u_alice uuid := '00000000-0000-4000-8200-000000000001';
  u_bob   uuid := '00000000-0000-4000-8200-000000000002';
  u_carol uuid := '00000000-0000-4000-8200-000000000003';
  u_orph  uuid := '00000000-0000-4000-8200-000000000009';  -- compte sans profil

  p_alice uuid := '00000000-0000-4000-8200-0000000000a0';
  p_bob   uuid := '00000000-0000-4000-8200-0000000000b0';
  p_carol uuid := '00000000-0000-4000-8200-0000000000c0';
  p_dave  uuid := '00000000-0000-4000-8200-0000000000d0';  -- relation commune
  p_blk   uuid := '00000000-0000-4000-8200-0000000000e0';  -- bloque Alice
  p_sus   uuid := '00000000-0000-4000-8200-0000000000f0';  -- suspendu

  v_prom  bigint;
  v_prom2 bigint;
  v_org   uuid;

  -- ---- Etat du harnais ---------------------------------------------
  v_cases integer := 0;
  v_fail  text[]  := array[]::text[];
  v_p     jsonb;
  v_rel   jsonb;
  v_n     bigint;
  v_ok    boolean;
  v_msg   text;
  v_ss    uuid;
  v_ss_b  uuid;
begin
  -- ===================================================================
  -- FIXTURES (role postgres, BYPASSRLS)
  -- ===================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  insert into public.promotions (program_code, graduation_year, name)
  values ('ZPROF', 2090, 'Promotion de test Profil A') returning id into v_prom;
  insert into public.promotions (program_code, graduation_year, name)
  values ('ZPROF', 2091, 'Promotion de test Profil B') returning id into v_prom2;

  insert into public.organizations (canonical_name, slug)
  values ('Organisation de test Profil', 'ztest-organisation-profil') returning id into v_org;

  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', u_alice, 'authenticated', 'authenticated',
     'test+profil-alice@ise.test', now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_bob,   'authenticated', 'authenticated',
     'test+profil-bob@ise.test', now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_carol, 'authenticated', 'authenticated',
     'test+profil-carol@ise.test', now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_orph,  'authenticated', 'authenticated',
     'test+profil-orphelin@ise.test', now(), now());

  insert into public.ise_profiles
    (id, user_id, first_name, last_name, headline, bio, promotion_id,
     current_organization_id, current_country_code, current_city, current_position,
     linkedin_url, profile_status, claim_status, claimed_at, is_test_account)
  values
    (p_alice, u_alice, 'Alice', 'Profilia', 'Chercheuse', 'Bio Alice', v_prom,
     v_org, 'CI', 'Abidjan', 'Analyste', null, 'active', 'claimed', now(), true),
    (p_bob,   u_bob,   'Bob',   'Visibilia', 'Economiste', 'Bio confidentielle de Bob', v_prom,
     v_org, 'SN', 'Dakar', 'Economiste principal',
     'https://exemple.test/in/bob', 'active', 'claimed', now(), true),
    (p_carol, u_carol, 'Carole','Tierce',   'Statisticienne', 'Bio Carole', v_prom2,
     null, 'BF', 'Ouagadougou', 'Statisticienne', null, 'active', 'claimed', now(), true),
    (p_dave,  null,    'David', 'Commun',   'Consultant', null, v_prom,
     null, 'CI', null, null, null, 'active', 'unclaimed', null, true),
    (p_blk,   null,    'Bruno', 'Bloqueur', 'Consultant', null, null,
     null, null, null, null, null, 'active', 'unclaimed', null, true),
    (p_sus,   null,    'Sonia', 'Suspendue','Consultante', null, null,
     null, null, null, null, null, 'suspended', 'unclaimed', null, true);

  -- Reglages de visibilite de Bob. C'est le coeur de la suite :
  --   ville      -> `private`      : personne, pas meme une relation ;
  --   LinkedIn   -> `connections`  : ses relations seulement ;
  --   bio        -> `promotion`    : sa promotion seulement.
  insert into public.profile_visibility (profile_id, field_key, visibility) values
    (p_bob, 'city',         'private'),
    (p_bob, 'linkedin_url', 'connections'),
    (p_bob, 'bio',          'promotion');

  -- Alice <-> Bob et Alice <-> David et Bob <-> David :
  -- David est donc l'UNIQUE relation commune d'Alice et Bob.
  insert into public.connections (profile_a_id, profile_b_id) values
    (least(p_alice, p_bob),  greatest(p_alice, p_bob)),
    (least(p_alice, p_dave), greatest(p_alice, p_dave)),
    (least(p_bob,   p_dave), greatest(p_bob,   p_dave));

  insert into public.experiences
    (profile_id, organization_name_raw, position_title, country_code,
     start_date, end_date, visibility)
  values
    (p_bob, 'Employeur visible', 'Economiste', 'SN', current_date - 2000, null, 'members'),
    (p_bob, 'Employeur secret',  'Consultant', 'SN', current_date - 4000,
     current_date - 3000, 'private');

  insert into public.profile_availabilities
    (profile_id, availability_type, active, visibility, available_until)
  values
    (p_bob, 'mentorship', true, 'members', null),
    (p_bob, 'mission',    true, 'members', current_date - 1);  -- expiree

  insert into public.profile_blocks (blocker_profile_id, blocked_profile_id)
  values (p_blk, p_alice);

  -- ===================================================================
  -- V01 — un compte sans profil n'est pas un membre actif.
  -- ===================================================================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_orph::text, 'role', 'authenticated')::text, true);

  v_ok := false; v_msg := null;
  begin
    perform public.get_member_profile(p_bob);
    v_msg := 'appel accepte';
  exception when others then v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then
    v_fail := v_fail || ('V01 get_member_profile ouverte a un compte sans profil : ' || coalesce(v_msg, ''));
  end if;

  -- ===================================================================
  -- ISE-037 — Alice consulte le profil de Bob
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_alice::text, 'role', 'authenticated')::text, true);

  v_p := public.get_member_profile(p_bob);

  v_cases := v_cases + 1;
  if v_p is null or (v_p ->> 'profile_id') <> p_bob::text then
    v_fail := v_fail || 'V02 profil d''un tiers illisible par un membre actif';
  end if;

  -- V03 — `city` en `private` : la CLE doit etre absente, pas vide.
  v_cases := v_cases + 1;
  if v_p ? 'current_city' then
    v_fail := v_fail || format('V03 champ prive present dans la charge utile (%s)', v_p ->> 'current_city');
  end if;

  -- V04a — `linkedin_url` en `connections`, Alice EST en relation.
  v_cases := v_cases + 1;
  if not (v_p ? 'linkedin_url') then
    v_fail := v_fail || 'V04a champ `connections` absent pour une relation directe';
  end if;

  -- V05 — `bio` en `promotion`, Alice partage la promotion de Bob.
  v_cases := v_cases + 1;
  if not (v_p ? 'bio') then
    v_fail := v_fail || 'V05 champ `promotion` absent pour un membre de la meme promotion';
  end if;

  -- V06a / V06b — visibilite ligne a ligne des experiences.
  v_cases := v_cases + 1;
  if jsonb_array_length(coalesce(v_p -> 'experiences', '[]'::jsonb)) <> 1 then
    v_fail := v_fail || format('V06a une seule experience `members` attendue, obtenu %s',
      jsonb_array_length(coalesce(v_p -> 'experiences', '[]'::jsonb)));
  end if;

  v_cases := v_cases + 1;
  if v_p::text like '%Employeur secret%' then
    v_fail := v_fail || 'V06b experience `private` presente dans la charge utile';
  end if;

  -- V07 — aucune coordonnee, aucun score, dans la charge utile.
  v_cases := v_cases + 1;
  if v_p ?| array['email', 'phone', 'address', 'birth_date', 'cv',
                  'profile_completion', 'completion_score', 'score'] then
    v_fail := v_fail || 'V07 donnee interdite presente dans la charge utile d''ISE-037';
  end if;

  -- V11 — contexte relationnel etabli sur des donnees reelles.
  v_rel := v_p -> 'relationship';
  v_cases := v_cases + 1;
  if coalesce((v_rel ->> 'is_connected')::boolean, false) is not true
     or coalesce((v_rel ->> 'shares_promotion')::boolean, false) is not true
     or coalesce((v_rel ->> 'shares_organization')::boolean, false) is not true then
    v_fail := v_fail || format('V11 contexte relationnel incomplet (%s)', v_rel::text);
  end if;

  -- V12 — relations communes : David, et lui seul.
  v_cases := v_cases + 1;
  if coalesce((v_rel ->> 'mutual_connection_count')::int, -1) <> 1 then
    v_fail := v_fail || format('V12 relations communes attendues 1, obtenu %s',
      coalesce(v_rel ->> 'mutual_connection_count', 'null'));
  end if;

  -- V13 — disponibilite expiree exclue (D22 §46), active incluse.
  v_cases := v_cases + 1;
  if jsonb_array_length(coalesce(v_p -> 'availabilities', '[]'::jsonb)) <> 1
     or v_p::text like '%"mission"%' then
    v_fail := v_fail || format('V13 disponibilites : 1 active attendue, obtenu %s',
      coalesce(v_p -> 'availabilities', '[]'::jsonb)::text);
  end if;

  -- V08 — profil bloquant : NULL, comme un profil inexistant.
  v_cases := v_cases + 1;
  if public.get_member_profile(p_blk) is not null then
    v_fail := v_fail || 'V08 profil bloquant accessible';
  end if;

  -- V09 — profil suspendu : NULL.
  v_cases := v_cases + 1;
  if public.get_member_profile(p_sus) is not null then
    v_fail := v_fail || 'V09 profil suspendu accessible';
  end if;

  -- V10 — identifiant inexistant : NULL, sans erreur technique.
  v_cases := v_cases + 1;
  if public.get_member_profile('00000000-0000-4000-8200-0000000000ff'::uuid) is not null then
    v_fail := v_fail || 'V10 identifiant inconnu renvoie autre chose que NULL';
  end if;

  -- ===================================================================
  -- V04b — Carole, ni relation ni meme promotion, consulte Bob
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_carol::text, 'role', 'authenticated')::text, true);

  v_p := public.get_member_profile(p_bob);
  v_cases := v_cases + 1;
  if v_p is null then
    v_fail := v_fail || 'V04b profil inaccessible a un membre actif non contact';
  elsif v_p ? 'linkedin_url' or v_p ? 'bio' or v_p ? 'current_city' then
    v_fail := v_fail || format('V04b champ restreint transmis a un non-contact (%s)',
      coalesce(v_p -> 'visible_fields', 'null'::jsonb)::text);
  end if;

  -- ===================================================================
  -- ISE-036 — recherches enregistrees et alertes
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_alice::text, 'role', 'authenticated')::text, true);

  v_ss := public.save_search_with_alert(
    'Recherche de test Alice',
    '{"skillIds": [], "sectorIds": [], "countryCodes": ["SN"]}'::jsonb,
    true, 'daily', 'both', null);

  -- V14 — la recherche ET l'alerte sont reellement en base.
  select count(*) into v_n
  from public.saved_searches s
  join public.search_alerts a on a.saved_search_id = s.id
  where s.id = v_ss and a.frequency = 'daily' and a.channel = 'both' and a.status = 'active';
  v_cases := v_cases + 1;
  if v_n <> 1 then
    v_fail := v_fail || format('V14 recherche + alerte non persistees (%s)', v_n);
  end if;

  -- V16 — suspension par le proprietaire.
  perform public.set_search_alert_status(v_ss, 'paused');
  select count(*) into v_n
  from public.search_alerts a where a.saved_search_id = v_ss and a.status = 'paused';
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('V16 suspension d''alerte sans effet (%s)', v_n); end if;

  -- V19 / V20 / V21 — valeurs refusees par les contraintes CHECK de la base.
  v_ok := false;
  begin
    perform public.save_search_with_alert('Frequence invalide', '{}'::jsonb, true, 'hourly', 'in_app', null);
  exception when others then v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || 'V19 frequence hors CHECK acceptee'; end if;

  v_ok := false;
  begin
    perform public.save_search_with_alert('Canal invalide', '{}'::jsonb, true, 'weekly', 'push', null);
  exception when others then v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || 'V20 canal hors CHECK accepte'; end if;

  v_ok := false;
  begin
    perform public.save_search_with_alert('   ', '{}'::jsonb, false, 'weekly', 'in_app', null);
  exception when others then v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || 'V21 nom vide accepte'; end if;

  -- ===================================================================
  -- Bob : cloisonnement entre membres
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_bob::text, 'role', 'authenticated')::text, true);

  v_ss_b := public.save_search_with_alert(
    'Recherche de test Bob', '{"countryCodes": ["CI"]}'::jsonb, false, 'weekly', 'in_app', null);

  -- V15 — Bob ne voit que la sienne.
  select count(*) into v_n from public.list_saved_searches();
  v_cases := v_cases + 1;
  if v_n <> 1 then
    v_fail := v_fail || format('V15 list_saved_searches renvoie %s ligne(s) au lieu de 1', v_n);
  end if;

  -- V17 — Bob ne peut pas toucher a l'alerte d'Alice.
  v_ok := false;
  begin
    perform public.set_search_alert_status(v_ss, 'active');
  exception when others then v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || 'V17 alerte d''un tiers modifiable'; end if;

  -- V18 — ni la supprimer.
  v_ok := false;
  begin
    perform public.delete_saved_search(v_ss);
  exception when others then v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || 'V18 recherche d''un tiers supprimable'; end if;

  -- V18b — la recherche d'Alice est toujours la, intacte.
  -- Le comptage se fait sous `postgres` : sous l'identite de Bob, la
  -- politique `saved_searches_own` renverrait 0 quoi qu'il arrive, ce qui
  -- ne prouverait rien sur la survie de la ligne. La premiere ecriture de
  -- ce cas comptait sous Bob et « echouait » pour cette raison — le
  -- defaut etait dans l'assertion, pas dans le produit.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  select count(*) into v_n from public.saved_searches s where s.id = v_ss;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('V18b recherche d''Alice detruite (%s)', v_n); end if;
  perform set_config('role', 'authenticated', true);

  -- ===================================================================
  -- V22 — suppression par le proprietaire : l'alerte part en cascade
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_alice::text, 'role', 'authenticated')::text, true);

  perform public.delete_saved_search(v_ss);
  select count(*) into v_n from public.search_alerts a where a.saved_search_id = v_ss;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('V22 alerte orpheline apres suppression (%s)', v_n); end if;

  -- ===================================================================
  -- V23 — un compte sans profil ne peut rien enregistrer
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_orph::text, 'role', 'authenticated')::text, true);

  v_ok := false;
  begin
    perform public.save_search_with_alert('Sans profil', '{}'::jsonb, false, 'weekly', 'in_app', null);
  exception when others then v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || 'V23 enregistrement accepte pour un compte sans profil'; end if;

  -- Menage de la recherche de Bob (le rollback s'en chargerait ; explicite
  -- pour que la suite reste lisible si elle est un jour jouee autrement).
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  delete from public.saved_searches s where s.id = v_ss_b;

  -- ===================================================================
  -- V24 — non-regression de la ligne de base de securite
  -- ===================================================================
  select count(*) into v_n from private.security_baseline_violations();
  v_cases := v_cases + 1;
  if v_n <> 0 then
    v_fail := v_fail || format('V24 security_baseline_violations() renvoie %s ligne(s)', v_n);
  end if;

  -- ===================================================================
  -- RAPPORT + ROLLBACK
  -- L'exception est volontaire : elle annule toute la transaction et
  -- garantit qu'aucune fixture ne subsiste en base.
  -- ===================================================================
  if array_length(v_fail, 1) is null then
    raise exception 'PROFILE_VIEW_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'PROFILE_VIEW_TESTS_FAILED: % cas, % echec(s)\n  - %',
      v_cases, array_length(v_fail, 1), array_to_string(v_fail, E'\n  - ');
  end if;
end
$suite$;
