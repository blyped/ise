# Sécurité d'accès aux données — RLS, Storage et tests

Ce document est **normatif**. Il complète `docs/db-conventions.md` (§9 RLS) et
`docs/decisions.md` (D-10 à D-20, D-30 à D-32, D-72 à D-74, D-100 à D-104).

Migrations concernées : `0004` (helpers RBAC), `0006` (helpers réseau),
`0020` (ligne de base), `0021` (politiques Identité + Réseau),
`0026` (réaffirmation), `0027` (Storage), `0028` (correctifs issus des tests),
`0029` (réclamation de profil : ISE-005 → ISE-007),
`0035` (onboarding ISE-008 → ISE-014 et profil ISE-016 → ISE-023),
`0036` (colonnes `education_type`, `city`, `credential_url` sur `educations` ;
aucune politique modifiée),
`0039` (relations & introductions : ISE-038 → ISE-046 ; **aucune politique
modifiée** — uniquement des fonctions et une valeur ajoutée au référentiel
`introduction_requests.outcome`, D-118),
`0040` (correctif de la contrainte `introduction_events_event_type_check`,
défaut réel trouvé par la suite `0004`).

**Ouverture des modules de valeur** — une migration par domaine (§10) :

| Migration                             | Domaine                                        | Politiques |
| ------------------------------------- | ---------------------------------------------- | ---------- |
| `0040_rls_network_calls`              | Appels au réseau                               | 31         |
| `0041_rls_opportunities_applications` | Opportunités et candidatures                   | 42         |
| `0042_rls_internships`                | Stages                                         | 40         |
| `0043_rls_mentorship`                 | Mentorat                                       | 24         |
| `0044_rls_communities`                | Communautés                                    | 26         |
| `0045_rls_projects_consortiums`       | Projets et consortiums                         | 42         |
| `0046_rls_news_events`                | Actualités et événements                       | 50         |
| `0047_rls_messaging`                  | Messagerie                                     | 15         |
| `0048_rls_notifications_settings`     | Notifications et paramètres                    | 13         |
| `0049_rls_support_moderation`         | Support et modération                          | 20         |
| `0050_rls_platform`                   | Plateforme + extension du contrôle de sécurité | 12         |

> **Collision de numérotation à arbitrer.** `0040_rls_network_calls` (appliquée
> à `20260808061809`) et `0040_introduction_event_type_fix` (appliquée à
> `20260808063530`) portent le même numéro, produites par deux lots menés en
> parallèle. `db-conventions` §1 interdit la réutilisation d'un numéro : la
> seconde doit être renumérotée en `0051`, avec la référence correspondante
> dans ce document.

Suites de tests : `supabase/tests/rls/0001_rls_negative_suite.sql` (30 cas),
`supabase/tests/rls/0002_claim_suite.sql` (29 cas, réclamation de profil),
`supabase/tests/rls/0003_profile_sections_suite.sql` (30 cas, onboarding
et sections de profil) et `supabase/tests/rls/0004_network_suite.sql`
(45 cas, relations et introductions), puis **une suite par domaine ouvert** :

| Suite                                   | Domaine                      | Cas | Sortie attendue          |
| --------------------------------------- | ---------------------------- | --- | ------------------------ |
| `0005_network_calls_suite.sql`          | Appels au réseau             | 19  | `CALLS_TESTS_OK`         |
| `0006_opportunities_suite.sql`          | Opportunités et candidatures | 16  | `OPPORTUNITIES_TESTS_OK` |
| `0007_internships_suite.sql`            | Stages                       | 15  | `INTERNSHIP_TESTS_OK`    |
| `0008_mentorship_suite.sql`             | Mentorat                     | 17  | `MENTORSHIP_TESTS_OK`    |
| `0009_communities_suite.sql`            | Communautés                  | 16  | `COMMUNITIES_TESTS_OK`   |
| `0010_projects_suite.sql`               | Projets et consortiums       | 17  | `PROJECTS_TESTS_OK`      |
| `0011_news_events_suite.sql`            | Actualités et événements     | 15  | `NEWS_EVENTS_TESTS_OK`   |
| `0012_messaging_suite.sql`              | Messagerie                   | 18  | `MESSAGING_TESTS_OK`     |
| `0013_notifications_settings_suite.sql` | Notifications et paramètres  | 17  | `NOTIFICATIONS_TESTS_OK` |
| `0014_support_moderation_suite.sql`     | Support et modération        | 18  | `SUPPORT_TESTS_OK`       |
| `0015_platform_suite.sql`               | Plateforme                   | 18  | `PLATFORM_TESTS_OK`      |

---

## 1. Modèle d'autorisation

### 1.1 Les quatre niveaux de défense

| Niveau                      | Mécanisme                                                                                                          | Ce qu'il protège                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| 1. Schéma                   | `private` et `analytics` ne sont **pas** exposés à la Data API. Aucun `GRANT` table à `anon` ni à `authenticated`. | Coordonnées, RBAC, imports bruts, notes admin, audit, compteurs anti-abus. |
| 2. Privilège de table       | `anon` n'a **aucun** privilège sur `public` (D-73 : pas de web public en V1).                                      | Toute lecture non authentifiée.                                            |
| 3. Privilège de **colonne** | `ise_profiles.profile_completion` est retiré à `authenticated` (0028).                                             | Les données qu'une politique de **ligne** ne peut pas protéger (D-72).     |
| 4. RLS                      | `enable` **et** `force row level security` sur **toutes** les tables `public`.                                     | La ligne elle-même.                                                        |

`force row level security` s'applique aussi au propriétaire des tables : seuls
`postgres` et `service_role` (attribut `BYPASSRLS`) contournent la RLS, et
`service_role` ne quitte jamais le serveur (D-100).

### 1.2 Refus par défaut

Une table `public` sans politique est **totalement fermée** à `authenticated`.
C'était l'état des **136 tables** des modules de valeur jusqu'aux migrations
`0040` → `0050`, qui les ont ouvertes domaine par domaine (§10).

Il reste aujourd'hui **3 tables volontairement fermées**, et elles le restent :

| Table                      | Pourquoi elle reste fermée                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain_events`            | Bus d'événements de domaine. La colonne `payload` (jsonb) porte la charge utile **brute** d'événements appartenant à des tiers : identifiants de profils, messages d'introduction, motifs de modération. Une politique filtrée sur `actor_profile_id` exposerait quand même le payload d'événements dont le membre n'est qu'**acteur**, plus la structure du bus interne. Seul le worker `service_role` la consomme (D-100). |
| `notification_deliveries`  | File d'envoi technique : fournisseur, `provider_message_id`, `idempotency_key`, compteurs de reprise. C'est de l'infrastructure, pas une donnée de membre ; l'ouvrir n'apporterait rien à l'utilisateur et exposerait la mécanique d'envoi.                                                                                                                                                                                  |
| `profile_search_documents` | Index de recherche serveur (0021). Il n'est jamais servi à un client : il alimente `search_profiles()` / `match_profiles()`.                                                                                                                                                                                                                                                                                                 |

Le contrôle `private.tables_without_policy()` liste ces tables ; il est
informatif, pas bloquant, et doit désormais renvoyer **exactement ces 3 lignes**
(le cas V16 de `0015_platform_suite.sql` le fige).
`private.tables_without_rls()` doit, lui, rester vide.

### 1.3 Résolution de l'autorisation

L'autorisation se résout **toujours** par `private.has_permission('<domaine>.<action>')`,
jamais par un test de rôle en dur (D-31). Les rôles vivent dans
`private.user_roles`, table non exposée, et **aucune** donnée d'autorisation
ne transite par le JWT applicatif (D-32, MASTER PROMPT §10).

Le rattachement métier se fait sur `profile_id` (D-10). Deux exceptions
documentées, où l'autorisation porte sur `auth.uid()` parce que le profil
n'existe pas encore : `ise_profiles.user_id` et `profile_claims.claimant_user_id`
(réclamation d'un profil référencé).

### 1.4 Échelle de visibilité (D-73)

`private` · `connections` · `members` · `promotion`. **Aucune** valeur `public`.
Le blocage entre membres (`profile_blocks`) est évalué **avant** tout niveau de
visibilité, y compris `members` : un bloqueur disparaît intégralement.

---

## 2. Helpers

### 2.1 Helpers existants — à réutiliser, jamais à redéfinir

| Fonction                                 | Migration | Rôle                                                       |
| ---------------------------------------- | --------- | ---------------------------------------------------------- |
| `private.current_profile_id()`           | 0004      | uuid du profil du compte courant, `NULL` sinon.            |
| `private.has_role(text)`                 | 0004      | Rôle actif (usage diagnostique ; jamais en politique).     |
| `private.has_permission(text)`           | 0004      | **Seul** point d'autorisation.                             |
| `private.is_admin()`                     | 0004      | Porteur d'au moins un rôle administratif.                  |
| `private.is_active_member()`             | 0004      | Profil réclamé **et** actif.                               |
| `private.is_connected_to(uuid)`          | 0006      | Relation acceptée.                                         |
| `private.shares_promotion_with(uuid)`    | 0006      | Même promotion.                                            |
| `private.is_blocked_between(uuid, uuid)` | 0020      | Blocage dans un sens ou dans l'autre.                      |
| `private.can_see_profile(uuid)`          | 0021      | Un profil est-il consultable ?                             |
| `private.can_see_field(uuid, text)`      | 0021      | Une donnée de niveau `p_visibility` est-elle consultable ? |

Ordre d'évaluation de `can_see_field(owner, visibility)` — l'ordre **est** la règle :

```
current_profile_id() IS NULL   -> false
owner = moi                    -> true
blocage entre owner et moi     -> false      <-- avant toute permission de visibilité
has_permission('profiles.read')-> true
visibility = 'private'         -> false
visibility = 'members'         -> is_active_member()
visibility = 'connections'     -> is_connected_to(owner)
visibility = 'promotion'       -> shares_promotion_with(owner)
sinon                          -> false
```

### 2.2 Helpers ajoutés pour le Storage (0027)

| Fonction                                         | Rôle                                                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `private.storage_segment(text, int)`             | Nième segment du chemin d'objet.                                                                                                                 |
| `private.storage_segment_uuid(text, int)`        | Idem, interprété en uuid ; `NULL` si le segment n'en est pas un (un chemin malformé ne fait jamais échouer la politique par une erreur de cast). |
| `private.is_project_owner(uuid)`                 | Porteur du projet.                                                                                                                               |
| `private.is_project_member(uuid)`                | Membre actif, porteur, ou `projects.manage`.                                                                                                     |
| `private.is_conversation_participant(uuid)`      | Participant non sorti.                                                                                                                           |
| `private.can_access_support_ticket(uuid)`        | Auteur du ticket ou `support.manage`.                                                                                                            |
| `private.can_upload_verification_document(uuid)` | Demandeur d'une réclamation en cours, ou `profiles.verify`.                                                                                      |

### 2.3 Accesseurs ajoutés en correctif (0028)

| Fonction                                   | Rôle                                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `public.my_profile_completion()`           | Score de complétion du membre courant, **et de lui seul**. Sans paramètre : aucun tiers n'est atteignable.                     |
| `private.read_audit_log(int, timestamptz)` | Unique voie de lecture du journal d'audit pour un client. Exige `audit.read`, borne à 500 lignes, journalise son propre appel. |

### 2.4 Accesseurs de la réclamation de profil (0029)

Le demandeur d'une réclamation **n'a pas encore de profil** :
`private.current_profile_id()` renvoie `NULL`, donc `can_see_profile()` renvoie
`false` et **aucune ligne** de `ise_profiles` ne lui est accessible. La tranche
ISE-005 → ISE-007 ne s'appuie donc sur aucune politique de lecture : elle passe
entièrement par des fonctions dédiées, qui n'exposent que le strict nécessaire.

| Fonction                                                                  | Rôle                                                                                           |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `private.consume_rate_limit(text, text, int, int)`                        | Compteur anti-abus à fenêtre glissante (D-103). **Accordée à aucun rôle client.**              |
| `private.mask_email_hint(text)`                                           | Indice `a•••@d•••.tld`. Fonction pure ; **pas** `SECURITY DEFINER` (D-107).                    |
| `public.search_claimable_profiles(text, text, int)`                       | ISE-005. 20 lignes au plus, profils `unclaimed` seulement, 5 appels/h/compte.                  |
| `public.get_claimable_profile(uuid)`                                      | ISE-006. Récapitulatif d'un profil encore réclamable.                                          |
| `public.submit_profile_claim(uuid, text, jsonb)`                          | ISE-006 → ISE-007. Soumission atomique + vérification par e-mail historique.                   |
| `private.apply_claim_approval(uuid, uuid, text)`                          | Cœur transactionnel de l'approbation. **Accordée à aucun rôle client.**                        |
| `public.approve_profile_claim(uuid)` / `reject_profile_claim(uuid, text)` | Revue humaine ; exigent `profiles.verify`.                                                     |
| `public.my_profile_claim()`                                               | ISE-007. Dernière réclamation du compte courant. **Sans paramètre** : aucun tiers atteignable. |

### 2.5 bis Helpers ajoutés pour les modules de valeur (`0040` → `0050`)

Tous sont `SECURITY DEFINER` **motif A** (§4) : ils lisent une table dont la
politique est plus restrictive que la question posée, et ne renvoient qu'un
**booléen**. Aucun ne prend un `profile_id` d'appelant en paramètre : l'acteur
est toujours `private.current_profile_id()`.

| Fonction                                     | Migration | Rôle                                                                                                                                                                               |
| -------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `private.is_in_promotion(bigint)`            | 0040      | Appartenance à une promotion (colonne canonique `ise_profiles.promotion_id` **ou** adhésion `active`/`verified`).                                                                  |
| `private.is_network_call_author(uuid)`       | 0040      | Auteur d'un appel au réseau.                                                                                                                                                       |
| `private.can_see_network_call(uuid)`         | 0040      | **Audience réelle** d'un appel : visibilité D-73 + ciblage explicite + blocage.                                                                                                    |
| `private.is_opportunity_manager(uuid)`       | 0041      | Auteur, contact désigné, ou `opportunities.manage`.                                                                                                                                |
| `private.is_opportunity_author(uuid)`        | 0041      | Auteur strict (écriture des critères).                                                                                                                                             |
| `private.can_see_opportunity(uuid)`          | 0041      | Audience réelle : visibilité + ciblage + `moderation_status` + blocage.                                                                                                            |
| `private.can_see_application(uuid)`          | 0041      | Candidat, ou responsable **une fois la candidature soumise**.                                                                                                                      |
| `private.is_internship_offer_owner(uuid)`    | 0042      | Auteur ou maître de stage d'une offre.                                                                                                                                             |
| `private.can_see_internship_offer(uuid)`     | 0042      | Offre publiée, promotion ciblée respectée, blocage évalué.                                                                                                                         |
| `private.can_see_internship_need(uuid)`      | 0042      | Besoin de stage. « Alumni pertinent » = alumni **réellement sollicité** par l'étudiant.                                                                                            |
| `private.can_see_internship_placement(uuid)` | 0042      | Étudiant, maître de stage désigné, `internships.manage`.                                                                                                                           |
| `private.is_mentorship_party(uuid)`          | 0043      | Mentor ou mentoré d'une relation.                                                                                                                                                  |
| `private.can_see_mentor_profile(uuid)`       | 0043      | Annuaire des mentors : mentor **actif**, profil consultable, pas de blocage.                                                                                                       |
| `private.is_community_member(uuid)`          | 0044      | Membre `active`, ou `communities.manage`.                                                                                                                                          |
| `private.is_community_moderator(uuid)`       | 0044      | Rôle `moderator`/`manager`, créateur, ou `communities.manage`.                                                                                                                     |
| `private.can_see_community(uuid)`            | 0044      | Membre, ou communauté `network` active.                                                                                                                                            |
| `private.can_see_community_post(uuid)`       | 0044      | Billet publié : membre de la communauté, **ou** billet `network` d'une communauté `network`. Blocage évalué.                                                                       |
| `private.can_see_project(uuid)`              | 0045      | Traduit les 5 niveaux de `projects.visibility`, sans défaut permissif.                                                                                                             |
| `private.can_see_project_application(uuid)`  | 0045      | Candidat ou porteur du projet.                                                                                                                                                     |
| `private.can_see_news(uuid)`                 | 0046      | Actualité publiée : `members` / `promotion` / `community`.                                                                                                                         |
| `private.is_event_organizer(uuid)`           | 0046      | Organisateur, créateur, ou `events.manage`.                                                                                                                                        |
| `private.is_event_registered(uuid)`          | 0046      | Inscription réelle (`registered`, `pending_approval`, `waitlisted`, `attended`).                                                                                                   |
| `private.can_see_event(uuid)`                | 0046      | Audience réelle. `selected_members` et `invitation_only` **n'ouvrent à personne par défaut**.                                                                                      |
| `private.can_message_profile(uuid)`          | 0047      | Blocage **et** `user_settings.direct_message_policy` du destinataire. Le sollicitant ne peut pas lire ce réglage lui-même (politique « propriétaire seulement ») : d'où le helper. |
| `private.guard_status_transition()`          | 0049      | **Trigger**, pas un helper de politique. Voir §10.10.                                                                                                                              |

Accesseur ajouté :

| Fonction                            | Migration | Rôle                                                                                                                                                                                           |
| ----------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public.get_event_online_url(uuid)` | 0046      | Unique voie de lecture de `events.online_url_private` (§10.7). Renvoie `NULL` — jamais une erreur — si l'appelant n'est ni organisateur ni inscrit alors que le lien est réservé aux inscrits. |

Permissions ajoutées (D-30 autorise l'extension selon `<domaine>.<action>`) :
`internships.manage` (0042) et `mentorship.manage` (0043), toutes deux
accordées au rôle `superadmin`. Aucun test de rôle en dur n'est introduit (D-31).

### 2.5 Contrôles automatisés

| Fonction                                 | Doit renvoyer                                                                                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `private.security_baseline_violations()` | 0 ligne. RLS désactivée · privilège `anon` · `SECURITY DEFINER` sans `search_path` · schéma privé exposé · **colonne privée exposée**. |
| `private.storage_baseline_violations()`  | 0 ligne. Bucket public · bucket sans politique · sans `file_size_limit` · sans `allowed_mime_types` · politique ouverte à `anon`.      |
| `private.tables_without_rls()`           | 0 ligne.                                                                                                                               |
| `private.tables_without_policy()`        | Informatif (tranches non encore ouvertes).                                                                                             |

---

## 3. Politiques par table

Toutes les politiques ciblent explicitement `to authenticated`. Aucune politique
`to anon` n'existe, dans aucun schéma.

### 3.1 Référentiels (0020)

25 tables : `subregions`, `countries`, `languages`, `sectors`,
`sector_adjacencies`, `job_functions`, `expertise_areas`, `tools`,
`skill_domains`, `skill_categories`, `skills`, `skill_aliases`,
`availability_types`, `promotions`, `organizations`, `organization_aliases`,
`report_reasons`, `profile_visibility_defaults`, `profile_completion_rules`,
`news_categories`, `event_types`, `support_categories`, `notification_types`,
`domain_event_types`.

| Politique                    | Cmd    | Règle                                 |
| ---------------------------- | ------ | ------------------------------------- |
| `<table>_read_authenticated` | SELECT | `true` (tout membre authentifié)      |
| `<table>_manage_settings`    | ALL    | `has_permission('settings.manage')`   |
| `promotions_manage`          | ALL    | `has_permission('promotions.manage')` |

### 3.2 Identité et profil (0021, 0028)

| Table                                                                                                                                            | Politique                          | Cmd    | Règle                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ------ | ------------------------------------------------------------------------ |
| `ise_profiles`                                                                                                                                   | `ise_profiles_select`              | SELECT | `can_see_profile(id)`                                                    |
|                                                                                                                                                  | `ise_profiles_update_own`          | UPDATE | `id = current_profile_id()`                                              |
|                                                                                                                                                  | `ise_profiles_admin_write`         | ALL    | `has_permission('profiles.edit')`                                        |
|                                                                                                                                                  | _(privilège de colonne, 0028)_     | —      | `profile_completion` retiré à `authenticated`                            |
| `profile_visibility`                                                                                                                             | `profile_visibility_own`           | ALL    | `profile_id = current_profile_id()`                                      |
| `experiences`, `educations`, `profile_projects`, `profile_availabilities`                                                                        | `<t>_select`                       | SELECT | `can_see_field(profile_id, visibility)`                                  |
|                                                                                                                                                  | `<t>_write_own`                    | ALL    | `profile_id = current_profile_id()`                                      |
| `recommendations`                                                                                                                                | `recommendations_select`           | SELECT | `can_see_field(subject_profile_id, visibility)`                          |
|                                                                                                                                                  | `recommendations_write_own`        | ALL    | `author_profile_id = current_profile_id()`                               |
|                                                                                                                                                  | `recommendations_subject_moderate` | UPDATE | `subject_profile_id = current_profile_id()` (masquer sans réécrire)      |
| `profile_skills`, `profile_sectors`, `profile_functions`, `profile_expertise_areas`, `profile_languages`, `profile_tools`, `profile_geographies` | `<t>_select`                       | SELECT | `can_see_profile(profile_id)`                                            |
|                                                                                                                                                  | `<t>_write_own`                    | ALL    | `profile_id = current_profile_id()`                                      |
| `saved_searches`, `search_alerts`, `saved_profiles`                                                                                              | `<t>_own`                          | ALL    | `profile_id = current_profile_id()` — jamais lisible par un tiers (D-72) |
| `profile_blocks`                                                                                                                                 | `profile_blocks_own`               | ALL    | `blocker_profile_id = current_profile_id()`                              |
| `search_alert_seen_results`                                                                                                                      | `..._own`                          | ALL    | l'alerte appartient au membre                                            |
| `profile_search_documents`                                                                                                                       | _(aucune)_                         | —      | Index serveur : jamais servi au client                                   |

### 3.3 Réclamation, vérification, promotions (0021)

| Table                                         | Politique                      | Cmd             | Règle                                                         |
| --------------------------------------------- | ------------------------------ | --------------- | ------------------------------------------------------------- |
| `profile_claims`                              | `profile_claims_own`           | SELECT          | `claimant_user_id = auth.uid()` ou `profiles.verify`          |
|                                               | `profile_claims_insert_own`    | INSERT          | `claimant_user_id = auth.uid()` **et** `status = 'submitted'` |
|                                               | `profile_claims_withdraw_own`  | UPDATE          | demandeur, statut `submitted`/`under_review`                  |
|                                               | `profile_claims_review`        | ALL             | `profiles.verify`                                             |
| `profile_verifications`                       | `profile_verifications_read`   | SELECT          | propriétaire ou `profiles.verify`                             |
| `profile_claim_disputes`                      | `profile_claim_disputes_admin` | ALL             | `profiles.moderate`                                           |
| `promotion_memberships`, `promotion_managers` | `<t>_select`                   | SELECT          | `is_active_member()`                                          |
|                                               | `<t>_manage`                   | ALL             | `promotions.manage`                                           |
| `promotion_invitations`                       | `..._own` / `..._create`       | SELECT / INSERT | inviteur ou `promotions.manage` / inviteur                    |
| `missing_member_suggestions`                  | `..._own` / `..._create`       | SELECT / INSERT | auteur ou `promotions.manage` / auteur                        |

### 3.3 bis Onboarding et signalement de promotion (0035)

| Table                         | Politique    | Cmd    | Règle                                                                                                                                                                   |
| ----------------------------- | ------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profile_onboarding_progress` | `..._own`    | ALL    | `profile_id = current_profile_id()` — **jamais** lisible par un tiers, ni par un administrateur (même logique que `saved_searches` et que le score de complétion, D-72) |
| `promotion_suggestions`       | `..._own`    | SELECT | auteur ou `promotions.manage`                                                                                                                                           |
|                               | `..._create` | INSERT | auteur = moi · `status = 'submitted'` · aucun champ de revue prérempli                                                                                                  |
|                               | `..._review` | ALL    | `promotions.manage`                                                                                                                                                     |

`promotion_suggestions` porte un index unique
`(submitted_by_profile_id, normalize_text(promotion_label))` : un membre ne
signale pas deux fois la même promotion. Le garde-fou est en base, pas dans
l'application, donc non contournable.

### 3.4 Réseau : relations et introductions (0021)

| Table                   | Politique                | Cmd    | Règle                                                                                                              |
| ----------------------- | ------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `connection_requests`   | `..._involved`           | SELECT | demandeur ou destinataire                                                                                          |
|                         | `..._create`             | INSERT | demandeur = moi · membre actif · **pas de blocage** · `status = 'pending'`                                         |
|                         | `..._respond`            | UPDATE | partie prenante, statut `pending`, vers `declined`/`withdrawn` **uniquement**                                      |
| `connections`           | `connections_select`     | SELECT | moi, ou relation d'une de mes relations (chemin d'introduction, D-51)                                              |
|                         | `connections_delete_own` | DELETE | l'un des deux membres                                                                                              |
| `introduction_requests` | `..._involved`           | SELECT | demandeur, intermédiaire, ou **cible seulement à partir de `introduced`**                                          |
|                         | `..._create`             | INSERT | demandeur = moi · membre actif · `is_connected_to(intermédiaire)` (D-51) · pas de blocage · `status = 'requested'` |
| `introduction_events`   | `..._involved`           | SELECT | demandeur ou intermédiaire                                                                                         |

**Aucune politique `UPDATE` n'est ouverte sur `introduction_requests`** ni pour
l'acceptation d'une `connection_request` : ces transitions passent
obligatoirement par une fonction atomique (§4).

### 3.5 Tranches non encore ouvertes

**Cette section est close.** Les tranches qu'elle listait (`conversations`,
`messages`, `projects`, `opportunities`, `support_tickets`, `notifications`,
`events`, `news`, `mentorships`, `communities`, `internship_*`,
`network_calls`, `platform_settings`, `user_settings`, `report*`…) sont
ouvertes par les migrations `0040` → `0050` : voir **§10**.

Le cas C11 de `0001_rls_negative_suite.sql` reste valable et prend un sens
plus fort : Alice n'accède pas à la conversation de Bob et Carole non plus
parce que la table est fermée, mais parce que la politique
`conversations_participants` l'exclut nommément (§10.8).

---

## 4. Fonctions `SECURITY DEFINER` — justification (D-101)

Toutes déclarent `SET search_path = ''` et qualifient chaque objet. Le contrôle
`security_baseline_violations()` échoue si l'une d'elles y déroge.

`SECURITY DEFINER` n'est **jamais** utilisé pour contourner une politique
(MASTER PROMPT §72). Il est utilisé pour deux motifs seulement :

- **(A) Éviter la récursion de politiques et la fuite de schéma.** Le helper lit
  une table `private` (ou une table `public` dont la RLS est fermée) et ne
  renvoie qu'un **booléen** ou un **uuid**, jamais une ligne de données.
- **(B) Transition d'état atomique.** La fonction est le seul chemin d'écriture ;
  elle valide acteur → permission → état courant → transition → unicité, sous
  `SELECT … FOR UPDATE`, et journalise.

| Fonction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Motif | Justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `private.current_profile_id()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | A     | Lit `ise_profiles` sans déclencher sa propre politique (récursion infinie sinon). Renvoie un uuid.                                                                                                                                                                                                                                                                                                                                                                                                    |
| `private.has_role`, `has_permission`, `is_admin`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | A     | Lisent `private.user_roles` / `role_permissions`, non exposées (D-32). Renvoient un booléen.                                                                                                                                                                                                                                                                                                                                                                                                          |
| `private.is_active_member`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | A     | Idem `current_profile_id`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `private.is_connected_to`, `shares_promotion_with`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | A     | Lisent `connections` / `ise_profiles` sans récursion de politique. Booléen.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `private.is_blocked_between`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | A     | Lit `profile_blocks`, dont la politique est « bloqueur seulement » : le bloqué doit pourtant être filtré. Booléen.                                                                                                                                                                                                                                                                                                                                                                                    |
| `private.can_see_profile`, `can_see_field`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | A     | Composent les précédents. Booléen.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `private.storage_segment`, `storage_segment_uuid`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | —     | **Pas** `SECURITY DEFINER` (fonctions pures).                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `private.is_project_owner`, `is_project_member`, `is_conversation_participant`, `can_access_support_ticket`, `can_upload_verification_document`                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | A     | Lisent `projects`, `project_members`, `conversation_participants`, `support_tickets`, `profile_claims` — tables fermées ou partiellement ouvertes. Booléen.                                                                                                                                                                                                                                                                                                                                           |
| `private.log_audit`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | B     | Écrit dans `private.audit_log`, table append-only non exposée. `EXECUTE` révoqué à `public`.                                                                                                                                                                                                                                                                                                                                                                                                          |
| `private.read_audit_log`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | A + B | Lit `private.audit_log`. **Vérifie `has_permission('audit.read')` avant tout**, borne à 500 lignes, journalise son propre appel.                                                                                                                                                                                                                                                                                                                                                                      |
| `private.security_baseline_violations`, `storage_baseline_violations`, `tables_without_rls`, `tables_without_policy`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | A     | Lisent les catalogues système. Sortie purement structurelle.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `public.my_profile_completion()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | A     | Lit une colonne dont le privilège est retiré à l'appelant. **Sans paramètre** : le filtre `= current_profile_id()` n'est pas influençable.                                                                                                                                                                                                                                                                                                                                                            |
| `public.accept_connection_request`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | B     | `FOR UPDATE` sur la demande, vérifie destinataire + statut, insère la relation en `ON CONFLICT DO NOTHING` : deux appels concurrents ne créent qu'une ligne (MASTER PROMPT §100).                                                                                                                                                                                                                                                                                                                     |
| `public.transition_introduction`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | B     | Matrice de transitions par acteur (D-50). Aucune politique `UPDATE` n'existe en parallèle.                                                                                                                                                                                                                                                                                                                                                                                                            |
| `public.transition_network_call`, `publish_network_call`, `close_network_call`, `expire_stale_network_calls`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | B     | Machines d'états des appels au réseau.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `public.transition_application_status`, `submit_application`, `declare_external_application`, `close_opportunity`, `expire_stale_opportunities`                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | B     | Machines d'états des opportunités et candidatures (D-55 : aucun état non constaté).                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `public.transition_support_ticket`, `transition_report`, `transition_import_batch`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | B     | Machines d'états support, modération, imports.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `public.search_claimable_profiles`, `get_claimable_profile`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | A     | Le demandeur n'a **pas encore** de profil : `can_see_profile()` lui refuse `ise_profiles`, et `private.profile_contacts` n'est exposé à personne. Renvoient 5 champs, dont un indice d'e-mail **masqué en base** (D-107), et uniquement des profils `unclaimed`. Réservées aux comptes non rattachés (D-106), limitées à 5 appels/h (D-103).                                                                                                                                                          |
| `public.submit_profile_claim`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | B     | `FOR UPDATE` sur `ise_profiles`, refuse profil déjà réclamé / compte déjà rattaché / réclamation déjà en cours, crée la réclamation, émet `profile.claim_submitted`, puis **décide de l'approbation automatique** si l'adresse confirmée du compte est l'adresse historique (D-105).                                                                                                                                                                                                                  |
| `private.apply_claim_approval`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | B     | Chemin d'écriture unique de l'approbation : `FOR UPDATE`, rejet des réclamations concurrentes, `user_id` + `claim_status` + `profile_status`, rôle `member`, `log_audit`, `profile.claimed`. Accordée à aucun rôle client.                                                                                                                                                                                                                                                                            |
| `public.approve_profile_claim`, `reject_profile_claim`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | B     | Exigent `profiles.verify` (D-31). Le **refus** est lui aussi journalisé.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `public.my_profile_claim`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | A     | Lit une jointure `profile_claims` × `ise_profiles` dont la seconde table est fermée au demandeur. **Sans paramètre** : le filtre `claimant_user_id = auth.uid()` n'est pas influençable.                                                                                                                                                                                                                                                                                                              |
| `public.search_skills(text, int)` (0035)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | —     | **Pas** `SECURITY DEFINER`. `skills`, `skill_aliases`, `skill_categories` et `skill_domains` sont déjà lisibles par tout membre authentifié (0020) : il n'y a rien à contourner. `EXECUTE` révoqué à `public` et `anon`, accordé à `authenticated`.                                                                                                                                                                                                                                                   |
| `public.complete_onboarding()` (0035)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | B     | Seul chemin d'écriture de `ise_profiles.onboarding_completed_at`. `FOR UPDATE` sur la ligne de profil, vérifie l'acteur (`current_profile_id()`), refuse tant que la promotion n'est pas renseignée (`onboarding_promotion_required`), clôture `profile_onboarding_progress`, journalise et émet `profile.updated`. **Sans paramètre** : aucun tiers atteignable. Appelle `calculate_profile_completion()`, révoquée à `authenticated` (D-72). Idempotente : un second appel ne repousse pas la date. |
| `private.consume_rate_limit`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | A     | Écrit `private.rate_limit_counters`, non exposée. Renvoie un booléen. Accordée à aucun rôle client.                                                                                                                                                                                                                                                                                                                                                                                                   |
| `private.is_in_promotion`, `is_network_call_author`, `can_see_network_call`, `is_opportunity_manager`, `is_opportunity_author`, `can_see_opportunity`, `can_see_application`, `is_internship_offer_owner`, `can_see_internship_offer`, `can_see_internship_need`, `can_see_internship_placement`, `is_mentorship_party`, `can_see_mentor_profile`, `is_community_member`, `is_community_moderator`, `can_see_community`, `can_see_community_post`, `can_see_project`, `can_see_project_application`, `can_see_news`, `is_event_organizer`, `is_event_registered`, `can_see_event`, `can_message_profile` (0040 → 0047) | A     | Lisent des tables dont la politique est **plus restrictive que la question posée** — l'audience d'un appel, le ciblage d'une opportunité, l'adhésion à une communauté, le réglage `direct_message_policy` d'un tiers — sans jamais renvoyer autre chose qu'un **booléen**. Sans elles, chaque politique devrait lire ces tables sous la RLS de l'appelant : soit récursion, soit refus. Détail en §2.5 bis.                                                                                           |
| `public.get_event_online_url(uuid)` (0046)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | A     | Lit `events.online_url_private`, colonne dont le privilège de **lecture** est retiré à `authenticated`. Trois portes successives : `can_see_event()` → organisateur → `online_url_visibility = 'all_viewers'` → inscription réelle. Renvoie `NULL` (jamais une erreur) sinon : la réponse ne révèle pas l'existence du lien.                                                                                                                                                                          |
| `private.guard_status_transition()` (0049)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | —     | **Pas** `SECURITY DEFINER` : trigger `SECURITY INVOKER`. Il refuse tout changement de `status` sur `support_tickets` et `reports` lorsque `current_user` n'est pas le propriétaire des tables. Les fonctions de transition, elles, sont `SECURITY DEFINER` détenues par `postgres` : elles passent. C'est le complément exact de ce que la RLS ne sait pas faire — comparer `OLD` et `NEW`.                                                                                                           |
| `private.network_profile_card(uuid)` (0039)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | A     | Compose une carte de profil compacte pour les neuf écrans Réseau, champ par champ, via `field_is_visible()` — qui lit `profile_visibility` d'un **tiers**. Ne projette jamais e-mail, téléphone, adresse, date de naissance, CV ni `profile_completion`. `NULL` **indistinctement** pour un profil inexistant, supprimé, suspendu ou bloqué. Accordée à aucun rôle client.                                                                                                                            |
| `private.encode_keyset_cursor` / `decode_keyset_cursor` (0039)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | —     | **Pas** `SECURITY DEFINER` : rien à contourner. Un curseur tronqué ou falsifié rend `NULL`, jamais une erreur. Le curseur est re-chiffré par l'application avant d'atteindre le navigateur (§8.4).                                                                                                                                                                                                                                                                                                    |
| `public.send_connection_request` (0039)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | B     | ISE-038. `FOR UPDATE` sur le profil destinataire ; rejoue **chaque** condition de `connection_requests_create` (SECURITY DEFINER contourne la RLS), distingue « déjà en relation » de « demande déjà en cours », applique 30 demandes/jour (D-103).                                                                                                                                                                                                                                                   |
| `public.respond_to_connection_request` (0039)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | B     | ISE-039 / ISE-041 / ISE-042. Décliner (destinataire) ou retirer (demandeur), `FOR UPDATE`, statut `pending` exigé. **L'acceptation n'y est pas** : elle passe par `accept_connection_request()`.                                                                                                                                                                                                                                                                                                      |
| `public.my_network_summary`, `list_my_connections`, `list_connection_requests`, `get_connection_request` (0039)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | A     | ISE-040 → ISE-042. Lectures composées : les tables lues sont ouvertes, mais la **visibilité par champ** ne l'est pas. Aucune n'accepte de `profile_id` : le propriétaire est toujours `current_profile_id()`.                                                                                                                                                                                                                                                                                         |
| `public.suggest_introduction_paths(uuid, int)` (0039)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | A     | ISE-043. Intersecte **mes** relations directes avec celles de la cible. Ne révèle rien que `connections_select` n'autorise déjà (voir §9.1). Aucun score numérique en sortie (§15, D-119).                                                                                                                                                                                                                                                                                                            |
| `public.request_introduction(...)` (0039)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | B     | ISE-044. Vérifie les **deux** maillons du chemin — je suis en relation avec l'intermédiaire _et_ l'intermédiaire est en relation avec la cible (D-51) —, le blocage, le doublon et 10 demandes/jour (D-103). La politique `introduction_requests_create` ne pouvait vérifier ni le second maillon ni le débit.                                                                                                                                                                                        |
| `public.get_introduction_request`, `list_my_introductions` (0039)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | A     | ISE-045. Miroir exact de `introduction_requests_involved` : la cible ne reçoit **rien** avant `introduced`, et **jamais** `message_to_intermediary`.                                                                                                                                                                                                                                                                                                                                                  |
| `public.declare_introduction_outcome(uuid, text, text)` (0039)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | B     | ISE-046. **Refuse** tout résultat d'échange tant que `target_responded` n'est pas constaté (MASTER PROMPT §25, D-55), puis délègue le changement de statut à `transition_introduction()`. Seuls le demandeur et la cible peuvent déclarer ; seul le demandeur peut clore « sans suite » (D-50).                                                                                                                                                                                                       |

Codes d'erreur levés (D-102) : `28000` non authentifié · `42501` non autorisé ·
`P0002` introuvable · `P0001` transition invalide. Le message est un **code
machine** (`not_addressee`, `invalid_transition`), jamais une phrase.

---

## 5. Storage (0027, 0068)

### 5.1 Buckets

**Un seul bucket est public**, `landing-media` (0068, D-134). Les huit autres
restent privés : tout téléchargement y passe par une URL signée émise côté
serveur après contrôle. Les chemins sont organisés par identifiant métier,
jamais par `user_id` (D-11) — sauf `landing-media`, rangé par **usage
éditorial**, un média de vitrine n'appartenant à personne.

| Bucket                   | Chemin                | Taille | Types MIME                            | Lecture                                          | Écriture                                                   |
| ------------------------ | --------------------- | ------ | ------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| `avatars`                | `{profile_id}/…`      | 2 Mo   | png, jpeg, webp                       | membres actifs                                   | propriétaire du profil                                     |
| `profile-documents`      | `{profile_id}/…`      | 10 Mo  | pdf, docx, xlsx, pptx, png, jpg, webp | propriétaire + `profiles.read`                   | propriétaire                                               |
| `project-assets`         | `{project_id}/…`      | 10 Mo  | idem                                  | membres du projet (+ porteur, `projects.manage`) | porteur                                                    |
| `message-attachments`    | `{conversation_id}/…` | 10 Mo  | idem                                  | participants **uniquement**                      | participants                                               |
| `support-attachments`    | `{ticket_id}/…`       | 10 Mo  | idem                                  | auteur + `support.manage`                        | auteur + `support.manage`                                  |
| `verification-documents` | `{profile_id}/…`      | 10 Mo  | idem                                  | `profiles.verify` **uniquement**                 | demandeur d'une réclamation en cours, ou `profiles.verify` |
| `admin-imports`          | `{batch_id}/…`        | 50 Mo  | csv, xls, xlsx                        | `imports.execute` **uniquement**                 | `imports.execute`                                          |
| `public-assets`          | libre                 | 5 Mo   | png, jpeg, webp                       | membres actifs                                   | `content.publish` ou `cms.media.manage` (0067)             |

Tailles et types sont imposés par `storage.buckets.file_size_limit` et
`allowed_mime_types` : le service Storage refuse avant même d'atteindre la RLS.
Valeurs issues de D-84 (10 Mo par pièce jointe ; `svg` volontairement exclu de
`public-assets` : vecteur d'injection).

### 5.2 Points d'attention

- `message-attachments` n'accorde **aucun** accès administratif : le contenu des
  échanges privés n'est jamais consultable par l'exploitation (MASTER PROMPT §24).
- `verification-documents` n'est pas relisible par le déposant : une preuve se
  dépose, elle ne se consulte pas.
- Le nom « `public-assets` » désigne le caractère **non personnel** du contenu,
  pas une exposition au web : le bucket reste privé. Depuis 0068, il n'est plus
  la destination de la médiathèque et **n'est plus projeté** vers la vitrine.
- `private.storage_segment_uuid()` renvoie `NULL` sur un segment non-uuid : un
  chemin malformé fait échouer la politique (refus), jamais la requête (erreur).

### 5.3 `landing-media` — le seul bucket public (0068)

| Propriété        | Valeur                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `public`         | **`true`** — et c'est le seul de la plateforme                                                |
| Taille           | 5 Mo                                                                                          |
| Types MIME       | `image/png`, `image/jpeg`, `image/webp`, `image/avif`. **Pas de SVG**                         |
| Chemins          | `carousel/…`, `partners/…`, `news/…`, `sections/…` — imposés par la politique, pas convenus   |
| Lecture anonyme  | par `/storage/v1/object/public/landing-media/{chemin}`, **sans** passer par `storage.objects` |
| Lecture RLS      | `cms.read` (back-office). **Aucune politique n'est ouverte à `anon`**                         |
| Écriture, suppr. | `cms.media.manage`                                                                            |

Quatre politiques, toutes `to authenticated` :
`ise_landing_media_read` (SELECT, `cms.read`), `ise_landing_media_insert`
(INSERT, `cms.media.manage` **et** préfixe d'usage valide),
`ise_landing_media_update` (UPDATE, mêmes conditions à l'arrivée),
`ise_landing_media_delete` (DELETE, `cms.media.manage`).

**Pourquoi aucune politique `to anon`.** La lecture d'un bucket public ne
consulte pas `storage.objects` : le service Storage sert l'objet dès que
`storage.buckets.public` est vrai. Ajouter une politique `anon` n'ouvrirait
donc rien de plus et ferait échouer le contrôle `storage_anon_policy` — un
contrôle qui doit rester utile pour les huit autres buckets.

**Pas de SVG.** Un SVG est un document XML capable de porter du script. Servi
publiquement sur le domaine Supabase, il s'exécuterait dans le contexte de ce
domaine. Le contrôle `bucket_mime_allows_svg` le refuse pour **tous** les
buckets, pas seulement celui-ci.

**Les avatars n'y entrent pas** (D-135). Le bucket `avatars` reste privé et
`get_landing_featured_profile()` ne projette même plus `avatar_path` : le
teaser « ISE du jour » affiche un monogramme.

### 5.4 Le garde-fou `private.storage_baseline_violations()`

Il doit renvoyer **0 ligne**. Huit contrôles depuis 0068 :

| Contrôle                   | Échoue si…                                                     |
| -------------------------- | -------------------------------------------------------------- |
| `public_bucket`            | un bucket **autre que** `landing-media` est public             |
| `landing_media_missing`    | `landing-media` n'existe pas                                   |
| `landing_media_not_public` | `landing-media` a été refermé — la vitrine perdrait ses images |
| `bucket_without_policy`    | un bucket n'est cité par aucune politique                      |
| `bucket_no_size_limit`     | `file_size_limit` non défini                                   |
| `bucket_no_mime_allowlist` | `allowed_mime_types` non défini                                |
| `bucket_mime_allows_svg`   | un bucket accepte du SVG                                       |
| `storage_anon_policy`      | une politique `storage.objects` est ouverte à `anon`           |

`landing_media_not_public` mérite un mot : sans lui, refermer le bucket ferait
disparaître toutes les images de PUB-001 **sans aucune erreur** côté base. Un
manque silencieux est pire qu'une panne bruyante (MASTER PROMPT §98).

---

## 6. Défauts trouvés par les tests et corrigés (0028)

La suite a été écrite **avant** les correctifs et a révélé trois défauts réels.
Aucun test n'a été affaibli pour le faire passer ; `0020` et `0021` n'ont pas
été modifiées.

| #   | Cas  | Défaut                                                                                                                                                                                                                  | Correctif (`0028_rls_fixes.sql`)                                                                                                                     |
| --- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | C07a | `ise_profiles.profile_completion` était lisible par tout membre autorisé à voir la ligne. La RLS filtre des **lignes** : elle ne pouvait pas protéger cette colonne. Violation directe de D-72 et du MASTER PROMPT §17. | Privilège de **colonne** : `REVOKE SELECT/UPDATE/INSERT` sur la table pour `authenticated`, puis `GRANT` colonne par colonne à l'exception du score. |
| D2  | C07b | Conséquence de D1 : le propriétaire perdait l'accès à son propre score.                                                                                                                                                 | `public.my_profile_completion()`, sans paramètre, `SECURITY DEFINER`.                                                                                |
| D3  | C20b | La permission `audit.read` existait sans être exploitable : `private` n'est exposé à aucun rôle client, aucune fonction de lecture n'existait. Un superadmin ne pouvait pas consulter le journal d'audit.               | `private.read_audit_log(int, timestamptz)` : exige `audit.read`, borne à 500 lignes, journalise son propre appel.                                    |

Le contrôle `security_baseline_violations()` a été étendu (`private_column_exposed`)
pour que **toute réapparition de D1 fasse échouer la CI**, y compris après l'ajout
d'une colonne à `ise_profiles`.

### Conséquence côté client — à connaître

`authenticated` n'a plus de privilège `SELECT` au **niveau table** sur
`public.ise_profiles`, mais un privilège par colonne. **Toute requête
`select *` sur cette table échoue désormais avec `42501`.** Les clients
(PostgREST, Server Actions, `packages/db-types`) doivent énumérer leurs colonnes.
C'est la contrepartie assumée d'une protection réelle du score de complétion.

Si une colonne est ajoutée à `ise_profiles` par une migration ultérieure, elle
doit être explicitement `GRANT`-ée à `authenticated` dans la même migration.

---

## 7. Rejouer la suite de tests

### 7.1 Ce que fait le harnais

`supabase/tests/rls/0001_rls_negative_suite.sql` est un **unique bloc `DO`** :

1. il crée ses fixtures sous `postgres` (`BYPASSRLS`) — comptes `test+…`,
   profils `is_test_account = true` (D-104) ;
2. il exécute **30 assertions** en changeant d'identité par
   `set_config('role', …)` + `set_config('request.jwt.claims', …)` ;
3. il lève **toujours** une exception finale : la transaction est annulée et
   **aucune donnée de test ne subsiste**. L'exception _est_ le mécanisme de
   rollback, pas un signal d'erreur.

Sortie attendue :

```
ERROR:  P0001: RLS_TESTS_OK: 30 cas, 0 echec
```

Sortie en cas de régression :

```
ERROR:  P0001: RLS_TESTS_FAILED: 30 cas, 2 echec(s)
  - C05 experience connections d'un non-contact visible (1)
  - C19a profil du bloqueur encore visible (1)
```

### 7.2 Lancer

```bash
# Base distante (projet unique, C-01) — le rollback rend l'opération sûre.
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=0 -f supabase/tests/rls/0001_rls_negative_suite.sql

# Base locale
supabase db reset && psql "$(supabase status -o env | grep DB_URL | cut -d= -f2-)" \
  -f supabase/tests/rls/0001_rls_negative_suite.sql
```

Via le connecteur MCP Supabase : passer le contenu du fichier à `execute_sql`.
L'appel remonte l'exception : c'est le rapport.

### 7.3 Interpréter le résultat en CI

| Message                                                       | Sortie CI                                                                                       |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `RLS_TESTS_OK: N cas, 0 echec`                                | **succès**                                                                                      |
| `RLS_TESTS_FAILED: …`                                         | **échec bloquant**                                                                              |
| toute autre erreur (le bloc n'a pas atteint le `RAISE` final) | **échec bloquant** : le harnais lui-même est cassé, ou une fixture ne passe plus une contrainte |

Le script de CI doit donc chercher la chaîne `RLS_TESTS_OK:` et **échouer sur
son absence**, jamais se contenter du code retour de `psql`.

### 7.4 Couverture actuelle

| Cas      | Objet                                                               | Attendu                                                      |
| -------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| C01      | `anon` sur `ise_profiles`                                           | 0 ligne (en pratique : refus de privilège)                   |
| C02      | Alice → `private.profile_contacts` de Bob                           | refus                                                        |
| C03      | Alice met à jour le profil de Bob                                   | 0 ligne affectée                                             |
| C04      | Expérience `private` de Bob                                         | 0 ligne                                                      |
| C05      | Expérience `connections` de Carole (sans relation)                  | 0 ligne                                                      |
| C06      | Expérience `connections` de Bob (relation)                          | 1 ligne _(positif de contrôle)_                              |
| C07a     | `profile_completion` de Bob                                         | refus de privilège de colonne                                |
| C07b     | Score propre via `my_profile_completion()`                          | valeur exacte                                                |
| C08      | Alice → `private.audit_log`                                         | refus                                                        |
| C09      | Alice → `private.user_roles`                                        | refus                                                        |
| C10      | `saved_searches` de Bob                                             | 0 ligne                                                      |
| C11      | Conversation dont Alice n'est pas participante                      | 0 ligne (table fermée)                                       |
| C12      | Demande de connexion au nom de Bob                                  | rejet                                                        |
| C13      | Acceptation d'une demande adressée à Carole                         | `not_addressee`                                              |
| C14a/b/c | Double acceptation                                                  | succès, puis `invalid_transition`, puis **1 seule** relation |
| C15      | Introduction via un intermédiaire non relié (D-51)                  | rejet                                                        |
| C16      | `requested → introduced` par le demandeur                           | `invalid_transition`                                         |
| C17a/b   | Depuis `withdrawn`, toute transition                                | `invalid_transition`                                         |
| C18      | Cible d'une introduction en statut `requested`                      | 0 ligne                                                      |
| C19a/b/c | Bob bloque Alice : profil, demande, contenu                         | 0 ligne, rejet, 0 ligne                                      |
| C20a/b/c | Superadmin : profil de David, journal d'audit ; Alice refusée       | 1 ligne, ≥ 1 ligne, refus                                    |
| C21a/b   | `security_baseline_violations()` et `storage_baseline_violations()` | 0 ligne chacun                                               |

### 7.5 Couverture de `0002_claim_suite.sql` (réclamation de profil)

Même modèle auto-nettoyant. Sortie attendue : `CLAIM_TESTS_OK: 29 cas, 0 echec`.

| Cas         | Objet                                                    | Attendu                                                                                                |
| ----------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| K01         | `search_claimable_profiles` appelée par `anon`           | refus                                                                                                  |
| K02         | Recherche par nom                                        | les 4 profils non réclamés                                                                             |
| K03         | « Ehoumann » → « Ehouman » (D-45, seuil 0,30)            | 1 résultat                                                                                             |
| K04a/b      | Indice d'e-mail masqué · nom canonique de l'organisation | jamais l'adresse en clair · nom de `organizations`                                                     |
| K05         | Filtre par année de promotion                            | 2 résultats                                                                                            |
| K06         | Profils déjà réclamés                                    | 0 ligne                                                                                                |
| K07         | Compte déjà rattaché (D-106)                             | `account_already_linked`                                                                               |
| K08         | 6ᵉ recherche dans l'heure (D-103)                        | `rate_limited`                                                                                         |
| K09/K10/K11 | E-mail historique correspondant                          | `approved` **immédiat**, profil réclamé/actif/vérifié `email`, rôle `member`, 1 seul `profile.claimed` |
| K12/K13     | E-mail non correspondant                                 | reste `submitted`, profil en `claim_pending`, **non rattaché**                                         |
| K14         | Double réclamation du même profil                        | `profile_already_claimed`                                                                              |
| K15         | Second profil pour un compte déjà rattaché (D-20)        | `account_already_linked`                                                                               |
| K16         | Deuxième réclamation en cours du même compte             | `claim_already_pending`                                                                                |
| K17/K19     | Membre **sans** `profiles.verify` : approuver, rejeter   | `not_authorized`                                                                                       |
| K18a/b      | Porteur de `profiles.verify` : approuve                  | succès, et **aucune** vérification `email` posée                                                       |
| K20a/b      | Rejet                                                    | le profil redevient `unclaimed`                                                                        |
| K21a/b      | `get_claimable_profile` sur profil réclamé / réclamable  | 0 ligne / 1 ligne                                                                                      |
| K22a/b      | `my_profile_claim()`                                     | ma réclamation seulement                                                                               |
| K23         | `security_baseline_violations()`                         | 0 ligne                                                                                                |

### 7.6 Couverture de `0003_profile_sections_suite.sql` (onboarding et profil)

Même modèle auto-nettoyant. Sortie attendue : `PROFILE_TESTS_OK: 30 cas, 0 echec`.
Fixtures : **Nadia** et **Omar** en relation, **Sarah** sans relation et **sans promotion**.

| Cas       | Objet                                                                                                   | Attendu                                 |
| --------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| P01       | Progression d'onboarding d'un tiers                                                                     | 0 ligne                                 |
| P02       | Écrire une progression au nom d'un tiers                                                                | rejet                                   |
| P03       | Mettre à jour la progression d'un tiers                                                                 | 0 ligne affectée                        |
| P04       | Ajouter une compétence à un autre membre                                                                | rejet                                   |
| P05 / P06 | Modifier / supprimer une compétence d'un tiers                                                          | 0 ligne affectée                        |
| P07       | Contrôle positif : le niveau déclaré d'Omar est intact                                                  | `advanced`                              |
| P08       | Expérience `private` d'une **relation**                                                                 | 0 ligne                                 |
| P09       | Formation `connections` d'une relation                                                                  | 1 ligne _(positif de contrôle)_         |
| P10 / P11 | Modifier / supprimer la formation d'un tiers                                                            | 0 ligne affectée                        |
| P12       | Disponibilité `private` d'une relation                                                                  | 0 ligne                                 |
| P13 / P14 | Lire / écrire `profile_visibility` d'un tiers                                                           | 0 ligne / rejet                         |
| P15 / P16 | Lire / déposer un signalement de promotion d'un tiers                                                   | 0 ligne / rejet                         |
| P17       | Déposer un signalement déjà `accepted`                                                                  | rejet                                   |
| P18       | Déposer son propre signalement                                                                          | succès                                  |
| P19a/b/c  | Expérience `members` visible par un tiers, passée en `private` par son propriétaire, puis **invisible** | 1 · 1 · 0                               |
| P20       | `my_profile_missing_items()` sur un profil vide                                                         | ≥ 1 ligne                               |
| P21       | `complete_onboarding()` sans promotion                                                                  | `onboarding_promotion_required`         |
| P22 / P23 | `complete_onboarding()` sur un profil complet                                                           | succès · `onboarding_completed_at` posé |
| P24       | Second appel de `complete_onboarding()`                                                                 | date inchangée (idempotence)            |
| P25 / P26 | `search_skills()` par `anon` / par un membre                                                            | refus / ≥ 1 résultat                    |
| P27a/b    | `security_baseline_violations()`, `tables_without_rls()`                                                | 0 ligne chacun                          |

P19 est le cas qui vérifie **en base** que la visibilité par champ (D-73) est
réellement appliquée, et non seulement affichée.

### 7.7 Ajouter un cas

1. Créer la fixture dans le bloc de fixtures, avec un uuid de la plage
   `00000000-0000-4000-8000-…` et `is_test_account = true`.
2. Placer l'assertion **à sa place dans l'ordre chronologique** : certains cas
   modifient l'état partagé (C14 crée la relation Alice–Carole, C19 pose un
   blocage). Un cas inséré avant en dépend.
3. Incrémenter `v_cases` et n'ajouter à `v_fail` **que** le libellé de l'échec.
4. Ne jamais assouplir une assertion pour la faire passer : **chaque échec est
   un défaut de politique**, à corriger par une nouvelle migration.

---

## 8. Recherche & découverte — ISE-034 → ISE-037 (migrations `0030`, `0031`, `0033`, `0034`, `0035`, `0036`)

Suite de tests : `supabase/tests/search/0001_search_matching_suite.sql` (30 cas)
et `supabase/tests/search/0002_profile_view_saved_searches_suite.sql` (27 cas).
Sorties attendues : `SEARCH_TESTS_OK: 30 cas, 0 echec` et
`PROFILE_VIEW_TESTS_OK: 27 cas, 0 echec`.

### 8.1 Pourquoi ISE-037 ne lit pas `ise_profiles` directement

La politique `ise_profiles_select` filtre des **lignes**. Elle ne sait pas
qu'un membre a placé sa ville en `connections` et son LinkedIn en `promotion` :
cette information vit dans `profile_visibility`, table dont la politique est
`profile_visibility_own` — le **visiteur ne peut donc même pas lire les réglages
de la personne consultée** pour savoir quoi masquer.

Masquer côté interface reviendrait à « renvoyer puis masquer », ce que le
MASTER PROMPT §47 interdit explicitement. La composition du profil est donc
faite **en base**, champ par champ : un champ non autorisé n'entre jamais dans
la charge utile, il n'est ni transmis ni masqué.

### 8.2 Fonctions ajoutées

| Fonction                                                                | Motif | Justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `private.field_is_visible(uuid, text)`                                  | A     | Lit `profile_visibility` d'un **tiers** (politique « propriétaire seulement ») et `profile_visibility_defaults`. Renvoie un **booléen**. Résout la visibilité effective : réglage du propriétaire → défaut du référentiel → `private` (le moins exposé). Accordée à aucun rôle client.                                                                                                                                                                                                                                                        |
| `public.get_member_profile(uuid)`                                       | A     | ISE-037. Trois portes successives : `is_active_member()` → `can_see_profile()` (qui évalue le **blocage dans les deux sens**, la suppression et le statut) → `field_is_visible()` champ par champ, plus la visibilité **ligne à ligne** des expériences, formations et disponibilités. Ne projette jamais e-mail, téléphone, adresse, date de naissance, CV ni `profile_completion`. Renvoie `NULL` pour un profil bloqué, supprimé, suspendu ou inexistant — **indistinguable**, pour que la réponse ne révèle pas l'existence d'un blocage. |
| `public.save_search_with_alert(text, jsonb, boolean, text, text, uuid)` | B     | ISE-036. Crée ou met à jour la recherche **et** son alerte dans une seule transaction : il n'existe pas d'état « recherche enregistrée, alerte perdue ». `SELECT … FOR UPDATE` sur une modification.                                                                                                                                                                                                                                                                                                                                          |
| `public.set_search_alert_status(uuid, text)`                            | B     | ISE-036. Suspension / réactivation. `FOR UPDATE`, filtre `profile_id = current_profile_id()`.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `public.delete_saved_search(uuid)`                                      | B     | ISE-036. Suppression ; `search_alerts` et `search_alert_seen_results` partent en cascade.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `public.list_saved_searches()`                                          | A     | ISE-036. **Sans paramètre** : le filtre `profile_id = current_profile_id()` n'est pas influençable, aucun tiers n'est atteignable (D-72).                                                                                                                                                                                                                                                                                                                                                                                                     |

Aucune de ces fonctions n'accepte de `profile_id` en paramètre : le propriétaire
est **toujours** `private.current_profile_id()` (MASTER PROMPT §10).

### 8.3 Défaut trouvé par la suite et corrigé (`0036`)

La suite `0002` a été écrite **avant** d'être jouée et a fait tomber
`get_member_profile()` au premier profil réellement consultable.

| #   | Cas | Défaut                                                                                                                                                                                                                                                    | Correctif (`0036_get_member_profile_field_list_fix.sql`)                                                                                   |
| --- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| P1  | V02 | `v_fields := v_fields \|\| 'headline';` — PostgreSQL résout `anyarray \|\| unknown` en concaténation de **tableaux** : le littéral est lu comme un littéral de tableau. `ERROR 22P02 malformed array literal: "headline"` dès qu'un champ était autorisé. | `array_append(v_fields, 'headline')`. `0035` n'a **pas** été modifiée (même convention qu'en `0028`) ; aucune assertion n'a été affaiblie. |

### 8.4 Défaut de confidentialité constaté côté application

`public.match_profiles()` construit son curseur ainsi :
`encode(convert_to(score::text || '|' || id::text, 'UTF8'), 'base64')`.
La base64 **n'est pas un chiffrement** : `NDguNTB8…` se relit en clair
`48.50|<uuid>`. Transmettre ce curseur au navigateur — en `href`, en champ caché
ou en props sérialisée — exposerait le **score chiffré**, et pas seulement pour
une ligne : en rejouant la pagination on obtiendrait le score de chaque profil.
C'est exactement ce qu'interdit le MASTER PROMPT §15.

Le curseur brut ne quitte donc jamais le serveur : `apps/web/src/lib/opaque-cursor.ts`
le chiffre en **AES-256-GCM** (authentifié) avant remise au client et le déchiffre
au retour. La clé est dérivée de `SEARCH_CURSOR_SECRET`, sinon de
`SUPABASE_SERVICE_ROLE_KEY`, sinon d'un aléa par processus — auquel cas un curseur
ne survit pas à un redémarrage et l'écran invite à relancer la recherche, sans
jamais deviner une position.

### 8.5 Couverture de `0002_profile_view_saved_searches_suite.sql`

| Cas              | Objet                                                          | Attendu                            |
| ---------------- | -------------------------------------------------------------- | ---------------------------------- |
| V01              | Compte sans profil appelle `get_member_profile`                | refus `42501`                      |
| V02              | Membre actif consulte un tiers                                 | charge utile non nulle             |
| V03              | Champ en `private`                                             | **clé absente** de la charge utile |
| V04a/b           | Champ en `connections` : relation / non-contact                | présent / **clé absente**          |
| V05              | Champ en `promotion`, même promotion                           | présent                            |
| V06a/b           | Expérience `members` / `private`                               | 1 ligne / absente                  |
| V07              | e-mail, téléphone, adresse, date de naissance, CV, score       | aucune clé                         |
| V08 / V09 / V10  | Profil bloquant · suspendu · inexistant                        | `NULL` dans les trois cas          |
| V11 / V12        | Relation directe, promotion, organisation · relations communes | vrai · compte exact                |
| V13              | Disponibilité expirée                                          | exclue (D22 §46)                   |
| V14              | `save_search_with_alert`                                       | recherche **et** alerte en base    |
| V15              | `list_saved_searches` sous une autre identité                  | uniquement les siennes             |
| V16              | Suspension d'alerte par le propriétaire                        | `status = 'paused'`                |
| V17 / V18 / V18b | Alerte et recherche d'un tiers                                 | `not_found`, ligne intacte         |
| V19 / V20 / V21  | Fréquence, canal, nom hors contraintes                         | `validation_failed`                |
| V22              | Suppression                                                    | alerte partie en cascade           |
| V23              | Compte sans profil enregistre une recherche                    | refus `42501`                      |
| V24              | `security_baseline_violations()`                               | 0 ligne                            |

---

## 9. Relations & introductions — ISE-038 → ISE-046 (migrations `0039`, `0040`)

Suite de tests : `supabase/tests/rls/0004_network_suite.sql` (45 cas).
Sortie attendue : `NETWORK_TESTS_OK: 45 cas, 0 echec`.
Verdict du 8 août 2026 : **`NETWORK_TESTS_OK: 45 cas, 0 echec`**.

**Aucune politique n'a été ajoutée ni modifiée par cette tranche.** Celles de
`0021` suffisaient ; ce qui manquait, ce sont des chemins d'écriture atomiques
et des lectures composées respectant la visibilité par champ.

### 9.1 Pourquoi `suggest_introduction_paths()` ne révèle rien de nouveau

La politique `connections_select` (0021) autorise déjà tout membre à lire les
lignes de `connections` dont **l'un des deux côtés est l'une de ses propres
relations**. Autrement dit, « ma relation X est aussi en relation avec T » est
déjà lisible ligne à ligne par le demandeur.

Le RPC ne fait qu'**intersecter** mes relations avec celles de la cible, puis
ordonner le résultat. Trois garanties structurelles :

- la jointure sur mes propres liens rend impossible le renvoi d'une relation de
  la cible qui ne soit pas déjà l'une des miennes — ce n'est pas un filtre
  d'affichage, c'est la forme de la requête ;
- il n'existe aucune récursion, aucun `WITH RECURSIVE`, aucun second saut : le
  degré 1 est la seule profondeur que la fonction sache calculer (D-51) ;
- la sortie ne contient ni score ni rang, seulement un libellé qualitatif et la
  liste des signaux qui l'ont produit (D-119, D-43).

Le blocage est évalué **deux fois** : entre le demandeur et l'intermédiaire, et
entre l'intermédiaire et la cible. Une personne bloquée ne peut donc pas servir
de pont.

### 9.2 Ce qui reste volontairement fermé

- **Aucune politique `UPDATE` sur `introduction_requests`.** Toute transition
  passe par `public.transition_introduction()`. Le cas N09 de la suite le
  constate au lieu de le supposer : un `update` direct affecte 0 ligne.
- **La cible ne voit rien avant `introduced`.** Vérifié trois fois par la suite
  (N13a lecture directe, N13b `get_introduction_request`, N13c
  `list_my_introductions`).
- **`message_to_intermediary` n'est jamais transmis à la cible** : la clé est
  absente de la charge utile, il n'y a donc rien à masquer côté interface
  (cas N17b).

### 9.3 Défaut trouvé par la suite et corrigé (`0040`)

La suite `0004` a été écrite **avant** d'être jouée et a fait tomber les deux
dernières transitions de la machine d'états.

| #   | Cas                   | Défaut                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Correctif (`0040_introduction_event_type_fix.sql`)                                                                                                                                    |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | N20 / N21 / N22 / N23 | `public.transition_introduction()` journalise `event_type = <statut d'arrivée>`, mais la contrainte `introduction_events_event_type_check` de **0006** n'énumérait ni `completed` ni `no_outcome`. Les transitions `target_responded → completed` et `… → no_outcome` échouaient en `23514` : **une introduction ne pouvait jamais être close**, et le bilan d'ISE-046 était structurellement impossible. Le défaut était invisible jusque-là : la suite `0001` s'arrêtait aux cas `invalid_transition` (C16, C17). | Contrainte remplacée, alignée sur l'énumération de `introduction_requests.status` augmentée de `outcome_declared`. **0006 n'a pas été éditée** et aucune assertion n'a été affaiblie. |

### 9.4 Couverture de `0004_network_suite.sql`

Fixtures : **Awa** (demandeur), **Fatou** (intermédiaire légitime), **Koffi**
(cible), **Serge** (relation d'Awa sans lien avec Koffi), **Zoé** (tiers),
**Béa** (a bloqué Awa), **Yao** (membre sans lien).

| Cas                | Objet                                                                 | Attendu                                                                          |
| ------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| N01                | Demande de connexion déposée au nom d'un tiers                        | rejet                                                                            |
| N02                | Acceptation d'une demande adressée à un tiers                         | `not_addressee`                                                                  |
| N03a/b/c           | Double acceptation                                                    | succès · `invalid_transition` · **1 seule** relation                             |
| N04                | Introduction via un intermédiaire non relié à la cible (D-51)         | `intermediary_not_connected`                                                     |
| N04b               | Insertion directe d'une introduction via un non-contact               | rejet par la politique                                                           |
| N05a/b/c           | Chemins proposés vers Koffi                                           | 1 seul · c'est Fatou · aucun score dans la charge utile                          |
| N06 / N07          | Demande d'introduction légitime · doublon                             | succès · `request_already_sent`                                                  |
| N08                | Transition par le mauvais acteur                                      | `invalid_transition`                                                             |
| N09                | `update` direct sur `introduction_requests`                           | 0 ligne affectée                                                                 |
| N10a/b/c           | Membre ayant bloqué le demandeur : sollicitation, insertion, profil   | `not_found` · rejet · invisible                                                  |
| N11 / N12          | Demande vers soi-même · vers une relation existante                   | `cannot_target_self` · `already_connected`                                       |
| N13a/b/c           | La cible et une introduction en statut `requested`                    | invisible dans les trois voies                                                   |
| N14 / N15          | Acceptation par l'intermédiaire · `intermediary_accepted → completed` | succès · `invalid_transition`                                                    |
| N16                | Bilan « échange réalisé » avant transmission                          | `invalid_transition`                                                             |
| N17a/b/c           | La cible après `introduced`                                           | voit la demande · **pas** `message_to_intermediary` · pas de score de complétion |
| N18                | Clôture « sans suite » par la cible                                   | `not_authorized` (D-50)                                                          |
| N19 / N20          | `target_responded` par la cible · bilan par le demandeur              | succès · `completed`                                                             |
| N21 / N22          | `outcome` enregistré · journal d'événements                           | `exchange_held` · ≥ 5 événements                                                 |
| N23                | Second bilan sur une introduction close                               | `invalid_transition`                                                             |
| N24a/b · N25a/b    | Tiers non partie prenante                                             | invisible · `not_addressee`                                                      |
| N26a/b · N27 · N28 | `list_my_connections`, recherche, `my_network_summary`                | 3 relations · aucun non-contact · 1 résultat · 3                                 |
| N29                | 31ᵉ demande de connexion dans la journée (D-103)                      | `rate_limited`                                                                   |
| N30a/b             | `security_baseline_violations()`, `tables_without_rls()`              | 0 ligne chacun                                                                   |

---

## 10. Modules de valeur — ouverture des politiques (migrations `0040` → `0050`)

**315 politiques** ajoutées sur **133 tables**. Le décompte des tables `public`
sans politique passe de **136 à 3** (§1.2).

Trois règles transverses gouvernent tout ce lot :

1. **Le blocage passe avant tout.** Partout où un membre en atteint un autre —
   réponse à un appel, invitation, parrainage, demande de mentorat, demande
   d'aide de stage, ajout à une conversation, candidature à un projet — la
   politique `WITH CHECK` appelle `private.is_blocked_between()`. Et partout où
   un contenu est lu, le helper d'audience évalue le blocage **avant** le
   niveau de visibilité (D-73).
2. **Les transitions d'état ne passent jamais par une politique.** Quand une
   fonction atomique existe, l'`UPDATE` client est soit inexistant, soit
   verrouillé sur un statut invariant (`status = 'draft'` dans `USING` **et**
   dans `WITH CHECK` : la ligne est un brouillon avant et après, donc aucune
   transition ne peut emprunter ce chemin). Pour `support_tickets` et
   `reports`, où l'édition doit rester possible, un trigger complète la RLS
   (§10.10).
3. **L'administration se résout par `private.has_permission()`**, jamais par un
   test de rôle (D-31) — et il existe des domaines où **aucune** permission
   n'ouvre quoi que ce soit : la messagerie (§10.8) et les données personnelles
   (§10.9).

### 10.1 Appels au réseau (`0040`, 31 politiques, 14 tables)

`private.can_see_network_call()` compose trois filtres **cumulatifs** :
niveau de visibilité D-73, ciblage explicite, blocage.

| Table                                                                                                                    | Politique                           | Cmd             | Règle                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | --------------- | ------------------------------------------------------------------------------------------------ |
| `network_calls`                                                                                                          | `network_calls_select`              | SELECT          | `can_see_network_call(id)`                                                                       |
|                                                                                                                          | `network_calls_insert_own`          | INSERT          | auteur = moi · membre actif · `status = 'draft'`                                                 |
|                                                                                                                          | `network_calls_update_draft`        | UPDATE          | auteur **et** `status = 'draft'` des deux côtés                                                  |
|                                                                                                                          | `network_calls_delete_draft`        | DELETE          | auteur, brouillon                                                                                |
|                                                                                                                          | `network_calls_moderate`            | UPDATE          | `calls.moderate`                                                                                 |
| `network_call_skills`, `_tools`, `_languages`, `_countries`, `_help_types`, `_audience_promotions`, `_audience_profiles` | `<t>_select`                        | SELECT          | `can_see_network_call(call_id)`                                                                  |
|                                                                                                                          | `<t>_write_author`                  | ALL             | `is_network_call_author(call_id)`                                                                |
| `network_call_matches`                                                                                                   | `..._select`                        | SELECT          | `profile_id = moi` **ou** auteur de l'appel                                                      |
|                                                                                                                          | _(privilège de colonne)_            | —               | `score` et `component_scores` retirés à `authenticated`                                          |
| `network_call_responses`                                                                                                 | `..._select`                        | SELECT          | auteur de la réponse · auteur de l'appel · `calls.moderate`                                      |
|                                                                                                                          | `..._create`                        | INSERT          | auteur = moi · `can_see_network_call` · `status = 'new'`                                         |
|                                                                                                                          | `..._update_own` / `..._delete_own` | UPDATE / DELETE | auteur, tant que `status = 'new'`                                                                |
|                                                                                                                          | `..._triage`                        | UPDATE          | auteur de l'appel (aucune fonction atomique n'existe sur ce statut)                              |
| `network_call_recommendations`                                                                                           | `..._involved`                      | SELECT          | recommandeur · auteur de l'appel · **la personne recommandée seulement à partir de `contacted`** |
|                                                                                                                          | `..._create`                        | INSERT          | recommandeur = moi · `status = 'proposed'` · **pas de blocage** avec la personne recommandée     |
|                                                                                                                          | `..._follow`                        | UPDATE          | auteur de l'appel                                                                                |
| `network_call_contributors`                                                                                              | `..._select`                        | SELECT          | moi, ou auteur de l'appel (écrit par `close_network_call`)                                       |
| `network_call_events`                                                                                                    | `..._select`                        | SELECT          | auteur de l'appel ou `calls.moderate`                                                            |
| `saved_network_calls`                                                                                                    | `..._own`                           | ALL             | `profile_id = moi` (D-72)                                                                        |

Aucune politique `UPDATE` ne permet `draft → active` ni la clôture :
`publish_network_call`, `transition_network_call`, `close_network_call` et
`expire_stale_network_calls` restent les seuls chemins (cas N12, N13).

### 10.2 Opportunités et candidatures (`0041`, 42 politiques, 21 tables)

Même modèle d'audience, plus `moderation_status` : une annonce `pending` ou
`rejected` n'est visible que de son auteur et de `opportunities.manage`.

| Table                                                                                   | Politique                                                    | Cmd                  | Règle                                                                                                            |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `opportunities`                                                                         | `opportunities_select`                                       | SELECT               | `can_see_opportunity(id)`                                                                                        |
|                                                                                         | `..._insert_own` / `..._update_draft` / `..._delete_draft`   | INSERT/UPDATE/DELETE | auteur, `status = 'draft'` invariant                                                                             |
|                                                                                         | `opportunities_manage`                                       | ALL                  | `opportunities.manage`                                                                                           |
| `opportunity_skills`, `_tools`, `_languages`, `_countries`, `_audience_*`, `_questions` | `<t>_select` / `<t>_write_author`                            | SELECT / ALL         | `can_see_opportunity` / `is_opportunity_author`                                                                  |
| `opportunity_matches`                                                                   | `..._select`                                                 | SELECT               | `profile_id = moi` ou responsable · `score` et `component_scores` **retirés à `authenticated`**                  |
| `opportunity_interests`                                                                 | `..._own`                                                    | ALL                  | `profile_id = moi`. **L'auteur de l'annonce ne les voit pas** : déclarer un intérêt n'est pas candidater (D-55). |
| `saved_opportunities`                                                                   | `..._own`                                                    | ALL                  | `profile_id = moi`                                                                                               |
| `opportunity_outbound_clicks`                                                           | `..._own` / `..._create`                                     | SELECT / INSERT      | trace strictement personnelle                                                                                    |
| `opportunity_invitations`                                                               | `..._involved` / `..._create`                                | SELECT / INSERT      | invité · inviteur · responsable / inviteur = moi, **pas de blocage**                                             |
| `opportunity_referrals`                                                                 | `..._involved` / `..._create`                                | SELECT / INSERT      | idem + `consent_confirmed` + `status = 'shared'`                                                                 |
| `opportunity_outcomes`, `_beneficiaries`                                                | `..._select`                                                 | SELECT               | responsable ou `analytics.read` (écrits par `close_opportunity`)                                                 |
| `applications`                                                                          | `applications_involved`                                      | SELECT               | `can_see_application(id)` : candidat, **ou** responsable une fois la candidature **soumise**                     |
|                                                                                         | `..._create_draft` / `..._update_draft` / `..._delete_draft` | INSERT/UPDATE/DELETE | candidat, `status = 'draft'` invariant                                                                           |
| `application_answers`, `application_documents`                                          | `..._involved` / `..._write_draft`                           | SELECT / ALL         | via la candidature                                                                                               |
| `application_status_history`                                                            | `..._involved`                                               | SELECT               | via la candidature (écrit par `transition_application_status`)                                                   |
| `profile_documents`                                                                     | `..._own`                                                    | ALL                  | propriétaire                                                                                                     |
|                                                                                         | `..._application_reader`                                     | SELECT               | le responsable lit le CV **joint à une candidature soumise**, et rien d'autre                                    |
|                                                                                         | `..._verify`                                                 | SELECT               | `profiles.verify`                                                                                                |

Le niveau `visibility` d'un `profile_document` **n'ouvre pas** l'accès à un
membre quelconque : un CV n'est pas une section de profil. Le seul chemin d'un
tiers vers un document est un fait constaté — une candidature soumise.

### 10.3 Stages (`0042`, 40 politiques, 16 tables)

Le besoin de stage décrit la situation scolaire d'un étudiant. Les trois
niveaux de `internship_needs.visibility` sont traduits explicitement :

| Niveau                                    | Ce qu'il ouvre                                                                                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `internship_managers_and_relevant_alumni` | `internships.manage`, et l'alumni que **l'étudiant a lui-même sollicité** (`internship_help_requests`) ou dont il a manifesté l'intérêt pour l'offre. La « pertinence » se constate, elle ne se suppose pas (D-55). |
| `verified_members`                        | Les membres dont `ise_profiles.verification_status = 'verified'`.                                                                                                                                                   |
| `partner_organizations`                   | **Personne** : aucun compte organisation n'existe en V1 (MASTER PROMPT §6).                                                                                                                                         |

`internship_applications` est un **carnet de bord déclaratif** (D-55) :
`..._own` pour l'étudiant, lecture seule pour `internships.manage`, personne
d'autre. `internship_followups` (suivi de bien-être) est un échange étudiant ↔
gestion des stages : le maître de stage n'y a **aucun** accès.

### 10.4 Mentorat (`0043`, 24 politiques, 12 tables)

Deux confidentialités **à l'intérieur** du binôme :

- `mentorship_session_notes` — `author_profile_id = moi` uniquement. Un mentor
  ne lit pas les notes de son mentoré, et réciproquement. Le contenu partagé
  vit dans `mentorship_sessions.shared_summary`.
- `mentorship_feedback` — `respondent_profile_id = moi`, plus
  `mentorship.manage` en lecture. Un bilan lisible par l'autre partie cesse
  d'être sincère.

`mentorships_create_from_request` exige une `mentorship_requests` **réellement
`accepted`** entre les deux mêmes profils : une relation ne se forge pas
(cas M14). `mentorship_matches.score` est retiré à `authenticated`.

### 10.5 Communautés (`0044`, 26 politiques, 7 tables)

`communities.visibility` n'a que deux valeurs. `network` ouvre la **fiche** à
tout membre actif ; le **contenu** reste réservé aux membres, sauf billet
explicitement publié en `visibility = 'network'` depuis une communauté
elle-même `network`. `private` : la communauté n'existe que pour ses membres.

`community_memberships_join` encode la politique d'adhésion en base :
`active` immédiat si `join_policy = 'open'`, `pending` si `'request'`, refus si
`'invitation'` — et `role = 'member'` imposé : personne ne s'auto-promeut
modérateur (cas C09, C10).

### 10.6 Projets et consortiums (`0045`, 42 politiques, 16 tables)

Les cinq niveaux de `projects.visibility` sont traduits un par un, **sans
défaut permissif** : `network` · `promotion` (`shares_promotion_with`) ·
`community` (`is_community_member(source_community_id)`) · `invitation_only`
(invitation nominative existante) · `team_only` (équipe seulement).

`project_links.is_confidential` est le cas intéressant : la politique bascule
sur `is_project_member()` pour ces lignes-là, même quand le projet est ouvert
au réseau. Un candidat ne s'auto-sélectionne pas : `..._withdraw` n'autorise
que `submitted → withdrawn` (cas J13).

### 10.7 Actualités et événements (`0046`, 50 politiques, 22 tables) — fuite corrigée

`events.online_url_private` porte le lien de connexion d'un événement en ligne.
`events.online_url_visibility` vaut `registered` ou `all_viewers` : dans le
premier cas le lien ne doit atteindre **que les inscrits**. La RLS filtre des
**lignes** : elle rend la fiche visible à toute l'audience de l'événement, donc
elle ne peut pas retenir cette seule colonne. Sans correctif, n'importe quel
membre voyant l'événement lisait le lien et pouvait s'y connecter sans
s'inscrire — exactement le défaut **D1** de `0028`, transposé aux événements.

Correctif : **privilège de colonne**. `REVOKE SELECT` au niveau table sur
`public.events`, puis `GRANT SELECT` colonne par colonne à l'exception de
`online_url_private`. `INSERT` et `UPDATE` restent accordés sur **toutes** les
colonnes : l'organisateur doit pouvoir écrire le lien, il ne doit pas pouvoir
le lire chez un autre. La lecture passe par `public.get_event_online_url()`.

> **Conséquence côté client** : comme pour `ise_profiles` en `0028`, toute
> requête `select *` sur `public.events` échoue désormais avec `42501`. Les
> clients doivent énumérer leurs colonnes. Toute colonne ajoutée à `events`
> par une migration ultérieure doit être explicitement `GRANT`-ée.

Autres points : `event_registrations` respecte `attendee_list_visibility` **et**
`is_listed` (un inscrit qui se retire de la liste n'apparaît nulle part) ;
`event_resources` a ses trois niveaux propres ; la présence ne s'auto-déclare
pas (`attended` absent du `WITH CHECK`, D-55, cas E11).

### 10.8 Messagerie (`0047`, 15 politiques, 6 tables)

**Aucune permission n'ouvre le contenu des échanges privés** — pas même
`profiles.moderate`, pas même un superadmin (cas G08, G09, G10 ;
MASTER PROMPT §24). Le seul pont vers la modération est `message_reports` :
c'est le **signalant** qui décide de ce qui sort de la conversation.

Ouvrir une conversation exige trois conditions cumulatives, portées par
`private.can_message_profile()` : membre actif, absence de blocage, et
`user_settings.direct_message_policy` du **destinataire** (`members` /
`connections` / `none` ; défaut `members` en l'absence de réglage). Le
sollicitant ne peut pas lire ce réglage lui-même — la politique de
`user_settings` est « propriétaire seulement » — d'où le helper.

`message_hides` est strictement individuel : masquer un message le retire de
**ma** vue seule (cas G12 / G16). Aucune politique `DELETE` sur `messages` :
la suppression est logique (`deleted_at`), pour que l'accusé de réception de
l'autre partie reste cohérent (D-83).

### 10.9 Notifications et paramètres (`0048`, 13 politiques, 8 tables)

Tout ce lot est du `profile_id = private.current_profile_id()`, **lecture
comprise**, et **aucune permission administrative n'y donne accès** (cas T08 à
T10). Aucune politique `INSERT` sur `notifications` : une notification est
émise par le serveur, jamais fabriquée par un client — sinon un membre
pourrait s'en forger une, ou en adresser une à un tiers (cas T07, T13).

`consent_records` et `terms_acceptances` sont **append-only** : `SELECT` +
`INSERT`, aucune politique `UPDATE` ni `DELETE`. Une preuve de consentement se
pose, elle ne se réécrit pas ; une révocation est une **nouvelle ligne**
(cas T14, T15).

### 10.10 Support et modération (`0049`, 20 politiques, 9 tables)

**Notes internes** — `support_messages.is_internal_note` isole les échanges
entre agents. Ouvrir le fil du ticket à son auteur sans distinguer cette
colonne lui aurait livré les notes internes. Ici la distinction est portée par
la **politique** : `is_internal_note` est un attribut de **ligne**, la RLS
suffit, sans privilège de colonne (cas U07).

**Machines d'états et trigger** — `support_tickets.status` et `reports.status`
ont chacun leur fonction atomique. Mais un agent doit pouvoir s'assigner un
ticket et un modérateur annoter un signalement : il faut donc une politique
`UPDATE`. Or **une politique RLS ne sait pas comparer `OLD` et `NEW`**. Le
garde-fou est donc un trigger `BEFORE UPDATE`, `private.guard_status_transition()` :

```
new.status IS DISTINCT FROM old.status
AND current_user NOT IN ('postgres','supabase_admin','service_role')
  -> RAISE 'invalid_transition' (P0001)
```

Les fonctions de transition sont `SECURITY DEFINER` et appartiennent à
`postgres` : elles s'exécutent avec `current_user = postgres` et passent. Un
client `authenticated` est refusé — **y compris un agent porteur de
`support.manage`** (cas U08, U12, U15). La politique ouvre l'édition, le
trigger ferme la transition.

**D-85** — l'urgence n'est pas choisie par le demandeur : le `WITH CHECK`
d'insertion impose `urgency_source = 'system'` et `urgency_set_by_profile_id
IS NULL` (cas U09).

**Confidentialité de la modération** — `report_events` et `moderation_actions`
ne sont lisibles que par `profiles.moderate` : ni le signalant ni la personne
signalée n'accèdent aux motifs internes. Un signalement n'est jamais visible de
la personne signalée : aucune politique ne s'appuie sur `target_owner_profile_id`
(cas U03, U04, U11).

### 10.11 Plateforme (`0050`, 12 politiques, 7 tables)

| Table                                | Lecture                                                                                        | Écriture            |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------- |
| `platform_settings`                  | `scope = 'member'` seulement                                                                   | `settings.manage`   |
| `feature_flags`                      | `is_enabled` seulement — un drapeau éteint révélerait le nom d'une fonctionnalité non annoncée | `settings.manage`   |
| `feature_flag_overrides`             | `profile_id = moi`                                                                             | `settings.manage`   |
| `maintenance_windows`                | `status in ('scheduled','in_progress')`                                                        | `ops.manage`        |
| `promotion_activation_campaigns`     | `promotions.manage`                                                                            | `promotions.manage` |
| `promotion_membership_confirmations` | répondant, ou `promotions.manage`                                                              | répondant           |
| `promotion_stat_snapshots`           | `promotions.manage` ou `analytics.read`                                                        | —                   |
| `domain_events`                      | **aucune** (§1.2)                                                                              | **aucune**          |

`0050` remplace aussi `private.security_baseline_violations()` : la liste des
colonnes masquées passe de **1** à **9 privilèges**, avec le type de privilège
concerné, pour que toute réapparition d'un `GRANT` fasse échouer la CI.

| Colonne                                           | Privilèges contrôlés                                        |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `ise_profiles.profile_completion`                 | SELECT · UPDATE · INSERT                                    |
| `network_call_matches.score`, `.component_scores` | SELECT                                                      |
| `opportunity_matches.score`, `.component_scores`  | SELECT                                                      |
| `mentorship_matches.score`                        | SELECT                                                      |
| `events.online_url_private`                       | SELECT **seulement** (l'organisateur doit pouvoir l'écrire) |

### 10.12 Défauts réels trouvés et corrigés

Les politiques ont été écrites, puis les harnais joués. Aucun test n'a été
affaibli pour passer.

| #   | Domaine              | Défaut                                                                                                                                                                                                                                                | Correctif                                                                                                                                            |
| --- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1  | Événements           | `events.online_url_private` atteignable par tout membre voyant l'événement, alors que `online_url_visibility = 'registered'` le réserve aux inscrits. La RLS filtre des lignes, pas des colonnes.                                                     | Privilège de colonne (lecture seule retirée) + `public.get_event_online_url()`, `0046`. Contrôlé par `security_baseline_violations()` et le cas E01. |
| V2  | Matching             | `score` / `component_scores` des trois tables de matching lisibles par le client — la base64 du curseur de `match_profiles()` avait déjà montré ce que vaut un score qui fuit (§8.4).                                                                 | Privilège de colonne sur `network_call_matches`, `opportunity_matches`, `mentorship_matches` (`0040`, `0041`, `0043`). Cas N09, N18, O08, M10.       |
| V3  | Support / modération | Ouvrir `UPDATE` à `support.manage` et `profiles.moderate` pour l'assignation et l'annotation rouvrait, de fait, les machines d'états `transition_support_ticket` et `transition_report` : une politique RLS ne peut pas exiger « `status` inchangé ». | Trigger `private.guard_status_transition()` sur `support_tickets` et `reports` (`0049`). Cas U08, U12, U15.                                          |

### 10.13 Rejouer les 11 harnais

Même modèle qu'en §7 : bloc `DO` unique, fixtures sous `postgres`,
`RAISE EXCEPTION` final qui annule la transaction. Aucune donnée de test ne
subsiste (vérifié : `ise_profiles.is_test_account` et `auth.users` `test+%`
restent à 0 après exécution).

```bash
for f in supabase/tests/rls/00{05,06,07,08,09,10,11,12,13,14,15}_*.sql; do
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=0 -f "$f"
done
```

Le script de CI doit chercher `_TESTS_OK:` **et** `0 echec` dans chaque
sortie, et échouer sur l'absence de l'un des deux.

---

## 11. CMS et site public — migrations `0057` → `0066`

Détail fonctionnel dans `docs/cms.md`, `docs/cms-automation.md` et `docs/featured-profile.md`.
Cette section ne consigne que ce qui relève de la sécurité d'accès.

### 11.1 Le principe qui n'a pas bougé

Le site public **n'a fait céder aucune barrière**. `anon` conserve zéro privilège de table sur
`public`, `private` et `analytics` — état posé en `0026`. PUB-001 ne lit aucune table métier : il
appelle dix fonctions `SECURITY DEFINER` dont le contrat est de ne projeter que des champs
explicitement autorisés (addendum §44, §45 : « ne pas assouplir RLS sur une table complète
uniquement pour afficher quatre cartes »).

C'est la seule ouverture consentie, et elle est bornée par un contrôle automatisé (§11.5).

### 11.2 Politiques des huit tables CMS (`0058`, 19 politiques)

Toutes ciblent explicitement `to authenticated` et se résolvent par `private.has_permission()`
(D-31). Table de correspondance complète dans `docs/cms.md` §6.

Trois points méritent d'être notés ici :

- **`cms_featured_profile_history` n'a qu'une politique `SELECT`.** Aucune politique `INSERT`,
  `UPDATE` ni `DELETE` : les écritures passent exclusivement par les fonctions de `0059`, qui
  journalisent chaque override (addendum §22). Une écriture directe casserait la piste d'audit.
- **`cms_sections` : `DELETE` exige `cms.publish` _et_ `not is_structural`.** Les neuf sections du
  squelette de la landing ne se suppriment pas par accident (CDC §28).
- **`cms_content_overrides` : la permission dépend de la ligne.** Un override sur
  `section_key = 'featured_profile'` exige `cms.featured_profile.manage` ; les autres, `cms.edit`.

### 11.3 Ce que la RLS ne sait pas faire, et ce qui le fait à sa place

La RLS filtre des **lignes**. Elle ne compare pas `OLD` et `NEW`, donc elle ne peut pas exiger
« `status` inchangé ». Sans garde-fou, un porteur de `cms.edit` aurait écrit
`status = 'published'` en `UPDATE` et contourné la vérification de `cms.publish`.

Deux triggers, sur le modèle de `private.guard_status_transition()` (`0049`) :

| Trigger (`0058`)                        | Tables                                                        | Refuse                                                                                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `private.cms_guard_publication_state()` | `cms_sections`, `cms_carousel_items`, `cms_partner_campaigns` | toute écriture directe de `status`, `published_snapshot`, `previous_published_snapshot`, `published_at`, `published_by_profile_id` ; à l'INSERT, tout statut autre que `draft` / `scheduled` |
| `private.cms_guard_schedule_state()`    | `cms_publication_schedule`                                    | déclarer un ordre `applied` à la main, ou toucher `applied_at` / `run_count` / `last_run_at`                                                                                                 |

Les fonctions de transition sont `SECURITY DEFINER` détenues par `postgres` : elles passent. Cas de
test C04 et C07.

### 11.4 Fonctions `SECURITY DEFINER` ajoutées (D-101)

Toutes déclarent `set search_path = ''` et qualifient chaque objet.

| Fonction                                                                                                                                            | Motif | Justification                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public.publish_cms_content(text, uuid)`                                                                                                            | B     | Seul chemin de publication. Exige `cms.publish`, `SELECT … FOR UPDATE` sur la ligne, fige un instantané public et conserve le précédent. Le nom de table ne vient jamais du client : `private.cms_table_for()` est une liste blanche fermée. |
| `public.transition_cms_content(text, uuid, text, text)`                                                                                             | B     | Matrice des transitions hors publication. Dépublier vide l'instantané public dans la même transaction. `cms.schedule` pour `scheduled`, `cms.publish` sinon.                                                                                 |
| `public.rollback_cms_content(text, uuid)`                                                                                                           | B     | Restaure la version publiée précédente sans toucher au brouillon courant.                                                                                                                                                                    |
| `public.override_featured_profile`, `exclude_profile_from_featured`, `set_featured_profile_automation`                                              | B     | Exigent `cms.featured_profile.manage`, journalisent. L'override **refuse un profil non éligible** : il ne contourne pas le consentement.                                                                                                     |
| `public.run_cms_automations()`                                                                                                                      | B     | Point d'appel unique des tâches. `ops.manage` pour un appelant authentifié, ou identité `service_role` / `postgres` pour un ordonnanceur.                                                                                                    |
| `public.get_cms_automation_status()`                                                                                                                | A     | Lit `cron.job` et `cron.job_run_details`, hors d'atteinte d'un client. Exige `cms.read` ou `ops.read`.                                                                                                                                       |
| `public.get_partner_campaign_metrics(uuid)`                                                                                                         | A     | Lit `analytics`, non exposé (D-16). Exige `cms.partners.manage` ou `analytics.read`.                                                                                                                                                         |
| `private.cms_table_for`, `landing_section_hidden`, `landing_override_position`, `landing_is_excluded`, `landing_media`, `featured_profile_eligible` | A     | Helpers. Accordés à **aucun** rôle client.                                                                                                                                                                                                   |
| `private.expire_cms_content`, `publish_scheduled_cms_content`, `run_daily_featured_profile`, `publish_featured_profile`, `cms_automation_status`    | B     | Tâches planifiées. Accordées à **aucun** rôle client : seul `postgres` (via `pg_cron`) et `public.run_cms_automations()` les atteignent.                                                                                                     |
| **Les neuf `public.get_landing_*()`**                                                                                                               | A     | Projections public-safe. Voir §11.5.                                                                                                                                                                                                         |
| `public.record_public_landing_event(...)`                                                                                                           | B     | Seul chemin d'écriture des événements publics. Huit types autorisés, métadonnées bornées à cinq clés structurelles, aucune IP ni empreinte.                                                                                                  |

### 11.5 La seule ouverture à `anon`, et sa limite

Dix fonctions, pas une de plus :

```
get_landing_carousel · get_landing_sections · get_landing_news · get_landing_events
get_landing_opportunities · get_landing_featured_profile · get_landing_expertises
get_landing_partners · get_landing_stats · record_public_landing_event
```

Ce qu'elles ne projettent jamais : e-mail, téléphone, adresse, date de naissance,
`profile_completion`, `bio`, `headline`, corps d'article, description complète d'une offre,
rémunération, coordonnées de contact, `events.online_url_private`, identifiants de membres tiers.

Filtres d'audience appliqués à la source : `visibility = 'members'` exigé pour actualités,
événements et opportunités — un contenu réservé à une promotion ou à une communauté ne franchit
jamais la frontière publique.

`private.security_baseline_violations()` reçoit un **sixième contrôle** (`0061`, étendu en `0063`) :

```
anon_function_grant — toute fonction de `public` ou `private` exécutable par `anon`
                      et absente de cette liste blanche est une violation
```

### 11.6 Défaut réel trouvé par ce contrôle, et corrigé

| #   | Défaut                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Correctif                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V4  | Le nouveau contrôle a immédiatement signalé **53 fonctions** de `public` et `private` exécutables par `anon`. Cause : en PostgreSQL, `EXECUTE` est accordé à `PUBLIC` par défaut. Les ACL le montrent sans ambiguïté — `private.has_permission` portait `{=X/postgres, postgres=X, authenticated=X}`, et l'entrée `=X` **est** le privilège de PUBLIC. Les lots `0028`, `0029`, `0039`, `0052`–`0056` révoquaient bien fonction par fonction ; les lots `0001`–`0027` et `0030`–`0051` ne le faisaient pas. **Portée réelle** : la plupart de ces fonctions commencent par `raise 28000` si `auth.uid()` est nul, donc un appel `anon` échouait. Mais pas toutes — `private.security_baseline_violations()`, `tables_without_rls()`, `tables_without_policy()`, `storage_baseline_violations()` décrivent la structure de sécurité du schéma, et `private.mask_email_hint()` est une fonction pure. Fuite de **structure**, pas de données. | `0062` : correction conservatrice — rendre explicite le privilège que `authenticated` et `service_role` détenaient déjà via PUBLIC, **puis** retirer PUBLIC et `anon`. Aucun appelant légitime perdu. Les fonctions déjà fermées (`log_audit`, `consume_rate_limit`, `apply_claim_approval`…) n'ont pas été touchées : PUBLIC n'y figurait pas.                                             |
| V5  | Le garde-fou anti-régression de `0062` (`ALTER DEFAULT PRIVILEGES … REVOKE` seul) n'a créé **aucune** entrée `pg_default_acl` pour `private`. La première fonction créée ensuite y naissait avec `proacl = NULL`, donc `EXECUTE` pour PUBLIC. Le contrôle l'a signalé pendant la suite `0021`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `0066` : `GRANT` explicite d'abord — ce qui matérialise l'entrée — puis `REVOKE`. La migration **vérifie son propre effet** et échoue si l'entrée n'est pas conforme. Dans `private`, le défaut n'accorde plus `EXECUTE` qu'à `postgres` : un helper destiné à `authenticated` doit porter son `GRANT` explicite. L'oubli produit un refus 42501 bruyant, jamais une ouverture silencieuse. |

### 11.7 Colonnes de `ise_profiles` et privilèges de colonne

Depuis `0028`, `authenticated` n'a plus de privilège au niveau **table** sur `ise_profiles` mais
colonne par colonne. Les deux colonnes ajoutées en `0057` ont donc reçu un `GRANT` explicite :

```sql
grant select, update, insert (public_summary, allow_public_feature)
  on public.ise_profiles to authenticated;
```

Sans lui, le membre n'aurait pu ni lire ni écrire son propre résumé public. `profile_completion`
reste masquée : aucune colonne n'a été démasquée.

### 11.8 Couverture de `0021_cms_suite.sql` — 60 cas

| Groupe | Cas       | Objet                                                                                                                                                                                                    |
| ------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B      | B01 – B06 | un membre sans permission CMS ne voit **rien** du CMS et n'écrit rien                                                                                                                                    |
| C      | C01 – C07 | un `cms_editor` lit et modifie un brouillon ; échoue à publier (`not_authorized`), à forcer le statut (`invalid_transition`), à supprimer, à toucher une campagne ou un ordre de programmation           |
| D      | D01 – D02 | un `cms_publisher` publie ; `transition_cms_content` refuse `published` (`use_publish_cms_content`)                                                                                                      |
| E      | E01 – E07 | la slide publiée sort ; **une édition non publiée n'atteint pas le site** ; la dernière version publiée reste servie ; campagne future et campagne échue absentes ; mention de transparence systématique |
| F      | F01 – F04 | expiration automatique ; seconde exécution idempotente ; une slide sponsorisée ne survit pas à sa campagne                                                                                               |
| G      | G00 – G21 | éligibilité, rotation, idempotence, override, reprise, suspension, **teaser sans donnée privée**                                                                                                         |
| H      | H01 – H04 | statistiques issues de comptages réels, sources nommées, aucun chiffre de maquette                                                                                                                       |
| I      | I01 – I06 | analytics publics, métadonnées filtrées, types fermés, CTR réel et `NULL` sans impression                                                                                                                |
| J      | J01 – J02 | `security_baseline_violations()` = 0 · `tables_without_rls()` = 0                                                                                                                                        |

```
ERROR:  P0001: CMS_TESTS_OK: 60 cas, 0 echec
```
