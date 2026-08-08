-- =====================================================================
-- supabase/tests/rls/0004_network_suite.sql
--
-- Suite de tests RLS NEGATIFS de la tranche
-- « Relations & introductions » (ISE-038 -> ISE-046).
-- MASTER PROMPT §80 : « une politique RLS non testee n'est pas terminee ».
--
-- Meme modele auto-nettoyant que 0001, 0002 et 0003 : un unique bloc DO,
-- des fixtures creees sous `postgres` (BYPASSRLS), des assertions
-- executees en changeant d'identite par `set_config`, et une exception
-- finale qui annule TOUT — aucune donnee de test ne subsiste.
--
--   succes  ->  ERROR:  P0001: NETWORK_TESTS_OK: 45 cas, 0 echec
--   echec   ->  ERROR:  P0001: NETWORK_TESTS_FAILED: 45 cas, K echec(s)
--
-- Verdict du 8 aout 2026 : NETWORK_TESTS_OK: 45 cas, 0 echec.
--
-- La suite a ete ecrite AVANT d'etre jouee et a revele un defaut reel
-- de la migration 0006 : la contrainte
-- `introduction_events_event_type_check` n'enumerait ni `completed` ni
-- `no_outcome`, alors que `public.transition_introduction()` journalise
-- `event_type = <statut d'arrivee>`. Les deux dernieres transitions de
-- la machine D-50 echouaient donc en `23514` : une introduction ne
-- pouvait jamais etre close, et le bilan d'ISE-046 etait structurellement
-- impossible. Correctif : `0040_introduction_event_type_fix.sql`.
-- Aucune assertion n'a ete affaiblie pour faire passer la suite.
--
-- L'ORDRE DES CAS EST SIGNIFIANT : plusieurs d'entre eux modifient
-- l'etat partage (N03 cree la relation Awa-Zoe, N05 -> N15 font
-- progresser une meme introduction dans sa machine d'etats). Un cas
-- insere avant en depend.
--
-- FIXTURES (D-104 : is_test_account = true, e-mails prefixes `test+`)
--   Awa     demandeur. Relations : Fatou, Serge.
--   Fatou   intermediaire legitime. Relations : Awa, Koffi.
--   Koffi   cible. Relation : Fatou. AUCUNE relation avec Awa.
--   Serge   relation d'Awa, MAIS aucune relation avec Koffi
--           -> intermediaire non relie a la cible (D-51).
--   Zoe     aucune relation au depart ; demande de connexion en attente
--           vers Awa et vers Koffi.
--   Bea     a BLOQUE Awa.
--   Yao     membre actif sans aucun lien : cible de controle.
-- =====================================================================

do $network$
declare
  u_awa   uuid := '00000000-0000-4000-8000-000000000401';
  u_fatou uuid := '00000000-0000-4000-8000-000000000402';
  u_koffi uuid := '00000000-0000-4000-8000-000000000403';
  u_serge uuid := '00000000-0000-4000-8000-000000000404';
  u_zoe   uuid := '00000000-0000-4000-8000-000000000405';
  u_bea   uuid := '00000000-0000-4000-8000-000000000406';
  u_yao   uuid := '00000000-0000-4000-8000-000000000407';

  p_awa   uuid := '00000000-0000-4000-8000-000000000411';
  p_fatou uuid := '00000000-0000-4000-8000-000000000412';
  p_koffi uuid := '00000000-0000-4000-8000-000000000413';
  p_serge uuid := '00000000-0000-4000-8000-000000000414';
  p_zoe   uuid := '00000000-0000-4000-8000-000000000415';
  p_bea   uuid := '00000000-0000-4000-8000-000000000416';
  p_yao   uuid := '00000000-0000-4000-8000-000000000417';

  x_req_za uuid := '00000000-0000-4000-8000-000000000421'; -- Zoe -> Awa
  x_req_zk uuid := '00000000-0000-4000-8000-000000000422'; -- Zoe -> Koffi
  x_req_yk uuid := '00000000-0000-4000-8000-000000000423'; -- Yao -> Koffi

  x_intro  uuid;

  v_promotion bigint;
  v_cases integer := 0;
  v_fail  text[]  := array[]::text[];
  v_n     bigint;
  v_ok    boolean;
  v_msg   text;
  v_json  jsonb;
  v_txt   text;
begin
  -- ===================================================================
  -- FIXTURES
  -- ===================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  select id into v_promotion from public.promotions order by graduation_year desc limit 1;

  insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', u_awa,   'authenticated', 'authenticated', 'test+awa@ise.test',   now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_fatou, 'authenticated', 'authenticated', 'test+fatou@ise.test', now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_koffi, 'authenticated', 'authenticated', 'test+koffi@ise.test', now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_serge, 'authenticated', 'authenticated', 'test+serge@ise.test', now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_zoe,   'authenticated', 'authenticated', 'test+zoe@ise.test',   now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_bea,   'authenticated', 'authenticated', 'test+bea@ise.test',   now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_yao,   'authenticated', 'authenticated', 'test+yao@ise.test',   now(), now());

  insert into public.ise_profiles
    (id, user_id, promotion_id, first_name, last_name,
     profile_status, claim_status, claimed_at, is_test_account)
  values
    (p_awa,   u_awa,   v_promotion, 'Awa',   'Test', 'active', 'claimed', now(), true),
    (p_fatou, u_fatou, v_promotion, 'Fatou', 'Test', 'active', 'claimed', now(), true),
    (p_koffi, u_koffi, v_promotion, 'Koffi', 'Test', 'active', 'claimed', now(), true),
    (p_serge, u_serge, v_promotion, 'Serge', 'Test', 'active', 'claimed', now(), true),
    (p_zoe,   u_zoe,   v_promotion, 'Zoe',   'Test', 'active', 'claimed', now(), true),
    (p_bea,   u_bea,   v_promotion, 'Bea',   'Test', 'active', 'claimed', now(), true),
    (p_yao,   u_yao,   v_promotion, 'Yao',   'Test', 'active', 'claimed', now(), true);

  -- Le chemin d'introduction legitime : Awa -> Fatou -> Koffi.
  insert into public.connections (profile_a_id, profile_b_id, context) values
    (least(p_awa, p_fatou),   greatest(p_awa, p_fatou),   'promotion'),
    (least(p_fatou, p_koffi), greatest(p_fatou, p_koffi), 'project'),
    -- Serge est une relation d'Awa, mais n'a AUCUN lien avec Koffi.
    (least(p_awa, p_serge),   greatest(p_awa, p_serge),   'other');

  -- Bea bloque Awa : le blocage precede toute visibilite (docs/rls.md 1.4).
  insert into public.profile_blocks (blocker_profile_id, blocked_profile_id)
  values (p_bea, p_awa);

  insert into public.connection_requests
    (id, requester_profile_id, addressee_profile_id, message, context, status)
  values
    (x_req_za, p_zoe, p_awa,   'Bonjour Awa, ravi de vous retrouver.',   'promotion', 'pending'),
    (x_req_zk, p_zoe, p_koffi, 'Bonjour Koffi, echangeons volontiers.',  'sector',    'pending'),
    -- Demande a laquelle NI Awa NI Zoe ne sont partie prenante.
    (x_req_yk, p_yao, p_koffi, 'Bonjour Koffi, demande d''un tiers.',    'other',     'pending');

  -- ===================================================================
  -- Awa authentifiee
  -- ===================================================================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_awa::text, 'role', 'authenticated')::text, true);

  -- N01 — usurpation du demandeur : Awa depose une demande AU NOM de Zoe.
  v_msg := null;
  begin
    insert into public.connection_requests (requester_profile_id, addressee_profile_id, status)
    values (p_zoe, p_yao, 'pending');
    v_ok := false;
    v_msg := 'insertion acceptee';
  exception when others then
    v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then
    v_fail := v_fail || ('N01 demande de connexion deposee au nom d''un tiers : ' || coalesce(v_msg, ''));
  end if;

  -- N02 — acceptation d'une demande adressee a un tiers -> not_addressee.
  v_msg := null;
  begin
    perform public.accept_connection_request(x_req_zk);
    v_msg := 'acceptation reussie';
  exception when others then
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  if v_msg is distinct from 'not_addressee' then
    v_fail := v_fail || ('N02 acceptation par un tiers : attendu not_addressee, obtenu ' || coalesce(v_msg, 'aucune erreur'));
  end if;

  -- N03a — acceptation legitime par la destinataire.
  v_msg := null;
  begin
    perform public.accept_connection_request(x_req_za);
    v_ok := true;
  exception when others then
    v_ok := false;
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then
    v_fail := v_fail || ('N03a acceptation legitime refusee : ' || coalesce(v_msg, ''));
  end if;

  -- N03b — seconde acceptation de la MEME demande -> invalid_transition.
  v_msg := null;
  begin
    perform public.accept_connection_request(x_req_za);
    v_msg := 'seconde acceptation reussie';
  exception when others then
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  if v_msg is distinct from 'invalid_transition' then
    v_fail := v_fail || ('N03b double acceptation : attendu invalid_transition, obtenu ' || coalesce(v_msg, 'aucune erreur'));
  end if;

  -- N03c — une SEULE relation existe (MASTER PROMPT §100).
  select count(*) into v_n from public.connections c
   where c.profile_a_id = least(p_awa, p_zoe) and c.profile_b_id = greatest(p_awa, p_zoe);
  v_cases := v_cases + 1;
  if v_n <> 1 then
    v_fail := v_fail || format('N03c double acceptation : %s relation(s) au lieu d''une', v_n);
  end if;

  -- N04 — introduction via un intermediaire NON RELIE a la cible (D-51).
  -- Serge est bien une relation d'Awa, mais n'a aucun lien avec Koffi :
  -- le second maillon du chemin n'existe pas.
  v_msg := null;
  begin
    perform public.request_introduction(
      p_serge, p_koffi, 'expertise',
      'Bonjour Serge, pourriez-vous me presenter Koffi sur les sujets de suivi-evaluation ?', null);
    v_msg := 'demande acceptee';
  exception when others then
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  if v_msg is distinct from 'intermediary_not_connected' then
    v_fail := v_fail || ('N04 intermediaire non relie a la cible : attendu intermediary_not_connected, obtenu ' || coalesce(v_msg, 'aucune erreur'));
  end if;

  -- N04b — insertion DIRECTE avec un intermediaire qui n'est pas ma
  -- relation : la politique `introduction_requests_create` doit refuser,
  -- independamment de la fonction.
  v_msg := null;
  begin
    insert into public.introduction_requests
      (requester_profile_id, intermediary_profile_id, target_profile_id,
       purpose, message_to_intermediary, status)
    values (p_awa, p_yao, p_koffi, 'expertise',
            'Insertion directe qui doit etre refusee par la politique.', 'requested');
    v_ok := false;
    v_msg := 'insertion acceptee';
  exception when others then
    v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then
    v_fail := v_fail || ('N04b politique introduction_requests_create contournee : ' || coalesce(v_msg, ''));
  end if;

  -- N05a — chemins d'introduction : degre 1 STRICT (D-51).
  -- Seule Fatou doit ressortir : Serge et Zoe sont mes relations mais
  -- n'ont aucun lien avec Koffi ; personne d'autre n'est atteignable.
  v_json := public.suggest_introduction_paths(p_koffi, 10);
  v_cases := v_cases + 1;
  if jsonb_array_length(v_json -> 'paths') <> 1 then
    v_fail := v_fail || format('N05a chemins proposes : %s au lieu de 1',
                               jsonb_array_length(v_json -> 'paths'));
  end if;

  v_cases := v_cases + 1;
  if (v_json -> 'paths' -> 0 -> 'intermediary' ->> 'profile_id') is distinct from p_fatou::text then
    v_fail := v_fail || 'N05b l''intermediaire propose n''est pas la relation directe attendue';
  end if;

  -- N05c — aucun score numerique ne sort (MASTER PROMPT §15, D-42).
  v_cases := v_cases + 1;
  if v_json::text ilike '%"score"%' or v_json::text ilike '%"rank"%' then
    v_fail := v_fail || 'N05c un score ou un rang numerique figure dans la reponse';
  end if;

  -- N06 — demande d'introduction legitime.
  v_msg := null;
  begin
    select (public.request_introduction(
              p_fatou, p_koffi, 'expertise',
              'Bonjour Fatou, j''aimerais echanger avec Koffi sur le suivi-evaluation bancaire.',
              'Bonjour Koffi, je travaille sur des dispositifs de suivi-evaluation.'
            ) ->> 'introduction_id')::uuid
      into x_intro;
    v_ok := (x_intro is not null);
  exception when others then
    v_ok := false;
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then
    v_fail := v_fail || ('N06 demande d''introduction legitime refusee : ' || coalesce(v_msg, ''));
  end if;

  -- N07 — doublon de demande sur le meme triplet.
  v_msg := null;
  begin
    perform public.request_introduction(
      p_fatou, p_koffi, 'advice',
      'Seconde demande identique qui doit etre refusee par la fonction.', null);
    v_msg := 'doublon accepte';
  exception when others then
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  if v_msg is distinct from 'request_already_sent' then
    v_fail := v_fail || ('N07 doublon d''introduction : attendu request_already_sent, obtenu ' || coalesce(v_msg, 'aucune erreur'));
  end if;

  -- N08 — transition par le MAUVAIS ACTEUR : le demandeur ne peut pas
  -- accepter a la place de l'intermediaire (D-50).
  v_msg := null;
  begin
    perform public.transition_introduction(x_intro, 'intermediary_accepted', null);
    v_msg := 'transition acceptee';
  exception when others then
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  if v_msg is distinct from 'invalid_transition' then
    v_fail := v_fail || ('N08 transition par le mauvais acteur : attendu invalid_transition, obtenu ' || coalesce(v_msg, 'aucune erreur'));
  end if;

  -- N09 — aucune politique UPDATE n'existe sur `introduction_requests`.
  update public.introduction_requests set status = 'completed' where id = x_intro;
  get diagnostics v_n = row_count;
  v_cases := v_cases + 1;
  if v_n <> 0 then
    v_fail := v_fail || format('N09 update direct sur introduction_requests : %s ligne(s) affectee(s)', v_n);
  end if;

  -- N10 — sollicitation d'un membre qui a bloque le demandeur.
  v_msg := null;
  begin
    perform public.send_connection_request(p_bea, 'Bonjour Bea.', 'promotion');
    v_msg := 'demande acceptee';
  exception when others then
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  -- `v_msg is null` doit faire echouer le cas : sans ce test, une demande
  -- ACCEPTEE (donc sans erreur) passerait inapercue.
  if v_msg is null or v_msg not in ('not_found', 'blocked') then
    v_fail := v_fail || ('N10a membre bloque sollicite : attendu not_found/blocked, obtenu ' || coalesce(v_msg, 'aucune erreur'));
  end if;

  -- N10b — meme chose par insertion directe : la politique doit refuser.
  v_msg := null;
  begin
    insert into public.connection_requests (requester_profile_id, addressee_profile_id, status)
    values (p_awa, p_bea, 'pending');
    v_ok := false;
    v_msg := 'insertion acceptee';
  exception when others then
    v_ok := true;
  end;
  v_cases := v_cases + 1;
  if not v_ok then
    v_fail := v_fail || ('N10b demande vers un bloqueur acceptee par la politique : ' || coalesce(v_msg, ''));
  end if;

  -- N10c — le profil du bloqueur n'est pas consultable.
  v_cases := v_cases + 1;
  if private.can_see_profile(p_bea) then
    v_fail := v_fail || 'N10c le profil du bloqueur reste consultable';
  end if;

  -- N11 — demande de connexion sur son propre profil.
  v_msg := null;
  begin
    perform public.send_connection_request(p_awa, null, null);
    v_msg := 'demande acceptee';
  exception when others then
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  if v_msg is distinct from 'cannot_target_self' then
    v_fail := v_fail || ('N11 demande vers soi-meme : attendu cannot_target_self, obtenu ' || coalesce(v_msg, 'aucune erreur'));
  end if;

  -- N12 — demande vers une relation deja etablie.
  v_msg := null;
  begin
    perform public.send_connection_request(p_fatou, null, null);
    v_msg := 'demande acceptee';
  exception when others then
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  if v_msg is distinct from 'already_connected' then
    v_fail := v_fail || ('N12 demande vers une relation existante : attendu already_connected, obtenu ' || coalesce(v_msg, 'aucune erreur'));
  end if;

  -- ===================================================================
  -- Koffi authentifie : la CIBLE ne voit rien tant que le statut est
  -- `requested` (docs/rls.md 3.4).
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_koffi::text, 'role', 'authenticated')::text, true);

  -- N13a — lecture directe de la demande d'introduction.
  select count(*) into v_n from public.introduction_requests where id = x_intro;
  v_cases := v_cases + 1;
  if v_n <> 0 then
    v_fail := v_fail || format('N13a la cible voit une introduction en statut requested (%s)', v_n);
  end if;

  -- N13b — lecture par la fonction : meme refus.
  v_cases := v_cases + 1;
  if public.get_introduction_request(x_intro) is not null then
    v_fail := v_fail || 'N13b get_introduction_request expose une demande requested a la cible';
  end if;

  -- N13c — la cible ne voit pas non plus l'introduction dans sa liste.
  v_json := public.list_my_introductions('all', null, 20);
  v_cases := v_cases + 1;
  if jsonb_array_length(v_json -> 'rows') <> 0 then
    v_fail := v_fail || 'N13c list_my_introductions expose une demande requested a la cible';
  end if;

  -- ===================================================================
  -- Fatou authentifiee : l'intermediaire.
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_fatou::text, 'role', 'authenticated')::text, true);

  -- N14 — acceptation par l'intermediaire.
  v_msg := null;
  begin
    perform public.transition_introduction(x_intro, 'intermediary_accepted', null);
    v_ok := true;
  exception when others then
    v_ok := false;
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then
    v_fail := v_fail || ('N14 acceptation par l''intermediaire refusee : ' || coalesce(v_msg, ''));
  end if;

  -- N15 — `intermediary_accepted -> completed` en direct : impossible.
  -- C'est LE cas du MASTER PROMPT §25 : « intermediaire accepte » ne
  -- vaut pas « introduction reussie ».
  v_msg := null;
  begin
    perform public.transition_introduction(x_intro, 'completed', null);
    v_msg := 'transition acceptee';
  exception when others then
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  if v_msg is distinct from 'invalid_transition' then
    v_fail := v_fail || ('N15 intermediary_accepted -> completed : attendu invalid_transition, obtenu ' || coalesce(v_msg, 'aucune erreur'));
  end if;

  -- ===================================================================
  -- Awa : le bilan ne peut pas devancer les faits.
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_awa::text, 'role', 'authenticated')::text, true);

  -- N16 — declarer « echange realise » alors que rien n'a ete transmis.
  v_msg := null;
  begin
    perform public.declare_introduction_outcome(x_intro, 'exchange_held', null);
    v_msg := 'bilan accepte';
  exception when others then
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  if v_msg is distinct from 'invalid_transition' then
    v_fail := v_fail || ('N16 bilan avant transmission : attendu invalid_transition, obtenu ' || coalesce(v_msg, 'aucune erreur'));
  end if;

  -- ===================================================================
  -- Fatou transmet reellement l'introduction.
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_fatou::text, 'role', 'authenticated')::text, true);

  perform public.transition_introduction(x_intro, 'introduced', null);

  -- ===================================================================
  -- Koffi : desormais partie prenante visible, mais pas de tout.
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_koffi::text, 'role', 'authenticated')::text, true);

  v_json := public.get_introduction_request(x_intro);

  -- N17a — la cible voit enfin la demande.
  v_cases := v_cases + 1;
  if v_json is null then
    v_fail := v_fail || 'N17a la cible ne voit pas l''introduction apres transmission';
  end if;

  -- N17b — mais JAMAIS le message adresse a l'intermediaire.
  v_cases := v_cases + 1;
  if v_json ? 'message_to_intermediary' then
    v_fail := v_fail || 'N17b le message adresse a l''intermediaire est transmis a la cible';
  end if;

  -- N17c — ni la carte de profil, ni la reponse, n'exposent le score de
  -- completion (D-72, privilege de colonne 0028).
  v_cases := v_cases + 1;
  if v_json::text ilike '%profile_completion%' then
    v_fail := v_fail || 'N17c le score de completion figure dans la reponse';
  end if;

  -- N18 — la cible ne peut pas clore « sans suite » : D-50 reserve cette
  -- transition au demandeur.
  v_msg := null;
  begin
    perform public.declare_introduction_outcome(x_intro, 'no_response', null);
    v_msg := 'bilan accepte';
  exception when others then
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  if v_msg is distinct from 'not_authorized' then
    v_fail := v_fail || ('N18 cloture sans suite par la cible : attendu not_authorized, obtenu ' || coalesce(v_msg, 'aucune erreur'));
  end if;

  -- N19 — la cible constate l'echange.
  v_msg := null;
  begin
    perform public.transition_introduction(x_intro, 'target_responded', null);
    v_ok := true;
  exception when others then
    v_ok := false;
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then
    v_fail := v_fail || ('N19 target_responded refuse a la cible : ' || coalesce(v_msg, ''));
  end if;

  -- ===================================================================
  -- Awa : bilan, cette fois sur un fait constate.
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_awa::text, 'role', 'authenticated')::text, true);

  -- N20 — bilan legitime.
  v_msg := null;
  begin
    v_json := public.declare_introduction_outcome(
                x_intro, 'exchange_held', 'Echange de 30 minutes sur les dispositifs de suivi-evaluation.');
    v_ok := (v_json ->> 'status' = 'completed');
  exception when others then
    v_ok := false;
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  if not v_ok then
    v_fail := v_fail || ('N20 bilan legitime refuse : ' || coalesce(v_msg, ''));
  end if;

  -- N21 — le resultat est bien enregistre, et pas seulement le statut.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  select r.outcome into v_txt from public.introduction_requests r where r.id = x_intro;
  v_cases := v_cases + 1;
  if v_txt is distinct from 'exchange_held' then
    v_fail := v_fail || ('N21 outcome enregistre : ' || coalesce(v_txt, 'aucun'));
  end if;

  -- N22 — un evenement factuel a ete journalise pour chaque etape.
  select count(*) into v_n from public.introduction_events e where e.introduction_id = x_intro;
  v_cases := v_cases + 1;
  if v_n < 5 then
    v_fail := v_fail || format('N22 journal d''introduction incomplet (%s evenement(s))', v_n);
  end if;

  -- N23 — second bilan sur une introduction close.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_awa::text, 'role', 'authenticated')::text, true);
  v_msg := null;
  begin
    perform public.declare_introduction_outcome(x_intro, 'collaboration_confirmed', null);
    v_msg := 'second bilan accepte';
  exception when others then
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  if v_msg is distinct from 'invalid_transition' then
    v_fail := v_fail || ('N23 second bilan : attendu invalid_transition, obtenu ' || coalesce(v_msg, 'aucune erreur'));
  end if;

  -- ===================================================================
  -- Zoe : tiers non partie prenante.
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_zoe::text, 'role', 'authenticated')::text, true);

  -- N24 — un tiers ne lit pas l'introduction.
  select count(*) into v_n from public.introduction_requests where id = x_intro;
  v_cases := v_cases + 1;
  if v_n <> 0 then
    v_fail := v_fail || format('N24a un tiers lit l''introduction (%s)', v_n);
  end if;

  v_cases := v_cases + 1;
  if public.get_introduction_request(x_intro) is not null then
    v_fail := v_fail || 'N24b get_introduction_request expose l''introduction a un tiers';
  end if;

  -- N25 — un tiers ne lit pas la demande de connexion d'autrui.
  -- `x_req_yk` (Yao -> Koffi) n'implique ni Zoe ni Awa.
  v_cases := v_cases + 1;
  if public.get_connection_request(x_req_yk) is not null then
    v_fail := v_fail || 'N25a get_connection_request expose une demande a un tiers';
  end if;

  -- N25b — ... et ne peut pas la decliner a la place du destinataire.
  v_msg := null;
  begin
    perform public.respond_to_connection_request(x_req_yk, 'declined', null);
    v_msg := 'refus accepte';
  exception when others then
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  if v_msg is distinct from 'not_addressee' then
    v_fail := v_fail || ('N25b refus par un tiers : attendu not_addressee, obtenu ' || coalesce(v_msg, 'aucune erreur'));
  end if;

  -- ===================================================================
  -- Awa : lectures composees et limitation de debit.
  -- ===================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_awa::text, 'role', 'authenticated')::text, true);

  -- N26 — mes relations : Fatou, Serge et Zoe, jamais Koffi.
  v_json := public.list_my_connections(null, null, 20);
  v_cases := v_cases + 1;
  if jsonb_array_length(v_json -> 'rows') <> 3 then
    v_fail := v_fail || format('N26a mes relations : %s au lieu de 3',
                               jsonb_array_length(v_json -> 'rows'));
  end if;

  v_cases := v_cases + 1;
  if v_json::text like '%' || p_koffi::text || '%' then
    v_fail := v_fail || 'N26b un non-contact figure dans mes relations';
  end if;

  -- N27 — recherche dans mes relations.
  v_json := public.list_my_connections('Fatou', null, 20);
  v_cases := v_cases + 1;
  if jsonb_array_length(v_json -> 'rows') <> 1 then
    v_fail := v_fail || format('N27 recherche dans mes relations : %s resultat(s) au lieu de 1',
                               jsonb_array_length(v_json -> 'rows'));
  end if;

  -- N28 — compteurs du bandeau ISE-040, calcules sur des faits.
  v_json := public.my_network_summary();
  v_cases := v_cases + 1;
  if (v_json ->> 'connections')::int <> 3 then
    v_fail := v_fail || ('N28 my_network_summary.connections = ' || coalesce(v_json ->> 'connections', 'null'));
  end if;

  -- N29 — limitation de debit des demandes de connexion (D-103, 30/jour).
  -- Le compteur est prerempli a 30 : la demande suivante doit etre
  -- refusee par la fonction, pas par une contrainte.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  insert into private.rate_limit_counters (subject_key, action_key, window_start, count)
  values (u_awa::text, 'connection_request', date_trunc('minute', now()), 30)
  on conflict (subject_key, action_key, window_start) do update set count = 30;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_awa::text, 'role', 'authenticated')::text, true);
  v_msg := null;
  begin
    perform public.send_connection_request(p_yao, 'Bonjour Yao.', 'promotion');
    v_msg := 'demande acceptee';
  exception when others then
    v_msg := sqlerrm;
  end;
  v_cases := v_cases + 1;
  if v_msg is distinct from 'rate_limited' then
    v_fail := v_fail || ('N29 limitation de debit : attendu rate_limited, obtenu ' || coalesce(v_msg, 'aucune erreur'));
  end if;

  -- ===================================================================
  -- N30 — lignes de base de securite, apres 0039.
  -- ===================================================================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  select count(*) into v_n from private.security_baseline_violations();
  v_cases := v_cases + 1;
  if v_n <> 0 then
    v_fail := v_fail || format('N30a security_baseline_violations() renvoie %s ligne(s)', v_n);
  end if;

  select count(*) into v_n from private.tables_without_rls();
  v_cases := v_cases + 1;
  if v_n <> 0 then
    v_fail := v_fail || format('N30b tables_without_rls() renvoie %s ligne(s)', v_n);
  end if;

  -- ===================================================================
  -- RAPPORT + ROLLBACK
  -- ===================================================================
  if array_length(v_fail, 1) is null then
    raise exception 'NETWORK_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'NETWORK_TESTS_FAILED: % cas, % echec(s)\n  - %',
      v_cases, array_length(v_fail, 1), array_to_string(v_fail, E'\n  - ');
  end if;
end
$network$;
