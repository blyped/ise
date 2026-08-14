# Journal des décisions — Compétences ISE — Partie 7/8 : Mises en avant et « ISE du jour »

Sections 33 à 37 du journal des décisions du projet Compétences ISE.
Index général, préambule, convention de statut (ADOPTÉE / PROVISOIRE / OUVERTE)
et décisions de cadrage : [`docs/decisions.md`](../decisions.md).

---

## 33. Image de couverture sur les pages de détail — événement et opportunité rejoignent l'actualité (D-174)

| # | Décision | Source |
| --- | --- | --- |
| D-174 | **ADOPTÉE** — `private.event_card()` et `private.opportunity_card()` projettent désormais une clé `cover`, résolue par `private.landing_media(cover_media_id)` — la même fonction que `get_landing_events()` et `get_landing_opportunities()`. Les pages `/evenements/[eventId]` et `/opportunites/[opportunityId]` affichent ce visuel en tête, et n'affichent rien si aucune couverture n'est posée. Extension au mobile pour l'opportunité (`OpportunityDetailScreen`) ; aucun écran de détail d'événement n'existe encore côté mobile. Aucun champ « image mobile » n'est créé. | `0125_detail_cover_media.sql`, `content-view.ts`, `opportunities-view.ts`, `evenements/[eventId]/page.tsx`, `OpportunityDetailView.tsx`, `apps/mobile/src/lib/media.ts` |

**Le même écart que celui corrigé pour les actualités, à deux endroits de plus.** `cover_media_id`
existe sur `events` et `opportunities` depuis `0113` (D-166), est choisi dans `/cms/evenements` et
`/cms/opportunites`, et alimente déjà les cartes de la page d'accueil. Mais les fonctions qui servent
les **pages de détail** ne le projetaient pas : le visuel était choisi, stocké, payé en espace de
stockage — et jamais montré à l'endroit où il aurait le plus de sens. Exactement le constat qui avait
motivé D-172 pour l'actualité. Les deux fonctions sont recréées à l'identique de leur définition
d'origine (`0074` et `0056`), à la seule différence de la clé ajoutée : la migration a été produite
par transformation programmatique du fichier source, pas par retranscription manuelle, précisément
parce que ces fonctions font 7 à 8 Ko chacune.

**Une seule image par contenu, toujours.** Aucun second téléversement « version mobile » n'est
introduit, ni ici ni ailleurs : `StorageImage` encapsule `next/image` en `fill` avec une prop `sizes`
par point de rupture, et Next.js génère les résolutions à la volée depuis l'unique original. C'est la
réponse directe à la demande du porteur de ne pas « mettre 4 images pour un seul article » (D-172).
Le carrousel héros reste la seule exception, avec son `mobile_media_id` distinct — direction
artistique volontairement différente entre desktop et mobile, et non une contrainte technique.

---

## 34. Encarts de « À la une du réseau » entièrement cliquables — la connexion reste exigée pour le détail (D-175)

| # | Décision | Source |
| --- | --- | --- |
| D-175 | **ADOPTÉE** — Les quatre encarts de la zone « À la une du réseau » (actualité, ISE du jour, événement, opportunité) deviennent cliquables **dans leur intégralité**, chacun vers sa page de détail. Motif d'accessibilité retenu : le **lien étendu** — le CTA existant reste l'unique `<a>` de la carte, son pseudo-élément `::after` en `absolute inset-0` couvre l'`<article>` passé en `relative`. Aucune page publique de détail n'est créée : un visiteur non authentifié est redirigé vers `/connexion?redirectTo=…` par `ProtectedLink`, comportement **explicitement voulu par le porteur**. | `HighlightsSection.tsx`, `entity-routes.ts`, `i18n/public.ts` |

**Le bug de fond : un commentaire périmé rendait deux cartes inertes.** `entityRoute()` renvoyait
`null` pour `news` et pour `event`, au motif d'un commentaire affirmant que les écrans ISE-092→096
n'existaient pas. Ils existent depuis : `apps/web/src/app/actualites/[newsId]/page.tsx` et
`apps/web/src/app/evenements/[eventId]/page.tsx`. Conséquence, la carte Actualité et la carte
Événement n'affichaient **aucun** lien — seulement la mention « Consultable depuis l'espace membre ».
Deux cartes sur quatre étaient donc des impasses, non par choix mais par oubli de mise à jour d'un
garde-fou devenu faux. La fonction et son commentaire sont corrigés et datés.

**Pourquoi le lien étendu plutôt que la carte-lien.** Envelopper la carte entière dans un `<Link>`
aurait produit un lien imbriqué dans un lien sur les deux cartes qui portaient déjà un CTA
(Opportunité, ISE du jour) — HTML invalide. Le lien étendu garantit **un seul `<a>` par carte**, un
nom accessible court et explicite (« Voir l'opportunité : <titre> ») plutôt que la récitation de tout
le contenu de la carte par un lecteur d'écran, et laisse le texte sélectionnable. Survol et
`focus-visible` sont signalés sur la carte entière. Quand `entityRoute()` renvoie légitimement `null`
(cas `expertise`, identifiant vide), la carte reste un `<article>` inerte : jamais de lien mort.

**Le mur de connexion est assumé, pas subi.** La question a été posée explicitement au porteur, avec
trois options : créer des pages publiques de détail, garder la connexion obligatoire, ou un teaser
public suivi d'un contenu réservé. Il a tranché pour la connexion obligatoire. La conséquence est
donc connue et acceptée : un visiteur anonyme qui clique sur un encart de la vitrine atterrit sur
l'écran de connexion. Aucun `page.tsx` n'existe sous `apps/web/src/app/(public)/` — la seule page
publique reste `/`.

---

## 35. Portrait public de l'« ISE du jour » — D-135 est révisée, mais par un consentement neuf, pas par réinterprétation de l'ancien (D-176)

| # | Décision | Source |
| --- | --- | --- |
| D-176 | **ADOPTÉE, révise D-135** — L'encart « ISE du jour » peut afficher le portrait du membre. Ce portrait n'est PAS l'avatar du bucket privé : c'est un **portrait public distinct**, déposé par le membre lui-même sous `landing-media/membres/<profile_id>/`, et couvert par un **consentement dédié** `ise_profiles.allow_public_photo` (booléen, faux par défaut), séparé de `allow_public_feature`. Ordre de priorité à l'affichage : visuel éditorial choisi par l'admin (D-165), sinon portrait public consenti, sinon monogramme d'initiales (comportement D-135 inchangé). L'écran `/mon-profil/vitrine-publique` expose la brève description publique (`public_summary`, 40–400 caractères, contrainte préexistante de `0057`) et les deux consentements, chacun libellé sans ambiguïté. | `0120_public_photo_consent.sql`, `0123_featured_profile_public_photo_rule.sql`, `mon-profil/vitrine-publique/`, `i18n/profile-showcase.ts` |

**Ce que D-135 refusait, et pourquoi la révision ne le rétablit pas.** D-135 écartait la photographie
pour trois motifs : le consentement existant portait sur un teaser **textuel** et non sur un
portrait ; une image publiée sur le web ouvert est irréversible (CDN, moteurs, archiveurs) ; la
maquette PUB-001 ne montrait aucun portrait. Le porteur a demandé le portrait, en indiquant lui-même
« modifié le consentement ». La révision suit donc la voie que D-135 laissait ouverte — **obtenir le
bon consentement** — et non celle qu'elle condamnait, à savoir réutiliser une case cochée pour un
usage qu'elle ne décrivait pas. Le motif (1) est traité par une colonne neuve et un libellé explicite ;
le motif (2) reste vrai et est dit au membre au moment du choix ; le motif (3) devient un écart
assumé à la maquette, tranché par le porteur.

**Un point a été signalé au porteur et mérite d'être répété ici.** Le raisonnement « il faut être
connecté pour voir le détail du profil » ne protège pas la photo : la page d'accueil est publique,
donc le médaillon est visible par n'importe quel visiteur. C'est le **clic** vers la fiche profil qui
reste réservé aux membres, pas l'image. C'est précisément pour cela qu'un consentement réel était
nécessaire plutôt qu'une simple réutilisation de l'existant.

**Pourquoi un dépôt distinct plutôt qu'une copie de l'avatar.** L'option « copier l'avatar de
`avatars` vers `landing-media` au moment du consentement » s'est révélée **irréalisable en SQL** :
PostgreSQL n'a aucun accès aux octets stockés côté S3. Plutôt que de la simuler, un cinquième préfixe
d'usage `membres/<profile_id>/` a été ouvert dans le bucket public, où le membre dépose lui-même son
portrait public. Le bucket `avatars` reste privé et intouché, et il n'existe aucune copie à
resynchroniser. Les politiques Storage limitent chaque membre à son propre préfixe **et** sont
conditionnées au consentement. Un déclencheur retire l'objet et remet les colonnes à `NULL` dans les
trois cas de sortie : retrait du consentement, suppression de compte (D-19), remplacement du portrait.

**Limite assumée, à ne pas oublier.** Supabase interdit le `DELETE` direct sur `storage.objects` : le
déclencheur retire l'objet du **service** (URL en 404) sans effacer les octets côté S3, ce que la base
ne peut pas faire. Le retrait demandé par le membre depuis l'interface, lui, appelle l'API Storage et
efface réellement. Reste non couvert : l'effacement physique lors d'une suppression de compte. Un
nettoyage Storage périodique reste à brancher — c'est un manque nommé, pas masqué (même exigence de
franchise que D-133 sur les variantes d'images non générées). Suite de tests :
`supabase/tests/rls/0040_public_photo_consent_suite.sql`, 31 cas, 0 échec sur la base réelle.

---

## 36. File de programmation des encarts « À la une » et rotation automatique de l'ISE du jour (D-177)

| # | Décision | Source |
| --- | --- | --- |
| D-177 | **ADOPTÉE** — Les encarts Actualités, Événements et Opportunités reçoivent une **file de passage ordonnée** : plusieurs contenus programmés à l'avance, avec durée de passage réglable (7 jours par défaut), gérée par `add_landing_queue_entry()`, `move_landing_queue_entry()`, `remove_landing_queue_entry()`, `list_landing_queue()` et `set_landing_queue_default_days()`, appliquée par la tâche `pg_cron` `cms_apply_landing_queue` (toutes les 10 minutes). Écran dédié `/cms/programmation/a-la-une`. L'« ISE du jour » suit un mécanisme distinct : rotation automatique quotidienne (`cms_select_featured_profile` à 5 h 30, `cms_publish_featured_profile` à 6 h 00), équitable par promotion, avec départage pseudo-aléatoire, et épinglage manuel prioritaire. | `0121_landing_queue_and_featured_rotation.sql`, `0124_landing_queue_passage_duration.sql`, `cms/programmation/a-la-une/`, `lib/cms/landing-queue.ts` |

**Ce qui manquait réellement.** `cms_publication_schedule` existait déjà, mais un index unique partiel
`(entity_type, entity_id) WHERE status='pending'` n'y autorisait **qu'une seule bascule en attente par
contenu** : c'était une date de publication, pas une file. Rien n'y disait quel contenu occupe
l'encart, ni dans quel ordre. La demande du porteur — « mettre un certain nombre d'articles dans une
liste avec date de passage, pour ne pas venir le faire à chaque fois » — supposait une notion d'ordre
et de succession qui n'existait nulle part. La file s'appuie sur `cms_content_overrides` (épinglage),
mécanisme déjà en place, plutôt que sur une table concurrente.

**Rotation, pas tirage au sort.** Le porteur demandait « un affichage aléatoire ». Le mécanisme livré
est une **rotation équitable par promotion**, le hasard n'intervenant qu'en départage
(`digest(jour || profil_id, 'sha256')`). C'est un écart délibéré à la lettre de la demande : un tirage
purement aléatoire peut afficher deux fois la même personne en une semaine et ignorer une promotion
entière pendant des mois, ce qui dessert exactement l'objectif d'un annuaire d'anciens. Le délai
minimal entre deux passages d'un même profil (`min_days_between_features`, 90 jours) et l'intervalle
de rotation (`rotation_interval_days`) restent réglables depuis `/cms/ise-du-jour`.

**D-128 et D-129 tiennent.** La file ne touche que `landing_visibility` et l'épinglage : jamais
`news.editorial_status`, `events.status` ni `opportunities.status` — programmer une parution reste
distinct de valider un contenu. Et aucune tâche n'est déclarée « planifiée » sans exister réellement :
les six tâches (`cms_apply_landing_queue`, `cms_expire_content`, `cms_publish_scheduled`,
`cms_select_featured_profile`, `cms_publish_featured_profile`, `notifications_process_domain_events`)
ont été vérifiées dans `cron.job`, toutes actives, toutes en `succeeded` sur leurs dernières exécutions.

**Correctif de cohérence : `require_avatar` visait une colonne morte.** La règle
`cms_featured_profile_rules.require_avatar` exigeait un `avatar_path` — colonne du bucket privé, non
publiable, et renseignée sur **0 profil des 260**. La règle rendait donc la sélection structurellement
impossible tout en paraissant fonctionner. Elle est remplacée par `require_public_photo`, qui porte
sur le portrait public consenti de D-176. La clé i18n correspondante a suivi
(`ruleRequirePublicPhoto`).

**Le vivier est vide, et c'est normal à ce stade.** Au moment de la livraison : 0 profil avec
`allow_public_feature`, 0 avec `allow_public_photo`, 0 avec `public_summary` renseigné — donc 0 profil
éligible. Le mécanisme tourne à vide tant que les membres n'ont pas rempli leur vitrine publique. Ce
n'est pas une panne : `get_landing_featured_profile()` renvoie `null` et la page affiche un repli
explicite (carte pointillée invitant à réclamer son profil), sans jamais inventer d'identité.

---

## 37. Piliers « Un réseau conçu pour être utile » — cliquables, et un conteneur d'image qui tient (D-178)

| # | Décision | Source |
| --- | --- | --- |
| D-178 | **ADOPTÉE** — Les quatre piliers reçoivent une destination : Connecter → recherche (déjà câblé), Entraider → appels au réseau, Collaborer → projets, Impacter → candidatures. Le conteneur d'image est corrigé en boîte `relative aspect-[16/9]`, alignée sur le `MediaFrame` de « À la une » et sur le hint CMS (1600 × 900). Aucune destination n'est inventée hors de la liste blanche existante. | `0122_landing_pillars_link_targets.sql`, `NetworkSection.tsx` |

**Trois piliers sur quatre n'étaient pas cliquables.** Le support existait depuis `0114` (D-168) —
colonne `link_target`, liste blanche, enveloppe `ProtectedLink` — mais le seed ne câblait que
`connecter → search`. Les trois autres piliers étaient rendus en `<div>` inerte. La migration ne
renseigne que les lignes où `link_target is null`, pour ne jamais écraser un choix ultérieur de
l'administrateur.

**Un défaut d'affichage qui ne se serait vu qu'au premier visuel posé.** `StorageImage` rend une image
en `fill`, or `NetworkSection` la posait directement dans la carte avec `aspect-video w-full` sur
l'image elle-même, sans conteneur `relative`. L'image se serait positionnée hors de la carte et
n'aurait réservé aucune place — violation directe de D-138, qui exige que la place soit réservée par
le conteneur et non par les dimensions intrinsèques. Le défaut était invisible jusqu'ici pour une
seule raison : **aucun pilier n'a de visuel**, `media_id` étant `null` sur les quatre. Sans image,
aucun cadre n'est rendu et la mise en page reste intacte.

**Ce qui reste à la main du porteur.** Les visuels des piliers, comme ceux des actualités, événements
et opportunités, doivent être téléversés dans la médiathèque puis choisis dans `/cms/piliers`. Aucun
fichier image n'est fabriqué par le code : la chaîne complète (médiathèque → `set_landing_pillar` →
`get_landing_pillars()` → rendu) a été vérifiée de bout en bout, elle attend son contenu.

---
