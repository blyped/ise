-- 0088_import_ise_census part 6/6

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 45, 'Agara Konan', 'Yao',
     'Directeur du Pôle Étude et Intelligence Marketing', 'VOODOO Group — Pôle Étude et Intelligence Marketing - Projet Institutionnel et Politique — Directeur',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'yaoagara@gmail.com', 'agara.yao@voodoo-com.net', '+2250707779026', '+2280101425472' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 41, 'Loesse Jacques', 'Esso',
     'Directeur de Cabinet', 'Ministère du Commerce et de l’Industrie et ENSEA',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'l_esso@yahoo.fr', NULL, '+2250707905457', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 58, 'Hamain Lahiniriko', 'Zafimila',
     'Chef de mission Audit des Systemes d''Informations', 'EXA-Mazars',
     'RE', 'La Réunion- France',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'zafimila@gmail.com', 'rikobe@yahoo.fr', '+262693511727', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 58, 'Narcisse', 'Sandwidi',
     'Doctorant', 'Université de Montréal',
     'CA', 'Montreal',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'sandwidi_narcisse@live.fr', 'sandwidi_narcisse@live.fr', NULL, NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 40, 'Jean Louis', 'Banga',
     'RESPONSABLE DU POOL DES OPÉRATIONS', 'Comité National de Pilotage des PPP',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'bangajl@yahoo.com', NULL, '+225708412639', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 50, 'Fâtimata', 'Fofana',
     'Économiste Analyste des Transports', 'Agence Nationale de l''Aviation Civile du Mali',
     'ML', 'Bamako',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'omo_toufa@yahoo.fr', 'omotoufa@gmail.com', '+22363151836', '+22376610897' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 59, 'Younous', 'Bamba',
     'Customer Relationship Manager', 'Jumia ci — Marketing — Marketing',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'inousbamba6@gmail.com', NULL, '+2250759355977', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 54, 'Issaka', 'Ouedraogo',
     'Agent', 'Ministere de l''agriculture — Service de l''organisation des enquêtes et recensements agricoles',
     'BF', 'OUAGADOUGOU',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'lschaack@yahoo.fr', 'ouedraogo.issacka@gmail.com', '+22666152959', '+22670559122' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 59, 'N’guessan Eloge Mathieu', 'Kouacou',
     'Consultant International developpement Advisory', 'KPMG CIV',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'elogekouacou@gmail.com', NULL, '+225758278063', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 43, 'Ben Ismael Samouga', 'Koulibali',
     'Structuration', 'Standard Chartered Bank',
     'AE', 'Émirats Arabe Unis',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'benkoulibali@outlook.com', 'benkoulibali@ymail.com', '+971565606502', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 50, 'Mohamed Sidi', 'Sylla',
     'Manager Market Intelligence', 'MTN CI — Abidjan — Business Intelligence',
     'CI', NULL,
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'syllamoh07@yahoo.fr', NULL, '+2250505250070', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 51, 'Kouakou Bruno', 'Tano',
     'Conseiller Technique', 'Ministere de l''Economie et des Finances — Cabinet',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'tano.kbruno@gmail.com', 'tano.kbruno@gmail.com', '+225748927719', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 58, 'Roland Fabrice Tanguy', 'Acle',
     'Responsable Études Économique et tarifaires', 'Orange CI',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'acleroland@gmail.com', NULL, '+2250709106628', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 59, 'Safiata', 'Kaboré',
     'Contrôle de gestion', 'SUNU ASSURANCE VIE Côte d''Ivoire — Contrôle de gestion',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'kaboresafiata@gmail.com', NULL, '+225747044014', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 43, 'Djoret', 'Biaka Tedang',
     'Macrofiscal Advisor', 'AFRITAC DE L''OUEST',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'biakatedang@gmail.com', 'tbiaka@yahoo.fr', '+2250768203794', '+2250566005510' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 43, 'Jacques Barnabé', 'Nana',
     'Chef de Cellule', 'Ministère des Finances — Prévisions — Cellule de L’Analyse Monétaire et du Secteur Extérieur',
     'CM', 'Yaoundé',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'jacques_bnana@yahoo.fr', NULL, '+237699509193', '+237673261100' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 48, 'Koffi Mepanou', 'Adoli',
     'Comptable national et Chef de la Division des Statistiques et Analyses Conjoncturelles (DSAC)', 'Institut National de la Statistique et des Études Économiques et Démographiques (INSEED) — Direction de la Comptabilité Nationale et des Études Économiques (DCNEE)',
     'TG', 'TOGO, Lomé',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'mepanou.adoli@yahoo.fr', 'mepanou.adoli@gmail.com', '+22891926706', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 48, 'Gnakry Jean Philippe', 'Gohia',
     'Investment Officer', 'IFC',
     'GB', 'Londres',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'jpgohia@gmail.com', NULL, '+447507426943', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 56, 'Titchinmin', 'Kone',
     'Manager', 'Mazars CI — Conseil',
     'CI', NULL,
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'titchinmin@gmail.com', 'titchinmin@yahoo.fr', '+225749469451', '+225779105781' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 51, 'Diderot Guy D''Estaing', 'Sandjong Tomi',
     'Economiste', 'BANQUE MONDIALE',
     'CA', 'Ottawa',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'diderot25@yahoo.fr', NULL, '+13437777072', '+23675778706' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 48, 'Thierry', 'Chekouo Tekougang',
     'Assistant Professor', 'Université de Calgary',
     'CA', 'Calgary, Alberta',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'tetchekouo@gmail.com', NULL, NULL, NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 48, 'Akom Ilessan', 'Dossou Epse Amegakpo',
     'Directrice de la planification et du suivi évaluation', 'Agence de développement communautaire (ANADEB) — Planification et suivi évaluation',
     'TG', 'Togo, Lomé',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'akomvero@yahoo.fr', NULL, '+22891900761', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 55, 'Agoua Liliane Elodie', 'Zalo',
     'Responsable adjoint', 'Institut National de la Statistique — Cellule d’Analyses Economiques',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'elodiezalo@gmail.com', 'e.zalo@stat.plan.gouv.ci', '+2250152399494', '+2250759321956' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 55, 'Katiénin Lohoré Josette', 'Sékongo',
     'Trader', 'Conseil Café Cacao',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'lohore_joset@yahoo.fr', NULL, '+2250709486234', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 46, 'Brahima Kalilou', 'Fofana',
     'Directeur de la Trésorerie', 'United Bank for Africa (UBA) Mali',
     'ML', 'Bamako',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'licorno@gmail.com', 'brahima-k.fofana@ubagroup.com', '+22379075657', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 52, 'Ama', 'Kouao Epouse Ankui',
     'Conseillère Technique', 'Primature - Côte d''Ivoire',
     'CI', 'Côte d''Ivoire-Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'amakouao@gmail.com', 'amakouao@yahoo.fr', '+2250101205669', '+2250708335820' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 60, 'Tomale Jean Regis', 'Balle',
     'Chargé d’études', 'Cabinet du Ministre du Patrimoine, du Portefeuille de l’Etat et des Entreprises Publiques',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'balletomaleregis@gmail.com', 'balletomalejeanregis@yahoo.fr', '+2250779533241', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 62, 'Iyabo Florence Hubertine', 'Agboton',
     'Head Inbound and Digital', 'Ecobank CI — Direction expérience client — Régional contact center',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'agboton24m@gmail.com', 'florence24m@gmail.com', '+225544921165', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 44, 'Comlan Picard José', 'Akapovi',
     'Chef de Service', 'Banque Centrale des Etats de l''Afrique de l''Ouest (BCEAO) — Secrétariat Général de la Commission Bancaire de l''UMOA — Service des Etudes, des Statistiques et des Agréments',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'akapovi@gmail.com', 'pjakapovi@bceao.int', '+2250707929190', '+2250152003690' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 51, 'Kader', 'Amadou',
     'Économiste', 'Fonds Monétaire International (FMI)',
     'US', 'Washington',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'akaderam@gmail.com', NULL, '+12025150924', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 62, 'Yacouba', 'Traore',
     'Chargé d''Etude', 'Agence Nationale de la Statistique (ANStat) — Direction des Etudes, de la Recherche et de l''Ingénierie',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'traorey841@gmail.com', 'ya.traore@stat.plan.gouv.ci', '+2250789787304', '+2250545359341' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 53, 'Ayikoue Honore', 'Agbobly-Atayi',
     'Directeur Génnéral', 'Institut De Sondage Et D''étude En Statistique Et En Économie (I2SE)',
     'TG', 'Togo, Lomé',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'ayikouegazapo@gmail.com', 'atayi94@gmail.com', '+22892700132', '+22898899862' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 61, 'Dieudonné', 'Tokche',
     'Étudiant au doctorat en statistiques', 'Université de Montréal',
     'CA', NULL,
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'dtokche@gmail.com', NULL, '+15146644971', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 61, 'Arnold Kevin', 'Kanga',
     'Spécialiste géomarketing', 'Orange Côte d''Ivoire — Program Data & IA — Data & Géomarketing',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'arnoldkanga01@gmail.com', NULL, '+225777976636', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 58, 'Mamary', 'Bamba',
     'Sous-Directeur du Budget et de la Comptabilité', 'Ministère des Affaires Etrangères, de l''intégration Africaine et des Ivoiriens de l''Extérieur',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'mrybamba@gmail.com', 'mry.bamba@diplomatie.gouv.ci', '+225748917138', '+225554500446' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 58, 'Hendrick', 'Tenin',
     'Directeur Actuariat et Data Management', 'SanlamAllianz Assurances CI',
     'CI', NULL,
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'hendricktenin@gmail.com', NULL, '+225789512754', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 62, 'Mahutin Anselme', 'Houessigbede',
     'Short Term Consultant (STC)', 'Banque Mondiale — Capital Humain — Education et compétences',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'anselmehoues@gmail.com', 'anselme.houessigbede@ensea.edu.ci', '+2250544905165', '+22967891838' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 61, 'Cédric Kouamé', 'N''Zi',
     'Chargé de la Balance des Paiements et de la Réglementation des Changes', 'BCEAO',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'nzicedrickouame@gmail.com', NULL, '+2250777797893', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 59, 'Mohamed', 'Kourouma',
     'Superviseur des Institutions de Microfinance', 'BCEAO — Finance — Microfinance',
     'SN', 'Dakar',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'mahommet79@gmail.com', NULL, '+221765147447', '+221785854954' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 58, 'Roland Fabrice', 'Acle',
     'Chef de service data', 'Banque Nationale d''Investissemnt',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'acleroland@gmail.com', NULL, '+225709106628', NULL from new_profile;
