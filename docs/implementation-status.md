# État d'implémentation — Compétences ISE

**Réécrit le 8 août 2026, actualisé le 9 août 2026 (tranches ISE-024→033, ISE-073→083 et SYS-003/004/007/010), à partir de mesures, pas de déclarations.** Chaque chiffre de ce document
a été relevé sur le dépôt (`find`, `pnpm test`, `pnpm build`) ou sur la base réelle (requêtes SQL
sur le projet Supabase). Format imposé par le MASTER PROMPT §106. Un module n'est jamais déclaré
terminé sans satisfaire la Definition of Done (§107, §108).

Légende : ✅ terminé — 🟡 partiel — ⬜ non démarré — ⬛ sans objet

---

## 0. Les faits mesurés

| Mesure                                                     | Valeur relevée                                                                                                                        |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Routes web (`page.tsx`)                                    | **178** (+ `auth/callback`, `api/cms/revalidation-landing`) = **181** (D-166 : `/cms/opportunites` ; D-168 : `/cms/piliers`)           |
| dont routes publiques                                      | 6 (`/`, `/connexion`, `/creer-compte`, `/mot-de-passe-oublie`, `/reinitialiser-mot-de-passe`, + `/auth/callback`)                     |
| dont routes membre authentifiées                           | 158                                                                                                                                   |
| dont routes CMS (`/cms/**`)                                | 15 (+ `/cms/opportunites`, D-166 ; + `/cms/piliers`, D-168)                                                                            |
| Écrans couverts par une route réelle                       | **121 sur 199**                                                                                                                       |
| Migrations dans le dépôt                                   | **82** fichiers (`0001` → `0085`, **`0069`, `0078`, `0079` n'ont jamais été attribués**)                                              |
| Migrations en base (`schema_migrations`)                   | **82** — aucune entrée orpheline, aucun fichier orphelin                                                                              |
| Numéros de migration en double                             | **aucun**                                                                                                                             |
| Harnais de tests SQL                                       | **34** (`supabase/tests/rls/` 32 + `supabase/tests/search/` 2)                                                                        |
| Numéros de harnais en double                               | `0001` et `0002` — mais dans **deux répertoires distincts**, donc sans collision réelle                                               |
| Tables `public`                                            | **202**                                                                                                                               |
| Tables `private` / `analytics`                             | 24 / 4 (+ 1 vue matérialisée `analytics.promotion_metrics`)                                                                           |
| Tables `public` sans RLS activée                           | **0**                                                                                                                                 |
| Politiques RLS (schéma `public`)                           | **440**                                                                                                                               |
| Tables `public` sans aucune politique                      | **3** — `domain_events`, `notification_deliveries`, `profile_search_documents` (volontaire)                                           |
| Fonctions `public` / `private`                             | 289 / 115                                                                                                                             |
| Fonctions exécutables par `anon`                           | **11**, exactement la liste blanche de D-125 (étendue de dix à onze par 0111, `get_landing_carousel_settings`, D-163)                 |
| Buckets Storage                                            | 9 — 8 privés (0027) + `landing-media` public (0068, D-134)                                                                            |
| Tâches `cron.job`                                          | **4**, toutes `active` (`cms_expire_content`, `cms_publish_scheduled`, `cms_select_featured_profile`, `cms_publish_featured_profile`) |
| `private.security_baseline_violations()`                   | **0 ligne** ✅                                                                                                                        |
| `private.storage_baseline_violations()`                    | **0 ligne** ✅                                                                                                                        |
| Tests unitaires (`pnpm test`)                              | **460** — `@ise/domain` 137, `@ise/validation` 124, `@ise/web` 199                                                                    |
| `pnpm typecheck`                                            | ✅ 7 tâches, 0 erreur                                                                                                                 |
| `pnpm build`                                                | ✅ 1 tâche, 0 erreur                                                                                                                  |
| `pnpm format:check`                                         | ✅ — « All matched files use Prettier code style! »                                                                                     |
| Comptes dans `auth.users`                                  | **0**                                                                                                                                 |
| Profils dans `ise_profiles`                                | **0**                                                                                                                                 |
| Contenus CMS saisis (`news`, `events`, `cms_media_assets`) | **0 / 0 / 0**                                                                                                                         |

---

## 1. Vue d'ensemble par module (MASTER PROMPT §106)

| Module                                            | Écrans                 | Backend     | RLS | Tests                                 | Web          | Mobile | Risques                                                                                                                                                                                                                                                                                                | Statut |
| ------------------------------------------------- | ---------------------- | ----------- | --- | -------------------------------------- | ------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Fondations (design system, monorepo, CI)          | —                      | ✅          | ⬛  | ✅ 411 unitaires                      | ✅           | ⬜     | Aucun test E2E n'a jamais été exécuté (bac à sable sans accès `*.supabase.co`)                                                                                                                                                                                                                        | 🟡     |
| Écrans système                                    | SYS-001→010            | 🟡          | ⬛  | ⬜                                    | ✅ 10/10     | ⬜     | SYS-003/004 ne s'affichent que sur une `maintenance_window` réellement déclarée ; SYS-010 est un bandeau global (`role=status`) ; aucun test E2E                                                                                                                                                      | 🟡     |
| Identité — accès, réclamation, onboarding         | ISE-001→015            | ✅          | ✅  | 🟡 SQL 0002                           | ✅ 15/15     | ⬜     | Aucun compte réel n'a jamais été créé ; aucun test E2E                                                                                                                                                                                                                                                | 🟡     |
| Profil & disponibilité                            | ISE-016→033            | ✅          | ✅  | ✅ SQL 0003 (30 cas), 0032 (19 cas)   | ✅ 18/18     | ⬜     | Dépôt de photo et de CV non ouvert (D-117) ; demande/réponse de recommandation notifiées in-app depuis 0116 (D-169) ; aucun test E2E. En-tête et expériences pilotent désormais l'organisation par une liste déroulante `public.organizations`, avec repli en texte libre (D-167)                                    | 🟡     |
| Recherche & découverte                            | ISE-034→037            | ✅          | ✅  | ✅ SQL 0001–0002 (search)             | ✅ 4/4       | ⬜     | Annuaire vide : la recherche fonctionne mais ne renvoie rien ; aucun test E2E                                                                                                                                                                                                                         | 🟡     |
| Relations & introductions                         | ISE-038→046            | ✅          | ✅  | ✅ SQL 0004                           | ✅ 9/9       | ⬜     | Filtres d'ISE-040 non livrés (F-05) ; demandes/refus/retraits de connexion et demandes d'introduction notifiés in-app depuis 0105 ; aucun test E2E                                                                                                                                                                                                                     | 🟡     |
| Appels au réseau                                  | ISE-047→054            | ✅          | ✅  | ✅ SQL 0005, 0019                     | ✅ 8/8       | ⬜     | Ciblage nominatif absent ; publication d'un appel notifiée in-app aux profils matchés depuis 0105 ; aucun test E2E                                                                                                                                                                                                                                       | 🟡     |
| Opportunités                                      | ISE-055→066            | ✅          | ✅  | ✅ SQL 0006, 0020                     | ✅ 12/12     | ⬜     | Modération SA-020 livrée (`/administration/opportunites`) ; dépôt de CV non ouvert ; changement d'étape et sélection d'une candidature notifiés in-app au candidat depuis 0115/0116 (D-169, retrait et déclarations auto restent hors périmètre) ; aucun test E2E                                                                                                                                                                                                   | 🟡     |
| Promotions                                        | ISE-067→071            | ✅          | ✅  | ✅ SQL 0024                           | ✅ 5/5       | ⬜     | Aucune donnée d'annuaire : les espaces promotion sont vides                                                                                                                                                                                                                                           | 🟡     |
| Stages                                            | ISE-072→077            | ✅          | ✅  | ✅ SQL 0007, 0025                     | ✅ 6/6       | ⬜     | Écrans ISE-073→077 livrés (détail, candidature, relecture, suivi, résultat) ; aucun test E2E ; aucune offre réelle en base                                                                                                                                                                            | 🟡     |
| Mentorat                                          | ISE-078→083            | ✅          | ✅  | ✅ SQL 0008, 0026                     | ✅ 6/6       | ⬜     | Écrans ISE-078→083 livrés (`/mentorat` et sous-routes) ; carte `/collaborer` réactivée ; aucun mentor réel en base ; aucun test E2E                                                                                                                                                                   | 🟡     |
| Communautés                                       | ISE-084→087            | ✅          | ✅  | ✅ SQL 0009, 0027                     | ✅ 4/4       | ⬜     | Création de communauté non ouverte (C-k) ; pièces jointes non ouvertes (C-i)                                                                                                                                                                                                                          | 🟡     |
| Projets & consortiums                             | ISE-088→091            | ✅          | ✅  | ✅ SQL 0010, 0028                     | ✅ 4/4       | ⬜     | Assistant de création de projet non livré (P-f)                                                                                                                                                                                                                                                       | 🟡     |
| Actualités & événements                           | ISE-092→096            | ✅          | ✅  | ✅ SQL 0011, 0029, 0113               | ✅ 5/5       | ⬜     | 0 actualité et 0 événement en base ; proposition d'actualité non ouverte (N-i) ; événements et opportunités peuvent désormais porter un visuel de couverture (0113, D-166)                                                                                                                          | 🟡     |
| Messagerie                                        | ISE-097                | ✅          | ✅  | ✅ SQL 0012, 0016                     | ✅ 3 routes  | ⬜     | **Realtime non vérifié contre la base réelle** ; aucun message n'a jamais transité                                                                                                                                                                                                                    | 🟡     |
| Notifications & paramètres                        | ISE-098→099            | ✅          | ✅  | ✅ SQL 0013, 0017                     | ✅ 7 routes  | ⬜     | **35 types seedés** (33 + 2 par 0116, D-169). Consommateur cron actif depuis 0105 (canal in-app uniquement, D-80) : **13 types de `domain_events` relayés sur ~40 réellement écrits** (9 depuis 0105 : connexions, introductions, mentorat, communautés, événements, appels au réseau ; 4 de plus depuis 0116 : candidatures — étape changée / retenue —, recommandations — demande / réponse). Le reste (candidature soumise/déclarée/retirée, recommandation retirée, e-mail, push, digests) reste `pending`→`processed` sans effet, documenté et non invente (0105/0116)                                                                                                                                                                                       | 🟡     |
| Aide & support                                    | ISE-100                | ✅          | ✅  | ✅ SQL 0014, 0018                     | ✅ 5 routes  | ⬜     | Aucun SLA affiché (D-85) ; aucun agent de support n'existe                                                                                                                                                                                                                                            | 🟡     |
| Site public (landing)                             | PUB-001                | ✅          | ✅  | ✅ SQL 0021, 0023, 0112, 0113 — 141+ unitaires web | ✅ 1/1       | ⬛     | **Toutes les sections rendent leur état vide** : 0 média, 0 actualité, 0 événement, 0 partenaire, statistiques à zéro. Durée de rotation du carrousel réglable (0111, D-163, `/administration/parametres`) ; survol qui figeait le défilement depuis le hero plein écran (0109) corrigé le même jour. « ISE du jour » affiche désormais un visuel de la médiathèque publique et une accroche courte, choisis par l'admin par mise en avant (0112, D-165, `/cms/ise-du-jour`) ; sans choix admin, repli sur le monogramme (D-135 inchangée). Les cartes Événement et Opportunité affichent de même un visuel optionnel de couverture (0113, D-166). Les quatre piliers « Un réseau conçu pour être utile » affichent désormais une image et une légende optionnelles pilotées par le CMS, avec un lien choisi parmi cinq écrans membres réels (0114, D-168) ; titre et texte des piliers restent fixes. | 🟡     |
| CMS (back-office du site public)                  | CMS-001→010, CMS-006bis, CMS-011 | ✅          | ✅  | ✅ SQL 0021, 0022, 0113, 0114         | ✅ 15 routes | ⬛     | Variantes d'image non générées (D-133/D-140) ; aucun contenu n'a été saisi. Nouvel écran `/cms/opportunites` (D-166) ; tous les champs image du CMS portent désormais une taille recommandée en pixels (D-166, règle permanente) ; nouvel écran `/cms/piliers` (D-168)                              | 🟡     |
| Superadmin — cœur (revue, modération, support)    | SA-001→020, SA-038→039, SA-011→015, SA-021→022, SA-023→034 | ✅ | ✅ | ✅ SQL 0030 (72 cas), RLS 0035 (23 cas), RLS 0036 (42 cas), RLS 0037 (33 cas) | 🟡 41/50     | 🟡     | Lot cœur livré sous `/administration` (0076+0077+0092+0093) : tableau de bord, membres & rôles, réclamations, promotions (délégués, invitations, campagnes d'invitation), appels, opportunités (modération, candidatures, clôture/bilan), support, projets & consortiums (SA-023→026, migrations 0094-0098, admin_list/create_project, admin_set_project_status, admin_list/review_consortium_request, admin_close_project), communautés (SA-027→029, migration 0099, admin_list/create_community, admin_update_community, admin_set_community_status, admin_list_community_posts, admin_moderate_community_post ; SA-029 fusionné dans l'écran de détail SA-028, décision D-156), événements (SA-030→033, migration 0100 : admin_list_events, admin_create_event, admin_update_event, admin_set_event_status, admin_list_event_registrations, admin_set_event_registration_status, admin_upsert_event_followup, admin_record_event_impact_snapshot ; SA-031/032/033 fusionnés dans l'écran de détail SA-031, même principe que projets et communautés), et rédaction des actualités (SA-034, migration 0110, décision D-162 : admin_list_news, admin_create_news, admin_update_news, admin_set_news_status). SA-035→037 couverts par SA-018/CMS (decision C-07) | 🟡     |
| Profils incomplets (SA-043)                       | SA-043                 | ✅ | ✅  | ⬜                                    | ⬜           | ⬛     | Import en masse (SA-040/041/042/044/045) abandonné (décision C-06) : le recensement Excel a été importé directement en migration (0088), 255 profils. SA-043 déplacé vers `/administration/profils-incomplets`.                                                                                    | 🟡     |
| Analytics                                         | SA-046→047             | 🟡          | ✅  | ⬜                                    | ✅           | ⬛     | Schéma `analytics` posé, 4 tables + 1 vue matérialisée, **aucun agrégat calculé sur des données réelles**                                                                                                                                                                                             | 🟡     |
| Superadmin — paramètres plateforme & audit        | SA-048→050              | ✅          | ✅  | ✅ RLS 0031 cas G (paramètres), RLS 0038 (audit, 17 cas) | ✅ 3/3       | ⬛     | Lot données livré sous `/administration/parametres` (0082/0084) et `/administration/audit` (0083, lecture seule) : réglages de plateforme, feature flags, fenêtres de maintenance, et désormais le journal d'audit (`private.audit_log`) — liste filtrable (SA-049) et détail individuel journalisé (`audit.entry_read`, distinct de `audit.read`, SA-050, décision D-158). Aucune nouvelle fonction d'écriture créée : le backend (0028/0083) préexistait à cette tranche. | 🟡     |
| OPS — supervision technique (**abandonné**, C-05) | OPS-001→028            | ⬜          | ⬜  | ⬜                                    | ⬛ 0/28      | ⬛     | Abandonné par décision du porteur (C-05) : supervision via Supabase/Vercel                                                                                                                                                                                                                            | ⬛     |
| Application mobile                                | toutes séries          | ⬜          | ⬛  | ⬜                                    | ⬛           | 🟡     | `apps/mobile` existe : coquille Expo/React Native (auth e-mail/mot de passe, 5 onglets D-94). 4 écrans branchés au backend réel — Accueil (ISE-015, `my_profile_completion`), Réseau (ISE-040, `list_my_connections` + `my_network_summary`), Opportunités (ISE-055, `list_opportunities`), Moi (ISE-016 : profil, promotion, complétion, déconnexion). `pnpm --filter @ise/mobile typecheck` : 0 erreur. Aucun test automatisé, aucun E2E, aucune des ~195 autres routes web encore portées (action centrale = coquille).                             | 🟡     |

---

## 2. Base de données

**82 migrations** dans le dépôt (`0001` → `0085`, les numéros `0069`, `0078` et `0079` n'ont
jamais été attribués), **82 entrées** en base. Aucun fichier sans entrée, aucune entrée sans fichier, aucun numéro en
double. Le contrôle d'équivalence dépôt ↔ base est détaillé dans `docs/migration-integrity.md` :
**54 migrations conformes, 20 divergentes** après normalisation — les écarts observés portent sur
des libellés de `comment on` et des formes de code équivalentes, mais ils prouvent que des
fichiers ont été édités après application, ce que le README du dossier interdit.

- **202 tables** dans `public`, **24** dans `private`, **4** dans `analytics`, 1 vue matérialisée.
- **RLS activée et forcée sur les 202 tables** de `public` ; **440 politiques**.
- **3 tables sans politique** — `domain_events`, `notification_deliveries`,
  `profile_search_documents` — fermées volontairement (voir `docs/rls.md`).
- Le rôle `anon` n'a **aucun** privilège de table. Il exécute exactement **11 fonctions**
  (`get_landing_*` — 10, dont `get_landing_carousel_settings` ajoutée par 0111/D-163 —
  + `record_public_landing_event`), la liste blanche de D-125, vérifiée mécaniquement par le
  contrôle `anon_function_grant`.
- Aucune fonction `SECURITY DEFINER` sans `search_path` figé.
- `private.security_baseline_violations()` et `private.storage_baseline_violations()` renvoient
  **0 ligne**.
- **4 tâches `pg_cron` réellement planifiées et actives** (D-129).

### Référentiels seedés

| Référentiel                          | Volume (relevé en base) |
| ------------------------------------ | ------------------------ |
| Pays (ISO 3166-1, libellés français) | 249                       |
| Compétences                          | 543                       |
| Catégories / domaines de compétences | 92 / 18                   |
| Alias de compétences                 | 125                       |
| Secteurs                             | 35                        |
| Fonctions professionnelles           | 36                        |
| Promotions ISE                       | 72                        |
| Types de notification                | 33                        |
| Sections CMS (seed de 0057)          | 9                         |

---

## 3. Code applicatif

- `packages/design-tokens` — palette, typographie, espacement, rayons, ombres, grille, points de
  rupture ; variables CSS Tailwind v4 et preset partagé.
- `packages/domain` — moteur de matching déterministe et explicable, machines d'états, matrice
  rôles → permissions, règles de visibilité. **137 tests**.
- `packages/validation` — schémas Zod (auth, onboarding, profil, sections de profil,
  positionnement / projets / langues / recommandations / disponibilité (`profile-extras`),
  réseau). **124 tests**.
- `packages/ui-web` — composants accessibles avec leurs états.
- `packages/db-types`, `packages/config`.
- `apps/web` — Next.js, App Router, **179 routes**. En-têtes de sécurité, middleware de session,
  aucune clé `service_role` côté client. **199 tests** (landing, redirections sûres, rendu,
  fiabilité, métadonnées d'image CMS, conflits de programmation, statuts de collaboration).
- `apps/mobile` — **existe** : scaffold Expo/React Native (auth, navigation 5 onglets D-94) + 4 écrans réels sur backend (Accueil ISE-015, Réseau ISE-040, Opportunités ISE-055, Moi ISE-016). `pnpm --filter @ise/mobile typecheck` passe à 0 erreur. Reste : action centrale (coquille), les ~195 autres routes web, aucun test, aucun E2E mobile.

---

## 4. Ce qui n'existe pas encore

Cette section est la partie utile du document. Elle ne contient que des manques constatés.

### Aucune donnée réelle nulle part

- **`auth.users` contient 0 ligne.** Aucun compte n'a jamais été créé. Le parcours
  ISE-001 → ISE-002 → ISE-005 → ISE-007 → ISE-008–014 n'a jamais été déroulé de bout en bout
  contre la base réelle. Tous les écrans membre sont donc livrés **sans avoir jamais été vus
  fonctionner avec une session**.
- **`ise_profiles` contient 0 ligne.** L'annuaire n'a pas été importé. La recherche, le matching,
  les promotions, les introductions et les appels au réseau fonctionnent tous sur un ensemble
  vide. Aucun profil de démonstration n'a été créé (MASTER PROMPT §78).
- **0 actualité, 0 événement, 0 opportunité, 0 média CMS, 0 événement de domaine.** La landing
  publique rend intégralement ses états vides, et le CMS liste des tables vides.

### Aucun test de bout en bout

- **Aucun test E2E n'a jamais été exécuté.** `apps/web/e2e/public-redirect.spec.ts` existe et est
  câblé dans `.github/workflows/e2e.yml`, mais n'a jamais tourné (le bac à sable n'a pas d'accès
  à `*.supabase.co`). C'est le maillon manquant de la Definition of Done sur **toutes** les
  tranches déclarées livrées.
- Les 411 tests unitaires ne touchent jamais la base. Les 31 harnais SQL touchent la base mais
  jamais l'interface.

### Modules entiers sans interface

- **Superadmin : le cœur est livré** (`/administration`, migrations 0076 + 0077, harnais 0030 —
  72 cas, 0 échec) : tableau de bord — compteurs réels, membres & profils (statuts, rôles
  `roles.manage` jamais sur soi-même, notes administratives en `private`), **revue des
  (SA-011→015, migrations 0092+0093, et SA-021→022), projets & consortiums (SA-023→026,
  migrations 0094-0098, RLS 0035 — 23 cas, 0 échec), communautés (SA-027→029, migration 0099,
  RLS 0036 — 42 cas, 0 échec ; SA-029 fusionné dans l'écran de détail SA-028, décision D-156), et
  événements (SA-030→033, migration 0100, RLS 0037 — 33 cas, 0 échec ; SA-031/032/033 fusionnés
  dans l'écran de détail SA-031, même principe que projets/communautés). **Rédaction des
  actualités (SA-034, migration 0110, décision D-162 le 2026-08-12) : `/administration/actualites`
  — créer, modifier et publier un article sans SQL ; supersede la classification « couvert par le
  CMS » (C-07) pour SA-034 seul.**
  Restent sans écran : SA-035→038 (support & signalements — couverts par SA-018/CMS, décision C-07).
- **OPS (OPS-001 → OPS-028) : abandonné** par décision du porteur (C-05). Aucune table de supervision, d'incident ou
  d'astreinte. Le module n'a pas commencé.
- **Mentorat (ISE-078 → ISE-083) : livré le 2026-08-09.** `/mentorat` (accueil), `/mentorat/besoin`,
  `/mentorat/mentors` (+ fiche et demande), `/mentorat/demandes` (accepter / autre format D-54 /
  décliner sans motif), `/mentorat/[mentorshipId]` (+ `/bilan`), `/mentorat/devenir-mentor`.
  La carte « Mentorat » de `/collaborer` est redevenue cliquable.
- **Stages (ISE-073 → ISE-077) : livré le 2026-08-09.** `/stages/[offerId]` (+ `/candidature`,
  `/relecture`), `/stages/candidatures` (+ détail et `/resultat`) ; l'onglet « Mes candidatures »
  de `/stages` est rétabli. Les sept Server Actions de `stages/actions.ts` sont désormais toutes
  branchées sur des écrans réels.
- **Profil (ISE-024 → ISE-033) : 10 écrans manquants** — secteurs/fonctions/expertises, projets
  et réalisations, langues et zones d'expérience, recommandations, complétion, disponibilité.

### Notifications in-app : partielles, e-mail et push toujours absents

- **Aucune Edge Function, aucune file d'attente, aucun worker externe.** Le relais retenu est un
  `pg_cron` (`private.process_pending_domain_event_notifications()`, 0105, étendu par 0116,
  D-169), planifié toutes les 2 minutes, canal **in-app uniquement** (D-80). **13 types de
  `domain_events` sur ~40 réellement écrits** sont relayés en notification ; le reste (candidature
  soumise/déclarée/retirée, recommandation retirée, digests, e-mail, push, `opportunity.published`,
  `internship.*`, `project.invitation_*`, `promotion.invitation_created`, `admin.*`/modération)
  reste `pending` → `processed` sans effet, faute de destinataire in-app pertinent ou de lot dédié.
  Aucun canal e-mail ni push n'existe encore : `notification_types.default_email_mode` et
  `default_push` sont posés mais non exploités.
- Les **35 types de notification** sont seedés (33 + 2 par 0116) ; `notification_deliveries` n'a
  aucune politique RLS ; il porte désormais des lignes `channel = 'in_app'` pour les 13 types
  couverts, dès qu'un événement correspondant est écrit.
- Les **alertes de recherche enregistrées** (ISE-036) sont persistées ; le service qui les
  déclenche n'existe pas — l'écran le dit et n'annonce aucun délai.
- **Aucune expiration automatique** : `connection_requests.expires_at` (30 j) et
  `introduction_requests.expires_at` (14 j) sont posés, aucune tâche ne fait passer les lignes en
  `expired`. Les 4 tâches `pg_cron` actives sont **toutes** des tâches CMS.

### Fichiers

- Les 8 buckets privés de `0027` existent avec leurs politiques ; **aucun écran ne dépose ni ne
  relit de fichier**. `verification-documents`, `profile-documents` (CV), `avatars`,
  `message-attachments`, `support-attachments`, `project-assets` et `admin-imports` sont vides et
  sans parcours. Seul `landing-media` a un parcours de dépôt (CMS-008), et il n'a rien reçu.
- Les **variantes d'image** (Desktop / Mobile / vignette) ne sont pas générées : aucun encodeur
  côté serveur (D-133, amendé par D-140).

### Intégrité documentaire

- **20 migrations sur 74 divergent** entre le fichier du dépôt et le SQL réellement appliqué
  (voir `docs/migration-integrity.md`). Les écarts constatés sont non structurels, mais la règle
  « aucun fichier ne doit jamais être modifié après son application » n'a pas été respectée.
- La migration `0067_cms_backoffice_api.sql` est enregistrée en base sous le nom
  **`cms_backoffice_api`**, sans son préfixe numérique. C'est la seule entrée non préfixée.
- Le numéro **`0069` n'existe pas** : ni fichier, ni entrée en base. Trou assumé.

---

## 5. Prochaines étapes, par ordre de priorité

1. **Créer un premier compte réel** et dérouler ISE-001 → ISE-014 contre la base. Tant que
   `auth.users` est vide, aucune tranche ne peut prétendre à la Definition of Done.
2. **Exécuter les tests E2E** depuis un environnement ayant accès à `*.supabase.co`, puis écrire
   ceux des parcours critiques (réclamation, onboarding, recherche, connexion, candidature).
3. ~~Livrer un back-office minimal de revue~~ — **fait** : `/administration/reclamations` arbitre
   les réclamations (SA-004/SA-006, fonctions atomiques `approve_profile_claim` /
   `reject_profile_claim`, harnais 0030).
4. ~~Importer un jeu d'annuaire réel~~ — **fait le 2026-08-09, autrement** : le recensement Excel
   (275 réponses, 255 profils après dédoublonnage) a été importé directement en migration
   (`0088_import_ise_census`), en contournant le module SA-040 → SA-042. Décision C-06 (docs/decisions.md) :
   ce module est abandonné, plus aucun état vide à combler par ce biais.
5. **Brancher un consommateur d'événements de domaine** (notifications in-app d'abord) : sinon les
   19 modules livrés sont muets.
6. ~~Livrer les écrans manquants de Stages (5) et de Mentorat (6)~~ — **fait le 2026-08-09**
   (ISE-073 → ISE-083, harnais 0025/0026 rejoués verts).
7. **Livrer ISE-024 → ISE-033**, SYS-003, SYS-004, SYS-007, SYS-010.
8. **Réaligner les 20 migrations divergentes** — non pas en éditant les fichiers, mais en
   décidant explicitement quelle version fait foi et en consignant la décision.
9. Compléter le chantier **Superadmin** : le cœur (SA-001→020, SA-038→039, SA-011→015, SA-021→022, SA-023→033) est livré. SA-034 (rédaction des actualités) livré le 2026-08-12 (`/administration/actualites`, décision D-162, supersede C-07 pour cet écran). SA-035→038 couverts par l'existant (décision C-07). Paramètres plateforme & audit (SA-048→050) livrés — SA-049/050 le 2026-08-11 (`/administration/audit`, RLS 0038, décision D-158). OPS est abandonné (C-05).
10. ~~Créer `apps/mobile`~~ — **fait** : scaffold + Accueil, Réseau, Opportunités, Moi (4 écrans réels sur backend). Reste à porter le reste des écrans membre et à ajouter des tests.
