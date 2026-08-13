# Journal des décisions — Compétences ISE

Ce document consigne tout arbitrage rendu lorsque les sources se contredisent, conformément au
MASTER PROMPT §2 (hiérarchie : sécurité > règles du MASTER PROMPT > maquettes & spécifications >
détails visuels) et §114 (« prendre une décision raisonnable, la documenter, continuer »).

Statut des décisions : **ADOPTÉE** (appliquée au code) · **PROVISOIRE** (à confirmer par le métier)
· **OUVERTE** (bloquante, en attente).

---

## 0. Décisions de cadrage (validées par le porteur du projet, 07/08/2026)

| #    | Décision | Justification |
| ---- | --- | --- |
| C-01 | **Un seul projet Supabase**, utilisé directement comme Production. | Choix explicite du porteur. Mitigation : 100 % des changements DB passent par des migrations versionnées et rejouables ; aucun `DROP` destructif hors migration documentée ; l'ajout ultérieur d'un projet `staging` reste possible sans refonte. |
| C-02 | **Web d'abord, mobile ensuite.** Le monorepo et les packages partagés (`domain`, `validation`, `design-tokens`, `db-types`) sont créés dès la Phase 1 pour que `apps/mobile` n'ait rien à réécrire. | Évite de déboguer deux fois la même règle métier ; MASTER PROMPT §4 et §53. |
| C-03 | **Push direct sur `main`** du dépôt `blyped/ise` pendant la construction initiale, avec CI GitHub Actions bloquante (lint, typecheck, tests, build). Passage au modèle par PR une fois les Phases 0–2 stabilisées. | Choix explicite du porteur. |
| C-04 | Le code vit dans `C:\Services\Ise\app` sur le poste et dans `blyped/ise` sur GitHub. Les documents de spécification restent à la racine `C:\Services\Ise` et ne sont pas versionnés dans le dépôt applicatif. | Sépare les sources métier du livrable logiciel. |
| C-05 | **Le back-office OPS (OPS-001 → OPS-028) est abandonné** — décision du porteur du projet, 08/08/2026 (« trop technique »). Les 28 maquettes OPS ne seront pas implémentées. La supervision reste assurée par les outils natifs Supabase (logs, advisors) et Vercel (observabilité), par les contrôles internes `security_baseline_violations()` / `storage_baseline_violations()` et par `get_cms_automation_status()`. Les permissions `ops.read` / `ops.manage` et le rôle `ops` restent en base, inoffensifs et réutilisables si la décision est revue, mais aucun écran ne les consomme. | Choix explicite du porteur. Cohérent avec le MASTER PROMPT §41, qui demandait déjà de ne pas construire « un deuxième gigantesque back-office technique » : Supabase et Vercel couvrent le besoin V1. |
| C-06 | **L'import en masse d'annuaire (SA-040, SA-041, SA-042, SA-044, SA-045) est abandonné** — décision du porteur du projet, 09/08/2026. L'unique jeu de données (recensement Excel de 275 réponses, 255 profils après dédoublonnage) a été importé directement en migration (`0088_import_ise_census`), en contournant volontairement ce module ; aucun autre import de masse n'est prévu, toute intégration future se fait par création de profil individuel. Les écrans de téléversement, mapping/anomalies, revue de doublons et campagnes de complétude sont retirés du code web. SA-043 (Profils incomplets) est conservé — utile indépendamment de l'origine du profil — et déplacé de `/administration/imports/profils-incomplets` vers `/administration/profils-incomplets`. Les tables (migration `0017`) et fonctions `admin_*` du pipeline d'import (migration `0080`) restent en base, inoffensives (SECURITY DEFINER + RLS), non consommées par aucun écran ; leur suppression est un nettoyage optionnel de la Phase 8-9 (dette technique, pas un risque de sécurité). La permission `imports.execute` n'est plus consommée par aucun écran ; `imports.review` continue de protéger SA-043. | Choix explicite du porteur, formulé après l'import réel du recensement ISE : le module d'import en masse n'a jamais servi (l'import a été fait en migration directe) et ne servira plus, il ne doit pas rester comme surface de produit décorative (MASTER PROMPT §113). |

---

## 1. Source de vérité en cas de contradiction

| #    | Décision | Justification |
| ---- | --- | --- |
| D-01 | **ADOPTÉE** — En cas de conflit, l'ordre de préséance est : (1) MASTER PROMPT ; (2) **nom de fichier de la maquette** ; (3) document de spécification UI/UX (série 24–35) ; (4) document de spécification fonctionnelle (série 0–23). | Le MASTER PROMPT §2 fixe la hiérarchie. Les maquettes livrées sont l'itération la plus récente et la plus concrète : leurs noms de fichiers tranchent tous les conflits de numérotation d'écrans. |
| D-02 | **ADOPTÉE** — Les documents UI/UX (24–35) l'emportent sur les documents fonctionnels (0–23) sur les détails d'interface ; l'inverse s'applique aux règles métier. | Les documents UI/UX sont postérieurs et se présentent comme « spécification finale ». |

### Écart assumé sur ISE-007

| #    | Décision | Justification |
| ---- | --- | --- |
| D-03 | **ADOPTÉE** — La maquette `ISE-007_Verification_Email_Etape_1` montre la saisie d'un code à 6 chiffres. L'écran livré à `/reclamer-mon-profil/verification` affiche à la place **l'état réel de la réclamation** : approuvée automatiquement, ou en attente de revue. Aucun code n'est envoyé. | L'adresse du compte est déjà confirmée par Supabase Auth à la création du compte (ISE-002) : redemander un code vérifierait une seconde fois la même chose. Ce qui reste à vérifier, c'est la **correspondance** entre l'adresse du compte et l'adresse historique du profil — ce que la base fait sans interaction (D-105). Envoyer un code pour simuler une vérification déjà faite serait une étape décorative (MASTER PROMPT §27 et §113). La maquette reste applicable telle quelle au premier écran de l'onboarding (ISE-008 → ISE-014) si le métier veut une double authentification à ce moment-là. |

### Conflits de numérotation d'écrans tranchés par D-01

Les séries Mentorat (ISE-078→083), Communautés (ISE-084→087) et Projets (ISE-088→091) étaient
numérotées différemment dans les documents fonctionnels et UI/UX. **Les noms de fichiers des
maquettes font foi** et sont repris tels quels dans `docs/screen-traceability-matrix.md`.
Aucune renumérotation (MASTER PROMPT §91).

---

## 2. Modèle de données

| #    | Décision | Justification |
| ---- | --- | --- |
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

| #    | Décision | Justification |
| ---- | --- | --- |
| D-30 | **ADOPTÉE** — La nomenclature des permissions est **celle du MASTER PROMPT §39** (`profiles.read`, `profiles.edit`, `profiles.moderate`, `promotions.manage`, `calls.moderate`, `opportunities.manage`, `communities.manage`, `events.manage`, `content.publish`, `imports.execute`, `imports.review`, `support.manage`, `analytics.read`, `settings.manage`, `audit.read`, `ops.read`, `ops.manage`), étendue au besoin selon le même schéma `<domaine>.<action>`. Les nomenclatures concurrentes des docs 16 et 17 sont écartées. | Le MASTER PROMPT prime (D-01). Deux nomenclatures incompatibles coexistaient, sans aucun code commun. |
| D-31 | **ADOPTÉE** — Rôles V1 : `member`, `student` (sous-rôle membre), `moderator`, `content_manager`, `import_manager`, `support_agent`, `analyst`, `superadmin`, `ops`. L'autorisation se résout **toujours** par `private.has_permission()`, jamais par un test de rôle en dur. | MASTER PROMPT §39. |
| D-32 | **ADOPTÉE** — Les rôles sont portés par `private.user_roles (profile_id, role_id)`, table non exposée à l'API. Aucune donnée d'autorisation dans le JWT applicatif ni dans une table éditable par le membre. | MASTER PROMPT §10 : « les données d'autorisation ne doivent pas dépendre de données modifiables par le client ». |

---

## 4. Recherche et matching

| #    | Décision | Justification |
| ---- | --- | --- |
| D-40 | **ADOPTÉE** — Le barème de référence est celui du **document 22 (Moteur de recherche & Matching), normalisé sur 100** : compétences 40, secteur 15, géographie 15, disponibilité 10, expérience 10, langue 5, promotion 5. Le barème concurrent du doc 5 (qui ajoutait `organisation +10` et dépassait 100) est écarté. | Le doc 22 est le document dédié au moteur ; le doc 5 est une spécification fonctionnelle générale. |
| D-41 | **PROVISOIRE** — Les barèmes de détail absents des documents sont fixés comme suit, centralisés dans `packages/domain/src/matching/weights.ts` (une seule constante, modifiable sans toucher au moteur) : Secteur : exact 15, connexe 9, absent 0. Géographie : pays d'exercice exact 15, pays de résidence exact 12, même sous-région 8, autre 0. Disponibilité : type demandé explicitement ouvert 10, disponible sans correspondance de type 5, indisponible 0 (et exclusion si le membre a désactivé la sollicitation). Multiplicateurs de niveau déclaré : notion 0,40, intermédiaire 0,70, avancé 0,90, expert 1,00, non déclaré 0,75 (valeurs du doc 22). | Le doc 22 énonce les cas sans les chiffrer. Ces valeurs respectent les rapports déjà donnés et sont isolées dans une constante unique pour être recalibrées après les premiers jeux de tests réels. |
| D-42 | **ADOPTÉE** — Labels qualitatifs (MASTER PROMPT §15, aucun pourcentage affiché) : score ≥ 70 → « Très pertinent », 45–69 → « Pertinent », 25–44 → « Profil proche », < 25 → non proposé. Le score numérique n'est jamais renvoyé au client. | MASTER PROMPT §15 interdit l'affichage d'un pourcentage ; les seuils manquaient. |
| D-43 | **ADOPTÉE** — Toute recommandation renvoie au minimum une **raison explicite** (`MatchReason`) issue de données structurées. Un candidat sans aucune raison affichable est exclu du résultat, quel que soit son score. | MASTER PROMPT §16 : « ne jamais produire un matching opaque ». |
| D-44 | **ADOPTÉE** — Pagination **par curseur** (`keyset`) sur `(score DESC, id DESC)` pour le matching et sur `(created_at DESC, id DESC)` pour les listes chronologiques. Taille de page par défaut : 20 (web), 15 (mobile). Maximum 50. | MASTER PROMPT §101 ; aucune taille n'était spécifiée. |
| D-45 | **ADOPTÉE** — Recherche plein texte : `unaccent` + `pg_trgm`, configuration FTS `french`, index GIN sur `profile_search_documents.search_vector` et index GIN trigramme sur les libellés (noms, organisations, compétences). Seuil de similarité trigramme : 0,30. | MASTER PROMPT §21 et §85 (interdiction du `ILIKE '%…%'` non indexé). |
| D-46 | **ADOPTÉE** — Les alias de compétences (89 lignes du doc 20) sont stockés dans `skill_aliases` et résolus **à l'indexation comme à la requête**. Règle anti-collision : un alias de moins de 4 caractères (`IE`, `IV`) n'est résolu que s'il est saisi en majuscules et isolé. Les alias contenant `&` sont normalisés en conservant une forme `et` (`M&E` → `m-e`, `m et e`). | Le doc 20 exige « aucun alias ne pointe vers deux compétences incompatibles » sans donner de règle. |

---

## 5. Machines d'états

| #    | Décision | Justification |
| ---- | --- | --- |
| D-50 | **ADOPTÉE** — Machine d'états des introductions (aucune spécification n'existait) : `requested` → `intermediary_accepted` \| `intermediary_declined` \| `withdrawn` \| `expired`, puis `intermediary_accepted` → `introduced` → `target_responded` → `completed` \| `no_outcome`. Transitions non listées interdites au niveau base (fonction SQL atomique + `CHECK`). | MASTER PROMPT §54 fournit la liste ; les documents ne couvraient pas ISE-041→046. |
| D-51 | **ADOPTÉE** — Chemins d'introduction limités à **un seul intermédiaire** (`demandeur → relation directe → cible`). Aucune exploration de graphe au-delà du degré 1. Le rang des intermédiaires n'utilise que des signaux explicites : relation directe confirmée, organisation commune, promotion commune, projet commun déclaré, disponibilité déclarée « introduction ». | MASTER PROMPT §24 : confidentialité. Le contenu des messages privés n'est jamais analysé. |
| D-52 | **ADOPTÉE** — Clôture d'un appel au réseau : résultat **ternaire** `resolution text CHECK (resolution IN ('resolved','partially_resolved','not_resolved'))`, remplaçant le `boolean resolved_by_network` du doc 17. | Le doc 18 exige « Oui / partiellement / non » ; un booléen ne peut pas le porter. |
| D-53 | **ADOPTÉE** — Projets & consortiums : `draft → recruiting → team_ready → completed \| archived \| failed`. Communautés, promotions et stages : voir `docs/data-model.md`, section « machines d'états ». En cas de listes concurrentes, la liste **la plus fine** est retenue et les valeurs manquantes de l'autre liste y sont mappées. | Deux jeux d'états coexistaient par module ; perdre un état perd une capacité (MASTER PROMPT §41 par analogie). |
| D-54 | **ADOPTÉE** — `alternative_proposed` est **conservé** dans les demandes de mentorat, bien que la spécification UI l'ait supprimé, car les deux documents décrivent la fonction « proposer un autre format ». | Un état supprimé rendrait la fonctionnalité décrite inaccessible. |
| D-55 | **ADOPTÉE** — Aucun statut ne franchit une étape non constatée. En particulier : « candidature envoyée » à un organisme externe n'est jamais posé par un clic dans la plateforme ; l'utilisateur **déclare** lui-même l'état réel. | MASTER PROMPT §27, §29 et §113. |

---
