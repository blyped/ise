
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
