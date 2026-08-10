-- 0034_admin_promotion_campaigns_suite.sql
-- SA-011->015 : suivi des invitations d'une promotion, campagnes
-- d'invitation en masse (creation, lancement, pause/reprise, cloture).
-- succes -> ERROR: P0001: SA011_015_TESTS_OK: N cas, 0 echec

do $sa011015$
declare
  v_admin_auth uuid := '28708d27-78f4-4bc9-bdb3-ead2ce5e5612'; -- bootstrap admin (blyped@gmail.com)
  u_member uuid := '00000000-0000-4000-9011-000000000002';
  v_promo_id bigint;
  p1 uuid; p2 uuid;
  v_campaign jsonb; v_campaign_id uuid;
  v_batch1 jsonb;
  v_token text; v_hash_computed text; v_hash_stored text;
  v_get jsonb; v_close jsonb; v_list jsonb; v_invlist jsonb;
  v_fail text[] := array[]::text[];
  v_cases integer := 0;
  v_n bigint;
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  insert into auth.users (id, email) values (u_member, 'sa011-member@example.test')
    on conflict (id) do nothing;

  insert into public.promotions (name, graduation_year, status) values ('Promo Test Campagnes RLS', 2098, 'active')
  returning id into v_promo_id;

  insert into public.ise_profiles (promotion_id, first_name, last_name, profile_type, profile_status, claim_status, verification_status)
  values (v_promo_id, 'Cible', 'Un', 'graduate', 'referenced', 'unclaimed', 'unverified') returning id into p1;
  insert into public.ise_profiles (promotion_id, first_name, last_name, profile_type, profile_status, claim_status, verification_status)
  values (v_promo_id, 'Cible', 'Deux', 'graduate', 'referenced', 'unclaimed', 'unverified') returning id into p2;
  insert into private.profile_contacts (profile_id, primary_email) values
    (p1, 'sa011-cible1@example.test'), (p2, 'sa011-cible2@example.test');

  -- ===== 1. Refus sans permission (identite membre ordinaire) =====
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_member::text, 'role', 'authenticated')::text, true);

  begin
    perform public.admin_list_promotion_invitations(v_promo_id, null, null, 25);
    v_fail := v_fail || 'S01 liste invitations accessible sans promotions.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S01 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_create_campaign(v_promo_id, 'Campagne interdite', null, 'email', 20, null, null, null);
    v_fail := v_fail || 'S02 creation campagne accessible sans promotions.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S02 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  begin
    perform public.admin_list_campaigns(v_promo_id, null, 25);
    v_fail := v_fail || 'S03 liste campagnes accessible sans promotions.manage'::text;
  exception when others then
    if sqlerrm <> 'not_authorized' then v_fail := v_fail || ('S03 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- ===== 2. Cote admin (bootstrap admin reel) =====
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_auth::text, 'role', 'authenticated')::text, true);

  select public.admin_create_campaign(v_promo_id, 'Campagne smoke RLS', 'objectif test', 'email', 1, null, null, null) into v_campaign;
  v_campaign_id := (v_campaign->>'campaign_id')::uuid;
  v_cases := v_cases + 1;
  if v_campaign_id is null then v_fail := v_fail || 'S04 creation campagne echouee'::text; end if;

  -- S05 : nom trop court refuse.
  begin
    perform public.admin_create_campaign(v_promo_id, 'ab', null, 'email', 20, null, null, null);
    v_fail := v_fail || 'S05 creation avec nom trop court aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'validation_failed' then v_fail := v_fail || ('S05 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S06 : lot 1, daily_quota=1 -> exactement 1 envoye.
  select public.admin_launch_campaign_batch(v_campaign_id) into v_batch1;
  v_cases := v_cases + 1;
  if (v_batch1->>'sent_count')::int <> 1 then
    v_fail := v_fail || format('S06 sent_count attendu 1, obtenu %s', v_batch1->>'sent_count');
  end if;

  -- S07 : jeton renvoye correspond au hash stocke.
  v_token := v_batch1->'invitations'->0->>'token';
  select encode(extensions.digest(v_token, 'sha256'), 'hex') into v_hash_computed;
  select token_hash into v_hash_stored from public.promotion_invitations
    where id = (v_batch1->'invitations'->0->>'invitationId')::uuid;
  v_cases := v_cases + 1;
  if v_hash_computed <> v_hash_stored then v_fail := v_fail || 'S07 jeton renvoye ne correspond pas au hash stocke'::text; end if;

  -- S08 : lot 2, meme jour, quota=1 deja consomme -> echec.
  begin
    perform public.admin_launch_campaign_batch(v_campaign_id);
    v_fail := v_fail || 'S08 lot 2 (meme jour, quota=1) aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'quota_exhausted' then v_fail := v_fail || ('S08 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S09 : admin_get_campaign refleta le statut et le compte de cibles restantes.
  select public.admin_get_campaign(v_campaign_id) into v_get;
  v_cases := v_cases + 1;
  if (v_get->>'status') <> 'running' then v_fail := v_fail || format('S09 statut attendu running, obtenu %s', v_get->>'status'); end if;
  if (v_get->>'eligibleTargets')::int <> 1 then v_fail := v_fail || format('S09 eligibleTargets attendu 1, obtenu %s', v_get->>'eligibleTargets'); end if;

  -- S10 : pause avec motif trop court refusee.
  begin
    perform public.admin_pause_campaign(v_campaign_id, 'court');
    v_fail := v_fail || 'S10 pause avec motif court aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'reason_required' then v_fail := v_fail || ('S10 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- S11 : pause puis reprise reelles.
  perform public.admin_pause_campaign(v_campaign_id, 'pause de test, motif suffisant');
  perform public.admin_resume_campaign(v_campaign_id);
  v_cases := v_cases + 1;

  -- S12 : liste des campagnes contient bien celle-ci.
  select public.admin_list_campaigns(v_promo_id, null, 25) into v_list;
  select count(*) into v_n from jsonb_array_elements(v_list->'rows') r where (r->>'id')::uuid = v_campaign_id;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || 'S12 campagne absente de la liste'::text; end if;

  -- S13 : liste des invitations de la promotion contient bien celle du lot 1.
  select public.admin_list_promotion_invitations(v_promo_id, null, null, 25) into v_invlist;
  select count(*) into v_n from jsonb_array_elements(v_invlist->'rows') r
    where (r->>'campaign_id')::uuid = v_campaign_id;
  v_cases := v_cases + 1;
  if v_n <> 1 then v_fail := v_fail || 'S13 invitation de campagne absente de la liste SA-011'::text; end if;

  -- S14 : cloture avec bilan correct.
  select public.admin_close_campaign(v_campaign_id, 'cloture de test, motif suffisant') into v_close;
  v_cases := v_cases + 1;
  if (v_close->>'status') <> 'completed' then v_fail := v_fail || format('S14 statut cloture attendu completed, obtenu %s', v_close->>'status'); end if;
  if ((v_close->'stats')->>'sent')::int <> 1 then v_fail := v_fail || 'S14 bilan sent incorrect'::text; end if;

  -- S15 : relance apres cloture refusee.
  begin
    perform public.admin_launch_campaign_batch(v_campaign_id);
    v_fail := v_fail || 'S15 lancement apres cloture aurait du echouer'::text;
  exception when others then
    if sqlerrm <> 'campaign_closed' then v_fail := v_fail || ('S15 erreur inattendue ' || sqlerrm); end if;
  end;
  v_cases := v_cases + 1;

  -- ===== 3. Garde-fou global + nettoyage =====
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  select count(*) into v_n from private.security_baseline_violations();
  v_cases := v_cases + 1;
  if v_n <> 0 then v_fail := v_fail || format('S16 security_baseline_violations() renvoie %s ligne(s)', v_n); end if;

  delete from public.domain_events where aggregate_type = 'promotion' and payload->>'campaign_id' = v_campaign_id::text;
  delete from public.promotion_invitations where campaign_id = v_campaign_id;
  delete from public.promotion_activation_campaigns where id = v_campaign_id;
  delete from private.profile_contacts where profile_id in (p1, p2);
  delete from public.ise_profiles where id in (p1, p2);
  delete from public.promotions where id = v_promo_id;
  delete from auth.users where id = u_member;

  if array_length(v_fail, 1) is null then
    raise exception 'SA011_015_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'SA011_015_TESTS_FAILED: % cas, % echec(s)\n  - %', v_cases, array_length(v_fail, 1), array_to_string(v_fail, E'\n  - ');
  end if;
end;
$sa011015$;
