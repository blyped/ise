-- 0088_import_ise_census part 5/6

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 57, 'Mory Junior', 'Bamba',
     'Chef de Service Gestion des Projets, de la Transformation, du Suivi et de l''Evaluation', 'Direction Générale du Portefeuille de l''état (DGPE)',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'bamba.moryjunior@yahoo.com', 'mo.bamba@dgpe.gouv.ci', '+225779438637', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 55, 'Gogbé Evariste', 'Yoro',
     'Chargé d''Etudes', 'Cabinet du Ministre du Commerce et de l''Industrie',
     'CI', NULL,
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'evariste.gogbe@gmail.com', NULL, '+2250709780233', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 48, 'Eric Ledoux', 'Neguem Fossi',
     'Responsable du Suivi Evaluation', 'Programme D''Appui a la Reforme de l''Education au Cameroun (PAREC)',
     'CM', 'Yaoundé',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'negeric@yahoo.fr', 'negueme@gmail.com', '+237693097023', '+237679900452' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 57, 'Komla', 'Avoumatsodo',
     'Chargé de cours/Doctorant', 'Université du Québec à Montréal — Ecole des sciences de gestion',
     'CA', 'Montréal',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'kavoumatsodo@gmail.com', NULL, '+15143471601', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 57, 'Melchisedek Deo-Gratias', 'Abayomi',
     'Manager, Insights Practice', 'Entrepreneurial Solutions Partners',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'gratiasabayomi@gmail.com', NULL, '+22549611620', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 57, 'Obidon', 'Ogoumedi',
     'Chargée d''études', 'Institut National de la Statistique et des Études Économiques et Démographiques',
     'TG', 'Togo, Lomé',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'obidon.ogoumedi@yahoo.com', 'obidon_og@yahoo.fr', '+22893281226', '+22897972888' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 48, 'Moussa', 'Thiam',
     'Charge de la balance des paiements et de la réglementation des changes', 'Banque Centrale des États de l’Afrique de l’Ouest — Agence Principale de Dakar — Service des Études et de la Statistique',
     'SN', NULL,
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'mouthiam@bceao.int', 'moussa.soda@ansd.sn', '+221772999706', '+221338894565' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 48, 'Sultan Abdoul Karim', 'Toure',
     'DIRECTEUR DE LA PROGRAMMATION DES INVESTISSEMENTS PUBLICS', 'MINISTERE DU PLAN ET DU DEVELOPPEMENT/COTE D''IVOIRE',
     'CI', 'ABIDJAN',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'sultan.toure@gmail.com', NULL, '+2250709775208', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 56, 'Messou', 'Diomande',
     'Spécialiste de programme associé', 'UNESCO IIEP',
     'FR', 'Paris',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'diomandemessou@gmail.com', NULL, '+33660445626', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 54, 'N’dri Maxime', 'Amany',
     'Senior Manager - Valuation & Project Finance', 'EY',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'maxime.amany@gmail.com', NULL, '+225708499679', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 43, 'Klotiolo Yakangui Laciné', 'Coulibaly',
     'Manager Senior Pilotage des performances et Gestion de projets', 'Orange Money Côte d''Ivoire',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'lcoulibaly@gmail.com', 'lacine.coulibaly@orange.com', NULL, NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 41, 'Akpa Paulin Joseph', 'Djedjero',
     'Coordinating Officer of the Community Development Pregramme', 'ECOWAS',
     'NG', 'Abuja',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'akpa8djedjero@yahoo.com', 'dapjos@yahoo.fr', '+2347036541277', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 55, 'Nimbéléfia Amadou', 'Soro',
     'Conseiller Technique', 'Présidence de la République (Côte d''Ivoire)',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'amadou_soro@yahoo.fr', 'amadoumpmb@gmail.com', '+2250506412864', '+2250709666459' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 57, 'Saley', 'Moustapha Labo',
     'Analyste statisticien', 'Projet filets sociaux adaptatifs',
     'NE', 'Niamey',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'saleyml@yahoo.fr', NULL, '+22797078377', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 50, 'Richard', 'Kima',
     'Research Fellow', 'Monash University — Department of Economics',
     'AU', NULL,
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'richard_kima@yahoo.com', 'richardkima82611@gmail.com', '+61497177364', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 50, 'Claude Latrie', 'Mvoa',
     'Chef de Cellule', 'Ministère de l''Economie, de la Planification et de l''Aménagement du Territoire ( MINEPAT) — Direction Générale de l''Economie et de la Programmation des Investissements Publics/ Division des Analyses et des Politiques Économiques/ Cellule des Analyses Sectorielles',
     'CM', 'Yaoundé',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'mvoa_latrie@yahoo.fr', NULL, '+237695175462', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 49, 'Évrard Davy', 'Engozoghe',
     'DIRECTEUR DE LA PREVISION', 'MINISTÈRE DE L''ÉCONOMIE ET DE LA RELANCE (DIRECTION GÉNÉRALE DE LA PROSPECTIVE) — LIBREVILLE — DIRECTION GÉNÉRALE DE LA PROSPECTIVE',
     'GA', 'GABON (Libreville)',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'evrard.eng2016@gmail.com', NULL, NULL, '+241062054238' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 61, 'Rafiou Raphaël', 'Betila',
     'Chargé d''études', 'Direction Générale de l''Economie (DGE)',
     'BJ', 'Abomey-Calavi',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'raphaelbetila@yahoo.fr', NULL, '+22995943006', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, NULL, 'Médard', 'Djinkpo',
     'Statisticien', 'Agence Monétaire de lAfique de l''Ouest — Recherche et statistique — Statistique',
     'SL', NULL,
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'djinkpomedard@yahoo.fr', 'djinkpodjinkpo@gmail.com', '+22967408887', '+23278604585' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 55, 'Eliezer', 'Adjiboye',
     'Chargé des Comptes Nationaux', 'Institut National de la Statistique et de Démographie — ATLANTIQUE',
     'BJ', 'ABOMEY-CALAVI',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'eliezeradjiboye@gmail.com', 'eliezeadjiboye@yahoo.fr', '+22967244359', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 60, 'Sulpice', 'Amonle',
     'Consultant', 'WORLD BANK GROUP',
     'US', 'silver spring',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'sulpiceamonle@gmail.com', 'sulpiceamonle@gmail.com', NULL, NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 48, 'Boboï', 'Boubakari',
     'CHARGE D''ETUDES', 'MINISTERE DES MARCHÉS PUBLICS',
     'CM', NULL,
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'boubakariboboi@yahoo.fr', NULL, '+237674848978', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 48, 'Kouamé Désiré', 'Kanga',
     'Économiste', 'Fonds Monétaire International',
     'US', 'Rockville',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'kanga.desire@gmail.com', 'kanga.desire@gmail.com', '+12024689005', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 48, 'Rahmani', 'Siguenam',
     'Directeur Général', 'Observatoire national de l''emploi et de la Formation — Kadiogo — ONEF',
     'BF', 'ouagadougou',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'rahsiguenam@gmail.com', 'rahmanisiguenam@yahoo.fr', '+22677772477', '+22678806792' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 51, 'Dollou Giles-Patrick', 'Kouakou',
     'HR Manager', 'Bolloré Transport & Logistics — Ressources Humaines',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'patrick.dollou@gmail.com', 'patymis2010@yahoo.fr', '+225708451435', '+225777303712' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 61, 'Halimata', 'Sawadogo',
     'Data Service Expert', 'Akvo',
     'BF', 'Ouagadougou',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'sawhalims@gmail.com', 'halimata@akvo.org', '+22654203280', '+22672742043' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 50, 'Alassane', 'Diallo',
     'Chef de division', 'Direction de la prévision et des études économiques — Dakar — Division des projections macroéconomiques et du suivi des programmes',
     'SN', 'Dakar',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'aladiallo@yahoo.fr', 'aladiallozg@gmail.com', '+221776407947', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 51, 'Cheick Oumar', 'Dembele',
     'Contrôleur de Gestion', 'Assistance Aéroportuaire du Mali — Direction Générale — Contrôle',
     'ML', 'Bamako',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'codmcod@yahoo.fr', 'c.o.dembele@asam-mali.com', '+22376530544', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 46, 'Thiekoro', 'Doumbia',
     'Directeur', 'Direction Générale du Portefeuille de l''Etat — Direction de la Stratégie et de l''Expertise',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'tdoumbia@gmail.com', NULL, '+225779718847', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 54, 'Mamadou Diang', 'Ba',
     'Chef du Bureau des Statistiques sectorielles', 'Agence nationale de la Statistique et de la Démographie — Direction des Statistiques economique et de la Comptabilite nationale',
     'SN', 'Dakar',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'mamadou.ba@ansd.sn', 'diangba83@yahoo.fr', '+221776226744', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 50, 'Rakissiwindé', 'Bationo',
     'ISE', 'Conseil Burkinabé des Chargeurs au Bénin',
     'BJ', 'Cotonou',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'rakiss2004@yahoo.fr', 'rakiss2004@yahoo.fr', '+22999039393', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 45, 'Irié Patrice', 'Zahabi',
     'Directeur de Stratégie', 'Port Autonome de San Pedro',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'pizahabi@yahoo.fr', NULL, '+2250709900529', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 45, 'Sery Jules', 'Kaza',
     'Expert Statisticien', 'Institut National Statistique',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'kazajules@gmail.com', NULL, '+225778097007', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 54, 'Yoboua Parfait Kévin', 'Coffi-Amany',
     'Pilotage Stratégique', 'Société générale côte d''ivoire',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'coffi.amany@gmail.com', NULL, NULL, NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 48, 'Alex', 'Pouhe',
     'Conseiller Technique du Ministère de l''Economie et des Finances', 'Ministère de l''Economie et des Finances',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'alexpouhe@gmail.com', NULL, '+2250757821280', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 61, 'Boris Tanir', 'Yaubouet',
     'Chargé d''études', 'Opinionway — Statistique/ marketing',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'yaubouetboristanir@gmail.com', NULL, '+225747656846', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 47, 'Jean Gabriel', 'Tougma',
     'Directeur de la Prévision et des Analyses Macroéconomiques', 'Direction Générale de l''Economie et de la Planification',
     'BF', 'Ouagadougou',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'tougmajg@yahoo.fr', NULL, '+22670443581', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 37, 'Mama', 'Keita',
     'Directrice', 'Commission Économique des Nations unies pour l''Afrique (CEA). — Bureau Sous-Régional Afrique de l''EST',
     'RW', 'Kigali',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'mamakeita@yahoo.com', 'mamakeita@gmail.com', '+250783676279', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 59, 'Jeffrey', 'Kouton',
     'Consultant', 'Banque Africaine de Développement — Infrastructure et Développement Urbain',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'jeffrey.kouton@gmail.com', NULL, '+2250779830196', '+2250143405436' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 48, 'Kadja Eugène', 'Etche',
     'Assistant Exécutif, Bureau du Président', 'Commission CEDEAO',
     'NG', 'Abuja',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'ketche@ecowas.int', 'eugenekadja@yahoo.fr', '+2348106538623', '+2250707327361' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 46, 'Djibiri', 'Kone',
     'Sous-directeur', 'Ministère du Budget et du Portefeuille de l''Etat — Cocody — Direction Générale du Budget et des Finances',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'kdjibiri@yahoo.fr', NULL, '+2250758586559', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 62, 'Bah Franck Berenger', 'Kouadio',
     'Analyste financier', 'Cabinet ADS',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'franckgomez.kouadio@gmail.com', NULL, '+225749510419', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 41, 'Kouhonan', 'Soro',
     'Le Directeur', 'MINISTERE D''ETAT MINISTERE DE L''AGRICULTURE ET DU DEVELOPPEMENT RURAL — Direction Gé érale de la Planification, des Statistiques et des Projets (DGPSP) — Direction des Statistiques, de la Documentation et de l''Informatique',
     'CI', NULL,
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'skouhonan@yahoo.fr', 'ngaffonan@hotmail.com', '+2252720215863', '+2250101002093' from new_profile;
