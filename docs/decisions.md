# Journal des décisions — Compétences ISE

Ce document consigne tout arbitrage rendu lorsque les sources se contredisent, conformément au
MASTER PROMPT §2 (hiérarchie : sécurité > règles du MASTER PROMPT > maquettes & spécifications >
détails visuels) et §114 (« prendre une décision raisonnable, la documenter, continuer »).

Statut des décisions : **ADOPTÉE** (appliquée au code) · **PROVISOIRE** (à confirmer par le métier)
· **OUVERTE** (bloquante, en attente).

---

## 0. Décisions de cadrage (validées par le porteur du projet, 07/08/2026)

| # | Décision | Justification |
| --- | --- | --- |
| C-01 | **Un seul projet Supabase**, utilisé directement comme Production. | Choix explicite du porteur. Mitigation : 100 % des changements DB passent par des migrations versionnées et rejouables ; aucun `DROP` destructif hors migration documentée ; l'ajout ultérieur d'un projet `staging` reste possible sans refonte. |
| C-02 | **Web d'abord, mobile ensuite.** Le monorepo et les packages partagés (`domain`, `validation`, `design-tokens`, `db-types`) sont créés dès la Phase 1 pour que `apps/mobile` n'ait rien à réécrire. | Évite de déboguer deux fois la même règle métier ; MASTER PROMPT §4 et §53. |
| C-03 | **Push direct sur `main`** du dépôt `blyped/ise` pendant la construction initiale, avec CI GitHub Actions bloquante (lint, typecheck, tests, build). Passage au modèle par PR une fois les Phases 0–2 stabilisées. | Choix explicite du porteur. |
| C-04 | Le code vit dans `C:\Services\Ise\app` sur le poste et dans `blyped/ise` sur GitHub. Les documents de spécification restent à la racine `C:\Services\Ise` et ne sont pas versionnés dans le dépôt applicatif. | Sépare les sources métier du livrable logiciel. |
| C-05 | **Le back-office OPS (OPS-001 → OPS-028) est abandonné** — décision du porteur du projet, 08/08/2026 (« trop technique »). Les 28 maquettes OPS ne seront pas implémentées. La supervision reste assurée par les outils natifs Supabase (logs, advisors) et Vercel (observabilité), par les contrôles internes `security_baseline_violations()` / `storage_baseline_violations()` et par `get_cms_automation_status()`. Les permissions `ops.read` / `ops.manage` et le rôle `ops` restent en base, inoffensifs et réutilisables si la décision est revue, mais aucun écran ne les consomme. | Choix explicite du porteur. Cohérent avec le MASTER PROMPT §41, qui demandait déjà de ne pas construire « un deuxième gigantesque back-office technique » : Supabase et Vercel couvrent le besoin V1. |
| C-06 | **L'import en masse d'annuaire (SA-040, SA-041, SA-042, SA-044, SA-045) est abandonné** — décision du porteur du projet, 09/08/2026. L'unique jeu de données (recensement Excel de 275 réponses, 255 profils après dédoublonnage) a été importé directement en migration (`0088_import_ise_census`), en contournant volontairement ce module ; aucun autre import de masse n'est prévu, toute intégration future se fait par création de profil individuel. Les écrans de téléversement, mapping/anomalies, revue de doublons et campagnes de complétude sont retirés du code web. SA-043 (Profils incomplets) est conservé — utile indépendamment de l'origine du profil — et déplacé de `/administration/imports/profils-incomplets` vers `/administration/profils-incomplets`. Les tables (migration `0017`) et fonctions `admin_*` du pipeline d'import (migration `0080`) restent en base, inoffensives (SECURITY DEFINER + RLS), non consommées par aucun écran ; leur suppression est un nettoyage optionnel de la Phase 8-9 (dette technique, pas un risque de sécurité). La permission `imports.execute` n'est plus consommée par aucun écran ; `imports.review` continue de protéger SA-043. | Choix explicite du porteur, formulé après l'import réel du recensement ISE : le module d'import en masse n'a jamais servi (l'import a été fait en migration directe) et ne servira plus, il ne doit pas rester comme surface de produit décorative (MASTER PROMPT §113). |

---

## 1. Source de vérité en cas de contradiction

| # | Décision | Justification |
| --- | --- | --- |
| D-01 | **ADOPTÉE** — En cas de conflit, l'ordre de préséance est : (1) MASTER PROMPT ; (2) **nom de fichier de la maquette** ; (3) document de spécification UI/UX (série 24–35) ; (4) document de spécification fonctionnelle (série 0–23). | Le MASTER PROMPT §2 fixe la hiérarchie. Les maquettes livrées sont l'itération la plus récente et la plus concrète : leurs noms de fichiers tranchent tous les conflits de numérotation d'écrans. |
| D-02 | **ADOPTÉE** — Les documents UI/UX (24–35) l'emportent sur les documents fonctionnels (0–23) sur les détails d'interface ; l'inverse s'applique aux règles métier. | Les documents UI/UX sont postérieurs et se présentent comme « spécification finale ». |

### Écart assumé sur ISE-007

| # | Décision | Justification |
| --- | --- | --- |
| D-03 | **ADOPTÉE** — La maquette `ISE-007_Verification_Email_Etape_1` montre la saisie d'un code à 6 chiffres. L'écran livré à `/reclamer-mon-profil/verification` affiche à la place **l'état réel de la réclamation** : approuvée automatiquement, ou en attente de revue. Aucun code n'est envoyé. | L'adresse du compte est déjà confirmée par Supabase Auth à la création du compte (ISE-002) : redemander un code vérifierait une seconde fois la même chose. Ce qui reste à vérifier, c'est la **correspondance** entre l'adresse du compte et l'adresse historique du profil — ce que la base fait sans interaction (D-105). Envoyer un code pour simuler une vérification déjà faite serait une étape décorative (MASTER PROMPT §27 et §113). La maquette reste applicable telle quelle au premier écran de l'onboarding (ISE-008 → ISE-014) si le métier veut une double authentification à ce moment-là. |

### Conflits de numérotation d'écrans tranchés par D-01

Les séries Mentorat (ISE-078→083), Communautés (ISE-084→087) et Projets (ISE-088→091) étaient
numérotées différemment dans les documents fonctionnels et UI/UX. **Les noms de fichiers des
maquettes font foi** et sont repris tels quels dans `docs/screen-traceability-matrix.md`.
Aucune renumérotation (MASTER PROMPT §91).

---

## 2. Modèle de données

| # | Décision | Justification |
| --- | --- | --- |
| D-10 | **ADOPTÉE** — `profile_id` (FK → `public.ise_profiles.id`) est la clé de rattachement de **toutes** les données métier. `auth.users.id` n'apparaît qu'à un seul endroit : `ise_profiles.user_id` (nullable, unique). | MASTER PROMPT §6 : un profil référencé existe sans compte. Rattacher le métier à `user_id` rendrait impossible l'existence de données sur un profil non réclamé (expériences importées, appartenance à une promotion, recommandations reçues). Le doc 16 utilisait `user_id` par endroits : écarté. |
| D-11 | **ADOPTÉE** — Les chemins Storage utilisent `profile_id` : `avatars/{profile_id}/…`, `profile-documents/{profile_id}/…`. | Cohérence avec D-10 ; un document peut préexister à la réclamation. |
| D-12 | **ADOPTÉE** — Fonctions d'aide RLS dans le schéma `private` : `private.current_profile_id()`, `private.has_permission(text)`, `private.is_connected_to(uuid)`, `private.has_role(text)`. Toutes en `SECURITY DEFINER`, `search_path` figé, `STABLE`. | MASTER PROMPT §72. Évite la récursion de politiques et les sous-requêtes répétées. |
| D-13 | **ADOPTÉE** — Les statuts et énumérations métier sont des colonnes `text` + contrainte `CHECK`, **pas** des types `ENUM` PostgreSQL. Les taxonomies (compétences, secteurs, fonctions, langues, pays, types de disponibilité) sont des **tables de référence**. | Un `ENUM` exige `ALTER TYPE` (non transactionnel dans certains cas, irréversible) ; un `CHECK` se modifie par migration simple. Les taxonomies évoluent par le back-office : elles doivent être des lignes, pas du DDL. |
| D-14 | **ADOPTÉE** — Toutes les tables portent `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()` (maintenu par trigger `set_updated_at`). `created_by uuid REFERENCES ise_profiles(id)` lorsque l'auteur est pertinent. | MASTER PROMPT §9 et §67. |
| D-15 | **ADOPTÉE** — Les tables de liaison reçoivent une **clé primaire composite** sur le couple de FK (ou une PK technique + contrainte unique lorsque la ligne porte des attributs). 12 tables de liaison en étaient dépourvues dans le doc 17. | Intégrité : empêche les doublons de liaison. |
| D-16 | **ADOPTÉE** — Trois schémas : `public` (exposé via API, RLS active partout), `private` (fonctions d'aide, RBAC, données sensibles non exposées : `permissions`, `role_permissions`, `profile_private_data`, `import_*`, `audit_log`), `analytics` (agrégats et vues matérialisées). Aucun `GRANT` à `anon`/`authenticated` sur `private` et `analytics`. | MASTER PROMPT §5 et §11. |
| D-17 | **ADOPTÉE** — Le vecteur de recherche vit dans une table dédiée `public.profile_search_documents` (`profile_id`, `search_vector tsvector`, `refreshed_at`), alimentée par trigger. Pas de colonne `search_vector` sur `ise_profiles`. | Le doc 17 déclarait les deux. Une table dédiée évite de réécrire la ligne de profil (et donc son `updated_at`) à chaque recalcul d'index, et isole le coût GIN. |
| D-18 | **ADOPTÉE** — Ajout à `ise_profiles` des champs absents du doc 17 mais exigés par le doc 3 et le module Stages : `profile_type text CHECK (profile_type IN ('graduate','student'))`, `student_number text`, `linkedin_url text`, `website_url text`. | Sans `profile_type`, le module Stages (ISE-072→077) et le rôle « Élève ISE » sont inimplémentables. |
| D-19 | **ADOPTÉE** — Suppression d'un compte : `ise_profiles.user_id` passe à `NULL` (`ON DELETE SET NULL`). Le profil référencé subsiste et repasse en `claim_status = 'unclaimed'`. | MASTER PROMPT §7 et §48. |
| D-20 | **ADOPTÉE** — Unicité stricte du lien compte ↔ profil : index unique partiel `UNIQUE (user_id) WHERE user_id IS NOT NULL` sur `ise_profiles`. | MASTER PROMPT §7 : ni deux comptes sur un profil, ni deux profils sur un compte. |
| D-21 | **ADOPTÉE** — La table nommée `functions` au MASTER PROMPT §8 s'appelle `job_functions`, et `profile_functions` conserve son nom. | `public.functions` cohabiterait avec les fonctions SQL du même schéma : toute lecture du code, humaine ou automatisée, devient ambiguë. C'est le seul écart de nommage par rapport au §8. |
| D-22 | **ADOPTÉE** — Le fichier `packages/db-types/src/database.types.ts` n'est pas écrit à la main : il est produit par `supabase gen types` et la CI échoue s'il diverge du schéma. En attendant la première génération, `packages/db-types/src/tables.ts` fournit des alias écrits à la main, limités aux tables des tranches en cours et alignés sur les migrations 0001 à 0006. | Une copie manuelle de 191 tables dériverait immédiatement du schéma réel (MASTER PROMPT §77). |

---

## 3. Rôles et permissions

| # | Décision | Justification |
| --- | --- | --- |
| D-30 | **ADOPTÉE** — La nomenclature des permissions est **celle du MASTER PROMPT §39** (`profiles.read`, `profiles.edit`, `profiles.moderate`, `promotions.manage`, `calls.moderate`, `opportunities.manage`, `communities.manage`, `events.manage`, `content.publish`, `imports.execute`, `imports.review`, `support.manage`, `analytics.read`, `settings.manage`, `audit.read`, `ops.read`, `ops.manage`), étendue au besoin selon le même schéma `<domaine>.<action>`. Les nomenclatures concurrentes des docs 16 et 17 sont écartées. | Le MASTER PROMPT prime (D-01). Deux nomenclatures incompatibles coexistaient, sans aucun code commun. |
| D-31 | **ADOPTÉE** — Rôles V1 : `member`, `student` (sous-rôle membre), `moderator`, `content_manager`, `import_manager`, `support_agent`, `analyst`, `superadmin`, `ops`. L'autorisation se résout **toujours** par `private.has_permission()`, jamais par un test de rôle en dur. | MASTER PROMPT §39. |
| D-32 | **ADOPTÉE** — Les rôles sont portés par `private.user_roles (profile_id, role_id)`, table non exposée à l'API. Aucune donnée d'autorisation dans le JWT applicatif ni dans une table éditable par le membre. | MASTER PROMPT §10 : « les données d'autorisation ne doivent pas dépendre de données modifiables par le client ». |

---

## 4. Recherche et matching

| # | Décision | Justification |
| --- | --- | --- |
| D-40 | **ADOPTÉE** — Le barème de référence est celui du **document 22 (Moteur de recherche & Matching), normalisé sur 100** : compétences 40, secteur 15, géographie 15, disponibilité 10, expérience 10, langue 5, promotion 5. Le barème concurrent du doc 5 (qui ajoutait `organisation +10` et dépassait 100) est écarté. | Le doc 22 est le document dédié au moteur ; le doc 5 est une spécification fonctionnelle générale. |
| D-41 | **PROVISOIRE** — Les barèmes de détail absents des documents sont fixés comme suit, centralisés dans `packages/domain/src/matching/weights.ts` (une seule constante, modifiable sans toucher au moteur) : <br>· **Secteur** : exact 15 · connexe 9 · absent 0.<br>· **Géographie** : pays d'exercice exact 15 · pays de résidence exact 12 · même sous-région 8 · autre 0.<br>· **Disponibilité** : type demandé explicitement ouvert 10 · disponible sans correspondance de type 5 · indisponible 0 (et exclusion si le membre a désactivé la sollicitation).<br>· **Multiplicateurs de niveau déclaré** : notion 0,40 · intermédiaire 0,70 · avancé 0,90 · expert 1,00 · non déclaré 0,75 (valeurs du doc 22). | Le doc 22 énonce les cas sans les chiffrer. Ces valeurs respectent les rapports déjà donnés et sont isolées dans une constante unique pour être recalibrées après les premiers jeux de tests réels. |
| D-42 | **ADOPTÉE** — Labels qualitatifs (MASTER PROMPT §15, aucun pourcentage affiché) : score ≥ 70 → « Très pertinent » · 45–69 → « Pertinent » · 25–44 → « Profil proche » · < 25 → non proposé. Le score numérique n'est jamais renvoyé au client. | MASTER PROMPT §15 interdit l'affichage d'un pourcentage ; les seuils manquaient. |
| D-43 | **ADOPTÉE** — Toute recommandation renvoie au minimum une **raison explicite** (`MatchReason`) issue de données structurées. Un candidat sans aucune raison affichable est exclu du résultat, quel que soit son score. | MASTER PROMPT §16 : « ne jamais produire un matching opaque ». |
| D-44 | **ADOPTÉE** — Pagination **par curseur** (`keyset`) sur `(score DESC, id DESC)` pour le matching et sur `(created_at DESC, id DESC)` pour les listes chronologiques. Taille de page par défaut : 20 (web), 15 (mobile). Maximum 50. | MASTER PROMPT §101 ; aucune taille n'était spécifiée. |
| D-45 | **ADOPTÉE** — Recherche plein texte : `unaccent` + `pg_trgm`, configuration FTS `french`, index GIN sur `profile_search_documents.search_vector` et index GIN trigramme sur les libellés (noms, organisations, compétences). Seuil de similarité trigramme : 0,30. | MASTER PROMPT §21 et §85 (interdiction du `ILIKE '%…%'` non indexé). |
| D-46 | **ADOPTÉE** — Les alias de compétences (89 lignes du doc 20) sont stockés dans `skill_aliases` et résolus **à l'indexation comme à la requête**. Règle anti-collision : un alias de moins de 4 caractères (`IE`, `IV`) n'est résolu que s'il est saisi en majuscules et isolé. Les alias contenant `&` sont normalisés en conservant une forme `et` (`M&E` → `m-e`, `m et e`). | Le doc 20 exige « aucun alias ne pointe vers deux compétences incompatibles » sans donner de règle. |

---

## 5. Machines d'états

| # | Décision | Justification |
| --- | --- | --- |
| D-50 | **ADOPTÉE** — Machine d'états des introductions (aucune spécification n'existait) : `requested` → `intermediary_accepted` \| `intermediary_declined` \| `withdrawn` \| `expired`, puis `intermediary_accepted` → `introduced` → `target_responded` → `completed` \| `no_outcome`. Transitions non listées interdites au niveau base (fonction SQL atomique + `CHECK`). | MASTER PROMPT §54 fournit la liste ; les documents ne couvraient pas ISE-041→046. |
| D-51 | **ADOPTÉE** — Chemins d'introduction limités à **un seul intermédiaire** (`demandeur → relation directe → cible`). Aucune exploration de graphe au-delà du degré 1. Le rang des intermédiaires n'utilise que des signaux explicites : relation directe confirmée, organisation commune, promotion commune, projet commun déclaré, disponibilité déclarée « introduction ». | MASTER PROMPT §24 : confidentialité. Le contenu des messages privés n'est jamais analysé. |
| D-52 | **ADOPTÉE** — Clôture d'un appel au réseau : résultat **ternaire** `resolution text CHECK (resolution IN ('resolved','partially_resolved','not_resolved'))`, remplaçant le `boolean resolved_by_network` du doc 17. | Le doc 18 exige « Oui / partiellement / non » ; un booléen ne peut pas le porter. |
| D-53 | **ADOPTÉE** — Projets & consortiums : `draft → recruiting → team_ready → completed \| archived \| failed`. Communautés, promotions et stages : voir `docs/data-model.md`, section « machines d'états ». En cas de listes concurrentes, la liste **la plus fine** est retenue et les valeurs manquantes de l'autre liste y sont mappées. | Deux jeux d'états coexistaient par module ; perdre un état perd une capacité (MASTER PROMPT §41 par analogie). |
| D-54 | **ADOPTÉE** — `alternative_proposed` est **conservé** dans les demandes de mentorat, bien que la spécification UI l'ait supprimé, car les deux documents décrivent la fonction « proposer un autre format ». | Un état supprimé rendrait la fonctionnalité décrite inaccessible. |
| D-55 | **ADOPTÉE** — Aucun statut ne franchit une étape non constatée. En particulier : « candidature envoyée » à un organisme externe n'est jamais posé par un clic dans la plateforme ; l'utilisateur **déclare** lui-même l'état réel. | MASTER PROMPT §27, §29 et §113. |

---

## 6. Taxonomies et référentiels

| # | Décision | Justification |
| --- | --- | --- |
| D-60 | **ADOPTÉE** — Le seed intègre l'**intégralité** de la taxonomie du doc 20, soit **435 compétences / 84 catégories / 18 domaines**, et non le sous-ensemble « environ 220 » annoncé par le document lui-même. Les assertions de test sont alignées sur le décompte réel. | Restreindre la taxonomie dégraderait le matching, qui est le cœur du produit. |
| D-61 | **ADOPTÉE** — Les ~150 libellés présents au doc 19 mais absents du doc 20 (dont 8 catégories entières : Économie sectorielle, Computer Vision, Recensements, Développement logiciel, Cloud, Project Monitoring, Gouvernance d'entreprise, Leadership) sont **intégrés** à la taxonomie, marqués `source = 'doc19'` pour révision ultérieure par le back-office. | Le doc 19 est le « référentiel initial » ; en écarter la moitié perdrait des compétences réelles. Le marquage permet un arbitrage humain sans nouvelle migration. |
| D-62 | **ADOPTÉE** — Les slugs sont uniques **par table**, pas globalement. Les collisions inter-tables (`sql` compétence vs outil, `microfinance` domaine vs secteur…) sont donc licites. Les clés d'API exposent toujours `{type, slug}`. | L'unicité globale imposerait des slugs artificiels illisibles. |
| D-63 | **ADOPTÉE** — Les doublons intra-taxonomie identifiés (Analyse de survie 020309/110304, Protection sociale 030405/130501, Planification stratégique 160103/130201) sont seedés **une seule fois**, le second code devenant un alias pointant vers le premier. | Deux entrées identiques fragmentent le matching. |
| D-64 | **ADOPTÉE** — Référentiels absents des documents et créés : **pays** (ISO 3166-1 alpha-2, libellés français), **sous-régions** (découpage UNSD : Afrique de l'Ouest, Afrique centrale, Afrique de l'Est, Afrique australe, Afrique du Nord, Europe, Amérique du Nord, Amérique latine et Caraïbes, Asie, Océanie), **fonctions** (dérivées des filtres de recherche du doc 22), **promotions** (générées par année, de 1960 à l'année en cours + 5). | « Afrique de l'Ouest » est un critère de matching explicite sans référentiel associé ; les filtres de recherche référencent des fonctions inexistantes. |
| D-65 | **ADOPTÉE** — Types de disponibilité : le référentiel retenu est celui du **doc 20 (13 codes)**, qui est le seul codifié. « Expertise ponctuelle » (présente dans les libellés, absente des codes) reçoit le code `ad_hoc_expertise`. Les listes à 5, 7 et 8 entrées des autres documents y sont mappées. | Un seul référentiel codé peut servir de pivot ; les autres sont des vues partielles. |
| D-66 | **ADOPTÉE** — Motifs de signalement : référentiel **unique** de 9 motifs (union dédupliquée des 4 listes), filtré à l'affichage selon le type d'objet signalé. | Quatre listes concurrentes produiraient quatre tables ; un référentiel unique + filtrage contextuel donne le même résultat UI. |

---

## 7. Profil et onboarding

| # | Décision | Justification |
| --- | --- | --- |
| D-70 | **ADOPTÉE** — Onboarding en **7 étapes**, conformes aux maquettes ISE-008 → ISE-014 : (1) Promotion · (2) Compétences · (3) _(voir ISE-010/011)_ · (4) Secteurs · (5) Localisation · (6) Disponibilité · (7) Finalisation. Les libellés et l'ordre proviennent des noms de fichiers des maquettes (D-01), qui tranchent le conflit 7 / 8 / 9 étapes. | Les maquettes portent explicitement « Étape N » dans leur nom. |
| D-71 | **ADOPTÉE** — Le score de complétion est calculé par `public.calculate_profile_completion(profile_id)`, à pondérations **stockées en base** (`profile_completion_rules`) et non codées en dur. Les 10 sous-pondérations manquantes sont initialisées à une répartition uniforme du reliquat et ajustables par le back-office sans migration. | Le doc 20 ne chiffre que 3 des 13 blocs. Externaliser les poids évite une migration à chaque recalibrage. |
| D-72 | **ADOPTÉE** — Le score de complétion est **privé** : lisible par son propriétaire uniquement (RLS), jamais agrégé en classement, jamais affiché sur un profil tiers. | MASTER PROMPT §17. |
| D-73 | **ADOPTÉE** — Échelle de visibilité unifiée à **4 niveaux** : `private` (moi seul) · `connections` (mes relations) · `members` (tous les membres authentifiés) · `promotion` (ma promotion). Les échelles à 3 et 6 niveaux des autres documents y sont mappées. Aucune visibilité `public` (web ouvert) en V1. | MASTER PROMPT §47 : « les profils sont visibles aux membres autorisés, pas au web public ». |
| D-74 | **ADOPTÉE** — Visibilités par défaut pour les 10 champs non spécifiés : e-mail personnel `private` · téléphone `private` · CV `private` · date de naissance `private` · adresse `private` · employeur actuel `members` · poste `members` · ville `members` · pays `members` · LinkedIn `members`. | MASTER PROMPT §47 : par défaut, le moins exposé. |
| D-75 | **ADOPTÉE** — Le niveau de compétence est **déclaratif** et étiqueté comme tel dans l'interface. Aucune promotion automatique en « validé » ou « certifié », y compris après recommandation. | MASTER PROMPT §18. |

### Arbitrages rendus à la livraison de l'onboarding (ISE-008 → ISE-014) et du profil (ISE-016 → ISE-023)

| # | Décision | Justification |
| --- | --- | --- |
| D-110 | **ADOPTÉE** — Numérotation définitive des 7 étapes : (1) Vérification · (2) Promotion · (3) Compétences · (4) Secteurs · (5) Localisation · (6) Disponibilité · (7) Finalisation. Routes : `/bienvenue/<etape>`, point d'entrée `/bienvenue`. | Deux rails coexistent dans les maquettes : celui d'ISE-008 et d'ISE-010 (Bienvenue / Promotion / Situation actuelle / Compétences / Ce que vous recherchez / Comment vous pouvez aider / Confidentialité) et celui d'ISE-009 et ISE-011→014. Les **noms de fichiers** tranchent (D-01) : `ISE-011_Secteurs_Etape_4`, `ISE-012_…_Etape_5`, `ISE-013_…_Etape_6`, `ISE-014_…_Etape_7` fixent quatre positions sur sept, et le rail d'ISE-009→014 est le seul compatible avec elles. L'en-tête « Étape 4 sur 7 » d'ISE-010 est donc écarté. |
| D-111 | **ADOPTÉE** — L'étape 1 « Vérification » **n'envoie aucun code**. Elle affiche l'état réel lu en base (adresse du compte et sa confirmation, profil associé, promotion enregistrée, statut de vérification) et demande une confirmation explicite. | Prolongement direct de D-03 : l'adresse est déjà confirmée par Supabase Auth et l'association a déjà été vérifiée à la réclamation. Un second code vérifierait une seconde fois la même chose (MASTER PROMPT §27 et §113). |
| D-112 | **ADOPTÉE** — La progression d'onboarding est persistée dans `public.profile_onboarding_progress` (migration 0035), une ligne par profil, politique « propriétaire uniquement ». Les **saisies** restent dans leurs tables métier : cette table ne porte que le curseur (`current_step`, `furthest_step`, `skipped_steps`). | Exigence « aucun état d'onboarding stocké uniquement côté client ». Séparer le curseur des données évite de dupliquer la donnée de profil et rend le retour en arrière non destructif. |
| D-113 | **ADOPTÉE** — ISE-009 alimente une table **dédiée** `public.promotion_suggestions` (0035), et non `missing_member_suggestions`. | `missing_member_suggestions` (0003) porte un **membre** manquant **dans** une promotion existante : `promotion_id NOT NULL`, `first_name`/`last_name NOT NULL`. Elle ne peut structurellement pas porter une promotion absente du référentiel. Le champ demandé par la maquette (libellé, établissement, pays, année approximative, commentaire) impose une table propre. |
| D-114 | **ADOPTÉE** — Le « niveau de disponibilité » d'ISE-013 (Faible / Modérée / Élevée) est enregistré comme un **plafond mensuel déclaré** (`profile_availabilities.max_per_month` = 1 / 3 / 8), constante unique dans `@ise/validation`. | Aucune colonne ne porte un « niveau » ; `max_per_month` est la seule qui exprime la même intention. Le plafond reste indicatif : il ne vaut jamais obligation d'accepter (MASTER PROMPT §20). |
| D-115 | **ADOPTÉE** — Le commutateur binaire « Afficher ma ville sur mon profil » (ISE-012) est remplacé par un choix à **4 niveaux** (D-73), enregistré dans `profile_visibility` pour les champs `city` et `country`. | Un interrupteur ne sait pas exprimer « ma promotion seulement », qui est un des quatre niveaux de l'échelle unifiée. Le choix est appliqué par la base, pas par l'affichage. |
| D-116 | **ADOPTÉE** — Écarts de contenu assumés, faute de donnée réelle : le bloc « Suggestions pour vous » d'ISE-010, « Secteurs fréquents dans le réseau » d'ISE-011, « Votre profil dans le réseau » d'ISE-016, et les compteurs « projets / recommandations » d'ISE-023 ne sont **pas rendus**. Le référentiel complet regroupé par domaine les remplace, et ISE-023 n'affiche que le décompte d'expériences, calculé sur des données réelles, avec sa règle de calcul écrite à l'écran. | Ces blocs supposent un annuaire peuplé. Les remplir sans données produirait des personas et des indicateurs inventés (MASTER PROMPT §78 et §98). |
| D-117 | **ADOPTÉE** — Le dépôt de photo de profil (ISE-017) n'est pas ouvert : l'écran l'annonce au lieu d'afficher un bouton « Changer la photo ». `educations` reçoit en revanche les colonnes `education_type`, `city` et `credential_url` (migration 0036) pour qu'ISE-021 n'affiche aucun champ sans destination. | Un bouton sans téléversement serait décoratif (MASTER PROMPT §113). Entre « masquer un champ de la maquette » et « ajouter la colonne manquante », la seconde option est retenue quand la donnée a une valeur métier durable. |
| D-118 | **ADOPTÉE** — Le référentiel `introduction_requests.outcome` reçoit une sixième valeur, `referred_to_other_contact` (migration 0039). Elle porte l'option « Introduction complémentaire — la cible vous a orienté vers un autre contact » d'ISE-046. La contrainte `CHECK` de 0006 est remplacée, 0006 n'est pas éditée. | Aucune des cinq valeurs d'origine ne portait ce fait, qui est pourtant distinct : l'échange a eu lieu **et** a produit une réorientation. Le ranger sous `exchange_held` perdrait l'information ; retirer l'option de la maquette perdrait la fonction. Même arbitrage qu'en D-117 : quand la donnée a une valeur métier durable, on ajoute la colonne (ou la valeur) plutôt que de masquer le champ. |
| D-119 | **ADOPTÉE** — Le classement des intermédiaires d'ISE-043 produit un **libellé qualitatif** (`recommended` ≥ 3 signaux · `relevant` = 2 · `possible` = 1) et **jamais** un score. Les signaux comptés sont exactement les quatre de D-51 : relation directe confirmée des deux côtés, organisation commune avec la cible, promotion commune avec la cible, disponibilité déclarée « introduction ». Les raisons retenues sont renvoyées avec chaque proposition. | Transposition de D-42 et D-43 au chemin d'introduction : le MASTER PROMPT §15 interdit d'exposer un score, et §16 interdit un matching opaque. Un décompte de signaux explicites est vérifiable par l'utilisateur, un score ne l'est pas. |
| D-120 | **ADOPTÉE** — « Ignorer » une invitation (ISE-041) n'écrit **rien** : aucune fonction, aucun statut, aucune trace. La demande reste `pending` jusqu'à son expiration (30 jours, Q-04). | D-55 : aucun statut ne franchit une étape non constatée. « Ignoré » n'est pas un événement — c'est l'absence d'événement. Un bouton qui l'enregistrerait fabriquerait une donnée. |

---

## 8. Notifications, messagerie, paramètres

| # | Décision | Justification |
| --- | --- | --- |
| D-80 | **ADOPTÉE** — La matrice canaux × événements de référence est celle du **doc 34** (spécification finale), complétée par les événements que seul le doc 14 mentionne. Règle transverse : _in-app pour toute interaction importante · e-mail pour les actions significatives et les digests · push uniquement pour l'utile et le temporel_. | MASTER PROMPT §35 ; les deux matrices se contredisaient sur Messages/e-mail, Appels/push et Opportunités. |
| D-81 | **ADOPTÉE** — « Action requise » est une **priorité** (`priority`), pas une catégorie. Catégories conservées : Relations, Introductions, Appels, Opportunités, Mentorat, Communautés, Projets, Messages, Actualités, Système. | Le doc 14 en fait une priorité, le doc 34 une catégorie ; en faire une catégorie ferait perdre les catégories « Connexions » et « Actualités ». |
| D-82 | **ADOPTÉE** — Archivage des conversations **par participant** : `conversation_participants.archived_at`. Pas d'archivage global. | Archiver globalement ferait disparaître la conversation chez l'autre membre. |
| D-83 | **ADOPTÉE** — États d'un message : `pending` (local, non persisté serveur) → `sent` (ACK serveur) → `failed`. L'interface n'affiche jamais « envoyé » avant l'accusé de réception serveur. Realtime limité aux conversations ouvertes et au compteur de non-lus. | MASTER PROMPT §34 et §45. |
| D-84 | **PROVISOIRE** — Pièces jointes : 10 Mo par fichier, 3 fichiers par message, types autorisés `pdf, docx, xlsx, pptx, png, jpg, webp`. Exécutables et archives interdits. Nouvelles conversations : 20 par jour et par membre. | Les documents donnent « 10–20 Mo » à titre indicatif et aucun quota. Valeurs prudentes, centralisées dans `packages/config`. |
| D-85 | **PROVISOIRE** — Aucun SLA de support n'est affiché à l'utilisateur, faute de valeur métier documentée. Les tickets portent uniquement les 3 niveaux d'urgence documentés (Standard / Important / Sécurité), l'urgence n'étant pas librement choisie par le demandeur. | MASTER PROMPT §98 : pas de KPI inventé. Un délai affiché sans engagement réel serait un faux KPI. |

---

## 9. Design system et états d'interface

| # | Décision | Justification |
| --- | --- | --- |
| D-90 | **ADOPTÉE** — **Pas de couleur dédiée par module métier.** La couleur ne porte jamais seule une information : tout état est doublé d'un libellé et/ou d'une icône. | Le doc 35 §21 l'interdit explicitement, le doc 4 §34 le proposait. Le doc 35 prime (D-02) et rejoint le MASTER PROMPT §55. |
| D-91 | **ADOPTÉE** — Typographie **Geist**, fallback **Inter**. Topbar 68 px. Rayon de base 10 px. Échelle d'espacement à 11 tokens. Valeurs issues du doc 35. | Le doc 35 est la version la plus récente du design system. |
| D-92 | **ADOPTÉE** — `--color-primary-hover` (nommé sans valeur dans les documents) = `#1D4ED8` (Active Blue de la palette du MASTER PROMPT §13). | Cohérence avec la palette officielle. |
| D-93 | **ADOPTÉE** — Convention transverse des états, appliquée à **tous** les écrans pilotés par des données (aucun document ne spécifiait `loading` ni `error`) : squelette calqué sur la mise en page réelle pour `loading` · `EmptyState` avec action de sortie pour `empty` · `ErrorState` avec `correlation_id` et bouton « Réessayer » pour `error` · `SYS-006` pour `unauthorized` · `OfflineState` sur mobile. Jamais de page blanche. | MASTER PROMPT §61 et §43. |
| D-94 | **ADOPTÉE** — Navigation mobile : **5 destinations** — Accueil · Réseau · action centrale (+) · Opportunités · Moi. | MASTER PROMPT §90 (« éviter plus de 5 destinations ») ; le doc 35 se contredisait entre 4 et 5. |
| D-95 | **ADOPTÉE** — Ordre de la sidebar web : celui du MASTER PROMPT §89, qui tranche l'inversion Collaborer / Communautés entre les docs 35 et 4. | D-01. |
| D-96 | **ADOPTÉE** — Grille web : 12 colonnes, gouttière 24 px (≥ 1024 px) / 16 px (< 1024 px), sidebar 248 px, largeur de contenu max 1160 px. Points de rupture : 375 · 768 · 1024 · 1440. | Aucune grille en colonnes n'était définie ; ces valeurs sont compatibles avec les max-widths documentées. |

---

## 10. Sécurité et exploitation

| # | Décision | Justification |
| --- | --- | --- |
| D-100 | **ADOPTÉE** — La clé `service_role` n'est présente que dans les secrets serveur (Vercel, Edge Functions). Aucun accès client ne l'utilise. Les mutations sensibles passent par des fonctions SQL atomiques ou des Server Actions authentifiées. | MASTER PROMPT §11 et §76. |
| D-101 | **ADOPTÉE** — Toute fonction `SECURITY DEFINER` déclare `SET search_path = ''` et qualifie chaque objet. Chaque usage est justifié dans `docs/rls.md`. | MASTER PROMPT §72. |
| D-102 | **ADOPTÉE** — Toute erreur renvoyée au client porte un `correlation_id` et un message métier en français. Aucune trace technique, aucun nom de table, aucun SQL exposé. | MASTER PROMPT §43 et §99. |
| D-103 | **ADOPTÉE** — Limitation de débit applicative sur : création de compte, réinitialisation de mot de passe, demandes de connexion, demandes d'introduction, création d'appels, messages vers un nouveau contact. Compteurs en base (`private.rate_limit_counters`), fenêtre glissante. | MASTER PROMPT §64 et §71. |
| D-104 | **ADOPTÉE** — Les comptes de test Auth sont préfixés `test+` et marqués `is_test_account`. Aucun compte Auth n'est créé pour représenter un profil importé, en aucun environnement. | MASTER PROMPT §6, §78 et §113. |
| D-105 | **ADOPTÉE** — L'approbation automatique d'une réclamation par e-mail historique (ISE-007) exige que l'adresse du compte soit **confirmée** (`auth.users.email_confirmed_at`) _et_ égale à `private.profile_contacts.primary_email_norm`. Une adresse non confirmée ne prouve rien. | Sans cette condition, créer un compte avec l'adresse historique d'un tiers suffirait à s'emparer de son profil : la « vérification » deviendrait une porte d'entrée. MASTER PROMPT §7 et §71. |
| D-106 | **ADOPTÉE** — `public.search_claimable_profiles()` et `public.get_claimable_profile()` ne sont appelables que par un compte **non encore rattaché** à un profil, ou par un porteur de `profiles.verify`. | Un membre déjà rattaché n'a aucun motif légitime d'énumérer l'annuaire non réclamé avec ses indices de coordonnées ; l'annuaire des membres relève d'ISE-034 et de ses propres règles de visibilité (D-73, MASTER PROMPT §47). |
| D-107 | **ADOPTÉE** — L'indice d'e-mail historique est **construit en base** au format `a•••@d•••.tld` (`private.mask_email_hint`). L'adresse complète ne quitte jamais le serveur, ni le téléphone, ni l'adresse postale, ni la date de naissance. | MASTER PROMPT §47 : « ne jamais renvoyer puis masquer ». Un masquage côté interface laisserait la donnée dans la réponse réseau. |

---

## 11. Questions ouvertes soumises au métier

Ces points n'empêchent pas d'avancer (une valeur par défaut est appliquée et signalée ci-dessus),
mais méritent une confirmation.

| # | Question | Valeur appliquée par défaut |
| --- | --- | --- |
| Q-01 | Pondérations de matching D-41 : faut-il les recalibrer une fois l'annuaire réel importé ? | Valeurs D-41, isolées dans une constante unique. |
| Q-02 | Délai d'expiration automatique d'un appel au réseau sans activité. | 60 jours, puis passage en `expired`. |
| Q-03 | Délai d'expiration d'une demande d'introduction sans réponse de l'intermédiaire. | 14 jours. |
| Q-04 | Délai d'expiration d'une demande de connexion. | 30 jours. |
| Q-05 | Les ~150 compétences issues du doc 19 (D-61) doivent-elles être conservées, fusionnées ou retirées ? | Conservées, marquées `source='doc19'`. |
| Q-06 | Faut-il afficher un délai de réponse du support (D-85) ? | Non affiché tant qu'aucun engagement réel n'existe. |
| Q-07 | Groupes de discussion : V1 limités aux projets, ou pas de groupes du tout en V1 ? | Limités aux projets et communautés (doc 34). |
| Q-08 | Ouverture d'un second projet Supabase de staging (cf. C-01). | Non pour l'instant ; migrations rejouables prêtes. |

---

## 12. Site public et CMS (addendum au MASTER PROMPT)

Migrations `0057` → `0066`. Voir `docs/cms.md`, `docs/cms-automation.md`,
`docs/featured-profile.md` et `docs/rls.md` §11.

| # | Décision | Justification |
| --- | --- | --- |
| D-121 | **ADOPTÉE** — La contrainte `CHECK` de `analytics.profile_activity_events.event_type` (0019) est **remplacée** pour accueillir les huit événements publics de PUB-001. Les quinze valeurs d'origine sont conservées à l'identique ; aucune ligne existante n'est invalidée. Aucune table d'événements publics n'est créée. | Même arbitrage qu'en D-118 : quand une valeur a une portée métier durable, on élargit le vocabulaire fermé plutôt que d'ouvrir un second entrepôt. Deux tables d'événements produiraient deux vérités à réconcilier pour calculer un même CTR (addendum §50, §51). |
| D-122 | **ADOPTÉE** — `ise_profiles` reçoit **exactement deux** colonnes : `public_summary` et `allow_public_feature`. L'exclusion temporaire d'un profil de « ISE du jour » n'est **pas** une colonne de profil : elle est portée par `cms_content_overrides` (`override_kind = 'exclude'`), bornée dans le temps et attribuée à son auteur. | `LP_Modification_de_la_base_de_données` suggérait aussi `public_feature_excluded_until` et `public_feature_updated_at`. Une exclusion est un **acte éditorial** : elle a un auteur, une date, un motif et une fin. Une colonne de profil n'en porte aucun, et laisserait croire que la personne est durablement marquée. La consigne du porteur demandait par ailleurs le strict minimum sur les tables métier. |
| D-123 | **ADOPTÉE** — D-73 (« aucune visibilité `public` en V1 ») **reste en vigueur**. L'échelle de visibilité à quatre niveaux n'est pas étendue. L'exposition sur le web ouvert est un **acte éditorial distinct**, porté par `landing_visibility` (`hidden` / `visible`, défaut `hidden`) sur `news`, `events` et `opportunities`. Les projections publiques exigent en outre `visibility = 'members'`. | L'addendum demande une landing publique, D-73 interdit une visibilité publique : le conflit est réel. Il se résout en distinguant **à qui un contenu s'adresse dans le réseau** (`visibility`) de **s'il peut paraître sur le web ouvert** (`landing_visibility`). Confondre les deux publierait automatiquement les contenus de promotion et de communauté. Aucune donnée de profil n'acquiert de visibilité publique : seul un teaser consenti, opt-in explicite, sort. |
| D-124 | **ADOPTÉE** — La séparation « configuration brouillon / configuration publiée » (§48) et le rollback (§49) sont portés par trois colonnes (`published_snapshot`, `previous_published_snapshot`, `published_at`) sur chaque table publiable, et **non** par une table `cms_versions`. Les fonctions de PUB-001 lisent le snapshot, jamais les colonnes vivantes. | Une table de versions ajouterait une jointure à chaque lecture publique et un cycle de vie supplémentaire à gérer, pour la même garantie. Le snapshot donne gratuitement la résilience du §47 : si le CMS tombe, la dernière version publiée continue d'être servie. Un rollback à un seul niveau couvre le besoin exprimé (« la dernière configuration publiée saine »). |
| D-125 | **ADOPTÉE** — `anon` reçoit `EXECUTE` sur **dix** fonctions `SECURITY DEFINER` public-safe, et sur rien d'autre. Aucun privilège de table n'est accordé à `anon` sur `public`, `private` ou `analytics`. `private.security_baseline_violations()` reçoit un sixième contrôle (`anon_function_grant`) qui fait échouer la CI à la onzième fonction exposée. | Addendum §44 et §45. Une liste blanche vérifiée mécaniquement vaut mieux qu'une intention documentée : elle a d'ailleurs détecté D-126 dans la seconde qui a suivi son ajout. |
| D-126 | **ADOPTÉE** — Le privilège `EXECUTE` accordé par défaut à `PUBLIC` sur 53 fonctions de `public` et `private` est retiré (`0062`), après avoir rendu explicites les privilèges que `authenticated` et `service_role` détenaient déjà par ce biais. Le garde-fou `pg_default_acl` est posé dans sa forme effective en `0066`, avec vérification de son propre effet. | Défaut préexistant, non introduit par ce lot, révélé par le contrôle de D-125. La plupart des fonctions concernées refusaient déjà un appelant anonyme, mais `security_baseline_violations()`, `tables_without_rls()`, `tables_without_policy()`, `storage_baseline_violations()` et `mask_email_hint()` répondaient à `anon` : fuite de structure. Corriger était moins risqué que documenter une exception. |
| D-127 | **ADOPTÉE** — La sélection éditoriale des expertises (§24 : choisir, ordonner, masquer) passe par `cms_sections.configuration -> expertise_slugs`, et non par `cms_content_overrides`. Liste vide ou absente = taxonomie complète. | `expertise_areas.id` est un `bigint` (table de référence, conventions §3) ; `cms_content_overrides.entity_id` est un `uuid`. Plutôt que d'élargir l'override à deux types de clés — ce qui aurait fragilisé son intégrité référentielle pour tous les autres usages —, la sélection est déclarée là où elle appartient : dans la configuration de la section. |
| D-128 | **ADOPTÉE** — La programmation CMS d'une actualité, d'un événement ou d'une opportunité ne modifie **que** `landing_visibility`. Elle ne touche jamais `news.editorial_status`, `events.status` ni `opportunities.status`. Pour les objets `cms_*`, elle pilote le statut complet. | Le CMS orchestre l'exposition sur la vitrine ; il ne se substitue pas au circuit éditorial du module Actualités (permission `content.publish`, workflow de revue) ni au cycle de vie métier d'une offre. Confondre les deux permettrait de publier une actualité non relue en programmant une date. |
| D-129 | **ADOPTÉE** — `pg_cron` est installé sur ce projet et porte les quatre tâches (`cms_expire_content`, `cms_publish_scheduled`, `cms_select_featured_profile`, `cms_publish_featured_profile`). `public.run_cms_automations()` reste le point d'appel unique, utilisable par une Supabase Scheduled Function ou un cron externe si l'extension venait à disparaître. `public.get_cms_automation_status()` expose l'état **réel** lu dans `cron.job` et `cron.job_run_details`. | MASTER PROMPT §98 : aucun état inventé. Une tâche n'est déclarée « qui tourne » que si `cron.job` la contient et que `cron.job_run_details` en atteste. L'incident de `0059` (garde `to_regproc` inopérante, extension créée mais rien planifié) est consigné dans `docs/cms-automation.md` plutôt que masqué. |
| D-130 | **ADOPTÉE** — Écart assumé à D-104 dans `supabase/tests/rls/0021_cms_suite.sql` : les profils candidats à « ISE du jour » y sont créés avec `is_test_account = false`. Leurs comptes Auth restent préfixés `test+`, et le `ROLLBACK` final garantit qu'aucune ligne ne subsiste. | `private.featured_profile_eligible()` exclut volontairement les comptes de test : un compte de test ne doit jamais paraître sur le web ouvert. Sans cet écart, aucun chemin de sélection ne serait testable. Le cas G01 vérifie en contrepartie qu'un profil **marqué** compte de test n'est jamais sélectionné. |
| D-131 | **ADOPTÉE** — Rendre un contenu métier visible sur la landing (`landing_visibility = 'visible'`) exige `cms.publish`. Modifier sa seule priorité éditoriale (`landing_priority`) se contente de `cms.edit`. `public.set_landing_exposure()` applique cette distinction, et `public.set_news_featured()` exige `cms.publish`. | Exposer un contenu sur le web ouvert **est** un acte de publication : c'est le geste que la séparation `cms_editor` / `cms_publisher` (docs/cms.md §5) est censée arbitrer. Réordonner trois cartes déjà visibles n'en est pas un. Sans cette distinction, ou bien l'éditeur publiait sans en avoir le droit, ou bien il ne pouvait plus rien ordonner. Cas B10 et B11 de `0022`. |
| D-132 | **ADOPTÉE** — Le back-office CMS n'appelle pas `POST /api/cms/revalidation-landing` : il appelle directement la Server Action `revalidateLanding()`, dont ce Route Handler n'est que la porte HTTP. La route reste en place, inchangée, pour les appelants **externes** (Edge Function, cron). | Contrat vérifié avant de décider : le corps de la route se réduit à `revalidateLanding()`, derrière un secret partagé et un `503` si le secret n'est pas configuré. Le CMS vit dans la même application Next : émettre une requête HTTP vers soi-même imposerait de connaître son URL publique, de partager un secret avec soi-même et d'ajouter un aller-retour réseau, pour exécuter exactement la même fonction. L'en-tête de la route l'annonçait déjà (ADDENDUM §46). |
| D-133 | **ADOPTÉE** — Le pipeline d'image de CMS-008 s'arrête après l'étape « métadonnées » : validation par signature binaire, dépôt de l'original dans `public-assets`, dimensions réelles lues dans l'en-tête. Les variantes Desktop / Mobile / vignette ne sont **pas** générées, et aucune ligne `variant_kind` fictive n'est écrite. | ADDENDUM §39 décrit cinq étapes ; les étapes 3 et 4 exigent un encodeur d'images côté serveur, absent de ce déploiement. Enregistrer trois variantes pointant toutes le fichier original satisferait le schéma et ferait servir une image pleine résolution en croyant servir une vignette. L'alerte `media_no_variant` du tableau de bord réclame la génération tant qu'elle n'est pas branchée : le manque est visible, pas masqué (MASTER PROMPT §98). |

---

## 13. Médias de la vitrine publique (migration `0068`)

Voir `supabase/migrations/0068_landing_media_public_bucket.sql`, `docs/rls.md` §5.3 et
`docs/cms.md` §12.

| # | Décision | Justification |
| --- | --- | --- |
| D-134 | **ADOPTÉE** — Un **unique** bucket public est créé, `landing-media`, dédié aux médias éditoriaux de PUB-001, en `png / jpeg / webp / avif`, 5 Mo, **sans SVG**, rangé par usage (`carousel/`, `partners/`, `news/`, `sections/`). Les huit buckets de `0027` restent privés. `private.storage_baseline_violations()` échoue si un autre bucket devient public **et** si `landing-media` cesse de l'être. | D-73 (« aucun bucket public ») a été écrit pour une plateforme entièrement authentifiée. PUB-001 est servie à des anonymes : sans surface publique, `landingMediaUrl()` renvoyait `null` et aucune image ne s'affichait. L'alternative — une URL signée par visuel — obligerait à re-signer à chaque rendu, donc à renoncer au cache de 300 s (§46), et l'URL signée fuirait de toute façon sans expiration utile à l'échelle d'un CDN. Un bucket public dont le contenu est, par construction, du matériel éditorial publié, **dit la vérité sur ce qu'il contient**. Le SVG est exclu parce qu'il est du XML capable de porter du script : servi en public sur le domaine Supabase, il s'exécuterait dans le contexte de ce domaine. La restriction de D-73 est donc **bornée**, pas levée : elle devient « un seul bucket public, dont le contenu est éditorial et vérifié mécaniquement ». |
| D-135 | **ADOPTÉE** — L'« ISE du jour » n'affiche **pas de photographie**. Le teaser porte un **monogramme** (initiales dans une pastille), construit depuis `display_name`, déjà public. Le bucket `avatars` reste privé, aucune copie publique n'est faite, et `get_landing_featured_profile()` **cesse même de projeter `avatar_path`**. L'option « copie publique consentie à l'opt-in » est écartée. | Trois raisons, dans cet ordre. **(1) Périmètre du consentement.** `allow_public_feature` (0057) consent à la parution d'un teaser **textuel** dont les champs sont énumérés. Il n'a jamais été présenté au membre comme un consentement à la publication de son portrait sur le web ouvert. Réutiliser une case cochée pour un usage qu'elle ne décrit pas est un détournement de finalité — exactement ce que MASTER PROMPT §47 interdit. Obtenir le bon consentement supposerait un second opt-in, un second écran, une seconde trace : ce n'est pas ce que ce lot corrige. **(2) Irréversibilité.** Une photographie déposée dans un bucket public est mise en cache par le CDN, aspirée par les moteurs et les archiveurs. Un retrait de consentement, une suppression de compte (D-19) ou une exclusion éditoriale (D-122) ne peuvent pas la rappeler. Le consentement redeviendrait révocable en théorie et définitif en fait. **(3) La maquette ne demande rien de tel.** `PUB-001_Landing_Page_Desktop_1440` montre une carte « ISE DU JOUR » **textuelle** : nom, promotion, lien. Aucun portrait. Le monogramme est donc conforme à la maquette (D-01), n'a aucune surface de confidentialité, ne coûte aucune requête et ne peut pas casser. |
| D-136 | **ADOPTÉE** — Un média n'est projeté vers la vitrine que s'il réunit **trois** conditions : bucket `landing-media`, alternative textuelle non vide, ligne non supprimée. Sinon la projection renvoie `null` et le composant n'émet **aucune** balise `img`. `news.image_path` et `organizations.logo_path`, qui sont du texte libre antérieur au CMS, sont **résolus dans la médiathèque** par `private.landing_media_by_path()` : une couverture qui n'y est pas enregistrée, décrite et mesurée ne paraît pas. | Trois défauts évités d'un coup. Un média resté dans un bucket privé produirait une URL en 400, donc une image cassée sur la vitrine. Un média sans `alt` est **non publiable** (ADDENDUM §52) : la contrainte existe en base, la projection la redit, et le parseur client la redit une troisième fois — c'est le contrat du client, pas une politesse. Enfin, servir `news.image_path` tel quel donnerait une image sans alternative et sans dimensions connues, c'est-à-dire précisément ce que §52 et §58 interdisent. Le prix est assumé : une couverture d'actualité doit passer par la médiathèque pour paraître, et son absence est visible dans CMS-008. |
| D-137 | **ADOPTÉE** — Aucune **seconde** colonne de bucket n'est ajoutée à `cms_media_assets`. La colonne `bucket_id`, posée en `0057`, voit son défaut passer à `landing-media` et son `CHECK` s'élargir à `('landing-media', 'public-assets')`. | La colonne demandée existait déjà. En ajouter une seconde créerait deux vérités pour une même information — ce que `docs/cms.md` §1 interdit — et il faudrait ensuite décider laquelle fait foi à chaque lecture. `public-assets` reste **accepté** en base pour ne casser aucune ligne antérieure, mais n'est plus **servi** : un visuel oublié dans l'ancien bucket disparaît proprement de la vitrine, reste visible dans la médiathèque, et n'y produit pas de vignette — le manque est constatable, pas silencieux. |
| D-138 | **ADOPTÉE** — La place d'une image est réservée par son **conteneur** (rapport d'aspect ou hauteur minimale fixes) et non par ses dimensions intrinsèques : `next/image` est utilisé en `fill`. Les colonnes `width` / `height` de `cms_media_assets` restent projetées mais ne conditionnent pas l'affichage. La première diapositive du carrousel est en `priority`, tout le reste en `loading="lazy"`. | `width` et `height` sont **nullables** en base : un média non mesuré aurait, avec `next/image` en mode intrinsèque, soit disparu, soit provoqué un décalage. Le conteneur à ratio fixe rend le CLS structurellement nul (MASTER PROMPT §58) quel que soit l'état des métadonnées, y compris quand l'image n'arrive jamais. `priority` est réservé au seul élément susceptible d'être le LCP. |
| D-139 | **PROVISOIRE** — La suppression d'un objet de `landing-media` n'est **pas** testée par un `DELETE` SQL. Le harnais `0023` vérifie le comportement réel sur l'`UPDATE`, qui porte la même condition d'autorisation, et la **forme** de la politique `ise_landing_media_delete` (commande, rôles, permission exigée). | Supabase pose sur `storage.objects` un déclencheur `protect_objects_delete` **`FOR EACH STATEMENT`** : il lève `42501` avant toute évaluation de lignes, donc avant la RLS, et même quand la commande n'aurait touché personne. Aucun `DELETE` n'est observable en SQL, ni permis ni refusé — la suppression passe exclusivement par l'API Storage. Le trou de couverture est nommé plutôt que masqué par un test qui ne mesurerait rien. Il se refermera avec un test d'intégration passant par l'API Storage. |
| D-140 | **ADOPTÉE** — D-133 est **amendé** sur un point : le bucket de dépôt de CMS-008 devient `landing-media` et le format `avif` est accepté (signature `ftyp` + boîte `ispe` de l'ISOBMFF). Le reste de D-133 tient : les variantes Desktop / Mobile / vignette ne sont toujours **pas** générées, faute d'encodeur d'images déployé, et aucune ligne `variant_kind` fictive n'est écrite. | Le pipeline dépose maintenant là où la vitrine peut lire. AVIF est ajouté parce que `next/image` sert déjà de l'AVIF en sortie : refuser le format en entrée n'aurait protégé de rien. Les vignettes de la médiathèque, elles, sont désormais **réelles** — elles pointent l'original, redimensionné par l'optimiseur de Next, et non une variante fictive. |

---

## 14. Consolidation du 8 août 2026 — arbitrages rapatriés et contrôle de numérotation

Cette section a été ajoutée lors d'une passe de vérification documentaire. Elle ne réécrit aucune
décision : elle **rapatrie** les arbitrages qui vivaient hors de ce journal et **acte** l'état réel
de la numérotation.

### 14.1 Contrôle de la numérotation `D-xx`

Relevé mécanique sur ce fichier : **112 décisions**, `D-01` → `D-155` (dont les 15 ajoutées
ci-dessous), **aucun doublon**. Les
intervalles vides sont des réserves de bloc thématique (`D-04`→`D-09`, `D-23`→`D-29`,
`D-33`→`D-39`, `D-47`→`D-49`, `D-56`→`D-59`, `D-67`→`D-69`, `D-76`→`D-79`, `D-86`→`D-89`,
`D-97`→`D-99`, `D-108`→`D-109`) : ils ne signalent aucune perte. Toutes les décisions du lot
landing / CMS — `D-105`, puis `D-118` → `D-140` — sont présentes. Aucune décision citée ailleurs
dans le dépôt (docs, migrations, code) n'est absente de ce journal.

### 14.2 Arbitrages rapatriés de `docs/modules-collaboration.md`

Le document annonçait lui-même qu'il « complète » ce journal. Ses arbitrages sont désormais
**référencés ici** ; le document reste la référence détaillée (justifications complètes).

| # | Décision | Source |
| --- | --- | --- |
| D-141 | **ADOPTÉE** — Aucune mécanique de popularité, à aucun niveau : ni vue, ni « j'aime », ni score, ni classement de communautés ou de personnes. Vérifié mécaniquement par le cas C04 du harnais `0027`, qui échoue si une clé de projection contient `view`, `like`, `rank`, `popular`, `score` ou `trend`. | `modules-collaboration.md` C-a |
| D-142 | **ADOPTÉE** — Seuil de cross-posting : **3 communautés en 24 h** pour une empreinte de contenu identique ; 10 publications et 30 réponses par heure et par membre (D-103). | C-d |
| D-143 | **ADOPTÉE** — Le marquage « réponse utile » est binaire, posé par le seul auteur de la publication, retirable, et ne produit ni classement ni réputation. | C-f |
| D-144 | **ADOPTÉE** — La création d'une communauté n'est pas ouverte au membre en V1 ; l'écran le dit et renvoie vers l'assistance. | C-k |
| D-145 | **ADOPTÉE** — Intérêt et appartenance à un projet ne se rejoignent jamais : `submit_project_interest()` n'écrit que dans `project_applications` ; le seul chemin vers `membership_status = 'active'` est `confirm_project_membership()`, qui horodate le consentement. Une invitation acceptée produit `pending_confirmation`. | P-a, P-b |
| D-146 | **ADOPTÉE** — La rémunération d'un rôle de projet suit quatre paliers de divulgation (`applied`, `shortlisted`, `selected`, `team_only`). Hors palier atteint, la clé `compensation` est **absente** de la projection — pas vide, absente. | P-d |
| D-147 | **ADOPTÉE** — Aucun pourcentage d'avancement de projet. Seuls des décomptes : membres confirmés, rôles pourvus sur total, jalons terminés sur total. | P-h |
| D-148 | **ADOPTÉE** — `landing_visibility` est projeté et **affiché en toutes lettres** dans l'espace membre (« Ce contenu paraît sur le site public »), et n'y est jamais modifiable. Application conjointe de D-123 et D-131. | N-a |
| D-149 | **ADOPTÉE** — ISE-092 est un **fil mixte** actualités + événements, uni en base par un curseur keyset unique (D-44), et non deux listes entrelacées côté client. | N-d |
| D-150 | **ADOPTÉE** — `events.online_url_private` n'est jamais projeté, ni par `private.event_card()`, ni par un `select *`. Seul un booléen `online_url_available` sort ; l'URL passe par `public.get_event_online_url()`. | N-c |

### 14.3 Arbitrages rapatriés de `docs/screen-traceability-matrix.md`

La matrice consignait sept écarts de la tranche Recherche & découverte (`E-01` → `E-07`) et
quatorze de la tranche Relations & introductions (`F-01` → `F-14`) « à fusionner dans le journal
des décisions à la réunion des deux lots ». La réunion a eu lieu ; deux d'entre eux portent une
règle transverse et sont promus ici. Les dix-neuf autres restent des **écarts d'écran**, documentés
dans la matrice, et n'ont pas vocation à devenir des décisions transverses.

| # | Décision | Source |
| --- | --- | --- |
| D-151 | **ADOPTÉE** — Aucun écran n'affiche de **total de résultats** ni de pagination numérotée : D-44 impose le keyset, et un total exigerait un `COUNT(*)` sur tout l'annuaire à chaque requête. Les listes affichent le nombre d'éléments **rendus** et un bouton « page suivante ». | E-01, E-04 |
| D-152 | **ADOPTÉE** — Le libellé qualitatif de pertinence (D-42) et les raisons (D-43) ne sont rendus **qu'en mode pertinence** (`match_profiles`). En mode annuaire (`search_profiles`, texte libre), aucun libellé n'est fabriqué et la raison de son absence est écrite à l'écran. | E-02 |

**Écart resté ouvert** (rappelé ici pour qu'il ne se perde pas) : `F-05` — les filtres Promotion /
Secteur / Pays / Disponibilité d'ISE-040 ne sont pas livrés. La recherche par nom seule est
rendue. Ce n'est pas un arbitrage définitif, c'est un manque.

### 14.4 Arbitrages rapatriés de `docs/public-routing.md`

| # | Décision | Source |
| --- | --- | --- |
| D-153 | **ADOPTÉE** — Les entrées de l'en-tête public (« Le réseau », « Actualités », « Événements », « Opportunités », « Partenaires ») pointent vers des **ancres de sections** de PUB-001, jamais vers un écran membre. `/actualites` et `/evenements` existent désormais, mais restent **authentifiés** : y envoyer un visiteur anonyme le renverrait à la connexion. | `public-routing.md` §4 |
| D-154 | **ADOPTÉE** — PUB-001 est rendue `force-dynamic` ; c'est la **lecture des données** qui est mise en cache (étiquette `pub-001-landing`, revalidation 300 s), pas le HTML. L'en-tête dépend de la session et `ProtectedLink` doit rendre la bonne cible côté serveur, sans JavaScript. | `public-routing.md` §7 |
| D-155 | **ADOPTÉE** — Trois portes indépendantes protègent la redirection après authentification : `isPublicPath()` (liste blanche), `MEMBER_ROUTE_PREFIXES` (liste blanche des cibles `redirectTo`) et `safeRedirect()` (refus des URL absolues, des chemins d'authentification et des boucles). Une cible inconnue est ramenée au tableau de bord, jamais suivie. | `public-routing.md` §3 |

---

## 15. Superadmin — Communautés (SA-027 → 029)

| # | Décision | Source |
| --- | --- | --- |
| D-156 | **ADOPTÉE** — SA-029 (« Modération Publication Communauté ») ne couvre, côté écran, que la modération des **publications** de communauté. `admin_moderate_community_comment` (0099) existe côté base — même vérification de permission `communities.manage`, même journalisation dans `community_moderation_actions` — mais n'a pas d'écran dédié : le titre de l'écran désigne explicitement les publications, pas les commentaires. Rien n'empêche d'y brancher un écran ultérieurement, sans nouvelle migration : la fonction existe déjà. | `0099_admin_communities_api.sql`, `communautes/[communityId]/page.tsx` |

---

## 16. Superadmin — Événements (SA-030 → 033)

| # | Décision | Source |
| --- | --- | --- |
| D-157 | **ADOPTÉE** — SA-031/032/033 (validation, inscriptions, bilan d'événement) sont fusionnés en **un seul écran** `/administration/evenements/[eventId]`, à onglets, plutôt que trois routes distinctes. Le formulaire d'édition d'événement (`admin_update_event`) ne permet **pas** de reciblage de l'organisateur : aucun champ organisateur n'y est exposé. | `0100_admin_events_api.sql`, `evenements/[eventId]/page.tsx` |

Cette fusion suit exactement le précédent posé par SA-028/029 (D-156) et, avant lui, SA-024/025/026 :
un back-office de gestion de cycle de vie n'a pas besoin d'une route par sous-fonction quand un
seul jeu de données (l'événement) et une seule permission (`events.manage`) couvrent les trois. Sur
le reciblage d'organisateur : `get_event` et `private.event_card()` (0074) ne projettent **jamais**
les identifiants bruts d'organisateur vers le client — seuls des champs dérivés (nom affiché,
organisation) sortent, exactement comme pour `online_url_private` (D-150). Exposer un sélecteur
d'organisateur dans `admin_update_event` supposerait de faire remonter ces identifiants côté client,
ce que le modèle de projection existant refuse structurellement. Le reciblage d'organisateur, s'il
devient un besoin réel, appellera une fonction dédiée et auditée séparément — pas un champ ajouté
au formulaire général.

---

## 17. Superadmin — Journal d'audit (SA-049 → 050)

| # | Décision | Source |
| --- | --- | --- |
| D-158 | **ADOPTÉE** — SA-049 (« Journal Audit Historique Actions ») et SA-050 (« Détail Entrée Audit Conformité ») restent **deux routes distinctes** (`/administration/audit` et `/administration/audit/[entryId]`), à la différence de la fusion SA-024/025/026 → SA-028/029 (D-156) → SA-031/032/033 (D-157) : la lecture du détail est comportementalement distincte de la lecture de la liste, pas seulement informationnellement redondante. Aucune nouvelle fonction d'écriture n'a été créée : `private.read_audit_log()` (0028, surchargée par 0083) et ses façades `public.admin_read_audit_log` / `public.admin_get_audit_entry` / `public.admin_audit_overview` couvraient déjà, en base, l'intégralité du besoin des deux écrans avant le début de cette tranche — aucune migration nouvelle n'était donc nécessaire, seuls les écrans, la suite RLS et cette documentation manquaient. | `0083_admin_audit_api.sql`, `0018_platform_audit_events.sql`, `audit/page.tsx`, `audit/[entryId]/page.tsx` |

`admin_get_audit_entry` renvoie EXACTEMENT les mêmes colonnes que chaque ligne de
`admin_read_audit_log` (même mapper côté client, `toAuditLogEntry`) : SA-050 n'affiche donc aucune
donnée que SA-049 ne porte déjà. Ce qui justifie malgré tout deux routes, à l'inverse de SA-004
fusionné dans SA-003/SA-006 (aucune donnée ET aucun comportement propres) : consulter le détail
journalise un évènement `audit.entry_read` **dédié**, distinct de `audit.read` (qui ne marque qu'un
parcours de liste, filtres compris). C'est la preuve, pour un contrôle de conformité ultérieur,
qu'un administrateur a explicitement **revu** une entrée précise — l'intitulé SA-050
(« Conformité ») décrit un acte de revue, pas une simple consultation supplémentaire. Fusionner les
deux écrans (ex. tiroir latéral sur la liste) aurait perdu cette distinction : chaque ouverture du
tiroir aurait dû déclencher le même évènement dédié qu'une navigation complète, rendant la fusion
purement cosmétique — sans bénéfice sur le nombre de requêtes ni sur la clarté du code. Le choix
inverse (une seule fonction `admin_read_audit_log` sans `admin_get_audit_entry` séparé) aurait, lui,
supprimé la possibilité même de distinguer un survol de liste d'une revue individuelle : c'est
`admin_get_audit_entry` qui rend le contrôle de conformité vérifiable, pas une colonne de plus dans
la liste.

Pagination (SA-049) : `admin_read_audit_log` (0083) renvoie un `TABLE(...)`, pas un `jsonb`
enveloppé `{rows, next_cursor}` comme `admin_list_events`/`admin_list_communities` — c'est la seule
fonction `admin_list_*`/`admin_read_*` du back-office à emprunter cette forme, héritée de sa
première version (0028, réutilisée telle quelle par les membres du support avant même l'existence
d'un écran). Le curseur composite (`created_at`, `id` — D-44) est donc recomposé côté serveur Next
(`lib/admin-data/queries.ts`) à partir de la dernière ligne reçue, puis scellé
(`lib/opaque-cursor.ts`) avant de quitter le serveur — même garantie d'opacité que partout ailleurs,
construite ici plutôt que déléguée à `private.encode_keyset_cursor()`.

---

## 18. Correctif transversal — exports non-fonction depuis les fichiers `'use server'`

| # | Décision | Source |
| --- | --- | --- |
| D-159 | **ADOPTÉE** — Aucun fichier `'use server'` n'exporte autre chose que des fonctions async. Les neuf états initiaux (`initial*State`) qui vivaient dans sept `actions.ts` sont déplacés dans des fichiers voisins `states.ts` (modules ordinaires), qui importent leurs types depuis `actions.ts` via `import type` (effacé à la compilation, donc sans effet `'use server'`). Convention prospective : tout nouvel état initial de `useActionState` naît dans un `states.ts`, jamais dans un `actions.ts`. | `a9ed42b`, `*/states.ts`, `*/actions.ts`, `ClaimSearchForm.tsx` et 10 autres composants consommateurs |

Contexte : un export non-fonction d'un fichier `'use server'` n'est pas la valeur déclarée une fois
compilé — Turbopack (Next 16.3) le transforme **silencieusement** en *référence serveur*
(`createServerReference(...)`), c'est-à-dire un proxy appelable dont toutes les propriétés valent
`undefined`. `initialClaimSearchState` importé par `ClaimSearchForm` arrivait donc dans
`useActionState` sous forme de proxy sans `fieldErrors`, et `Object.keys(state.fieldErrors)` levait
`TypeError: Cannot convert undefined or null to object` — le 500 « intermittent » de
`/reclamer-mon-profil` (digests `1724077822` / `3088685757`, références ISE-CB506A52A080,
ISE-131E8E112FA2, ISE-9797295876FD, ISE-DDFF3FC13811 entre autres). L'intermittence était une
illusion : le rendu serveur échouait à chaque requête, mais le flux HTML basculait parfois sur un
nouveau rendu client complet qui masquait l'échec (erreur « recoverable » de React 19), parfois sur
la page d'erreur. Le diagnostic a été obtenu en lisant le code **compilé** au point exact du crash
(chunk client, ligne/colonne de la stack), pas en relisant les sources — les sources étaient
correctes au regard de TypeScript, qui ne voit pas la sémantique `'use server'`.

Les huit autres états exportés de la même façon (appels, opportunités, candidatures, relations,
recherche, alertes) portaient le même défaut à l'état latent : leurs consommateurs ne lisent que des
propriétés en accès optionnel (`state.results?.length ?? 0`), ce qui survit à un proxy — jusqu'au
jour où un accès strict serait ajouté. Ils sont corrigés dans le même commit plutôt que d'attendre
neuf incidents séparés. L'alternative « directive `'use server'` par fonction plutôt que par
fichier » a été écartée : elle aurait fait entrer tout le graphe d'imports serveur (`next/headers`,
requêtes Supabase) dans les bundles client des composants qui importent les états initiaux.

---

## 19. En-tête membre — point d'entrée vers le back-office

| # | Décision | Source |
| --- | --- | --- |
| D-160 | **ADOPTÉE** — Un lien « Administration » apparaît dans l'en-tête membre (Topbar, à gauche du bloc compte), UNIQUEMENT quand le compte détient au moins une permission d'administration (`readAdminAccess()`, même source que la garde serveur `requireAdminAccess()`). La sidebar membre (§89, D-95) reste strictement inchangée. Demandé par le porteur du projet le 2026-08-12 : aucun point d'entrée visible n'existait, même pour un compte habilité. | `Topbar.tsx`, `AppShell.tsx`, `fr.ts` (`nav.adminArea`) |

La séparation des deux navigations (§89 : aucun module admin dans la sidebar membre) est conservée —
ce lien est un point d'entrée, pas une fusion des espaces. Le masquage n'a jamais été une protection
(la garde réelle est `requireAdminAccess()` côté serveur + la revalidation de chaque fonction
`admin_*` en base) : l'absence totale de point d'entrée n'apportait donc aucune sécurité, seulement
de la friction pour les administrateurs. Coût assumé : `AppShell` exécute désormais
`get_my_admin_permissions()` (une RPC légère) à chaque rendu de page membre ; si cette lecture
échoue, le lien n'apparaît pas — un échec ne montre rien, il ne cache jamais un refus.

---

## 20. Provisioning direct des comptes du recensement

| # | Décision | Source |
| --- | --- | --- |
| D-161 | **ADOPTÉE** — Les 252 profils référencés issus du recensement reçoivent un compte pré-créé et pré-lié, et un e-mail « Activez votre compte » (lien d'invitation Supabase). L'intéressé clique, choisit son mot de passe (`/activer-mon-compte`), et atterrit sur son profil déjà rempli. Demandé par le porteur le 2026-08-12 : le parcours de réclamation (ISE-005→007) était trop exigeant comme porte d'entrée principale ; il est CONSERVÉ en filet de secours pour les e-mails de recensement invalides. Le mécanisme « mot de passe provisoire par e-mail » a été proposé puis écarté au profit du lien d'activation (validé par le porteur) : aucun secret ne circule par e-mail, et le « changement forcé au premier accès » n'a pas à être développé. | `0106_provision_referenced_account.sql`, `0107_provisioning_service_facades.sql`, Edge Function `provision-invitations`, `(auth)/activer-mon-compte/*`, `auth/callback/route.ts` |

La liaison compte↔profil reproduit à l'identique les effets de `private.apply_claim_approval`
(user_id, `claim_status='claimed'`, `profile_status='active'`, vérification `email` — la possession
de l'adresse est prouvée par le clic sur le lien envoyé à cette adresse —, rôle `member`, trace
d'audit `profile.account_provisioned`, évènement `profile.claimed` avec dédoublonnage
`profile.provisioned:<id>`). Toute réclamation en cours sur un profil provisionné est rejetée avec
la raison `profile_provisioned_directly`. L'Edge Function est réservée à `service_role`
(verify_jwt + contrôle explicite du rôle), travaille par lots de 50 maximum avec étalement,
accepte `dryRun` et `onlyEmail` (pilote), et passe par les façades `srv_*` (0107) puisque le schéma
`private` n'est pas exposé à PostgREST. Un lien d'activation expiré n'est pas une impasse : l'écran
`/activer-mon-compte` sans session oriente vers « Mot de passe oublié », qui joue exactement le même
rôle sur un compte existant.

---

## 21. Rédaction administrative des actualités (SA-034, module éditorial manquant)

| # | Décision | Source |
| --- | --- | --- |
| D-162 | **ADOPTÉE** — Un écran `/administration/actualités` (permission `content.publish`) permet de rédiger, modifier et publier un article directement, sans passer par SQL. Demandé par le porteur le 2026-08-12 : après le lancement, il n'existait aucun moyen de créer une actualité — `/cms/actualites` (D-128) ne pilote que l'exposition sur la landing d'articles déjà existants. Cet écran **supersede la classification « non livré » de SA-034** (décision C-07, 2026-08-11) : SA-034 est désormais livré. SA-035→038 (support & signalements) restent hors périmètre, inchangés. | `0110_admin_news_authoring_api.sql`, `administration/actualites/**`, `lib/admin/queries-news.ts`, `i18n/admin-news.ts` |

Cycle éditorial volontairement restreint à l'usage réel : `admin_set_news_status` n'autorise que
`draft ↔ published ↔ archived` (jamais `submitted`/`under_review`/`approved`/`rejected`/`duplicate`,
qui appartiendraient à un circuit de **soumission membre** non construit — aucun écran ne l'expose,
et `news_editorial_status_check` (0013) continue de les accepter en base sans que cette tranche les
utilise). `admin_create_news`/`admin_update_news`/`admin_set_news_status` et `admin_list_news` sont
neuves ; la lecture détail réutilise `public.get_news()` tel quel, comme SA-031 réutilise
`get_event` — `private.can_see_news()` (0046) accorde déjà un bypass à `content.publish`, y compris
pour les statuts non publiés.

Frontière D-128 réaffirmée, pas rouverte : cette tranche ne touche jamais `landing_visibility` /
`landing_priority` / `is_featured`. Publier éditorialement un article ici ne le rend pas visible sur
la landing — l'exposition reste le rôle exclusif de `/cms/actualites`, une fois l'article publié.
Un bandeau le rappelle sur la fiche article dès que le statut passe à « Publié ».

Le formulaire d'édition omet volontairement la visibilité (tous les membres / promotion /
communauté) : `NewsDetail` (`content-view.ts`) ne projette que le LIBELLÉ résolu de la promotion/
communauté associée, jamais son identifiant brut, et `admin_update_news` réécrit
`promotion_id`/`community_id` dès que `p_visibility` est fourni — les reproposer sans l'identifiant
réel aurait risqué d'écraser silencieusement le rattachement existant. La portée se règle donc à la
création et reste stable ensuite ; une évolution ultérieure pourra exposer les identifiants bruts
si ce besoin se confirme.

Les deux articles de lancement, insérés directement par SQL avant que cette tranche n'existe,
restent en base tels quels (aucune migration de données) : ils sont désormais éditables normalement
depuis ce nouvel écran.

---

## 22. Réglage de rotation automatique du carrousel et correction du survol (PUB-001)

| # | Décision | Source |
| --- | --- | --- |
| D-163 | **ADOPTÉE** — La durée de rotation automatique du carrousel de la landing (`AUTOPLAY_MS`, figée à 7000 ms) devient un réglage administratif : `platform_settings` porte la clé `landing.hero_carousel.autoplay_seconds` (défaut 7, bornée 3-60 à la lecture), modifiable sans code depuis `/administration/parametres` (écran générique déjà livré, SA-048). Une dixième projection `get_landing_carousel_settings()` l'expose à `anon`, sur le même modèle que les neuf projections de 0061. | `0111_landing_carousel_autoplay_setting.sql`, `lib/public/landing-data.ts`, `LandingCarousel.tsx` |

`cms_sections` (ligne `section_key = 'hero_carousel'`, colonne `configuration` jsonb) a été
écarté comme support de ce réglage : cette ligne reste `status = 'draft'` sans
`published_snapshot`, `get_landing_sections()` ne la retourne donc jamais, et sa colonne
`configuration` n'est de toute façon exposée ni par `apps/web/src/app/cms/sections/SectionEditor.tsx`
ni consommée par `landing-data.ts`. `platform_settings` était la voie la plus courte : générique,
déjà pourvue d'un écran d'édition, sans aucun développement d'interface supplémentaire.

La liste blanche du contrôle de sécurité `anon_function_grant`
(`private.security_baseline_violations()`, dernière forme 0063) est étendue à onze noms dans la
même migration : sans cette extension, le contrôle aurait lui-même signalé la nouvelle projection
comme une fuite au premier appel. Vérifié après application : `security_baseline_violations()`
renvoie toujours 0 ligne.

**Correction du survol permanent, constatée par le porteur le 2026-08-12** : le carrousel
n'avançait plus tout seul, et le bouton lecture/pause semblait sans effet. Cause réelle : depuis le
passage du hero en plein écran (0109), la région `<section>` porteuse du carrousel couvre tout le
viewport visible au chargement de la page ; `onMouseEnter`/`onMouseLeave` y suspendaient le
défilement dès qu'une souris était présente n'importe où sur l'écran — y compris en survolant les
commandes elles-mêmes, ce qui empêchait le bouton lecture/pause de refléter un état « en lecture »
tant que le curseur restait dessus. Le survol-pause est retiré ; le focus clavier (`onFocusCapture`/
`onBlurCapture`) et le bouton lecture/pause explicite restent les deux mécanismes d'arrêt, ce
dernier suffisant seul à satisfaire WCAG 2.2.2 (mécanisme de pause explicite, sans exigence de
survol).

---

## 23. Resserrement du menu public et premier câblage des piliers « réseau utile »

| # | Décision | Source |
| --- | --- | --- |
| D-164 | **ADOPTÉE** — Le menu de l'en-tête public passe de six à cinq entrées : `Accueil`, `À la une`, `Le réseau`, `Expertises`, `Partenaires`. `À la une` remplace les trois anciennes entrées `Actualités` / `Événements` / `Opportunités` et pointe sur l'ancre de toute la section « À la une du réseau » (`LANDING_ANCHORS.highlights`), pas sur une carte isolée. `Expertises` est une entrée nouvelle vers `ExpertisesSection`, rendue depuis PUB-001 mais jusqu'ici absente du menu. | `public-nav.ts`, `PublicHeader.tsx` |

Deux défauts réels corrigés au passage, tous deux constatés par le porteur le 2026-08-12 :

- **« Accueil » ne ramenait jamais en haut de page** quand on s'y trouvait déjà : un
  `<Link href="/">` seul ne produit aucune navigation si l'URL ne change pas, donc aucun
  défilement. `PublicHeader.tsx` ajoute un gestionnaire de clic dédié
  (`window.scrollTo({ top: 0, behavior: 'smooth' })`), déclenché en plus de la navigation normale
  quand on part d'une autre page publique.
- **Aucune ancre de menu ne pointait sur `ExpertisesSection`** (« Explorer les expertises ») bien
  que la section soit réellement rendue depuis le premier jour de PUB-001 — simple oubli de
  `PUBLIC_NAV_ITEMS`, corrigé par l'ajout de l'entrée `Expertises`.

**Premier câblage d'un pilier de « Un réseau conçu pour être utile »** (`NetworkSection.tsx`) :
jusqu'ici les quatre piliers (Connecter / Entraider / Collaborer / Impacter) étaient du texte pur,
sans image ni lien, assumé comme « discours de marque ». Le porteur demande que chaque pilier mène
à un écran réel ; seule la cible de `Connecter` est précisée à ce stade (« arriver à la recherche
d'experts ISE »). `Connecter` est donc câblé vers `SEARCH_ROUTES.find` (`/rechercher`, ISE-034) via
`ProtectedLink` (`resourceType="espace-membre"`), exactement le même mécanisme que les pastilles
d'`ExpertisesSection` — un visiteur anonyme passe par ISE-001 avant d'atteindre l'écran, jamais de
lien mort. Les trois autres piliers restent du texte seul : inventer leur cible aurait violé la
règle « jamais de lien mort » (ADDENDUM §10, règle 6). Table `PILLAR_TARGETS` volontairement
partielle, en attente des cibles réelles de `Entraider` / `Collaborer` / `Impacter`.

**Explicitement hors périmètre de ce commit**, chantiers plus larges ouverts en suivi (409 : liste
de tâches du porteur) : images sur les cartes Événements/Opportunités de « À la une » (aujourd'hui
uniquement les Actualités en ont une) ; écran CMS dédié aux Opportunités pour piloter leur
exposition sur la landing (`/cms/opportunites` n'existe pas, alors que `set_landing_exposure()`
supporte déjà `opportunity` côté base) ; transformation des quatre piliers en contenu piloté par le
CMS (image, texte optionnel, lien, par pilier) ; picklist d'organisation dans les formulaires de
profil pour fiabiliser le comptage `get_landing_stats().organizations` ; décision sur une éventuelle
photo réelle pour « ISE du jour » (aujourd'hui un monogramme, D-135, choix de confidentialité
assumé — un changement demanderait de redéfinir le périmètre de `allow_public_feature`) — **tranchée
ci-dessous par D-165**.

---

## 24. « ISE du jour » : visuel éditorial et accroche, sans rouvrir D-135 (D-165)

| # | Décision | Source |
| --- | --- | --- |
| D-165 | **ADOPTÉE** — La carte « ISE du jour » affiche désormais une vraie photo et une courte accroche, choisies par l'admin **par mise en avant** (`cms_featured_profile_history.showcase_media_id` / `showcase_tagline`, migration `0112`), et non plus seulement le monogramme. Le visuel provient exclusivement de la médiathèque **publique** (`cms_media_assets`, bucket `landing-media`) — jamais du bucket privé `avatars`. Quand aucun visuel n'est choisi pour une mise en avant, le monogramme reste le repli. | `0112_featured_profile_showcase.sql`, `FeaturedForms.tsx` (`ShowcaseForm`), `HighlightsSection.tsx` (`FeaturedProfileCard`) |

**Demande du porteur** (réponse à la question de clarification posée avant ce commit) : *« Pour la
carte ISE, c'est photo de profil + petit texte descriptif (Exemple : Gilles N'Gatta, le ISE qui
voulait parler l'anglais, indétrônable bosseur, etc. etc). Tout cela dans la carte. »*

**Pourquoi ce n'est pas une réouverture de D-135.** D-135 dit : le bucket `avatars` est privé et le
reste, et `allow_public_feature` consent à un teaser **textuel**, pas à la publication d'une
photographie personnelle du membre. Cette règle n'a **pas changé** : `get_landing_featured_profile()`
ne projette toujours pas `avatar_path` (le bloc de vérification de la migration 0112 le réaffirme en
échouant si la chaîne `'avatar_path'` réapparaît dans la fonction). Le champ `photo` ajouté ici est
un objet **différent** : c'est un visuel choisi par l'administrateur au moment où il programme la
mise en avant, dans la **même** médiathèque publique que le carrousel et les actualités — un visuel
déjà soumis à l'obligation d'un texte alternatif non vide (CMS-008, ADDENDUM §52). Il n'existe
d'ailleurs aujourd'hui **aucun écran** permettant à un membre de déposer sa propre photo de profil
(D-117 : « Dépôt de photo… non ouvert ») : il n'y a donc pas de photo personnelle à exposer par
accident, seulement un choix éditorial explicite de l'administrateur.

**Pourquoi une accroche par mise en avant, et pas un champ sur le profil.** `showcase_tagline` vit
sur `cms_featured_profile_history` (une ligne par `featured_date`), pas sur `ise_profiles` : la même
personne peut être remise en avant plus tard avec une accroche différente. Elle est volontairement
distincte de `public_summary` (qui reste affiché à côté sur la carte) : l'accroche est une courte
punchline éditoriale (3 à 160 caractères, contrainte `cms_featured_profile_history_tagline_length`),
le résumé reste la description factuelle du profil.

**Ce qui change concrètement** :
- Migration `0112_featured_profile_showcase.sql` : colonnes `showcase_media_id` (FK vers
  `cms_media_assets`, `on delete set null`) et `showcase_tagline` (contrainte de longueur) sur
  `cms_featured_profile_history` ; nouvelle RPC `set_featured_profile_showcase(p_featured_date,
  p_media_id, p_tagline)`, réservée à `cms.featured_profile.manage`, auditée
  (`cms.featured_profile.showcase_updated`) ; `get_cms_featured_profile_overview()` et
  `get_landing_featured_profile()` mis à jour en conséquence (`create or replace`, aucun nouveau nom
  de fonction anon-exécutable — la liste blanche `anon_function_grant` n'a pas besoin d'être étendue).
- CMS-006 (`/cms/ise-du-jour`) : nouvelle section « Visuel et accroche (D-165) », qui choisit le
  visuel dans un menu déroulant alimenté par `loadMediaOptions()` (déjà utilisé par CMS-002/CMS-008)
  et saisit l'accroche dans un champ texte borné.
- PUB-001 : `LandingFeaturedProfile.photo` / `.tagline`, alimentés par `featuredProfileSchema` avec
  les mêmes contrôles que tout autre média public (`parseMedia()` — bucket public, texte alternatif
  non vide) ; `FeaturedProfileCard` affiche la photo dans le même gabarit `MediaFrame` que les
  actualités quand elle existe, et retombe sur `ProfileMonogram` sinon.
- Tests : `landing-data.test.ts` (liste blanche du teaser étendue à `photo`/`tagline`, contrôle que
  `avatar_path` et un bucket privé ne produisent jamais de photo) et `landing-render.test.ts`
  (rendu avec et sans visuel choisi, l'assertion D-135 existante — « jamais de photographie quand
  rien n'a été choisi » — reste verte inchangée).

---

## 25. Visuels sur les cartes Événements/Opportunités, écran CMS `/cms/opportunites`, et règle permanente des tailles d'image recommandées (D-166)

| # | Décision | Source |
| --- | --- | --- |
| D-166 | **ADOPTÉE** — Les cartes Événements et Opportunités de « À la une » affichent désormais un visuel éditorial optionnel, choisi dans la médiathèque publique par le même geste que D-165 (`cover_media_id`, migration `0113`). Un nouvel écran CMS `/cms/opportunites` (CMS-006bis) est créé pour piloter l'exposition des opportunités sur la landing, jusqu'ici absent alors que `set_landing_exposure()` supportait déjà `'opportunity'` côté base. Règle permanente, non limitée à ce commit : **tout champ image ajouté au CMS affiche désormais, à côté du sélecteur, la taille de fichier recommandée en pixels.** | `0113_landing_cover_media.sql`, `HighlightsSection.tsx`, `CoverMediaForm.tsx`, `/cms/evenements`, `/cms/opportunites`, `i18n/cms.ts` |

**Demande du porteur** : *« enchaîne. mais note qu'a chaque fois que tu mets des champs d'image,
veille à mettre quelque part à coté, la taille de l'image recommandé. »* — reprise des chantiers
listés en hors-périmètre par D-164, plus une règle de conduite permanente pour tout champ image
futur, pas seulement ceux touchés ici.

**Visuel de couverture — même patron que D-165, répliqué sur deux modules.** Migration `0113` ajoute
une colonne `cover_media_id` (FK vers `cms_media_assets`, `on delete set null`) sur `events` et sur
`opportunities`, et une RPC unique `set_landing_cover_media(p_entity_type, p_entity_id, p_media_id)`
qui dispatche sur les deux types, réservée à `cms.edit`, valide le média (bucket `landing-media`,
texte alternatif non vide, non supprimé), verrouille la ligne et journalise
(`cms.landing_cover_media`). Contrairement à `set_landing_exposure()`, elle n'exige jamais
`cms.publish` : choisir un visuel n'est pas en soi un acte de publication. Le choix d'une **colonne
dédiée plutôt que `cms_content_overrides`** est délibéré : un override est borné dans le temps et
répond à une logique d'épinglage temporaire (§43), alors qu'un visuel de couverture est une donnée
persistante par entité — sémantiquement différente. `list_cms_events()` et la nouvelle
`list_cms_opportunities()` exposent la colonne ; `get_landing_events()` / `get_landing_opportunities()`
résolvent le média via `private.landing_media()`, la même fonction canonique que le carrousel, les
actualités et D-165. Sans visuel choisi, la carte s'affiche sans image plutôt qu'avec une image
cassée — même comportement que le monogramme de repli de D-165.

**Écran `/cms/opportunites` (CMS-006bis) — miroir exact de CMS-005, pas une nouvelle logique.** Le
CMS ne pilote que trois choses, à l'identique des Événements : la visibilité landing, la priorité
éditoriale, et l'épinglage temporaire (`cms_content_overrides`, §43) — plus, depuis cette même
décision, le visuel. Aucun champ métier n'y transite : ni le statut de l'offre, ni sa modération, ni
sa description, ni la rémunération, ni le contact, ni l'URL de candidature externe (ADDENDUM §13,
D-128). `loadCmsOpportunities()` appelle une nouvelle RPC `list_cms_opportunities()`, miroir
énuméré de `list_cms_events()` qui exclut explicitement ces champs privés — le bloc de vérification
interne de la migration `0113` échoue si l'un d'eux apparaît dans la sortie.

**Règle permanente des tailles d'image recommandées.** Chaque hint de champ image du CMS porte
désormais la taille conseillée en pixels, en plus du format et du poids maximal déjà indiqués :
1600 × 900 px (16/9) pour un visuel plein cadre isolé (couverture d'événement/opportunité, showcase
« ISE du jour », `showcaseHelp`) ; 1920 × 1080 px (16/9) Desktop et 1080 × 1350 px (4/5) Mobile pour
les paires Desktop/Mobile (carrousel, campagnes partenaires) ; la médiathèque générale (CMS-008)
résume les deux cas puisqu'elle sert tous les emplacements. Cette règle s'applique rétroactivement
aux champs déjà existants (`carousel.fieldMediaHelp`, `partners.fieldMediaHelp` — qui n'avait
jusqu'ici aucun hint —, `media.fieldFileHelp`, `featured.showcaseHelp`) et **à tout champ image créé
ultérieurement** : ce n'est pas un correctif ponctuel mais une convention d'interface durable pour ce
projet.

**Ce qui change concrètement** :
- `0113_landing_cover_media.sql` : colonnes `cover_media_id` sur `events`/`opportunities` ;
  `set_landing_cover_media()` ; `list_cms_events()` recréée (ajoute `cover_media_id`) ;
  `list_cms_opportunities()` nouvelle ; `get_landing_events()` / `get_landing_opportunities()`
  recréées (ajoutent `image`). Vérifié indépendamment de son propre bloc `do $verify$` : `security_
  baseline_violations()` et `storage_baseline_violations()` restent à 0 ligne après application.
- `landing-data.ts` : `LandingEvent.image` / `LandingOpportunity.image`, schémas Zod et tests associés.
- `HighlightsSection.tsx` : `EventCard` / `OpportunityCard` reçoivent un `visual` optionnel, même
  gabarit `MediaFrame` 16/9 que les actualités et D-165.
- `CoverMediaForm.tsx` (nouveau, `apps/cms/_components`) : composant partagé, repli `<details>` à
  l'identique d'`EntityScheduleForm`, réutilisé par `/cms/evenements` et `/cms/opportunites`.
- `/cms/evenements` : nouvelle action `setEventCoverMediaAction`, champ visuel ajouté par ligne.
- `/cms/opportunites` (nouveau) : `page.tsx` + `actions.ts`, miroir structurel de `/cms/evenements`.
- `i18n/cms.ts` : bloc `opportunities` complet, hints de taille recommandée sur `events.coverHelp`,
  `opportunities.coverHelp`, `featured.showcaseHelp`, `carousel.fieldMediaHelp`,
  `partners.fieldMediaHelp` (nouveau), `media.fieldFileHelp`.
- Routes et navigation : `CMS_ROUTES.opportunities` (`/cms/opportunites`), entrée de menu
  correspondante.

---

## 26. Picklist Organisations dans les formulaires de profil (D-167)

| # | Décision | Source |
| --- | --- | --- |
| D-167 | **ADOPTÉE** — L'en-tête de profil (ISE-017) et les expériences (ISE-019) proposent désormais une liste déroulante alimentée par `public.organizations` pour choisir l'organisation, avec repli en texte libre pour une organisation absente du référentiel. `ise_profiles.current_organization_id` et `experiences.organization_id` — des colonnes FK qui existaient déjà, lues mais jamais écrites — sont enfin renseignées. | `lib/queries/reference.ts` (`loadOrganizations`), `mon-profil/en-tete/ProfileHeaderForm.tsx`, `mon-profil/experiences/ExperienceForm.tsx`, `mon-profil/actions.ts` |

**Pourquoi ce n'était qu'un correctif applicatif.** Aucune migration n'était nécessaire. L'audit
préalable a montré que tout le reste existait déjà : les colonnes FK (`ise_profiles.
current_organization_id` depuis `0003_identity_core.sql`, `experiences.organization_id` depuis
`0005_profile_content.sql`), les schémas Zod (`profileHeaderSchema.currentOrganizationId`,
`experienceSchema.organizationId`, tous deux déjà `z.string().uuid().optional()`), et surtout la
lecture publique — `get_member_profile()` (`0036`/`0038`) résout déjà `current_organization` par
`coalesce(organizations.canonical_name, current_organization_raw)`, et `experiences` fait de même
via sa jointure. Seule l'ÉCRITURE manquait : les formulaires ne soumettaient jamais l'identifiant,
seulement le texte libre. C'est exactement le gap nommé par D-164 : « picklist d'organisation dans
les formulaires de profil pour fiabiliser le comptage `get_landing_stats().organizations` ».

**Le texte libre reste un repli, jamais supprimé.** Aucune RPC de création d'organisation
n'existe côté membre — en créer une sortirait du périmètre de ce correctif et poserait une question
de modération (D-166 note le même choix pour les visuels : le CMS ne crée jamais d'entité liée). Un
membre dont l'organisation n'est pas répertoriée saisit donc son nom comme avant ; les deux champs
coexistent dans le formulaire, avec la règle : un identifiant choisi dans la liste prime et efface le
texte libre correspondant (`current_organization_raw` / `organization_name_raw` mis à `null` côté
serveur quand un `organizationId` est soumis), pour ne jamais stocker un texte contradictoire à côté
d'un identifiant résolu.

**Hors périmètre, assumé.** Le champ « Organisation / commanditaire » du formulaire Projets
(`ProjectForm.tsx`) reste en texte libre : `projects` ne porte aucune colonne `organization_id`, ce
n'est pas le même gap que celui nommé par D-164. Le formulaire admin de création de profil référencé
(`administration/membres/nouveau/CreateProfileForm.tsx`) n'est pas non plus converti : il crée un
profil non réclamé à partir d'informations déclaratives saisies par un administrateur, hors du
comptage `get_landing_stats().organizations` qui motivait ce correctif. L'application mobile
(`apps/mobile`) n'est pas non plus alignée dans ce commit (C-02 : web d'abord).

---

## 27. Piliers « Un réseau conçu pour être utile » pilotés par le CMS (D-168)

| # | Décision | Source |
| --- | --- | --- |
| D-168 | **ADOPTÉE** — Les quatre piliers de la landing (Connecter / Entraider / Collaborer / Impacter, `NetworkSection.tsx`) reçoivent chacun une image optionnelle, une légende optionnelle et un lien, pilotés par un nouvel écran CMS-011 (`/cms/piliers`). Le titre et le texte de marque de chaque pilier restent fixes (`fr.public.pillars`) : ce n'est pas remis en cause. Le lien n'est jamais un chemin inventé par l'administrateur : il choisit parmi une liste blanche de cinq écrans membres réels, validée côté base. | `supabase/migrations/0114_landing_pillars.sql`, `lib/public/landing-data.ts`, `NetworkSection.tsx`, `lib/cms/{types,queries,mutations}.ts`, `app/cms/piliers/*`, `i18n/cms.ts` |

**Ce que ça ferme.** D-164 (§23) avait câblé le premier et unique lien (`Connecter` →
`SEARCH_ROUTES.find`) dans une table `PILLAR_TARGETS` codée en dur côté frontend, et avait
explicitement laissé en suivi « transformation des quatre piliers en contenu piloté par le CMS
(image, texte optionnel, lien, par pilier) ». C'est exactement ce que fait cette migration.

**Ce qui reste fixe, et pourquoi.** Le titre (« Connecter », « Entraider »…) et le corps de chaque
pilier sont du discours de marque, pas de la donnée métier — le commentaire de `NetworkSection.tsx`
le dit depuis l'origine et cette décision ne le change pas. Seule la partie éditoriale qui varie
dans le temps devient pilotable : un visuel, une légende qui s'ajoute au texte fixe sans le
remplacer, et un lien.

**Le modèle de données.** `cms_pillars` porte exactement 4 lignes fixes (une par pilier), jamais
créées ni supprimées par le CMS — RLS n'accorde ni `INSERT` ni `DELETE`, seulement `SELECT`
(`cms.read`) et `UPDATE` (`cms.edit`). `media_id` référence la médiathèque publique
(`cms_media_assets`, bucket `landing-media`) — même patron que D-165/D-166, jamais un chemin
recopié à la main. `link_target` est une clé (`search` \| `calls` \| `projects` \| `opportunities` \|
`applications`) validée par un `check` en base ET par `set_landing_pillar()`, jamais un chemin
libre : la résolution en URL réelle (`SEARCH_ROUTES.find`, `CALL_ROUTES.list`, `PROJECT_ROUTES.list`,
`OPPORTUNITY_ROUTES.list`, `OPPORTUNITY_ROUTES.applications`) se fait côté frontend
(`NetworkSection.tsx`), pour ne jamais dépendre d'une chaîne de caractères libre venue de la base.
Un pilier sans `link_target` reste du texte seul — exactement le comportement de `PILLAR_TARGETS`
avant cette migration quand une clé était absente (ADDENDUM §10, règle 6 : jamais de lien mort).

**Pourquoi cinq cibles précises, et pas une liste ouverte.** Chacune existe déjà comme écran membre
réel : `/rechercher` (ISE-034, Connecter), `/appels` (Entraider), `/projets` (Collaborer — le
fil d'Ariane des maquettes place déjà ISE-088 sous « Collaborer », cf. le commentaire de
`routes/projects.ts`), `/opportunites` et `/candidatures` (Impacter ou Connecter, au choix de
l'administrateur). Seul `connecter` est pré-rempli vers `search` : c'est une reprise exacte du
câblage déjà fait par D-164, pas une régression. Les trois autres piliers démarrent sans lien —
l'administrateur choisit activement, il n'hérite d'aucune cible devinée.

**Lecture publique.** `get_landing_pillars()` (SECURITY DEFINER, `anon` inclus dans la liste
blanche de `private.security_baseline_violations()`, étendue par cette migration) projette
`image` via `private.landing_media()` — mêmes garanties que le reste de la landing (bucket public,
alternative textuelle ≥ 3 caractères obligatoire, sinon l'image est simplement absente). Côté
frontend, `landing-data.ts` traite `pillars` comme une `LandingSection<LandingPillar>` de plus,
avec le même mécanisme de repli sur la dernière version connue (`withLastKnownGood`) que les
huit autres sections — sans entrer dans `isLandingEmpty()`, qui resterait sinon toujours `false`
puisque les 4 lignes existent toujours, même sans contenu éditorial.

**Écran CMS-011 (`/cms/piliers`).** Reprend le patron `CoverMediaForm` (D-166) pour le sélecteur de
média, avec le même rappel permanent de taille recommandée, plus deux champs (légende, lien) qui
voyagent ensemble dans un seul appel à `set_landing_pillar()` — les trois valeurs sont écrites
atomiquement, jamais en plusieurs allers-retours.

**Hors périmètre, assumé.** Le titre et le texte des piliers ne sont pas éditables (discours de
marque assumé, cf. ci-dessus). L'application mobile (`apps/mobile`) n'est pas alignée dans ce
commit (C-02 : web d'abord).

---

## 28. `domain_events` manquants pour candidatures et recommandations, et extension du consommateur de notifications (D-169)

**Constat.** Documenté depuis le journal du 12 août et repris en tête de `0105_notification_consumer.sql` :
`submit_application`, `declare_external_application` et `transition_application_status` (0008)
n'écrivaient aucune ligne dans `public.domain_events`, malgré un catalogue `application.*` déjà
seedé (0018/0056) et un type `application_status_changed` déjà présent dans `notification_types`
(0015) — jamais émis faute d'événement à consommer. Même trou côté recommandations : la création
d'une `recommendation_requests` passe par un insert direct côté client (RLS `0021`), sans RPC
dédiée, donc sans point d'insertion `domain_events` existant.

**Solution — deux migrations.**

- **`0115_domain_events_applications_recommendations.sql`.** Reprend les trois fonctions
  `applications` (0008) et `respond_recommendation_request` (0085) à l'identique, en n'ajoutant que
  l'`insert into public.domain_events (...)` manquant à chaque issue. Réutilise cinq codes déjà
  seedés mais jamais émis (`application.submitted`, `application.selected`,
  `application.declared_external`, `application.status_declared`, `application.withdrawn`) et
  ajoute un code générique manquant, `application.status_changed`, pour les transitions pilotées
  par le recruteur ou l'administration qui ne correspondent à aucun code spécifique. Côté
  recommandations : trois nouveaux codes (`recommendation.requested`,
  `recommendation.request_answered`, `recommendation.withdrawn`) et un **trigger `AFTER INSERT`**
  sur `recommendation_requests` (`private.emit_recommendation_requested_event()`) — choix délibéré
  de ne pas créer de RPC de création qui remplacerait l'insert direct côté client existant,
  cohérent avec le style déjà en place pour cette table (`trg_guard_recommendation_request_update`,
  0085).
- **`0116_notification_consumer_extension.sql`.** Étend le `case` de
  `private.process_pending_domain_event_notifications()` (0105) — jamais modifiée sur place, une
  migration déjà appliquée ne se réécrit pas — à quatre types de plus :
  `application.status_changed` et `application.selected` (le candidat est informé, réutilise le
  type `application_status_changed` déjà seedé), `recommendation.requested` et
  `recommendation.request_answered` (deux nouveaux types de notification, catégorie `network` par
  analogie avec `connection_request_received`, faute de catégorie dédiée dans la liste fermée du
  `check` de `notification_types.category`/`notifications.category`). Total : 13 types
  d'événements couverts sur ~40 réellement écrits (9 depuis 0105, 4 de plus ici).

**Volontairement non couvert dans ce lot**, documenté en tête de 0115 et 0116 plutôt que passé sous
silence : `application.submitted`, `application.declared_external`, `application.status_declared`
(le candidat vient lui-même d'agir, rien à notifier) ; `application.withdrawn` côté recruteur
(aucun type au catalogue, à confirmer si le besoin existe) ; `recommendation.withdrawn` (un retrait
clôt simplement une demande en attente, sans décision à notifier). Ces événements restent
`pending` → `processed` par la branche `else` déjà existante du consommateur — sémantique outbox
inchangée, pas de backlog.

**Vérifié après application** sur le projet Supabase de production : les 4 nouveaux codes
`domain_event_types` et les 2 nouveaux `notification_types` sont bien présents, le trigger
`trg_emit_recommendation_requested` existe sur `recommendation_requests`,
`security_baseline_violations()` et `storage_baseline_violations()` renvoient 0 ligne pour les deux
migrations.

**Addendum mobile — nettoyage de code mort (tâche #114).** En vérifiant l'état réel de
`apps/mobile/src/navigation/` (un résumé de session antérieur suggérait à tort que 6 piles restaient
à monter), le code s'est révélé déjà fonctionnellement complet : les 6 piles (`OnboardingStack`,
`SearchStack`, `RelationsStack`, `NetworkCallsStack`, `ProfileManagementStack`,
`OpportunitiesDetailStack`) sont toutes atteignables depuis l'application. Deux fichiers portaient
cependant un composant navigateur mort (`RelationsStack()`, `NetworkCallsStack()`, jamais monté nulle
part — leurs écrans avaient déjà été fusionnés à plat dans `ReseauStack.tsx` par une passe
antérieure) : retirés, en conservant intacts `RelationsStackParamList` et `NetworkCallsStackParamList`
au même endroit, puisque 13 écrans et `ReseauStack.tsx` les importent directement par leur chemin de
fichier. `AppTabParamList.Reseau` est aussi passé de `undefined` à
`NavigatorScreenParams<ReseauStackParamList>`, par cohérence avec `ActionCentrale`. Aucun changement
de comportement.

---

## 29. Rognage du carrousel héros — le conteneur desktop passe d'une hauteur plein écran à un ratio panoramique fixe (D-170)

| # | Décision | Source |
| --- | --- | --- |
| D-170 | **ADOPTÉE** — Sur desktop/tablette (`md:` et plus), le conteneur de chaque diapositive du carrousel héros de PUB-001 abandonne la hauteur `calc(100dvh-var(--layout-topbar))` (0109) pour un ratio fixe `aspect-[1920/720]` (≈ 2,667:1). Le mobile n'est pas concerné : il conserve la hauteur plein écran, hors périmètre du signalement. `object-contain` (correctif du même jour) reste actif : aucune image n'est jamais rognée. | `LandingCarousel.tsx` |

**Ce que ça corrige.** Le porteur a signalé le même jour (2026-08-13), via une capture d'écran puis
une analyse UX détaillée, que le correctif précédent (`object-contain` universel, appliqué en
réponse au rognage initial de la bannière partenaire « Optimum Conseil ») faisait apparaître de
larges bandes latérales `bg-deep-navy` sur les diapositives existantes (au format 16:9), parce que
le conteneur restait calé sur `100dvh` — une hauteur très variable selon la fenêtre, souvent bien
plus « carrée » qu'un visuel 16:9. Deux options possibles : rogner (régression du problème initial)
ou laisser des bandes plus ou moins grandes selon l'écran. La recommandation retenue, transmise par
le porteur, est de rapprocher le **ratio du conteneur** de celui des visuels plutôt que l'inverse :
un format panoramique fixe proche de **1920 × 720 px (≈ 2,667:1)** pour les futures affiches du
carrousel desktop, au lieu de 1920 × 1080 (16:9) jusqu'ici. `aspect-[1920/720]` (Tailwind, valeur
arbitraire) remplace donc le `min-h` plein écran pour `md:` et plus ; `object-contain` continue de
garantir qu'aucune image, ancienne (16:9) ou future (2,667:1), n'est jamais rognée — seule la largeur
des bandes latérales varie selon l'écart entre le ratio du visuel et celui du conteneur.

**Effet transitoire, assumé.** Les affiches déjà publiées, au format 16:9, afficheront des bandes
latérales plus larges qu'avant sur les grands écrans desktop (le conteneur est maintenant plus
panoramique que la version 100dvh) : c'est le compromis explicitement accepté par le porteur en
attendant que les prochaines affiches soient produites au nouveau format. Aucune régression pour le
mobile (inchangé) ni pour la lisibilité du texte incrusté dans les visuels existants (jamais rogné,
avant comme après).

**Hors périmètre de cette décision.** Les déclinaisons par point de rupture proposées par le porteur
(tablette 1200×600, mobile 1080×1350/1440) ne sont pas implémentées ici : le mobile utilise déjà un
mécanisme de direction artistique dédié (`slide.mobileMedia`, visuel distinct par diapositive) sans
lien avec le ratio du conteneur, et n'a fait l'objet d'aucun signalement. De même, le principe de ne
plus incruster de texte dans les visuels futurs (texte HTML superposé plutôt que texte dans l'image)
n'est pas une décision technique nouvelle : l'infrastructure existe déjà (`slide.title`, `subtitle`,
`description`, `ctaLabel` rendus par-dessus l'image selon `text_position`, §9/§26) — il s'agit d'une
consigne de production de contenu pour les prochaines affiches, à appliquer côté CMS, pas d'un
changement de code.
---

## 30. Lien de navigation croisé entre `/administration` et `/cms` (D-171)

| #     | Décision | Source |
| ----- | -------- | ------ |
| D-171 | **ADOPTÉE** — Un lien « Aller au CMS » apparaît en bas du menu Administration, et un lien « Retour à l'administration » en bas du menu CMS. Chaque lien n'apparaît que si le compte courant a effectivement accès à la section cible (`cms.read` côté admin, au moins une permission d'administration côté CMS) — même règle que le reste de ces deux navigations : masquer une entrée que la base refuserait n'est pas une mesure de sécurité, c'est éviter un bouton décoratif (MASTER PROMPT §113). | `AdminShell.tsx`, `CmsShell.tsx`, `AdminNav.tsx`, `CmsNav.tsx` |

**Ce que ça corrige.** Retour direct du porteur (2026-08-13) : les deux back-offices n'avaient aucune
navigation croisée, obligeant à taper l'URL à la main pour passer de l'un à l'autre (« on a
l'impression d'aller d'un bout à l'autre du monde »). `AdminShell` et `CmsShell` deviennent des
composants serveur asynchrones : chacun lit, en plus de son propre accès, l'accès à l'AUTRE
back-office (`readCmsAccess()` côté admin, `readAdminAccess()` côté CMS — les deux fonctions
existaient déjà, `AdminShell`/`CmsShell` ne les appelaient simplement pas l'une l'autre) et décide
d'afficher ou non le lien croisé en conséquence.

**Pourquoi deux espaces de permissions distincts, et comment le lien les traverse.** `cms.read` (0058)
et les permissions `AdminPermission` (`content.publish`, `profiles.read`, etc., 0076) sont deux
listes fermées indépendantes, vérifiées par deux RPC différentes (`get_my_cms_permissions()` /
`get_my_admin_permissions()`) : un `cms_editor` peut n'avoir aucune permission d'administration, et un
`content_manager` peut ne pas avoir `cms.read`. Le lien croisé ne présuppose donc jamais l'un depuis
l'autre : il vérifie la permission réelle de la section cible avant de s'afficher, plutôt que de
réutiliser une permission de la section courante comme approximation.

**Piège rencontré et corrigé au déploiement.** Le premier commit (`1e4d9a2`) passait
`cmsLink={cmsLink}` / `adminLink={adminLink}` à `AdminNav`/`CmsNav`, où ces props sont déclarées
optionnelles (`cmsLink?: {...}`). Sous `exactOptionalPropertyTypes: true` (déjà responsable du même
échec sur `PublicHeader.tsx`, D-169), passer explicitement `undefined` à une prop optionnelle est une
erreur de type (TS2375), pas une valeur licite — la prop doit être **absente** de l'objet props, pas
présente avec la valeur `undefined`. Corrigé par le même motif de spread conditionnel
(`{...(cmsLink ? { cmsLink } : {})}`) déjà utilisé pour `PublicHeader.tsx`. Ce piège s'étant
maintenant présenté deux fois sur des props optionnelles passées telles quelles depuis une variable
qui peut valoir `undefined`, c'est le signe qu'il faut soit systématiser le spread conditionnel pour
ce cas précis, soit typer ces props `T | undefined` explicitement plutôt qu'optionnelles — non fait
ici, noté pour une passe de nettoyage ultérieure.

---

## 31. Image de couverture unique pour les actualités — admin, landing et page article (D-172)

| #     | Décision | Source |
| ----- | -------- | ------ |
| D-172 | **ADOPTÉE** — Les actualités reçoivent le même patron d'image que les événements et les opportunités (D-166, migration 0113) : une colonne `news.cover_media_id` (FK optionnelle vers `cms_media_assets`, médiathèque publique `landing-media`), choisie UNE SEULE FOIS depuis `/cms/actualites`, et réutilisée telle quelle sur la carte de la landing (`get_landing_news()`) et sur la page de l'article (`private.news_card()`, `/actualites/[newsId]`). Une seconde colonne, `news.cover_has_text`, évite de dupliquer un titre déjà incrusté dans le visuel. `news.image_path` (texte libre, jamais validé) est déprécié mais conservé. Migration 0117. | `0117_news_cover_media.sql`, `cms/actualites/page.tsx`, `administration/actualites/NewsForm.tsx` / `NewsEditForm.tsx`, `HighlightsSection.tsx`, `actualites/[newsId]/page.tsx` |

**Ce qui a motivé cette décision.** Retour direct du porteur (2026-08-13) : « où est-ce que je mets
l'image liée à l'actualité... il faut aussi penser à mettre l'image pour l'encart de la landing page
(avec les options avec ou sans texte) et l'image de la page de l'article elle-même. pense aussi à voir
comment on gère leur version mobile de manière optimisée pour ne pas qu'on mette 4 images pour un seul
article. » Le module Actualités était le seul des trois modules éditoriaux (actualités, événements,
opportunités) resté sur l'ancien patron `image_path` (texte libre, 0013) : `events`/`opportunities`
avaient déjà migré vers `cover_media_id` en 0113 (D-166). Cette décision applique EXACTEMENT le même
patron au dernier module qui en manquait, et répond en une fois aux quatre volets de la question.

**Principe directeur : une seule image, choisie une seule fois, réutilisée partout.** Il n'existe
qu'un seul champ d'upload (la médiathèque publique, `/cms/mediatheque`) et qu'un seul geste de
rattachement (`set_news_cover_media()`, appelé depuis `/cms/actualites`). Ni le formulaire de
rédaction admin (`NewsForm.tsx`/`NewsEditForm.tsx`), ni la carte de la landing, ni la page article ne
permettent de téléverser un second visuel : la carte lit `get_landing_news().cover`, la page article
lit `private.news_card().cover` — les DEUX résolues par `private.landing_media(cover_media_id)`, la
même fonction que pour les événements et les opportunités. Répond directement au risque nommé par le
porteur (« ne pas mettre 4 images pour un seul article ») : il n'y a physiquement qu'une seule colonne
à remplir, un seul endroit pour le faire. Le formulaire de rédaction admin n'affiche plus qu'un encart
lecture seule (« couverture définie » / « aucune couverture »), avec un lien croisé vers `/cms/actualites`
— même patron de lien croisé que D-171 — pour la gérer.

**Le cas « avec ou sans texte incrusté ».** `news.cover_has_text` (booléen, défaut `false`) distingue
une photo simple d'une affiche qui porte déjà son titre en incrustation. Quand `cover_has_text = true`,
la carte de la landing (`HighlightsSection.tsx`, `NewsCard`) masque visuellement le titre affiché sous
l'image (classe `sr-only`) plutôt que de le dupliquer sur un visuel qui le contient déjà — le titre
reste dans le DOM, pour l'accessibilité et le SEO, jamais retiré. `cover_has_text` n'a aucun effet sur
la page article : le `<h1>` d'une page de contenu reste toujours affiché, qu'il soit ou non redondant
avec l'image, contrairement au titre compact d'une carte.

**Version mobile : aucun second visuel, `sizes` fait le travail.** Aucun champ « image mobile » n'a
été ajouté, contrairement au carrousel héros (`slide.mobile_media_id`, direction artistique
volontairement différente entre desktop et mobile, hors sujet ici). Le patron déjà en place pour les
cartes événement/opportunité est repris tel quel : `StorageImage` (`components/media/StorageImage.tsx`)
encapsule `next/image` avec `fill` et une prop `sizes` par point de rupture (par exemple
`(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 260px` sur la carte landing) ; Next.js génère les
résolutions adaptées à la volée depuis l'unique original stocké dans `landing-media`. Aucun fichier
séparé, aucun second téléversement — ni pour la carte, ni pour la page article. Aucun écran Actualités
n'existe encore dans `apps/mobile` : rien à modifier côté mobile pour l'instant.

**Détail technique : `set_news_cover_media()` diverge du brief initial sur un seul point, documenté
dans la migration elle-même.** La fonction est calquée sur `set_landing_cover_media()` (0113) :
`SECURITY DEFINER`, `search_path` figé, exige `cms.edit`, valide que le média est dans le bucket
`landing-media` avec un `alt_text` non vide. Seul écart : son troisième paramètre, `p_has_text`, est
`default null` (et non `default false`) — `null` signifie « ne pas modifier ce réglage », pas « le
remettre à `false` ». Nécessaire pour que les deux contrôles distincts de l'écran CMS (le sélecteur de
visuel, réutilisation telle quelle de `CoverMediaForm.tsx` déjà utilisé par `/cms/evenements` et
`/cms/opportunites` ; et la case « texte déjà incrusté », à côté) puissent chacun écrire uniquement le
champ qu'ils pilotent, sans lecture préalable de l'état courant côté client. `p_media_id`, lui, garde
exactement la sémantique du brief : pas de défaut, `null` retire explicitement la couverture.

**Ce que cette décision ne fait pas.** Elle ne supprime pas `news.image_path` (conservé, déprécié,
même logique que D-137 pour l'ancien bucket `public-assets` : cesser de s'en servir sans rien casser).
Elle ne touche à aucun champ éditorial (`editorial_status`, `visibility`, `landing_priority`) : le
formulaire de rédaction admin (`content.publish`) garde son périmètre, l'exposition sur la landing
(`cms.publish`/`cms.edit`) garde le sien (D-128), et le choix du visuel rejoint ce second périmètre —
poser une image n'est pas un acte de publication, même raisonnement que D-166.

## 32. Suivi des clics sur les liens d'e-mail Supabase — `/auth/callback` comme point d'instrumentation unique (D-173)

| #     | Décision | Source |
| ----- | -------- | ------ |
| D-173 | **ADOPTÉE** — Chaque atterrissage sur `/auth/callback` (succès ET échec) est journalisé dans `private.auth_link_events`, via `public.log_auth_link_event()` (SECURITY DEFINER, exposée à `anon` ET `authenticated`). Couvre les trois usages réels de ce point d'entrée unique : confirmation de compte (ISE-002), réinitialisation de mot de passe (ISE-003), activation des comptes pré-créés (D-161). Lecture agrégée par type de lien via `public.admin_list_auth_link_events()` (exige `promotions.manage`), affichée sur un nouvel écran dédié `/administration/promotions/liens`. Liste blanche `anon_function_grant` de `private.security_baseline_violations()` étendue à 13 fonctions (`log_auth_link_event` ajoutée). Migrations `0118_auth_link_events.sql` et `0119_auth_link_events_public_rpc.sql` (correctif de schéma, voir plus bas). | `0118_auth_link_events.sql`, `0119_auth_link_events_public_rpc.sql`, `apps/web/src/app/auth/callback/route.ts`, `apps/web/src/app/administration/promotions/liens/page.tsx`, `apps/web/src/lib/admin/queries-auth-link-events.ts`, `apps/web/src/i18n/admin-campaigns.ts` |

**Le trou constaté.** Sur les 252 comptes ISE à provisionner (D-161), seuls 51 avaient reçu une
invitation à ce jour, envoyée via `inviteUserByEmail` (Supabase Auth natif). Le porteur a demandé
comment savoir qui avait *réellement cliqué* sur le lien reçu. Avant cette décision, rien dans
l'application ne journalisait ce clic : le seul proxy disponible était `auth.users.last_sign_in_at`
et `confirmed_at`, interrogés hors application. Ce proxy est aveugle à une distinction pourtant
essentielle pour relancer les bonnes personnes : un compte qui n'a **jamais cliqué** le lien et un
compte qui a **cliqué mais dont le lien était déjà invalide ou expiré** aboutissent tous deux au même
état final (`invited_and_signed_in = false`). Sans ce suivi, impossible de savoir s'il faut relancer
un e-mail (lien jamais vu) ou renvoyer un lien frais (lien vu mais mort).

**Pourquoi `/auth/callback` est le bon — et le seul — point d'instrumentation.** C'est l'unique
endroit de l'application où atterrit un clic sur un lien d'e-mail émis par Supabase Auth, quel que
soit son motif (confirmation, réinitialisation, invitation) et quel que soit son format (`?code=`
PKCE ou `?token_hash=&type=` classique). Toute autre approche (journaliser au moment de l'envoi,
scruter les logs Supabase) mesurerait l'envoi ou la remise, pas le clic réel de l'utilisateur.
Instrumenter cet unique point d'entrée capture les trois usages en une seule fois, sans dupliquer la
logique à chaque écran d'origine.

**Pourquoi les échecs sont journalisés aussi, pas seulement les succès.** C'est le cœur de la
décision : journaliser uniquement les succès aurait reproduit exactement le même angle mort que
`auth.users.last_sign_in_at` (un échec et une absence de clic restent indistinguables). En
journalisant CHAQUE atterrissage — `outcome = 'success'` ou `'error'`, avec le `error.code` Supabase
le cas échéant —, la ligne `(link_type = 'invite', outcome = 'error')` devient la preuve directe
qu'un destinataire a cliqué mais que le jeton était déjà mort, distincte de l'absence totale de ligne
(jamais cliqué).

**Schéma et sécurité.** La table vit dans `private` (D-16 : jamais exposée à l'API publique), avec
un `CHECK` fermé sur `link_type` (`signup`/`invite`/`magiclink`/`recovery`/`email_change`/`email`/
`code`) et sur `outcome` (`success`/`error`). `user_id` référence `auth.users(id) on delete set null`,
nullable : un jeton déjà invalide ne résout jamais personne. La fonction d'écriture valide les mêmes
listes fermées en PL/pgSQL avant l'insertion (défense en profondeur, au cas où le `CHECK` seul
laisserait passer une erreur moins lisible).

**Détail technique : la fonction d'écriture a dû être déplacée de `private` vers `public` en cours de
route (migration 0119, correctif de 0118).** Le brief initial prévoyait `private.log_auth_link_event`
avec `GRANT EXECUTE` à `anon`. Un test fonctionnel (`set role anon; select
private.log_auth_link_event(...)`) a immédiatement révélé le problème : `anon` n'a pas `USAGE` sur le
schéma `private` (`has_schema_privilege('anon', 'private', 'USAGE')` renvoie `false`), donc l'appel
échoue par `permission denied for schema private` avant même d'atteindre le corps de la fonction —
et PostgREST, qui route `supabase.rpc()`, n'expose de toute façon que le schéma `public` (vérifié :
aucune fonction `private.*` n'est appelée en RPC ailleurs dans `apps/web`). Le même appel aurait
échoué en production. Migration 0119 : la fonction devient `public.log_auth_link_event` (même corps,
mêmes `GRANT`), la TABLE reste `private.auth_link_events` — seul le point d'entrée RPC change de
schéma, la donnée reste hors de portée de l'API publique. Reproduit ensuite avec succès :
`set role anon; select public.log_auth_link_event('invite', 'success', null, null);` insère bien une
ligne, supprimée immédiatement après (pas de donnée de test laissée en base).

**La limite assumée.** Ce suivi capture le clic à partir du moment où il atteint `/auth/callback` —
c'est-à-dire une fois que Supabase a reçu la requête et tente de valider (ou refuse de valider) le
jeton. Il ne capture PAS les ouvertures d'e-mail ni les clics mesurés en amont par Resend lui-même
(pixel d'ouverture, clic sur le lien avant redirection), faute d'accès aux réglages du compte Resend
(webhook non configuré à ce jour). Si le porteur souhaite un jour ce niveau de détail supplémentaire
(ouverture avant clic, taux d'ouverture), il faudrait l'activer séparément côté tableau de bord Resend
et le brancher à un nouveau webhook — hors périmètre de cette décision, qui répond au besoin exprimé
(qui a cliqué, et le lien a-t-il fonctionné) sans dépendance externe supplémentaire.

**Placement de l'écran admin : un nouvel écran dédié, pas une greffe sur la fiche campagne.** Les
événements de `private.auth_link_events` sont une vue GLOBALE de la plateforme — tous types de liens,
toutes promotions, campagnes ou invitations individuelles (ISE-070) confondues — alors que la fiche
campagne existante (`/administration/promotions/[promotionId]/campagnes/[campaignId]`, SA-013→015)
exige un `campaignId` précis et affiche des statistiques propres à CETTE campagne. Y greffer un
résumé global aurait été trompeur : le lecteur aurait raisonnablement associé les chiffres à la
campagne affichée, alors qu'ils couvrent toute la plateforme. Un écran séparé,
`/administration/promotions/liens` (même permission `promotions.manage`, même thème fonctionnel),
évite cette confusion. Pas d'entrée dans la navigation principale — même choix que les sous-écrans
`campagnes` et `invitations`, déjà accessibles uniquement depuis la liste des promotions (SA-008) —
un lien y a été ajouté à côté du lien existant vers les signalements.

---

## 33. Image de couverture sur les pages de détail — événement et opportunité rejoignent l'actualité (D-174)

| # | Décision | Source |
| --- | --- | --- |
| D-174 | **ADOPTÉE** — `private.event_card()` et `private.opportunity_card()` projettent désormais une clé `cover`, résolue par `private.landing_media(cover_media_id)` — la même fonction que `get_landing_events()` et `get_landing_opportunities()`. Les pages `/evenements/[eventId]` et `/opportunites/[opportunityId]` affichent ce visuel en tête, et n'affichent rien si aucune couverture n'est posée. Extension au mobile pour l'opportunité (`OpportunityDetailScreen`) ; aucun écran de détail d'événement n'existe encore côté mobile. Aucun champ « image mobile » n'est créé. | `0125_detail_cover_media.sql`, `content-view.ts`, `opportunities-view.ts`, `evenements/[eventId]/page.tsx`, `OpportunityDetailView.tsx`, `apps/mobile/src/lib/media.ts` |

**Le même écart que celui corrigé pour les actualités, à deux endroits de plus.** `cover_media_id`
existe sur `events` et `opportunities` depuis `0113` (D-166), est choisi dans `/cms/evenements` et
`/cms/opportunites`, et alimente déjà les cartes de la page d'accueil. Mais les fonctions qui servent
les **pages de détail** ne le projetaient pas : le visuel était choisi, stocké, payé en espace de
stockage — et jamais montré à l'endroit où il aurait le plus de sens. Exactement le constat qui avait
motivé D-172 pour l'actualité. Les deux fonctions sont recréées à l'identique de leur définition
d'origine (`0074` et `0056`), à la seule différence de la clé ajoutée : la migration a été produite
par transformation programmatique du fichier source, pas par retranscription manuelle, précisément
parce que ces fonctions font 7 à 8 Ko chacune.

**Une seule image par contenu, toujours.** Aucun second téléversement « version mobile » n'est
introduit, ni ici ni ailleurs : `StorageImage` encapsule `next/image` en `fill` avec une prop `sizes`
par point de rupture, et Next.js génère les résolutions à la volée depuis l'unique original. C'est la
réponse directe à la demande du porteur de ne pas « mettre 4 images pour un seul article » (D-172).
Le carrousel héros reste la seule exception, avec son `mobile_media_id` distinct — direction
artistique volontairement différente entre desktop et mobile, et non une contrainte technique.

---

## 34. Encarts de « À la une du réseau » entièrement cliquables — la connexion reste exigée pour le détail (D-175)

| # | Décision | Source |
| --- | --- | --- |
| D-175 | **ADOPTÉE** — Les quatre encarts de la zone « À la une du réseau » (actualité, ISE du jour, événement, opportunité) deviennent cliquables **dans leur intégralité**, chacun vers sa page de détail. Motif d'accessibilité retenu : le **lien étendu** — le CTA existant reste l'unique `<a>` de la carte, son pseudo-élément `::after` en `absolute inset-0` couvre l'`<article>` passé en `relative`. Aucune page publique de détail n'est créée : un visiteur non authentifié est redirigé vers `/connexion?redirectTo=…` par `ProtectedLink`, comportement **explicitement voulu par le porteur**. | `HighlightsSection.tsx`, `entity-routes.ts`, `i18n/public.ts` |

**Le bug de fond : un commentaire périmé rendait deux cartes inertes.** `entityRoute()` renvoyait
`null` pour `news` et pour `event`, au motif d'un commentaire affirmant que les écrans ISE-092→096
n'existaient pas. Ils existent depuis : `apps/web/src/app/actualites/[newsId]/page.tsx` et
`apps/web/src/app/evenements/[eventId]/page.tsx`. Conséquence, la carte Actualité et la carte
Événement n'affichaient **aucun** lien — seulement la mention « Consultable depuis l'espace membre ».
Deux cartes sur quatre étaient donc des impasses, non par choix mais par oubli de mise à jour d'un
garde-fou devenu faux. La fonction et son commentaire sont corrigés et datés.

**Pourquoi le lien étendu plutôt que la carte-lien.** Envelopper la carte entière dans un `<Link>`
aurait produit un lien imbriqué dans un lien sur les deux cartes qui portaient déjà un CTA
(Opportunité, ISE du jour) — HTML invalide. Le lien étendu garantit **un seul `<a>` par carte**, un
nom accessible court et explicite (« Voir l'opportunité : <titre> ») plutôt que la récitation de tout
le contenu de la carte par un lecteur d'écran, et laisse le texte sélectionnable. Survol et
`focus-visible` sont signalés sur la carte entière. Quand `entityRoute()` renvoie légitimement `null`
(cas `expertise`, identifiant vide), la carte reste un `<article>` inerte : jamais de lien mort.

**Le mur de connexion est assumé, pas subi.** La question a été posée explicitement au porteur, avec
trois options : créer des pages publiques de détail, garder la connexion obligatoire, ou un teaser
public suivi d'un contenu réservé. Il a tranché pour la connexion obligatoire. La conséquence est
donc connue et acceptée : un visiteur anonyme qui clique sur un encart de la vitrine atterrit sur
l'écran de connexion. Aucun `page.tsx` n'existe sous `apps/web/src/app/(public)/` — la seule page
publique reste `/`.

---

## 35. Portrait public de l'« ISE du jour » — D-135 est révisée, mais par un consentement neuf, pas par réinterprétation de l'ancien (D-176)

| # | Décision | Source |
| --- | --- | --- |
| D-176 | **ADOPTÉE, révise D-135** — L'encart « ISE du jour » peut afficher le portrait du membre. Ce portrait n'est PAS l'avatar du bucket privé : c'est un **portrait public distinct**, déposé par le membre lui-même sous `landing-media/membres/<profile_id>/`, et couvert par un **consentement dédié** `ise_profiles.allow_public_photo` (booléen, faux par défaut), séparé de `allow_public_feature`. Ordre de priorité à l'affichage : visuel éditorial choisi par l'admin (D-165), sinon portrait public consenti, sinon monogramme d'initiales (comportement D-135 inchangé). L'écran `/mon-profil/vitrine-publique` expose la brève description publique (`public_summary`, 40–400 caractères, contrainte préexistante de `0057`) et les deux consentements, chacun libellé sans ambiguïté. | `0120_public_photo_consent.sql`, `0123_featured_profile_public_photo_rule.sql`, `mon-profil/vitrine-publique/`, `i18n/profile-showcase.ts` |

**Ce que D-135 refusait, et pourquoi la révision ne le rétablit pas.** D-135 écartait la photographie
pour trois motifs : le consentement existant portait sur un teaser **textuel** et non sur un
portrait ; une image publiée sur le web ouvert est irréversible (CDN, moteurs, archiveurs) ; la
maquette PUB-001 ne montrait aucun portrait. Le porteur a demandé le portrait, en indiquant lui-même
« modifié le consentement ». La révision suit donc la voie que D-135 laissait ouverte — **obtenir le
bon consentement** — et non celle qu'elle condamnait, à savoir réutiliser une case cochée pour un
usage qu'elle ne décrivait pas. Le motif (1) est traité par une colonne neuve et un libellé explicite ;
le motif (2) reste vrai et est dit au membre au moment du choix ; le motif (3) devient un écart
assumé à la maquette, tranché par le porteur.

**Un point a été signalé au porteur et mérite d'être répété ici.** Le raisonnement « il faut être
connecté pour voir le détail du profil » ne protège pas la photo : la page d'accueil est publique,
donc le médaillon est visible par n'importe quel visiteur. C'est le **clic** vers la fiche profil qui
reste réservé aux membres, pas l'image. C'est précisément pour cela qu'un consentement réel était
nécessaire plutôt qu'une simple réutilisation de l'existant.

**Pourquoi un dépôt distinct plutôt qu'une copie de l'avatar.** L'option « copier l'avatar de
`avatars` vers `landing-media` au moment du consentement » s'est révélée **irréalisable en SQL** :
PostgreSQL n'a aucun accès aux octets stockés côté S3. Plutôt que de la simuler, un cinquième préfixe
d'usage `membres/<profile_id>/` a été ouvert dans le bucket public, où le membre dépose lui-même son
portrait public. Le bucket `avatars` reste privé et intouché, et il n'existe aucune copie à
resynchroniser. Les politiques Storage limitent chaque membre à son propre préfixe **et** sont
conditionnées au consentement. Un déclencheur retire l'objet et remet les colonnes à `NULL` dans les
trois cas de sortie : retrait du consentement, suppression de compte (D-19), remplacement du portrait.

**Limite assumée, à ne pas oublier.** Supabase interdit le `DELETE` direct sur `storage.objects` : le
déclencheur retire l'objet du **service** (URL en 404) sans effacer les octets côté S3, ce que la base
ne peut pas faire. Le retrait demandé par le membre depuis l'interface, lui, appelle l'API Storage et
efface réellement. Reste non couvert : l'effacement physique lors d'une suppression de compte. Un
nettoyage Storage périodique reste à brancher — c'est un manque nommé, pas masqué (même exigence de
franchise que D-133 sur les variantes d'images non générées). Suite de tests :
`supabase/tests/rls/0040_public_photo_consent_suite.sql`, 31 cas, 0 échec sur la base réelle.

---

## 36. File de programmation des encarts « À la une » et rotation automatique de l'ISE du jour (D-177)

| # | Décision | Source |
| --- | --- | --- |
| D-177 | **ADOPTÉE** — Les encarts Actualités, Événements et Opportunités reçoivent une **file de passage ordonnée** : plusieurs contenus programmés à l'avance, avec durée de passage réglable (7 jours par défaut), gérée par `add_landing_queue_entry()`, `move_landing_queue_entry()`, `remove_landing_queue_entry()`, `list_landing_queue()` et `set_landing_queue_default_days()`, appliquée par la tâche `pg_cron` `cms_apply_landing_queue` (toutes les 10 minutes). Écran dédié `/cms/programmation/a-la-une`. L'« ISE du jour » suit un mécanisme distinct : rotation automatique quotidienne (`cms_select_featured_profile` à 5 h 30, `cms_publish_featured_profile` à 6 h 00), équitable par promotion, avec départage pseudo-aléatoire, et épinglage manuel prioritaire. | `0121_landing_queue_and_featured_rotation.sql`, `0124_landing_queue_passage_duration.sql`, `cms/programmation/a-la-une/`, `lib/cms/landing-queue.ts` |

**Ce qui manquait réellement.** `cms_publication_schedule` existait déjà, mais un index unique partiel
`(entity_type, entity_id) WHERE status='pending'` n'y autorisait **qu'une seule bascule en attente par
contenu** : c'était une date de publication, pas une file. Rien n'y disait quel contenu occupe
l'encart, ni dans quel ordre. La demande du porteur — « mettre un certain nombre d'articles dans une
liste avec date de passage, pour ne pas venir le faire à chaque fois » — supposait une notion d'ordre
et de succession qui n'existait nulle part. La file s'appuie sur `cms_content_overrides` (épinglage),
mécanisme déjà en place, plutôt que sur une table concurrente.

**Rotation, pas tirage au sort.** Le porteur demandait « un affichage aléatoire ». Le mécanisme livré
est une **rotation équitable par promotion**, le hasard n'intervenant qu'en départage
(`digest(jour || profil_id, 'sha256')`). C'est un écart délibéré à la lettre de la demande : un tirage
purement aléatoire peut afficher deux fois la même personne en une semaine et ignorer une promotion
entière pendant des mois, ce qui dessert exactement l'objectif d'un annuaire d'anciens. Le délai
minimal entre deux passages d'un même profil (`min_days_between_features`, 90 jours) et l'intervalle
de rotation (`rotation_interval_days`) restent réglables depuis `/cms/ise-du-jour`.

**D-128 et D-129 tiennent.** La file ne touche que `landing_visibility` et l'épinglage : jamais
`news.editorial_status`, `events.status` ni `opportunities.status` — programmer une parution reste
distinct de valider un contenu. Et aucune tâche n'est déclarée « planifiée » sans exister réellement :
les six tâches (`cms_apply_landing_queue`, `cms_expire_content`, `cms_publish_scheduled`,
`cms_select_featured_profile`, `cms_publish_featured_profile`, `notifications_process_domain_events`)
ont été vérifiées dans `cron.job`, toutes actives, toutes en `succeeded` sur leurs dernières exécutions.

**Correctif de cohérence : `require_avatar` visait une colonne morte.** La règle
`cms_featured_profile_rules.require_avatar` exigeait un `avatar_path` — colonne du bucket privé, non
publiable, et renseignée sur **0 profil des 260**. La règle rendait donc la sélection structurellement
impossible tout en paraissant fonctionner. Elle est remplacée par `require_public_photo`, qui porte
sur le portrait public consenti de D-176. La clé i18n correspondante a suivi
(`ruleRequirePublicPhoto`).

**Le vivier est vide, et c'est normal à ce stade.** Au moment de la livraison : 0 profil avec
`allow_public_feature`, 0 avec `allow_public_photo`, 0 avec `public_summary` renseigné — donc 0 profil
éligible. Le mécanisme tourne à vide tant que les membres n'ont pas rempli leur vitrine publique. Ce
n'est pas une panne : `get_landing_featured_profile()` renvoie `null` et la page affiche un repli
explicite (carte pointillée invitant à réclamer son profil), sans jamais inventer d'identité.

---

## 37. Piliers « Un réseau conçu pour être utile » — cliquables, et un conteneur d'image qui tient (D-178)

| # | Décision | Source |
| --- | --- | --- |
| D-178 | **ADOPTÉE** — Les quatre piliers reçoivent une destination : Connecter → recherche (déjà câblé), Entraider → appels au réseau, Collaborer → projets, Impacter → candidatures. Le conteneur d'image est corrigé en boîte `relative aspect-[16/9]`, alignée sur le `MediaFrame` de « À la une » et sur le hint CMS (1600 × 900). Aucune destination n'est inventée hors de la liste blanche existante. | `0122_landing_pillars_link_targets.sql`, `NetworkSection.tsx` |

**Trois piliers sur quatre n'étaient pas cliquables.** Le support existait depuis `0114` (D-168) —
colonne `link_target`, liste blanche, enveloppe `ProtectedLink` — mais le seed ne câblait que
`connecter → search`. Les trois autres piliers étaient rendus en `<div>` inerte. La migration ne
renseigne que les lignes où `link_target is null`, pour ne jamais écraser un choix ultérieur de
l'administrateur.

**Un défaut d'affichage qui ne se serait vu qu'au premier visuel posé.** `StorageImage` rend une image
en `fill`, or `NetworkSection` la posait directement dans la carte avec `aspect-video w-full` sur
l'image elle-même, sans conteneur `relative`. L'image se serait positionnée hors de la carte et
n'aurait réservé aucune place — violation directe de D-138, qui exige que la place soit réservée par
le conteneur et non par les dimensions intrinsèques. Le défaut était invisible jusqu'ici pour une
seule raison : **aucun pilier n'a de visuel**, `media_id` étant `null` sur les quatre. Sans image,
aucun cadre n'est rendu et la mise en page reste intacte.

**Ce qui reste à la main du porteur.** Les visuels des piliers, comme ceux des actualités, événements
et opportunités, doivent être téléversés dans la médiathèque puis choisis dans `/cms/piliers`. Aucun
fichier image n'est fabriqué par le code : la chaîne complète (médiathèque → `set_landing_pillar` →
`get_landing_pillars()` → rendu) a été vérifiée de bout en bout, elle attend son contenu.

---

## 38. Dépôt de photo de profil ouvert — D-117 est levée par la disparition de son motif (D-179)

| # | Décision | Source |
| --- | --- | --- |
| D-179 | **ADOPTÉE, lève D-117** — Le dépôt de photo de profil est ouvert sur `/mon-profil/en-tete` : formulaire de téléversement, aperçu, remplacement et retrait. Validation par **signature binaire** du fichier, bornes lues dans le bucket réel (2 Mo, `png/jpeg/webp` — l'AVIF est refusé, accepté par `landing-media` mais pas par `avatars`). Écriture par `UPDATE` direct sur `ise_profiles.avatar_path` sous RLS, **sans RPC** : `authenticated` détient déjà ce privilège, borné par `ise_profiles_update_own`, et le dépôt d'octets est déjà gardé par `ise_avatars_write` (0027). Le champ `photo` rejoint les réglages de visibilité à quatre niveaux (défaut `members`, D-73/D-74). | `0126_avatar_path_scope.sql`, `mon-profil/en-tete/{page.tsx,actions.ts,AvatarForm.tsx,ProfileHeaderForm.tsx}`, `i18n/profile.ts` |

**Pourquoi D-117 tombe sans être contredite.** D-117 ne disait pas que la photo était indésirable :
elle disait qu'un bouton « Changer la photo » sans écran de téléversement derrière serait décoratif
(MASTER PROMPT §113). Le motif était l'absence de mécanisme, pas un refus de la fonction. Ce
mécanisme existe depuis `0120` (D-176) : Server Action lisant le `File` du `FormData`, vérification
de signature binaire, `storage.upload()` vers un chemin neuf, puis écriture de la référence. Il a été
transposé au bucket `avatars`, qui attendait depuis `0027`. Le motif ayant disparu, la décision
tombe : c'est le fonctionnement normal d'un écart assumé, pas un revirement.

**Le vrai trou trouvé en chemin, et qui n'avait rien à voir avec l'interface.** `avatar_path` était
une colonne texte **sans contrainte de portée** : rien n'empêchait un membre d'y enregistrer le chemin
d'un **autre** membre. La politique Storage protégeait l'écriture des octets, pas le contenu de la
colonne qui les référence. `0126` ajoute
`CHECK (avatar_path is null or avatar_path like id::text || '/%')`, calquée sur
`ise_profiles_public_photo_path_scope` posée en `0120`. Défaut préexistant, invisible tant qu'aucun
écran n'écrivait dans cette colonne — c'est-à-dire exactement tant que D-117 tenait.

**Ordre des opérations au remplacement et au retrait.** Remplacement : téléverser le nouvel objet,
puis mettre à jour la colonne, puis seulement supprimer l'ancien objet — on n'efface jamais qu'un
objet déjà déréférencé. Si l'`UPDATE` échoue, l'objet neuf est retiré : pas d'orphelin. Retrait :
octets d'abord, colonne ensuite, même motif que `withdrawPublicPhotoAction`.

**Effet de bord attendu sur la complétion.** Le bloc « Photo » comptait déjà pour 5 points sur 100 et
renvoyait vers `/mon-profil/en-tete` — un renvoi jusqu'ici **insatisfiable**, puisque l'écran de
destination annonçait la fermeture. Le score comportait donc un point structurellement inatteignable.
Il devient atteignable sans aucun changement de règle : le déclencheur `trg_completion_ise_profiles`
couvrait déjà `avatar_path`.

**Limite assumée : le mobile ne dépose pas.** `apps/mobile/package.json` ne contient ni
`expo-image-picker` ni `expo-file-system` — aucun sélecteur d'image n'est disponible. La dépendance
n'a pas été ajoutée de force. `HeaderEditScreen` fait ce qui est faisable : **afficher** la photo (URL
signée) et la **retirer**, plus le réglage de visibilité ; un texte indique que le dépôt se fait
depuis le web. Manque nommé, pas masqué.

---

## 39. Dépôt de CV et de documents de profil ouvert (D-180)

| # | Décision | Source |
| --- | --- | --- |
| D-180 | **ADOPTÉE** — Nouvel écran `/mon-profil/documents` : liste des documents déposés avec téléchargement par URL signée (5 minutes), dépôt, désignation d'un document principal, suppression. Quatre RPC en `SECURITY DEFINER`, `search_path` figé, propriétaire vérifié par `private.current_profile_id()`, auditées, `revoke … from public, anon` : `record_my_document()`, `delete_my_document()`, `set_my_primary_document()`, et `list_my_documents()` étendue par **ajout pur** de quatre clés (`storage_path`, `mime_type`, `size_bytes`, `updated_at`), sans en retirer aucune. Aucune colonne ni contrainte ajoutée à `profile_documents` : le modèle de `0008` est respecté tel quel. | `0127_profile_documents_write_api.sql`, `mon-profil/documents/`, `i18n/profile-documents.ts`, `lib/queries/profile-documents.ts`, `ApplyForms.tsx` |

**Encore un module dont seule l'interface manquait.** Table `profile_documents` (`0008`) avec sa
contrainte de préfixe, politique `profile_documents_own` (`0041`), bucket privé `profile-documents`
et sa politique d'écriture (`0027`), RPC de lecture `list_my_documents` : tout existait, sauf toute
possibilité d'**écrire**. Le bucket contenait 0 objet et la table 0 ligne — non par manque d'usage,
mais parce qu'aucun chemin n'y menait.

**Ce qui existait a été exposé, pas réinventé.** `is_primary` était déjà en place, avec un index
unique partiel sur `(profile_id, document_type)` : la notion de « CV principal » n'a pas eu à être
créée, seulement rendue accessible. De même, `allowed_mime_types` du bucket était **déjà** restrictif
(PDF, docx, xlsx, pptx, png, jpeg, webp, 10 Mo) : cette liste a été recopiée à l'identique côté RPC et
côté application plutôt que redéfinie — une seule source de vérité, celle du bucket.

**Un piège de nommage à retenir.** `profile_documents.storage_path` porte le préfixe du bucket, alors
que `storage.objects.name` ne le porte pas. Les deux valeurs se ressemblent et ne sont pas
interchangeables ; toute suppression ou signature d'URL qui les confondrait échouerait
silencieusement.

**Suppression : conséquence assumée et annoncée.** Les clés étrangères de `0008` (`SET NULL` /
`CASCADE`) détachent le document des candidatures déjà envoyées. Plutôt que de masquer cet effet,
`delete_my_document()` renvoie le nombre de candidatures concernées et l'écran l'annonce avant
confirmation.

**Le message de la candidature devient vrai.** « Le dépôt de document n'est pas encore ouvert »
(`ApplyForms.tsx`, `i18n/opportunities.ts`) était devenu faux : il est remplacé par un renvoi vers
« Mes documents ». La règle produit, elle, ne change pas — on peut toujours candidater sans CV,
le profil ISE étant joint. C'était une règle, pas une limitation technique, et elle survit à
l'ouverture du module.

**Limite assumée : aucune analyse antivirale.** Aucun antivirus n'est déployé sur ce projet. Seule
une vérification de **signature binaire** est faite : elle empêche un exécutable déguisé en PDF, elle
ne dit rien des macros d'un document Office. Le manque est écrit à trois endroits — commentaire de
migration, commentaire d'action, et texte à l'écran — plutôt que supposé connu (même exigence de
franchise que D-133). N'est pas branché non plus le nettoyage périodique des octets orphelins si le
retrait Storage échoue après la suppression en base : même limite qu'en `0120`, à traiter d'un seul
tenant le jour où un balayage Storage sera mis en place.

**Modules encore fermés après ce lot, pour mémoire.** Pièces jointes de la messagerie, pièces jointes
du support et du signalement, justificatif de vérification : les trois buckets existent
(`message-attachments`, `support-attachments`, `verification-documents`, tous privés, tous à 0 objet),
les interfaces manquent, et l'absence d'antivirus pèse plus lourd sur ces canaux — un document reçu
d'un tiers n'est pas un document que l'on dépose pour soi. Export de mes données
(`parametres/mes-donnees`) : rien n'existe, ni écran ni backend.
