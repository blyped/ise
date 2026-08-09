-- 0088_import_ise_census part 1/6

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 41, 'Kouadio Alain', 'Konan',
     'Conseiller Technique', 'Ministère du Commerce et de l''Industrie — Cabinet',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'akonan.bidis@yahoo.fr', 'akonan7509@gmail.com', '+225759525159', '+225101000042' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 40, 'Fabrice', 'Tahi',
     'Conseiller Technique', 'Ministère du Budget et du Portefeuille de l''Etat — Abidjan — CABINET DU MINISTRE',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'tahif@yahoo.com', 'f.tahi@budget.gouv.ci', '+225778601421', '+225504358674' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 44, 'José-Félix', 'Die',
     'Directeur Général', 'Société Générale Capital Asset Management West Africa',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'diejofr@yahoo.fr', 'jose.die@socgen.com', '+2250767119682', '+2250574743053' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 59, 'Kouassi Ghislain', 'Kobenan',
     'Ingénieur Financier Titrisation', 'Banque Ouest Africaine de Développement — Conseil et Structuration de Financement',
     'TG', 'TOGO, Lomé',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'kobenanghislain@yahoo.fr', NULL, '+22893493503', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 43, 'Kindoh Rodrigue', 'Kouadio',
     'Directeur Général', 'COFINA CÔTE D''IVOIRE — Direction Générale',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'rodrigue.kouadio@gmail.com', 'rodrigue.kouadio@cofinacorp.com', '+225777815140', '+225707974600' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 59, 'Yaya', 'Bamba',
     'Chef de Service Polices Programmes et Réassurance', 'SOCIETE NATIONALE D''ASSURANCES ET DE REASSURANCES — Souscription — Réassurance',
     'BF', 'OUAGADOUGOU',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'bambazegue@gmail.com', NULL, NULL, NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 57, 'Moussa K. N. Raymond', 'Coulibaly',
     'Spécialiste datascientist', 'Orange Côte d''Ivoire — Abidjan',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'raycoul2016@yahoo.fr', 'raymond93coulibaly@gmail.com', '+225757611996', '+225757382001' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 44, 'Rodrigue Raoul', 'Zuchuon',
     'Spécialiste en Développement des Entreprises', 'Organisation Internationale du Travail',
     'CM', 'Yaoundé',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'rzuchuon@yahoo.com', 'zuchuon@ilo.org', '+237699238153', '+237671681477' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 59, 'Amoro', 'Kamagate',
     'Chargé d''Etudes', 'Cabinet du Ministre du Commerce et de l''Industrie',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'kamagate.amoro18@gmail.com', 'kamagate.amoro18@gmail.com', '+22559806246', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 59, 'Keletigui Lamine', 'Djire',
     'Chargé de proejet', 'AGENCE FRANCAISE DE DEVELOPPEMENT',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'dkl2016@gmail.com', NULL, '+2250749366349', '+225101151199' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 60, 'Alassane', 'Kone',
     'Data Scientist', 'ENDEAVOUR MINING',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'abeijoniir@gmail.com', 'abeijo1997@gmail.com', '+225103229150', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 61, 'Kodjo', 'Aklobessi',
     'Assistant de recherche', 'Banque Mondiale — Country Office — Macro unit',
     'TG', 'Lomé, Togo',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'kodjo.apollinaire.aklobessi@gmail.com', 'kaklobessi@worldbank.org', '+22892483538', '+221781484128' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 59, 'Ibrahima', 'Karamoko',
     'Gestionnaire de portefeuille', 'Sunu assurance vie ci — Gestion financière et Placements',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'karibrahima@gmail.com', NULL, '+225749324633', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 43, 'Aboudou', 'Ouattara',
     'Directeur de la Formation et des Innovations Pédagogiques (DFIP)', 'Centre Africain d''études Supérieures en Gestion (CESAG) — Dakar',
     'SN', 'Dakar',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'ouataboudou@gmail.com', 'aboudou.ouattara@cesag.edu.sn', '+221771063277', '+221338397575' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 60, 'Mockey Ariel Franck/xavier', 'Amichia',
     'Statisticien Planificateur', 'LONACI — Planification stratégique',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'ariel_amichia@yahoo.fr', NULL, '+225749320749', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 61, 'Yves', 'Mouaha Handy',
     'Business intelligence,value proposition and GTM analyst', 'MQash — Lagunes',
     'CI', 'ABIDJAN',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'yvesmouaha@yahoo.fr', 'yvesmouaha@live.com', '+2250748782517', '+2250170802874' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 60, 'Souleymane', 'Ouattara',
     'Chargé d''étude', 'Direction générale du plan et de la lutte contre la pauvreté — Direction de la programmation des investissements publics',
     'CI', NULL,
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'ouattarasoule6@gmail.com', 'jacksonfactoriel@gmail.com', '+2250749507388', '+2250102264262' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 61, 'Gaubys', 'Kouassi',
     'Analyste en investissement', 'Comoe Capital',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'gaubyskouassi98@gmail.com', 'g.kouassi@comoecapital.com', '+2250747670476', '+2250102282771' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 59, 'Oi Koffi Melaine Junior', 'Kouadio',
     'Ingénieur statisticien', 'Comité Nationale de télédétection et d''information géographique CNTIG — Département spatial data science',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'melainejr.oi@gmail.com', 'kok.melaine@gmail.com', '+225708220319', '+225799121813' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 60, 'Aphaily Wilfried Junior', 'Konan',
     'Responsable Suivi-évaluation', 'Cabinet du Ministre du Plan et du Développement — Cellule de coordination et de suivi du portefeuille des projets et programmes de la Banque Africaine de Développement (CCSPPP-BAD)',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'aphaily.konan@gmail.com', NULL, '+225748042739', '+225585303323' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 61, 'Marie Laure', 'Assanga Nguina',
     'Actuaire', 'LEADWAY vie côte d''ivoire — Lagunes — Assurance vie',
     'CI', 'ABIDJAN',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'l-assanga@leadway.com', 'assangalaure@yahoo.com', '+2250170802874', '+2250797372171' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 60, 'Ismael Onil', 'Boussim',
     'Candidat au PhD', 'Pennstate University — Department d''économie',
     'US', 'State college',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'jinilonil@gmail.com', 'oib5044@psu.edu', '+18147778607', '+2250777948624' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 61, 'N''Dakon Richard', 'Motchian',
     'Consultant', 'Aucune',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'motchianrichard@gmail.com', NULL, '+225749351254', '+225574074160' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 58, 'Konan Jean Marius', 'Kouakou',
     'Responsable offre et revenus', 'Orange ci — Direction financière — Contrôleur de gestion',
     'CI', NULL,
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'konanjeanmariuskouakou@gmail.com', 'konanjeanmariuskouakou@gmail.com', '+2250757964071', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 60, 'Oumarou', 'Kabre',
     'Chargé des opérations digitales', 'CORIS Bank International — Banque digitale — Opérations digitales',
     'BF', 'Ouagadougou',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'oumaroukabre05@gmail.com', NULL, '+22673290338', '+22656712031' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 57, 'Awa Raïssa', 'Bamba',
     'Chargée de projets Éducation Formation Emploi', 'AFD',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'awaraissabamba@gmail.com', NULL, '+225747671347', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 42, 'Boukar Ali', 'Madaï',
     'Spécialiste sous régional des politiques de l''emploi et développement productif', 'Organisation internationale du Travail — Yaoundé',
     'CM', NULL,
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'madai@ilo.org', NULL, '+237680909304', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 58, 'Fama-Sambah Rachid Hassane', 'Sanogoh',
     'Investment professional', 'IFC- World Bank — Private equity funds',
     'KE', 'Nairobi',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'sanogohfama@gmail.com', NULL, '+2250102071620', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 52, 'Kodzovi', 'Abalo',
     'Economiste Pays', 'World Bank — Macroeconomics, Trade, and Investment Global Practice (MTI)',
     'BF', 'Ouagadougou',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'kabalo@worldbank.org', 'kodzovee@outlook.com', '+22657555959', '+13477530631' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 54, 'Kokouvi Mawussi', 'Noutsougan',
     'Responsable', 'SIB (Société Ivoirienne de Banque) — Direction du Retail — Pilotage commerciale',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'mawussi.noutsougan@gmail.com', 'mawussi.noutsougan@sib.ci', '+2250709031266', '+2250103198799' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 53, 'Bourama', 'Fane',
     'Chef de services reporting et etudes', 'Orange Mali — Marketing',
     'ML', 'Bamako',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'fane.bourama@orangemali.com', 'fabourama@yahoo.fr', '+22376299733', '+22367154122' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 62, 'Hervinan Jude Malish', 'Mbourangon',
     'R.A.S', 'R.A.S',
     'CI', 'Côte, Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'judembourangon05@gmail.com', NULL, '+225769590012', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 60, 'Kouabenan Josué', 'Adjoumani',
     'Chargé d''etudes', 'Primature Cote d''Ivoire',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'adjoumanijosue@gmail.com', NULL, '+225757442143', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 59, 'Mireille', 'Desquith',
     'Chargée d''etude', 'Cabinet METFPA — Cabinet du ministre',
     'CI', 'ABIDJAN',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'desquith67@gmail.com', NULL, '+225709580122', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 56, 'Lou Balefe Joelle', 'Gouali',
     'ANALYSTE DES DONNEES', 'OFFICE IVOIRIEN DES CHARGEURS — DEPARTEMENT ETUDES, OBSERVATOIRE',
     'CI', 'ABIDJAN',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'joellegouali@gmail.com', 'jojogouali2020@gmail.com', '+225709256041', '+225584931937' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 60, 'Tomalé Jean Régis', 'Ballé',
     'Chargé d’études', 'Institut National de la Statistique ( Côte d’Ivoire) — Comptabilité Nationale — Compte nationaux annuels',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'balletomaleregis@gmail.com', 'balletomalejeanregis@yahoo.fr', '+225101558109', '+225779533241' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 60, 'Sansan Abdoul Kader', 'Hien',
     'Expert Suivi Évaluation', 'Programme des Nations Unies pour le Développement',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'hiensansanabdoulkader@gmail.com', NULL, '+225102518596', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 61, 'Gnapi Franck Armel', 'Zakre',
     'Responsable de projet', 'ATLANTIC FINANCIAL GROUP SA',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'franckzakre@gmail.com', NULL, '+2250101761067', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 52, 'Kouamé Moïse', 'Kanga',
     'Expert octroi de crédit retail', 'Société Générale',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'kanga.moise@gmail.com', 'moise.kanga@outlook.com', '+225564800877', '+225777066265' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 56, 'Akoubia Chris Hermann Jonathan', 'Kouakou',
     'Sales Trader Senior', 'Société Générale Capital Securities West Africa',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'kchrishermann@yahoo.fr', 'kchrishermann@gmail.com', '+2250777237465', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 62, 'Dogbo Aliman Jean-Eudes', 'Agbre',
     'Open to work', 'Au chômage et Open to work',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'eudes.agbre@gmail.com', NULL, '+2250749589848', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 48, 'Sékou', 'Sangaré',
     'Responsable Passation de Marchés', 'Secrétariat Technique du C2D / Cabinet du Premier Ministre (RCI)',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'sangaresekou1@yahoo.fr', 'sangaresekou15@gmail.com', '+2250758887555', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 48, 'Williams', 'Tchimou',
     'Manager Risk Advisory', 'Deloitte France',
     'FR', 'Paris',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'williams.tchimou@gmail.com', NULL, '+33645834905', NULL from new_profile;
