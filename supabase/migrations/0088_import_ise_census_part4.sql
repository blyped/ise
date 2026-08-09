-- 0088_import_ise_census part 4/6

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 58, 'Karim', 'Sara',
     'ISE', 'INSTITUT NATIONAL DE LA STATISTIQUE ET DE LA DEMIGRAPHIE — DIRECTION DES STATISTIQUES ET SYNTHESES ECONOMIQUES — SERVICE DES STATISTIQUE D''ENTREPRISE ET DU COMMERCE EXTERIEUR',
     'BF', NULL,
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'ksarakarim@gmail.xom', 'saraabdoulkarim@yahoo.fr', '+22657478792', '+22679641128' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 58, 'Yacouba', 'Fofana',
     'Chargé d’études', 'Direction Générale du Portefeuille de l’Etat — Direction de la Stratégie et de l’Expertise — Stratégie',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'yacoubafof@gmail.com', NULL, '+2250709011618', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 50, 'Calixte', 'Mahougbe',
     'Comptable National', 'Institut National de la Statistique — Littoral — Service des Comptes Nationaux',
     'BJ', 'BENIN Cotonou',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'calixtemahougbe@gmail.com', NULL, '+22996176470', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 36, 'Hippolyte Georges', 'Agkpo',
     'Managing Director', 'Credit Suisse — Global Trading Solutions — Head of Complex Derivatives Trading',
     'US', 'New York',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'h_agkpo@hotmail.com', NULL, '+447484306639', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 56, 'Stéphanie', 'Donhouede',
     'Agent de l''administration commerciale, coordonnatrice de région', 'Partenariat Grains Québec s.e.c. — Administration commerciale',
     'CA', 'Laval',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'donfanie@gmail.com', NULL, '+15145318933', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 53, 'Ousmane', 'Batchiky',
     'Directeur Adjoint', 'Port Autonome d’Abidjan — Direction des études économiques, de la stratégie et de la planification',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'ousmanebatchily@gmail.com', NULL, '+2250708577545', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 59, 'Nathalie Marthe Philochar', 'Gandaho',
     'Volontaire des Nations Unies', 'Institut National de la Statistique et de la Démographie — Littoral — Service des Statistiques des Conditions de Vie des Ménages',
     'BJ', 'Cotonou',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'naluxie@yahoo.fr', 'naluxie@gmail.com', '+22967020440', '+22994621651' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 52, 'Eric', 'Tchawalassou',
     'Directeur Marketing', 'TOGOCOM — Marketing — Marketing',
     'TG', 'Togo, Lomé',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'erictouglo@gmail.com', NULL, '+22891566054', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 53, 'Désiré-Anthelme', 'Doffou',
     'Chef de Service Synthèses et Publications', 'Direction Générale du Trésor et de la Comptabilité Publique — Abidjan — DRSSFD',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'doffoudesire@gmail.com', 'desire.doffou@tresor.gouv.ci', '+22549031799', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 53, 'Adouko Guy Faustin', 'Miessan',
     'Chef de Service Hydrocarbures', 'Direction Générale du Portefeuille de l''État — Hydrocarbures',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'miessanadouko@yahoo.fr', NULL, '+225747506442', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 53, 'Borel Espoir Senan', 'Ahonon',
     'Doctorant', 'McGill University',
     'CA', 'Montreal',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'borelahonon@gmail.com', NULL, '+15819805775', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 53, 'P''Lanam Germain', 'Farouh',
     'Comptable National', 'Institut National de la Statistique et des Études Économiques et Démographiques — Comptabilité Nationale et Études Économiques',
     'TG', 'TOGO, Lomé',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'farouhplanam@gmail.com', 'farouhplanam@live.fr', '+22893392271', '+22897022005' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 53, 'Ghislain', 'Tanoh',
     'Conjoncturiste', 'BCEAO',
     'SN', 'Dakar',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'tanoh_ghislain@yahoo.fr', NULL, '+221784761292', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 53, 'Claude', 'Koua',
     'Economiste Senior', 'Ambassade de France en Côte d''Ivoire',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'kouadclaude@yahoo.fr', NULL, '+2250707271895', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 40, 'Mahenina', 'Ranaivo',
     'Directeur des Études et de l’Actuariat', 'ARO',
     'MG', 'Antananarivo',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'mahenina@gmail.com', 'mahenina@aro.mg', '+261340496272', '+261325449118' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 53, 'Patrick Wamoussya', 'Bahibo',
     'Chef de service études économiques et production statistique', 'Compagnie Ivoirienne d''Electricité — Abidjan',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'bahibo_patrick@yahoo.fr', NULL, '+225708833600', '+225143482784' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 52, 'Akoubia Armel Xavier', 'Kouakou',
     'RESPONSABLE RÉABONNEMENT AFRIQUE', 'CANAL+INTERNATIONAL',
     'FR', 'ISSY-LES-MOULINEAUX',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'xavierarmel@yahoo.fr', NULL, '+33752105727', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 60, 'Flora Stéphanie', 'Kacou',
     'Chargée d’études', 'Institut National de la Statistique de Côté d’Ivoire — Abidjan',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'florastephaniekacou03@gmail.com', NULL, '+2250749088838', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 53, 'Patrick Larry', 'Babo',
     'Chef de services', 'CNPS — Etudes Economiques, statistiques et Actuarielles — Etudes statistiques et actuarielles',
     'CI', 'ABIDJAN',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'lpbabo07@yahoo.fr', NULL, '+225758891880', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 60, 'Famahan', 'Doumbia',
     'Data scientist', 'ENDEAVOUR MINING — Innovation — Data squad',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'arrahim.doum@gmail.com', NULL, '+225778149793', '+225566997420' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 56, 'Kan Wilfried', 'Kouassi',
     'Chief Investissement Officer', 'ALLIANZ',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'wilfriedkouassikan@gmail.com', 'hamiltontfx@gmail.com', '+225759004883', '+225707523899' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 39, 'Denis', 'Kapioko',
     'SPECIALISTE PRINCIPAL', 'BCEAO SIEGE',
     'SN', 'DAKAR SENEGAL',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'dkapioko@bceao.int', 'deniskapioko@yahoo.fr', '+221775488714', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 53, 'Ayikoué Honoré', 'Agbobly-Atayi',
     'Directeur Exécutif', 'Institut de sondage et d''étude en statistique et en économie (I2SE) — I2SE — I2SE',
     'TG', 'Lomé, Togo',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'ayikouegazapo@gmail.com', 'atayi94@gmail.com', '+22892700132', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 59, 'Krey Vianney', 'Mel',
     'Chef de service Planification', 'Agence Emploi Jeunes — Direction des Études,  des Statistiques et du Suivi Évaluation',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'mvnney@yahoo.fr', NULL, '+225747726212', '+225140127499' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 48, 'Issoufou', 'Nana',
     'Chef de mission Adjoint', 'Assistant Technique Coopération Allemande/Consultant indépendant',
     'BF', NULL,
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'nanaissoufou@hotmail.com', NULL, '+22674565570', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 52, 'Aka Saint-Jérôme', 'Koffi',
     'Economiste', 'Agence Française de Développement',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'koffiaka.jerome@yahoo.fr', NULL, '+2250709955409', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 48, 'Aristide Donald', 'Nguendjio Yomi',
     'Chargé d''Etudes', 'Institut National de la Statistique du Cameroun — Département de l''Informatique',
     'CM', 'Yaoundé.',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'aristideyomi@gmail.com', 'yomiaristide@yahoo.fr', '+237694256232', '+237678212159' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 55, 'Dotou Marius', 'Aboua',
     'Analyste statisticien', 'Caisse Autonome d''Amortissement — Direction de la Stratégie',
     'BJ', 'Cotonou',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'justemariuseb@yahoo.fr', 'marius.aboua@caa.finances.bj', '+22961647120', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 48, 'Gbedia Gomez', 'Agou',
     'Représentant Résident du FMI', 'FMI — Afrique',
     'GA', 'Libreville',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'gagou2@imf.org', 'agougomez@gmail.com', '+12022470916', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 48, 'Vadjawe', 'Karamoko',
     'Consultant', 'AFDB',
     'CI', NULL,
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'vadjawe@gmail.com', NULL, '+225709164719', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 48, 'Pousga Dieudonné', 'Sawadogo',
     'Chef de service des comptes économiques et des analyses macroéconomiques', 'Institut National de la Statistique et de la Démographie (INSD)',
     'BF', 'Ouagadougou',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'dsawadogo@yahoo.fr', NULL, '+22678900567', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 41, 'Fulbert', 'Tchana Tchana',
     'Economiste Principal', 'La Banque mondiale',
     'US', 'Etats-Unis d''Amérique, Washington DC',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'ftchanatchana@hotmail.com', 'ftchanatchana@hotmail.com', NULL, NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 31, 'Aba', 'Camara',
     'Ingénieur Statisticien Economiste spécialisé en analyse conjoncturelle', 'COMMISSION UEMOA',
     'BF', 'BURKINA FASO Ouagadougou',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'acamara@uemoa.int', 'camasabis@yahoo.fr', '+22678885979', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 48, 'Geoffroy Casimir', 'Ketchoum Ngahane',
     'Chargé d''études', 'INS CAMEROUN — Mfoundi — Département des statistiques démographiques et sociales',
     'CM', 'yaoundé',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'ketchcasimir@yahoo.fr', NULL, '+237677116191', '+237696078240' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 48, 'Salissou', 'Malam Souley',
     'Coordonnateur du Projet PME', 'L''initiative Oasis Niger',
     'NE', 'Niamey',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'mssalissou75@gmail.com', NULL, '+22797444599', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 31, 'Lago Appolinaire', 'Bouabre',
     'Adjoint au Directeur', 'BCEAO SIEGE — Dakare',
     'SN', 'Sénégal  Dakar',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'appolinairebouabre73@gmail.com', 'abouabre@bceao.int', '+221776342965', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 57, 'Youssion Germain', 'Kouadi',
     'Spécialiste Études et Analyses Statistiques', 'Bureau de Coordination des Programmes Emploi — Abidjan — Programmation et Suivi-Évaluation',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'ygk5@yahoo.fr', 'youssiongermaink@gmail.com', '+225707173250', '+225102115891' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 57, 'Serge', 'Kouassi',
     'Analyste Financier', 'SouthBridge',
     'FR', 'Paris',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'moisekouassi@hotmail.com', NULL, '+33699134950', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 57, 'Kouakou Sylvain', 'Kouadio',
     'Chargé des Etudes et des Agréments', 'Banque Centrale des Etats de l''Afrique de l''Ouest (BCEAO) — Direction des Etudes et des Relations Internationales du Secrétariat Général de la Commission Bancaire de l UMOA — Etudes, Statistiques et Agréments',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'kouadiokouakousylvain@gmail.com', 'sykouadio@hotmail.com', '+2250709741534', '+2250556843743' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 48, 'Donald', 'Zountcheme',
     'Lead DataScience Developer', 'ENGIE DIGITAL',
     'FR', 'Paris',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'donald.zountcheme@gmail.com', 'donoeg@gmail.com', '+33753258354', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 33, 'Ani Moïse', 'Séry',
     'Inspecteur Senior', 'Secrétariat Général de la Commission Bancaire de l''UMOA — Direction du Contrôle sur Place des SFD',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'esiomyres@live.fr', NULL, '+221772096918', '+2250707646886' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 51, 'Samuel', 'Gbari',
     'Manager - Actuarial Services', 'EY',
     'BE', 'Gembloux',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'gbarifr@yahoo.fr', NULL, '+32476229632', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 41, 'Gbowan Barnabé', 'Djegnene',
     'CHERCHEUR', 'INDÉPENDANT',
     'CI', NULL,
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'djegnene.barnabe@gmail.com', NULL, '+2250565891535', NULL from new_profile;
