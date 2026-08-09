-- =====================================================================
-- supabase/tests/rls/0032_profile_extras_suite.sql
--
-- Suite de tests RLS NEGATIFS de la tranche « Profil ISE-024 -> ISE-033 »
-- (projets, langues/outils/zones, recommandations, disponibilite).
-- MASTER PROMPT §80 : « une politique RLS non testee n'est pas terminee ».
--
-- Meme modele auto-nettoyant que 0001 a 0031 : un unique bloc DO, des
-- fixtures creees sous `postgres` (BYPASSRLS), des assertions executees
-- en changeant d'identite, et une exception finale qui annule TOUT.
--
--   succes  ->  ERROR:  P0001: PROFILE_EXTRAS_TESTS_OK: N cas, 0 echec
--   echec   ->  ERROR:  P0001: PROFILE_EXTRAS_TESTS_FAILED: N cas, K echec(s)
--
-- Verdict du 9 aout 2026 : PROFILE_EXTRAS_TESTS_OK: 19 cas, 0 echec.
--
-- FIXTURES (D-104 : is_test_account = true, e-mails prefixes `test+`)
--   Nadia   membre actif, en relation avec Omar
--   Omar    membre actif, en relation avec Nadia
--   Sarah   membre actif, SANS relation avec Nadia ni Omar
--   Idris   profil ARCHIVE (invisible : can_see_profile = false)
-- =====================================================================

do $extras$
declare
  u_nadia uuid := '00000000-0000-4000-8000-0000000005a1';
  u_omar  uuid := '00000000-0000-4000-8000-0000000005a2';
  u_sarah uuid := '00000000-0000-4000-8000-0000000005a3';
  u_idris uuid := '00000000-0000-4000-8000-0000000005a4';
  p_nadia uuid := '00000000-0000-4000-8000-0000000006a1';
  p_omar  uuid := '00000000-0000-4000-8000-0000000006a2';
  p_sarah uuid := '00000000-0000-4000-8000-0000000006a3';
  p_idris uuid := '00000000-0000-4000-8000-0000000006a4';

  x_proj_priv uuid := '00000000-0000-4000-8000-0000000007a1';
  x_proj_pub  uuid := '00000000-0000-4000-8000-0000000007a2';
  x_req       uuid := '00000000-0000-4000-8000-0000000007a3';
  x_rec       uuid;

  v_promotion bigint;
  v_skill     bigint;
  v_lang      varchar(10);
  v_tool      bigint;

  v_cases  integer := 0;
  v_fail   text[]  := array[]::text[];
  v_n      bigint;
  v_ok     boolean;
  v_msg    text;
  v_status text;
  v_body   text;
begin
  -- ===================================================================
  -- FIXTURES
  -- ===================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  select id into v_promotion from public.promotions order by graduation_year desc limit 1;
  select id into v_skill from public.skills where is_active order by id limit 1;
  select code into v_lang from public.languages where is_active order by sort_order limit 1;
  select id into v_tool from public.tools where is_active order by id limit 1;

  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', u_nadia, 'authenticated', 'authenticated', 'test+extras.nadia@ise.test', now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_omar,  'authenticated', 'authenticated', 'test+extras.omar@ise.test',  now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_sarah, 'authenticated', 'authenticated', 'test+extras.sarah@ise.test', now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_idris, 'authenticated', 'authenticated', 'test+extras.idris@ise.test', now(), now());

  insert into public.ise_profiles
    (id, user_id, promotion_id, first_name, last_name, profile_status, claim_status, claimed_at, is_test_account)
  values
    (p_nadia, u_nadia, v_promotion, 'Nadia', 'Extras', 'active',   'claimed', now(), true),
    (p_omar,  u_omar,  v_promotion, 'Omar',  'Extras', 'active',   'claimed', now(), true),
    (p_sarah, u_sarah, v_promotion, 'Sarah', 'Extras', 'active',   'claimed', now(), true),
    -- Idris est ARCHIVE : private.can_see_profile() le refuse a tout tiers.
    (p_idris, u_idris, v_promotion, 'Idris', 'Extras', 'archived', 'claimed', now(), true);

  insert into public.connections (profile_a_id, profile_b_id)
  values (least(p_nadia, p_omar), greatest(p_nadia, p_omar));

  -- Projets d'Omar : un prive, un ouvert aux membres (D-73, par entree).
  insert into public.profile_projects (id, profile_id, title, visibility)
  values
    (x_proj_priv, p_omar, 'Projet confidentiel d''Omar', 'private'),
    (x_proj_pub,  p_omar, 'Projet visible d''Omar',      'members');

  -- Langues et outils du profil archive d'Idris : ne doivent pas fuir.
  insert into public.profile_languages (profile_id, language_code, proficiency)
  values (p_idris, v_lang, 'native');
  insert into public.profile_tools (profile_id, tool_id)
  values (p_idris, v_tool);

  -- Demande de recommandation REELLE : Nadia sollicite Omar.
  insert into public.recommendation_requests
    (id, requester_profile_id, recipient_profile_id, skill_id, context, message)
  values
    (x_req, p_nadia, p_omar, v_skill, 'Collaboration projet — 2024',
     'Peux-tu témoigner de ma contribution au dispositif de suivi ?');

  -- ===================================================================
  -- Sarah authentifiee (aucune relation).
  -- ===================================================================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_sarah::text, 'role', 'authenticated')::text, true);

  -- X01 — le projet `private` d'Omar est invisible pour un tiers.
  select count(*) into v_n from public.profile_projects where id = x_proj_priv;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('X01 projet private d''un tiers visible (%s)', v_n); end if;

  -- X02 — controle positif : le projet `members` d'Omar est visible.
  select count(*) into v_n from public.profile_projects where id = x_proj_pub;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('X02 projet members d''un tiers invisible (%s)', v_n); end if;

  -- X03 — reecrire le projet d'un tiers.
  update public.profile_projects set title = 'detourne' where id = x_proj_pub;
  get diagnostics v_n = row_count;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('X03 projet d''un tiers modifie (%s ligne(s))', v_n); end if;

  -- X04 — les langues d'un profil archive ne fuient pas.
  select count(*) into v_n from public.profile_languages where profile_id = p_idris;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('X04 langues d''un profil invisible visibles (%s)', v_n); end if;

  -- X05 — les outils d'un profil archive ne fuient pas.
  select count(*) into v_n from public.profile_tools where profile_id = p_idris;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('X05 outils d''un profil invisible visibles (%s)', v_n); end if;

  -- X06 — usurpation : Sarah depose une demande AU NOM de Nadia.
  v_msg := null;
  begin
    insert into public.recommendation_requests
      (requester_profile_id, recipient_profile_id, message)
    values (p_nadia, p_omar, 'usurpation');
    v_ok := false;
    v_msg := 'insertion acceptee';
  exception when others then
    v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('X06 demande usurpant le demandeur acceptee : ' || coalesce(v_msg, '')); end if;

  -- X07 — la demande Nadia -> Omar n'est pas lisible par un tiers.
  select count(*) into v_n from public.recommendation_requests where id = x_req;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('X07 demande d''un tiers visible (%s)', v_n); end if;

  -- ===================================================================
  -- Nadia (demandeuse) : elle ne peut pas s'auto-accepter.
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_nadia::text, 'role', 'authenticated')::text, true);

  -- X08 — le demandeur ne peut pas marquer sa propre demande « accepted ».
  v_msg := null;
  begin
    update public.recommendation_requests set status = 'accepted' where id = x_req;
    get diagnostics v_n = row_count;
    v_ok := (v_n = 0);
    v_msg := format('%s ligne(s) modifiee(s)', v_n);
  exception when others then
    v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('X08 demandeur s''auto-accepte : ' || coalesce(v_msg, '')); end if;

  -- ===================================================================
  -- Omar (destinataire) : accepter = ECRIRE la recommandation.
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_omar::text, 'role', 'authenticated')::text, true);

  -- X09 — acceptation par la fonction de transition : brouillon cree.
  v_msg := null;
  begin
    select public.respond_recommendation_request(
      x_req, 'accept',
      'Nadia a structuré le dispositif de suivi avec beaucoup de rigueur et de clarté.',
      'Collaboration projet — 2024', null, null, 'members') into x_rec;
    v_ok := (x_rec is not null);
  exception when others then
    v_ok := false;
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('X09 acceptation refusee : ' || coalesce(v_msg, '')); end if;

  perform set_config('role', 'postgres', true);
  select status into v_status from public.recommendations where id = x_rec;
  perform set_config('role', 'authenticated', true);
  v_cases := v_cases + 1;
  if v_status is distinct from 'draft' then
    v_fail := v_fail || format('X09b la recommandation ne nait pas brouillon (%s)', coalesce(v_status, 'NULL'));
  end if;

  -- X10 — l'auteur ne peut pas s'auto-publier : le sujet valide.
  v_msg := null;
  begin
    update public.recommendations set status = 'published' where id = x_rec;
    get diagnostics v_n = row_count;
    v_ok := (v_n = 0);
    v_msg := format('%s ligne(s)', v_n);
  exception when others then
    v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('X10 auteur auto-publie : ' || coalesce(v_msg, '')); end if;

  -- ===================================================================
  -- Nadia (sujet) : valider, masquer — jamais reecrire.
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_nadia::text, 'role', 'authenticated')::text, true);

  -- X11 — le sujet valide le brouillon (draft -> published).
  v_msg := null;
  begin
    update public.recommendations set status = 'published' where id = x_rec;
    get diagnostics v_n = row_count;
    v_ok := (v_n = 1);
    v_msg := format('%s ligne(s)', v_n);
  exception when others then
    v_ok := false;
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('X11 validation par le sujet refusee : ' || coalesce(v_msg, '')); end if;

  -- X12 — le sujet ne peut pas REECRIRE le temoignage d'un tiers.
  v_msg := null;
  begin
    update public.recommendations
       set body = 'Texte réécrit par le sujet, ce qui ne doit jamais être possible ici.'
     where id = x_rec;
    get diagnostics v_n = row_count;
    v_ok := (v_n = 0);
    v_msg := format('%s ligne(s) reecrite(s)', v_n);
  exception when others then
    v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then v_fail := v_fail || ('X12 sujet a reecrit la recommandation : ' || coalesce(v_msg, '')); end if;

  perform set_config('role', 'postgres', true);
  select body into v_body from public.recommendations where id = x_rec;
  perform set_config('role', 'authenticated', true);
  v_cases := v_cases + 1;
  if v_body is distinct from 'Nadia a structuré le dispositif de suivi avec beaucoup de rigueur et de clarté.' then
    v_fail := v_fail || 'X12b le texte de la recommandation a ete altere';
  end if;

  -- X13 — controle positif : Sarah voit la recommandation PUBLIEE.
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_sarah::text, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.recommendations where id = x_rec;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('X13 recommandation publiee invisible d''un membre (%s)', v_n); end if;

  -- X14 — le sujet masque (published -> hidden).
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_nadia::text, 'role', 'authenticated')::text, true);
  update public.recommendations set status = 'hidden' where id = x_rec;
  get diagnostics v_n = row_count;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || format('X14 masquage par le sujet refuse (%s ligne(s))', v_n); end if;

  -- X15 — une recommandation masquee ne fuit pas vers un tiers.
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_sarah::text, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.recommendations where id = x_rec;
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('X15 recommandation masquee visible d''un tiers (%s)', v_n); end if;

  -- ===================================================================
  -- Garde-fous globaux (MASTER PROMPT §80).
  -- ===================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  select count(*) into v_n from private.security_baseline_violations();
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('X16 security_baseline_violations() renvoie %s ligne(s)', v_n); end if;

  select count(*) into v_n from private.tables_without_rls();
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('X17 tables_without_rls() renvoie %s ligne(s)', v_n); end if;

  -- ===================================================================
  -- RAPPORT + ROLLBACK
  -- ===================================================================
  if array_length(v_fail, 1) is null then
    raise exception 'PROFILE_EXTRAS_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'PROFILE_EXTRAS_TESTS_FAILED: % cas, % echec(s)\n  - %',
      v_cases, array_length(v_fail, 1), array_to_string(v_fail, E'\n  - ');
  end if;
end
$extras$;
