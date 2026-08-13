## 23. Resserrement du menu public et premier câblage des piliers « réseau utile »

| #     | Décision | Source |
| ----- | -------- | ------ |
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

| #     | Décision | Source |
| ----- | -------- | ------ |
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

| #     | Décision | Source |
| ----- | -------- | ------ |
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

| #     | Décision | Source |
| ----- | -------- | ------ |
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

| #     | Décision | Source |
| ----- | -------- | ------ |
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
