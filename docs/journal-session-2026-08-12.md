# Journal de session — 10 au 12 août 2026

Ce document journalise le travail effectué sur le dépôt `blyped/ise` (plateforme réseau d'anciens élèves « Compétences ISE ») pendant une longue session de développement autonome, du 10 août (SA-023→026, fin d'après-midi) au 12 août 2026 (dernier commit mobile, 05:00 UTC). Il complète — sans les modifier — `docs/screen-traceability-matrix.md`, `docs/decisions.md`, `docs/migration-integrity.md` et `docs/implementation-status.md`, qui restent les documents de référence pour l'état d'avancement écran par écran, les décisions produit et l'intégrité des migrations.

Objectif de ce fichier : donner à quelqu'un qui reprend le projet plus tard une vue chronologique de ce qui s'est passé, pourquoi, et ce qui reste ouvert — sans avoir à reconstituer l'historique à partir de dizaines de commits épars.

---

## 1. Clôture de la Phase 6 (Superadmin)

**Ce qui a été fait.** Les deux derniers écrans du back-office Superadmin — SA-049 (Journal d'audit, liste) et SA-050 (Journal d'audit, détail d'une entrée) — ont été livrés :

- `9a4e3076` — écran liste `/administration/audit`
- `6bb31808` — écran détail `/administration/audit/[entryId]`
- `245f8269` — suite RLS `supabase/tests/rls/0038_admin_audit_suite.sql` : 17 cas, 0 échec
- `e360d2a2` — décision **D-158** consignée dans `docs/decisions.md` : les deux routes sont conservées distinctes (liste de lecture rapide vs. revue individuelle journalisée), contrairement aux fusions décidées plus tôt pour SA-028/029 (**D-156**) et SA-031/032/033 (**D-157**, ajoutée après coup, voir section 2)
- `c6d4325e` puis `d701309a` — mise à jour de `docs/screen-traceability-matrix.md` et `docs/implementation-status.md`

**Pourquoi pas de nouvelle migration.** SA-049/050 réutilisent intégralement des fonctions déjà en place : `private.read_audit_log()`, exposée depuis la migration `0083`. Aucune migration `010x` n'a été nécessaire pour ce lot — seule la couche front (écrans, i18n, RLS de test) a été ajoutée.

**État final.** Avec SA-049/050 livrés, les 50 écrans de la série SA sont désormais tous traités : livrés, fusionnés dans un écran voisin par décision documentée (D-156, D-157, D-158), ou explicitement abandonnés (décisions **C-06**/**C-07**). Le back-office Superadmin est donc complet au sens du référentiel d'écrans — voir `docs/screen-traceability-matrix.md` pour le détail ligne par ligne, non reproduit ici.

---

## 2. Incidents et récupération — troncatures accidentelles de fichiers volumineux

**Le problème racine.** L'outil GitHub `push_files` remplace toujours un fichier dans son intégralité : il n'existe pas de mode diff/patch partiel côté MCP GitHub utilisé dans cette session. Un envoi partiel (contenu tronqué en amont, mémoire de contexte insuffisante, erreur de copie) écrase silencieusement tout le reste du fichier, sans avertissement de la plateforme.

`docs/screen-traceability-matrix.md` (environ 478 lignes, ~246 Ko, tables markdown très denses) a été touché à deux reprises distinctes :

**Premier incident (11 août, ~17h00-18h00 UTC).** Le commit `3e9f241b` (« SA-023→026 livré dans la matrice ») a tronqué le fichier à environ 240 lignes. Une première tentative de correction l'a, par erreur, tronqué encore plus sévèrement — jusqu'à environ 87 lignes, coupant en plein milieu du tableau de la série ISE. La récupération a nécessité une reconstruction incrémentale par tranches, visible dans la séquence de commits :

`1b976167` (chunk 1/4, lignes 1-88) → `c09a5a55` (chunk 2/4, lignes 89-176) → `cd9d7de4` (chunk 3/4, lignes 165-276) → `e32bfd2b` (lignes 1-125) → `e70aa8dd` (lignes 1-225) → `b13697d0` (lignes 1-350) → `5de093cc` (fichier complet restauré, 476 lignes) → `f6de106c` (« revert accidental truncation »).

Un incident annexe de corruption d'encodage (introduit par un outil de récupération lors d'une session antérieure) a également été corrigé au passage dans `b555fb18` (« Reconstruction complète du fichier à partir du contenu source, encodage vérifié caractère par caractère »).

**Deuxième incident (11 août, ~22h25-22h40 UTC).** Pendant les commits de documentation liés à SA-030→033 (Événements), la fin du fichier (séries SYS/PUB/CMS, récapitulatif, règles, écarts) a de nouveau été tronquée. Corrigée en deux temps :

- `701ad17c` — restauration de la fin tronquée
- `324f7669` — restauration complète vérifiée (478 lignes, hash `5a7ca0f`)

**Incident annexe sur un autre fichier.** Le même mode de défaillance a touché `docs/migration-integrity.md` le 12 août : le commit `da9fc2e4` (ajout de l'Annexe B, clôture de 15/20 migrations divergentes) a accidentellement remplacé tout le fichier par un texte `PLACEHOLDER`. Corrigé immédiatement par `9d30e4f1`, qui restaure le contenu original (411 lignes) complété par l'Annexe B (117 lignes). Ceci confirme que le risque n'était pas propre au fichier de traçabilité mais à la méthode d'envoi elle-même dès qu'un fichier dépasse une taille modeste.

**Procédure retenue depuis ces incidents**, désormais appliquée systématiquement pour tout fichier volumineux avant un `push_files` :

1. Récupérer le contenu actuel complet du fichier distant.
2. Faire l'édition ciblée localement (Python/bash), jamais par réécriture manuelle partielle.
3. Relire l'intégralité du résultat par tranches avant envoi, pour confirmer qu'aucune section n'a été perdue.
4. Reconstruire un seul appel `push_files` avec le contenu **complet** (jamais un extrait).
5. Vérification post-push obligatoire : récupérer le fichier tel que poussé, compter les lignes, vérifier la répartition par série (ISE/SA/OPS/SYS/PUB/CMS pour la matrice), rechercher les caractères de remplacement `U+FFFD` révélateurs d'une corruption d'encodage.

C'est cette procédure qui a été suivie pour la rédaction et l'envoi du présent journal (nouveau fichier, donc risque de troncature plus faible, mais vérification post-push tout de même effectuée — voir tout en bas).

---

## 3. Durcissement (Phase 8-9)

**Advisors Supabase (sécurité + performance) — `0aff7749`.**

Sécurité, migrations `0101`, `0103`, `0104` :
- `search_path` figé sur 10 fonctions signalées `function_search_path_mutable`
- politiques RLS explicites `using (false)` ajoutées sur trois tables fermées par conception mais sans politique déclarée (`rls_enabled_no_policy`) : `domain_events`, `notification_deliveries`, `profile_search_documents` — aucun changement de comportement, ces tables étaient déjà inaccessibles par défaut depuis la migration `0020`
- retrait d'un `EXECUTE` `anon`/`PUBLIC` non intentionnel détecté via `private.security_baseline_violations()` sur `private.score_profile_pair` (fonction de rapprochement de doublons de profils)

Performance, migration `0102` :
- 28 index ajoutés sur des clés étrangères à fort trafic (`unindexed_foreign_keys`) : connexions, introductions, recommandations, candidatures, appels au réseau, modération de communauté, réclamations de profil, vérifications RBAC. Le périmètre a été choisi par jugement — le back-office admin, à trafic plus faible, a été volontairement laissé de côté.

Deux constats des advisors ont été examinés et **délibérément non modifiés**, jugés intentionnels et déjà documentés : `anon EXECUTE` sur les 10 fonctions `get_landing_*`/`record_public_landing_event` (**D-125**) et `authenticated EXECUTE` sur l'ensemble des fonctions RPC publiques, qui constituent la surface d'API de l'application (**D-126**).

**Audit E2E — `c93dd95e` et `42651050`.**

La suite Playwright existante (`apps/web/e2e/public-redirect.spec.ts`) a été vérifiée saine, sans dérive par rapport au code actuel. La lacune identifiée : aucune couverture E2E des 14 routes `/administration/*` du back-office Superadmin. Trois fichiers de spécifications de fumée ont été écrits, avec un module d'utilitaires partagé (`admin-helpers.ts`) :

- `admin-smoke.spec.ts` — SA-001 (compteurs réels du tableau de bord) + un test de largeur par route statique livrée (22 routes de `src/lib/routes/admin.ts`), tolère un refus SYS-006 (permission manquante) comme issue légitime
- `admin-permissions.spec.ts` — SYS-006/D-93 : visiteur anonyme → `/connexion`, membre authentifié sans permission admin → `/acces-refuse`
- `admin-communities.spec.ts` — SA-027→029, flux liste → création → fiche → changement de statut ; désactivé par défaut (`E2E_ADMIN_ALLOW_WRITES` doit valoir `'true'`) car il écrit en production, données préfixées `[E2E]` et horodatées, communauté archivée en fin de scénario

**Ces specs n'ont jamais été exécutées.** Le bac à sable de développement bloque l'accès réseau à `*.supabase.co`, ce qui empêche toute exécution locale — même limitation que celle déjà documentée pour `public-redirect.spec.ts`.

Deux points restent bloqués et nécessitent une action humaine :
1. L'ajout au workflow CI `.github/workflows/e2e.yml` (déclenchement de ces nouvelles specs, configuration des secrets `E2E_SUPERADMIN_EMAIL`/`E2E_SUPERADMIN_PASSWORD`) — le connecteur GitHub utilisé dans cette session n'a pas le scope de permission nécessaire pour modifier les fichiers de workflow.
2. Le provisionnement d'un compte superadmin de test sur le projet Supabase de production — volontairement **non créé** par l'agent par prudence (projet Supabase unique = production, **C-01** ; aucune convention `is_test_account`/`test+` n'existe pour les comptes superadmin, seulement pour `profiles`, **D-104**).

---

## 4. Consommateur de notifications in-app

**Constat de départ.** `public.domain_events` était déjà alimenté par une quarantaine de fonctions RPC métier, mais rien ne les lisait : aucun membre ne recevait jamais de notification, malgré 33 types de notification déjà seedés en base.

**Solution livrée — `8421b9de`, migration `0105_notification_consumer.sql`.**

Mécanisme à base de `pg_cron` (réutilisant le pattern déjà en place pour l'automatisation CMS, migrations `0059`/`0060`, décision **D-129**), plutôt qu'un trigger `AFTER INSERT` : le fan-out d'un `network_call.published` touche un nombre variable de destinataires (`network_call_matches`), mieux traité en lot par un worker périodique que dans la transaction métier qui a écrit l'événement.

- `private.emit_in_app_notification(...)` : point d'entrée unique, respecte `notification_preferences.in_app_enabled`, `muted_until`, et la déduplication (`notifications.deduplication_key`). Écrit à la fois dans `public.notifications` (table lue par l'écran ISE-098 Centre de notifications) et `notification_deliveries` (table d'observabilité technique, statut `delivered` immédiat puisqu'il n'y a pas de fournisseur externe pour le canal in-app).
- `private.process_pending_domain_event_notifications(p_batch_limit)` : le consommateur proprement dit, `for update skip locked`, gestion d'erreur par événement (statut `failed` + compteur de tentatives sans bloquer le lot), marque tout événement `pending` comme `processed` même sans notification produite (sémantique outbox standard, évite un backlog illimité pour les types non couverts).
- Tâche planifiée `notifications_process_domain_events`, toutes les 2 minutes.

**Couverture.** 9 types d'événements sur une quarantaine possibles aujourd'hui : `connection.requested/declined/withdrawn`, `introduction.requested`, `mentorship.request_submitted/request_answered/started`, `community.comment_created`, `event.registration_created`, `network_call.published` (fan-out via `network_call_matches`).

**Lacune découverte et documentée dans l'en-tête de la migration** : `submit_application` et `transition_application_status` (candidatures) ainsi que les demandes de recommandation n'écrivent aujourd'hui **aucun** `domain_event`. C'est un prérequis à traiter avant de pouvoir notifier ces deux cas, pourtant identifiés comme prioritaires côté produit.

**Tests.** `supabase/tests/rls/0039_notification_consumer_suite.sql` — 18 cas (déduplication, fan-out avec exclusion de l'auteur, préférence membre respectée, type non couvert marqué `processed` sans effet, tâche `pg_cron` active, `security_baseline_violations()` = 0). Exécutée en direct : 18/18, 0 échec, transaction de test auto-annulée (aucune donnée résiduelle).

---

## 5. Réalignement documentaire des migrations divergentes

**Contexte.** `docs/migration-integrity.md` signalait 20 migrations sur 74 dont le fichier du dépôt divergeait du SQL réellement appliqué en base de production.

**Travail effectué — `da9fc2e4` (Annexe B), corrigé par `9d30e4f1` après l'incident de troncature décrit en section 2.**

15 des 20 migrations signalées ont été vérifiées intégralement via une comparaison « super-canonique » — normalisation qui neutralise les commentaires de fin de ligne, les instructions `comment on`, et les délimiteurs de dollar-quoting (`$$`) en plus de la normalisation de base déjà en usage : `0030, 0031, 0032, 0033, 0034, 0036, 0038, 0040, 0042, 0043, 0045, 0046, 0049, 0056, 0067`.

Résultat : toutes bénignes — 13 purement cosmétiques (libellés de commentaires `comment on`), 1 forme SQL équivalente (`0043` : `execute format()` vs. `execute` littéral), 1 combinant les deux. **Aucun cas ne nécessite d'arbitrage humain.**

**Restent au statut « divergent, nature non confirmée »**, faute de temps dans cette passe, et explicitement signalées comme telles plutôt que classées bénignes par défaut : `0070_promotions_api`, `0072_communities_api`, `0073_projects_api`, `0074_news_events_api`, `0075_mentorship_api`.

**Principe retenu, documenté dans la nouvelle Annexe B** : la base de production fait foi pour le comportement réel constaté, mais c'est le dépôt qui doit être corrigé pour refléter fidèlement ce qui est appliqué — jamais l'inverse — et **sans jamais éditer un fichier de migration déjà appliqué** (règle du projet). En conséquence, aucun fichier de `supabase/migrations/` n'a été modifié dans ce travail ; seule l'annexe documentaire de `docs/migration-integrity.md` a été complétée.

---

## 6. Démarrage et construction de la Phase Mobile (Expo / React Native)

### 6.1 Bootstrap initial

- `a2176676` — scaffold `apps/mobile` (Expo managed workflow, TypeScript strict, `extends tsconfig.base.json`), intégré au workspace pnpm existant sans modification de `pnpm-workspace.yaml`
- `10cea11a` — jetons de thème (`@ise/design-tokens` adapté pour React Native, **D-90/D-91**), validation des variables `EXPO_PUBLIC_*`, i18n français minimal, composants d'interface partagés (`Screen`, `EmptyState`, `ErrorState`, `Button`, `TextField`)
- `c679535d` — authentification Supabase : stockage sécurisé selon le pattern **LargeSecureStore** (clé AES-256 bits par entrée dans `expo-secure-store`/Keychain-Keystore, valeur chiffrée dans `AsyncStorage`, contournant la limite ~2048 octets d'`expo-secure-store` tout en gardant la session hors du disque en clair), écran de connexion ISE-001
- `3209f662` — navigation à 5 destinations (**D-94** : Accueil, Réseau, action centrale, Opportunités, Moi), `RootNavigator` équivalent mobile de `middleware.ts` (**D-155**, jamais de tabs montés sans session valide), écran d'accueil réel ISE-015

Un incident mineur de troncature (`TextField.tsx`, styles coupés lors d'un commit) a été auto-détecté et corrigé dans la foulée (`3e2747d2`).

### 6.2 Deuxième vague — trois écrans réels supplémentaires

- `a217d284` — Réseau (ISE-040) : `list_my_connections` + `my_network_summary`
- `37c01352` — Opportunités (ISE-055) : `list_opportunities`
- `e3b3dd1b` — Moi (ISE-016) : profil, score de complétion privé (**D-72**), déconnexion

Le suivi documentaire (`c50d1ebb`) confirme l'état : 4 écrans mobiles réels branchés sur le vrai backend à ce stade (Accueil, Réseau, Opportunités, Moi).

### 6.3 Troisième vague — portage massif depuis les maquettes réelles

Travail parallélisé sur plusieurs agents travaillant simultanément, chacun sur des fichiers isolés pour éviter toute collision d'écrasement mutuel. Portage à partir des vraies maquettes du dossier « Maquettes Web et Mobile » (variantes `_Mobile_375.png`) :

- **Onboarding complet ISE-002→014** (12 écrans) : création de compte, mot de passe oublié/réinitialisation (`c7bcd519`), confirmation de réclamation de profil et étape de vérification (`4da572cd`), promotion + signalement de promotion absente (`9b0f5662`), compétences + secteurs (`09338ac2`), localisation + disponibilité (`4f7f0a24`), finalisation avec score lu en base uniquement (`d9205220`). Persistance de progression via `profile_onboarding_progress` (**D-112**). Un incident de troncature sur `OnboardingStack.tsx` (un seul écran au lieu de 12, `Stack.Navigator` manquant) a été détecté et corrigé immédiatement (`06bfe700`).
- **Recherche & découverte ISE-034→037** (4 écrans, `7297fb5b`) : recherche, résultats (pagination keyset **D-151**/E-01, motifs de pertinence **D-152**/E-02 uniquement en mode pertinence), enregistrement d'alerte, profil trouvé — écarts déjà tranchés dans `docs/decisions.md` respectés (pas de total de résultats affiché, pas de score numérique).
- **Relations & introductions ISE-038→046** (8 écrans, `8128f7d7`) : respecte **D-50/D-51** (chemin d'introduction limité à un seul intermédiaire), **D-119** (libellé qualitatif recommended/relevant/possible, jamais un score chiffré), **D-120/F-07** (ignorer une invitation n'écrit rien côté serveur), **F-13** (bilan fermé tant que `target_responded` n'est pas constaté).
- **Appels au réseau ISE-047→054** (6 écrans, `6e79712f` → `1ffc5405`) : le wizard de création en 4 étapes (ISE-049→052) a été fusionné en un seul écran (`CreateNetworkCallScreen`), suivant la structure réelle déjà utilisée côté web plutôt qu'un découpage artificiel en 4 pages.
- **Profil & disponibilité ISE-017→033** (18 écrans, `18f81d14` pour la couche requêtes/navigation, puis 6 commits de lots `feat(mobile): écrans profil-management batch 1/6` à `6/6`, de `38eab118` à `fa5ed859`) : respect de **D-117** (dépôt de photo annoncé mais non actif), **D-75** (niveau de compétence déclaratif), **D-72** (aucun score public), **D-73** (visibilité à 4 niveaux). Un fichier `_shared.tsx` propre à ce lot a été introduit (Card, Pill, sélecteur de visibilité, etc.), volontairement hors de `components/` pour respecter l'isolation entre lots parallèles.
- **Opportunités ISE-056→066** (11 écrans, sur plusieurs commits de `55c6619b` à `3653022d`) : respect strict de **D-55** — aucune candidature externe n'est jamais marquée « envoyée » automatiquement ; `transition_application_status()` n'accepte que les transitions renvoyées par `get_application` (`allowed_transitions`).

**Convention systématique pour permettre le travail parallèle sans collision** : chaque lot crée ses propres fichiers isolés — écrans dans un sous-dossier dédié, fichier de requêtes dédié (`lib/queries/*.ts`), pile de navigation dédiée (`navigation/*Stack.tsx`), fichier i18n dédié (`i18n/*.ts`) — et documente dans son message de commit les instructions d'intégration exactes dans les fichiers partagés (`AppTabs.tsx`, `RootNavigator.tsx`, `navigation/types.ts`, `i18n/fr.ts`), **sans jamais les modifier directement**. Résultat : ces fichiers partagés n'ont pas été touchés depuis le commit `3209f662` (navigation initiale à 5 destinations) — chaque nouvelle pile de navigation (`OnboardingStack`, `SearchStack`, `RelationsStack`, `NetworkCallsStack`, `ProfileManagementStack`, `OpportunitiesDetailStack`) existe et passe le typecheck, mais n'est pas encore montée dans `AppTabs.tsx`/`RootNavigator.tsx`.

**Vérification systématique.** `pnpm --filter @ise/mobile typecheck` (0 erreur) rejoué après chaque lot dans un environnement sandbox isolé, avec relecture depuis un clone frais de `main` pour confirmer qu'aucune corruption n'a eu lieu au push.

**Incidents mineurs.** Plusieurs troncatures de fichiers lors de `push_files` (ex. `_shared.tsx` écrasé par un contenu placeholder, `999c39e2`) ont été auto-détectées par relecture post-push et corrigées par un commit correctif immédiat — même discipline que pour les incidents documentaires de la section 2.

---

## Travaux restants / points d'attention

1. **Intégration de la navigation mobile.** Six piles de navigation existent en fichiers isolés (`OnboardingStack.tsx`, `SearchStack.tsx`, `RelationsStack.tsx`, `NetworkCallsStack.tsx`, `ProfileManagementStack.tsx`, `OpportunitiesDetailStack.tsx`) mais ne sont pas montées dans les fichiers partagés `apps/mobile/src/navigation/{AppTabs,RootNavigator,types}.tsx` ni dans `apps/mobile/src/i18n/fr.ts`. Chaque commit de lot documente les instructions d'intégration exactes en commentaire — cette intégration finale reste à faire, dans un commit unique et non parallélisable puisqu'il touche les fichiers partagés que tous les lots ont délibérément évités.

2. **E2E Superadmin bloqué sur deux points humains** (section 3) :
   - ajout des nouveaux jobs/secrets dans `.github/workflows/e2e.yml` — hors du scope de permission du connecteur GitHub utilisé dans cette session ;
   - provisionnement manuel d'un compte superadmin de test sur le projet Supabase de production — volontairement non créé par l'agent.
   Tant que ces deux points ne sont pas traités, `admin-smoke.spec.ts`, `admin-permissions.spec.ts` et `admin-communities.spec.ts` restent non exécutées.

3. **5 migrations divergentes non re-vérifiées** : `0070_promotions_api`, `0072_communities_api`, `0073_projects_api`, `0074_news_events_api`, `0075_mentorship_api`. Statut « divergent, nature non confirmée » dans `docs/migration-integrity.md`, Annexe B — à traiter avec la même méthode super-canonique que les 15 autres avant de pouvoir les classer bénignes ou à corriger.

4. **Couverture de notification incomplète** : 9 types d'événements sur une quarantaine aujourd'hui possibles sont traités par le consommateur in-app (migration `0105`). Le reste (digests, notifications hors plateforme, etc.) reste hors périmètre et documenté comme tel dans l'en-tête de la migration.

5. **Aucune émission de `domain_events` pour les candidatures et les recommandations.** `submit_application`, `transition_application_status` et les fonctions de demande de recommandation n'écrivent aujourd'hui aucun événement dans `public.domain_events`. C'est un prérequis technique à traiter avant de pouvoir notifier ces deux cas d'usage, identifiés comme prioritaires côté produit mais actuellement invisibles pour le consommateur de notifications.

---

*Rédigé le 12 août 2026 à partir de l'historique Git de `blyped/ise` (branche `main`). Les SHA cités sont abrégés à 8 caractères ; ils restent uniques et résolubles via `git show <sha>` ou l'interface GitHub.*
