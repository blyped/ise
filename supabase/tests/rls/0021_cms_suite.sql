-- =====================================================================
-- supabase/tests/rls/0021_cms_suite.sql
--
-- Suite NEGATIVE de la couche CMS et du site public (migrations 0057 -> 0063).
--
-- Couvre les exigences de test de l'ADDENDUM §56, §57, §58, §59 :
--   * un membre sans permission CMS n'accede a rien du CMS ;
--   * un editeur modifie un brouillon mais ne publie pas sans cms.publish ;
--   * une edition en cours n'atteint pas le site public (separation §48) ;
--   * une campagne hors periode n'apparait pas ;
--   * une campagne expiree disparait sans intervention humaine ;
--   * une slide sponsorisee sans campagne active disparait avec elle (§26) ;
--   * un profil non eligible n'est JAMAIS « ISE du jour » ;
--   * l'historique empeche une re-selection trop rapprochee ;
--   * l'override est pris en compte, puis l'automatisation reprend ;
--   * AUCUNE donnee privee dans le teaser « ISE du jour » ;
--   * les statistiques proviennent de comptages reels ;
--   * double execution des taches planifiees = idempotence.
--
-- Modele auto-nettoyant : bloc DO unique, fixtures, assertions,
-- RAISE EXCEPTION final qui annule toute la transaction.
--
--   succes  ->  ERROR:  P0001: CMS_TESTS_OK: N cas, 0 echec
--   echec   ->  ERROR:  P0001: CMS_TESTS_FAILED: N cas, K echec(s)
--
-- DERNIERE EXECUTION SUR LA BASE REELLE (2026-08-08, apres 0068) :
--   ERROR:  P0001: CMS_TESTS_OK: 61 cas, 0 echec
--   G12 a ete amende par 0068 : `avatar_path` a quitte le teaser
--   « ISE du jour » (D-135), et G12b verifie qu'il n'y revient pas.
--
-- ECART ASSUME SUR D-104
--   `private.featured_profile_eligible()` exclut volontairement les comptes
--   marques `is_test_account` : un compte de test ne doit jamais paraitre
--   sur le web ouvert. Les profils candidats de cette suite sont donc crees
--   avec `is_test_account = false` — leurs comptes Auth restent prefixes
--   `test+`, et le ROLLBACK final garantit qu'aucune ligne ne subsiste.
--   Le cas G01 verifie par ailleurs qu'un profil MARQUE compte de test
--   n'est jamais selectionne.
--
-- FIXTURES (D-104)
--   Ada   membre ordinaire, AUCUNE permission CMS
--   Bea   cms_editor    (cms.read, cms.edit, cms.media.manage)
--   Cyp   cms_publisher (les sept permissions CMS)
--   Dia   profil eligible, DEJA mis en avant il y a 10 jours
--   Gus   profil eligible
--   Jul   profil eligible
--   Eve   ineligible : allow_public_feature = false
--   Hal   ineligible : public_summary IS NULL
--   Ivy   ineligible : signalement ouvert (moderation active)
--   Tst   tous les champs requis MAIS is_test_account = true
-- =====================================================================

do $cms$
declare
  u_ada uuid := '00000000-0000-4000-8021-000000000001';
  u_bea uuid := '00000000-0000-4000-8021-000000000002';
  u_cyp uuid := '00000000-0000-4000-8021-000000000003';
  u_dia uuid := '00000000-0000-4000-8021-000000000004';
  u_gus uuid := '00000000-0000-4000-8021-000000000005';
  u_jul uuid := '00000000-0000-4000-8021-000000000006';
  u_eve uuid := '00000000-0000-4000-8021-000000000007';
  u_hal uuid := '00000000-0000-4000-8021-000000000008';
  u_ivy uuid := '00000000-0000-4000-8021-000000000009';
  u_tst uuid := '00000000-0000-4000-8021-00000000000a';

  p_ada uuid := '00000000-0000-4000-8021-0000000000a1';
  p_bea uuid := '00000000-0000-4000-8021-0000000000a2';
  p_cyp uuid := '00000000-0000-4000-8021-0000000000a3';
  p_dia uuid := '00000000-0000-4000-8021-0000000000a4';
  p_gus uuid := '00000000-0000-4000-8021-0000000000a5';
  p_jul uuid := '00000000-0000-4000-8021-0000000000a6';
  p_eve uuid := '00000000-0000-4000-8021-0000000000a7';
  p_hal uuid := '00000000-0000-4000-8021-0000000000a8';
  p_ivy uuid := '00000000-0000-4000-8021-0000000000a9';
  p_tst uuid := '00000000-0000-4000-8021-0000000000aa';

  o_org uuid := '00000000-0000-4000-8021-0000000000b1';
  m_one uuid := '00000000-0000-4000-8021-0000000000b2';
  s_plain uuid := '00000000-0000-4000-8021-0000000000c1';
  s_spon  uuid := '00000000-0000-4000-8021-0000000000c2';
  c_live  uuid := '00000000-0000-4000-8021-0000000000d1';
  c_future uuid := '00000000-0000-4000-8021-0000000000d2';
  c_old   uuid := '00000000-0000-4000-8021-0000000000d3';
  sch_one uuid := '00000000-0000-4000-8021-0000000000e1';

  v_promo_a bigint;
  v_promo_b bigint;
  v_reason  text;
  v_today   date := (now() at time zone 'utc')::date;

  v_cases integer := 0;
  v_fail  text[] := array[]::text[];
  v_n     bigint;
  v_ok    boolean;
  v_msg   text;
  v_json  jsonb;
  v_txt   text;
  v_uuid  uuid;
  v_keys  text[];
  v_stats_before bigint;
  v_stats_after  bigint;
begin
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims','',true);

  select id into v_promo_a from public.promotions order by id limit 1;
  select id into v_promo_b from public.promotions order by id desc limit 1;
  select code into v_reason from public.report_reasons order by code limit 1;

  -- ---------------- FIXTURES ----------------
  insert into auth.users (instance_id,id,aud,role,email,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_ada,'authenticated','authenticated','test+cms.ada@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_bea,'authenticated','authenticated','test+cms.bea@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_cyp,'authenticated','authenticated','test+cms.cyp@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_dia,'authenticated','authenticated','test+cms.dia@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_gus,'authenticated','authenticated','test+cms.gus@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_jul,'authenticated','authenticated','test+cms.jul@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_eve,'authenticated','authenticated','test+cms.eve@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_hal,'authenticated','authenticated','test+cms.hal@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_ivy,'authenticated','authenticated','test+cms.ivy@ise.test',now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_tst,'authenticated','authenticated','test+cms.tst@ise.test',now(),now());

  insert into public.ise_profiles
    (id,user_id,first_name,last_name,promotion_id,profile_status,claim_status,claimed_at,
     is_test_account,current_position,public_summary,allow_public_feature) values
    (p_ada,u_ada,'Ada','Cms',v_promo_a,'active','claimed',now(),true ,null,null,false),
    (p_bea,u_bea,'Bea','Cms',v_promo_a,'active','claimed',now(),true ,null,null,false),
    (p_cyp,u_cyp,'Cyp','Cms',v_promo_a,'active','claimed',now(),true ,null,null,false),
    (p_dia,u_dia,'Dia','Une',v_promo_a,'active','claimed',now(),false,'Statisticienne principale',
      'Statisticienne principale, elle conduit des enquetes nationales et forme des equipes de terrain.',true),
    (p_gus,u_gus,'Gus','Une',v_promo_b,'active','claimed',now(),false,'Economiste senior',
      'Economiste senior, il modelise les comptes nationaux et accompagne les politiques publiques.',true),
    (p_jul,u_jul,'Jul','Une',v_promo_b,'active','claimed',now(),false,'Data scientist',
      'Data scientist, elle industrialise des chaines de traitement statistique pour le secteur public.',true),
    (p_eve,u_eve,'Eve','Non',v_promo_a,'active','claimed',now(),false,'Analyste',
      'Analyste des politiques publiques, elle documente les effets des reformes sur le terrain.',false),
    (p_hal,u_hal,'Hal','Non',v_promo_a,'active','claimed',now(),false,'Analyste',null,true),
    (p_ivy,u_ivy,'Ivy','Non',v_promo_a,'active','claimed',now(),false,'Demographe',
      'Demographe, elle etudie les dynamiques de population et la projection des menages.',true),
    (p_tst,u_tst,'Tst','Non',v_promo_a,'active','claimed',now(),true ,'Statisticien',
      'Compte de test portant tous les champs requis, qui ne doit jamais paraitre sur le site public.',true);

  insert into private.user_roles (profile_id, role_id)
  select p_ada, id from private.roles where code='member';
  insert into private.user_roles (profile_id, role_id)
  select p_bea, id from private.roles where code='cms_editor';
  insert into private.user_roles (profile_id, role_id)
  select p_cyp, id from private.roles where code='cms_publisher';

  -- Ivy porte un signalement OUVERT : moderation active.
  insert into public.reports (reporter_profile_id,target_type,target_id,reason_code,description,status)
  values (p_ada,'profile',p_ivy,v_reason,'Signalement de test, file de moderation ouverte.','open');

  insert into public.organizations (id,canonical_name,is_verified)
  values (o_org,'Organisation partenaire de test',true);

  insert into public.cms_media_assets (id,storage_path,filename,mime_type,alt_text,created_by_profile_id)
  values (m_one,'cms/test/0021-visuel.webp','0021-visuel.webp','image/webp',
          'Visuel de test du carrousel',p_cyp);

  insert into public.cms_carousel_items (id,title,subtitle,media_id,content_type,priority,
                                         is_sponsored,created_by_profile_id,status)
  values (s_plain,'TITRE PUBLIE','Sous-titre',m_one,'institutional',10,false,p_cyp,'draft');

  insert into public.cms_partner_campaigns
    (id,organization_id,campaign_name,placement,title,media_id,cta_label,target_url,
     sponsored_label,start_at,end_at,created_by_profile_id,status)
  values
    (c_live  ,o_org,'Campagne en cours','partners_band','Campagne active',m_one,'Decouvrir',
     'https://exemple.test/partenaire','Contenu partenaire',now()-interval '1 day',now()+interval '10 day',p_cyp,'draft'),
    (c_future,o_org,'Campagne future','partners_band','Campagne a venir',m_one,'Decouvrir',
     'https://exemple.test/futur','Sponsorise',now()+interval '10 day',now()+interval '20 day',p_cyp,'draft'),
    (c_old   ,o_org,'Campagne echue','partners_band','Campagne terminee',m_one,'Decouvrir',
     'https://exemple.test/echu','Partenaire',now()-interval '10 day',now()-interval '1 day',p_cyp,'draft');

  insert into public.cms_carousel_items (id,title,media_id,content_type,priority,
                                         is_sponsored,partner_campaign_id,created_by_profile_id,status)
  values (s_spon,'SLIDE SPONSORISEE',m_one,'partner',5,true,c_live,p_cyp,'draft');

  insert into public.cms_publication_schedule (id,entity_type,entity_id,publish_at,created_by_profile_id)
  values (sch_one,'cms_carousel_item',s_plain,now()+interval '30 day',p_cyp);

  -- =================================================================
  -- B. ADA — membre ordinaire, aucune permission CMS (§59)
  -- =================================================================
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_ada::text,'role','authenticated')::text,true);

  select count(*) into v_n from public.cms_carousel_items; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('B01 un membre sans permission voit %s slide(s)',v_n); end if;

  select count(*) into v_n from public.cms_sections; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('B02 un membre sans permission voit %s section(s)',v_n); end if;

  select count(*) into v_n from public.cms_partner_campaigns; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('B03 un membre sans permission voit %s campagne(s)',v_n); end if;

  select count(*) into v_n from public.cms_featured_profile_history; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('B04 un membre sans permission voit l''historique ISE du jour (%s)',v_n); end if;

  update public.cms_carousel_items set title='DETOURNE' where id=s_plain;
  get diagnostics v_n=row_count; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('B05 un membre sans permission a modifie une slide (%s ligne(s))',v_n); end if;

  v_msg:=null;
  begin
    perform public.get_cms_automation_status();
    v_ok:=false; v_msg:='etat des automatisations lisible sans permission';
  exception when others then v_ok:=(sqlerrm='not_authorized');
    if not v_ok then v_msg:='erreur inattendue : '||sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('B06 '||coalesce(v_msg,'')); end if;

  -- =================================================================
  -- C. BEA — cms_editor : edite un brouillon, ne publie pas (§59)
  -- =================================================================
  perform set_config('request.jwt.claims',json_build_object('sub',u_bea::text,'role','authenticated')::text,true);

  select count(*) into v_n from public.cms_sections; v_cases:=v_cases+1;
  if v_n=0 then v_fail:=v_fail||'C01 un cms_editor ne lit aucune section'; end if;

  update public.cms_carousel_items set subtitle='Sous-titre revu par l''editeur' where id=s_plain;
  get diagnostics v_n=row_count; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('C02 un cms_editor ne peut pas modifier un brouillon (%s ligne(s))',v_n); end if;

  v_msg:=null;
  begin
    perform public.publish_cms_content('cms_carousel_item', s_plain);
    v_ok:=false; v_msg:='un cms_editor a publie sans cms.publish';
  exception when others then v_ok:=(sqlerrm='not_authorized');
    if not v_ok then v_msg:='erreur inattendue : '||sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('C03 '||coalesce(v_msg,'')); end if;

  v_msg:=null;
  begin
    update public.cms_carousel_items set status='published' where id=s_plain;
    v_ok:=false; v_msg:='statut publie ecrit directement en UPDATE';
  exception when others then v_ok:=(sqlerrm='invalid_transition');
    if not v_ok then v_msg:='erreur inattendue : '||sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('C04 '||coalesce(v_msg,'')); end if;

  delete from public.cms_carousel_items where id=s_plain;
  get diagnostics v_n=row_count; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('C05 un cms_editor a supprime une slide (%s ligne(s))',v_n); end if;

  update public.cms_partner_campaigns set title='Detourne' where id=c_live;
  get diagnostics v_n=row_count; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('C06 un cms_editor a modifie une campagne sans cms.partners.manage (%s)',v_n); end if;

  update public.cms_publication_schedule set status='applied', applied_at=now() where id=sch_one;
  get diagnostics v_n=row_count; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('C07 un cms_editor sans cms.schedule a declare un ordre applique (%s ligne(s))',v_n); end if;

  -- =================================================================
  -- D. CYP — cms_publisher : chemins legitimes
  -- =================================================================
  perform set_config('request.jwt.claims',json_build_object('sub',u_cyp::text,'role','authenticated')::text,true);

  perform public.publish_cms_content('cms_carousel_item', s_plain);
  perform public.publish_cms_content('cms_carousel_item', s_spon);
  perform public.publish_cms_content('cms_partner_campaign', c_live);
  perform public.publish_cms_content('cms_partner_campaign', c_future);
  perform public.publish_cms_content('cms_partner_campaign', c_old);

  select count(*) into v_n from public.cms_carousel_items
   where id=s_plain and status='published' and published_snapshot is not null; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||'D01 la publication n''a pas fige d''instantane'; end if;

  v_msg:=null;
  begin
    perform public.transition_cms_content('cms_carousel_item', s_plain, 'published');
    v_ok:=false; v_msg:='transition_cms_content a accepte published';
  exception when others then v_ok:=(sqlerrm='use_publish_cms_content');
    if not v_ok then v_msg:='erreur inattendue : '||sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('D02 '||coalesce(v_msg,'')); end if;

  -- =================================================================
  -- E. PROJECTIONS PUBLIQUES
  -- =================================================================
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims','',true);

  v_json := public.get_landing_carousel();
  v_cases:=v_cases+1;
  if not (v_json @> '[{"title":"TITRE PUBLIE"}]'::jsonb) then
    v_fail:=v_fail||'E01 la slide publiee n''apparait pas sur la landing';
  end if;

  -- §48 : une edition en cours n'atteint pas le site public.
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_bea::text,'role','authenticated')::text,true);
  update public.cms_carousel_items set title='BROUILLON NON PUBLIE' where id=s_plain;
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims','',true);

  v_json := public.get_landing_carousel();
  v_cases:=v_cases+1;
  if v_json::text like '%BROUILLON NON PUBLIE%' then
    v_fail:=v_fail||'E02 une edition non publiee a atteint le site public (separation brouillon/publie)';
  end if;
  v_cases:=v_cases+1;
  if not (v_json @> '[{"title":"TITRE PUBLIE"}]'::jsonb) then
    v_fail:=v_fail||'E03 la derniere version publiee n''est plus servie';
  end if;

  -- §58 : une campagne hors periode n'apparait pas.
  v_json := public.get_landing_partners();
  v_cases:=v_cases+1;
  if not (v_json @> '[{"campaign_name":"Campagne en cours"}]'::jsonb) then
    v_fail:=v_fail||'E04 la campagne active n''apparait pas';
  end if;
  v_cases:=v_cases+1;
  if v_json::text like '%Campagne future%' then
    v_fail:=v_fail||'E05 une campagne HORS PERIODE (a venir) apparait sur la landing';
  end if;
  v_cases:=v_cases+1;
  if v_json::text like '%Campagne echue%' then
    v_fail:=v_fail||'E06 une campagne ECHUE apparait sur la landing';
  end if;

  -- §26 : toute campagne diffusee porte sa mention de transparence.
  v_cases:=v_cases+1;
  if exists (select 1 from jsonb_array_elements(v_json) as e(value)
              where coalesce(e.value->>'sponsored_label','')='') then
    v_fail:=v_fail||'E07 une campagne est diffusee SANS mention de transparence';
  end if;

  -- =================================================================
  -- F. EXPIRATION AUTOMATIQUE ET IDEMPOTENCE (§27, §57)
  -- =================================================================
  v_json := private.expire_cms_content();
  v_cases:=v_cases+1;
  if (v_json->>'campaigns_expired')::int < 1 then
    v_fail:=v_fail||format('F01 la campagne echue n''a pas ete expiree automatiquement (%s)',v_json->>'campaigns_expired');
  end if;

  select count(*) into v_n from public.cms_partner_campaigns
   where id=c_old and status='expired' and published_snapshot is null; v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||'F02 la campagne echue n''est pas passee a expired'; end if;

  -- Double execution du cron : idempotence.
  v_json := private.expire_cms_content();
  v_cases:=v_cases+1;
  if (v_json->>'campaigns_expired')::int <> 0 then
    v_fail:=v_fail||format('F03 seconde execution NON idempotente (%s campagne(s) re-expiree(s))',v_json->>'campaigns_expired');
  end if;

  -- §26 : une slide sponsorisee ne survit pas a sa campagne.
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_cyp::text,'role','authenticated')::text,true);
  perform public.transition_cms_content('cms_partner_campaign', c_live, 'expired', 'Fin de test');
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims','',true);

  perform private.expire_cms_content();
  v_json := public.get_landing_carousel();
  v_cases:=v_cases+1;
  if v_json::text like '%SLIDE SPONSORISEE%' then
    v_fail:=v_fail||'F04 une slide sponsorisee survit a l''expiration de sa campagne';
  end if;

  -- =================================================================
  -- G. ISE DU JOUR (§56)
  -- =================================================================
  -- Dia a ete mise en avant il y a 10 jours : la regle des 90 jours l'exclut.
  insert into public.cms_featured_profile_history
    (profile_id,featured_date,selection_mode,status,published_at)
  values (p_dia, v_today - 10, 'automatic', 'published', now() - interval '10 day');

  v_json := private.run_daily_featured_profile(v_today);
  v_uuid := (v_json->>'profile_id')::uuid;

  v_cases:=v_cases+1;
  if v_uuid is null then
    v_fail:=v_fail||format('G00 aucune selection alors que le vivier est non vide (%s)',v_json::text);
  end if;
  v_cases:=v_cases+1;
  if v_uuid = p_tst then v_fail:=v_fail||'G01 un COMPTE DE TEST a ete selectionne comme ISE du jour'; end if;
  v_cases:=v_cases+1;
  if v_uuid = p_eve then v_fail:=v_fail||'G02 un profil SANS consentement (allow_public_feature) a ete selectionne'; end if;
  v_cases:=v_cases+1;
  if v_uuid = p_hal then v_fail:=v_fail||'G03 un profil SANS public_summary a ete selectionne'; end if;
  v_cases:=v_cases+1;
  if v_uuid = p_ivy then v_fail:=v_fail||'G04 un profil sous MODERATION ACTIVE a ete selectionne'; end if;
  v_cases:=v_cases+1;
  if v_uuid = p_dia then v_fail:=v_fail||'G05 l''historique n''empeche pas une re-selection a 10 jours (regle 90 jours)'; end if;
  v_cases:=v_cases+1;
  if v_uuid is not null and v_uuid not in (p_gus, p_jul) then
    v_fail:=v_fail||format('G06 profil selectionne hors du vivier eligible (%s)',v_uuid);
  end if;

  -- Idempotence de la selection quotidienne.
  v_json := private.run_daily_featured_profile(v_today);
  v_cases:=v_cases+1;
  if (v_json->>'created')::boolean then
    v_fail:=v_fail||'G07 seconde execution de la selection NON idempotente (nouvelle ligne creee)';
  end if;
  select count(*) into v_n from public.cms_featured_profile_history where featured_date=v_today;
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('G08 %s lignes d''historique pour la meme journee',v_n); end if;

  -- Publication, puis idempotence de la publication.
  v_json := private.publish_featured_profile(v_today);
  v_cases:=v_cases+1;
  if not (v_json->>'published')::boolean then v_fail:=v_fail||'G09 la selection du jour n''a pas ete publiee'; end if;
  v_json := private.publish_featured_profile(v_today);
  v_cases:=v_cases+1;
  if (v_json->>'published')::boolean then
    v_fail:=v_fail||'G10 seconde publication NON idempotente';
  end if;

  -- §14 CDC : AUCUNE donnee privee dans le teaser.
  v_json := public.get_landing_featured_profile();
  v_cases:=v_cases+1;
  if v_json is null then v_fail:=v_fail||'G11 le teaser ISE du jour est vide alors qu''une selection est publiee'; end if;

  if v_json is not null then
    select array_agg(k order by k) into v_keys from jsonb_object_keys(v_json) k;
    v_cases:=v_cases+1;
    -- D-135 (migration 0068) : `avatar_path` a QUITTE cette liste. Le bucket
    -- `avatars` est prive, le chemin n'etait donc chargeable par personne, et
    -- le projeter divulguait la structure d'un espace prive a un visiteur
    -- anonyme pour rien. Le teaser affiche un monogramme.
    if v_keys <> array['current_position','display_name','entity_type','expertise_areas',
                       'featured_date','organization','profile_id','promotion','public_summary','selection_mode'] then
      v_fail:=v_fail||format('G12 le teaser expose des champs inattendus : %s',array_to_string(v_keys,','));
    end if;
    v_cases:=v_cases+1;
    if v_json ? 'avatar_path' then
      v_fail:=v_fail||'G12b le teaser projette encore avatar_path (D-135)';
    end if;
    v_cases:=v_cases+1;
    if v_json::text ~* '(@ise\.test|email|telephone|phone|profile_completion|birth|bio|headline)' then
      v_fail:=v_fail||'G13 une donnee privee apparait dans le teaser ISE du jour';
    end if;
    v_cases:=v_cases+1;
    if coalesce(v_json->>'public_summary','')='' then
      v_fail:=v_fail||'G14 le teaser ne porte pas le resume public';
    end if;
  else
    v_cases:=v_cases+3;
    v_fail:=v_fail||'G12/G13/G14 teaser absent : les trois controles de confidentialite n''ont pas pu s''executer';
  end if;

  -- Override manuel (§22) : Dia, pourtant exclue par la regle des 90 jours.
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_cyp::text,'role','authenticated')::text,true);
  perform public.override_featured_profile(p_dia, now(), null, 'Mise en avant editoriale de test');
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims','',true);

  v_json := private.run_daily_featured_profile(v_today + 1);
  v_cases:=v_cases+1;
  if (v_json->>'profile_id')::uuid is distinct from p_dia then
    v_fail:=v_fail||format('G15 l''override manuel n''a pas ete pris en compte (%s)',v_json::text);
  end if;
  v_cases:=v_cases+1;
  if v_json->>'selection_mode' <> 'manual' then
    v_fail:=v_fail||format('G16 le mode de selection n''est pas manual (%s)',v_json->>'selection_mode');
  end if;

  -- Un profil NON ELIGIBLE ne peut pas etre force (§17).
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_cyp::text,'role','authenticated')::text,true);
  v_msg:=null;
  begin
    perform public.override_featured_profile(p_eve, now(), null, 'Tentative interdite');
    v_ok:=false; v_msg:='un profil sans consentement a pu etre force';
  exception when others then v_ok:=(sqlerrm='profile_not_eligible');
    if not v_ok then v_msg:='erreur inattendue : '||sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('G17 '||coalesce(v_msg,'')); end if;

  -- Reprise de l'automatisation : l'epinglage est clos, la source reprend.
  perform public.set_featured_profile_automation(true, 'Reprise de test');
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims','',true);

  -- La cloture pose `greatest(now(), starts_at + 1 ms)` (correctif 0065) :
  -- un epinglage clos peut donc finir une milliseconde apres `now()`. Ce qui
  -- doit etre verifie, c'est qu'aucun epinglage ne reste OUVERT ni actif
  -- au-dela de l'instant de la reprise.
  select count(*) into v_n from public.cms_content_overrides
   where section_key='featured_profile' and override_kind='pin'
     and (ends_at is null or ends_at > now() + interval '1 second'); v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('G18 un epinglage reste actif apres reprise de l''automatisation (%s)',v_n); end if;

  v_json := private.run_daily_featured_profile(v_today + 2);
  v_cases:=v_cases+1;
  if coalesce(v_json->>'selection_mode','') = 'manual' then
    v_fail:=v_fail||'G19 l''automatisation n''a pas repris apres l''override';
  end if;
  v_cases:=v_cases+1;
  if (v_json->>'profile_id')::uuid is not null and (v_json->>'profile_id')::uuid = p_dia then
    v_fail:=v_fail||'G20 le profil epingle reste selectionne apres reprise';
  end if;

  -- Suspension de l'automatisation (§22).
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_cyp::text,'role','authenticated')::text,true);
  perform public.set_featured_profile_automation(false, 'Suspension de test');
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims','',true);
  v_json := private.run_daily_featured_profile(v_today + 3);
  v_cases:=v_cases+1;
  if coalesce(v_json->>'reason','') <> 'automation_suspended' then
    v_fail:=v_fail||format('G21 l''automatisation suspendue a quand meme selectionne (%s)',v_json::text);
  end if;

  -- =================================================================
  -- H. STATISTIQUES CALCULEES SUR DES DONNEES REELLES (§23)
  -- =================================================================
  v_json := public.get_landing_stats();
  select count(*) into v_stats_before from public.ise_profiles p
   where p.deleted_at is null and not p.is_test_account
     and p.profile_status in ('referenced','active');
  v_cases:=v_cases+1;
  if (v_json->'profiles'->>'value')::bigint <> v_stats_before then
    v_fail:=v_fail||format('H01 le compteur de profils (%s) ne correspond pas au comptage reel (%s)',
                           v_json->'profiles'->>'value', v_stats_before);
  end if;

  insert into public.ise_profiles (first_name,last_name,promotion_id,profile_status,is_test_account)
  values ('Zoe','Stat',v_promo_a,'referenced',false);
  v_json := public.get_landing_stats();
  v_stats_after := (v_json->'profiles'->>'value')::bigint;
  v_cases:=v_cases+1;
  if v_stats_after <> v_stats_before + 1 then
    v_fail:=v_fail||format('H02 le compteur n''a pas suivi l''ajout d''un profil (%s -> %s)',
                           v_stats_before, v_stats_after);
  end if;

  v_cases:=v_cases+1;
  if coalesce(v_json->'promotions'->>'source','')='' or coalesce(v_json->'countries'->>'source','')='' then
    v_fail:=v_fail||'H03 un compteur ne nomme pas sa source (MASTER PROMPT §98)';
  end if;

  -- Aucun chiffre d'illustration des maquettes ne doit apparaitre.
  v_cases:=v_cases+1;
  if (v_json->'profiles'->>'value')::bigint = 1842
     or (v_json->'promotions'->>'value')::bigint = 37
     or (v_json->'countries'->>'value')::bigint = 29
     or (v_json->'organizations'->>'value')::bigint = 126 then
    v_fail:=v_fail||'H04 un chiffre d''illustration des maquettes est renvoye en Production';
  end if;

  -- =================================================================
  -- I. ANALYTICS PUBLICS (§50, §51)
  -- =================================================================
  perform public.record_public_landing_event('public_partner_impression','cms_partner_campaign',c_live,
                                             'corr-0021', '{"placement":"partners_band","secret":"a jeter"}'::jsonb);
  perform public.record_public_landing_event('public_partner_impression','cms_partner_campaign',c_live);
  perform public.record_public_landing_event('public_partner_click','cms_partner_campaign',c_live);

  select count(*) into v_n from analytics.profile_activity_events
   where entity_id=c_live and event_type='public_partner_impression'; v_cases:=v_cases+1;
  if v_n<>2 then v_fail:=v_fail||format('I01 %s impression(s) enregistree(s) au lieu de 2',v_n); end if;

  select count(*) into v_n from analytics.profile_activity_events
   where entity_id=c_live and metadata ? 'secret'; v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||'I02 une cle de metadonnees hors liste blanche a ete stockee'; end if;

  v_msg:=null;
  begin
    perform public.record_public_landing_event('profile_viewed', null, null);
    v_ok:=false; v_msg:='un type d''evenement non public a ete accepte';
  exception when others then v_ok:=(sqlerrm='unknown_event_type');
    if not v_ok then v_msg:='erreur inattendue : '||sqlerrm; end if; end;
  v_cases:=v_cases+1; if not v_ok then v_fail:=v_fail||('I03 '||coalesce(v_msg,'')); end if;

  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_cyp::text,'role','authenticated')::text,true);
  v_json := public.get_partner_campaign_metrics(c_live);
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims','',true);

  v_cases:=v_cases+1;
  if (v_json->'campaigns'->0->>'impressions')::int <> 2
     or (v_json->'campaigns'->0->>'clicks')::int <> 1 then
    v_fail:=v_fail||format('I04 metriques partenaires incorrectes : %s',v_json->'campaigns'->0);
  end if;
  v_cases:=v_cases+1;
  if (v_json->'campaigns'->0->>'ctr')::numeric <> 0.5 then
    v_fail:=v_fail||format('I05 CTR calcule incorrect (%s), attendu 0.5',v_json->'campaigns'->0->>'ctr');
  end if;

  -- Une campagne sans impression n'invente pas de CTR.
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_cyp::text,'role','authenticated')::text,true);
  v_json := public.get_partner_campaign_metrics(c_future);
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims','',true);
  v_cases:=v_cases+1;
  if v_json->'campaigns'->0->>'ctr' is not null then
    v_fail:=v_fail||format('I06 un CTR a ete fabrique sans impression (%s)',v_json->'campaigns'->0->>'ctr');
  end if;

  -- =================================================================
  -- J. LIGNE DE BASE DE SECURITE
  -- =================================================================
  select count(*) into v_n from private.security_baseline_violations(); v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('J01 security_baseline_violations() renvoie %s ligne(s)',v_n); end if;

  select count(*) into v_n from private.tables_without_rls(); v_cases:=v_cases+1;
  if v_n<>0 then v_fail:=v_fail||format('J02 tables_without_rls() renvoie %s ligne(s)',v_n); end if;

  if array_length(v_fail,1) is null then
    raise exception 'CMS_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception E'CMS_TESTS_FAILED: % cas, % echec(s)\n  - %',
      v_cases, array_length(v_fail,1), array_to_string(v_fail,E'\n  - ');
  end if;
end
$cms$;
