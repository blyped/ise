# Journal des décisions — Compétences ISE — Partie 10/10 : Dons, organisations, cadrage et pastilles

Sections 44 à 54 du journal des décisions du projet Compétences ISE.
Index général, préambule, convention de statut (ADOPTÉE / PROVISOIRE / OUVERTE)
et décisions de cadrage : [`docs/decisions.md`](../decisions.md).

---

## 44. Lien de retour vers l'espace membre depuis Administration et CMS (D-184)

| # | Décision | Source |
| --- | --- | --- |
| D-184 | **ADOPTÉE** — `AdminNav` et `CmsNav` reçoivent un troisième lien croisé, `memberLink` (vers `ROUTES.dashboard`), à côté des liens déjà existants `adminLink`/`cmsLink` posés par D-171. `memberLink` est rendu **requis** côté `AdminNav`/`CmsNav` (jamais optionnel) précisément pour ne pas retomber dans le piège `exactOptionalPropertyTypes` qui avait déjà cassé ces deux fichiers à deux reprises. | `AdminNav.tsx`, `CmsNav.tsx`, `AdminShell.tsx`, `CmsShell.tsx` |

Un administrateur ou un gestionnaire CMS qui est aussi membre du réseau n'avait aucun chemin court vers
son propre espace : il fallait retaper l'URL ou repasser par la landing. D-171 avait déjà posé le
principe des liens croisés entre back-offices ; celui-ci complète la boucle vers l'espace membre plutôt
que d'ajouter un quatrième silo de navigation.

---

## 45. Proposition de contenu par les ISE, avec validation administrative (D-185)

| # | Décision | Source |
| --- | --- | --- |
| D-185 | **ADOPTÉE** — Les membres peuvent proposer une actualité ou un événement depuis leur espace ; l'objet créé porte un état déjà présent dans le schéma mais jusqu'ici inatteignable (`news.editorial_status = 'submitted'`, `events.status = 'pending_review' / 'rejected'`). `moderate_content_proposal(p_kind)` gère l'acceptation/le rejet pour `'news'` et `'event'` uniquement — pas `'opportunity'` (voir §50). L'image jointe à la proposition est déposée dans un bucket **privé** dédié, `content-proposals/<profile_id>/…`, distinct du bucket public `landing-media` (D-134) : une image non validée ne doit jamais être atteignable publiquement. À l'acceptation, l'image est **copiée** (jamais déplacée) vers `landing-media` et `cover_media_id` est renseigné. Conformément à D-128, l'acceptation publie le contenu mais ne touche **jamais** `landing_visibility` / `landing_priority` / `is_featured` : l'exposition sur la landing reste un choix éditorial distinct de la validation éditoriale. | `0132_member_content_proposals.sql`, `mon-profil/propositions/`, `administration/propositions/`, `lib/content-proposals.ts` |

Réutiliser des états de contrainte déjà présents dans le schéma plutôt que d'en ajouter de nouveaux évite
une prolifération de statuts pour un même concept (« en attente de revue »). Le choix du bucket privé
n'est pas cosmétique : un membre malveillant ne doit pas pouvoir faire publier involontairement une image
non modérée simplement en connaissant l'URL du bucket public.

**Gap connu, non traité dans ce lot** : les opportunités n'ont pas de colonnes `proposed_cover_path` /
`proposed_cover_alt` et ne passent pas par `moderate_content_proposal` — elles restent sur l'ancien cycle
`publish_opportunity` / `moderate_opportunity` (`0077`), qui n'a jamais porté d'image. Ce n'est pas un
oubli de cette tâche mais une extension distincte à cadrer séparément (colonne, contrainte de portée du
chemin Storage, politique Storage, formulaire membre, écran de revue) — voir §50.

---

## 46. Bandeau sponsors, logos des organisations et nouvelles sections de landing (D-186)

| # | Décision | Source |
| --- | --- | --- |
| D-186 | **ADOPTÉE** — Trois nouvelles sections publiques, toutes pilotées par le CMS et **masquées tant qu'elles sont vides** (pas d'encart vide affiché) : un bandeau de partenaires en carrousel sans texte (`SponsorBand.tsx` / `cms_landing_partners` étendu), une section « Ils nous font confiance » listant les logos d'organisations (`OrganizationsSection.tsx` / `cms_landing_organizations`), et un bloc « Le réseau en quelques chiffres » + carte de présence par pays (§47). | `0133_landing_sponsor_band_organizations_and_world_map.sql` (reconstruite après coup, voir §53), `(public)/_components/sections/{SponsorBandSection.tsx,OrganizationsSection.tsx}` |

La convention déjà établie pour les piliers (D-128, D-181) est reconduite : le CMS choisit ce qui est
publié, un référentiel distinct porte les données brutes, et une section sans contenu publié ne s'affiche
jamais plutôt que de montrer un cadre vide qui donnerait une impression d'inachevé.

---

## 47. Carte mondiale de présence des ISE et bloc « Le réseau en quelques chiffres » (D-187)

| # | Décision | Source |
| --- | --- | --- |
| D-187 | **ADOPTÉE** — `get_landing_country_presence()` projette, par pays, un agrégat (code, nom, effectif) et rien d'individuel : les profils dont la visibilité du champ `country` est `private` en sont exclus, et un seuil minimal (posé à 3 puis abaissé à 1, voir §48) protège l'anonymat des pays à faible effectif. Rendu sous forme de carte SVG du monde (Natural Earth 1:110m, domaine public, ~10 Ko, aucune dépendance ajoutée), masquée sous le point de rupture `md`, la liste des pays portant seule l'information sur mobile. | `0133_...sql`, `lib/public/country-presence.ts`, `(public)/_components/sections/CountryPresenceSection.tsx` |

Un agrégat par pays reste une divulgation d'information géographique sur un petit groupe de personnes
identifiables si le pays ne compte qu'un ou deux ISE. Le principe retenu — projeter uniquement
l'agrégat, jamais l'identité, avec un seuil configurable — suit la même logique de k-anonymat que les
autres projections agrégées du projet.

---

## 48. Seuil de confidentialité de la carte des pays abaissé de 3 à 1 (D-188)

| # | Décision | Source |
| --- | --- | --- |
| D-188 | **ADOPTÉE, révise le seuil posé par D-187** — décision explicite du porteur du projet, 15/08/2026 (« pour la carte, comment à nommer les pays à partir de 1 ISE »). Le seuil minimal de `get_landing_country_presence()` passe de 3 à 1 : un pays n'est masqué que s'il compte **zéro** ISE localisé. Le repli applicatif et les commentaires obsolètes de `country-presence.ts` sont corrigés en cohérence. Vérifié en production : 25 pays affichés, 0 masqué, 252 profils localisés — dont des pays à un seul ISE (Australie, Émirats arabes unis, Sierra Leone, La Réunion). | `0136_country_presence_threshold_one.sql` |

Le porteur du projet, qui est lui-même le sujet des données agrégées de ce projet ISE, a estimé le
risque de ré-identification acceptable à ce niveau d'effectif pour ce public précis (un annuaire
d'anciens, pas un site grand public) et a tranché explicitement en faveur de l'exhaustivité de la carte
plutôt que du seuil prudent posé par défaut en §47.

---

## 49. Module de dons — architecture (D-189) et migration vers CinetPay v2 (D-190)

| # | Décision | Source |
| --- | --- | --- |
| D-189 | **ADOPTÉE** — `public.donations` (montant entier en plus petite unité, devise, fournisseur, référence interne unique, référence fournisseur, statut, horodatages), `donation_currency_rules`, `private.donation_notifications` avec unicité `(provider, event id)` pour l'idempotence. Aucune donnée de carte ne transite par l'application : uniquement des pages de paiement hébergées (Stripe Checkout Session, page CinetPay hébergée). La confirmation n'est **jamais** acceptée depuis le navigateur — seul un webhook serveur, après vérification de signature, valide un don. `settle_donation_notification()` est révoquée pour `anon` et `authenticated` (`service_role` seul). Nouvelle permission `donations.read` (aucune des 21 permissions existantes ne couvrait l'argent). | `0134_donations.sql`, `don/`, `api/dons/` |
| D-190 | **ADOPTÉE, corrige l'intégration initiale** — l'intégration CinetPay est réécrite pour l'API v2 : authentification par `POST /v1/oauth/login` (`api_key`/`api_password` → jeton porteur), initiation par `POST /v1/payment` **sans** `site_id` dans le corps, redirection conditionnée à `details.must_be_redirected === true` (un paiement direct Orange sans OTP n'a pas d'URL et n'est pas un échec). Variables d'environnement : `CINETPAY_API_KEY`, `CINETPAY_API_PASSWORD` (remplacent `CINETPAY_SITE_ID`/`CINETPAY_SECRET_KEY`, retirées), `CINETPAY_BASE_URL` optionnelle, **défaut = production** `https://api.cinetpay.co` (jamais `https://api.cinetpay.net`, qui est le bac à sable — inversion qui avait déjà touché un autre projet du porteur). Si les clés ne sont pas configurées, le module se désactive proprement : entrée de menu masquée, webhooks renvoyant `503`. | `0135_donations_cinetpay_v2.sql` (reconstruite après coup, voir §53), `lib/donations/{cinetpay.ts,cinetpay-utils.ts}`, `api/dons/cinetpay/route.ts`, `don/actions.ts`, `packages/config/src/env.ts` |

L'intégration de référence a été reconstruite à partir du code déjà éprouvé dans d'autres projets du
porteur (`xcollect`, `xcollect-admin`) plutôt que devinée depuis la documentation seule — la même classe
de bug (URL sandbox par défaut au lieu de production) y avait déjà été identifiée et corrigée, et
c'est cette correction qui a été reportée ici dès la première version plutôt que d'attendre de la
redécouvrir en production.

---

## 50. Correctifs des encarts Événement et Opportunité de la landing (D-191, D-192)

| # | Décision | Source |
| --- | --- | --- |
| D-191 | **ADOPTÉE** — L'encart « Événement » vide n'était pas un bug d'affichage : l'événement épinglé signalé par le porteur avait un `starts_at` déjà passé, donc légitimement exclu par `get_landing_events()`. Le vrai défaut était que `/cms/evenements` affichait malgré tout « Visible sur la landing » pour cet événement — un mensonge par omission. Une fonction de prédicat unique, `private.landing_event_block_reason()` / `landing_opportunity_block_reason()`, est désormais partagée entre la projection publique (qui filtre) et les écrans CMS (`list_cms_events`/`list_cms_opportunities`, nouveau champ `landing_blocked_reason`), qui affichent « Ne paraît pas sur la landing » avec la raison. La borne d'éligibilité passe de `starts_at > now()` à `coalesce(ends_at, starts_at) > now()` (un événement en cours n'est plus exclu à tort). Un événement passé ne s'affiche **jamais**, même épinglé — l'épinglage est un choix de placement à l'intérieur d'un ensemble déjà éligible, il ne crée pas d'éligibilité (même raisonnement que D-128). | `0137_landing_block_reasons.sql`, `0137b_revoke_anon_execute_on_landing_block_reason.sql` (reconstruite après coup, voir §53) |
| D-192 | **ADOPTÉE** — `opportunities.summary` était renseigné en base mais jamais projeté par `get_landing_opportunities()` (à la différence de `get_landing_news()`, qui projette déjà son propre résumé). Corrigé : `OpportunityCard` affiche désormais le résumé en tête du bloc méta, aligné sur `NewsCard`. L'absence d'image proposée par l'ISE sur une opportunité (signalée par le porteur) reste un **gap ouvert, non traité** : voir §45, ce n'est pas une régression mais une fonctionnalité jamais construite pour ce type de contenu. | même migration |

Un écran d'administration ne doit jamais afficher un état qui contredit ce que voit réellement le
public — c'est le même principe que celui qui avait motivé D-124 pour la configuration brouillon/publiée.

---

## 51. Pastilles de comptage dans les menus Administration et CMS (D-193)

| # | Décision | Source |
| --- | --- | --- |
| D-193 | **ADOPTÉE** — Une fonction SQL par back-office (`admin_nav_counters`, `cms_nav_counters`) renvoie en un seul aller-retour les compteurs de toutes les files d'attente pertinentes, chacun filtré **côté serveur** par `private.has_permission()` : une file que l'appelant n'a pas le droit de voir est **absente** du JSON, jamais renvoyée à zéro — pour ne pas divulguer l'existence d'une file réservée. Une pastille n'est jamais affichée à zéro, et porte toujours un libellé accessible en plus du chiffre (ex. « Actualités, 3 en attente »), jamais la couleur seule (D-90). Neuf files côté Administration (réclamations, promotions, opportunités à modérer, consortiums, publications de communauté, événements proposés, actualités proposées, signalements ouverts, tickets support sans réponse) ; sept côté CMS (contenus marqués visibles mais exclus par la projection réelle — actualités/événements/opportunités —, piliers et organisations sans visuel, ISE du jour sans candidat éligible, programmation en échec). Explicitement exclus des deux côtés : les écrans de lecture seule, les cas où la file compterait un état permanent plutôt qu'un flux actionnable (ex. profils incomplets), et les cas où le compteur doublerait un contrôle déjà couvert ailleurs (ex. le carrousel, déjà fermé par le cron `expire_cms_content`). | `admin_nav_counters` (migration `0138`), `cms_nav_counters` (migration `0139`, version `20260815082021`), `AdminNav.tsx`, `CmsNav.tsx` |

Compter côté base plutôt que dériver un compteur d'une page de résultats déjà filtrée évite de sous-compter
ce qui n'est pas affiché sur la première page, et le filtrage par permission à l'intérieur même de la
fonction SQL (plutôt qu'après coup côté client) empêche qu'un compteur révèle l'existence d'une file à un
rôle qui n'y a pas accès.

---

## 52. Peuplement du référentiel des organisations et section « Ils nous font confiance » (D-194)

| # | Décision | Source |
| --- | --- | --- |
| D-194 | **ADOPTÉE** — Le référentiel `organizations` est peuplé par déduplication de l'employeur en texte libre saisi par les 252 profils ISE, avec normalisation (casse, accents, ponctuation, espaces) et fusion **uniquement** sur correspondance exacte après normalisation — jamais d'expansion d'acronyme ni de rapprochement approximatif qui fusionnerait à tort deux entités distinctes. `OrganizationsSection.tsx` porte le titre « Ils nous font confiance » et le sous-titre « Structures et institutions où travaillent les ISE », et ne s'affiche que si au moins un logo est publié. L'écran `/cms/organisations` (déjà existant) couvre le choix d'une organisation du référentiel, l'attachement d'un logo depuis la médiathèque, l'ordre d'affichage et la publication — peupler le référentiel ne publie rien automatiquement sur la landing, qui reste un choix éditorial distinct (même principe que D-128, D-185). | `0140_organizations_seed_from_profiles.sql` + `0140b_..._grants.sql` (reconstruites après coup, voir §53), `0142_organizations_seed_from_profiles.sql` (voir réserve ci-dessous) |

**Réserve à traiter par le porteur, non résolue dans ce lot** : deux migrations distinctes portant un nom
quasi identique (`0140_organizations_seed_from_profiles` et `0142_organizations_seed_from_profiles`) ont
été appliquées successivement en base, avec des heuristiques de découpage légèrement différentes (`0140`
gère `—`/`–`/`__`/les sigles entre parenthèses et une table de rapprochements manuels ; `0142` ne coupe
que sur `" — "` littéral, sans rapprochement manuel, et ajoute un index unique de son cru). Aucune
suppression n'a été faite — les deux sont déjà appliquées historiquement et le référentiel actuel reflète
leur exécution combinée. La décision de nettoyage (fusionner, documenter comme volontairement redondant,
ou revenir sur l'une des deux heuristiques) revient au porteur du projet.

---

## 53. Cadrage ajustable de la photo « ISE du jour » (D-195)

| # | Décision | Source |
| --- | --- | --- |
| D-195 | **ADOPTÉE** — `ise_profiles` reçoit trois colonnes de cadrage non destructif : `public_photo_focal_x`/`_focal_y` (0-100, défaut 50) et `public_photo_zoom` (1.0-3.0, défaut 1.0), écrites uniquement par la RPC `set_my_public_photo_crop()` (`SECURITY DEFINER`, `authenticated` seul, aucun `GRANT UPDATE` direct sur les colonnes — même principe que `0120`). Le cadrage n'effectue **aucun recadrage serveur** : les coordonnées sont appliquées à l'affichage via `object-position`/`transform: scale()`, dans « Ma vitrine publique » comme sur la carte « ISE du jour » de la landing (`LandingMediaImage`, seul autre endroit affichant cette photo en vignette). Le déclencheur `ise_profiles_public_photo_guard` (D-179) est étendu pour remettre le cadrage à sa valeur par défaut lors d'un remplacement de portrait ou d'une révocation du consentement. | `0141_public_photo_crop.sql` |

Stocker des coordonnées plutôt que de recadrer physiquement l'image au moment de l'enregistrement
préserve le fichier source (utile si le membre veut réajuster plus tard) et reste cohérent avec le
principe déjà posé pour les autres médias du projet (D-133, D-140) : la donnée brute et sa présentation
sont deux choses distinctes.

---

## 54. Crédit auteur dans le pied de page (D-196)

| # | Décision | Source |
| --- | --- | --- |
| D-196 | **ADOPTÉE** — Le pied de page public affiche désormais « © 2026 Compétences ISE — BLY Ped, ISE 2000 », en texte simple, discret (faible contraste, petite taille), non cliquable. Piloté par i18n (`fr.public.footer.credit`), pas de texte en dur. | `PublicFooter.tsx`, `i18n/fr.ts` |

Décision de transparence du porteur du projet, qui est lui-même un ISE (promotion 2000) : signaler que la
plateforme a été construite par un pair du réseau plutôt que par un tiers inconnu.

---

## Note méthodologique — dérive de migrations appliquées en base mais absentes du dépôt (D-197, D-198)

| # | Décision | Source |
| --- | --- | --- |
| D-197 | **ADOPTÉE, pratique établie** — À quatre reprises sur ce lot de travail (`0133`, `0135`, `0140`/`0140b`, `0137b`), une migration s'est trouvée appliquée en base Supabase sans être committée dans le dépôt GitHub. Dans chaque cas, le SQL exact a été reconstruit depuis `supabase_migrations.schema_migrations.statements`, vérifié par hachage (comparaison byte à byte, y compris ligne par ligne en cas d'écart), puis versionné dans le dépôt **sans être ré-exécuté**. Cette pratique de reconstruction devient la procédure standard en cas de dérive constatée, plutôt qu'un correctif ponctuel à chaque occurrence. | commentaire méthodologique, sans migration propre |
| D-198 | **OUVERTE** — La cause racine de cette dérive répétée (plusieurs agents autonomes appliquant des migrations directement via les outils Supabase sans toujours pousser le fichier correspondant dans le même geste) n'a pas été corrigée structurellement. Un contrôle de cohérence automatisé (comparer périodiquement `list_migrations` côté Supabase et le contenu de `supabase/migrations/` sur `main`) reste à mettre en place. | — |

---
