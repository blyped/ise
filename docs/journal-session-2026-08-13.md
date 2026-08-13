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

## Travaux restants / points d'attention

1. **Provisioning D-161 — 201 invitations non envoyées** (section 4). Prochaine étape : confirmation
   explicite de l'utilisateur avant tout nouvel appel à `provision-invitations` sur le reste des
   profils `referenced`. Envisager un `dryRun` de contrôle avant l'envoi réel, par lots de 50.
2. **Dépôt local toujours partiellement désynchronisé** (section 3) au-delà des deux fichiers déjà
   corrigés — un `git status`/`git fetch` complet suivi d'une décision de réconciliation (commit,
   stash ou reset raisonné) reste à faire sur `C:\Services\Ise\app`.
3. Les points ouverts du journal du 12 août (intégration de la navigation mobile, E2E Superadmin
   bloqué sur deux points humains, 5 migrations divergentes non re-vérifiées, couverture de
   notification incomplète, absence de `domain_events` pour candidatures/recommandations) restent
   inchangés — non retouchés dans cette session.
4. Aucun test automatisé (`tsc`, `vitest`) n'a pu être exécuté dans le bac à sable pour les
   fonctionnalités D-167/D-168 : `pnpm` est absent du `PATH` et les symlinks `.bin` du store pnpm
   ne se résolvent pas correctement à travers le montage Windows→Linux. Contournement utilisé :
   appel direct de `tsc` via son chemin résolu dans `node_modules/.pnpm/typescript@.../`, comparé
   par échantillonnage à des fichiers non modifiés (`cms/evenements/page.tsx`) pour confirmer que
   les erreurs restantes sont uniquement dues à l'absence de `@types/react`/`@types/node` dans ce
   bac à sable, pas à une régression introduite.

---

*Rédigé le 13 août 2026 à partir de l'historique Git de `blyped/ise` (branche `main`) et de requêtes
directes sur le projet Supabase de production. Les SHA cités sont abrégés à 8 caractères.*
