-- 0088_import_ise_census part 3/6

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 41, 'Prosper', 'Dovonon',
     'Professeur', 'Concordia University, Montréal, Canada — Québec',
     'CA', 'Montréal',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'prosper.dovonon@gmail.com', NULL, '+15148482424', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 55, 'Doffou Marc Elisée', 'Monsoh',
     'Economiste Senior', 'ANARE-CI __Autorité nationale de régulation du secteur de l’électricité en Côte d’Ivoire — Direction des Etudes Economiques et Financières',
     'CI', 'Abidajn',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'elisee.monsoh@gmail.com', NULL, '+225545512360', '+225757016392' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 59, 'Debby Gilchrist Lorn', 'Houngbeme',
     'Chargé d''études statistiques et économiques', 'Direction Générale de l''Economie du Bénin — Littoral',
     'BJ', 'Cotonou',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'lornhoungbeme@yahoo.fr', 'ghoungbeme@gmail.com', '+22996433040', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 53, 'Yassé Salomon', 'Inané',
     'Manager Risk Consulting', 'KPMG — Abidjan',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'salomon.inane@gmail.com', 'salomon.inane@gmail.com', '+225749867381', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 57, 'Atchoumounan', 'Traore',
     'Manager en charge du suivi de la productivité', 'Compagnie Ivoirienne d''électricité cie — Organisation — Suivi de la productivité',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'traoreatc@gmail.com', NULL, '+2250153100319', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 56, 'Guillaume', 'Adingra',
     'Chargé d''etudes et veille stratégique', 'Voodoo communication',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'adingraguillaume@gmail.com', NULL, '+225709757790', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 41, 'Ibrahima', 'Sory',
     'Expert en comptabilité nationale', 'AFRISTAT — BAMAKO',
     'ML', 'BAMAKO',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'ibsory@yahoo.fr', 'sory@afristat.org', '+22375909319', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 40, 'Souleymane', 'Coulibaly',
     'LEAD ECONOMIST AND PROGRAM LEADER', 'THE WORLD BANK',
     'US', 'WASHINGTON DC',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'scoulibaly2@worldbank.org', 'csouleymane@yahoo.fr', '+12026408363', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 42, 'Guy Michel', 'Okon',
     'Directeur', 'AFRIQUE PESAGE — Département des Statistiques et des Etudes',
     'SN', NULL,
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'guyokon@yahoo.fr', NULL, '+221772892494', '+2250777777371' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 37, 'Hervé', 'Lohoues',
     'Lead Economist', 'Banque Africaine de Développement (BAD)',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'hlohoues@hotmail.com', 'h.lohoues@afdb.org', '+2250575750872', '+2250102651209' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 37, 'Charlie Jerry', 'Dingui',
     'Directeur des Activités Bancaires et des Financements Alternatifs', 'BCEAO',
     'SN', 'Dakar',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'charlie@dingui.net', 'cdingui@bceao.int', '+221772910101', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 52, 'Iris Michelle', 'Konan',
     'Chef de département pilotage de la Performance et PMO experielce client', 'ORANGE CI',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'iris.konan@gmail.com', 'iris.konan@gmail.com', '+2250707135318', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 50, 'Oumarou', 'Coulibaly',
     'Chargé d''Etudes', 'BNETD — Cabinet du Ministre du Commerce et de l''Industrie',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'oumarou.coul@yahoo.fr', NULL, '+225757284834', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 50, 'Watara Nadjarikan', 'Kokou-Awanou',
     'Directeur', 'Institut national de la statistique et ses études économiques et démographiques (INSEED) — Direction de la coordination et de la coopération internationale',
     'TG', 'Togo, Lomé',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'awanou10@yahoo.fr', 'awanou10@gmail.com', '+22898378954', '+22890211496' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 50, 'Abdou', 'Ouattara',
     'Spécialiste en gestion des risques', 'Caisse des dépôts et consignations du Burkina Faso — Risques',
     'BF', 'Ouagadougou',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'abdezouatt@yahoo.fr', 'abdezouatt@yahoo.fr', '+22667106060', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 42, 'Christian', 'Tape',
     'Directeur Général Adjoint', 'Institut National de la Statistique',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'christiantape@gmail.com', 'c.tape@stat.plan.gouv.ci', '+2250707256053', '+2250101151996' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 52, 'Koassi', 'Akakpo',
     'Monitoring & Evaluation Manager', 'GOREE INSTITUTE',
     'SN', 'Dakar',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'akakpo.koassi@gmail.com', 'akfred2007@yahoo.fr', '+221778028088', '+221768403757' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 52, 'Sékou', 'Kone',
     'Impact Evaluation Coordinator', 'Banque mondiale — Développement Impact Évaluation (DIME)',
     'BF', 'Ouagadougou',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'skone1@worldbank.org', 'sekoukonedavid@gmail.com', '+22665080101', '+22670022220' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 52, 'Vanie Ange', 'Zoro Bi',
     'Chef de Service', 'Tresor Public — Abidjan — Finances exterieures',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'bivanezoro@gmail.com', NULL, '+2250758665682', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 40, 'Lalaniaina Mamisoa Christian', 'Razakamanantsoa',
     'Economic Assistant', 'US Embassy',
     'MG', 'Antananarivo',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'lrazakamanantsoa@gmail.com', NULL, NULL, NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 52, 'Ibrahima', 'Camara',
     'Statisticien Économiste', 'Banque Centrale de la République de Guinée — Études et Recherche',
     'GN', 'Conakry',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'icamara99@gmail.com', NULL, '+224621999402', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 50, 'Samuel', 'Tchioutchoua Lenou',
     'Chargé d''études assistant', 'MINISTÈRE DES FINANCES',
     'CM', 'Yaoundé',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'samuel.lenou@yahoo.fr', NULL, '+237670109792', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 40, 'Euloge Gervais', 'Tchoutan Ngoudjou',
     'Sr Manager/Directeur Procurement', 'United Airlines',
     'US', 'Chicago',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'tchoutan@yahoo.com', 'gtchoutan@hotmail.com', '+18478998897', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 58, 'Ansonibè', 'Poda',
     'Directeur des statistiques sectorielles', 'Ministère de la Jeunesse et de la promotion de l’entreprenariat et de l’emploi',
     'BF', NULL,
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'ansonibe@vmail.com', NULL, '+22674353876', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 52, 'Ibrahim', 'Dodo Natatou',
     'Chef du Service des Etudes et de la Statistique', 'BCEAO',
     'NE', 'Niamey',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'donatatou2005@gmail.com', NULL, '+22799924684', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 37, 'Souleymane', 'Abdallah',
     'Economic Affairs Officer', 'United Nations Economic Commission for Africa — African Trade Policy Centre',
     'ET', 'Addis Ababa',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'slymabdallah@gmail.com', 'slymabdallah@hotmail.com', '+251922112323', '+22796968896' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 53, 'Abdourahimoune', 'Amadou Abdoul Aziz',
     'CONJONCTURISTE', 'BCEAO — Service des Études et de la Statistique',
     'NE', 'Niamey',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'aabdourahimoune@yahoo.fr', 'aamadouabdoulaziz@bceao.int', '+22789888864', '+22791164646' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 60, 'Kadio Arthur Lionel', 'Kouao',
     'Chargé d''études', 'Ministère du Plan et du Développement (Cabinet du Ministre)',
     'CI', NULL,
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'arthur_kadio@hotmail.fr', NULL, '+225709739033', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 54, 'Kouakou Ange Désiré', 'Allou',
     'Chargé d''Études', 'Ministère du Budget et du Portefeuille de l''Etat — Direction Générale des Impôts',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'akange.d@gmail.com', NULL, '+225748137935', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 45, 'Appia Ange Isaac', 'Aka',
     'Inspecteur Vérificateur des Finances', 'Inspection Générale des Finances',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'akaappia@yahoo.fr', NULL, '+2250758982646', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 54, 'Gnonléba Aubin', 'Tape',
     'Directeur de Cabinet Adjoint', 'Ministère de l''Emploi et de la Protection Sociale',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'stape_aubin@yahoo.fr', NULL, '+225749241917', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 43, 'Guillaume Thierry', 'Siewe',
     'Chef de Division des Etudes et Analyses de la Dette Publique du Cameroun', 'CAISSE AUTONOME D’AMORTISSEMENT',
     'CM', 'Yaoundé Cameroun',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'thierry_siewe@yahoo.fr', 'gthierry.siewe.ts@gmail.com', '+237677867705', '+237694694282' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 43, 'Romuald', 'Momeya',
     'Senior Advisor', 'Banque Laurentienne — Risk Management',
     'CA', 'Laval',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'momeya2008@gmail.com', 'momeya2008@gmail.com', '+14506227277', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 44, 'Denis', 'Ngangoum',
     'Responsable pilotage activité et BI', 'SCB Cameroun — WOURI — Pilotage Activité Retail',
     'CM', 'Douala',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'denis.ngangoum@gmail.com', 'denis.ngangoum@scbcameroun.com', '+237679510789', '+237680019253' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 54, 'N''Guessan Joël', 'Kouadio',
     'Analyste de données', 'Orange Bank Africa S.A. — Crédit & Scoring — Crédit & Scoring',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'nj.kouadio@gmail.com', NULL, '+2250545690644', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 52, 'Bassan', 'Bazie',
     'Directeur des Opérations', 'SONAR IARD — Kadiogo — Direction des Opérations',
     'BF', 'Ouagadougou',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'b_bassan@yahoo.fr', 'b_bassan@hotmail.fr', '+22670204506', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 52, 'Gina Melissa', 'Kanda',
     'Actuaire Inventaire', 'SUNU ASSURANCES VIE CI — Direction Etudes et Actuariat',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'kandacho1@gmail.com', NULL, '+225709686319', '+225505290696' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 43, 'Sohouet Eric', 'Kone',
     'Director, Monetization and Pricing Strategy', 'Match Group LLC',
     'US', 'Dallas',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'koneeric@gmail.com', NULL, '+19726899167', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 54, 'Adama', 'Diawara',
     'Responsable business analyst', 'Orange Côte d''Ivoire',
     'CI', 'Abidjan',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'adi.diawara@yahoo.fr', NULL, '+225759077730', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 39, 'Kouakou Hyppolite', 'Konan',
     'Chef de Division Suivi des Économies Nationales', 'Commission de l''UEMOA — Département des Politiques Economiques — Direction de la Surveillance Multilatérale',
     'BF', 'Ouagadougou',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'hkonan2001@yahoo.fr', NULL, '+22677779241', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 39, 'Bléhoué Toussaint', 'Damoh',
     'Directeur de la Conjoncture Économique et des Analyses Monétaires', 'BCEAO',
     'SN', 'Dakar',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'tdamoh@bceao.int', NULL, '+221776490708', NULL from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 38, 'Balamine', 'Diane',
     'ADJOINT AU DIRECTEUR', 'BCEAO — Dakar',
     'SN', 'Dakar',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'bdiane@bceao.int', 'balaping@gmail.com', '+221773597699', '+221778149084' from new_profile;

with new_profile as (
  insert into public.ise_profiles
    (user_id, promotion_id, first_name, last_name,
     current_position, current_organization_raw,
     current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (null, 40, 'Railovy', 'Boyer',
     'Founder', 'Boyer Consulting Services',
     'FR', 'Toulouse',
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id
)
insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
select id, 'railovy@yahoo.com', NULL, '+33607869786', NULL from new_profile;
