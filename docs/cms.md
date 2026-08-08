# CMS et site public — modèle de données

Ce document décrit la **couche CMS** ajoutée par les migrations `0057` → `0066`, et l'**audit
préalable** qui a déterminé, besoin par besoin, ce qui est réutilisé et ce qui est créé.

Il complète `docs/db-conventions.md` (normatif), `docs/rls.md` (§11), `docs/cms-automation.md`
(tâches planifiées) et `docs/featured-profile.md` (ISE du jour).

Sources : `ADDENDUM AU MASTER PROMPT` §8 → §51 · `LP_Cahier_des_charges_fonctionnel_additionnel`
§6 → §44 · `LP_Modification_de_la_base_de_données`.

---

## 1. Règle cardinale

> Le CMS **n'est pas une seconde base de contenu**. Actualités, événements, opportunités, profils
> ISE, promotions et organisations restent dans leurs tables actuelles. Le CMS ajoute uniquement
> une couche d'**orchestration éditoriale** : quoi montrer, quand, dans quel ordre, sous quelle
> forme.

Trois conséquences appliquées partout :

1. **Rattachement par `entity_type` + `entity_id`** (addendum §10), jamais par une URL interne
   stockée. La route est générée par l'application.
2. **Aucune copie** de donnée métier dans une table `cms_*`. Le seul texte propre au CMS est le
   texte _éditorial_ d'une slide ou d'une campagne, qui n'existe nulle part ailleurs.
3. **Aucune table `public_news` / `public_events` / `public_profiles` / `public_opportunities`**
   (CDC §51).

---

## 2. Audit préalable — réutilisé vs créé

Audit mené sur la base réelle (`list_tables`, `execute_sql`) avant toute écriture.

### 2.1 Ce qui existait déjà et qui est réutilisé tel quel

| Besoin de PUB-001            | Objet existant réutilisé                                                                                                                                                                     | Pourquoi aucune table nouvelle                                                                                                                                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Actualités                   | `public.news` (0013) — `title`, `slug`, `summary`, `image_path`, `editorial_status`, `published_at`, `is_featured`, `featured_at`, `visibility`, `category_code`, `duplicate_of_news_id`     | Le module porte déjà le cycle éditorial complet (`draft` → `submitted` → `under_review` → `approved` → `published`), l'image de couverture et la mise à la une. Recréer une table d'actualités publiques serait le doublon explicitement interdit (addendum §11, CDC §51). |
| Mise à la une des actualités | `news.is_featured` + `news.featured_at`                                                                                                                                                      | **Existent déjà.** Aucune colonne `featured` n'a été ajoutée à `news`.                                                                                                                                                                                                     |
| Événements                   | `public.events` (0013) — `title`, `slug`, `starts_at`, `ends_at`, `timezone`, `format`, `city`, `country_code`, `status`, `cancelled_at`, `visibility`                                       | Le filtre « publié, futur, non annulé » se calcule sur ces colonnes. Un événement passé quitte la section **de lui-même** : aucun drapeau à maintenir (addendum §12).                                                                                                      |
| Opportunités                 | `public.opportunities` (0008) — `title`, `opportunity_type`, `contract_type`, `sector_id`, `country_code`, `city`, `remote_allowed`, `deadline`, `status`, `visibility`, `moderation_status` | Le teaser public se compose de ces colonnes. Le détail complet (`description`, rémunération, contact) reste authentifié (addendum §13).                                                                                                                                    |
| Profil « ISE du jour »       | `public.ise_profiles`, `public.promotions`, `public.organizations`, `public.profile_expertise_areas`, `public.expertise_areas`                                                               | Le teaser est **recomposé à chaque lecture** depuis ces tables. Aucune fiche n'est recopiée dans le CMS (addendum §15).                                                                                                                                                    |
| Expertises à explorer        | `public.expertise_areas` (14 lignes seedées en 0024) + `public.profile_expertise_areas`                                                                                                      | La taxonomie réelle est la source. Le nombre de profils est **compté**, jamais illustré.                                                                                                                                                                                   |
| Chiffres du réseau           | `ise_profiles`, `promotions`, `experiences`, `organizations`, `countries`                                                                                                                    | Agrégats calculés à la demande. Aucune table de compteurs, aucun snapshot : à ce volume, une requête agrégée coûte moins qu'une vue matérialisée à rafraîchir et ne peut pas devenir périmée.                                                                              |
| Partenaires (organisations)  | `public.organizations` (0002) — `canonical_name`, `logo_path`, `is_verified`                                                                                                                 | L'organisation partenaire **est** une organisation du référentiel. Seule la _campagne_ est nouvelle.                                                                                                                                                                       |
| Médias                       | Bucket Storage **`public-assets`** (0027), privé, 5 Mo, `image/png                                                                                                                           | jpeg                                                                                                                                                                                                                                                                       | webp` | Le bucket existait. Aucun bucket n'a été créé. |
| Permissions et rôles         | `private.permissions`, `private.roles`, `private.role_permissions`, `private.user_roles` (0004)                                                                                              | Sept permissions et deux rôles **ajoutés** au système existant. Aucun second système d'authentification (addendum §28, CDC §23).                                                                                                                                           |
| Audit                        | `private.log_audit()` (0018)                                                                                                                                                                 | Toute publication, transition, override et exclusion y est journalisée.                                                                                                                                                                                                    |
| Analytics                    | `analytics.profile_activity_events` (0019)                                                                                                                                                   | La contrainte `CHECK` a été **élargie** à huit types publics. Aucune table d'événements publics créée : ce serait un second entrepôt à réconcilier.                                                                                                                        |
| Helpers RLS                  | `private.has_permission()`, `private.current_profile_id()`                                                                                                                                   | Seul point d'autorisation (D-31). Aucun helper redéfini.                                                                                                                                                                                                                   |
| Contrôle de sécurité         | `private.security_baseline_violations()`                                                                                                                                                     | **Étendu** d'un sixième contrôle (liste blanche des fonctions exposées à `anon`).                                                                                                                                                                                          |

### 2.2 Colonnes ajoutées aux tables métier — strict minimum

| Table                             | Colonne                                                           | Pourquoi elle était nécessaire                                                                                                                                                                                                                                                            |
| --------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ise_profiles`                    | `public_summary text` (40–400 car.)                               | `bio` et `headline` sont des champs **internes**, rédigés pour un lectorat de membres authentifiés. Les promouvoir sur le web ouvert sans consentement violerait D-73 et le MASTER PROMPT §47. Le résumé public est un texte distinct, écrit en sachant qu'il sera public (addendum §16). |
| `ise_profiles`                    | `allow_public_feature boolean not null default false`             | Opt-in explicite. Aucun profil ne paraît publiquement sans acte positif du membre.                                                                                                                                                                                                        |
| `news`, `events`, `opportunities` | `landing_visibility text` (`hidden` / `visible`), défaut `hidden` | `visibility` (`members` / `promotion` / `community`) dit **à qui** un contenu s'adresse _dans le réseau_. Elle ne dit pas s'il peut paraître sur le web ouvert. Confondre les deux publierait automatiquement des contenus de promotion.                                                  |
| `news`, `events`, `opportunities` | `landing_priority smallint` (0–1000)                              | Ordre éditorial stable, sans toucher au tri métier.                                                                                                                                                                                                                                       |

**Ce qui a été délibérément _non_ ajouté**, malgré les suggestions de
`LP_Modification_de_la_base_de_données` :

- `ise_profiles.public_feature_excluded_until` et `public_feature_updated_at` — l'exclusion d'un
  profil est un **acte éditorial daté et auditable**, pas un attribut permanent du profil. Elle est
  portée par `cms_content_overrides` (`override_kind = 'exclude'`). Décision **D-122**.
- `news.featured` — `is_featured` existe déjà.
- `public_teaser`, `public_image_id` sur les tables métier — le teaser se compose à la lecture
  depuis `summary` / `title` / `image_path`. Dupliquer le texte créerait deux vérités.
- Une table `cms_versions` — voir §4.

### 2.3 Les huit tables créées

| Table                          | Écran   | Pourquoi elle ne pouvait pas être une table existante                                                                                                                                                                        |
| ------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cms_media_assets`             | CMS-008 | Storage détient les octets ; aucune table ne détenait `alt_text`, crédit, dimensions, variantes ni références d'usage. `alt_text` est **NOT NULL** : un média sans alternative textuelle n'est pas publiable (addendum §52). |
| `cms_sections`                 | CMS-003 | Le squelette de la landing (ordre, activation, source automatique/manuelle, nombre de cartes) n'existe nulle part. Ne contient **aucun** contenu métier.                                                                     |
| `cms_carousel_items`           | CMS-002 | Le texte éditorial d'une slide n'existe dans aucune table métier. La slide _pointe_ la ressource par `entity_type` + `entity_id`.                                                                                            |
| `cms_partner_campaigns`        | CMS-007 | Une campagne a une période, un emplacement, un CTA et une **mention de transparence obligatoire**. `organizations` ne porte rien de tout cela.                                                                               |
| `cms_publication_schedule`     | CMS-009 | Table **commune** volontairement : le calendrier doit montrer actualités, événements, slides et campagnes sur une seule ligne de temps. Une colonne `publish_at` par table l'aurait rendu impossible.                        |
| `cms_content_overrides`        | §43     | Primitive générique « source automatique + override éditorial borné » : épingler, exclure, masquer. Porte aussi l'exclusion « ISE du jour ».                                                                                 |
| `cms_featured_profile_rules`   | CMS-006 | Paramètres de sélection. Une seule ligne active (index unique partiel).                                                                                                                                                      |
| `cms_featured_profile_history` | CMS-006 | Qui, quand, selon quel mode. **Aucune donnée de profil.** Support de la règle de rotation.                                                                                                                                   |

---

## 3. Vocabulaires (D-13 : `text` + `CHECK`, jamais `ENUM`)

```
statut CMS        draft · scheduled · published · expired · archived   public.is_cms_status()
entity_type       news · event · opportunity · profile · promotion ·
                  organization · community · project · network_call ·
                  expertise_area · external                            public.is_cms_entity_type()
source_mode       automatic · manual · hybrid
override_kind     pin · exclude · hide
placement         carousel · partners_band · news_inline · sidebar · footer
variant_kind      original · desktop · mobile · thumbnail
selection_mode    automatic · manual · fallback
```

Les transitions d'état passent **exclusivement** par les fonctions serveur atomiques de `0059`.
Deux triggers l'imposent (`0058`) :

- `private.cms_guard_publication_state()` sur `cms_sections`, `cms_carousel_items`,
  `cms_partner_campaigns` — refuse toute écriture directe de `status`, `published_snapshot`,
  `previous_published_snapshot`, `published_at`, `published_by_profile_id` ;
- `private.cms_guard_schedule_state()` sur `cms_publication_schedule` — un ordre ne se déclare pas
  « appliqué » à la main.

La RLS ne sait pas comparer `OLD` et `NEW` : sans ces triggers, un porteur de `cms.edit` aurait pu
écrire `status = 'published'` en `UPDATE` et contourner la vérification de `cms.publish`.

---

## 4. Brouillon, version publiée, rollback (§48, §49)

Pas de table `cms_versions`. Chaque table publiable porte quatre colonnes :

| Colonne                                   | Rôle                                        |
| ----------------------------------------- | ------------------------------------------- |
| _(colonnes vivantes)_                     | **le brouillon** — ce que l'éditeur modifie |
| `published_snapshot jsonb`                | ce que **voit le site public**              |
| `previous_published_snapshot jsonb`       | cible du rollback en un appel               |
| `published_at`, `published_by_profile_id` | traçabilité                                 |

Les fonctions de PUB-001 lisent **le snapshot**, jamais les colonnes vivantes. Conséquences
directes, toutes testées :

- une édition en cours n'atteint pas le site public (§48, cas E02) ;
- si le CMS tombe, la dernière version publiée reste servie (§47, cas E03) ;
- `public.rollback_cms_content()` restaure la version précédente **sans perdre le brouillon
  courant** (§49).

Une table de versions aurait ajouté une jointure sur chaque lecture publique et un cycle de vie
supplémentaire à gérer, pour la même garantie. Décision **D-124**.

---

## 5. Permissions et rôles (§29)

Ajoutés à `private.permissions` (0058) :

```
cms.read · cms.edit · cms.publish · cms.schedule
cms.media.manage · cms.partners.manage · cms.featured_profile.manage
```

Rôles éditoriaux créés, **dans le système existant** :

| Rôle            | Permissions CMS                                                         |
| --------------- | ----------------------------------------------------------------------- |
| `superadmin`    | les sept                                                                |
| `cms_publisher` | les sept                                                                |
| `cms_editor`    | `cms.read`, `cms.edit`, `cms.media.manage` — **ni publish ni schedule** |

`content_manager` n'a pas été modifié : son périmètre (`content.publish`) est le circuit éditorial
des actualités, distinct de la vitrine publique.

La séparation `cms_editor` / `cms_publisher` est exactement ce que testent les cas C03 et C04 :
l'éditeur modifie un brouillon, échoue à publier (`not_authorized`), et échoue à forcer le statut
en `UPDATE` (`invalid_transition`).

---

## 6. RLS (détail complet dans `docs/rls.md` §11)

Toutes les politiques ciblent `to authenticated` et se résolvent par `private.has_permission()`.

| Table                          | SELECT     | INSERT / UPDATE                                                                       | DELETE                                   |
| ------------------------------ | ---------- | ------------------------------------------------------------------------------------- | ---------------------------------------- |
| `cms_media_assets`             | `cms.read` | `cms.media.manage`                                                                    | `cms.media.manage`                       |
| `cms_sections`                 | `cms.read` | `cms.edit`                                                                            | `cms.publish` **et** `not is_structural` |
| `cms_carousel_items`           | `cms.read` | `cms.edit`                                                                            | `cms.publish`                            |
| `cms_partner_campaigns`        | `cms.read` | `cms.partners.manage`                                                                 | `cms.partners.manage`                    |
| `cms_publication_schedule`     | `cms.read` | `cms.schedule`                                                                        | `cms.schedule`                           |
| `cms_content_overrides`        | `cms.read` | `cms.featured_profile.manage` si `section_key = 'featured_profile'`, sinon `cms.edit` | idem                                     |
| `cms_featured_profile_rules`   | `cms.read` | `cms.featured_profile.manage`                                                         | idem                                     |
| `cms_featured_profile_history` | `cms.read` | **aucune politique**                                                                  | **aucune politique**                     |

`cms_featured_profile_history` est en **lecture seule pour tout client** : les écritures passent par
les fonctions de `0059`, qui journalisent. Une écriture directe casserait la piste d'audit (§22).

---

## 7. Projections public-safe (§44, §45)

`anon` n'a **aucun** privilège sur `public`, `private` ni `analytics` — état posé en `0026`, **non
assoupli**. Le site public appelle exclusivement dix fonctions `SECURITY DEFINER` :

| Fonction                                  | Ce qu'elle projette                                                         | Ce qu'elle ne projette jamais                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `public.get_landing_carousel()`           | slides publiées et dans leur période, depuis le snapshot                    | une slide sponsorisée dont la campagne n'est plus active                               |
| `public.get_landing_sections()`           | squelette publié                                                            | une section non publiée                                                                |
| `public.get_landing_news(int)`            | id, titre, slug, résumé, catégorie, image, date, à la une                   | le corps de l'article ; toute actualité `promotion` ou `community`                     |
| `public.get_landing_events(int)`          | id, titre, slug, dates, fuseau, format, ville, pays                         | `online_url_private` ; les événements passés ou annulés                                |
| `public.get_landing_opportunities(int)`   | titre, type, contrat, secteur, zone, échéance, organisation **si vérifiée** | description, rémunération, contact, URL de candidature                                 |
| `public.get_landing_featured_profile()`   | 11 champs, voir `docs/featured-profile.md`                                  | e-mail, téléphone, adresse, date de naissance, `bio`, `headline`, `profile_completion` |
| `public.get_landing_expertises(int)`      | taxonomie réelle + décompte **calculé**                                     | —                                                                                      |
| `public.get_landing_partners(text)`       | campagnes actives + `sponsored_label` **toujours**                          | une campagne hors période                                                              |
| `public.get_landing_stats()`              | quatre compteurs + **leur source nommée**                                   | aucun chiffre en dur                                                                   |
| `public.record_public_landing_event(...)` | _(écriture)_ huit types d'événements publics                                | IP, empreinte, texte libre                                                             |

Le contrôle `anon_function_grant` de `security_baseline_violations()` échoue si une onzième
fonction est exposée à `anon`. Décision **D-125**.

---

## 8. Chiffres du réseau (§23, MASTER PROMPT §98)

`get_landing_stats()` renvoie, pour chaque compteur, `{ value, source }` :

| Compteur        | Source réelle                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------- |
| `profiles`      | `ise_profiles` hors comptes de test, non supprimés, statut `referenced` ou `active`                 |
| `promotions`    | promotions **effectivement représentées** par au moins un profil — pas les 72 lignes du référentiel |
| `countries`     | pays distincts de `ise_profiles.current_country_code` ∪ `experiences.country_code`                  |
| `organizations` | organisations résolues de `ise_profiles.current_organization_id` ∪ `experiences.organization_id`    |

État constaté au moment de l'écriture, annuaire non importé : **0 / 0 / 0 / 0**. C'est la réponse
correcte. Les valeurs 1842 / 37 / 29 / 126 des maquettes sont illustratives ; le cas de test H04
échoue si l'une d'elles apparaît.

---

## 9. Transparence publicitaire (§26)

`cms_partner_campaigns.sponsored_label` est **NOT NULL** avec `char_length(btrim(...)) >= 3` : une
campagne sans mention ne peut pas exister en base. Ce n'est pas une règle d'affichage, c'est une
contrainte de schéma.

`cms_carousel_items` porte `check (is_sponsored = (partner_campaign_id is not null))` : une slide
sponsorisée est nécessairement rattachée à la campagne qui porte sa mention. Et
`get_landing_carousel()` exclut une slide sponsorisée dont la campagne n'est pas actuellement
publiée et dans sa période — pas de mention, pas de diffusion (cas F04).

---

## 10. Ce que la couche DB ne fait pas

Périmètre volontairement laissé à l'application (`apps/`, hors de ce lot) :

- le routage `openProtectedResource` / `redirectTo` et la protection open-redirect (§4, §5) — pure
  logique applicative, aucune table nécessaire (`LP_Modification` §11) ;
- le pipeline d'optimisation d'images (§39) — la base stocke les métadonnées et les variantes,
  la génération est un travail serveur ;
- le cache et la revalidation ciblée (§46) ;
- la prévisualisation CMS-010 — elle lit les colonnes **vivantes** (le brouillon) avec les
  permissions CMS, là où le site public lit le snapshot.

---

## 11. Le back-office CMS-001 → CMS-010 et la migration `0067`

Le §10 annonçait le périmètre laissé à l'application. Il est désormais couvert par les écrans
`apps/web/src/app/cms/**` et par **une seule** migration additive, `0067_cms_backoffice_api`.

### 11.1 Pourquoi une migration était nécessaire

Cinq choses ne pouvaient pas être résolues côté application :

| Besoin                                     | Obstacle réel                                                                                                                                   | Réponse de `0067`                                                                                |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Rediriger vers SYS-006 avant le rendu      | `private.permissions` et `private.user_roles` ne sont pas exposées à PostgREST                                                                  | `public.get_my_cms_permissions()`                                                                |
| Lire `news` et `events` depuis le CMS      | leur RLS (0046) accorde la lecture par `can_see_news()` / `can_see_event()` et l'écriture par `content.publish` — jamais par une permission CMS | `list_cms_news()`, `list_cms_events()` — colonnes énumérées, sans `body` ni `online_url_private` |
| Écrire l'exposition sur la landing (D-128) | même cause                                                                                                                                      | `set_landing_exposure()`, `set_news_featured()`                                                  |
| Agréger CMS-001 en un aller-retour         | les compteurs mélangent des tables lisibles avec `cms.read` et d'autres non                                                                     | `get_cms_dashboard()`                                                                            |
| Déposer un média dans `public-assets`      | **défaut réel** : `ise_public_assets_write` (0027) exige `content.publish`. Un `cms_publisher` ne pouvait pas utiliser sa propre médiathèque    | politique additive `ise_public_assets_cms_write`                                                 |

`get_cms_featured_profile_overview()` et `list_cms_featured_profile_candidates()` complètent CMS-006
sans exposer la moindre donnée privée : les privilèges de colonne d'`ise_profiles` (0028) interdisent
d'y accéder autrement.

### 11.2 Défaut trouvé pendant l'application, et corrigé

Le bloc de vérification final de `0067` a **échoué au premier essai** : les huit fonctions étaient
exécutables par `anon`. Le garde-fou `pg_default_acl` de `0066` ne s'applique que lorsque le rôle
créateur est celui de l'entrée (`defaclrole = postgres`) ; la connexion de migration ne l'est pas, et
les fonctions naissaient donc avec `proacl = NULL`, c'est-à-dire `EXECUTE` pour `PUBLIC`.

C'est **D-126 réapparu par un autre chemin**. La leçon de `0062` s'applique telle quelle : ne jamais
compter sur un défaut, poser le privilège explicitement. `0067` porte donc un `GRANT` / `REVOKE`
explicite par fonction, suivi d'une vérification qui fait échouer la migration en cas de fuite.
`private.security_baseline_violations()` reste à **0**.

### 11.3 Ce que le back-office ne fait toujours pas

- **La génération des variantes d'image** (§39, étapes 3 et 4). Le pipeline valide, stocke et
  enregistre les métadonnées ; il n'optimise pas et ne produit ni Desktop, ni Mobile, ni vignette,
  faute d'encodeur d'images déployé. Aucune variante fictive n'est enregistrée, et l'alerte
  `media_no_variant` du tableau de bord réclame la génération tant qu'elle n'existe pas.
- **Le rendu pixel de PUB-001 dans l'aperçu** (§41). CMS-010 prévisualise la _configuration_ réelle
  du brouillon — ordre, activation, textes, slides, mentions — sans la publier. Il ne réimplémente
  pas les composants de `app/(public)/`.

---

## 12. Les images de la vitrine, et la migration `0068`

### 12.1 Le défaut

Les §7 et §11 décrivaient une chaîne complète du CMS à la vitrine. Elle l'était,
sauf sur un point : **aucune image ne s'affichait**. Les huit buckets de `0027`
sont privés (D-73) et PUB-001 est servie à des visiteurs **anonymes** : il
n'existait donc aucune URL d'image chargeable sans session. `landingMediaUrl()`
renvoyait `null` par construction, aucune balise `img` n'était émise, et le
carrousel, les couvertures d'actualités, les logos de partenaires et l'avatar de
l'« ISE du jour » restaient vides. Le CMS savait stocker un visuel ; la vitrine
ne savait pas l'afficher.

### 12.2 Ce que `0068` change

| Objet                            | Avant                                        | Après                                                                               |
| -------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| Bucket public                    | aucun                                        | **`landing-media`**, et lui seul (D-134)                                            |
| Destination de CMS-008           | `public-assets` (privé)                      | `landing-media`, sous `carousel/`, `partners/`, `news/` ou `sections/`              |
| `cms_media_assets.bucket_id`     | défaut `public-assets`, `CHECK` à une valeur | défaut `landing-media`, `CHECK` à deux valeurs (D-137)                              |
| Types acceptés                   | png, jpeg, webp                              | + `avif` ; **jamais** de SVG                                                        |
| `private.landing_media()`        | projetait n'importe quel média               | projette **uniquement** bucket public + `alt_text` non vide + non supprimé (D-136)  |
| `get_landing_news()`             | `image_path` (texte nu)                      | `image` (média complet, résolu dans la médiathèque)                                 |
| `get_landing_partners()`         | `organization_logo` (texte nu)               | `organization_logo` (média complet)                                                 |
| `get_landing_featured_profile()` | projetait `avatar_path`                      | **ne le projette plus** (D-135)                                                     |
| `storage_baseline_violations()`  | 5 contrôles                                  | 8 contrôles, dont « un autre bucket est public » et « landing-media ne l'est plus » |
| Vignettes de la médiathèque      | absentes                                     | **réelles**, servies depuis le bucket public                                        |

### 12.3 L'« ISE du jour » n'a pas de photographie — D-135

Deux options existaient : ne pas afficher d'avatar, ou faire consentir le membre
à une copie publique lors de l'opt-in `allow_public_feature`. **La première a été
retenue** : le teaser porte un monogramme (initiales dans une pastille).

Le raisonnement complet est en D-135. En résumé : `allow_public_feature` consent
à la parution d'un teaser **textuel** aux champs énumérés, pas à la publication
d'un portrait sur le web ouvert — s'en servir pour cela serait un détournement de
finalité (MASTER PROMPT §47). Et une photographie publiée est **irrécupérable** :
cache CDN, moteurs, archiveurs. Un retrait de consentement, une suppression de
compte (D-19) ou une exclusion éditoriale (D-122) ne peuvent plus la rappeler.
La maquette `PUB-001_Landing_Page_Desktop_1440` montre d'ailleurs une carte
« ISE DU JOUR » purement textuelle : le monogramme lui est conforme.

La projection a été **resserrée** au passage : elle ne descend plus `avatar_path`.
Ce chemin n'était chargeable par personne (bucket privé) et divulguait la
structure d'un espace privé à un visiteur anonyme, pour rien.

### 12.4 Ce que `0068` ne fait toujours pas

- **Les variantes d'image** (ADDENDUM §39, étapes 3 et 4). D-133 tient, amendé par
  D-140 : le pipeline valide, stocke, mesure et enregistre ; il n'optimise pas et
  ne produit ni Desktop, ni Mobile, ni vignette. Le redimensionnement réel est
  assuré à la volée par l'optimiseur de `next/image`, pas par des variantes en
  base. L'alerte `media_no_variant` du tableau de bord reste allumée.
- **Le test de suppression dans `landing-media`** (D-139). Supabase interdit le
  `DELETE` direct sur `storage.objects` par un déclencheur `FOR EACH STATEMENT` :
  le harnais `0023` mesure l'`UPDATE`, qui porte la même condition, et la forme de
  la politique de suppression.
- **La reprise des médias déjà déposés dans `public-assets`.** Aucun n'existe à ce
  jour (table vide au moment de la migration). S'il en apparaissait, ils resteraient
  listés dans CMS-008, sans vignette, et ne paraîtraient pas sur la vitrine.
