-- =====================================================================
-- supabase/tests/rls/0031_imports_suite.sql
--
-- Suite du lot « Imports d'annuaire, analytics et parametres » (0080 a
-- 0084). Modele auto-nettoyant : l'exception finale annule la
-- transaction, rien ne persiste.
--
--   succes -> ERROR: P0001: IMPORTS_TESTS_OK: <n> cas, 0 echec
--
-- COUVERTURE
--   A01-A06  un membre sans permission imports.* ne lance rien et ne lit
--            rien ; le schema private lui est ferme
--   B01-B05  workflow §37 : creation du lot, empreinte idempotente,
--            staging brut, mapping exhaustif obligatoire
--   C01-C06  validation, normalisation, detection de doublons : un
--            candidat externe est cree contre le profil existant, le
--            doublon interne part en revue humaine
--   D01-D04  l'import refuse de demarrer avant la revue ; la fusion
--            exige un candidat confirme par un humain ; la revue est
--            journalisee
--   E01-E08  execution : profils references crees (user_id NULL,
--            unclaimed), AUCUN auth.users cree (compte avant/apres),
--            deux lignes semblables ne font qu'UN profil, rapport
--            persiste, rejouer le lot ne duplique rien
--   F01      le profil importe est trouvable par search_claimable_profiles
--   G01-G05  parametres : permission exigee, secret refuse, modification
--            journalisee ; maintenance planifiee, transitions reelles
--
-- FIXTURES : Mem (membre simple) · Imp (import_manager = imports.execute
-- + imports.review) · Adm (superadmin, settings.manage) · Cli (compte
-- sans profil) · P_x (profil reference existant, cible de doublon)
-- =====================================================================

do $imp$
declare
  u_m uuid:='00000000-0000-4000-8031-000000000001';
  u_i uuid:='00000000-0000-4000-8031-000000000002';
  u_a uuid:='00000000-0000-4000-8031-000000000003';
  u_c uuid:='00000000-0000-4000-8031-000000000004';
  p_m uuid:='00000000-0000-4000-8031-0000000000a1';
  p_i uuid:='00000000-0000-4000-8031-0000000000a2';
  p_a uuid:='00000000-0000-4000-8031-0000000000a3';
  p_x uuid:='00000000-0000-4000-8031-0000000000b1';
  v_promo bigint; v_batch uuid; v_json jsonb; v_msg text; v_txt text;
  v_n bigint; v_users_before bigint; v_row1 bigint; v_row3 bigint;
  v_cand uuid; v_profile uuid; v_win uuid;
  v_rows jsonb;
  v_cases integer:=0; v_fail text[]:=array[]::text[];
begin
  perform set_config('role','postgres',true); perform set_config('request.jwt.claims','',true);

  insert into auth.users (instance_id,id,aud,role,email,email_confirmed_at,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000',u_m,'authenticated','authenticated','test+imp.mem@ise.test',now(),now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_i,'authenticated','authenticated','test+imp.imp@ise.test',now(),now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_a,'authenticated','authenticated','test+imp.adm@ise.test',now(),now(),now()),
    ('00000000-0000-0000-0000-000000000000',u_c,'authenticated','authenticated','test+imp.cli@ise.test',now(),now(),now());

  select id into v_promo from public.promotions where graduation_year=2003 and program_code='ISE' limit 1;

  insert into public.ise_profiles (id,user_id,first_name,last_name,promotion_id,profile_status,claim_status,claimed_at,is_test_account) values
    (p_m,u_m,'Mem','Membretest',v_promo,'active','claimed',now(),true),
    (p_i,u_i,'Imp','Gestionnaire',v_promo,'active','claimed',now(),true),
    (p_a,u_a,'Adm','Plateforme',v_promo,'active','claimed',now(),true);

  -- Profil REFERENCE existant : cible du rapprochement externe.
  insert into public.ise_profiles (id,first_name,last_name,promotion_id,profile_status,claim_status,is_test_account) values
    (p_x,'Aicha','Dialotest',v_promo,'referenced','unclaimed',true);
  insert into private.profile_contacts (profile_id,primary_email) values (p_x,'aicha.dialotest@ise.test');

  insert into private.user_roles (profile_id,role_id)
  select p_i, r.id from private.roles r where r.code='import_manager';
  insert into private.user_roles (profile_id,role_id)
  select p_a, r.id from private.roles r where r.code='superadmin';

  select count(*) into v_users_before from auth.users;

  ---------------------------------------------------------------- A. Mem, sans permission imports.*
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',u_m::text,'role','authenticated')::text,true);

  v_msg:=null; begin v_json:=public.admin_imports_overview(); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_authorized' then v_fail:=v_fail||format('A01 vue d''ensemble ouverte sans permission (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_msg:=null; begin perform * from public.admin_list_import_batches(); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_authorized' then v_fail:=v_fail||format('A02 liste des lots ouverte sans permission (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_msg:=null; begin
    v_txt:=public.admin_create_import_batch('Annuaire interdit','x.csv','csv')::text;
  exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_authorized' then v_fail:=v_fail||format('A03 creation de lot possible sans permission (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_msg:=null; begin perform * from public.admin_list_import_rows(extensions.gen_random_uuid()); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_authorized' then v_fail:=v_fail||format('A04 lecture des lignes possible sans permission (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_msg:=null; begin perform * from private.import_batches; exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is null then v_fail:=array_append(v_fail,'A05 le schema private est lisible par un membre'); end if;

  v_msg:=null; begin v_json:=public.admin_review_duplicate_candidate(extensions.gen_random_uuid(),'confirmed_duplicate'); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_authorized' then v_fail:=v_fail||format('A06 revue de doublon possible sans permission (%s)',coalesce(v_msg,'aucune erreur')); end if;

  ---------------------------------------------------------------- B. Imp : upload -> staging -> mapping
  perform set_config('request.jwt.claims',json_build_object('sub',u_i::text,'role','authenticated')::text,true);

  v_batch:=public.admin_create_import_batch('Annuaire test 1998-2003','annuaire_test.csv','csv',
            date '2024-01-15','sha256-test-empreinte-0031',false,null,null,null);
  v_cases:=v_cases+1;
  if v_batch is null then v_fail:=array_append(v_fail,'B01 creation du lot en echec'); end if;

  -- Idempotence du fichier : la meme empreinte est refusee.
  v_msg:=null; begin
    v_txt:=public.admin_create_import_batch('Annuaire test rejoue','annuaire_test.csv','csv',
             null,'sha256-test-empreinte-0031')::text;
  exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'import_file_already_loaded' then v_fail:=v_fail||format('B02 le meme fichier est recharge sans refus (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_rows:=jsonb_build_array(
    jsonb_build_object('n',1,'d',jsonb_build_object('Nom','Dialotest','Prenom','Aicha','Promotion','2003','Email','aicha.dialotest@ise.test')),
    jsonb_build_object('n',2,'d',jsonb_build_object('Nom','Ndiayetest','Prenom','Moussa','Promotion','2003','Email','moussa.ndiayetest@ise.test')),
    jsonb_build_object('n',3,'d',jsonb_build_object('Nom','Ndiayetest','Prenom','Moussa','Promotion','2003','Email','moussa.ndiayetest@ise.test ')));

  v_json:=public.admin_stage_import_rows(v_batch,'test/annuaire_test.csv',v_rows,null);
  v_cases:=v_cases+1;
  if (v_json->>'staged_rows')::int<>3 then v_fail:=v_fail||format('B03 staging incomplet (%s)',v_json); end if;

  -- La donnee brute est conservee telle quelle.
  perform set_config('role','postgres',true);
  select count(*) into v_n from private.import_rows
   where batch_id=v_batch and raw_source_data->>'Nom' is not null;
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_n<>3 then v_fail:=v_fail||format('B04 raw_source_data absent (%s)',v_n); end if;

  -- Mapping incomplet : une colonne sans decision est refusee.
  v_msg:=null; begin
    v_json:=public.admin_set_import_mapping(v_batch,jsonb_build_array(
      jsonb_build_object('source_column','Nom','target_field','last_name','transform','normalize_name'),
      jsonb_build_object('source_column','Prenom','target_field','first_name','transform','normalize_name'),
      jsonb_build_object('source_column','Promotion','target_field','promotion_year','transform','parse_integer')));
  exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'import_mapping_incomplete' then v_fail:=v_fail||format('B05 mapping incomplet accepte (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_json:=public.admin_set_import_mapping(v_batch,jsonb_build_array(
    jsonb_build_object('source_column','Nom','source_position',1,'target_field','last_name','transform','normalize_name'),
    jsonb_build_object('source_column','Prenom','source_position',2,'target_field','first_name','transform','normalize_name'),
    jsonb_build_object('source_column','Promotion','source_position',3,'target_field','promotion_year','transform','parse_integer'),
    jsonb_build_object('source_column','Email','source_position',4,'target_field','email','transform','normalize_email')));

  ---------------------------------------------------------------- C. validation -> normalisation -> doublons
  v_json:=public.admin_validate_import_batch(v_batch);
  v_cases:=v_cases+1;
  if (v_json->>'valid')::int<>3 or (v_json->>'invalid')::int<>0
    then v_fail:=v_fail||format('C01 validation inattendue (%s)',v_json); end if;

  v_json:=public.admin_normalize_import_batch(v_batch);
  v_cases:=v_cases+1;
  if (v_json->>'rows')::int<>3 then v_fail:=v_fail||format('C02 normalisation inattendue (%s)',v_json); end if;

  -- L'email est bien normalise en minuscules, sans perte du brut.
  perform set_config('role','postgres',true);
  select count(*) into v_n from private.import_rows
   where batch_id=v_batch and row_number=3
     and normalized_data->'_norm'->>'email'='moussa.ndiayetest@ise.test'
     and raw_source_data->>'Email' like '% ';
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=array_append(v_fail,'C03 normalisation email sans conservation du brut'); end if;

  v_json:=public.admin_detect_import_duplicates(v_batch);
  v_cases:=v_cases+1;
  if (v_json->>'candidates')::int<1 then v_fail:=v_fail||format('C04 aucun candidat externe detecte (%s)',v_json); end if;

  -- Deux lignes semblables produisent un candidat / une revue, PAS deux profils.
  perform set_config('role','postgres',true);
  select dc.id into v_cand from private.duplicate_candidates dc
   join private.import_rows ir on ir.id=dc.import_row_id
   where dc.batch_id=v_batch and dc.existing_profile_id=p_x and ir.row_number=1;
  select id into v_row1 from private.import_rows where batch_id=v_batch and row_number=1;
  select id into v_row3 from private.import_rows where batch_id=v_batch and row_number=3;
  select count(*) into v_n from private.import_rows
   where batch_id=v_batch and row_number=3 and status='needs_review';
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_cand is null then v_fail:=array_append(v_fail,'C05 le profil existant n''est pas propose comme doublon'); end if;
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=array_append(v_fail,'C06 le doublon interne du lot n''est pas envoye en revue'); end if;

  ---------------------------------------------------------------- D. la revue humaine est obligatoire
  v_msg:=null; begin v_json:=public.admin_execute_import_batch(v_batch); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg not in ('import_review_pending','duplicate_review_pending')
    then v_fail:=v_fail||format('D01 import lance malgre la revue en attente (%s)',coalesce(v_msg,'aucune erreur')); end if;

  -- Fusion sans candidat confirme par un humain : refusee.
  v_msg:=null; begin v_json:=public.admin_decide_import_row(v_row1,'merge',p_x); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'import_merge_requires_confirmed_duplicate'
    then v_fail:=v_fail||format('D02 fusion possible sans doublon confirme (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_json:=public.admin_review_duplicate_candidate(v_cand,'confirmed_duplicate','Meme personne : email et promotion identiques.');
  perform set_config('role','postgres',true);
  select count(*) into v_n from private.duplicate_candidates
   where id=v_cand and status='confirmed_duplicate' and reviewed_by_profile_id=p_i and reviewed_at is not null;
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=array_append(v_fail,'D03 la revue du candidat n''enregistre pas le reviseur'); end if;

  -- La decision est journalisee.
  perform set_config('role','postgres',true);
  select count(*) into v_n from private.audit_log
   where action='import.duplicate_reviewed' and object_id=v_cand::text and actor_profile_id=p_i;
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_n<1 then v_fail:=array_append(v_fail,'D04 la revue du doublon n''est pas journalisee'); end if;

  v_json:=public.admin_decide_import_row(v_row1,'merge',p_x);
  v_json:=public.admin_decide_import_row(v_row3,'ignore',null);

  ---------------------------------------------------------------- E. execution : profils references, jamais de compte
  v_json:=public.admin_execute_import_batch(v_batch);
  v_cases:=v_cases+1;
  if (v_json->>'created_profiles')::int<>1 or (v_json->>'updated_profiles')::int<>1
     or (v_json->>'ignored_rows')::int<>1
    then v_fail:=v_fail||format('E01 totaux du rapport inattendus (%s)',v_json); end if;

  -- ASSERTION CENTRALE (MASTER PROMPT §6, D-104) : aucun compte cree.
  perform set_config('role','postgres',true);
  select count(*) into v_n from auth.users;
  v_cases:=v_cases+1;
  if v_n<>v_users_before then v_fail:=v_fail||format('E02 l''import a cree %s compte(s) auth.users',v_n-v_users_before); end if;

  select ir.resulting_profile_id into v_profile from private.import_rows ir
   where ir.batch_id=v_batch and ir.row_number=2;
  select count(*) into v_n from public.ise_profiles
   where id=v_profile and user_id is null and claim_status='unclaimed' and profile_status='referenced';
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=array_append(v_fail,'E03 le profil importe n''est pas un profil reference non reclame'); end if;

  -- Coordonnee historique privee, jamais publique.
  select count(*) into v_n from private.profile_contacts
   where profile_id=v_profile and primary_email='moussa.ndiayetest@ise.test';
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=array_append(v_fail,'E04 l''email historique n''est pas conserve en zone privee'); end if;

  -- Deux lignes semblables -> UN seul profil.
  select count(*) into v_n from public.ise_profiles where last_name='Ndiayetest' and deleted_at is null;
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('E05 %s profils crees pour la meme personne',v_n); end if;

  -- La ligne fusionnee pointe le profil existant, sans nouveau profil.
  select count(*) into v_n from public.ise_profiles where last_name='Dialotest' and deleted_at is null;
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('E06 la fusion a duplique le profil existant (%s)',v_n); end if;

  -- Rapport persiste.
  select count(*) into v_n from private.import_reports
   where batch_id=v_batch and report_kind='summary' and (totals->>'created_profiles')::int=1;
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=array_append(v_fail,'E07 le rapport d''import n''est pas persiste'); end if;
  perform set_config('role','authenticated',true);

  -- Rejouer le lot : refuse, et rien n'est duplique.
  v_msg:=null; begin v_json:=public.admin_execute_import_batch(v_batch); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'invalid_transition' then v_fail:=v_fail||format('E08a le lot peut etre rejoue (%s)',coalesce(v_msg,'aucune erreur')); end if;
  v_msg:=null; begin v_json:=public.admin_stage_import_rows(v_batch,'test/annuaire_test.csv',v_rows,null); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'invalid_transition' then v_fail:=v_fail||format('E08b re-staging accepte (%s)',coalesce(v_msg,'aucune erreur')); end if;
  perform set_config('role','postgres',true);
  select count(*) into v_n from public.ise_profiles where last_name='Ndiayetest' and deleted_at is null;
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=v_fail||format('E08c le rejeu a duplique des profils (%s)',v_n); end if;

  ---------------------------------------------------------------- F. le profil importe est reclamable
  perform set_config('request.jwt.claims',json_build_object('sub',u_c::text,'role','authenticated')::text,true);
  select count(*) into v_n from public.search_claimable_profiles('Ndiayetest','Moussa',null) s
   where s.profile_id=v_profile;
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=array_append(v_fail,'F01 le profil importe est introuvable par search_claimable_profiles'); end if;

  ---------------------------------------------------------------- G. parametres plateforme et maintenance
  perform set_config('request.jwt.claims',json_build_object('sub',u_m::text,'role','authenticated')::text,true);
  v_msg:=null; begin perform * from public.admin_list_platform_settings(); exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'not_authorized' then v_fail:=v_fail||format('G01 parametres lisibles sans permission (%s)',coalesce(v_msg,'aucune erreur')); end if;

  perform set_config('request.jwt.claims',json_build_object('sub',u_a::text,'role','authenticated')::text,true);
  v_json:=public.admin_upsert_platform_setting('imports.test_max_mb','10'::jsonb,'number','admin',
            'Seuil de test de la suite 0031.','Pose par la suite de tests.');
  perform set_config('role','postgres',true);
  select count(*) into v_n from private.audit_log
   where action='settings.created' and object_id='imports.test_max_mb' and actor_profile_id=p_a;
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_n<1 then v_fail:=array_append(v_fail,'G02 la creation du parametre n''est pas journalisee'); end if;

  v_msg:=null; begin
    v_json:=public.admin_upsert_platform_setting('smtp_password','"x"'::jsonb,'string','admin','desc','motif');
  exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'settings_no_secret_allowed' then v_fail:=v_fail||format('G03 une cle secrete est acceptee (%s)',coalesce(v_msg,'aucune erreur')); end if;

  v_json:=public.admin_upsert_maintenance_window('Maintenance de test 0031',now()+interval '1 hour',now()+interval '2 hour',
            null,null,'Bandeau de test.','all',false,'Planifiee par la suite de tests.');
  v_win:=(v_json->>'id')::uuid;
  v_json:=public.admin_transition_maintenance_window(v_win,'start',null,null);
  v_json:=public.admin_transition_maintenance_window(v_win,'complete',null,null);
  perform set_config('role','postgres',true);
  select count(*) into v_n from public.maintenance_windows
   where id=v_win and status='completed' and actual_started_at is not null and actual_ended_at is not null;
  perform set_config('role','authenticated',true);
  v_cases:=v_cases+1;
  if v_n<>1 then v_fail:=array_append(v_fail,'G04 les transitions de maintenance ne posent pas les horaires reels'); end if;

  -- Une fenetre terminee ne se reecrit pas.
  v_msg:=null; begin
    v_json:=public.admin_upsert_maintenance_window('Reecriture interdite',now(),now()+interval '1 hour',v_win);
  exception when others then v_msg:=sqlerrm; end;
  v_cases:=v_cases+1;
  if v_msg is distinct from 'maintenance_not_editable' then v_fail:=v_fail||format('G05 une maintenance terminee est modifiable (%s)',coalesce(v_msg,'aucune erreur')); end if;

  ---------------------------------------------------------------- bilan
  perform set_config('role','postgres',true);
  if array_length(v_fail,1) is null then
    raise exception 'IMPORTS_TESTS_OK: % cas, 0 echec', v_cases;
  else
    raise exception 'IMPORTS_TESTS_KO: % cas, % echec(s) -> %',
      v_cases, array_length(v_fail,1), array_to_string(v_fail,' | ');
  end if;
end
$imp$;
