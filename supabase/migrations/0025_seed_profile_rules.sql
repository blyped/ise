-- =====================================================================
-- 0025_seed_profile_rules
-- Seed des regles de profil : visibilites par defaut et ponderations du
-- score de completion.
--
-- Decisions appliquees :
--   D-73 : echelle de visibilite unifiee a 4 niveaux -
--          `private` (moi seul) / `connections` (mes relations) /
--          `promotion` (ma promotion) / `members` (tous les membres
--          authentifies). Aucune visibilite `public` en V1 : les profils ne
--          sont pas exposes au web ouvert (MASTER PROMPT section 47).
--          Les valeurs sont validees par `public.is_visibility_level()`.
--   D-74 : visibilites par defaut des champs non specifies - e-mail
--          personnel, telephone, CV, date de naissance et adresse en
--          `private` ; employeur actuel, poste, ville, pays et LinkedIn en
--          `members`. Par defaut, le moins expose.
--          `allowed_levels` borne ce que l'utilisateur peut choisir :
--            - nom et promotion ne descendent jamais sous `connections`
--              (un profil doit rester identifiable dans l'annuaire) ;
--            - telephone, e-mail, CV et date de naissance ne montent jamais
--              au-dessus de `connections` (doc 21 section 37 : ne jamais
--              forcer le numero de telephone en visibilite reseau) ;
--            - adresse postale reste strictement privee ;
--            - le score de completion reste strictement prive (D-72).
--   D-71 : les ponderations du score de completion vivent en base
--          (`profile_completion_rules`) et non dans le code, afin d'etre
--          recalibrees par le back-office sans migration.
--          Les 13 ponderations de bloc proviennent du tableau final du
--          doc 21 (Identite 10, Photo 5, Situation 15, Bio 5, Competences 20,
--          Experiences 15, Formation 5, Secteurs 5, Pays d'experience 5,
--          Outils 5, Langues 3, Disponibilite 4, Contribution 3) et totalisent
--          exactement 100. Les sous-ponderations internes non chiffrees par le
--          doc 21 (Ville, Photo, Pays professionnel, Bio, Formation, Secteurs,
--          Pays d'experience, Outils, Langues, Contribution) sont reparties
--          uniformement sur le reliquat de leur bloc par
--          `public.calculate_profile_completion()`, conformement a D-71.
--          `sort_order` porte l'ordre de priorite des suggestions du
--          doc 21 section 104 (Competences -> Fonction actuelle -> Experience
--          -> Secteurs -> Disponibilite -> Pays d'experience -> Photo -> Bio
--          -> Outils -> Langues), utilise par le "Next Best Action".
--
-- Migration de DONNEES uniquement : aucun DDL, aucune modification de RLS.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Visibilites par defaut (D-73 / D-74)
-- ---------------------------------------------------------------------
insert into public.profile_visibility_defaults (field_key, label, default_visibility, allowed_levels, sort_order) values
  ('full_name', 'Nom et prénom', 'members', array['connections','promotion','members']::text[], 10),
  ('photo', 'Photo de profil', 'members', array['private','connections','promotion','members']::text[], 20),
  ('headline', 'Titre professionnel', 'members', array['private','connections','promotion','members']::text[], 30),
  ('promotion', 'Promotion ISE', 'members', array['connections','promotion','members']::text[], 40),
  ('bio', 'À propos', 'members', array['private','connections','promotion','members']::text[], 50),
  ('current_position', 'Poste actuel', 'members', array['private','connections','promotion','members']::text[], 60),
  ('current_organization', 'Employeur actuel', 'members', array['private','connections','promotion','members']::text[], 70),
  ('sectors', 'Secteurs', 'members', array['private','connections','promotion','members']::text[], 80),
  ('country', 'Pays de résidence', 'members', array['private','connections','promotion','members']::text[], 90),
  ('city', 'Ville', 'members', array['private','connections','promotion','members']::text[], 100),
  ('experience_countries', 'Pays d''expérience', 'members', array['private','connections','promotion','members']::text[], 110),
  ('skills', 'Compétences', 'members', array['private','connections','promotion','members']::text[], 120),
  ('tools', 'Outils', 'members', array['private','connections','promotion','members']::text[], 130),
  ('languages', 'Langues', 'members', array['private','connections','promotion','members']::text[], 140),
  ('experiences', 'Expériences professionnelles', 'members', array['private','connections','promotion','members']::text[], 150),
  ('educations', 'Formations', 'members', array['private','connections','promotion','members']::text[], 160),
  ('availabilities', 'Disponibilités', 'members', array['private','connections','promotion','members']::text[], 170),
  ('interests', 'Besoins et attentes', 'members', array['private','connections','promotion','members']::text[], 180),
  ('contributions', 'Contribution au réseau', 'members', array['private','connections','promotion','members']::text[], 190),
  ('linkedin_url', 'Profil LinkedIn', 'members', array['private','connections','promotion','members']::text[], 200),
  ('website_url', 'Site web personnel', 'members', array['private','connections','promotion','members']::text[], 210),
  ('email', 'Adresse e-mail personnelle', 'private', array['private','connections']::text[], 220),
  ('phone', 'Téléphone', 'private', array['private','connections']::text[], 230),
  ('cv', 'CV', 'private', array['private','connections']::text[], 240),
  ('birth_date', 'Date de naissance', 'private', array['private','connections']::text[], 250),
  ('address', 'Adresse postale', 'private', array['private']::text[], 260),
  ('completion_score', 'Score de complétion du profil', 'private', array['private']::text[], 270)
on conflict (field_key) do nothing;

-- ---------------------------------------------------------------------
-- 2. Ponderations du score de completion (D-71) - total = 100
-- ---------------------------------------------------------------------
insert into public.profile_completion_rules (block_key, label, weight, hint, sort_order) values
  ('identity', 'Identité de base', 10, 'Complétez votre prénom, votre nom, votre promotion et votre pays.', 5),
  ('skills', 'Compétences', 20, 'Ajoutez vos principales compétences.', 10),
  ('current_situation', 'Situation professionnelle', 15, 'Indiquez votre fonction actuelle, votre organisation et votre secteur.', 20),
  ('experiences', 'Expériences', 15, 'Ajoutez vos expériences professionnelles avec leurs dates et leur pays.', 30),
  ('sectors', 'Secteurs', 5, 'Précisez les secteurs dans lesquels vous intervenez.', 40),
  ('availability', 'Disponibilité', 4, 'Ajoutez vos disponibilités pour que le réseau sache quand vous solliciter.', 50),
  ('experience_countries', 'Pays d''expérience', 5, 'Indiquez les pays dans lesquels vous avez travaillé.', 60),
  ('photo', 'Photo', 5, 'Ajoutez une photo professionnelle.', 70),
  ('bio', 'Bio', 5, 'Présentez votre parcours en quelques lignes.', 80),
  ('tools', 'Outils', 5, 'Ajoutez vos outils principaux.', 90),
  ('languages', 'Langues', 3, 'Renseignez les langues que vous pratiquez.', 100),
  ('education', 'Formation complémentaire', 5, 'Ajoutez vos formations complémentaires.', 110),
  ('network_contribution', 'Contribution au réseau', 3, 'Indiquez comment vous pouvez aider le réseau.', 120)
on conflict (block_key) do nothing;
