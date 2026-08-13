# Journal de session — 13 août 2026

Suite de `docs/journal-session-2026-08-12.md`. Ce document couvre uniquement la journée du 13 août
2026 : deux fonctionnalités livrées (D-167, D-168), un incident d'environnement corrigé, et une
vérification de l'état réel du provisioning des comptes (D-161, tâche #82) sans action d'envoi
déclenchée. Comme le précédent, il complète — sans les modifier — `docs/screen-traceability-matrix.md`,
`docs/decisions.md` et `docs/implementation-status.md`, qui restent les documents de référence.

---

## 1. Picklist Organisations dans les formulaires de profil (D-167)

**Ce qui manquait.** `ise_profiles.current_organization_id` et `experiences.organization_id` sont
deux colonnes FK vers `public.organizations` qui existaient depuis les toutes premières migrations
(`0003`, `0005`), déjà lues par `get_member_profile()` (préférence à la valeur résolue sur le texte
libre), déjà présentes dans les schémas Zod — mais jamais écrites : aucun formulaire ne soumettait
l'identifiant, seulement le texte libre (`current_organization_raw` / `organization_name_raw`).
C'était le gap explicitement laissé en suivi par **D-164**.

**Solution livrée — commit `8b8572e1`.** Correctif purement applicatif, **aucune migration** :

- `lib/queries/reference.ts` — nouvelle `loadOrganizations()`, même patron que `loadCountries()`.
- `mon-profil/en-tete/ProfileHeaderForm.tsx` et `mon-profil/experiences/ExperienceForm.tsx` —
  liste déroulante alimentée par le référentiel, avec repli en texte libre toujours disponible pour
  une organisation absente de la liste.
- `mon-profil/actions.ts` — règle de priorité côté serveur : un `organizationId` soumis efface le
  texte libre correspondant (mis à `null`), pour ne jamais stocker un texte contradictoire à côté
  d'un identifiant résolu.

**Hors périmètre, assumé.** Le champ « Organisation / commanditaire » de `ProjectForm.tsx` (pas de
colonne `organization_id` sur `projects`), le formulaire admin de création de profil référencé, et
l'application mobile (C-02, web d'abord).

Documentation : **D-167** dans `docs/decisions.md` (§26), lignes `ISE-017`/`ISE-019` mises à jour
dans `docs/screen-traceability-matrix.md`.

---

## 2. Piliers « Un réseau conçu pour être utile » pilotés par le CMS (D-168)

**Ce qui manquait.** Les quatre piliers de la landing (Connecter / Entraider / Collaborer /
Impacter, `NetworkSection.tsx`) étaient du texte pur, avec une seule cible câblée en dur
(`PILLAR_TARGETS`, Connecter → `/rechercher`, D-164). Suivi explicitement noté par D-164 :
« transformation des quatre piliers en contenu piloté par le CMS (image, texte optionnel, lien,
par pilier) ».

**Solution livrée.**

- **Migration `0114_landing_pillars.sql`**, appliquée directement sur le projet Supabase de
  production via l'outil MCP (et non `apply_migration` en local, faute d'accès `pnpm`/`tsc`
  fonctionnel dans le bac à sable de cette session — voir section 3). Contenu : table
  `cms_pillars` (4 lignes fixes, jamais créées ni supprimées — RLS n'autorise que `SELECT`/`UPDATE`),
  `set_landing_pillar()` (écriture, `cms.edit`, valide le média et une liste blanche de 5 cibles
  réelles), `list_cms_pillars()` (lecture CMS), `get_landing_pillars()` (lecture publique, `anon`
  inclus — ajouté à la liste blanche de `private.security_baseline_violations()`, corrigée en
  cours de route après un premier échec de migration).
- **Frontend public** — `landing-data.ts` : nouveau type `LandingPillar`, `pillarSchema`,
  intégré au pipeline `fetchLandingData()` avec le même mécanisme de repli
  (`withLastKnownGood`) que les huit autres sections. `NetworkSection.tsx` : résout `link_target`
  vers une URL réelle via une table `TARGET_ROUTES` (search/calls/projects/opportunities/
  applications), affiche l'image et la légende quand présentes, reste texte seul sinon.
- **Écran CMS-011** (`/cms/piliers`) — `app/cms/piliers/{page,actions,PillarForm}.tsx`, repris du
  patron `CoverMediaForm` (D-166) pour le sélecteur média et le rappel de taille recommandée,
  route ajoutée à `CMS_ROUTES`, entrée de nav, textes dans `i18n/cms.ts`.
- **Tests** — `pillarSchema` couvert dans `landing-data.test.ts` (association clé/image/lien,
  absence de lien = texte seul, image sans alternative textuelle écartée) ; fixture `PILLARS`
  ajoutée à `landing-render.test.ts` pour que le rendu complet de la page continue de compiler.

**Cinq cibles réelles, pas une liste ouverte.** `/rechercher` (Connecter, déjà câblé par D-164),
`/appels` (Entraider), `/projets` (Collaborer — le commentaire de `routes/projects.ts` confirme que
le fil d'Ariane des maquettes place déjà ISE-088 sous « Collaborer »), `/opportunites` et
`/candidatures` (Impacter). Seul `connecter → search` est pré-rempli ; les trois autres piliers
démarrent sans lien, à choisir activement par l'administrateur.

**Vérifié en base après application** : `cms_pillars` contient bien 4 lignes, `connecter` porte
`link_target='search'`, `security_baseline_violations()` et `storage_baseline_violations()`
renvoient 0 ligne.

Documentation : **D-168** dans `docs/decisions.md` (§27), nouvelle entrée `CMS-011` dans
`docs/screen-traceability-matrix.md`, compteurs de routes et récapitulatif CMS mis à jour dans
`docs/implementation-status.md`.

---

## 3. Incident d'environnement — désynchronisation du dépôt local

**Constat.** Le dépôt local sur la machine de l'utilisateur (`C:\Services\Ise\app`) s'est révélé
en retard sur `origin/main` (`git fetch` : 16 commits de retard) tout en portant 2 commits locaux
jamais poussés (`docs/decisions.md`, sections D-164/D-165 rédigées localement mais non
synchronisées). Deux fichiers réellement présents sur GitHub — `supabase/migrations/
0113_landing_cover_media.sql` et `app/cms/_components/CoverMediaForm.tsx` — étaient absents du
disque local, ce qui a bloqué une première tentative de recherche de contexte pour la
fonctionnalité piliers CMS.

**Cause.** Toutes les publications de code de cette session (et des précédentes) passent par
l'outil MCP `push_files`, qui écrit directement sur GitHub sans jamais repasser par le dépôt local
de l'utilisateur — aucune commande `git push` ne fonctionne dans le bac à sable (pas d'identifiants
configurés). Le dépôt local ne se met donc à jour que si quelqu'un y fait explicitement un
`git pull`.

**Correctif appliqué**, sans perte de travail : `git fetch origin main`, puis les deux fichiers
manquants ont été récupérés individuellement via `git show origin/main:<chemin> > <chemin>` (pas de
`git reset --hard`, pour ne pas écraser les modifications locales non commitées d'autres fichiers
en cours d'édition dans la même session). Le reste du dépôt local reste en avance/retard mixte par
rapport à `origin/main` — non résolu, voir section 5.

---

## 4. Vérification de l'état réel du provisioning des comptes (D-161, tâche #82)

**Pourquoi une vérification et pas une exécution.** La tâche #82 était marquée « en cours » sans
indication, dans le contexte disponible à ce stade de la session, de ce qui avait déjà été exécuté
réellement contre la base de production. Envoyer des invitations est un envoi de courriel réel à
des personnes réelles : ce n'est jamais déclenché sans confirmation explicite de l'utilisateur dans
le fil de discussion, même en mode autonome.

**Constat, par requête directe sur la base de production :**

| Mesure | Valeur |
| --- | --- |
| Profils au total | 260 |
| Comptes déjà liés et actifs (`claimed`/`active`) | 54 |
| — dont provisionnés par `provision-invitations` (`profile.account_provisioned`) | 52 |
| — dont réclamés par le parcours normal ISE-005→007 (`profile.claim_approved`) | 1 |
| Profils encore `unclaimed`/`referenced` (éligibles, invitation non envoyée) | **201** |
| Profils `unclaimed`/`archived` (doublons fusionnés ou exclus) | 5 |

La fenêtre des 52 invitations déjà envoyées est très resserrée : entre 12h42 et 12h58 UTC le
12 août 2026 (16 minutes), cohérente avec un ou deux lots de l'Edge Function `provision-invitations`
(lots de 50 maximum, D-161). L'Edge Function elle-même est bien déployée et active sur le projet
(`provision-invitations`, version 2).

**Conclusion : un premier lot pilote a donc déjà eu lieu**, probablement dans une session
antérieure non couverte par le journal du 12 août. Il reste **201 profils référencés** qui n'ont
reçu aucune invitation. Aucune action d'envoi n'a été déclenchée dans cette session : la tâche #82
reste **en cours**, en attente d'une décision explicite de l'utilisateur sur la suite (envoyer le
reste en un ou plusieurs lots, avec ou sans nouveau `dryRun` de contrôle avant l'envoi réel).

---

## 5. Réconciliation git, ré-vérification des migrations, et clôture des points ouverts (D-169)

Suite à l'instruction « on fait tous les points mentionnés sauf les invitations », les points 1
(git), 2 (migrations) et 3 (points ouverts du 12 août) de la section précédente ont été traités
dans la suite de cette même session — le provisioning (section 4 ci-dessus) reste seul non
retouché, conformément à l'exclusion explicite.

**Dépôt local réconcilié.** Le dépôt était sur une branche parasite (`push-remaining-piliers`,
laissée par un sous-agent antérieur), elle-même divergente de `main` local, lui-même divergent de
`origin/main`. Un `git checkout main` avait silencieusement fait revenir plusieurs fichiers du
répertoire de travail à un état ancien (contenu redondant déjà présent sur `origin/main` via une
autre lignée de commits, vérifié avant action). Corrigé par `git reset --hard origin/main` puis
suppression de la branche parasite.

**5 migrations restantes re-vérifiées** (`0070_promotions_api`, `0072_communities_api`,
`0073_projects_api`, `0074_news_events_api`, `0075_mentorship_api`) — délégué à un sous-agent pour
ne pas consommer ~215 Ko de contexte sur les 5 comparaisons SQL complètes. Verdict : 20/20
migrations d'`Annexe B` de `docs/migration-integrity.md` désormais tranchées. 17 sont des écarts
cosmétiques ou des formes SQL équivalentes ; 3 étaient de vrais écarts, tous bénins : `0070` a un
écart réel dépôt/production sur un filtre de statut `next_event` (documenté, pas corrigé — hors
périmètre d'une vérification d'intégrité) ; `0073` et `0074` ont un historique `schema_migrations`
obsolète mais la fonction réellement active en production correspond déjà au dépôt — aucun bug
actif.

**`domain_events` manquants pour candidatures et recommandations (D-169), migrations `0115` et
`0116`.** `submit_application`, `declare_external_application`, `transition_application_status`
(0008) et la création d'une `recommendation_requests` (insert direct côté client, RLS 0021)
n'écrivaient aucune ligne dans `public.domain_events`. Comblé par `0115` (reprend ces fonctions à
l'identique + un `insert into domain_events` par issue ; trigger `AFTER INSERT` sur
`recommendation_requests` puisque sa création n'a pas de RPC dédiée) et `0116` (étend le `case` de
`private.process_pending_domain_event_notifications()`, 0105, à 4 types de plus : candidature
retenue/changée, demande/réponse de recommandation — 13 types couverts sur ~40 au total). Détail
complet en `docs/decisions.md` §28 (D-169). Les deux migrations sont appliquées et vérifiées en
production (`security_baseline_violations()` et `storage_baseline_violations()` à 0).

**Navigation mobile (tâche #114) : déjà fonctionnellement complète, code mort nettoyé.** Le résumé
de session hérité affirmait à tort que 6 piles de navigation restaient à monter. Vérification du
code réel : les 6 piles sont toutes déjà atteignables. Deux fichiers (`RelationsStack.tsx`,
`NetworkCallsStack.tsx`) portaient un composant navigateur jamais monté (leurs écrans avaient été
fusionnés à plat dans `ReseauStack.tsx` par une passe antérieure) — retirés, en conservant les
types de routes exportés (toujours importés par 13 écrans). `AppTabParamList.Reseau` est aussi
mieux typé (`NavigatorScreenParams<ReseauStackParamList>` au lieu de `undefined`).

**CI E2E Superadmin (tâche #115) : déjà résolu, hors agent, le 12 août.** Le blocage documenté
(scope du connecteur GitHub insuffisant pour modifier `.github/workflows/e2e.yml`) a été levé par
l'utilisateur directement (commit `f280574`, pas par un agent). Le workflow exécute déjà
`admin-smoke.spec.ts`, `admin-permissions.spec.ts` et `admin-communities.spec.ts` via un seul job
générique (`testMatch: '**/*.spec.ts'`), pas des jobs séparés. Plusieurs cycles réels d'exécution
et de correction ont eu lieu depuis (`9683db2`, `4265105`, `f42936f`, `963a456`). Non vérifiable
depuis ce bac à sable : le statut du dernier run GitHub Actions (aucun outil d'accès à l'API
Actions disponible ici) et la présence réelle des 4 secrets référencés dans Settings → Secrets du
dépôt. `docs/implementation-status.md` affirmait encore « aucun test E2E n'a jamais été exécuté » —
corrigé.

---

## Travaux restants / points d'attention

1. **Provisioning D-161 — 201 invitations non envoyées.** Explicitement exclu de cette session.
   Prochaine étape : confirmation explicite de l'utilisateur avant tout nouvel appel à
   `provision-invitations` sur le reste des profils `referenced`.
2. **`application.withdrawn` côté recruteur et `recommendation.withdrawn`** ne déclenchent aucune
   notification (0116) : aucun type au catalogue, aucun destinataire jugé assez pertinent dans ce
   lot. À confirmer si le besoin existe réellement avant d'étendre.
3. **Statut réel du dernier run GitHub Actions E2E non vérifiable depuis ce bac à sable** (section
   5) — à confirmer par l'utilisateur ou un environnement ayant accès à l'API Actions.
4. **`docs/implementation-status.md` reste daté par endroits** au-delà des sections corrigées cette
   session (ex. le nombre de migrations affiché en tête de document, certaines lignes du tableau
   §1 qui répètent encore « aucun test E2E » module par module) — une repasse complète du document
   serait utile mais dépasse le périmètre des tâches traitées ici.
5. Aucun test automatisé (`tsc`, `vitest`) n'a pu être exécuté dans le bac à sable pour les
   fonctionnalités D-167/D-168/D-169 : `pnpm` est absent du `PATH` et les symlinks `.bin` du store
   pnpm (et de `node_modules/@types/react`) ne se résolvent pas correctement à travers le montage
   Windows→Linux (`Input/output error` constaté sur le symlink `@types/react`). Contournement
   utilisé : appel direct de `tsc` via son chemin résolu dans `node_modules/.pnpm/typescript@.../`,
   et par ailleurs vérification par `grep` exhaustif des usages avant toute suppression de code
   (navigation mobile) pour compenser l'absence de vérification de type automatisée.

---

*Rédigé le 13 août 2026 à partir de l'historique Git de `blyped/ise` (branche `main`) et de requêtes
directes sur le projet Supabase de production. Les SHA cités sont abrégés à 8 caractères.*
