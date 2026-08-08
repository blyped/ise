-- =====================================================================
-- supabase/tests/rls/0002_claim_suite.sql
--
-- Suite de tests de la tranche « Reclamation de profil » (ISE-005 -> 007).
-- Meme modele auto-nettoyant que 0001_rls_negative_suite.sql :
--   un unique bloc DO, des fixtures creees sous `postgres` (BYPASSRLS),
--   des assertions executees sous l'identite reelle des comptes, et une
--   exception FINALE qui annule toute la transaction. Aucune donnee de
--   test ne subsiste : l'exception EST le mecanisme de rollback.
--
--     succes  ->  ERROR:  P0001: CLAIM_TESTS_OK: N cas, 0 echec
--     echec   ->  ERROR:  P0001: CLAIM_TESTS_FAILED: N cas, K echec(s)
--
-- COUVERTURE (MASTER PROMPT §80 : une regle non testee n'est pas terminee)
--   K01  search_claimable_profiles refuse un appelant non authentifie
--   K02  la recherche trouve un profil non reclame
--   K03  la recherche tolere une faute de frappe (D-45, seuil 0,30)
--   K04  la recherche ne renvoie JAMAIS d'e-mail en clair, seulement l'indice
--   K05  la recherche filtre par annee de promotion
--   K06  la recherche ne renvoie jamais un profil deja reclame
--   K07  un compte deja rattache ne peut pas enumerer l'annuaire non reclame
--   K08  limitation de debit : 6e recherche dans l'heure refusee (D-103)
--   K09  approbation AUTOMATIQUE quand l'e-mail du compte correspond (ISE-007)
--   K10  ... et le profil devient reclame, actif, verifie « email »
--   K11  ... et le role `member` est attribue
--   K12  REVUE HUMAINE quand l'e-mail ne correspond pas : statut `submitted`
--   K13  ... et le profil passe en `claim_pending`, pas en `claimed`
--   K14  double reclamation du meme profil : `profile_already_claimed`
--   K15  un compte deja rattache ne peut pas reclamer un second profil
--   K16  une seconde reclamation en cours par le meme compte est refusee
--   K17  un membre sans `profiles.verify` ne peut pas approuver
--   K18  un porteur de `profiles.verify` approuve
--   K19  un membre sans `profiles.verify` ne peut pas rejeter
--   K20  rejet : le profil redevient reclamable
--   K21  get_claimable_profile ne renvoie rien pour un profil deja reclame
--   K22  my_profile_claim() ne renvoie que la reclamation du compte courant
--   K23  la ligne de base de securite reste vide apres 0029
--
-- REJOUER : voir docs/rls.md, section « Rejouer la suite de tests ».
-- =====================================================================

do $claim$
declare
  -- ---- Comptes (plage de fixtures 0002, disjointe de celle de 0001) ----
  u_gina   uuid := '00000000-0000-4000-8000-000000000101';  -- e-mail = e-mail historique de Koffi
  u_hugo   uuid := '00000000-0000-4000-8000-000000000102';  -- aucun e-mail historique connu
  u_ines   uuid := '00000000-0000-4000-8000-000000000103';  -- membre deja rattache, sans profiles.verify
  u_jules  uuid := '00000000-0000-4000-8000-000000000104';  -- delegue de promotion : profiles.verify
  u_karim  uuid := '00000000-0000-4000-8000-000000000105';  -- reclamation destinee au rejet
  u_rachid uuid := '00000000-0000-4000-8000-000000000106';  -- cobaye de la limitation de debit

  -- ---- Profils ----
  p_koffi  uuid := '00000000-0000-4000-8000-0000000001a1';  -- non reclame, e-mail historique connu
  p_lamine uuid := '00000000-0000-4000-8000-0000000001a2';  -- non reclame, e-mail historique different
  p_nadia  uuid := '00000000-0000-4000-8000-0000000001a3';  -- non reclame, servira au rejet
  p_omar   uuid := '00000000-0000-4000-8000-0000000001a4';  -- non reclame, jamais reclame
  p_ines   uuid := '00000000-0000-4000-8000-0000000001a5';  -- deja reclame par Ines
  p_jules  uuid := '00000000-0000-4000-8000-0000000001a6';  -- deja reclame par Jules
  p_ehou   uuid := '00000000-0000-4000-8000-0000000001a7';  -- non reclame, sert au test de tolerance

  x_org    uuid := '00000000-0000-4000-8000-0000000001c1';

  -- ---- Etat du harnais ----
  v_cases  integer := 0;
  v_fail   text[]  := array[]::text[];
  v_n      bigint;
  v_ok     boolean;
  v_msg    text;
  v_txt    text;
  v_uuid   uuid;
  v_claim_hugo  uuid;
  v_claim_karim uuid;
  v_promo_2012  bigint;
  v_promo_2015  bigint;
  v_role        smallint;
  v_i           integer;
  v_bullet      text := U&'\2022\2022\2022';
begin
  -- ===================================================================
  -- FIXTURES (role postgres, BYPASSRLS)
  -- ===================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  select id into v_promo_2012 from public.promotions where graduation_year = 2012 and program_code = 'ISE';
  select id into v_promo_2015 from public.promotions where graduation_year = 2015 and program_code = 'ISE';
  if v_promo_2012 is null or v_promo_2015 is null then
    raise exception 'CLAIM_TESTS_FAILED: promotions 2012/2015 absentes du referentiel';
  end if;

  -- Comptes Auth. `email_confirmed_at` est renseigne : la verification
  -- automatique l'exige (un compte non confirme ne prouve rien).
  insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', u_gina,   'authenticated', 'authenticated', 'test+gina@ise.test',   now(), now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_hugo,   'authenticated', 'authenticated', 'test+hugo@ise.test',   now(), now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_ines,   'authenticated', 'authenticated', 'test+ines@ise.test',   now(), now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_jules,  'authenticated', 'authenticated', 'test+jules@ise.test',  now(), now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_karim,  'authenticated', 'authenticated', 'test+karim@ise.test',  now(), now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_rachid, 'authenticated', 'authenticated', 'test+rachid@ise.test', now(), now(), now());

  insert into public.organizations (id, canonical_name, organization_type)
  values (x_org, 'Banque de test ISE', 'commercial_bank');

  insert into public.ise_profiles
    (id, user_id, promotion_id, first_name, last_name, profile_status, claim_status, claimed_at,
     current_organization_id, current_organization_raw, is_test_account)
  values
    (p_koffi,  null,    v_promo_2012, 'Koffi',  'Mensah',  'referenced', 'unclaimed', null,  x_org, null,               true),
    (p_lamine, null,    v_promo_2015, 'Lamine', 'Mensah',  'referenced', 'unclaimed', null,  null,  'Cabinet de test',  true),
    (p_nadia,  null,    v_promo_2012, 'Nadia',  'Mensah',  'referenced', 'unclaimed', null,  null,  null,               true),
    (p_omar,   null,    v_promo_2015, 'Omar',   'Mensah',  'referenced', 'unclaimed', null,  null,  null,               true),
    (p_ehou,   null,    v_promo_2012, 'Adama',  'Ehouman', 'referenced', 'unclaimed', null,  null,  null,               true),
    (p_ines,   u_ines,  v_promo_2012, 'Ines',   'Testeur', 'active',     'claimed',   now(), null,  null,               true),
    (p_jules,  u_jules, v_promo_2012, 'Jules',  'Testeur', 'active',     'claimed',   now(), null,  null,               true);

  -- Coordonnees historiques : celles de Koffi correspondent au compte de Gina,
  -- celles de Lamine ne correspondent a aucun compte de test.
  insert into private.profile_contacts (profile_id, primary_email, phone_e164)
  values
    (p_koffi,  'test+gina@ise.test',            '+22507000001'),
    (p_lamine, 'lamine.historique@ise.test',    '+22507000002'),
    (p_nadia,  'nadia.historique@ise.test',     null);

  -- Roles : Ines est simple membre, Jules est delegue de promotion
  -- (le seul role non administratif porteur de `profiles.verify`).
  select id into v_role from private.roles where code = 'member';
  insert into private.user_roles (profile_id, role_id) values (p_ines, v_role), (p_jules, v_role);
  select id into v_role from private.roles where code = 'promotion_manager';
  insert into private.user_roles (profile_id, role_id) values (p_jules, v_role);

  -- ===================================================================
  -- K01 — Recherche sans authentification.
  -- ===================================================================
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '', true);
  v_msg := null;
  begin
    perform 1 from public.search_claimable_profiles('Mensah', null, null);
    v_ok := false;
    v_msg := 'recherche acceptee pour un appelant anonyme';
  exception when others then
    v_ok := true;   -- refus de privilege EXECUTE, ou not_authenticated
  end;
  perform set_config('role', 'postgres', true);
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('K01 ' || coalesce(v_msg, '')); end if;

  -- ===================================================================
  -- Gina : compte authentifie, aucun profil rattache.
  -- ===================================================================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_gina::text, 'role', 'authenticated')::text, true);

  -- K02 — la recherche trouve les profils non reclames.
  select count(*) into v_n
  from public.search_claimable_profiles('Mensah', null, null) s
  where s.profile_id in (p_koffi, p_lamine, p_nadia, p_omar);
  v_cases := v_cases + 1;
  if v_n <> 4 then v_fail := v_fail || format('K02 %s profil(s) trouve(s) sur 4', v_n); end if;

  -- K03 — tolerance a la faute de frappe : « Ehoumann » doit trouver « Ehouman ».
  select count(*) into v_n
  from public.search_claimable_profiles('Ehoumann', 'Adama', null) s
  where s.profile_id = p_ehou;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('K03 recherche tolerante (D-45) : %s resultat(s)', v_n); end if;

  -- K04 — aucun e-mail en clair. L'indice est masque et le nom canonique
  --       de l'organisation est bien celui de la table `organizations`.
  --       Un SEUL appel : la limitation de debit s'applique aussi aux tests.
  select s.email_hint, s.current_organization into v_txt, v_msg
  from public.search_claimable_profiles('Mensah', 'Koffi', null) s
  where s.profile_id = p_koffi;

  v_ok := v_txt is not null
      and position(v_bullet in v_txt) > 0
      and position('gina' in lower(v_txt)) = 0
      and position('ise.test' in lower(v_txt)) = 0;
  v_cases := v_cases + 1;
  if not v_ok then
    v_fail := v_fail || ('K04 indice d''e-mail non conforme : ' || coalesce(v_txt, '(null)'));
  end if;

  v_cases := v_cases + 1;
  if v_msg is distinct from 'Banque de test ISE' then
    v_fail := v_fail || ('K04b organisation canonique attendue, obtenue : ' || coalesce(v_msg, '(null)'));
  end if;

  -- ------------------------------------------------------------------
  -- Hugo prend le relais : 5 recherches par heure et par COMPTE (D-103),
  -- Gina a deja consomme trois de ses jetons.
  -- ------------------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_hugo::text, 'role', 'authenticated')::text, true);

  -- K05 — filtre par annee de promotion.
  select count(*) into v_n
  from public.search_claimable_profiles('Mensah', null, 2015) s
  where s.profile_id in (p_koffi, p_lamine, p_nadia, p_omar);
  v_cases := v_cases + 1;
  if v_n <> 2 then v_fail := v_fail || format('K05 filtre promotion 2015 : %s resultat(s) au lieu de 2', v_n); end if;

  -- K06 — un profil deja reclame n'apparait jamais (Ines et Jules).
  select count(*) into v_n
  from public.search_claimable_profiles('Testeur', null, null) s
  where s.profile_id in (p_ines, p_jules);
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('K06 %s profil(s) deja reclame(s) renvoye(s) par la recherche', v_n); end if;

  -- ===================================================================
  -- K07 — Ines est deja rattachee a un profil : elle n'a pas a enumerer
  --       l'annuaire non reclame ni ses indices de contact.
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_ines::text, 'role', 'authenticated')::text, true);
  v_msg := null;
  begin
    perform 1 from public.search_claimable_profiles('Mensah', null, null);
    v_ok := false;
    v_msg := 'recherche acceptee pour un compte deja rattache';
  exception when others then
    v_ok := (sqlerrm = 'account_already_linked');
    v_msg := 'erreur attendue account_already_linked, obtenue : ' || sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('K07 ' || coalesce(v_msg, '')); end if;

  -- ===================================================================
  -- K08 — Limitation de debit : 5 recherches par heure (D-103).
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_rachid::text, 'role', 'authenticated')::text, true);
  v_msg := null;
  v_ok  := true;
  for v_i in 1..5 loop
    begin
      perform 1 from public.search_claimable_profiles('Mensah', null, null);
    exception when others then
      v_ok := false;
      v_msg := format('la recherche %s/5 a echoue : %s', v_i, sqlerrm);
    end;
  end loop;
  if v_ok then
    begin
      perform 1 from public.search_claimable_profiles('Mensah', null, null);
      v_ok := false;
      v_msg := '6e recherche acceptee dans la meme heure';
    exception when others then
      v_ok := (sqlerrm = 'rate_limited');
      v_msg := 'erreur attendue rate_limited, obtenue : ' || sqlerrm;
    end;
  end if;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('K08 ' || coalesce(v_msg, '')); end if;

  -- ===================================================================
  -- K09 a K11 — ISE-007 : approbation AUTOMATIQUE par e-mail historique.
  -- Gina a l'adresse historique de Koffi et son compte est confirme.
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_gina::text, 'role', 'authenticated')::text, true);

  v_msg := null;
  begin
    select r.claim_status, r.auto_approved into v_txt, v_ok
    from public.submit_profile_claim(p_koffi, 'historical_email', '{}'::jsonb) r;
    v_ok := coalesce(v_ok, false) and v_txt = 'approved';
    v_msg := format('statut %s, auto_approved %s', coalesce(v_txt, '(null)'), v_ok);
  exception when others then
    v_ok := false;
    v_msg := 'soumission refusee : ' || sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('K09 approbation automatique attendue : ' || coalesce(v_msg, '')); end if;

  perform set_config('role', 'postgres', true);
  select count(*) into v_n
  from public.ise_profiles p
  where p.id = p_koffi
    and p.user_id = u_gina
    and p.claim_status = 'claimed'
    and p.profile_status = 'active'
    and p.verification_status = 'verified'
    and p.verification_level = 'email'
    and p.claimed_at is not null;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || 'K10 le profil n''est pas passe en reclame/actif/verifie apres approbation automatique'; end if;

  select count(*) into v_n
  from private.user_roles ur
  join private.roles r on r.id = ur.role_id
  where ur.profile_id = p_koffi and r.code = 'member';
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('K11 role member non attribue (%s ligne(s))', v_n); end if;

  select count(*) into v_n
  from public.domain_events e
  where e.event_type = 'profile.claimed' and e.aggregate_id = p_koffi;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('K11b evenement profile.claimed absent ou duplique (%s)', v_n); end if;

  -- ===================================================================
  -- K12 / K13 — Revue humaine quand l'e-mail ne correspond pas.
  -- Hugo reclame Lamine : aucune correspondance d'adresse.
  -- ===================================================================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_hugo::text, 'role', 'authenticated')::text, true);

  v_msg := null;
  begin
    select r.claim_id, r.claim_status, r.auto_approved into v_claim_hugo, v_txt, v_ok
    from public.submit_profile_claim(p_lamine, 'document', '{"note":"piece jointe deposee"}'::jsonb) r;
    v_ok := (v_txt = 'submitted') and not coalesce(v_ok, true);
    v_msg := format('statut %s', coalesce(v_txt, '(null)'));
  exception when others then
    v_ok := false;
    v_msg := 'soumission refusee : ' || sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('K12 revue humaine attendue : ' || coalesce(v_msg, '')); end if;

  perform set_config('role', 'postgres', true);
  select count(*) into v_n
  from public.ise_profiles p
  where p.id = p_lamine and p.claim_status = 'claim_pending' and p.user_id is null;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || 'K13 le profil aurait du passer en claim_pending sans etre rattache'; end if;

  -- ===================================================================
  -- K14 — Double reclamation du meme profil : Karim vise Koffi, deja reclame.
  -- ===================================================================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_karim::text, 'role', 'authenticated')::text, true);
  v_msg := null;
  begin
    perform 1 from public.submit_profile_claim(p_koffi, 'document', '{}'::jsonb);
    v_ok := false;
    v_msg := 'seconde reclamation acceptee sur un profil deja reclame';
  exception when others then
    v_ok := (sqlerrm = 'profile_already_claimed');
    v_msg := 'erreur attendue profile_already_claimed, obtenue : ' || sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('K14 ' || coalesce(v_msg, '')); end if;

  -- ===================================================================
  -- K15 — Gina est desormais rattachee a Koffi : elle ne peut pas
  --       reclamer un second profil (D-20).
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_gina::text, 'role', 'authenticated')::text, true);
  v_msg := null;
  begin
    perform 1 from public.submit_profile_claim(p_omar, 'document', '{}'::jsonb);
    v_ok := false;
    v_msg := 'un compte deja rattache a obtenu un second profil';
  exception when others then
    v_ok := (sqlerrm = 'account_already_linked');
    v_msg := 'erreur attendue account_already_linked, obtenue : ' || sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('K15 ' || coalesce(v_msg, '')); end if;

  -- ===================================================================
  -- K16 — Une seule reclamation en cours par compte.
  --       Karim reclame Nadia, puis tente Omar.
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_karim::text, 'role', 'authenticated')::text, true);
  select r.claim_id into v_claim_karim
  from public.submit_profile_claim(p_nadia, 'promotion_manager', '{}'::jsonb) r;

  v_msg := null;
  begin
    perform 1 from public.submit_profile_claim(p_omar, 'document', '{}'::jsonb);
    v_ok := false;
    v_msg := 'deux reclamations en cours acceptees pour le meme compte';
  exception when others then
    v_ok := (sqlerrm = 'claim_already_pending');
    v_msg := 'erreur attendue claim_already_pending, obtenue : ' || sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('K16 ' || coalesce(v_msg, '')); end if;

  -- ===================================================================
  -- K17 — Ines est membre mais ne porte pas `profiles.verify`.
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_ines::text, 'role', 'authenticated')::text, true);
  v_msg := null;
  begin
    perform public.approve_profile_claim(v_claim_hugo);
    v_ok := false;
    v_msg := 'approbation acceptee sans la permission profiles.verify';
  exception when others then
    v_ok := (sqlerrm = 'not_authorized');
    v_msg := 'erreur attendue not_authorized, obtenue : ' || sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('K17 ' || coalesce(v_msg, '')); end if;

  -- K19 — ... ni rejeter.
  v_msg := null;
  begin
    perform public.reject_profile_claim(v_claim_karim, 'motif de test');
    v_ok := false;
    v_msg := 'rejet accepte sans la permission profiles.verify';
  exception when others then
    v_ok := (sqlerrm = 'not_authorized');
    v_msg := 'erreur attendue not_authorized, obtenue : ' || sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('K19 ' || coalesce(v_msg, '')); end if;

  -- ===================================================================
  -- K18 — Jules porte `profiles.verify` : il approuve la demande de Hugo.
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_jules::text, 'role', 'authenticated')::text, true);
  v_msg := null;
  begin
    perform public.approve_profile_claim(v_claim_hugo);
    v_ok := true;
  exception when others then
    v_ok := false;
    v_msg := 'approbation refusee a un porteur de profiles.verify : ' || sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('K18 ' || coalesce(v_msg, '')); end if;

  perform set_config('role', 'postgres', true);
  select count(*) into v_n
  from public.ise_profiles p
  where p.id = p_lamine and p.user_id = u_hugo and p.claim_status = 'claimed'
    and p.profile_status = 'active'
    -- La revue humaine ne prouve PAS l'adresse : aucune verification `email`.
    and p.verification_status <> 'verified';
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || 'K18b l''approbation humaine n''a pas produit l''etat attendu'; end if;

  -- ===================================================================
  -- K20 — Rejet par Jules : le profil de Nadia redevient reclamable.
  -- ===================================================================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_jules::text, 'role', 'authenticated')::text, true);
  v_msg := null;
  begin
    perform public.reject_profile_claim(v_claim_karim, 'piece justificative illisible');
    v_ok := true;
  exception when others then
    v_ok := false;
    v_msg := 'rejet refuse a un porteur de profiles.verify : ' || sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('K20 ' || coalesce(v_msg, '')); end if;

  perform set_config('role', 'postgres', true);
  select count(*) into v_n
  from public.ise_profiles p
  where p.id = p_nadia and p.claim_status = 'unclaimed' and p.user_id is null;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || 'K20b le profil rejete n''est pas redevenu reclamable'; end if;

  -- ===================================================================
  -- K21 — get_claimable_profile ne renvoie rien sur un profil reclame.
  -- ===================================================================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_karim::text, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.get_claimable_profile(p_koffi);
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('K21 get_claimable_profile renvoie %s ligne(s) sur un profil reclame', v_n); end if;

  select count(*) into v_n from public.get_claimable_profile(p_omar);
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('K21b get_claimable_profile ne renvoie pas le profil reclamable (%s)', v_n); end if;

  -- ===================================================================
  -- K22 — my_profile_claim() ne renvoie que MA reclamation.
  -- ===================================================================
  select c.profile_id into v_uuid from public.my_profile_claim() c;
  v_cases := v_cases + 1;
  if v_uuid is distinct from p_nadia then
    v_fail := v_fail || format('K22 my_profile_claim() renvoie %s au lieu de la reclamation de Karim', coalesce(v_uuid::text, '(null)'));
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', u_hugo::text, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.my_profile_claim() c where c.claim_id = v_claim_karim;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || 'K22b my_profile_claim() a renvoye la reclamation d''un autre compte'; end if;

  -- ===================================================================
  -- K23 — Ligne de base de securite inchangee apres 0029.
  -- ===================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  select count(*) into v_n from private.security_baseline_violations();
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('K23 security_baseline_violations() renvoie %s ligne(s)', v_n); end if;

  -- ===================================================================
  -- RAPPORT + ROLLBACK
  -- ===================================================================
  if array_length(v_fail, 1) is null then
    raise exception 'CLAIM_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'CLAIM_TESTS_FAILED: % cas, % echec(s)\n  - %',
      v_cases, array_length(v_fail, 1), array_to_string(v_fail, E'\n  - ');
  end if;
end
$claim$;
