-- 0037_admin_events_suite.sql
-- SA-030->033 : evenements (admin) — liste tous statuts, creation,
-- edition, cycle de vie, suivi des inscriptions (presence constatee),
-- bilan organisateur et instantane d'impact calcule.
-- succes -> ERROR: P0001: SA030_033_TESTS_OK: N cas, 0 echec

do $sa030033$
declare
  v_admin_auth uuid := '28708d27-78f4-4bc9-bdb3-ead2ce5e5612'; -- bootstrap admin (blyped@gmail.com)
  v_admin_profile uuid;
  u_member uuid := '00000000-0000-4000-9030-000000000002';
  v_member_profile uuid;
  v_promo_id bigint;
  v_bogus uuid := '00000000-0000-4000-9030-000000000099';
  v_event jsonb;
  v_event_id uuid;
  v_upd jsonb;
  v_set jsonb;
  v_list jsonb;
  v_reg jsonb;
  v_followup jsonb;
  v_snapshot jsonb;
  v_fail text[] := array[]::text[];
  v_cases integer := 0;
  v_n bigint;
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  insert into auth.users (id, email) values (u_member, 'sa030-member@example.test')
    on conflict (id) do nothing;

  insert into public.promotions (name, graduation_year, status) values ('Promo Test Evenements RLS', 2099, 'active')
  returning id into v_promo_id;

  insert into public.ise_profiles (promotion_id, first_name, last_name, profile_type, profile_status, claim_status, verification_status, user_id, claimed_at)
  values (v_promo_id, 'Membre', 'Ordinaire', 'graduate', 'active', 'claimed', 'unverified', u_member, now()) returning id into v_member_profile;

  -- ===== 1. Refus sans permission (identite membre ordinaire) =====
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_member::text, 'role', 'authenticated')::text, true);

  begin
    perform public.admin_list_events(null, null, null, null, null, 20);
    v_fail := v_fail || 'S01 liste evenements accessible sans events.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S01 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_create_event('webinar', 'Titre interdit', 'titre-interdit', now() + interval '10 days', 'Africa/Abidjan');
    v_fail := v_fail || 'S02 creation evenement accessible sans events.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S02 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_update_event(v_bogus, 'Nom');
    v_fail := v_fail || 'S03 edition evenement accessible sans events.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S03 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_set_event_status(v_bogus, 'published', null);
    v_fail := v_fail || 'S04 statut evenement accessible sans events.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S04 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_list_event_registrations(v_bogus, null, null, 20);
    v_fail := v_fail || 'S05 liste inscriptions accessible sans events.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S05 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_set_event_registration_status(v_bogus, v_bogus, 'attended');
    v_fail := v_fail || 'S06 statut inscription accessible sans events.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S06 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_upsert_event_followup(v_bogus, 'resume');
    v_fail := v_fail || 'S07 bilan evenement accessible sans events.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S07 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_record_event_impact_snapshot(v_bogus);
    v_fail := v_fail || 'S08 instantane d''impact accessible sans events.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S08 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- ===== 2. Cote admin (bootstrap admin reel) =====
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_auth::text, 'role', 'authenticated')::text, true);
  select private.current_profile_id() into v_admin_profile;

  -- S09 : champ obligatoire manquant refuse (titre vide).
  begin
    perform public.admin_create_event('webinar', '', 'slug-vide', now() + interval '10 days', 'Africa/Abidjan');
    v_fail := v_fail || 'S09 creation avec titre vide aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'event_missing_required_field' then v_fail := v_fail || ('S09 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S10 : slug invalide refuse.
  begin
    perform public.admin_create_event('webinar', 'Titre Valide', 'Slug Invalide !', now() + interval '10 days', 'Africa/Abidjan');
    v_fail := v_fail || 'S10 creation avec slug invalide aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'invalid_slug' then v_fail := v_fail || ('S10 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S11 : type d'evenement inexistant refuse.
  begin
    perform public.admin_create_event('type-inexistant', 'Titre Valide', 'titre-valide-type', now() + interval '10 days', 'Africa/Abidjan');
    v_fail := v_fail || 'S11 creation avec event_type_code inexistant aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'invalid_event_type' then v_fail := v_fail || ('S11 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S12 : organisateur communaute sans identifiant refuse.
  begin
    perform public.admin_create_event(
      'webinar', 'Titre Valide', 'titre-valide-organisateur', now() + interval '10 days', 'Africa/Abidjan',
      p_organizer_type => 'community'
    );
    v_fail := v_fail || 'S12 creation organisateur communaute sans identifiant aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'event_organizer_target_required' then v_fail := v_fail || ('S12 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S13 : creation reussie (evenement en ligne, organisateur = l'admin lui-meme), toujours 'draft'.
  select to_jsonb(public.admin_create_event(
    'webinar', 'Webinaire Test RLS SA-030', 'webinaire-test-rls-sa030', now() + interval '10 days', 'Africa/Abidjan',
    p_organizer_type => 'profile', p_organizer_profile_id => v_admin_profile, p_format => 'online'
  )) into v_event;
  v_event_id := (v_event->>'id')::uuid;
  v_cases := v_cases + 1;
  if v_event_id is null or (v_event->>'status') <> 'draft' or (v_event->>'created_by_profile_id') <> v_admin_profile::text then
    v_fail := v_fail || 'S13 creation evenement echouee ou champs incorrects'::text;
  end if;

  -- S14 : slug deja utilise refuse (organisateur valide, seul le slug fait echouer).
  begin
    perform public.admin_create_event(
      'webinar', 'Autre titre', 'webinaire-test-rls-sa030', now() + interval '10 days', 'Africa/Abidjan',
      p_organizer_type => 'profile', p_organizer_profile_id => v_admin_profile
    );
    v_fail := v_fail || 'S14 creation avec slug deja utilise aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'slug_already_exists' then v_fail := v_fail || ('S14 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S15 : admin_list_events avec filtre statut='draft' retrouve l'evenement.
  select public.admin_list_events('draft', null, null, null, null, 25) into v_list;
  select count(*) into v_n from jsonb_array_elements(v_list->'rows') r where (r->>'event_id')::uuid = v_event_id;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || 'S15 evenement brouillon absent de admin_list_events'::text; end if;

  -- S16 : edition du contenu.
  select to_jsonb(public.admin_update_event(v_event_id, 'Webinaire Test RLS (modifie)', p_description => 'Description modifiee')) into v_upd;
  v_cases := v_cases + 1;
  if (v_upd->>'title') <> 'Webinaire Test RLS (modifie)' or (v_upd->>'description') <> 'Description modifiee' then
    v_fail := v_fail || 'S16 edition de l''evenement incorrecte'::text;
  end if;

  -- S17 : edition d'un evenement inexistant refusee.
  begin
    perform public.admin_update_event(v_bogus, 'Nom');
    v_fail := v_fail || 'S17 edition d''un evenement inexistant aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'event_not_found' then v_fail := v_fail || ('S17 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S18 : publication refusee tant que l'URL en ligne n'est pas renseignee (format='online').
  begin
    perform public.admin_set_event_status(v_event_id, 'published', null);
    v_fail := v_fail || 'S18 publication sans URL en ligne aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'event_missing_online_url' then v_fail := v_fail || ('S18 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S19 : apres avoir renseigne l'URL, la publication reussit.
  perform public.admin_update_event(v_event_id, 'Webinaire Test RLS (modifie)', p_online_url_private => 'https://visio.example.test/sa030');
  select to_jsonb(public.admin_set_event_status(v_event_id, 'published', null)) into v_set;
  v_cases := v_cases + 1;
  if (v_set->>'status') <> 'published' or (v_set->>'published_at') is null then
    v_fail := v_fail || 'S19 publication de l''evenement incorrecte'::text;
  end if;

  -- S20 : transition invalide refusee (published -> draft n'est pas une cible atteignable).
  begin
    perform public.admin_set_event_status(v_event_id, 'draft', null);
    v_fail := v_fail || 'S20 transition published -> draft aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'invalid_transition' then v_fail := v_fail || ('S20 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S21 : annulation sans motif refusee.
  begin
    perform public.admin_set_event_status(v_event_id, 'cancelled', null);
    v_fail := v_fail || 'S21 annulation sans motif aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'event_cancellation_reason_required' then v_fail := v_fail || ('S21 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S22 : transition sur evenement inexistant refusee.
  begin
    perform public.admin_set_event_status(v_bogus, 'published', null);
    v_fail := v_fail || 'S22 transition sur evenement inexistant aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'event_not_found' then v_fail := v_fail || ('S22 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- ===== 3. Inscriptions (insertion directe, aucun RPC membre n'est en
  -- cause ici) puis suivi/presence admin. =====
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  insert into public.event_registrations (event_id, profile_id, status, registered_at, is_listed)
  values (v_event_id, v_member_profile, 'registered', now(), true);
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_auth::text, 'role', 'authenticated')::text, true);

  -- S23 : liste des inscriptions d'un evenement inexistant refusee.
  begin
    perform public.admin_list_event_registrations(v_bogus, null, null, 20);
    v_fail := v_fail || 'S23 liste inscriptions d''un evenement inexistant aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'event_not_found' then v_fail := v_fail || ('S23 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S24 : l'inscription apparait dans admin_list_event_registrations.
  select public.admin_list_event_registrations(v_event_id, null, null, 25) into v_list;
  select count(*) into v_n from jsonb_array_elements(v_list->'rows') r where (r->>'profile_id')::uuid = v_member_profile;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || 'S24 inscription absente de admin_list_event_registrations'::text; end if;

  -- S25 : statut d'inscription invalide refuse.
  begin
    perform public.admin_set_event_registration_status(v_event_id, v_member_profile, 'not_a_status');
    v_fail := v_fail || 'S25 statut d''inscription invalide aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'invalid_status' then v_fail := v_fail || ('S25 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S26 : inscription inexistante refusee.
  begin
    perform public.admin_set_event_registration_status(v_event_id, v_bogus, 'attended');
    v_fail := v_fail || 'S26 inscription inexistante aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'event_registration_not_found' then v_fail := v_fail || ('S26 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S27 : presence constatee (D-55) : passage a 'attended'.
  select to_jsonb(public.admin_set_event_registration_status(v_event_id, v_member_profile, 'attended')) into v_reg;
  v_cases := v_cases + 1;
  if (v_reg->>'status') <> 'attended' or (v_reg->>'attended_at') is null or (v_reg->>'checked_in_at') is null then
    v_fail := v_fail || 'S27 constat de presence incorrect'::text;
  end if;

  -- ===== 4. Bilan organisateur (SA-033) =====

  -- S28 : bilan sur evenement inexistant refuse.
  begin
    perform public.admin_upsert_event_followup(v_bogus, 'resume');
    v_fail := v_fail || 'S28 bilan sur evenement inexistant aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'event_not_found' then v_fail := v_fail || ('S28 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S29 : bilan enregistre en brouillon (non publie).
  select to_jsonb(public.admin_upsert_event_followup(
    v_event_id, 'Synthese de test', 'Conclusions de test', 'Decisions de test', 'Suites de test', null, false
  )) into v_followup;
  v_cases := v_cases + 1;
  if (v_followup->>'published_at') is not null then
    v_fail := v_fail || 'S29 bilan cree en brouillon aurait du avoir published_at nul'::text;
  end if;

  -- S30 : publication du bilan.
  select to_jsonb(public.admin_upsert_event_followup(
    v_event_id, 'Synthese de test', 'Conclusions de test', 'Decisions de test', 'Suites de test',
    'https://replay.example.test/sa030', true
  )) into v_followup;
  v_cases := v_cases + 1;
  if (v_followup->>'published_at') is null then
    v_fail := v_fail || 'S30 publication du bilan incorrecte'::text;
  end if;

  -- ===== 5. Instantane d'impact (chiffres calcules, SA-033) =====

  -- S31 : instantane sur evenement inexistant refuse.
  begin
    perform public.admin_record_event_impact_snapshot(v_bogus);
    v_fail := v_fail || 'S31 instantane sur evenement inexistant aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'event_not_found' then v_fail := v_fail || ('S31 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S32 : instantane calcule reussi, decompte reel (1 inscrit present, aucun absent).
  select to_jsonb(public.admin_record_event_impact_snapshot(v_event_id)) into v_snapshot;
  v_cases := v_cases + 1;
  if (v_snapshot->>'registered_count')::integer <> 1
     or (v_snapshot->>'attended_count')::integer <> 1
     or (v_snapshot->>'no_show_count')::integer <> 0 then
    v_fail := v_fail || 'S32 instantane d''impact : decompte incorrect'::text;
  end if;

  -- S33 : l'instantane est bien journalise (ligne reelle dans event_impact_snapshots).
  select count(*) into v_n from public.event_impact_snapshots where event_id = v_event_id;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || ('S33 nombre d''instantanes d''impact inattendu (' || v_n || ')')::text; end if;

  -- ===== 6. Nettoyage =====
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  delete from public.event_impact_snapshots where event_id = v_event_id;
  delete from public.event_followups where id = v_event_id;
  delete from public.event_registrations where event_id = v_event_id;
  delete from public.events where id = v_event_id;
  delete from public.ise_profiles where id = v_member_profile;
  delete from public.promotions where id = v_promo_id;
  delete from auth.users where id = u_member;

  if array_length(v_fail, 1) is null then
    raise exception 'SA030_033_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'SA030_033_TESTS_FAILED: % cas, % echec(s)\n  - %', v_cases, array_length(v_fail, 1), array_to_string(v_fail, E'\n  - ');
  end if;
end;
$sa030033$;
