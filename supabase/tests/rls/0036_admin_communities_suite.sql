-- 0036_admin_communities_suite.sql
-- SA-027->029 : communautes (admin) — liste tous statuts/visibilites,
-- creation, edition, cycle de vie, moderation des publications et
-- commentaires (motif obligatoire, journalisation).
-- succes -> ERROR: P0001: SA027_029_TESTS_OK: N cas, 0 echec

do $sa027029$
declare
  v_admin_auth uuid := '28708d27-78f4-4bc9-bdb3-ead2ce5e5612'; -- bootstrap admin (blyped@gmail.com)
  v_admin_profile uuid;
  u_member uuid := '00000000-0000-4000-9027-000000000002';
  v_member_profile uuid;
  v_promo_id bigint;
  v_bogus uuid := '00000000-0000-4000-9027-000000000099';
  v_community jsonb;
  v_community_id uuid;
  v_target_id uuid;
  v_list jsonb;
  v_upd jsonb;
  v_set jsonb;
  v_post_id uuid;
  v_comment_id uuid;
  v_post_list jsonb;
  v_mod jsonb;
  v_fail text[] := array[]::text[];
  v_cases integer := 0;
  v_n bigint;
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  insert into auth.users (id, email) values (u_member, 'sa027-member@example.test')
    on conflict (id) do nothing;

  insert into public.promotions (name, graduation_year, status) values ('Promo Test Communautes RLS', 2098, 'active')
  returning id into v_promo_id;

  insert into public.ise_profiles (promotion_id, first_name, last_name, profile_type, profile_status, claim_status, verification_status, user_id, claimed_at)
  values (v_promo_id, 'Membre', 'Ordinaire', 'graduate', 'active', 'claimed', 'unverified', u_member, now()) returning id into v_member_profile;

  -- ===== 1. Refus sans permission (identite membre ordinaire) =====
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_member::text, 'role', 'authenticated')::text, true);

  begin
    perform public.admin_list_communities(null, null, null, null, null, 20);
    v_fail := v_fail || 'S01 liste communautes accessible sans communities.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S01 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_create_community('Titre interdit', 'titre-interdit', 'Description', 'thematic');
    v_fail := v_fail || 'S02 creation communaute accessible sans communities.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S02 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_update_community(v_bogus, 'Nom', 'Description');
    v_fail := v_fail || 'S03 edition communaute accessible sans communities.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S03 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_set_community_status(v_bogus, 'inactive', null);
    v_fail := v_fail || 'S04 statut communaute accessible sans communities.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S04 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_list_community_posts(v_bogus, null, null, null, 20);
    v_fail := v_fail || 'S05 liste publications accessible sans communities.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S05 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_moderate_community_post(v_bogus, 'hide', 'motif de test suffisant');
    v_fail := v_fail || 'S06 moderation publication accessible sans communities.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S06 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_moderate_community_comment(v_bogus, 'hide', 'motif de test suffisant');
    v_fail := v_fail || 'S07 moderation commentaire accessible sans communities.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S07 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- ===== 2. Cote admin (bootstrap admin reel) =====
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_auth::text, 'role', 'authenticated')::text, true);
  select private.current_profile_id() into v_admin_profile;

  -- S08 : creation reussie (communaute thematique, active).
  select to_jsonb(public.admin_create_community(
    'Communaute Test RLS', 'communaute-test-rls', 'Description de test', 'thematic',
    null, null, null, 'Objectif de test', 'Charte de test', 'network', 'open', 'immediate', 'active'
  )) into v_community;
  v_community_id := (v_community->>'id')::uuid;
  v_cases := v_cases + 1;
  if v_community_id is null or (v_community->>'status') <> 'active' or (v_community->>'created_by_profile_id') <> v_admin_profile::text then
    v_fail := v_fail || 'S08 creation communaute echouee ou champs incorrects'::text;
  end if;

  -- S09 : champ obligatoire manquant refuse.
  begin
    perform public.admin_create_community('', 'slug-vide', 'Description', 'thematic');
    v_fail := v_fail || 'S09 creation avec nom vide aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'community_missing_required_field' then v_fail := v_fail || ('S09 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S10 : slug invalide refuse.
  begin
    perform public.admin_create_community('Nom Valide', 'Slug Invalide !', 'Description', 'thematic');
    v_fail := v_fail || 'S10 creation avec slug invalide aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'invalid_slug' then v_fail := v_fail || ('S10 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S11 : slug deja utilise refuse.
  begin
    perform public.admin_create_community('Autre nom', 'communaute-test-rls', 'Description', 'thematic');
    v_fail := v_fail || 'S11 creation avec slug deja utilise aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'slug_already_exists' then v_fail := v_fail || ('S11 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S12 : discriminant manquant (type country sans country_code) refuse.
  begin
    perform public.admin_create_community('Communaute Pays', 'communaute-pays-test', 'Description', 'country');
    v_fail := v_fail || 'S12 creation type country sans country_code aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'community_discriminant_required' then v_fail := v_fail || ('S12 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S13 : creation d'une communaute privee en brouillon (visible seulement de l'admin).
  select to_jsonb(public.admin_create_community(
    'Communaute Privee Brouillon', 'communaute-privee-brouillon', 'Description privee', 'special',
    null, null, null, null, null, 'private', 'invitation', 'pre_approval', 'draft'
  )) into v_community;
  v_target_id := (v_community->>'id')::uuid;
  v_cases := v_cases + 1;
  if v_target_id is null or (v_community->>'status') <> 'draft' or (v_community->>'visibility') <> 'private' then
    v_fail := v_fail || 'S13 creation communaute privee/brouillon incorrecte'::text;
  end if;

  -- S14 : admin_list_communities avec filtre statut='draft' retrouve la communaute privee.
  select public.admin_list_communities('draft', null, null, null, null, 25) into v_list;
  select count(*) into v_n from jsonb_array_elements(v_list->'rows') r where (r->>'community_id')::uuid = v_target_id;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || 'S14 communaute privee/brouillon absente de admin_list_communities'::text; end if;

  -- S15 : admin_list_communities avec filtre visibilite='private' la retrouve aussi.
  select public.admin_list_communities(null, null, 'private', null, null, 25) into v_list;
  select count(*) into v_n from jsonb_array_elements(v_list->'rows') r where (r->>'community_id')::uuid = v_target_id;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || 'S15 communaute privee absente du filtre visibilite'::text; end if;

  -- S16 : edition du contenu.
  select to_jsonb(public.admin_update_community(
    v_community_id, 'Communaute Test RLS (modifiee)', 'Description modifiee', 'Nouvel objectif', 'Nouvelle charte',
    'network', 'request', 'pre_approval'
  )) into v_upd;
  v_cases := v_cases + 1;
  if (v_upd->>'name') <> 'Communaute Test RLS (modifiee)' or (v_upd->>'join_policy') <> 'request' then
    v_fail := v_fail || 'S16 edition de la communaute incorrecte'::text;
  end if;

  -- S17 : edition d'une communaute inexistante refusee.
  begin
    perform public.admin_update_community(v_bogus, 'Nom', 'Description');
    v_fail := v_fail || 'S17 edition d''une communaute inexistante aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'community_not_found' then v_fail := v_fail || ('S17 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S18 : transition de statut active -> inactive.
  select to_jsonb(public.admin_set_community_status(v_community_id, 'inactive', null)) into v_set;
  v_cases := v_cases + 1;
  if (v_set->>'status') <> 'inactive' then
    v_fail := v_fail || 'S18 transition active -> inactive incorrecte'::text;
  end if;

  -- S19 : statut invalide refuse.
  begin
    perform public.admin_set_community_status(v_community_id, 'not_a_status', null);
    v_fail := v_fail || 'S19 statut invalide aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'invalid_status' then v_fail := v_fail || ('S19 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S20 : fusion sans cible refusee.
  begin
    perform public.admin_set_community_status(v_community_id, 'merged', null);
    v_fail := v_fail || 'S20 fusion sans cible aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'community_merge_target_required' then v_fail := v_fail || ('S20 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S21 : fusion avec cible valide reussie.
  select to_jsonb(public.admin_set_community_status(v_community_id, 'merged', v_target_id)) into v_set;
  v_cases := v_cases + 1;
  if (v_set->>'status') <> 'merged' or (v_set->>'merged_into_community_id') <> v_target_id::text then
    v_fail := v_fail || 'S21 fusion avec cible valide incorrecte'::text;
  end if;

  -- Remise en 'active' pour la suite des tests (publications/moderation).
  perform public.admin_set_community_status(v_community_id, 'active', null);

  -- S22 : transition sur communaute inexistante refusee.
  begin
    perform public.admin_set_community_status(v_bogus, 'active', null);
    v_fail := v_fail || 'S22 transition sur communaute inexistante aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'community_not_found' then v_fail := v_fail || ('S22 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- ===== 3. Publications & commentaires (insertion directe, aucun RPC
  -- membre n'est en cause ici) puis moderation admin. =====
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  insert into public.community_posts (community_id, author_profile_id, post_type, title, body, status, published_at)
  values (v_community_id, v_member_profile, 'question', 'Question de test RLS SA-027', 'Corps du message de test', 'published', now())
  returning id into v_post_id;
  insert into public.community_comments (post_id, author_profile_id, body, status)
  values (v_post_id, v_member_profile, 'Reponse de test RLS SA-027', 'published')
  returning id into v_comment_id;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_auth::text, 'role', 'authenticated')::text, true);

  -- S23 : liste des publications d'une communaute inexistante refusee.
  begin
    perform public.admin_list_community_posts(v_bogus, null, null, null, 20);
    v_fail := v_fail || 'S23 liste publications d''une communaute inexistante aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'community_not_found' then v_fail := v_fail || ('S23 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S24 : le billet publie apparait dans admin_list_community_posts.
  select public.admin_list_community_posts(v_community_id, null, null, null, 25) into v_post_list;
  select count(*) into v_n from jsonb_array_elements(v_post_list->'rows') r where (r->>'post_id')::uuid = v_post_id;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || 'S24 billet absent de admin_list_community_posts'::text; end if;

  -- S25 : motif trop court refuse (5 caracteres, sous le seuil de 10).
  begin
    perform public.admin_moderate_community_post(v_post_id, 'hide', 'court');
    v_fail := v_fail || 'S25 motif trop court aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'reason_required' then v_fail := v_fail || ('S25 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S26 : masquage reussi.
  select to_jsonb(public.admin_moderate_community_post(v_post_id, 'hide', 'Contenu hors charte signale par un membre')) into v_mod;
  v_cases := v_cases + 1;
  if (v_mod->>'status') <> 'hidden' then v_fail := v_fail || 'S26 masquage du billet incorrect'::text; end if;

  -- S27 : masquage d'un billet deja masque refuse.
  begin
    perform public.admin_moderate_community_post(v_post_id, 'hide', 'Deuxieme tentative de masquage');
    v_fail := v_fail || 'S27 masquage d''un billet deja masque aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'invalid_moderation_action' then v_fail := v_fail || ('S27 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S28 : restauration depuis 'hidden' -> journalisee 'unhide'.
  select to_jsonb(public.admin_moderate_community_post(v_post_id, 'restore', 'Verification faite, contenu conforme')) into v_mod;
  v_cases := v_cases + 1;
  if (v_mod->>'status') <> 'published' then v_fail := v_fail || 'S28 restauration du billet incorrecte'::text; end if;
  select count(*) into v_n from public.community_moderation_actions
   where target_post_id = v_post_id and action = 'unhide';
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || 'S28b action journalisee unhide absente ou dupliquee'::text; end if;

  -- S29 : retrait definitif.
  select to_jsonb(public.admin_moderate_community_post(v_post_id, 'remove', 'Contenu commercial non sollicite')) into v_mod;
  v_cases := v_cases + 1;
  if (v_mod->>'status') <> 'removed' then v_fail := v_fail || 'S29 retrait du billet incorrect'::text; end if;

  -- S30 : restauration depuis 'removed' -> journalisee 'restore'.
  select to_jsonb(public.admin_moderate_community_post(v_post_id, 'restore', 'Erreur de qualification, restaure')) into v_mod;
  v_cases := v_cases + 1;
  if (v_mod->>'status') <> 'published' then v_fail := v_fail || 'S30 restauration depuis removed incorrecte'::text; end if;
  select count(*) into v_n from public.community_moderation_actions
   where target_post_id = v_post_id and action = 'restore';
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || 'S30b action journalisee restore absente ou dupliquee'::text; end if;

  -- S31 : verrouillage.
  select to_jsonb(public.admin_moderate_community_post(v_post_id, 'lock', 'Discussion qui derape, verrouillee')) into v_mod;
  v_cases := v_cases + 1;
  if (v_mod->>'is_locked')::boolean is not true then v_fail := v_fail || 'S31 verrouillage du billet incorrect'::text; end if;

  -- S32 : verrouillage d'un billet deja verrouille refuse.
  begin
    perform public.admin_moderate_community_post(v_post_id, 'lock', 'Deuxieme tentative de verrouillage');
    v_fail := v_fail || 'S32 verrouillage d''un billet deja verrouille aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'invalid_moderation_action' then v_fail := v_fail || ('S32 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S33 : deverrouillage.
  select to_jsonb(public.admin_moderate_community_post(v_post_id, 'unlock', 'Discussion apaisee, deverrouillee')) into v_mod;
  v_cases := v_cases + 1;
  if (v_mod->>'is_locked')::boolean is not false then v_fail := v_fail || 'S33 deverrouillage du billet incorrect'::text; end if;

  -- S34 : toutes les actions de moderation du billet sont journalisees avec le bon acteur.
  select count(*) into v_n from public.community_moderation_actions
   where target_post_id = v_post_id and actor_profile_id = v_admin_profile and target_type = 'post';
  v_cases := v_cases + 1;
  -- 6 actions reussies : hide (S26), unhide (S28), remove (S29), restore (S30), lock (S31), unlock (S33).
  if v_n <> 6 then v_fail := v_fail || ('S34 nombre d''actions de moderation du billet inattendu (' || v_n || ')')::text; end if;

  -- ===== 4. Moderation d'un commentaire =====

  -- S35 : commentaire inexistant refuse.
  begin
    perform public.admin_moderate_community_comment(v_bogus, 'hide', 'Motif suffisamment long pour le test');
    v_fail := v_fail || 'S35 moderation d''un commentaire inexistant aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'community_comment_not_found' then v_fail := v_fail || ('S35 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S36 : masquage reussi.
  select to_jsonb(public.admin_moderate_community_comment(v_comment_id, 'hide', 'Commentaire hors sujet signale')) into v_mod;
  v_cases := v_cases + 1;
  if (v_mod->>'status') <> 'hidden' then v_fail := v_fail || 'S36 masquage du commentaire incorrect'::text; end if;

  -- S37 : masquage d'un commentaire deja masque refuse.
  begin
    perform public.admin_moderate_community_comment(v_comment_id, 'hide', 'Deuxieme tentative de masquage');
    v_fail := v_fail || 'S37 masquage d''un commentaire deja masque aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'invalid_moderation_action' then v_fail := v_fail || ('S37 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S38 : restauration -> journalisee 'unhide'.
  select to_jsonb(public.admin_moderate_community_comment(v_comment_id, 'restore', 'Verification faite, conforme')) into v_mod;
  v_cases := v_cases + 1;
  if (v_mod->>'status') <> 'published' then v_fail := v_fail || 'S38 restauration du commentaire incorrecte'::text; end if;

  -- S39 : retrait definitif.
  select to_jsonb(public.admin_moderate_community_comment(v_comment_id, 'remove', 'Propos inappropries confirmes')) into v_mod;
  v_cases := v_cases + 1;
  if (v_mod->>'status') <> 'removed' then v_fail := v_fail || 'S39 retrait du commentaire incorrect'::text; end if;

  -- S40 : les trois actions de moderation du commentaire sont journalisees.
  select count(*) into v_n from public.community_moderation_actions
   where target_comment_id = v_comment_id and actor_profile_id = v_admin_profile and target_type = 'comment';
  v_cases := v_cases + 1;
  if v_n <> 3 then v_fail := v_fail || ('S40 nombre d''actions de moderation du commentaire inattendu (' || v_n || ')')::text; end if;

  -- ===== 5. Nettoyage =====
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  delete from public.community_moderation_actions where community_id in (v_community_id, v_target_id);
  delete from public.community_comments where post_id = v_post_id;
  delete from public.community_posts where id = v_post_id;
  delete from public.communities where id in (v_community_id, v_target_id);
  delete from public.ise_profiles where id = v_member_profile;
  delete from public.promotions where id = v_promo_id;
  delete from auth.users where id = u_member;

  if array_length(v_fail, 1) is null then
    raise exception 'SA027_029_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'SA027_029_TESTS_FAILED: % cas, % echec(s)\n  - %', v_cases, array_length(v_fail, 1), array_to_string(v_fail, E'\n  - ');
  end if;
end;
$sa027029$;
