-- =====================================================================
-- supabase/tests/search/0001_search_matching_suite.sql
--
-- Suite de tests du MOTEUR DE RECHERCHE (0030), du MOTEUR DE MATCHING
-- (0031, 0033, 0034) et du SCORE DE COMPLETION (0032).
-- Auto-nettoyante, sur le modele de tests/rls/0001_rls_negative_suite.sql.
--
-- FONCTIONNEMENT
--   Un unique bloc DO. Il cree ses fixtures, execute les assertions en
--   collectant les echecs, puis leve TOUJOURS une exception finale :
--   la transaction est annulee et AUCUNE donnee de test ne subsiste.
--   L'exception est le mecanisme de rollback, pas un signal d'erreur.
--
--     succes  ->  ERROR:  P0001: SEARCH_TESTS_OK: 30 cas, 0 echec
--     echec   ->  ERROR:  P0001: SEARCH_TESTS_FAILED: 30 cas, K echec(s)
--
--   Le message porte dans les deux cas le TABLEAU DE PARITE
--   SQL <-> TypeScript des dix jeux de matching : attendu (calcule a la
--   main d'apres packages/domain/src/matching/engine.ts) contre obtenu.
--
-- PREREQUIS
--   Comme la suite RLS, ce harnais suppose une base SANS profils de
--   production : plusieurs assertions verifient qu'un profil precis est
--   present dans la PREMIERE page de resultats, ce qu'un annuaire deja
--   peuple pourrait invalider en le repoussant page suivante.
--
-- COUVERTURE (30 cas)
--   S01  tolerance aux accents            « Kouame » trouve « Kouamé »
--   S02  tolerance a une faute de frappe  « Kouasi » trouve « Kouassi »
--   S03  resolution d'alias de competence a la requete (D-46)
--   S04  regle D-46 sigles courts : minuscule refusee
--   S05  regle D-46 sigles courts : majuscule isolee acceptee
--   S06  exclusion d'un profil bloque
--   S07  exclusion d'un profil non actif (suspendu)
--   S08  un profil `referenced` reste trouvable (arbitrage documente)
--   S09  pagination par curseur : 3 pages x 2 = 6 lignes
--   S10  pagination par curseur : aucun doublon
--   S11  pagination par curseur : page 1 stable au rejeu
--   S12  aucune donnee privee dans la signature de search_profiles
--   S13  aucune donnee privee, ni score, dans celle de match_profiles
--   S14  un non-membre ne peut pas appeler search_profiles
--   P01..P10  parite du moteur de matching sur dix jeux de donnees
--   P11  un profil bloquant n'est jamais propose par le matching
--   C01  calculate_profile_completion() fermee a authenticated (D-72)
--   C02  my_profile_missing_items() alimente ISE-031
--   C03  le trigger de completion suit les modifications de profil
--   C03b l'increment vaut exactement le poids du bloc concerne (D-71)
--   Z01  private.security_baseline_violations() renvoie 0 ligne
--
-- LE TABLEAU DE PARITE, calcule a la main d'apres engine.ts :
--
--   #   candidat / criteres                          max    points   score   label          raisons
--   P01 M1, les 7 criteres au maximum                100    100      100,00  very_relevant  7
--   P02 M2, partiel + connexe + residence            100     48,5     48,50  relevant       4
--   P03 M3, memes criteres                           100     19,8     19,80  (exclu, <25)   -
--   P04 M3, competences seules                        40     19,8     49,50  relevant       1
--   P05 M4, dispo + experience                        20     14       70,00  (exclu, D-43)  0
--   P06 M4, dispo + experience + promotion            25     19       76,00  very_relevant  1
--   P07 M5, competence seule, niveau non declare      40     30       75,00  very_relevant  1
--   P08 M6, bonus principal plafonne a 1              40     28       70,00  very_relevant  1
--   P09 M7, 2 competences trouvees sur 5 demandees    40     16       40,00  close          1
--   P10 M8, sous-region + 1 langue sur 3 + promotion  25     14,67    58,68  relevant       3
--
-- REJOUER : voir docs/rls.md, section « Rejouer la suite de tests ».
-- =====================================================================

do $suite$
declare
  -- ---- Identifiants de fixture (fixes, hors plage de production) ----
  u_alice uuid := '00000000-0000-4000-8100-000000000001';
  p_alice uuid := '00000000-0000-4000-8100-0000000000a0';
  p_m1    uuid := '00000000-0000-4000-8100-0000000000b1';  -- profil parfait
  p_m2    uuid := '00000000-0000-4000-8100-0000000000b2';  -- partiel
  p_m3    uuid := '00000000-0000-4000-8100-0000000000b3';  -- sous le seuil
  p_m4    uuid := '00000000-0000-4000-8100-0000000000b4';  -- sans raison (D-43)
  p_m5    uuid := '00000000-0000-4000-8100-0000000000b5';  -- renormalisation
  p_m6    uuid := '00000000-0000-4000-8100-0000000000b6';  -- bonus plafonne
  p_m7    uuid := '00000000-0000-4000-8100-0000000000b7';  -- couverture 2/5
  p_m8    uuid := '00000000-0000-4000-8100-0000000000b8';  -- sous-region
  p_sa    uuid := '00000000-0000-4000-8100-0000000000c1';  -- Kouame (accents)
  p_sb    uuid := '00000000-0000-4000-8100-0000000000c2';  -- Kouassi (typo)
  p_sal   uuid := '00000000-0000-4000-8100-0000000000c3';  -- alias
  p_blk   uuid := '00000000-0000-4000-8100-0000000000c4';  -- bloque Alice
  p_sus   uuid := '00000000-0000-4000-8100-0000000000c5';  -- suspendu
  p_ref   uuid := '00000000-0000-4000-8100-0000000000c6';  -- reference

  -- ---- Referentiels de fixture -------------------------------------
  v_dom  bigint; v_cat bigint;
  v_s1 bigint; v_s2 bigint; v_s3 bigint; v_s4 bigint; v_s5 bigint; v_sal bigint;
  v_seca bigint; v_secb bigint; v_secc bigint; v_p1 bigint; v_p2 bigint;

  -- ---- Etat du harnais ---------------------------------------------
  v_cases integer := 0;
  v_fail  text[]  := array[]::text[];
  v_par   text[]  := array[]::text[];
  v_n bigint; v_ok boolean; v_msg text; v_txt text;
  v_score numeric; v_lbl text; v_nr integer;
  v_ids uuid[]; v_page1 uuid[]; v_cur text; v_i integer;
  v_before smallint; v_after smallint;
  r record;
begin
  -- ===================================================================
  -- FIXTURES (role postgres, BYPASSRLS)
  -- ===================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  -- Promotions dediees : le critere « promotion » doit rester selectif.
  insert into public.promotions (program_code, graduation_year, name)
  values ('ZTEST', 2098, 'Promotion de test Zeta A') returning id into v_p1;
  insert into public.promotions (program_code, graduation_year, name)
  values ('ZTEST', 2099, 'Promotion de test Zeta B') returning id into v_p2;

  insert into public.skill_domains (code, name, slug)
  values ('ZTESTDOM', 'Domaine de test Zeta', 'ztest-domaine') returning id into v_dom;
  insert into public.skill_categories (domain_id, code, name, slug)
  values (v_dom, 'ZTESTCAT', 'Categorie de test Zeta', 'ztest-categorie') returning id into v_cat;

  insert into public.skills (category_id, code, name, slug, source)
  values (v_cat, 'ZTESTS1', 'Zeta econometrie de test', 'ztest-econometrie', 'admin') returning id into v_s1;
  insert into public.skills (category_id, code, name, slug, source)
  values (v_cat, 'ZTESTS2', 'Zeta suivi de test', 'ztest-suivi', 'admin') returning id into v_s2;
  insert into public.skills (category_id, code, name, slug, source)
  values (v_cat, 'ZTESTS3', 'Zeta finance de test', 'ztest-finance', 'admin') returning id into v_s3;
  insert into public.skills (category_id, code, name, slug, source)
  values (v_cat, 'ZTESTS4', 'Zeta sondage de test', 'ztest-sondage', 'admin') returning id into v_s4;
  insert into public.skills (category_id, code, name, slug, source)
  values (v_cat, 'ZTESTS5', 'Zeta cartographie de test', 'ztest-cartographie', 'admin') returning id into v_s5;
  insert into public.skills (category_id, code, name, slug, source)
  values (v_cat, 'ZTESTSAL', 'Zeta ingenierie unique de test', 'ztest-ingenierie', 'admin') returning id into v_sal;

  insert into public.sectors (name, slug) values ('Zeta secteur A', 'ztest-secteur-a') returning id into v_seca;
  insert into public.sectors (name, slug) values ('Zeta secteur B', 'ztest-secteur-b') returning id into v_secb;
  insert into public.sectors (name, slug) values ('Zeta secteur C', 'ztest-secteur-c') returning id into v_secc;
  insert into public.sector_adjacencies (sector_id, related_sector_id) values (v_seca, v_secb);

  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', u_alice, 'authenticated', 'authenticated',
          'test+search-alice@ise.test', now(), now());

  insert into public.ise_profiles
    (id, user_id, first_name, last_name, headline, promotion_id, current_country_code,
     current_city, current_position, current_organization_raw,
     profile_status, claim_status, claimed_at, is_test_account)
  values
    (p_alice, u_alice, 'Alice', 'Testeuse', 'Chercheuse', v_p1, 'CI', 'Abidjan',
     'Analyste', 'Org test', 'active', 'claimed', now(), true),
    (p_m1, null, 'Marie',  'Undecim', 'Zorglubia consultante', v_p1,  'BF', null, null, null, 'active', 'unclaimed', null, true),
    (p_m2, null, 'Bakary', 'Duodecim','Zorglubia consultant',  v_p2,  'CI', null, null, null, 'active', 'unclaimed', null, true),
    (p_m3, null, 'Chantal','Tredecim','Zorglubia consultante', null,  'SN', null, null, null, 'active', 'unclaimed', null, true),
    (p_m4, null, 'Diallo', 'Quatuor', 'Zorglubia consultant',  v_p1,  'SN', null, null, null, 'active', 'unclaimed', null, true),
    (p_m5, null, 'Esther', 'Quintus', 'Zorglubia consultante', null,  null, null, null, null, 'active', 'unclaimed', null, true),
    (p_m6, null, 'Fode',   'Sextus',  'Zorglubia consultant',  null,  null, null, null, null, 'active', 'unclaimed', null, true),
    (p_m7, null, 'Grace',  'Septimus','Analyste septieme',     null,  null, null, null, null, 'active', 'unclaimed', null, true),
    (p_m8, null, 'Hamidou','Octavus', 'Analyste huitieme',     v_p1,  'SN', null, null, null, 'active', 'unclaimed', null, true),
    (p_sa,  null, 'Yao',   'Kouamé',   'Statisticien',  null, null, null, null, null, 'active', 'unclaimed', null, true),
    (p_sb,  null, 'Yao',   'Kouassi',  'Statisticien',  null, null, null, null, null, 'active', 'unclaimed', null, true),
    (p_sal, null, 'Ada',   'Aliasson', 'Ingenieure',    null, null, null, null, null, 'active', 'unclaimed', null, true),
    (p_blk, null, 'Bruno', 'Bloquia',  'Consultant',    null, null, null, null, null, 'active', 'unclaimed', null, true),
    (p_sus, null, 'Sonia', 'Suspendia','Consultante',   null, null, null, null, null, 'suspended', 'unclaimed', null, true),
    (p_ref, null, 'Rose',  'Referencia','Consultante',  null, null, null, null, null, 'referenced', 'unclaimed', null, true);

  insert into public.profile_skills (profile_id, skill_id, level, is_primary) values
    (p_m1, v_s1, 'expert', true), (p_m1, v_s2, 'expert', true),
    (p_m2, v_s1, 'intermediate', false),
    (p_m3, v_s2, 'advanced', true),
    (p_m5, v_s1, null, false),
    (p_m6, v_s1, 'expert', true), (p_m6, v_s2, 'notion', false),
    (p_m7, v_s1, 'expert', true), (p_m7, v_s2, 'expert', true),
    (p_sal, v_sal, 'expert', true);

  insert into public.profile_sectors (profile_id, sector_id) values
    (p_m1, v_seca), (p_m2, v_secb), (p_m3, v_secc);

  insert into public.profile_geographies (profile_id, country_code) values (p_m1, 'CI');

  insert into public.profile_availabilities (profile_id, availability_type, active, notes) values
    (p_m1, 'mission', true, 'Ouverte a des missions courtes.'),
    (p_m2, 'consulting', true, null),
    (p_m4, 'consulting', true, null);

  insert into public.profile_languages (profile_id, language_code, proficiency) values
    (p_m1, 'fr', 'native'), (p_m1, 'en', 'professional'),
    (p_m2, 'fr', 'native'), (p_m8, 'fr', 'native');

  -- Les durees fixent l'anciennete a la journee pres :
  --   M1 4383 j -> 12,00 ans · M2 2192 j -> 6,00 · M3 1096 j -> 3,00 · M4 3287 j -> 9,00
  insert into public.experiences
    (profile_id, organization_name_raw, position_title, country_code, start_date, end_date)
  values
    (p_m1, 'Org M1', 'Economiste',  'BF', current_date - 4383, current_date),
    (p_m2, 'Org M2', 'Statisticien','SN', current_date - 2192, current_date),
    (p_m3, 'Org M3', 'Analyste',    'SN', current_date - 1096, current_date),
    (p_m4, 'Org M4', 'Consultant',  'SN', current_date - 3287, current_date);

  insert into public.profile_blocks (blocker_profile_id, blocked_profile_id) values (p_blk, p_alice);

  perform private.refresh_stale_search_documents(5000);

  -- Alias inseres APRES la construction de l'index : ils ne peuvent donc
  -- etre trouves QUE par la resolution a la requete (D-46), jamais par le
  -- tsvector. C'est tout l'objet des cas S03 a S05.
  insert into public.skill_aliases (skill_id, alias, normalized_alias) values
    (v_sal, 'Xyzq Analytics', 'xyzq analytics'),
    (v_sal, 'ZQ', 'zq');

  -- ===================================================================
  -- MOTEUR DE RECHERCHE — Alice authentifiee
  -- ===================================================================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_alice::text, 'role', 'authenticated')::text, true);

  select count(*) into v_n from public.search_profiles(p_query => 'Kouame', p_page_size => 50) s where s.profile_id = p_sa;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('S01 accents (%s)', v_n); end if;

  select count(*) into v_n from public.search_profiles(p_query => 'Kouasi', p_page_size => 50) s where s.profile_id = p_sb;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('S02 faute de frappe (%s)', v_n); end if;

  select count(*) into v_n from public.search_profiles(p_query => 'Xyzq Analytics', p_page_size => 50) s where s.profile_id = p_sal;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('S03 alias long non resolu (%s)', v_n); end if;

  select count(*) into v_n from public.search_profiles(p_query => 'zq', p_page_size => 50) s where s.profile_id = p_sal;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('S04 sigle court minuscule resolu a tort (%s)', v_n); end if;

  select count(*) into v_n from public.search_profiles(p_query => 'ZQ', p_page_size => 50) s where s.profile_id = p_sal;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('S05 sigle court majuscule non resolu (%s)', v_n); end if;

  select count(*) into v_n from public.search_profiles(p_query => 'Bloquia', p_page_size => 50) s where s.profile_id = p_blk;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('S06 profil bloquant visible (%s)', v_n); end if;

  select count(*) into v_n from public.search_profiles(p_query => 'Suspendia', p_page_size => 50) s where s.profile_id = p_sus;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('S07 profil suspendu visible (%s)', v_n); end if;

  select count(*) into v_n from public.search_profiles(p_query => 'Referencia', p_page_size => 50) s where s.profile_id = p_ref;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('S08 profil reference introuvable (%s)', v_n); end if;

  -- S09/S10/S11 — pagination par curseur : 3 pages de 2 sur 6 profils.
  v_cur := null; v_ids := array[]::uuid[];
  for v_i in 1 .. 3 loop
    for r in select s.profile_id as pid, s.page_cursor as pc
             from public.search_profiles(p_query => 'Zorglubia', p_page_size => 2, p_cursor => v_cur) s
    loop
      v_ids := v_ids || r.pid;
      v_cur := r.pc;
    end loop;
    if v_i = 1 then v_page1 := v_ids; end if;
  end loop;
  v_cases := v_cases + 1;
  if coalesce(array_length(v_ids,1),0) <> 6 then
    v_fail := v_fail || format('S09 pagination : %s lignes au lieu de 6', coalesce(array_length(v_ids,1),0)); end if;

  select count(distinct u) into v_n from unnest(v_ids) u;
  v_cases := v_cases + 1;
  if v_n <> coalesce(array_length(v_ids,1),0) then
    v_fail := v_fail || format('S10 doublon (%s distincts sur %s)', v_n, coalesce(array_length(v_ids,1),0)); end if;

  v_ids := array[]::uuid[];
  for r in select s.profile_id as pid from public.search_profiles(p_query => 'Zorglubia', p_page_size => 2) s loop
    v_ids := v_ids || r.pid;
  end loop;
  v_cases := v_cases + 1;
  if v_ids is distinct from v_page1 then v_fail := v_fail || 'S11 page 1 non stable au rejeu'; end if;

  -- S12/S13 — aucune donnee privee, ni score, dans les signatures.
  perform set_config('role', 'postgres', true);
  select pg_get_function_result(pr.oid) into v_txt from pg_proc pr join pg_namespace n on n.oid = pr.pronamespace
   where n.nspname='public' and pr.proname='search_profiles';
  v_cases := v_cases + 1;
  if v_txt ~* '(e?mail|phone|telephone|completion|birth|address|adresse|score)' then
    v_fail := v_fail || ('S12 search_profiles expose une donnee privee : ' || v_txt); end if;

  select pg_get_function_result(pr.oid) into v_txt from pg_proc pr join pg_namespace n on n.oid = pr.pronamespace
   where n.nspname='public' and pr.proname='match_profiles';
  v_cases := v_cases + 1;
  if v_txt ~* '(e?mail|phone|telephone|completion|birth|address|adresse|score)' then
    v_fail := v_fail || ('S13 match_profiles expose une donnee privee ou le score : ' || v_txt); end if;

  -- S14 — un non-membre ne peut pas chercher.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '', true);
  v_msg := null;
  begin
    select count(*) into v_n from public.search_profiles(p_query => 'Kouame') s;
    v_ok := false; v_msg := format('anon a obtenu %s ligne(s)', v_n);
  exception when others then v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('S14 ' || coalesce(v_msg,'')); end if;

  -- ===================================================================
  -- PARITE DU MOTEUR DE MATCHING
  -- Le score n'est jamais renvoye en clair : il est lu dans le curseur
  -- opaque, ce qui verifie du meme coup que le curseur le transporte bien.
  -- ===================================================================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_alice::text, 'role', 'authenticated')::text, true);

  -- P01 — 40 + 15 + 15 + 10 + 10 + 5 + 5 = 100 / 100 -> 100,00
  v_score := null; v_lbl := null; v_nr := null;
  select split_part(convert_from(decode(m.page_cursor,'base64'),'UTF8'),'|',1)::numeric, m.relevance_label, jsonb_array_length(m.reasons)
    into v_score, v_lbl, v_nr
  from public.match_profiles(p_skill_ids => array[v_s1,v_s2]::bigint[], p_sector_id => v_seca,
       p_country_code => 'CI', p_availability_type => 'mission', p_min_years_experience => 10,
       p_language_codes => array['fr','en']::varchar[], p_promotion_id => v_p1, p_page_size => 50) m
  where m.profile_id = p_m1;
  v_cases := v_cases + 1;
  v_par := v_par || format('P01 M1 profil parfait           | attendu 100.00 very_relevant 7r | obtenu %s %s %sr', coalesce(v_score::text,'ABSENT'), coalesce(v_lbl,'-'), coalesce(v_nr::text,'-'));
  if v_score is null or abs(v_score-100.00) > 0.005 or v_lbl <> 'very_relevant' or v_nr <> 7 then
    v_fail := v_fail || format('P01 attendu 100.00/very_relevant/7r, obtenu %s/%s/%s', v_score, v_lbl, v_nr); end if;

  -- P02 — 14 + 9 + 12 + 5 + 6 + 2,5 + 0 = 48,5 / 100 -> 48,50
  v_score := null; v_lbl := null; v_nr := null;
  select split_part(convert_from(decode(m.page_cursor,'base64'),'UTF8'),'|',1)::numeric, m.relevance_label, jsonb_array_length(m.reasons)
    into v_score, v_lbl, v_nr
  from public.match_profiles(p_skill_ids => array[v_s1,v_s2]::bigint[], p_sector_id => v_seca,
       p_country_code => 'CI', p_availability_type => 'mission', p_min_years_experience => 10,
       p_language_codes => array['fr','en']::varchar[], p_promotion_id => v_p1, p_page_size => 50) m
  where m.profile_id = p_m2;
  v_cases := v_cases + 1;
  v_par := v_par || format('P02 M2 partiel/connexe/residence| attendu  48.50 relevant      4r | obtenu %s %s %sr', coalesce(v_score::text,'ABSENT'), coalesce(v_lbl,'-'), coalesce(v_nr::text,'-'));
  if v_score is null or abs(v_score-48.50) > 0.005 or v_lbl <> 'relevant' or v_nr <> 4 then
    v_fail := v_fail || format('P02 attendu 48.50/relevant/4r, obtenu %s/%s/%s', v_score, v_lbl, v_nr); end if;

  -- P03 — 19,8 / 100 -> 19,80 : sous le seuil D-42, candidat exclu.
  select count(*) into v_n
  from public.match_profiles(p_skill_ids => array[v_s1,v_s2]::bigint[], p_sector_id => v_seca,
       p_country_code => 'CI', p_availability_type => 'mission', p_min_years_experience => 10,
       p_language_codes => array['fr','en']::varchar[], p_promotion_id => v_p1, p_page_size => 50) m
  where m.profile_id = p_m3;
  v_cases := v_cases + 1;
  v_par := v_par || format('P03 M3 score 19.80 < seuil 25   | attendu EXCLU                   | obtenu %s ligne(s)', v_n);
  if v_n <> 0 then v_fail := v_fail || format('P03 M3 non exclu (%s)', v_n); end if;

  -- P04 — controle numerique de la composante competences de M3 : 19,8 / 40.
  v_score := null; v_lbl := null; v_nr := null;
  select split_part(convert_from(decode(m.page_cursor,'base64'),'UTF8'),'|',1)::numeric, m.relevance_label, jsonb_array_length(m.reasons)
    into v_score, v_lbl, v_nr
  from public.match_profiles(p_skill_ids => array[v_s1,v_s2]::bigint[], p_page_size => 50) m
  where m.profile_id = p_m3;
  v_cases := v_cases + 1;
  v_par := v_par || format('P04 M3 competences seules       | attendu  49.50 relevant      1r | obtenu %s %s %sr', coalesce(v_score::text,'ABSENT'), coalesce(v_lbl,'-'), coalesce(v_nr::text,'-'));
  if v_score is null or abs(v_score-49.50) > 0.005 or v_lbl <> 'relevant' or v_nr <> 1 then
    v_fail := v_fail || format('P04 attendu 49.50/relevant/1r, obtenu %s/%s/%s', v_score, v_lbl, v_nr); end if;

  -- P05 — 5 (dispo sans le type) + 9 (exp 0,9) = 14 / 20 -> 70,00,
  -- mais AUCUNE de ces deux situations ne produit de raison : exclu (D-43).
  select count(*) into v_n
  from public.match_profiles(p_availability_type => 'mission', p_min_years_experience => 10, p_page_size => 50) m
  where m.profile_id = p_m4;
  v_cases := v_cases + 1;
  v_par := v_par || format('P05 M4 score 70.00 sans raison  | attendu EXCLU (D-43)            | obtenu %s ligne(s)', v_n);
  if v_n <> 0 then v_fail := v_fail || format('P05 M4 non exclu malgre D-43 (%s)', v_n); end if;

  -- P06 — memes composantes + promotion : 19 / 25 -> 76,00, une raison.
  v_score := null; v_lbl := null; v_nr := null;
  select split_part(convert_from(decode(m.page_cursor,'base64'),'UTF8'),'|',1)::numeric, m.relevance_label, jsonb_array_length(m.reasons)
    into v_score, v_lbl, v_nr
  from public.match_profiles(p_availability_type => 'mission', p_min_years_experience => 10,
       p_promotion_id => v_p1, p_page_size => 50) m
  where m.profile_id = p_m4;
  v_cases := v_cases + 1;
  v_par := v_par || format('P06 M4 dispo5 + exp9 + promo5   | attendu  76.00 very_relevant 1r | obtenu %s %s %sr', coalesce(v_score::text,'ABSENT'), coalesce(v_lbl,'-'), coalesce(v_nr::text,'-'));
  if v_score is null or abs(v_score-76.00) > 0.005 or v_lbl <> 'very_relevant' or v_nr <> 1 then
    v_fail := v_fail || format('P06 attendu 76.00/very_relevant/1r, obtenu %s/%s/%s', v_score, v_lbl, v_nr); end if;

  -- P07 — renormalisation : 30 / 40 -> 75,00. Sans elle : 30 / 100 -> 30,00.
  v_score := null; v_lbl := null; v_nr := null;
  select split_part(convert_from(decode(m.page_cursor,'base64'),'UTF8'),'|',1)::numeric, m.relevance_label, jsonb_array_length(m.reasons)
    into v_score, v_lbl, v_nr
  from public.match_profiles(p_skill_ids => array[v_s1]::bigint[], p_page_size => 50) m
  where m.profile_id = p_m5;
  v_cases := v_cases + 1;
  v_par := v_par || format('P07 M5 renormalisation 0.75     | attendu  75.00 very_relevant 1r | obtenu %s %s %sr', coalesce(v_score::text,'ABSENT'), coalesce(v_lbl,'-'), coalesce(v_nr::text,'-'));
  if v_score is null or abs(v_score-75.00) > 0.005 or v_lbl <> 'very_relevant' or v_nr <> 1 then
    v_fail := v_fail || format('P07 attendu 75.00/very_relevant/1r, obtenu %s/%s/%s', v_score, v_lbl, v_nr); end if;

  -- P08 — min(1 ; 1,00 x 1,1) = 1 puis 0,40 -> 28 / 40 -> 70,00.
  -- Sans le plafond : (1,1 + 0,4) / 2 = 0,75 -> 75,00.
  v_score := null; v_lbl := null; v_nr := null;
  select split_part(convert_from(decode(m.page_cursor,'base64'),'UTF8'),'|',1)::numeric, m.relevance_label, jsonb_array_length(m.reasons)
    into v_score, v_lbl, v_nr
  from public.match_profiles(p_skill_ids => array[v_s1,v_s2]::bigint[], p_page_size => 50) m
  where m.profile_id = p_m6;
  v_cases := v_cases + 1;
  v_par := v_par || format('P08 M6 bonus plafonne a 1       | attendu  70.00 very_relevant 1r | obtenu %s %s %sr', coalesce(v_score::text,'ABSENT'), coalesce(v_lbl,'-'), coalesce(v_nr::text,'-'));
  if v_score is null or abs(v_score-70.00) > 0.005 or v_lbl <> 'very_relevant' or v_nr <> 1 then
    v_fail := v_fail || format('P08 attendu 70.00/very_relevant/1r, obtenu %s/%s/%s', v_score, v_lbl, v_nr); end if;

  -- P09 — couverture rapportee aux competences DEMANDEES : 2 / 5 -> 40,00.
  -- Rapportee aux competences TROUVEES on obtiendrait 100,00.
  v_score := null; v_lbl := null; v_nr := null;
  select split_part(convert_from(decode(m.page_cursor,'base64'),'UTF8'),'|',1)::numeric, m.relevance_label, jsonb_array_length(m.reasons)
    into v_score, v_lbl, v_nr
  from public.match_profiles(p_skill_ids => array[v_s1,v_s2,v_s3,v_s4,v_s5]::bigint[], p_page_size => 50) m
  where m.profile_id = p_m7;
  v_cases := v_cases + 1;
  v_par := v_par || format('P09 M7 couverture 2 sur 5       | attendu  40.00 close         1r | obtenu %s %s %sr', coalesce(v_score::text,'ABSENT'), coalesce(v_lbl,'-'), coalesce(v_nr::text,'-'));
  if v_score is null or abs(v_score-40.00) > 0.005 or v_lbl <> 'close' or v_nr <> 1 then
    v_fail := v_fail || format('P09 attendu 40.00/close/1r, obtenu %s/%s/%s', v_score, v_lbl, v_nr); end if;

  -- P10 — 8 (sous-region) + 1,67 (1 langue sur 3) + 5 = 14,67 / 25 -> 58,68.
  v_score := null; v_lbl := null; v_nr := null;
  select split_part(convert_from(decode(m.page_cursor,'base64'),'UTF8'),'|',1)::numeric, m.relevance_label, jsonb_array_length(m.reasons)
    into v_score, v_lbl, v_nr
  from public.match_profiles(p_country_code => 'CI', p_subregion_code => 'africa-west',
       p_language_codes => array['fr','en','pt']::varchar[], p_promotion_id => v_p1, p_page_size => 50) m
  where m.profile_id = p_m8;
  v_cases := v_cases + 1;
  v_par := v_par || format('P10 M8 sous-region + langue 1/3 | attendu  58.68 relevant      3r | obtenu %s %s %sr', coalesce(v_score::text,'ABSENT'), coalesce(v_lbl,'-'), coalesce(v_nr::text,'-'));
  if v_score is null or abs(v_score-58.68) > 0.005 or v_lbl <> 'relevant' or v_nr <> 3 then
    v_fail := v_fail || format('P10 attendu 58.68/relevant/3r, obtenu %s/%s/%s', v_score, v_lbl, v_nr); end if;

  -- P11 — le profil bloquant n'est jamais propose.
  select count(*) into v_n from public.match_profiles(p_promotion_id => v_p1, p_page_size => 50) m where m.profile_id = p_blk;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('P11 profil bloquant propose par le matching (%s)', v_n); end if;

  -- ===================================================================
  -- COMPLETION DE PROFIL (D-71, D-72)
  -- ===================================================================
  v_msg := null;
  begin
    perform public.calculate_profile_completion(p_m1);
    v_ok := false; v_msg := 'appel accepte';
  exception when others then v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('C01 calculate_profile_completion accessible a un membre : ' || coalesce(v_msg,'')); end if;

  select count(*) into v_n from public.my_profile_missing_items();
  v_cases := v_cases + 1;
  if v_n = 0 then v_fail := v_fail || 'C02 my_profile_missing_items() ne renvoie aucun bloc pour un profil incomplet'; end if;

  perform set_config('role', 'postgres', true);
  select p.profile_completion into v_before from public.ise_profiles p where p.id = p_m5;
  insert into public.profile_languages (profile_id, language_code, proficiency)
  values (p_m5, 'fr', 'native'), (p_m5, 'en', 'professional');
  select p.profile_completion into v_after from public.ise_profiles p where p.id = p_m5;
  v_cases := v_cases + 1;
  if v_after is null or v_before is null or v_after <= v_before then
    v_fail := v_fail || format('C03 le trigger de completion n''a pas releve le score (%s -> %s)', v_before, v_after); end if;

  -- Le bloc « languages » pese 3 pour 2 langues attendues : +3 exactement.
  v_cases := v_cases + 1;
  if v_after - v_before <> 3 then
    v_fail := v_fail || format('C03b increment attendu 3 (poids du bloc langues), obtenu %s', v_after - v_before); end if;

  -- ===================================================================
  -- Z01 — non-regression de la ligne de base de securite.
  -- ===================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  select count(*) into v_n from private.security_baseline_violations();
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('Z01 security_baseline_violations() renvoie %s ligne(s)', v_n); end if;

  -- ===================================================================
  -- RAPPORT + ROLLBACK
  -- L'exception est volontaire : elle annule toute la transaction et
  -- garantit qu'aucune fixture ne subsiste en base.
  -- ===================================================================
  if array_length(v_fail,1) is null then
    raise exception E'SEARCH_TESTS_OK: % cas, 0 echec\nPARITE SQL <-> TypeScript\n  %',
      v_cases, array_to_string(v_par, E'\n  ');
  else
    raise exception E'SEARCH_TESTS_FAILED: % cas, % echec(s)\n  - %\nPARITE SQL <-> TypeScript\n  %',
      v_cases, array_length(v_fail,1), array_to_string(v_fail, E'\n  - '), array_to_string(v_par, E'\n  ');
  end if;
end
$suite$;
