
| #     | Décision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-134 | **ADOPTÉE** — Un **unique** bucket public est créé, `landing-media`, dédié aux médias éditoriaux de PUB-001, en `png / jpeg / webp / avif`, 5 Mo, **sans SVG**, rangé par usage (`carousel/`, `partners/`, `news/`, `sections/`). Les huit buckets de `0027` restent privés. `private.storage_baseline_violations()` échoue si un autre bucket devient public **et** si `landing-media` cesse de l'être.                                                                                                         | D-73 (« aucun bucket public ») a été écrit pour une plateforme entièrement authentifiée. PUB-001 est servie à des anonymes : sans surface publique, `landingMediaUrl()` renvoyait `null` et aucune image ne s'affichait. L'alternative — une URL signée par visuel — obligerait à re-signer à chaque rendu, donc à renoncer au cache de 300 s (§46), et l'URL signée fuirait de toute façon sans expiration utile à l'échelle d'un CDN. Un bucket public dont le contenu est, par construction, du matériel éditorial publié, **dit la vérité sur ce qu'il contient**. Le SVG est exclu parce qu'il est du XML capable de porter du script : servi en public sur le domaine Supabase, il s'exécuterait dans le contexte de ce domaine. La restriction de D-73 est donc **bornée**, pas levée : elle devient « un seul bucket public, dont le contenu est éditorial et vérifié mécaniquement ».                                                                                                                                                                                                                                                                                                                                                          |
| D-135 | **ADOPTÉE** — L'« ISE du jour » n'affiche **pas de photographie**. Le teaser porte un **monogramme** (initiales dans une pastille), construit depuis `display_name`, déjà public. Le bucket `avatars` reste privé, aucune copie publique n'est faite, et `get_landing_featured_profile()` **cesse même de projeter `avatar_path`**. L'option « copie publique consentie à l'opt-in » est écartée.                                                                                                                | Trois raisons, dans cet ordre. **(1) Périmètre du consentement.** `allow_public_feature` (0057) consent à la parution d'un teaser **textuel** dont les champs sont énumérés. Il n'a jamais été présenté au membre comme un consentement à la publication de son portrait sur le web ouvert. Réutiliser une case cochée pour un usage qu'elle ne décrit pas est un détournement de finalité — exactement ce que MASTER PROMPT §47 interdit. Obtenir le bon consentement supposerait un second opt-in, un second écran, une seconde trace : ce n'est pas ce que ce lot corrige. **(2) Irréversibilité.** Une photographie déposée dans un bucket public est mise en cache par le CDN, aspirée par les moteurs et les archiveurs. Un retrait de consentement, une suppression de compte (D-19) ou une exclusion éditoriale (D-122) ne peuvent pas la rappeler. Le consentement redeviendrait révocable en théorie et définitif en fait. **(3) La maquette ne demande rien de tel.** `PUB-001_Landing_Page_Desktop_1440` montre une carte « ISE DU JOUR » **textuelle** : nom, promotion, lien. Aucun portrait. Le monogramme est donc conforme à la maquette (D-01), n'a aucune surface de confidentialité, ne coûte aucune requête et ne peut pas casser. |
| D-136 | **ADOPTÉE** — Un média n'est projeté vers la vitrine que s'il réunit **trois** conditions : bucket `landing-media`, alternative textuelle non vide, ligne non supprimée. Sinon la projection renvoie `null` et le composant n'émet **aucune** balise `img`. `news.image_path` et `organizations.logo_path`, qui sont du texte libre antérieur au CMS, sont **résolus dans la médiathèque** par `private.landing_media_by_path()` : une couverture qui n'y est pas enregistrée, décrite et mesurée ne paraît pas. | Trois défauts évités d'un coup. Un média resté dans un bucket privé produirait une URL en 400, donc une image cassée sur la vitrine. Un média sans `alt` est **non publiable** (ADDENDUM §52) : la contrainte existe en base, la projection la redit, et le parseur client la redit une troisième fois — c'est le contrat du client, pas une politesse. Enfin, servir `news.image_path` tel quel donnerait une image sans alternative et sans dimensions connues, c'est-à-dire précisément ce que §52 et §58 interdisent. Le prix est assumé : une couverture d'actualité doit passer par la médiathèque pour paraître, et son absence est visible dans CMS-008.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| D-137 | **ADOPTÉE** — Aucune **seconde** colonne de bucket n'est ajoutée à `cms_media_assets`. La colonne `bucket_id`, posée en `0057`, voit son défaut passer à `landing-media` et son `CHECK` s'élargir à `('landing-media', 'public-assets')`.                                                                                                                                                                                                                                                                        | La colonne demandée existait déjà. En ajouter une seconde créerait deux vérités pour une même information — ce que `docs/cms.md` §1 interdit — et il faudrait ensuite décider laquelle fait foi à chaque lecture. `public-assets` reste **accepté** en base pour ne casser aucune ligne antérieure, mais n'est plus **servi** : un visuel oublié dans l'ancien bucket disparaît proprement de la vitrine, reste visible dans la médiathèque, et n'y produit pas de vignette — le manque est constatable, pas silencieux.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| D-138 | **ADOPTÉE** — La place d'une image est réservée par son **conteneur** (rapport d'aspect ou hauteur minimale fixes) et non par ses dimensions intrinsèques : `next/image` est utilisé en `fill`. Les colonnes `width` / `height` de `cms_media_assets` restent projetées mais ne conditionnent pas l'affichage. La première diapositive du carrousel est en `priority`, tout le reste en `loading="lazy"`.                                                                                                                        | `width` et `height` sont **nullables** en base : un média non mesuré aurait, avec `next/image` en mode intrinsèque, soit disparu, soit provoqué un décalage. Le conteneur à ratio fixe rend le CLS structurellement nul (MASTER PROMPT §58) quel que soit l'état des métadonnées, y compris quand l'image n'arrive jamais. `priority` est réservé au seul élément susceptible d'être le LCP.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| D-139 | **PROVISOIRE** — La suppression d'un objet de `landing-media` n'est **pas** testée par un `DELETE` SQL. Le harnais `0023` vérifie le comportement réel sur l'`UPDATE`, qui porte la même condition d'autorisation, et la **forme** de la politique `ise_landing_media_delete` (commande, rôles, permission exigée).                                                                                                                                                                                              | Supabase pose sur `storage.objects` un déclencheur `protect_objects_delete` **`FOR EACH STATEMENT`** : il lève `42501` avant toute évaluation de lignes, donc avant la RLS, et même quand la commande n'aurait touché personne. Aucun `DELETE` n'est observable en SQL, ni permis ni refusé — la suppression passe exclusivement par l'API Storage. Le trou de couverture est nommé plutôt que masqué par un test qui ne mesurerait rien. Il se refermera avec un test d'intégration passant par l'API Storage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D-140 | **ADOPTÉE** — D-133 est **amendé** sur un point : le bucket de dépôt de CMS-008 devient `landing-media` et le format `avif` est accepté (signature `ftyp` + boîte `ispe` de l'ISOBMFF). Le reste de D-133 tient : les variantes Desktop / Mobile / vignette ne sont toujours **pas** générées, faute d'encodeur d'images déployé, et aucune ligne `variant_kind` fictive n'est écrite.                                                                                                                           | Le pipeline dépose maintenant là où la vitrine peut lire. AVIF est ajouté parce que `next/image` sert déjà de l'AVIF en sortie : refuser le format en entrée n'aurait protégé de rien. Les vignettes de la médiathèque, elles, sont désormais **réelles** — elles pointent l'original, redimensionné par l'optimiseur de Next, et non une variante fictive.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

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

| #     | Décision                                                                                                                                                                                                                                                                                                                       | Source                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| D-141 | **ADOPTÉE** — Aucune mécanique de popularité, à aucun niveau : ni vue, ni « j'aime », ni score, ni classement de communautés ou de personnes. Vérifié mécaniquement par le cas C04 du harnais `0027`, qui échoue si une clé de projection contient `view`, `like`, `rank`, `popular`, `score` ou `trend`.                      | `modules-collaboration.md` C-a |
| D-142 | **ADOPTÉE** — Seuil de cross-posting : **3 communautés en 24 h** pour une empreinte de contenu identique ; 10 publications et 30 réponses par heure et par membre (D-103).                                                                                                                                                     | C-d                            |
| D-143 | **ADOPTÉE** — Le marquage « réponse utile » est binaire, posé par le seul auteur de la publication, retirable, et ne produit ni classement ni réputation.                                                                                                                                                                      | C-f                            |
| D-144 | **ADOPTÉE** — La création d'une communauté n'est pas ouverte au membre en V1 ; l'écran le dit et renvoie vers l'assistance.                                                                                                                                                                                                    | C-k                            |
| D-145 | **ADOPTÉE** — Intérêt et appartenance à un projet ne se rejoignent jamais : `submit_project_interest()` n'écrit que dans `project_applications` ; le seul chemin vers `membership_status = 'active'` est `confirm_project_membership()`, qui horodate le consentement. Une invitation acceptée produit `pending_confirmation`. | P-a, P-b                       |
| D-146 | **ADOPTÉE** — La rémunération d'un rôle de projet suit quatre paliers de divulgation (`applied`, `shortlisted`, `selected`, `team_only`). Hors palier atteint, la clé `compensation` est **absente** de la projection — pas vide, absente.                                                                                     | P-d                            |
| D-147 | **ADOPTÉE** — Aucun pourcentage d'avancement de projet. Seuls des décomptes : membres confirmés, rôles pourvus sur total, jalons terminés sur total.                                                                                                                                                                           | P-h                            |
| D-148 | **ADOPTÉE** — `landing_visibility` est projeté et **affiché en toutes lettres** dans l'espace membre (« Ce contenu paraît sur le site public »), et n'y est jamais modifiable. Application conjointe de D-123 et D-131.                                                                                                        | N-a                            |
| D-149 | **ADOPTÉE** — ISE-092 est un **fil mixte** actualités + événements, uni en base par un curseur keyset unique (D-44), et non deux listes entrelacées côté client.                                                                                                                                                               | N-d                            |
| D-150 | **ADOPTÉE** — `events.online_url_private` n'est jamais projeté, ni par `private.event_card()`, ni par un `select *`. Seul un booléen `online_url_available` sort ; l'URL passe par `public.get_event_online_url()`.                                                                                                            | N-c                            |

### 14.3 Arbitrages rapatriés de `docs/screen-traceability-matrix.md`

La matrice consignait sept écarts de la tranche Recherche & découverte (`E-01` → `E-07`) et
quatorze de la tranche Relations & introductions (`F-01` → `F-14`) « à fusionner dans le journal
des décisions à la réunion des deux lots ». La réunion a eu lieu ; deux d'entre eux portent une
règle transverse et sont promus ici. Les dix-neuf autres restent des **écarts d'écran**, documentés
dans la matrice, et n'ont pas vocation à devenir des décisions transverses.

| #     | Décision                                                                                                                                                                                                                                                                         | Source     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| D-151 | **ADOPTÉE** — Aucun écran n'affiche de **total de résultats** ni de pagination numérotée : D-44 impose le keyset, et un total exigerait un `COUNT(*)` sur tout l'annuaire à chaque requête. Les listes affichent le nombre d'éléments **rendus** et un bouton « page suivante ». | E-01, E-04 |
| D-152 | **ADOPTÉE** — Le libellé qualitatif de pertinence (D-42) et les raisons (D-43) ne sont rendus **qu'en mode pertinence** (`match_profiles`). En mode annuaire (`search_profiles`, texte libre), aucun libellé n'est fabriqué et la raison de son absence est écrite à l'écran.    | E-02       |

**Écart resté ouvert** (rappelé ici pour qu'il ne se perde pas) : `F-05` — les filtres Promotion /
Secteur / Pays / Disponibilité d'ISE-040 ne sont pas livrés. La recherche par nom seule est
rendue. Ce n'est pas un arbitrage définitif, c'est un manque.

### 14.4 Arbitrages rapatriés de `docs/public-routing.md`

| #     | Décision                                                                                                                                                                                                                                                                                                                                                          | Source                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| D-153 | **ADOPTÉE** — Les entrées de l'en-tête public (« Le réseau », « Actualités », « Événements », « Opportunités », « Partenaires ») pointent vers des **ancres de sections** de PUB-001, jamais vers un écran membre. `/actualites` et `/evenements` existent désormais, mais restent **authentifiés** : y envoyer un visiteur anonyme le renverrait à la connexion. | `public-routing.md` §4 |
| D-154 | **ADOPTÉE** — PUB-001 est rendue `force-dynamic` ; c'est la **lecture des données** qui est mise en cache (étiquette `pub-001-landing`, revalidation 300 s), pas le HTML. L'en-tête dépend de la session et `ProtectedLink` doit rendre la bonne cible côté serveur, sans JavaScript.                                                                             | `public-routing.md` §7 |
| D-155 | **ADOPTÉE** — Trois portes indépendantes protègent la redirection après authentification : `isPublicPath()` (liste blanche), `MEMBER_ROUTE_PREFIXES` (liste blanche des cibles `redirectTo`) et `safeRedirect()` (refus des URL absolues, des chemins d'authentification et des boucles). Une cible inconnue est ramenée au tableau de bord, jamais suivie.       | `public-routing.md` §3 |

---

## 15. Superadmin — Communautés (SA-027 → 029)

| #     | Décision                                                                                                                                                                                                                                                                                                                                                                                                    | Source                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| D-156 | **ADOPTÉE** — SA-029 (« Modération Publication Communauté ») ne couvre, côté écran, que la modération des **publications** de communauté. `admin_moderate_community_comment` (0099) existe côté base — même vérification de permission `communities.manage`, même journalisation dans `community_moderation_actions` — mais n'a pas d'écran dédié : le titre de l'écran désigne explicitement les publications, pas les commentaires. Rien n'empêche d'y brancher un écran ultérieurement, sans nouvelle migration : la fonction existe déjà. | `0099_admin_communities_api.sql`, `communautes/[communityId]/page.tsx` |

---

## 16. Superadmin — Événements (SA-030 → 033)

| #     | Décision                                                                                                                                                                                                                                                                                                                                                                                                                                    | Source                                                                  |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
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

| #     | Décision                                                                                                                                                                                                                                                                                                                                                                                                                                    | Source                                                                  |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
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

| #     | Décision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Source                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
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

| #     | Décision                                                                                                                                                                                                                                                                                                                                                                                                          | Source                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
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

| #     | Décision                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Source                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
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

| #     | Décision                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Source                                                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
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

| #     | Décision | Source |
| ----- | -------- | ------ |
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
(D-117 : « Dépôt de photo… non ouvert »). Il n'y a donc pas de photo personnelle à exposer par
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
