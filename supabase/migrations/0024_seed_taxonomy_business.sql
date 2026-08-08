-- =====================================================================
-- 0024_seed_taxonomy_business
-- Seed des referentiels metier : secteurs et adjacences, fonctions
-- professionnelles, domaines d'expertise, outils, types de disponibilite,
-- motifs de signalement, promotions ISE.
--
-- Decisions appliquees :
--   D-40 / D-41 : `sector_adjacencies` alimente le palier "secteur connexe"
--                 du score de matching (exact 15 / connexe 9 / absent 0).
--                 La relation est stockee dans les DEUX sens : le moteur n'a
--                 pas a normaliser l'ordre du couple.
--   D-64 : fonctions professionnelles (referentiel absent des specifications,
--          derive du filtre "Fonction" du doc 22 Partie C et des intitules
--          cites dans les documents) et promotions generees par annee,
--          de 1960 a l'annee courante + 5 (2031).
--   D-65 : 13 codes de disponibilite du doc 20, completes par
--          `ad_hoc_expertise` ("Expertise ponctuelle"), concept present dans
--          les docs 19 / 21 / 2 mais depourvu de code dans le doc 20.
--          Le referentiel compte donc 14 codes : retirer `ad_hoc_expertise`
--          reviendrait a perdre une forme de disponibilite documentee.
--   D-66 : referentiel unique de 9 motifs de signalement, filtres a
--          l'affichage par `applies_to`.
--
-- Les identifiants sont `generated always as identity` : aucun `id` explicite
-- n'est insere ; les FK sont resolues par `slug` / `code`.
-- Migration de DONNEES uniquement : aucun DDL, aucune modification de RLS.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Secteurs (doc 20 Partie B - 35 entrees)
-- ---------------------------------------------------------------------
insert into public.sectors (name, slug, sort_order) values
  ('Administration publique', 'administration-publique', 10),
  ('Agriculture', 'agriculture', 20),
  ('Agro-industrie', 'agro-industrie', 30),
  ('Assurance', 'assurance', 40),
  ('Banque', 'banque', 50),
  ('Commerce', 'commerce', 60),
  ('Conseil', 'conseil', 70),
  ('Développement international', 'developpement-international', 80),
  ('Éducation', 'education', 90),
  ('Énergie', 'energie', 100),
  ('Environnement et climat', 'environnement-climat', 110),
  ('Finance', 'finance', 120),
  ('Industrie', 'industrie', 130),
  ('Statistique publique', 'statistique-publique', 140),
  ('Logistique', 'logistique', 150),
  ('Microfinance', 'microfinance', 160),
  ('ONG', 'ong', 170),
  ('Organisations internationales', 'organisations-internationales', 180),
  ('Recherche et université', 'recherche-universite', 190),
  ('Santé', 'sante', 200),
  ('Télécommunications', 'telecommunications', 210),
  ('Technologie', 'technologie', 220),
  ('Transport', 'transport', 230),
  ('Tourisme', 'tourisme', 240),
  ('Protection sociale', 'protection-sociale', 250),
  ('FinTech', 'fintech', 260),
  ('Immobilier', 'immobilier', 270),
  ('Mines', 'mines', 280),
  ('Pétrole et gaz', 'petrole-gaz', 290),
  ('Services professionnels', 'services-professionnels', 300),
  ('Eau et assainissement', 'eau-assainissement', 310),
  ('Infrastructures', 'infrastructures', 320),
  ('Humanitaire', 'humanitaire', 330),
  ('Sécurité alimentaire', 'securite-alimentaire', 340),
  ('Secteur social', 'secteur-social', 350)
on conflict (slug) do nothing;

-- Hierarchie sectorielle : rattachement des sous-secteurs a leur secteur pere.
update public.sectors child
set parent_id = parent.id, updated_at = now()
from (values
  ('agro-industrie', 'agriculture'),
  ('assurance', 'finance'),
  ('banque', 'finance'),
  ('microfinance', 'finance'),
  ('protection-sociale', 'secteur-social'),
  ('fintech', 'finance'),
  ('securite-alimentaire', 'agriculture')
) as v(child_slug, parent_slug)
join public.sectors parent on parent.slug = v.parent_slug
where child.slug = v.child_slug
  and child.parent_id is distinct from parent.id;

-- ---------------------------------------------------------------------
-- 2. Adjacences sectorielles (56 couples, 112 lignes symetriques)
-- ---------------------------------------------------------------------
insert into public.sector_adjacencies (sector_id, related_sector_id)
select a.id, b.id
from (values
  ('agriculture', 'agro-industrie'),
  ('agriculture', 'securite-alimentaire'),
  ('agriculture', 'environnement-climat'),
  ('agro-industrie', 'industrie'),
  ('agro-industrie', 'commerce'),
  ('banque', 'finance'),
  ('banque', 'microfinance'),
  ('banque', 'assurance'),
  ('banque', 'fintech'),
  ('finance', 'assurance'),
  ('finance', 'microfinance'),
  ('finance', 'fintech'),
  ('microfinance', 'fintech'),
  ('fintech', 'technologie'),
  ('technologie', 'telecommunications'),
  ('technologie', 'services-professionnels'),
  ('conseil', 'services-professionnels'),
  ('conseil', 'recherche-universite'),
  ('conseil', 'statistique-publique'),
  ('administration-publique', 'statistique-publique'),
  ('administration-publique', 'protection-sociale'),
  ('administration-publique', 'secteur-social'),
  ('developpement-international', 'organisations-internationales'),
  ('developpement-international', 'ong'),
  ('developpement-international', 'humanitaire'),
  ('ong', 'humanitaire'),
  ('ong', 'secteur-social'),
  ('organisations-internationales', 'humanitaire'),
  ('sante', 'secteur-social'),
  ('sante', 'protection-sociale'),
  ('education', 'recherche-universite'),
  ('education', 'secteur-social'),
  ('protection-sociale', 'secteur-social'),
  ('energie', 'petrole-gaz'),
  ('energie', 'mines'),
  ('energie', 'infrastructures'),
  ('energie', 'environnement-climat'),
  ('mines', 'petrole-gaz'),
  ('transport', 'logistique'),
  ('transport', 'infrastructures'),
  ('logistique', 'commerce'),
  ('infrastructures', 'immobilier'),
  ('infrastructures', 'eau-assainissement'),
  ('eau-assainissement', 'environnement-climat'),
  ('eau-assainissement', 'sante'),
  ('environnement-climat', 'humanitaire'),
  ('securite-alimentaire', 'humanitaire'),
  ('securite-alimentaire', 'sante'),
  ('industrie', 'commerce'),
  ('tourisme', 'transport'),
  ('tourisme', 'commerce'),
  ('statistique-publique', 'recherche-universite'),
  ('recherche-universite', 'technologie'),
  ('immobilier', 'finance'),
  ('telecommunications', 'infrastructures'),
  ('services-professionnels', 'commerce')
) as v(a_slug, b_slug)
cross join lateral (values (v.a_slug, v.b_slug), (v.b_slug, v.a_slug)) as p(s1, s2)
join public.sectors a on a.slug = p.s1
join public.sectors b on b.slug = p.s2
on conflict (sector_id, related_sector_id) do nothing;

-- ---------------------------------------------------------------------
-- 3. Fonctions professionnelles (D-64)
-- ---------------------------------------------------------------------
insert into public.job_functions (name, slug, sort_order) values
  ('Ingénieur statisticien économiste', 'ingenieur-statisticien-economiste', 10),
  ('Statisticien', 'statisticien', 20),
  ('Économiste', 'economiste', 30),
  ('Économètre', 'econometre', 40),
  ('Démographe', 'demographe', 50),
  ('Actuaire', 'actuaire', 60),
  ('Data Scientist', 'data-scientist', 70),
  ('Data Analyst', 'data-analyst', 80),
  ('Data Engineer', 'data-engineer', 90),
  ('Analyste financier', 'analyste-financier', 100),
  ('Analyste de risques', 'analyste-risques', 110),
  ('Chargé d''études', 'charge-etudes', 120),
  ('Chargé de mission', 'charge-mission', 130),
  ('Chargé d''enquête', 'charge-enquete', 140),
  ('Spécialiste suivi-évaluation', 'specialiste-suivi-evaluation', 150),
  ('Évaluateur', 'evaluateur', 160),
  ('Consultant', 'consultant', 170),
  ('Consultant senior', 'consultant-senior', 180),
  ('Expert technique', 'expert-technique', 190),
  ('Conseiller technique', 'conseiller-technique', 200),
  ('Chef de projet', 'chef-projet', 210),
  ('Coordonnateur de programme', 'coordonnateur-programme', 220),
  ('Directeur de programme', 'directeur-programme', 230),
  ('Responsable des études', 'responsable-etudes', 240),
  ('Responsable statistique', 'responsable-statistique', 250),
  ('Responsable Business Intelligence', 'responsable-business-intelligence', 260),
  ('Géomaticien', 'geomaticien', 270),
  ('Développeur', 'developpeur', 280),
  ('Chercheur', 'chercheur', 290),
  ('Enseignant-chercheur', 'enseignant-chercheur', 300),
  ('Auditeur', 'auditeur', 310),
  ('Contrôleur de gestion', 'controleur-gestion', 320),
  ('Directeur général', 'directeur-general', 330),
  ('Directeur des opérations', 'directeur-operations', 340),
  ('Entrepreneur / Fondateur', 'entrepreneur-fondateur', 350),
  ('Élève ISE / Stagiaire', 'eleve-ise-stagiaire', 360)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- 4. Domaines d'expertise
--    Familles de navigation de l'autocomplete competences (doc 20 Partie P) :
--    ne pas exposer d'emblee les 500+ competences, afficher d'abord la famille.
-- ---------------------------------------------------------------------
insert into public.expertise_areas (name, slug, sort_order) values
  ('Statistique', 'statistique', 10),
  ('Économétrie', 'econometrie', 20),
  ('Économie', 'economie', 30),
  ('Data & IA', 'data-ia', 40),
  ('Enquêtes', 'enquetes', 50),
  ('Suivi-évaluation', 'suivi-evaluation', 60),
  ('Finance', 'finance', 70),
  ('Agriculture', 'agriculture', 80),
  ('Santé', 'sante', 90),
  ('Politiques publiques', 'politiques-publiques', 100),
  ('Gestion de projet', 'gestion-projet', 110),
  ('Conseil', 'conseil', 120),
  ('SIG', 'sig', 130),
  ('Business Intelligence', 'business-intelligence', 140)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- 5. Outils (doc 20 Partie A - 44 entrees)
-- ---------------------------------------------------------------------
insert into public.tools (name, slug, category, sort_order) values
  ('R', 'r', 'statistical', 10),
  ('Stata', 'stata', 'statistical', 20),
  ('SAS', 'sas', 'statistical', 30),
  ('SPSS', 'spss', 'statistical', 40),
  ('EViews', 'eviews', 'statistical', 50),
  ('Gretl', 'gretl', 'statistical', 60),
  ('Matlab', 'matlab', 'scientific', 70),
  ('Julia', 'julia', 'scientific', 80),
  ('Python', 'python', 'programming', 90),
  ('SQL', 'sql', 'database', 100),
  ('Jupyter', 'jupyter', 'data', 110),
  ('RStudio', 'rstudio', 'data', 120),
  ('Git', 'git', 'development', 130),
  ('GitHub', 'github', 'development', 140),
  ('VS Code', 'vscode', 'development', 150),
  ('Power BI', 'power-bi', 'bi', 160),
  ('Tableau', 'tableau', 'bi', 170),
  ('Qlik Sense', 'qlik-sense', 'bi', 180),
  ('Looker', 'looker', 'bi', 190),
  ('Microsoft Excel', 'excel', 'productivity', 200),
  ('CSPro', 'cspro', 'survey', 210),
  ('Survey Solutions', 'survey-solutions', 'survey', 220),
  ('KoboToolbox', 'kobotoolbox', 'survey', 230),
  ('ODK', 'odk', 'survey', 240),
  ('SurveyCTO', 'surveycto', 'survey', 250),
  ('Qualtrics', 'qualtrics', 'survey', 260),
  ('REDCap', 'redcap', 'survey', 270),
  ('ArcGIS', 'arcgis', 'gis', 280),
  ('QGIS', 'qgis', 'gis', 290),
  ('Google Earth Engine', 'google-earth-engine', 'gis', 300),
  ('GeoDa', 'geoda', 'gis', 310),
  ('PostgreSQL', 'postgresql', 'database', 320),
  ('MySQL', 'mysql', 'database', 330),
  ('Microsoft SQL Server', 'sql-server', 'database', 340),
  ('Oracle Database', 'oracle-database', 'database', 350),
  ('MongoDB', 'mongodb', 'database', 360),
  ('BigQuery', 'bigquery', 'database', 370),
  ('AWS', 'aws', 'cloud', 380),
  ('Microsoft Azure', 'azure', 'cloud', 390),
  ('Google Cloud Platform', 'google-cloud', 'cloud', 400),
  ('Supabase', 'supabase', 'backend', 410),
  ('Firebase', 'firebase', 'backend', 420),
  ('Docker', 'docker', 'devops', 430),
  ('Vercel', 'vercel', 'cloud', 440)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- 6. Types de disponibilite (D-65)
-- ---------------------------------------------------------------------
insert into public.availability_types (code, name, description, sort_order) values
  ('employment', 'Emploi', 'Ouvert à une opportunité d''emploi salarié.', 10),
  ('consulting', 'Consultance', 'Disponible pour des missions de consultance.', 20),
  ('mission', 'Mission', 'Disponible pour une mission ponctuelle ou de terrain.', 30),
  ('ad_hoc_expertise', 'Expertise ponctuelle', 'Disponible pour un avis d''expert ponctuel, sans engagement de durée.', 40),
  ('mentorship', 'Mentorat', 'Disponible pour accompagner un ISE en mentorat.', 50),
  ('internship_hosting', 'Accueil de stagiaire', 'Peut accueillir un élève ISE en stage.', 60),
  ('training', 'Formation', 'Disponible pour concevoir ou animer une formation.', 70),
  ('speaking', 'Conférence / intervention', 'Disponible pour intervenir lors d''un événement.', 80),
  ('advisory', 'Conseil / Advisory', 'Disponible pour un rôle de conseil auprès d''une organisation.', 90),
  ('board', 'Conseil d''administration', 'Disponible pour siéger dans un conseil d''administration.', 100),
  ('research', 'Recherche', 'Disponible pour participer à un travail de recherche.', 110),
  ('project', 'Projet collaboratif', 'Disponible pour collaborer sur un projet.', 120),
  ('partnership', 'Partenariat', 'Ouvert à un partenariat professionnel ou institutionnel.', 130),
  ('introduction', 'Mise en relation', 'Accepte de faire des introductions au sein du réseau.', 140)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- 7. Motifs de signalement (D-66)
-- ---------------------------------------------------------------------
insert into public.report_reasons (code, name, description, applies_to, sort_order) values
  ('fake_profile', 'Faux profil', 'Profil qui ne correspond à aucune personne réelle.', array['profile']::text[], 10),
  ('impersonation', 'Usurpation d''identité', 'Profil se faisant passer pour quelqu''un d''autre.', array['profile']::text[], 20),
  ('harassment', 'Harcèlement', 'Propos ou comportements harcelants.', array['profile','conversation','message','comment']::text[], 30),
  ('spam', 'Spam', 'Messages ou publications répétitifs et non sollicités.', array['profile','conversation','message','network_call','opportunity','project','news_post','event','community','comment']::text[], 40),
  ('abusive_solicitation', 'Prospection abusive', 'Démarchage commercial agressif ou hors cadre professionnel.', array['profile','conversation','message','opportunity']::text[], 50),
  ('false_information', 'Informations fausses ou trompeuses', 'Contenu inexact destiné à induire en erreur.', array['profile','opportunity','project','news_post','event','comment']::text[], 60),
  ('inappropriate_content', 'Contenu inapproprié', 'Contenu offensant, illégal ou sans rapport avec le réseau.', array['profile','conversation','message','network_call','opportunity','project','news_post','event','community','comment']::text[], 70),
  ('fraud', 'Fraude', 'Tentative d''escroquerie ou de détournement.', array['profile','conversation','message','opportunity','project']::text[], 80),
  ('other', 'Autre', 'Motif non couvert par les catégories précédentes.', array['profile','conversation','message','network_call','opportunity','project','news_post','event','community','comment']::text[], 90)
on conflict (code) do nothing;

-- Les 9 motifs ont ete crees en 0016 avec des libelles non accentues.
-- Mise en conformite avec la regle "libelles utilisateur en francais accentue"
-- (docs/db-conventions.md section 5). Idempotent.
update public.report_reasons r
set name = v.name, description = v.description
from (values
  ('fake_profile', 'Faux profil', 'Profil qui ne correspond à aucune personne réelle.'),
  ('impersonation', 'Usurpation d''identité', 'Profil se faisant passer pour quelqu''un d''autre.'),
  ('harassment', 'Harcèlement', 'Propos ou comportements harcelants.'),
  ('spam', 'Spam', 'Messages ou publications répétitifs et non sollicités.'),
  ('abusive_solicitation', 'Prospection abusive', 'Démarchage commercial agressif ou hors cadre professionnel.'),
  ('false_information', 'Informations fausses ou trompeuses', 'Contenu inexact destiné à induire en erreur.'),
  ('inappropriate_content', 'Contenu inapproprié', 'Contenu offensant, illégal ou sans rapport avec le réseau.'),
  ('fraud', 'Fraude', 'Tentative d''escroquerie ou de détournement.'),
  ('other', 'Autre', 'Motif non couvert par les catégories précédentes.')
) as v(code, name, description)
where r.code = v.code
  and (r.name is distinct from v.name or r.description is distinct from v.description);

-- ---------------------------------------------------------------------
-- 8. Promotions ISE 1960 -> 2031 (D-64)
-- ---------------------------------------------------------------------
insert into public.promotions (program_code, graduation_year, name)
select 'ISE', y, 'Promotion ISE ' || y::text
from generate_series(1960, 2031) as g(y)
on conflict (program_code, graduation_year) do nothing;
