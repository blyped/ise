# Journal des décisions — Compétences ISE — Partie 6/8 : Événements de domaine, notifications et visuels

Sections 28 à 32 du journal des décisions du projet Compétences ISE.
Index général, préambule, convention de statut (ADOPTÉE / PROVISOIRE / OUVERTE)
et décisions de cadrage : [`docs/decisions.md`](../decisions.md).

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

**Addendum mobile — nettoyage de code mort (tâche #114).** En vérifiant l'état réel de
`apps/mobile/src/navigation/` (un résumé de session antérieur suggérait à tort que 6 piles restaient
à monter), le code s'est révélé déjà fonctionnellement complet : les 6 piles (`OnboardingStack`,
`SearchStack`, `RelationsStack`, `NetworkCallsStack`, `ProfileManagementStack`,
`OpportunitiesDetailStack`) sont toutes atteignables depuis l'application. Deux fichiers portaient
cependant un composant navigateur mort (`RelationsStack()`, `NetworkCallsStack()`, jamais monté nulle
part — leurs écrans avaient déjà été fusionnés à plat dans `ReseauStack.tsx` par une passe
antérieure) : retirés, en conservant intacts `RelationsStackParamList` et `NetworkCallsStackParamList`
au même endroit, puisque 13 écrans et `ReseauStack.tsx` les importent directement par leur chemin de
fichier. `AppTabParamList.Reseau` est aussi passé de `undefined` à
`NavigatorScreenParams<ReseauStackParamList>`, par cohérence avec `ActionCentrale`. Aucun changement
de comportement.

---

## 29. Rognage du carrousel héros — le conteneur desktop passe d'une hauteur plein écran à un ratio panoramique fixe (D-170)

| # | Décision | Source |
| --- | --- | --- |
| D-170 | **ADOPTÉE** — Sur desktop/tablette (`md:` et plus), le conteneur de chaque diapositive du carrousel héros de PUB-001 abandonne la hauteur `calc(100dvh-var(--layout-topbar))` (0109) pour un ratio fixe `aspect-[1920/720]` (≈ 2,667:1). Le mobile n'est pas concerné : il conserve la hauteur plein écran, hors périmètre du signalement. `object-contain` (correctif du même jour) reste actif : aucune image n'est jamais rognée. | `LandingCarousel.tsx` |

**Ce que ça corrige.** Le porteur a signalé le même jour (2026-08-13), via une capture d'écran puis
une analyse UX détaillée, que le correctif précédent (`object-contain` universel, appliqué en
réponse au rognage initial de la bannière partenaire « Optimum Conseil ») faisait apparaître de
larges bandes latérales `bg-deep-navy` sur les diapositives existantes (au format 16:9), parce que
le conteneur restait calé sur `100dvh` — une hauteur très variable selon la fenêtre, souvent bien
plus « carrée » qu'un visuel 16:9. Deux options possibles : rogner (régression du problème initial)
ou laisser des bandes plus ou moins grandes selon l'écran. La recommandation retenue, transmise par
le porteur, est de rapprocher le **ratio du conteneur** de celui des visuels plutôt que l'inverse :
un format panoramique fixe proche de **1920 × 720 px (≈ 2,667:1)** pour les futures affiches du
carrousel desktop, au lieu de 1920 × 1080 (16:9) jusqu'ici. `aspect-[1920/720]` (Tailwind, valeur
arbitraire) remplace donc le `min-h` plein écran pour `md:` et plus ; `object-contain` continue de
garantir qu'aucune image, ancienne (16:9) ou future (2,667:1), n'est jamais rognée — seule la largeur
des bandes latérales varie selon l'écart entre le ratio du visuel et celui du conteneur.

**Effet transitoire, assumé.** Les affiches déjà publiées, au format 16:9, afficheront des bandes
latérales plus larges qu'avant sur les grands écrans desktop (le conteneur est maintenant plus
panoramique que la version 100dvh) : c'est le compromis explicitement accepté par le porteur en
attendant que les prochaines affiches soient produites au nouveau format. Aucune régression pour le
mobile (inchangé) ni pour la lisibilité du texte incrusté dans les visuels existants (jamais rogné,
avant comme après).

**Hors périmètre de cette décision.** Les déclinaisons par point de rupture proposées par le porteur
(tablette 1200×600, mobile 1080×1350/1440) ne sont pas implémentées ici : le mobile utilise déjà un
mécanisme de direction artistique dédié (`slide.mobileMedia`, visuel distinct par diapositive) sans
lien avec le ratio du conteneur, et n'a fait l'objet d'aucun signalement. De même, le principe de ne
plus incruster de texte dans les visuels futurs (texte HTML superposé plutôt que texte dans l'image)
n'est pas une décision technique nouvelle : l'infrastructure existe déjà (`slide.title`, `subtitle`,
`description`, `ctaLabel` rendus par-dessus l'image selon `text_position`, §9/§26) — il s'agit d'une
consigne de production de contenu pour les prochaines affiches, à appliquer côté CMS, pas d'un
changement de code.
---

## 30. Lien de navigation croisé entre `/administration` et `/cms` (D-171)

| #     | Décision | Source |
| ----- | -------- | ------ |
| D-171 | **ADOPTÉE** — Un lien « Aller au CMS » apparaît en bas du menu Administration, et un lien « Retour à l'administration » en bas du menu CMS. Chaque lien n'apparaît que si le compte courant a effectivement accès à la section cible (`cms.read` côté admin, au moins une permission d'administration côté CMS) — même règle que le reste de ces deux navigations : masquer une entrée que la base refuserait n'est pas une mesure de sécurité, c'est éviter un bouton décoratif (MASTER PROMPT §113). | `AdminShell.tsx`, `CmsShell.tsx`, `AdminNav.tsx`, `CmsNav.tsx` |

**Ce que ça corrige.** Retour direct du porteur (2026-08-13) : les deux back-offices n'avaient aucune
navigation croisée, obligeant à taper l'URL à la main pour passer de l'un à l'autre (« on a
l'impression d'aller d'un bout à l'autre du monde »). `AdminShell` et `CmsShell` deviennent des
composants serveur asynchrones : chacun lit, en plus de son propre accès, l'accès à l'AUTRE
back-office (`readCmsAccess()` côté admin, `readAdminAccess()` côté CMS — les deux fonctions
existaient déjà, `AdminShell`/`CmsShell` ne les appelaient simplement pas l'une l'autre) et décide
d'afficher ou non le lien croisé en conséquence.

**Pourquoi deux espaces de permissions distincts, et comment le lien les traverse.** `cms.read` (0058)
et les permissions `AdminPermission` (`content.publish`, `profiles.read`, etc., 0076) sont deux
listes fermées indépendantes, vérifiées par deux RPC différentes (`get_my_cms_permissions()` /
`get_my_admin_permissions()`) : un `cms_editor` peut n'avoir aucune permission d'administration, et un
`content_manager` peut ne pas avoir `cms.read`. Le lien croisé ne présuppose donc jamais l'un depuis
l'autre : il vérifie la permission réelle de la section cible avant de s'afficher, plutôt que de
réutiliser une permission de la section courante comme approximation.

**Piège rencontré et corrigé au déploiement.** Le premier commit (`1e4d9a2`) passait
`cmsLink={cmsLink}` / `adminLink={adminLink}` à `AdminNav`/`CmsNav`, où ces props sont déclarées
optionnelles (`cmsLink?: {...}`). Sous `exactOptionalPropertyTypes: true` (déjà responsable du même
échec sur `PublicHeader.tsx`, D-169), passer explicitement `undefined` à une prop optionnelle est une
erreur de type (TS2375), pas une valeur licite — la prop doit être **absente** de l'objet props, pas
présente avec la valeur `undefined`. Corrigé par le même motif de spread conditionnel
(`{...(cmsLink ? { cmsLink } : {})}`) déjà utilisé pour `PublicHeader.tsx`. Ce piège s'étant
maintenant présenté deux fois sur des props optionnelles passées telles quelles depuis une variable
qui peut valoir `undefined`, c'est le signe qu'il faut soit systématiser le spread conditionnel pour
ce cas précis, soit typer ces props `T | undefined` explicitement plutôt qu'optionnelles — non fait
ici, noté pour une passe de nettoyage ultérieure.

---

## 31. Image de couverture unique pour les actualités — admin, landing et page article (D-172)

| #     | Décision | Source |
| ----- | -------- | ------ |
| D-172 | **ADOPTÉE** — Les actualités reçoivent le même patron d'image que les événements et les opportunités (D-166, migration 0113) : une colonne `news.cover_media_id` (FK optionnelle vers `cms_media_assets`, médiathèque publique `landing-media`), choisie UNE SEULE FOIS depuis `/cms/actualites`, et réutilisée telle quelle sur la carte de la landing (`get_landing_news()`) et sur la page de l'article (`private.news_card()`, `/actualites/[newsId]`). Une seconde colonne, `news.cover_has_text`, évite de dupliquer un titre déjà incrusté dans le visuel. `news.image_path` (texte libre, jamais validé) est déprécié mais conservé. Migration 0117. | `0117_news_cover_media.sql`, `cms/actualites/page.tsx`, `administration/actualites/NewsForm.tsx` / `NewsEditForm.tsx`, `HighlightsSection.tsx`, `actualites/[newsId]/page.tsx` |

**Ce qui a motivé cette décision.** Retour direct du porteur (2026-08-13) : « où est-ce que je mets
l'image liée à l'actualité... il faut aussi penser à mettre l'image pour l'encart de la landing page
(avec les options avec ou sans texte) et l'image de la page de l'article elle-même. pense aussi à voir
comment on gère leur version mobile de manière optimisée pour ne pas qu'on mette 4 images pour un seul
article. » Le module Actualités était le seul des trois modules éditoriaux (actualités, événements,
opportunités) resté sur l'ancien patron `image_path` (texte libre, 0013) : `events`/`opportunities`
avaient déjà migré vers `cover_media_id` en 0113 (D-166). Cette décision applique EXACTEMENT le même
patron au dernier module qui en manquait, et répond en une fois aux quatre volets de la question.

**Principe directeur : une seule image, choisie une seule fois, réutilisée partout.** Il n'existe
qu'un seul champ d'upload (la médiathèque publique, `/cms/mediatheque`) et qu'un seul geste de
rattachement (`set_news_cover_media()`, appelé depuis `/cms/actualites`). Ni le formulaire de
rédaction admin (`NewsForm.tsx`/`NewsEditForm.tsx`), ni la carte de la landing, ni la page article ne
permettent de téléverser un second visuel : la carte lit `get_landing_news().cover`, la page article
lit `private.news_card().cover` — les DEUX résolues par `private.landing_media(cover_media_id)`, la
même fonction que pour les événements et les opportunités. Répond directement au risque nommé par le
porteur (« ne pas mettre 4 images pour un seul article ») : il n'y a physiquement qu'une seule colonne
à remplir, un seul endroit pour le faire. Le formulaire de rédaction admin n'affiche plus qu'un encart
lecture seule (« couverture définie » / « aucune couverture »), avec un lien croisé vers `/cms/actualites`
— même patron de lien croisé que D-171 — pour la gérer.

**Le cas « avec ou sans texte incrusté ».** `news.cover_has_text` (booléen, défaut `false`) distingue
une photo simple d'une affiche qui porte déjà son titre en incrustation. Quand `cover_has_text = true`,
la carte de la landing (`HighlightsSection.tsx`, `NewsCard`) masque visuellement le titre affiché sous
l'image (classe `sr-only`) plutôt que de le dupliquer sur un visuel qui le contient déjà — le titre
reste dans le DOM, pour l'accessibilité et le SEO, jamais retiré. `cover_has_text` n'a aucun effet sur
la page article : le `<h1>` d'une page de contenu reste toujours affiché, qu'il soit ou non redondant
avec l'image, contrairement au titre compact d'une carte.

**Version mobile : aucun second visuel, `sizes` fait le travail.** Aucun champ « image mobile » n'a
été ajouté, contrairement au carrousel héros (`slide.mobile_media_id`, direction artistique
volontairement différente entre desktop et mobile, hors sujet ici). Le patron déjà en place pour les
cartes événement/opportunité est repris tel quel : `StorageImage` (`components/media/StorageImage.tsx`)
encapsule `next/image` avec `fill` et une prop `sizes` par point de rupture (par exemple
`(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 260px` sur la carte landing) ; Next.js génère les
résolutions adaptées à la volée depuis l'unique original stocké dans `landing-media`. Aucun fichier
séparé, aucun second téléversement — ni pour la carte, ni pour la page article. Aucun écran Actualités
n'existe encore dans `apps/mobile` : rien à modifier côté mobile pour l'instant.

**Détail technique : `set_news_cover_media()` diverge du brief initial sur un seul point, documenté
dans la migration elle-même.** La fonction est calquée sur `set_landing_cover_media()` (0113) :
`SECURITY DEFINER`, `search_path` figé, exige `cms.edit`, valide que le média est dans le bucket
`landing-media` avec un `alt_text` non vide. Seul écart : son troisième paramètre, `p_has_text`, est
`default null` (et non `default false`) — `null` signifie « ne pas modifier ce réglage », pas « le
remettre à `false` ». Nécessaire pour que les deux contrôles distincts de l'écran CMS (le sélecteur de
visuel, réutilisation telle quelle de `CoverMediaForm.tsx` déjà utilisé par `/cms/evenements` et
`/cms/opportunites` ; et la case « texte déjà incrusté », à côté) puissent chacun écrire uniquement le
champ qu'ils pilotent, sans lecture préalable de l'état courant côté client. `p_media_id`, lui, garde
exactement la sémantique du brief : pas de défaut, `null` retire explicitement la couverture.

**Ce que cette décision ne fait pas.** Elle ne supprime pas `news.image_path` (conservé, déprécié,
même logique que D-137 pour l'ancien bucket `public-assets` : cesser de s'en servir sans rien casser).
Elle ne touche à aucun champ éditorial (`editorial_status`, `visibility`, `landing_priority`) : le
formulaire de rédaction admin (`content.publish`) garde son périmètre, l'exposition sur la landing
(`cms.publish`/`cms.edit`) garde le sien (D-128), et le choix du visuel rejoint ce second périmètre —
poser une image n'est pas un acte de publication, même raisonnement que D-166.

## 32. Suivi des clics sur les liens d'e-mail Supabase — `/auth/callback` comme point d'instrumentation unique (D-173)

| #     | Décision | Source |
| ----- | -------- | ------ |
| D-173 | **ADOPTÉE** — Chaque atterrissage sur `/auth/callback` (succès ET échec) est journalisé dans `private.auth_link_events`, via `public.log_auth_link_event()` (SECURITY DEFINER, exposée à `anon` ET `authenticated`). Couvre les trois usages réels de ce point d'entrée unique : confirmation de compte (ISE-002), réinitialisation de mot de passe (ISE-003), activation des comptes pré-créés (D-161). Lecture agrégée par type de lien via `public.admin_list_auth_link_events()` (exige `promotions.manage`), affichée sur un nouvel écran dédié `/administration/promotions/liens`. Liste blanche `anon_function_grant` de `private.security_baseline_violations()` étendue à 13 fonctions (`log_auth_link_event` ajoutée). Migrations `0118_auth_link_events.sql` et `0119_auth_link_events_public_rpc.sql` (correctif de schéma, voir plus bas). | `0118_auth_link_events.sql`, `0119_auth_link_events_public_rpc.sql`, `apps/web/src/app/auth/callback/route.ts`, `apps/web/src/app/administration/promotions/liens/page.tsx`, `apps/web/src/lib/admin/queries-auth-link-events.ts`, `apps/web/src/i18n/admin-campaigns.ts` |

**Le trou constaté.** Sur les 252 comptes ISE à provisionner (D-161), seuls 51 avaient reçu une
invitation à ce jour, envoyée via `inviteUserByEmail` (Supabase Auth natif). Le porteur a demandé
comment savoir qui avait *réellement cliqué* sur le lien reçu. Avant cette décision, rien dans
l'application ne journalisait ce clic : le seul proxy disponible était `auth.users.last_sign_in_at`
et `confirmed_at`, interrogés hors application. Ce proxy est aveugle à une distinction pourtant
essentielle pour relancer les bonnes personnes : un compte qui n'a **jamais cliqué** le lien et un
compte qui a **cliqué mais dont le lien était déjà invalide ou expiré** aboutissent tous deux au même
état final (`invited_and_signed_in = false`). Sans ce suivi, impossible de savoir s'il faut relancer
un e-mail (lien jamais vu) ou renvoyer un lien frais (lien vu mais mort).

**Pourquoi `/auth/callback` est le bon — et le seul — point d'instrumentation.** C'est l'unique
endroit de l'application où atterrit un clic sur un lien d'e-mail émis par Supabase Auth, quel que
soit son motif (confirmation, réinitialisation, invitation) et quel que soit son format (`?code=`
PKCE ou `?token_hash=&type=` classique). Toute autre approche (journaliser au moment de l'envoi,
scruter les logs Supabase) mesurerait l'envoi ou la remise, pas le clic réel de l'utilisateur.
Instrumenter cet unique point d'entrée capture les trois usages en une seule fois, sans dupliquer la
logique à chaque écran d'origine.

**Pourquoi les échecs sont journalisés aussi, pas seulement les succès.** C'est le cœur de la
décision : journaliser uniquement les succès aurait reproduit exactement le même angle mort que
`auth.users.last_sign_in_at` (un échec et une absence de clic restent indistinguables). En
journalisant CHAQUE atterrissage — `outcome = 'success'` ou `'error'`, avec le `error.code` Supabase
le cas échéant —, la ligne `(link_type = 'invite', outcome = 'error')` devient la preuve directe
qu'un destinataire a cliqué mais que le jeton était déjà mort, distincte de l'absence totale de ligne
(jamais cliqué).

**Schéma et sécurité.** La table vit dans `private` (D-16 : jamais exposée à l'API publique), avec
un `CHECK` fermé sur `link_type` (`signup`/`invite`/`magiclink`/`recovery`/`email_change`/`email`/
`code`) et sur `outcome` (`success`/`error`). `user_id` référence `auth.users(id) on delete set null`,
nullable : un jeton déjà invalide ne résout jamais personne. La fonction d'écriture valide les mêmes
listes fermées en PL/pgSQL avant l'insertion (défense en profondeur, au cas où le `CHECK` seul
laisserait passer une erreur moins lisible).

**Détail technique : la fonction d'écriture a dû être déplacée de `private` vers `public` en cours de
route (migration 0119, correctif de 0118).** Le brief initial prévoyait `private.log_auth_link_event`
avec `GRANT EXECUTE` à `anon`. Un test fonctionnel (`set role anon; select
private.log_auth_link_event(...)`) a immédiatement révélé le problème : `anon` n'a pas `USAGE` sur le
schéma `private` (`has_schema_privilege('anon', 'private', 'USAGE')` renvoie `false`), donc l'appel
échoue par `permission denied for schema private` avant même d'atteindre le corps de la fonction —
et PostgREST, qui route `supabase.rpc()`, n'expose de toute façon que le schéma `public` (vérifié :
aucune fonction `private.*` n'est appelée en RPC ailleurs dans `apps/web`). Le même appel aurait
échoué en production. Migration 0119 : la fonction devient `public.log_auth_link_event` (même corps,
mêmes `GRANT`), la TABLE reste `private.auth_link_events` — seul le point d'entrée RPC change de
schéma, la donnée reste hors de portée de l'API publique. Reproduit ensuite avec succès :
`set role anon; select public.log_auth_link_event('invite', 'success', null, null);` insère bien une
ligne, supprimée immédiatement après (pas de donnée de test laissée en base).

**La limite assumée.** Ce suivi capture le clic à partir du moment où il atteint `/auth/callback` —
c'est-à-dire une fois que Supabase a reçu la requête et tente de valider (ou refuse de valider) le
jeton. Il ne capture PAS les ouvertures d'e-mail ni les clics mesurés en amont par Resend lui-même
(pixel d'ouverture, clic sur le lien avant redirection), faute d'accès aux réglages du compte Resend
(webhook non configuré à ce jour). Si le porteur souhaite un jour ce niveau de détail supplémentaire
(ouverture avant clic, taux d'ouverture), il faudrait l'activer séparément côté tableau de bord Resend
et le brancher à un nouveau webhook — hors périmètre de cette décision, qui répond au besoin exprimé
(qui a cliqué, et le lien a-t-il fonctionné) sans dépendance externe supplémentaire.

**Placement de l'écran admin : un nouvel écran dédié, pas une greffe sur la fiche campagne.** Les
événements de `private.auth_link_events` sont une vue GLOBALE de la plateforme — tous types de liens,
toutes promotions, campagnes ou invitations individuelles (ISE-070) confondues — alors que la fiche
campagne existante (`/administration/promotions/[promotionId]/campagnes/[campaignId]`, SA-013→015)
exige un `campaignId` précis et affiche des statistiques propres à CETTE campagne. Y greffer un
résumé global aurait été trompeur : le lecteur aurait raisonnablement associé les chiffres à la
campagne affichée, alors qu'ils couvrent toute la plateforme. Un écran séparé,
`/administration/promotions/liens` (même permission `promotions.manage`, même thème fonctionnel),
évite cette confusion. Pas d'entrée dans la navigation principale — même choix que les sous-écrans
`campagnes` et `invitations`, déjà accessibles uniquement depuis la liste des promotions (SA-008) —
un lien y a été ajouté à côté du lien existant vers les signalements.

---
