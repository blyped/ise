# Journal des décisions — Compétences ISE — Partie 10/10 : Dons, organisations, cadrage et pastilles

Sections 44 à 61 du journal des décisions du projet Compétences ISE.
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

## 55. Ouverture des trois modules du tableau de bord membre (D-199)

| # | Décision | Source |
| --- | --- | --- |
| D-199 | **ADOPTÉE** — Les trois encarts du tableau de bord (« Le réseau a besoin de vous », « Opportunités pour vous », « ISE que vous pourriez connaître »), jusqu'ici un placeholder générique (`PendingSection`), sont branchés sur les lectures réelles déjà utilisées ailleurs dans l'application. **Appels** et **Opportunités** appellent `loadNetworkCalls`/`loadOpportunities` avec les mêmes filtres que les onglets « Pour moi »/« Pour vous » de `/appels` et `/opportunites` (`scope: 'for_me'`/`'for_you'`, `status: 'open'`), et réutilisent `CallCardView`/`OpportunityCardView` tels quels — trois cartes affichées, lien « Voir tout » vers la liste complète avec le même paramètre d'onglet. Pour **« ISE que vous pourriez connaître »**, aucune RPC « recommande-moi des gens » indépendante n'existe : six routines candidates ont été examinées en base (`pg_get_functiondef`) avant tout code — `list_recommended_mentors` est scopée au mentorat (`mentor_profiles`/`mentor_domains`), inadaptée à une découverte générale ; `profile_match_set` est le moteur **privé** déjà appelé par `public.match_profiles()` (donc par `runRelevanceSearch`, ISE-035) — l'invoquer directement aurait dupliqué un point d'entrée public existant sans rien ajouter ; `community_match_reasons`, `emit_recommendation_requested_event`, `respond_recommendation_request` et `guard_recommendation_write` relèvent des communautés et du flux de demande de recommandation/témoignage (ISE-028/029), sans rapport avec la découverte de profils. Le module dérive donc des **critères raisonnables** à partir du profil du membre connecté — même secteur déclaré et/ou même pays de résidence, lus par les mêmes fonctions « self-only » que l'écran de profil (`loadProfileHeader`, `loadProfileSectors`) — exclut les profils déjà en relation (première page de `loadConnections`, 20 au plus — une exclusion exhaustive aurait exigé de paginer l'intégralité des relations pour un gain marginal sur un encart de 3 cartes) et appelle **la même RPC** `public.match_profiles()` qu'ISE-035 via `runRelevanceSearch`, désormais dotée d'un paramètre `excludeProfileIds` optionnel (`p_exclude_profile_ids`, auparavant câblé à `null` en dur) — comportement d'ISE-035 inchangé, le paramètre n'est utilisé que par ce nouveau module. Le rendu réutilise `ResultCard`, la carte de `/rechercher/resultats`. Si ni le secteur ni le pays ne sont connus (profil incomplet ou lectures en échec), **aucun appel RPC n'est fait** : un critère vide renverrait un ensemble non filtré sans rapport avec « des ISE que vous pourriez connaître », donc un état vide invite à compléter le profil plutôt que d'inventer une liste. Les trois lectures ne sont lancées qu'en présence d'un profil (aucune lecture sans profil rattaché), en parallèle (`Promise.all`, aux côtés de `loadMemberContext`), et chaque module affiche indépendamment son propre état vide/erreur — la panne d'un module n'affecte jamais les deux autres (MASTER PROMPT §47). | `tableau-de-bord/page.tsx`, `lib/queries/dashboard.ts` (nouveau), `lib/queries/search.ts` (`runRelevanceSearch` accepte `excludeProfileIds`), `i18n/fr.ts` |

Le porteur avait explicitement demandé de « réutiliser des RPC déjà existantes et déjà utilisées ailleurs »,
pas de bâtir un moteur de recommandation depuis zéro. L'inventaire préalable des six fonctions candidates
(plutôt qu'un choix a priori) confirme qu'aucune ne correspond au besoin sans détournement, ce qui justifie
la dérivation de critères plutôt qu'un nouvel appel RPC dédié — cohérent avec D-42/D-43 (labels qualitatifs
et raisons explicites, jamais de score) et avec le principe déjà posé par D-151 (aucune donnée inventée
quand la base n'a rien à dire).

---

## 56. Bandeau d'annonces admin en tête du tableau de bord membre (D-200)

| # | Décision | Source |
| --- | --- | --- |
| D-200 | **ADOPTÉE** — Nouvelle table `public.dashboard_announcements`, sans rapport avec le module Communication de D-183 (§43) : celui-ci est une messagerie **ascendante** (membre → admin, tickets et remontées d'information) ; l'objet créé ici est une diffusion **descendante** (admin → tous les membres), qui n'existait sous aucune forme avant ce lot. Schéma volontairement plus simple que `news` (D-13, section historique) : pas de titre séparé (`body` seul — un bandeau n'a pas la place pour un titre + un corps), pas de circuit éditorial à plusieurs statuts de soumission/revue puisque l'auteur EST l'administrateur, personne à qui soumettre. Cycle de vie réduit à brouillon (`published_at is null`) → publiée → éventuellement redevenue brouillon → supprimée en douceur (`deleted_at`, même convention que `news`/`events`). L'expiration n'est **pas** un statut stocké : elle se calcule à la lecture depuis `ends_at`, comme la fenêtre de la file « à la une » (D-146/D-121). Gravité à deux niveaux seulement (`normal` / `urgent`, contrainte `check`) plutôt qu'une échelle à quatre paliers comme `support_tickets.urgency` — le besoin exprimé était binaire (« différencier normal ou urgent »), une échelle plus fine aurait été une déclinaison non demandée. Permission dédiée `communication.announcements.manage` (nomenclature `<domaine>.<ressource>.<verbe>`, D-30), rattachée à `superadmin` et à `content_manager` — ce rôle détient déjà `content.publish` et `events.manage`, soit exactement le profil « publie du contenu visible de tous les membres ». RLS : lecture ouverte à tout membre authentifié mais strictement filtrée (publiée, non supprimée, dans sa fenêtre `starts_at`/`ends_at`) ; écriture (et lecture des brouillons/annonces expirées) réservée à la permission dédiée. Tri d'affichage : les annonces **urgentes toujours avant** les normales, puis par date de publication décroissante — une urgence qui arriverait après une annonce normale contredirait le sens même du mot « urgent » ; ce tri est fait **en base** (`get_active_dashboard_announcements()`), jamais recalculé côté application. Écran admin `/administration/annonces` (liste, création, fiche avec édition + publier/dépublier + suppression douce), sur le même gabarit que `/administration/actualites` : pas de pagination par curseur ni de filtre de recherche, le volume attendu (quelques annonces actives à la fois) ne le justifiant pas — conformément à la consigne de ne pas sur-ingénierier cette partie. Pas de pastille de comptage dans le menu Administration : ni file d'attente à traiter, ni flux de nouveautés, contrairement aux entrées déjà comptées par D-193. Le bandeau `AnnouncementsBanner` s'insère dans `tableau-de-bord/page.tsx` juste après le bloc de salutation « Bonjour {prénom} », avant tout le reste (alertes de réclamation, modules ISE-047/055/dashboard de D-199) : sa lecture est indépendante de la présence d'un profil (visible même sans profil rattaché) et **tolérante à l'échec** — un échec de lecture retombe silencieusement sur une liste vide, donc sur *aucun bandeau affiché*, sans jamais faire planter la page ni afficher de message d'erreur intrusif en tête du tableau de bord (MASTER PROMPT §47 : ce n'est pas un contenu critique). Gravité affichée avec les variantes déjà existantes du composant `Alert` de `@ise/ui-web` — `info` pour normal, `warning` pour urgent — sans inventer de nouveau style. | `0145_dashboard_announcements.sql`, `administration/annonces/`, `tableau-de-bord/AnnouncementsBanner.tsx`, `lib/queries/announcements.ts`, `lib/admin/queries-announcements.ts`, `i18n/announcements.ts` |

**Correctif incident, profité de la même migration** : en révisant `get_my_admin_permissions()` (0076) pour y ajouter le nouveau code, un écart préexistant a été constaté — la fonction n'avait **jamais** été mise à jour lors de l'ajout de la permission `donations.read` (D-189/migration `0134`), alors même que `donations.read` figure dans la liste blanche `ADMIN_PERMISSIONS` côté application (`lib/admin/permissions.ts`) et dans la navigation (`DONATION_ROUTES.adminList`). Un compte détenant `donations.read` sans détenir par ailleurs `superadmin` n'aurait donc jamais vu passer cette permission dans `get_my_admin_permissions()`, et `requireAdminPermission('donations.read')` l'aurait renvoyé vers l'écran d'accès refusé pour `/administration/dons`. Corrigé dans `0145` en même temps (la fonction était de toute façon redéfinie en totalité pour ajouter `communication.announcements.manage`), sans qu'aucune ligne de code applicative n'ait dû changer.

**Piste future, explicitement hors périmètre de ce lot** : le système `domain_events`/`notification_deliveries` (D-105, D-113) pourrait diffuser ces mêmes annonces en notification in-app (voire par e-mail) plutôt que de dépendre uniquement de la visite du tableau de bord. Non implémenté ici — la tâche demandait un affichage sur le tableau de bord, pas un canal de notification supplémentaire.

Faire de l'expiration un champ calculé plutôt qu'un statut stocké évite une tâche planifiée dédiée (contrairement au carrousel CMS, qui lui a besoin d'un cron parce que son état conditionne d'autres écritures) : ici, la seule conséquence de l'expiration est de ne plus apparaître dans une lecture, ce qu'un simple filtre `where` couvre entièrement.

---

## 57. Rattachement automatique d'un compte Google à un profil ISE non réclamé (D-201)

| # | Décision | Source |
| --- | --- | --- |
| D-201 | **ADOPTÉE** — À la toute première connexion Google réussie, si l'adresse e-mail de l'identité **Google elle-même** (`auth.identities.identity_data->>'email'`, jamais `auth.users.email`, qui est mutable et pas nécessairement issu de Google) est marquée **vérifiée par Google** (`identity_data->>'email_verified' = 'true'`) et correspond, par égalité exacte après normalisation, à `private.profile_contacts.primary_email_norm` d'un profil `claim_status = 'unclaimed'` et `user_id is null`, le compte est rattaché automatiquement à ce profil — sans lien d'activation par e-mail. Aucun rapprochement approximatif (pas de recherche floue, pas de correspondance partielle). Le bouton « Se connecter avec Google » (ajouté après coup, cf. commentaire dans `GoogleSignInButton.tsx`) devient ainsi, pour un ISE du recensement qui ne l'avait jamais fait, une troisième voie de rattachement — aux côtés du provisioning direct (D-161) et de la réclamation manuelle (ISE-005 → ISE-007) — plutôt qu'une pure méthode de connexion pour un compte déjà rattaché. | `0146_google_account_match.sql` |

**Preuve de possession retenue — parallèle explicite avec D-161** : le provisioning direct (D-161) accepte comme preuve de possession de l'adresse le clic sur un lien d'activation signé, envoyé par Supabase à l'adresse exacte du recensement — la preuve vient d'un tiers de confiance (Supabase), jamais d'une simple déclaration de l'utilisateur. Ici, la preuve vient d'un autre tiers de confiance : Google, qui affirme lui-même — via `email_verified` sur l'identité OAuth retournée à l'échange du code d'autorisation — que la personne connectée contrôle effectivement cette boîte e-mail (Google a lui-même fait circuler un e-mail de vérification à un moment de la vie du compte Google). Les deux mécanismes sont donc équivalents en niveau de preuve, et le rattachement automatique applique exactement les mêmes effets (`claim_status = 'claimed'`, `profile_status = 'active'`, `verification_level = 'email'`, rôle `member`, trace d'audit, `domain_events`) — voir l'architecture ci-dessous.

**Architecture retenue — pourquoi une nouvelle fonction plutôt qu'ouvrir `provision_referenced_account` à `authenticated`** : `private.provision_referenced_account` (0106) reste **inchangée dans ses effets** et **intouchée dans sa restriction à `service_role`** — aucune érosion de sa surface d'attaque, conforme à la consigne du porteur de ne pas baisser le niveau d'exigence de sécurité de D-161. Elle gagne un unique paramètre optionnel `p_mechanism text default 'invite_link'` (0 changement de comportement pour l'Edge Function de provisioning existante, qui ne le fournit jamais), qui ne fait que qualifier la piste d'audit et le `payload` de `domain_events` (`'invite_link'` pour le provisioning direct, `'google_oauth_verified_email'` pour ce nouveau chemin) — sans dupliquer la moindre ligne de logique de garde. Un **nouveau** point d'entrée, `public.match_google_account_to_profile()`, `SECURITY DEFINER`, accordé à `authenticated` (même schéma de sécurité que `public.bootstrap_admin_profile`, D-105/0086) porte lui-même toutes les vérifications avant de déléguer les effets :

- il **n'accepte aucun paramètre du client** — tout est dérivé de `auth.uid()` et de `auth.identities` de la session en cours, exactement comme un appel `service_role` : un client malveillant ne peut fournir ni `profile_id` ni `user_id` arbitraires ;
- il ne fait rien si le compte est **déjà rattaché** à un profil (`user_id` déjà posé), avant même de tenter quoi que ce soit ;
- il lit l'identité **`google`** de la session (la plus récente s'il y en a plusieurs, cas théorique) et exige `email_verified = true` — sinon, no-op silencieux ;
- il ne recherche que sur `unclaimed` / `user_id is null` / `deleted_at is null` / `merged_into_profile_id is null` / `is_test_account = false` — les mêmes gardes que `private.list_provisionable_profiles` (0106) ;
- il délègue **tous** les effets à `private.provision_referenced_account`, qui **revalide elle-même** ses propres gardes (profil déjà réclamé, compte déjà lié à un autre profil — `account_already_linked`) : aucune logique de sécurité dupliquée, un seul endroit qui écrit réellement dans `ise_profiles` ;
- un bloc `EXCEPTION WHEN OTHERS` avale toute erreur inattendue (ex. condition de course entre deux tentatives de rattachement concurrentes) après l'avoir journalisée (`profile.google_match_failed`, `result = 'failure'`) — cette fonction est appelée depuis `/auth/callback` juste après l'échange OAuth et ne doit **jamais** faire échouer une connexion par ailleurs légitime, même en cas d'anomalie interne (même philosophie que `logAuthLinkEvent` côté application, qui avale déjà ses propres exceptions).

Ouvrir directement `provision_referenced_account` à `authenticated` (avec vérification interne de `auth.uid()`) aurait été une architecture alternative viable, mais aurait mélangé dans une même fonction deux responsabilités distinctes — « appliquer les effets d'un rattachement déjà validé » (utilisée par l'Edge Function, qui a déjà fait ses propres vérifications côté service_role) et « décider si CE rattachement est légitime pour CET appelant » (propre à chaque voie d'entrée) — et aurait rendu plus difficile de faire évoluer indépendamment les gardes du provisioning direct et celles du rattachement Google. La séparation retenue garde `provision_referenced_account` comme unique **exécuteur** des effets, et laisse chaque **décideur** (Edge Function service_role, ou cette nouvelle fonction `authenticated`) porter ses propres règles de garde en amont.

**Appel côté application** : `apps/web/src/app/auth/callback/route.ts` ajoute `matchGoogleAccountToProfile()`, appelée juste après `runAdminBootstrap(supabase)` dans les deux branches (`code` et `token_hash`) — un simple appel RPC enveloppé dans un `try/catch` qui n'empêche jamais la redirection normale en cas d'échec, même position et même philosophie que `runAdminBootstrap`/`logAuthLinkEvent` déjà en place (D-173).

**Hors périmètre, comme demandé** : si aucun profil ne correspond (e-mail Google inconnu du recensement), la fonction ne fait strictement rien — l'utilisateur atterrit sur le tableau de bord sans profil rattaché, `loadViewerContext`/`loadMemberContext` renvoyant `withoutProfile: true` comme aujourd'hui pour tout compte sans profil. Aucun redirect automatique vers le parcours de réclamation manuelle n'a été ajouté : ce garde-fou n'existe pas non plus aujourd'hui pour un compte créé par mot de passe sans profil, et en ajouter un unilatéralement pour Google seul aurait introduit une incohérence entre méthodes de connexion, hors du périmètre demandé (« matcher avec le compte Google »).

---

## 58. Sixième emplacement « Organisations (logos) » dans la médiathèque CMS (D-203)

| # | Décision | Source |
| --- | --- | --- |
| D-203 | **ADOPTÉE** — Retour du porteur : le sélecteur « Emplacement sur la vitrine » de la médiathèque (CMS-008, ADDENDUM §38/§39) s'arrêtait à quatre valeurs (`carousel`, `partners`, `news`, `sections`), sans emplacement dédié pour les logos d'organisations de la section « Ils nous font confiance » (`cms_landing_organizations.media_id`, D-186/0133). Un redacteur qui téléversait un logo devait donc choisir « Sections » par défaut — un emplacement qui ne dit pas ce que le fichier est réellement. `organizations` devient un sixième segment de chemin reconnu dans le bucket public `landing-media`. Le terme « Carrousel » couvrait déjà les diapositives du carrousel héros (aucun terme « session » n'existe dans le vocabulaire du produit) : seul le manque « Organisations » était réel. | `0146_landing_media_organizations_usage.sql`, `lib/cms/image-metadata.ts`, `i18n/cms.ts` |

**Le seul endroit qui compte est la base, pas la liste TypeScript** — `CMS_MEDIA_USAGES` (application) n'est qu'un miroir de `private.is_landing_media_path()` (0068, redéfinie en 0120 pour `membres`), la fonction que la politique d'écriture `ise_landing_media_insert` (et sa jumelle éditoriale `ise_landing_media_insert_editorial`, 0132) interroge réellement pour accepter ou refuser un dépôt. Élargir uniquement la liste applicative aurait fait échouer tout dépôt sous `organizations/` — l'erreur inverse de celle documentée dans le commentaire de 0120 (une fonction redéfinie sans le privilège `EXECUTE` posé pour `authenticated`) mais la même leçon : ne jamais faire confiance à un seul des deux miroirs. La migration redéfinit donc la fonction pour accepter six préfixes (`carousel`, `partners`, `news`, `sections`, `membres`, `organizations`) et re-pose `revoke`/`grant` à chaque redéfinition (D-126), avant que le code applicatif ne propose la nouvelle valeur.

**`membres` reste absent de `CMS_MEDIA_USAGES`** — ce cinquième préfixe (0120) est réservé au dépôt du portrait consenti d'un membre, un chemin d'écriture *member-self-service* distinct du circuit CMS ; l'exposer dans le sélecteur du back-office aurait laissé croire qu'un redacteur peut y déposer un visuel à la place d'un membre.

**Comptage des références étendu, pas seulement le libellé** — `loadMediaAssets()` (`lib/cms/queries.ts`) ne comptait les références d'un média que sur `cms_carousel_items` et `cms_partner_campaigns` (ADDENDUM §38). Sans extension, un logo d'organisation activement affiché aurait pu être supprimé de la médiathèque sans le moindre avertissement — la même faille que celle que §38 corrigeait déjà pour le carrousel et les campagnes, simplement pas encore couverte pour ce troisième type de référence. `CmsMediaAsset.usage` gagne donc une clé `organizations`, alimentée par une requête sur `cms_landing_organizations.media_id`, et la page `/cms/mediatheque` l'inclut dans le total qui bloque la suppression (`deleteMediaAction`) ainsi que dans le détail affiché (« N logo(s) d'organisation »).

---

## 59. Bouton de slide carrousel : correctif d'affichage et destination externe (D-204)

| # | Décision | Source |
| --- | --- | --- |
| D-204 | **ADOPTÉE** — Deux bugs distincts remontés par le porteur sur le bouton optionnel des slides du carrousel héros. **(1) Affichage** : `cta_label` est projeté par `get_landing_carousel()` depuis 0109 — ce n'était donc **pas** un bug de projection (contrairement à `events.description`/D-191 ou `opportunities.summary`, tous deux corrigés en ajoutant la colonne manquante à la fonction SQL). La cause réelle est dans `LandingCarousel.tsx` : le bouton était rendu sous la condition `route !== null && slide.ctaLabel !== null`, où `route = entityRoute(slide.target)` ne peut jamais être non nul en l'absence d'une ressource interne (`entity_type` + `entity_id`) — précisément le champ que le CMS ne rendait pas obligatoire pour `ctaLabel`. Une slide dont l'éditeur avait rempli le libellé du bouton sans lier de ressource interne (cas nominal pour une campagne purement promotionnelle) voyait donc son bouton disparaître silencieusement, sans message d'erreur ni en CMS ni côté landing. **(2) Édition** : aucun champ ne permettait de déclarer une destination externe — seule la paire `entity_type`/`entity_id` existait (ADDENDUM §10 : jamais d'URL interne stockée, la route est calculée par l'application). Les deux bugs partagent la même cause de fond : le bouton n'avait tout simplement aucune destination possible en dehors d'une ressource interne. Résolu en reprenant **à l'identique** le mécanisme déjà en place pour les campagnes partenaires (`cms_partner_campaigns.target_url`, migration 0057, §37) plutôt que d'inventer un second système : nouvelle colonne `cms_carousel_items.target_url text check (target_url is null or target_url ~ '^https://')`, projetée par `get_landing_carousel()` (0148), parsée côté landing par `safeExternalUrl()` (déjà écrite pour les campagnes partenaires, réutilisée telle quelle) et exposée par `LandingSlide.externalUrl`. `LandingCarousel.tsx` calcule désormais `href = route ?? slide.externalUrl` et affiche le bouton dès que `href` est non nul : ressource interne via `ProtectedLink` (comportement inchangé, gating d'authentification conservé), sinon adresse externe via un `<a target="_blank" rel="noopener noreferrer">` qui ouvre un nouvel onglet — même patron que `ExternalBanner` du bandeau sponsors (0133, §46). En CMS, le formulaire `CarouselForm.tsx` ajoute un champ `targetUrl` (`type="url"`, placeholder `https://`) juste après la ressource interne, avec un indice explicite : les deux champs sont mutuellement exclusifs (`.refine()` côté serveur, même style que `campaignSchema` de `/cms/partenaires`), et sans l'un des deux le bouton ne s'affiche pas — le formulaire le dit maintenant, la landing ne le cachait qu'en silence auparavant. | `0148_carousel_button_target_url.sql`, `lib/cms/types.ts`, `lib/cms/queries.ts`, `lib/cms/mutations.ts`, `app/cms/carrousel/actions.ts`, `app/cms/carrousel/CarouselForm.tsx`, `lib/public/landing-data.ts`, `app/(public)/_components/LandingCarousel.tsx`, `i18n/cms.ts`, `i18n/fr.ts` |

**Choix délibérément écarté** : un sélecteur structuré « interne / externe » avec deux sous-formulaires distincts, à la manière d'un composant de configuration de lien générique. Le motif exact existe déjà dans le CMS pour les campagnes partenaires (deux champs simples, mutuellement exclusifs, validés par une regex `^https://`) et fonctionne en production depuis 0057 sans qu'aucune confusion n'ait jamais été remontée à ce sujet : reprendre ce même motif pour le carrousel est cohérent avec le reste de l'écran CMS et évite d'ajouter un composant de sélection dédié pour un besoin déjà couvert — conformément à la consigne du porteur de ne pas sur-ingénierier cette partie.

---

## 60. Cadrage vertical du portrait public : diagnostic et correctif, zoom réducteur (D-205)

| # | Décision | Source |
| --- | --- | --- |
| D-205 | **ADOPTÉE** — Bug signalé par le porteur : « le décalage horizontal fonctionne, le vertical ne marche pas bien ; il faut aussi pouvoir réduire la photo, la mienne est trop grosse dans le cadre ». Deux causes distinctes, un seul correctif. **(1) Diagnostic de l'axe vertical, entièrement côté rendu** — le mécanisme initial (0141) appliquait `object-position: X% Y%` ET `transform: scale(zoom)` DIRECTEMENT sur l'`<img>`. `object-fit: cover` décide, AU STADE DE LA MISE EN PAGE (avant toute peinture), quelle fenêtre de la photo source reste visible dans le cadre : seul l'axe où le rapport largeur/hauteur de LA PHOTO déborde celui du CADRE reçoit une marge de déplacement réelle — l'autre axe n'en reçoit AUCUNE, quelle que soit la valeur d'`object-position` choisie, car la fenêtre touche déjà les deux bords sur cet axe. Le `transform: scale()` appliqué ensuite ne change rien à ce constat : une transformation CSS agit en PEINTURE, après que cette fenêtre a déjà été figée à l'étape de mise en page — elle agrandit ce qui est déjà visible, elle ne peut jamais « récupérer » des pixels déjà exclus par `object-fit`. Pour la photo du porteur (qui déborde en largeur), le décalage horizontal avait donc un effet réel, le vertical strictement aucun, et ce quel que soit le zoom testé — ce n'était pas un bug ponctuel mais une conséquence structurelle de combiner ces deux mécanismes CSS à des étapes de rendu différentes. **(2) Zoom réducteur impossible** — la contrainte `ise_profiles_public_photo_zoom_range` (0141) bornait le zoom à `[1.0, 3.0]` : en dessous de 1.0 aurait dû « dézoomer », mais `object-fit: cover` impose par nature un remplissage intégral du cadre à zoom 1 (c'est sa définition), donc aucune valeur ne permettait de voir « plus » de la photo ou de la réduire visuellement. | `0147_photo_crop_zoom_out_and_avatar_crop.sql`, `packages/ui-web/src/utils/photo-crop.ts` (nouveau), `packages/ui-web/src/components/Avatar.tsx`, `app/(public)/_components/LandingMediaImage.tsx`, `components/media/StorageImage.tsx`, `app/mon-profil/vitrine-publique/PublicPhotoForm.tsx`, `app/mon-profil/vitrine-publique/actions.ts` |

**Correctif retenu — un conteneur interne porte le zoom, pas l'image** : `photoCropWrapperStyle()` (nouvelle fonction partagée, `@ise/ui-web`, sans dépendance Next.js) calcule le style d'un `<div>` intermédiaire, à insérer entre le CADRE (`position: relative; overflow: hidden` — fourni par `PHOTO_CROP_FRAME_STYLE`) et l'image elle-même (qui reste en `object-fit: cover`, `object-position` FIXÉE à `50% 50%`, le panoramique n'étant plus porté par elle) :

```
sizePercent = zoom * 100
left = (focalX / 100) * (100 - sizePercent)
top  = (focalY / 100) * (100 - sizePercent)
// wrapper : position: absolute; left; top; width: sizePercent%; height: sizePercent%
```

À `zoom = 1` (`sizePercent = 100`), `left`/`top` valent toujours `0` quel que soit le point focal choisi : le wrapper occupe exactement 100 % du cadre, rendu **pixel pour pixel identique** au comportement d'avant cette migration (aucune régression pour un profil resté à son cadrage par défaut). Dès que `zoom > 1`, le wrapper devient plus grand que le cadre dans **les deux dimensions à la fois** — contrairement à `object-fit: cover` seul, cette marge ne dépend plus du rapport largeur/hauteur de la photo source : elle existe TOUJOURS sur les deux axes, ce qui corrige directement le bug vertical. Dès que `zoom < 1`, le wrapper devient plus petit que le cadre : le fond du cadre (`bg-surface-muted` pour `MediaFrame`, la couleur de fond du cercle pour l'avatar) apparaît autour de la photo — c'est l'effet de réduction demandé, impossible avec `object-fit: cover` seul, obtenu ici sans aucune mesure JavaScript de la taille intrinsèque de l'image (donc sans risque de décalage de mise en page, MASTER PROMPT §58, et sans abandonner `next/image` — le wrapper devient simplement le conteneur `position: relative` que `fill` remplit).

**Conséquence assumée du nouveau mécanisme** : à `zoom = 1` exactement, un point focal non centré (par exemple `focalX = 20`) n'a plus AUCUN effet visuel — `left`/`top` valent `0` par construction dès que `sizePercent = 100`, quelle que soit la valeur du point focal. C'est un changement de comportement par rapport à l'ancien mécanisme (où l'axe « débordant » restait pannable même à zoom 1), mais c'est un comportement standard, prévisible et cohérent avec la quasi-totalité des interfaces de recadrage grand public (Instagram, Canva, l'éditeur de photo de couverture Facebook) : on ne peut déplacer une photo qu'après l'avoir zoomée, jamais au repos. Documenté dans le code (`photoCropWrapperStyle`) plutôt que découvert en production.

**Borne basse du zoom élargie de 1.0 à 0.5** (`ise_profiles_public_photo_zoom_range`, `set_my_public_photo_crop()`) : 0.5 est choisi comme miroir raisonnable de la borne haute existante (3.0, posée par 0141 pour rester lisible) — assez bas pour réduire nettement une photo trop envahissante dans le cadre, assez haut pour que le sujet ne devienne pas un point perdu dans le fond. Curseur `PublicPhotoForm.tsx` (`ZOOM_MIN`) aligné sur la même constante partagée (`PHOTO_CROP_ZOOM_MIN`, `@ise/ui-web`), pour ne jamais dupliquer ce nombre entre le schéma et l'interface.

**« La photo de l'accueil »** — le porteur désigne par là l'encart « ISE du jour » de la page d'accueil publique (`FeaturedProfileCard`, `HighlightsSection.tsx`), qui affiche exactement ce même portrait public via `private.landing_member_photo()`, rendu par le même `LandingMediaImage`/`StorageImage` que la vignette de l'écran d'édition. Aucune donnée ni fonction SQL supplémentaire n'a donc été nécessaire pour ce troisième emplacement : le correctif de rendu (le wrapper) et l'élargissement de la borne de zoom s'y appliquent automatiquement, dès lors que `LandingMediaImage` a été corrigé une seule fois. Les autres médias rendus par `LandingMediaImage` (carrousel, partenaires, piliers, organisations) ne portent aujourd'hui aucun cadrage (`focalX`/`focalY`/`zoom` toujours `null` dans leur projection) : `photoCropWrapperStyle(null)` y renvoie `undefined`, le wrapper n'est simplement pas inséré, et leur rendu reste strictement inchangé.

---

## 61. Cadrage ajustable étendu à la photo de profil / avatar (D-206)

| # | Décision | Source |
| --- | --- | --- |
| D-206 | **ADOPTÉE** — Le porteur a demandé explicitement que « le même souci » (cadrage horizontal/vertical + réduction) soit géré aussi pour la photo de profil. Avant ce lot, l'avatar (bucket privé `avatars`, 0027/0126) n'avait AUCUN mécanisme de cadrage : upload puis affichage `object-fit: cover` fixe, centré, sans réglage possible. Trois nouvelles colonnes `avatar_focal_x` / `avatar_focal_y` / `avatar_zoom` sur `ise_profiles`, forme et bornes identiques à `public_photo_*` (0-100 / 0-100 / 0.5-3.0), même formule de rendu (`photoCropWrapperStyle`, D-205) appliquée à l'écran d'édition (`AvatarForm.tsx`, `/mon-profil/en-tete`, curseurs identiques à `PublicPhotoForm`) et au cockpit (en-tête de l'espace membre ET en-tête public pour un membre connecté). | `0147_photo_crop_zoom_out_and_avatar_crop.sql`, `app/mon-profil/en-tete/AvatarForm.tsx`, `app/mon-profil/en-tete/actions.ts` (`updateAvatarCropAction`), `app/mon-profil/en-tete/page.tsx`, `lib/queries/profile-sections.ts` (`ProfileHeader.avatarFocalX/Y/Zoom`), `lib/queries/viewer.ts` (`loadViewerAvatar`), `lib/public/protected-route.server.ts` (`readAvatar`), `components/layout/{AppShell,Topbar,AccountMenu}.tsx`, `app/(public)/_components/{PublicViewerProvider,PublicShell,PublicHeader}.tsx` |

**Écriture directe, pas de RPC dédiée** — même philosophie que `avatar_path` lui-même (0126, dont le commentaire de tête explique pourquoi une RPC n'ajouterait aucun pouvoir supplémentaire à une politique déjà exacte) : `ise_profiles_update_own` (0021) borne déjà l'`UPDATE` à la ligne du membre connecté, et 0147 ajoute simplement `grant select`/`grant update` sur les trois nouvelles colonnes à `authenticated`. `updateAvatarCropAction` revalide les bornes côté serveur avant d'écrire, exactement comme `updatePublicPhotoCropAction` le fait pour le portrait public — mais sans passer par une fonction PL/pgSQL, puisque la garde de ligne suffit déjà.

**Remise à zéro automatique** — un nouveau déclencheur, `trg_ise_profiles_avatar_crop_reset` (`private.tg_ise_profiles_avatar_crop_reset()`), remet le cadrage au centre (50/50, zoom 1.0) dès que `avatar_path` change (remplacement ou retrait), même motif que `private.tg_ise_profiles_public_photo_guard` (0141) pour le portrait public — un cadrage pensé pour une image n'a aucun sens appliqué à une autre. `uploadAvatarAction`/`removeAvatarAction` n'ont donc pas eu besoin d'être modifiées pour réinitialiser ces colonnes explicitement : le déclencheur couvre aussi tout futur chemin d'écriture de `avatar_path` qui l'oublierait.

**Portée volontairement limitée — pas de câblage sur les ~20 emplacements qui affichent l'avatar d'un TIERS** : l'avatar est rendu à une vingtaine d'endroits de l'application (cartes du réseau, listes de participants d'événements, membres de projets/communautés, résultats de recherche, back-office CMS...), tous via le composant partagé `Avatar` (`@ise/ui-web`). `Avatar` gagne un prop optionnel `crop?: PhotoCrop | null | undefined`, rétrocompatible par construction (`undefined` = rendu identique à avant, `object-fit: cover` centré, aucune régression pour les vingt appelants qui ne le fournissent pas) — mais SEULES les deux requêtes qui alimentent le PROPRIÉTAIRE de la photo se voyant LUI-MÊME ont été étendues pour le fournir : `loadViewerAvatar()` (cockpit de l'espace membre, `Topbar`/`AccountMenu`) et `readAvatar()` dans `protected-route.server.ts` (en-tête public pour un membre connecté visitant `ise.optimumconseil.ci` en étant authentifié — un second sens légitime de « la photo de l'accueil », distinct de l'« ISE du jour » traité en D-205). Étendre aux ~18 autres emplacements (affichage de l'avatar d'AUTRUI) aurait exigé de modifier chaque requête de lecture d'avatar dans toute l'application (réseau, événements, projets, communautés, recherche, CMS) — une extension disproportionnée par rapport au signalement traité ici, qui portait sur la photo qu'un membre règle et voit de LUI-MÊME. Aucun de ces vingt emplacements n'affichait de cadrage avant ce lot ; aucun ne régresse.

**Choix délibérément écarté** : construire un composant de recadrage entièrement piloté par mesure JavaScript (taille naturelle de l'image via `onLoad`, taille du conteneur via `ResizeObserver`, calcul pixel-exact de l'échelle de couverture). Cette approche est plus proche de ce que font les éditeurs de recadrage professionnels (react-easy-crop, Cropper.js), mais introduit une dépendance à l'exécution côté client (flash non stylé avant mesure, risque de CLS résiduel) pour un gain de précision marginal par rapport à la solution purement CSS retenue — qui reproduit exactement le rendu existant à zoom 1 et couvre les deux bugs signalés sans aucune mesure.
