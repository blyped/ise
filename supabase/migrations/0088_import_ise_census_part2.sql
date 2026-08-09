-- 0088_import_ise_census part 2/6

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 62, 'Wilfried', 'Sanogo',
     'Aucun actuellement', 'Sans emploi actuellement — Aucun actuellement — Aucun actuellement',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'vehiwilfried@icloud.com', 'wilykhader@gmail.com', '+225747502838', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 62, 'Siaka', 'Kamagaté',
     'Business analyste', 'MTN — Marketing — Market intelligence',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'siakamagate93@gmail.com', NULL, '+22507744023', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 62, 'Alassane', 'Touré',
     'Sans emploi', 'Sans emploi',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'tourealassane777@gmail.com', 'toure.alassane@ensea.edu.ci', '+225504738031', '+225708934980' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 50, 'Dramane', 'Meite',
     'VP, Product Strategist', 'PIMCO — Client Solutions & Analytics',
     'US', 'Newport Beach',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'emdi_leroi@yahoo.fr', NULL, '+12022803375', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 62, 'Florence Iyabo Hubertine', 'Agboton',
     'Data Analyst chargé de suivi des activités', 'Stage Aqualine by Citrans — Audit et contrôle de gestion — Statistiques',
     'CI', 'Cocody Mermoz',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'agboton24m@gmail.com', NULL, '+225544921165', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 60, 'Nahomie Rebecca', 'Koré',
     'Actuaire', 'SANLAM ASSURANCE VIE CI — Études et Actuariat',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'namirecca@gmail.com', 'rebecca.kore@ci.sanlam.com', '+2250787054694', '+2250575656728' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 52, 'Moussa', 'Berthe',
     'Manager marketing stratégique', 'Orange — Marketing — Business planning',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'brtmous@yahoo.fr', NULL, '+225707625906', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 62, 'Diouma', 'Kamara',
     'Data analyst', 'Data 354',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'dioumakamara1999@gmail.com', NULL, '+2250545016385', '+2250789484814' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 50, 'Thimothée', 'Dabire',
     'Professionnel Statisticien Economiste', 'UEMOA — Secteur Privé — CHAMBRE CONSULAIRE REGIONAL',
     'TG', 'TOGO, LOME',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'timydabire@gmail.com', 'timdabire@yahoo.fr', '+22896958888', '+22670362933' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 56, 'Mahamadou', 'Sere',
     'Coordonnateur Suivi, Évaluation, Redevabilité et Apprentissage', 'ONG PLAN INTERNATIONAL BURKINA FASO',
     'BF', 'Ouagadougou',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'mahamadou.sere45@gmail.com', 'mahamdousere@yahoo.fr', '+22666191506', '+22662150823' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 56, 'Yves Roland Ehouman', 'Kadjo',
     'Chargés d''Etudes', 'Direction Générale du Portefeuille de l’État — Abidjan — Service Banque',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'kajoehouman@gmail.com', NULL, '+225759920576', '+225101225042' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 53, 'Bi Julien', 'Youan',
     'Chef de service', 'DGTCP — Direction des Établissements de Crédit et des Finances extérieures',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'julien.youanbi@gmail.com', 'julien.youanbi@gmail.com', '+225757521675', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 40, 'Banassi', 'Ouattara',
     'Adjoint au Directeur des Opérations de Marché', 'BCEAO — Direction des Opérations de Marché',
     'SN', 'Dakar',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'banassi@hotmail.com', 'bouattara@bceao.int', '+221776493787', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 52, 'Maixent Géméri', 'Assi',
     'Monitoring and Evaluation Coordinator', 'Innovations for Poverty Action',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'amgmails@yahoo.fr', NULL, '+2250757795638', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 56, 'Baudhouat Yves Landry', 'Komoin',
     'Analyste Crédit Corporate', 'Banque d’Abidjan — Direction du Crédit',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'landrykomoin@gmail.com', NULL, '+225757327988', '+225171101962' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 62, 'Kpêlémawussi Félicienne Marlyse', 'Sossou',
     'Assistant de recherche', 'Afreximbank',
     'BJ', 'Cotonou',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'marlysossou@gmail.com', 'msossou@afreximbank.com', '+22967484013', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 56, 'Kamenan Claude Fabrice', 'Ekouman',
     'Charge d’affaires', 'ORABANK CI',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'f.ekouman@gmail.com', NULL, '+225709641681', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 37, 'Issouf', 'Soumare',
     'PROFESSEUR', 'UNIVERSITE LAVAL',
     'CA', 'QUEBEC',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'isoumare@hotmail.com', 'isoumare@isoumare.org', '+14182653500', '+22508283016' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 52, 'Pacome Williams Charlemagne', 'Zongo',
     'Commissaire Contrôleur des Assurances', 'Secrétariat Général de la Conférence Interafricaine des Marchés d''Assurances',
     'GA', 'Libreville',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'charlemagnezongo10@gmail.com', 'charlemagnezongo10@yahoo.fr', '+24177579267', '+22674309414' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 47, 'Sansan Honkounne', 'Kambou',
     'Expert en traitement des données d''enquêtes et de recensement', 'AFRISTAT — Département des appuis stratégiques et de la diffusion (DASD)',
     'ML', 'Bamako',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'kambou@afristat.org', 'honkounne@gmail.com', '+22391889311', '+22664464952' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 56, 'Babou', 'Bako',
     'Chargé d''études', 'Institut national de la statistique et de la démographie — Direction des statistiques et des synthèses économiques — Service dez comptes économiques et des analyses macro-économiques',
     'BF', 'Ouagadougou',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'jpbako87@gmail.com', 'bakojeanpierre@yahoo.fr', '+22670094683', '+22671103699' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 61, 'Koffi Aristide Joël', 'Kouman',
     'Inspecteur Vérificateur des Finances', 'Inspection Générale des Finances — Audit',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'ataditshec@yahoo.fr', 'ataditsise@gmail.com', '+225708508746', '+225564990277' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 62, 'Roger', 'Piessou',
     'Aucune', 'Aucune',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'roger.piessou@ensea.edu.ci', 'piessoumarsias@gmail.com', '+225152870489', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 52, 'Essopha', 'Kokoloko',
     'CHARGE SUIVI EVALUATION', 'FAMILY HEALTH INTERNATIONAL 360 — Lome — Sante/Lutte contre le VIH SIDA',
     'TG', 'Lome, Togo',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'essofasm@yahoo.fr', NULL, '+22890738510', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 53, 'Jean Stephane', 'Koffi',
     'Investment Associate', 'Meridiam Infrastructure Fund — Afrique de l''Ouest',
     'SN', 'Dakar',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'jeanstephankoffi@gmail.com', NULL, '+2250709400697', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 53, 'Kouame Felix', 'Kanga',
     'Sous Directeur', 'Direction Générale des Douanes — Direction des Statistiques et des Études Économiques — Sous Direction de la Production Statistique',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'fkkanga7@gmail.com', 'kangakouame7@hotmail.com', '+2250708869004', '+2250504333303' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 56, 'Gbanbele Aboubakar', 'Coulibaly',
     'Assistant de recherche', 'BANQUE AFRICAINE DE DEVELOPPEMENT — Gestion des risques — Division des risques de marchés',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'gbanbele@gmail.com', NULL, '+2250708199900', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 59, 'Yays', 'Barro',
     'Analyste Sénior', 'Agence Côte D’Ivoire PME — Direction de la Stratégie et de la Mobilisation des Ressources — Intelligent des affaires (PME BI)',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'barrorahimy@yahoo.com', 'barroy14@gmail.com', '+2250759919021', '+2250504155777' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 32, 'Adama Nouhoun', 'Ouattara',
     'Auditeur', 'BCEAO — Inspection et Audit interne',
     'SN', 'Dakar',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'ouattadam@gmail.com', 'adnouattara@bceao.int', '+22676609303', '+221783800002' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 61, 'N''Guessan Sharon Lys', 'Yapi',
     'Étudiante', 'ESCP Business School',
     'FR', 'Paris',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'sharonlysyapi@gmail.com', NULL, '+330660875987', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 44, 'André Hugues', 'Ibata Gassaki',
     'Head of procurement', 'Société Nationale des Pétroles du Congo (SNPC)',
     'CG', 'Brazzaville',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'huguesibata@gmail.com', 'huguesibata@gmail.com', '+242069674040', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 58, 'Ange Rocksane', 'Yapo',
     'Chargé d''études', 'Ministère du Budget et du Portefeuille de l''État — Cabinet',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'angeyapo53@gmail.com', NULL, '+225103822558', '+225777184716' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 60, 'Payine Wendé Rhout', 'Mme Soré Née Yaogo',
     'Coordonnatrice du Suivi évaluation apprentissage et redevabilité', 'Save The Children — Houet',
     'BF', NULL,
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'payinewende@gmail.com', NULL, '+22666428190', '+22651007069' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 60, 'Douho Andree Gwladys', 'Tchehi Epse Aby',
     'ENSEIGNANT-CHERCHEUR', 'ENSEA',
     'CI', 'ABIDJAN',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'gwladys.aby@gmail.com', 'gwladys.aby@ensea.ed.ci', '+225141482562', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 59, 'Atchélé', 'Djehoueh',
     'Consultant en stratégie', 'Espartners',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'djehouehiatchele@gmail.com', NULL, '+225546612002', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 56, 'Yékorominan Aboubacar', 'Dagniogo',
     'Statisticien Économiste', 'Commission Nationale du Mécanisme Africain d''Évaluation par les Pairs',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'ab.dagniogo@gmail.com', NULL, '+2250749332638', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 40, 'Wahabou', 'Diawara',
     'Chef de service études statistiques et veille stratégique', 'Côte d''Ivoire Tourisme — Direction des statistiques et du suivi évaluation — Etudes statistiques et veille stratégique',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'w.diawara@yahoo.fr', NULL, '+2250707837714', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 52, 'Aboladji Joël Christian', 'Houssou',
     'Inspecteur chargé de la surveillance du marché', 'CREMPF - UMOA — Direction des Acteurs',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'joelhoussou@gmail.com', NULL, '+2250505154394', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 40, 'Toukou Fernand', 'Aboutou',
     'Directeur des Enseignements et des Programmes de Formation', 'Banque Centrale des Etats de l Afrique de l Ouest (BCEAO)',
     'SN', 'Dakar',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'tfaboutou@gmail.com', 'faboutou@bceao.int', '+221876110955', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 40, 'Oi Angoua Paul', 'Angoua',
     'Chargé en Chef du Risque Quantitatif', 'Banque Africaine de Développement — Département de Gestion de Risque',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'pangoua@yahoo.com', 'p.angoua@afdb.org', '+2250566047817', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 48, 'Armand', 'Du Barry',
     'DIRECTEUR DU CENTRE D''EXPLOITATION DU REFERENTIEL', 'SANLAM PAN AFRICA',
     'CI', 'ABIDJAN',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'armand.dubarry@gmail.com', 'armand.dubarry@ma.sanlam.com', '+2250709477961', '+22674451717' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 54, 'Valentin (ensae-Sénégal)', 'Koala',
     'Chef de service évaluation et capitalisation', 'Ministère de l''Agriculture/Burkina Faso',
     'BF', 'Ouagadougou',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'valatif@gmail.com', NULL, '+22679102170', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 53, 'Atsé Franck Bérenger', 'Yapi',
     'Chef de Service', 'Ministere de l’Economie et des Finances',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'francky.yapi@gmail.com', 'francky.yapi@gmail.com', '+2250708455370', '+2250504626222' from new_profile;
