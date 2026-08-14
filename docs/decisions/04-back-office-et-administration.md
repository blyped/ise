# Journal des décisions — Compétences ISE — Partie 4/8 : Back-office et administration

Sections 15 à 21 du journal des décisions du projet Compétences ISE.
Index général, préambule, convention de statut (ADOPTÉE / PROVISOIRE / OUVERTE)
et décisions de cadrage : [`docs/decisions.md`](../decisions.md).

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
