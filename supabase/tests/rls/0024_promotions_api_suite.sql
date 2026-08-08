-- =====================================================================
-- supabase/tests/rls/0024_promotions_api_suite.sql
--
-- Suite NEGATIVE de la couche API des PROMOTIONS (migration 0070).
--
-- LE COEUR DE CETTE SUITE : verifier deux choses qu'aucune politique
-- RLS ne peut garantir seule.
--   1. Un membre d'une AUTRE promotion ne recoit aucune donnee reservee
--      — ni la liste des membres, ni les invitations, ni la fiche d'un
--      profil reference (A01 -> A05).
--   2. L'INDICE DE CONTACT d'un tiers ne franchit jamais la frontiere
--      du serveur. Il est ecrit en schema `private`, son EXISTENCE est
--      signalee, son CONTENU ne l'est pas (A06 -> A09). Le jeton
--      d'invitation obeit a la meme regle : emis une fois, stocke hache
--      (A10 -> A12).
--
-- Modele auto-nettoyant : bloc DO unique, fixtures, assertions,
-- RAISE EXCEPTION final qui annule toute la transaction.
--
--   succes  ->  ERROR:  P0001: PROMOTIONS_API_TESTS_OK: N cas, 0 echec
--   echec   ->  ERROR:  P0001: PROMOTIONS_API_TESTS_FAILED: N cas, K echec(s)
--
-- FIXTURES (D-104)
--   Ada   promotion A, responsable de promotion
--   Ben   promotion A, membre simple
--   Cleo  promotion B — hors de l'espace de la promotion A
--   Zoe   promotion A, profil REFERENCE non reclame
-- =====================================================================

do $promo$
declare
  u_ada  uuid := '00000000-0000-4000-8028-000000000001';
  u_ben  uuid := '00000000-0000-4000-8028-000000000002';
  u_cleo uuid := '00000000-0000-4000-8028-000000000003';
  p_ada  uuid := '00000000-0000-4000-8028-0000000000a1';
  p_ben  uuid := '00000000-0000-4000-8028-0000000000a2';
  p_cleo uuid := '00000000-0000-4000-8028-0000000000a3';
  p_zoe  uuid := '00000000-0000-4000-8028-0000000000a4';
  v_a bigint; v_b bigint;
  v_cases integer := 0; v_fail text[] := array[]::text[];
  v_ok boolean; v_msg text; v_json jsonb; v_txt text; v_tok text; v_n bigint;
  v_inv uuid;
begin
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims','',true);

  select id into v_a from public.promotions order by id limit 1;
  select id into v_b from public.promotions order by id desc limit 1;

  insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_ada ,'authenticated','authenticated','test+promo.ada@ise.test' ,now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_ben ,'authenticated','authenticated','test+promo.ben@ise.test' ,now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_cleo,'authenticated','authenticated','test+promo.cleo@ise.test',now(),now());

  insert into public.ise_profiles
    (id,user_id,first_name,last_name,promotion_id,profile_status,claim_status,claimed_at,is_test_account) values
    (p_ada ,u_ada ,'Ada' ,'Promo',v_a,'active','claimed',now(),true),
    (p_ben ,u_ben ,'Ben' ,'Promo',v_a,'active','claimed',now(),true),
    (p_cleo,u_cleo,'Cleo','Promo',v_b,'active','claimed',now(),true);
  insert into public.ise_profiles
    (id,first_name,last_name,promotion_id,profile_status,claim_status,current_organization_raw,is_test_account) values
    (p_zoe,'Zoe','Promo',v_a,'active','unclaimed','Institut inconnu',true);

  insert into public.promotion_managers (promotion_id, profile_id, manager_role, active)
  values (v_a, p_ada, 'delegate', true);

  -- ---- Cleo, membre d'une AUTRE promotion --------------------------
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',u_cleo::text,'role','authenticated')::text,true);

  -- A01 — la liste des membres est refusee.
  v_msg:=null;
  begin perform public.list_promotion_members(v_a); v_ok:=false; v_msg:='liste rendue a un tiers';
  exception when others then v_ok:=(sqlerrm='not_authorized'); if not v_ok then v_msg:=sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('A01 '||coalesce(v_msg,'')); end if;

  -- A02 — le suivi des invitations est refuse.
  v_msg:=null;
  begin perform public.list_promotion_invitations(v_a); v_ok:=false; v_msg:='invitations rendues a un tiers';
  exception when others then v_ok:=(sqlerrm='not_authorized'); if not v_ok then v_msg:=sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('A02 '||coalesce(v_msg,'')); end if;

  -- A03 — un profil reference est INDISTINCTEMENT absent.
  v_msg:=null;
  begin perform public.get_promotion_referenced_member(p_zoe); v_ok:=false; v_msg:='profil reference rendu a un tiers';
  exception when others then v_ok:=(sqlerrm='profile_not_found'); if not v_ok then v_msg:=sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('A03 '||coalesce(v_msg,'')); end if;

  -- A04 — l'apercu reste lisible (CA-PROMO-09) mais SANS bloc reserve.
  v_json := public.get_promotion_overview(v_a);
  v_cases:=v_cases+1;
  if (v_json->>'is_member')::boolean or v_json->'classmates' <> 'null'::jsonb
     or v_json->'to_find_count' <> 'null'::jsonb then
    v_fail:=v_fail||'A04 un tiers recoit les blocs reserves de la promotion';
  end if;

  -- A05 — signaler un membre manquant dans une promotion tierce.
  v_msg:=null;
  begin perform public.suggest_missing_member(v_a,'Iba','Toure'); v_ok:=false;
  exception when others then v_ok:=(sqlerrm='not_authorized'); if not v_ok then v_msg:=sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('A05 '||coalesce(v_msg,'')); end if;

  -- ---- Ada, membre et responsable ----------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub',u_ada::text,'role','authenticated')::text,true);

  -- A06 — l'indice de contact est accepte, aucun profil n'est cree ([F 57]).
  v_json := public.suggest_missing_member(v_a,'Iba','Toure','CI','iba.toure@exemple.test');
  v_cases:=v_cases+1;
  if not (v_json->>'contact_hint_stored')::boolean or (v_json->>'creates_profile')::boolean then
    v_fail:=v_fail||'A06 l''indice n''a pas ete stocke, ou un profil a ete cree';
  end if;

  -- A07 — il vit dans le schema private ([U 111]).
  perform set_config('role','postgres',true);
  select count(*) into v_n from private.missing_member_contact_hints h
   where h.suggestion_id = (v_json->>'suggestion_id')::uuid and h.contact_hint = 'iba.toure@exemple.test';
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||'A07 l''indice n''est pas dans le schema private'; end if;
  update public.missing_member_suggestions set matched_profile_id = p_zoe
   where id = (v_json->>'suggestion_id')::uuid;
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',u_ada::text,'role','authenticated')::text,true);

  -- A08 — et n'apparait NULLE PART dans la projection ISE-069.
  v_txt := public.get_promotion_referenced_member(p_zoe)::text;
  v_cases:=v_cases+1;
  if v_txt like '%iba.toure@exemple.test%' then
    v_fail:=v_fail||'A08 l''indice de contact a fuite dans la projection ISE-069';
  end if;

  -- A09 — seule son EXISTENCE est signalee.
  v_cases:=v_cases+1;
  if not (public.get_promotion_referenced_member(p_zoe)->>'has_contact_hint')::boolean then
    v_fail:=v_fail||'A09 l''existence de l''indice n''est pas signalee';
  end if;

  -- A10 — le jeton est renvoye une fois ; aucun compte n'est cree.
  v_json := public.create_promotion_invitation(p_zoe,'link');
  v_tok := v_json->>'token';
  v_inv := (v_json->>'invitation_id')::uuid;
  v_cases:=v_cases+1;
  if v_tok is null or length(v_tok) < 32 or (v_json->>'creates_account')::boolean then
    v_fail:=v_fail||'A10 jeton absent ou creation de compte annoncee';
  end if;

  -- A11 / A12 — seul le HACHAGE est conserve ([U 110]).
  perform set_config('role','postgres',true);
  select count(*) into v_n from public.promotion_invitations i
   where i.id = v_inv and i.token_hash = encode(extensions.digest(v_tok,'sha256'),'hex');
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||'A11 le hachage stocke ne correspond pas au jeton emis'; end if;
  select count(*) into v_n from public.promotion_invitations i where i.id = v_inv and i.token_hash = v_tok;
  v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||'A12 le jeton est stocke en clair'; end if;
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims', json_build_object('sub',u_ada::text,'role','authenticated')::text,true);

  -- A13 — anti-relance : une invitation vivante en bloque une seconde.
  v_msg:=null;
  begin perform public.create_promotion_invitation(p_zoe,'link'); v_ok:=false;
  exception when others then v_ok:=(sqlerrm='request_already_sent'); if not v_ok then v_msg:=sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('A13 '||coalesce(v_msg,'')); end if;

  -- A14 — on n'invite pas un profil deja reclame.
  v_msg:=null;
  begin perform public.create_promotion_invitation(p_ben,'link'); v_ok:=false;
  exception when others then v_ok:=(sqlerrm='profile_already_claimed'); if not v_ok then v_msg:=sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('A14 '||coalesce(v_msg,'')); end if;

  -- ---- Ben, membre simple ------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub',u_ben::text,'role','authenticated')::text,true);

  -- A15 — chemin positif : un membre voit les profils a retrouver.
  v_json := public.list_promotion_members(v_a,null,null,null,null,'to_find');
  v_cases:=v_cases+1;
  if jsonb_array_length(v_json->'rows') < 1 then
    v_fail:=v_fail||'A15 un membre ne voit pas les profils a retrouver de sa promotion';
  end if;

  -- A16 — mais leur carte reste MINIMALE (CA-PROMO-03).
  v_cases:=v_cases+1;
  if (v_json->'rows'->0->>'organization') is not null
     or (v_json->'rows'->0->>'headline') is not null
     or (v_json->'rows'->0->>'is_claimed')::boolean then
    v_fail:=v_fail||'A16 la carte d''un profil non reclame n''est pas minimale (CA-PROMO-03)';
  end if;

  -- A17 — un membre qui n'est ni emetteur ni responsable ne revoque pas.
  v_msg:=null;
  begin perform public.revoke_promotion_invitation(v_inv); v_ok:=false;
  exception when others then v_ok:=(sqlerrm='not_authorized'); if not v_ok then v_msg:=sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('A17 '||coalesce(v_msg,'')); end if;

  -- A18 — chemin positif : l'apercu complet pour un membre.
  v_json := public.get_promotion_overview(v_a);
  v_cases:=v_cases+1;
  if not (v_json->>'is_member')::boolean or v_json->'stats'->>'referenced' is null then
    v_fail:=v_fail||'A18 un membre ne recoit pas l''apercu de sa promotion';
  end if;

  -- A19 — aucun classement entre promotions (CA-PROMO-02, [U 126]).
  v_cases:=v_cases+1;
  if v_json ? 'ranking' or v_json ? 'rank' then
    v_fail:=v_fail||'A19 un classement entre promotions est expose (CA-PROMO-02)';
  end if;

  -- A20 — la ligne de base de securite reste verte.
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims','',true);
  select count(*) into v_n from private.security_baseline_violations();
  v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('A20 security_baseline_violations() renvoie %s ligne(s)',v_n); end if;

  if array_length(v_fail,1) is null then
    raise exception 'PROMOTIONS_API_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'PROMOTIONS_API_TESTS_FAILED: % cas, % echec(s)\n  - %',
      v_cases, array_length(v_fail,1), array_to_string(v_fail,E'\n  - ');
  end if;
end
$promo$;
