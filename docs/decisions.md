# Journal des décisions — Compétences ISE

Ce document consigne tout arbitrage rendu lorsque les sources se contredisent, conformément au
MASTER PROMPT §2 (hiérarchie : sécurité > règles du MASTER PROMPT > maquettes & spécifications >
détails visuels) et §114 (« prendre une décision raisonnable, la documenter, continuer »).

Statut des décisions : **ADOPTÉE** (appliquée au code) · **PROVISOIRE** (à confirmer par le métier)
· **OUVERTE** (bloquante, en attente).

---

## 0. Décisions de cadrage (validées par le porteur du projet, 07/08/2026)

| # | Décision | Justification |
| --- | --- | --- |
| C-01 | **Un seul projet Supabase**, utilisé directement comme Production. | Choix explicite du porteur. Mitigation : 100 % des changements DB passent par des migrations versionnées et rejouables ; aucun `DROP` destructif hors migration documentée ; l'ajout ultérieur d'un projet `staging` reste possible sans refonte. |
| C-02 | **Web d'abord, mobile ensuite.** Le monorepo et les packages partagés (`domain`, `validation`, `design-tokens`, `db-types`) sont créés dès la Phase 1 pour que `apps/mobile` n'ait rien à réécrire. | Évite de déboguer deux fois la même règle métier ; MASTER PROMPT §4 et §53. |
| C-03 | **Push direct sur `main`** du dépôt `blyped/ise` pendant la construction initiale, avec CI GitHub Actions bloquante (lint, typecheck, tests, build). Passage au modèle par PR une fois les Phases 0–2 stabilisées. | Choix explicite du porteur. |
| C-04 | Le code vit dans `C:\Services\Ise\app` sur le poste et dans `blyped/ise` sur GitHub. Les documents de spécification restent à la racine `C:\Services\Ise` et ne sont pas versionnés dans le dépôt applicatif. | Sépare les sources métier du livrable logiciel. |
| C-05 | **Le back-office OPS (OPS-001 → OPS-028) est abandonné** — décision du porteur du projet, 08/08/2026 (« trop technique »). Les 28 maquettes OPS ne seront pas implémentées. La supervision reste assurée par les outils natifs Supabase (logs, advisors) et Vercel (observabilité), par les contrôles internes `security_baseline_violations()` / `storage_baseline_violations()` et par `get_cms_automation_status()`. Les permissions `ops.read` / `ops.manage` et le rôle `ops` restent en base, inoffensifs et réutilisables si la décision est revue, mais aucun écran ne les consomme. | Choix explicite du porteur. Cohérent avec le MASTER PROMPT §41, qui demandait déjà de ne pas construire « un deuxième gigantesque back-office technique » : Supabase et Vercel couvrent le besoin V1. |
| C-06 | **L'import en masse d'annuaire (SA-040, SA-041, SA-042, SA-044, SA-045) est abandonné** — décision du porteur du projet, 09/08/2026. L'unique jeu de données (recensement Excel de 275 réponses, 255 profils après dédoublonnage) a été importé directement en migration (`0088_import_ise_census`), en contournant volontairement ce module ; aucun autre import de masse n'est prévu, toute intégration future se fait par création de profil individuel. Les écrans de téléversement, mapping/anomalies, revue de doublons et campagnes de complétude sont retirés du code web. SA-043 (Profils incomplets) est conservé — utile indépendamment de l'origine du profil — et déplacé de `/administration/imports/profils-incomplets` vers `/administration/profils-incomplets`. Les tables (migration `0017`) et fonctions `admin_*` du pipeline d'import (migration `0080`) restent en base, inoffensives (SECURITY DEFINER + RLS), non consommées par aucun écran ; leur suppression est un nettoyage optionnel de la Phase 8-9 (dette technique, pas un risque de sécurité). La permission `imports.execute` n'est plus consommée par aucun écran ; `imports.review` continue de protéger SA-043. | Choix explicite du porteur, formulé après l'import réel du recensement ISE : le module d'import en masse n'a jamais servi (l'import a été fait en migration directe) et ne servira plus, il ne doit pas rester comme surface de produit décorative (MASTER PROMPT §113). |
| C-08 | **La messagerie ISE↔ISE (ISE-097) est abandonnée** — décision du porteur du projet, 14/08/2026, en même temps que la commande du module Communication dont la règle §2 interdit explicitement tout chat, forum, fil communautaire ou conversation privée entre membres. La surface de produit est retirée : écrans `/messages`, composants, routes, entrée de navigation, quatre liens croisés, libellés, et les huit RPC exposées à l'API (migration `0128`). Les six tables restent en base, **vides, sans aucune politique RLS ni privilège** — donc inatteignables — de même que le bucket `message-attachments` (vide, politique fermée) ; leur suppression est un nettoyage optionnel, pas un risque. Le blocage de profil (`profile_blocks`, `block_profile()`) est **conservé** : il ne relève pas de la messagerie et sert `can_see_profile`. La relation entre membres passe désormais par les modules dédiés — relations, introductions, appels au réseau, mentorat — qui portent tous un motif et un contexte, contrairement à un message libre. | Choix explicite du porteur (« je ne veux pas de messagerie dedans, pas de documents à échanger en pièce jointe et consorts »), cohérent avec le cahier des charges du module Communication : le canal doit être **vertical** (ISE → Administration, Administration → ISE / Promotion / Tous) et non horizontal. Aucune donnée n'est perdue : le module n'avait jamais servi (0 conversation, 0 message, 0 pièce jointe). |

---

## Table des matières — les dix parties du journal

Les décisions **D-01 → D-200** sont réparties dans dix fichiers thématiques, sous `docs/decisions/`,
dans l'ordre de lecture du journal (les numéros de section d'origine sont conservés).
Les décisions de cadrage **C-01 → C-08** restent ci-dessus, dans ce fichier.

### Repérage rapide

| Identifiants | Fichier |
| --- | --- |
| D-01 → D-03, D-10 → D-22, D-30 → D-32, D-40 → D-46, D-50 → D-55, D-60 → D-66 | [`decisions/01-fondations-et-modele-de-donnees.md`](decisions/01-fondations-et-modele-de-donnees.md) |
| D-70 → D-75, D-80 → D-85, D-90 → D-96, D-100 → D-107, D-110 → D-120, Q-01 → Q-08 | [`decisions/02-profil-interface-securite-et-questions-ouvertes.md`](decisions/02-profil-interface-securite-et-questions-ouvertes.md) |
| D-121 → D-155 | [`decisions/03-site-public-cms-et-consolidation.md`](decisions/03-site-public-cms-et-consolidation.md) |
| D-156 → D-162 | [`decisions/04-back-office-et-administration.md`](decisions/04-back-office-et-administration.md) |
| D-163 → D-168 | [`decisions/05-vitrine-publique-carrousel-cartes-et-piliers.md`](decisions/05-vitrine-publique-carrousel-cartes-et-piliers.md) |
| D-169 → D-173 | [`decisions/06-evenements-de-domaine-notifications-et-visuels.md`](decisions/06-evenements-de-domaine-notifications-et-visuels.md) |
| D-174 → D-178 | [`decisions/07-mises-en-avant-et-ise-du-jour.md`](decisions/07-mises-en-avant-et-ise-du-jour.md) |
| D-179, D-180, exécution de C-08 | [`decisions/08-depots-de-fichiers-et-retrait-de-la-messagerie.md`](decisions/08-depots-de-fichiers-et-retrait-de-la-messagerie.md) |
| D-181 → D-183 | [`decisions/09-textes-des-piliers-moderation-et-remontee-d-information.md`](decisions/09-textes-des-piliers-moderation-et-remontee-d-information.md) |
| D-184 → D-203 | [`decisions/10-dons-organisations-cadrage-et-pastilles.md`](decisions/10-dons-organisations-cadrage-et-pastilles.md) |

### [Partie 1 — Fondations et modèle de données](decisions/01-fondations-et-modele-de-donnees.md)

Sections 1 à 6.

- **§1. Source de vérité en cas de contradiction** — D-01 ordre de préséance des sources · D-02 UI/UX devant fonctionnel sur les détails d'interface · D-03 vérification d'e-mail sans code à 6 chiffres
- **§2. Modèle de données** — D-10 `profile_id` comme clé de rattachement · D-11 chemins Storage par `profile_id` · D-12 fonctions d'aide RLS dans le schéma `private` · D-13 `text` + `CHECK` plutôt que `ENUM` · D-14 colonnes techniques communes à toutes les tables · D-15 clés primaires des tables de liaison · D-16 trois schémas `public` / `private` / `analytics` · D-17 vecteur de recherche dans une table dédiée · D-18 champs ajoutés à `ise_profiles` · D-19 suppression de compte : `user_id` passe à `NULL` · D-20 unicité du lien compte ↔ profil · D-21 `job_functions` et non `functions` · D-22 `database.types.ts` généré, jamais écrit à la main
- **§3. Rôles et permissions** — D-30 nomenclature des permissions · D-31 rôles de la V1 · D-32 rôles portés par `private.user_roles`
- **§4. Recherche et matching** — D-40 barème de matching de référence · D-41 barèmes de détail centralisés · D-42 labels qualitatifs, aucun pourcentage affiché · D-43 raison explicite pour toute recommandation · D-44 pagination par curseur keyset · D-45 recherche plein texte `unaccent` + `pg_trgm` · D-46 alias de compétences
- **§5. Machines d'états** — D-50 machine d'états des introductions · D-51 introductions à un seul intermédiaire · D-52 clôture ternaire d'un appel au réseau · D-53 états des projets et consortiums · D-54 `alternative_proposed` conservé en mentorat · D-55 aucun statut non constaté
- **§6. Taxonomies et référentiels** — D-60 taxonomie du doc 20 intégralement seedée · D-61 libellés du doc 19 conservés et marqués · D-62 slugs uniques par table · D-63 doublons intra-taxonomie · D-64 référentiels créés (pays, sous-régions, langues…) · D-65 types de disponibilité · D-66 motifs de signalement

### [Partie 2 — Profil, interface, sécurité et questions ouvertes](decisions/02-profil-interface-securite-et-questions-ouvertes.md)

Sections 7 à 11.

- **§7. Profil et onboarding** — D-70 onboarding en 7 étapes · D-71 calcul du score de complétion · D-72 score de complétion privé · D-73 échelle de visibilité à 4 niveaux · D-74 visibilités par défaut des champs non spécifiés · D-75 niveau de compétence déclaratif · D-110 numérotation définitive des 7 étapes · D-111 étape « Vérification » sans envoi de code · D-112 progression d'onboarding persistée · D-113 table `promotion_suggestions` · D-114 niveau de disponibilité converti en heures par mois · D-115 visibilité de la ville à 4 niveaux · D-116 écarts de contenu assumés · D-117 dépôt de photo de profil fermé *(levée par D-179)* · D-118 sixième valeur d'`introduction_requests.outcome` · D-119 classement qualitatif des intermédiaires · D-120 « Ignorer » une invitation n'écrit rien
- **§8. Notifications, messagerie, paramètres** — D-80 matrice canaux × événements · D-81 « Action requise » est une priorité, pas une catégorie · D-82 archivage des conversations par participant *(historique : messagerie retirée, C-08)* · D-83 états d'un message *(historique)* · D-84 pièces jointes *(historique)* · D-85 aucun SLA de support affiché
- **§9. Design system et états d'interface** — D-90 la couleur ne porte jamais seule une information · D-91 typographie et tokens de base · D-92 valeur de `--color-primary-hover` · D-93 convention transverse des états d'écran · D-94 navigation mobile à 5 destinations · D-95 ordre de la sidebar web · D-96 grille web
- **§10. Sécurité et exploitation** — D-100 `service_role` côté serveur uniquement · D-101 `SECURITY DEFINER` avec `search_path` vide · D-102 erreurs porteuses d'un `correlation_id` · D-103 limitation de débit applicative · D-104 comptes de test préfixés `test+` · D-105 approbation automatique d'une réclamation par e-mail historique · D-106 fonctions de réclamation réservées aux comptes authentifiés · D-107 indice d'e-mail masqué
- **§11. Questions ouvertes soumises au métier** — Q-01 → Q-08, avec la valeur appliquée par défaut

### [Partie 3 — Site public, CMS et consolidation du 8 août](decisions/03-site-public-cms-et-consolidation.md)

Sections 12 à 14.

- **§12. Site public et CMS** — D-121 `CHECK` d'`event_type` élargi · D-122 deux colonnes ajoutées à `ise_profiles` · D-123 D-73 reste en vigueur · D-124 configuration brouillon / publiée et rollback · D-125 `EXECUTE` accordé à `anon` sur dix fonctions · D-126 retrait d'`EXECUTE` à `PUBLIC` · D-127 sélection éditoriale des expertises · D-128 programmation CMS et `landing_visibility` · D-129 quatre tâches `pg_cron` · D-130 écart assumé à D-104 dans les tests RLS · D-131 permissions de publication sur la landing · D-132 revalidation par Server Action · D-133 pipeline d'image de CMS-008
- **§13. Médias de la vitrine publique** — D-134 bucket `landing-media` · D-135 pas de photographie pour l'« ISE du jour » *(révisée par D-176)* · D-136 trois conditions de projection d'un média · D-137 pas de seconde colonne de bucket · D-138 place de l'image réservée par son conteneur · D-139 suppression d'objet non testée par `DELETE` · D-140 amendement de D-133
- **§14. Consolidation du 8 août 2026** — D-141 aucune mécanique de popularité · D-142 seuils de cross-posting · D-143 marquage « réponse utile » binaire · D-144 création de communauté fermée en V1 · D-145 intérêt et appartenance à un projet ne se rejoignent jamais · D-146 paliers de divulgation de la rémunération · D-147 aucun pourcentage d'avancement de projet · D-148 `landing_visibility` affiché en toutes lettres · D-149 fil mixte actualités + événements · D-150 `online_url_private` jamais projeté · D-151 ni total de résultats ni pagination numérotée · D-152 pertinence rendue en mode pertinence seulement · D-153 entrées de l'en-tête public · D-154 PUB-001 en `force-dynamic` · D-155 trois portes de la redirection post-authentification

### [Partie 4 — Back-office et administration](decisions/04-back-office-et-administration.md)

Sections 15 à 21.

- **§15. Superadmin — Communautés (SA-027 → 029)** — D-156 périmètre réel de SA-029
- **§16. Superadmin — Événements (SA-030 → 033)** — D-157 SA-031/032/033 fusionnés en un seul écran
- **§17. Superadmin — Journal d'audit (SA-049 → 050)** — D-158 deux routes distinctes conservées
- **§18. Correctif transversal — exports non-fonction depuis `'use server'`** — D-159
- **§19. En-tête membre — point d'entrée vers le back-office** — D-160 lien « Administration » conditionnel
- **§20. Provisioning direct des comptes du recensement** — D-161 comptes pré-créés et lien d'activation
- **§21. Rédaction administrative des actualités** — D-162 écran `/administration/actualités`

### [Partie 5 — Vitrine publique : carrousel, cartes et piliers](decisions/05-vitrine-publique-carrousel-cartes-et-piliers.md)

Sections 22 à 27.

- **§22. Rotation automatique du carrousel et correction du survol** — D-163 durée d'autoplay réglable depuis le CMS
- **§23. Resserrement du menu public et piliers « réseau utile »** — D-164 menu public à cinq entrées
- **§24. « ISE du jour » : visuel éditorial et accroche** — D-165 photo et accroche choisies par l'administration
- **§25. Visuels des cartes Événements/Opportunités et écran CMS `/cms/opportunites`** — D-166, avec la règle permanente des tailles d'image recommandées
- **§26. Picklist Organisations dans les formulaires de profil** — D-167
- **§27. Piliers « Un réseau conçu pour être utile » pilotés par le CMS** — D-168

### [Partie 6 — Événements de domaine, notifications et visuels](decisions/06-evenements-de-domaine-notifications-et-visuels.md)

Sections 28 à 32.

- **§28. `domain_events` manquants pour candidatures et recommandations** — D-169, et extension du consommateur de notifications
- **§29. Rognage du carrousel héros** — D-170 ratio panoramique fixe sur desktop
- **§30. Lien de navigation croisé entre `/administration` et `/cms`** — D-171
- **§31. Image de couverture unique pour les actualités** — D-172 admin, landing et page article
- **§32. Suivi des clics sur les liens d'e-mail Supabase** — D-173 `/auth/callback` comme point d'instrumentation unique

### [Partie 7 — Mises en avant et « ISE du jour »](decisions/07-mises-en-avant-et-ise-du-jour.md)

Sections 33 à 37.

- **§33. Image de couverture sur les pages de détail** — D-174 événement et opportunité rejoignent l'actualité
- **§34. Encarts de « À la une du réseau » entièrement cliquables** — D-175, la connexion restant exigée pour le détail
- **§35. Portrait public de l'« ISE du jour »** — D-176, qui révise D-135 par un consentement neuf
- **§36. File de programmation des encarts et rotation automatique** — D-177
- **§37. Piliers cliquables et conteneur d'image** — D-178

### [Partie 8 — Dépôts de fichiers et retrait de la messagerie](decisions/08-depots-de-fichiers-et-retrait-de-la-messagerie.md)

Sections 38 à 40.

- **§38. Dépôt de photo de profil ouvert** — D-179, qui lève D-117
- **§39. Dépôt de CV et de documents de profil ouvert** — D-180
- **§40. Retrait de la messagerie ISE↔ISE** — exécution de C-08 (la décision elle-même est en section 0 ci-dessus)

### [Partie 9 — Textes des piliers, modération et remontée d'information](decisions/09-textes-des-piliers-moderation-et-remontee-d-information.md)

Sections 41 à 43.

- **§41. Titre et corps des piliers pilotés par le CMS** — D-181, qui complète D-168 et fait des textes d'i18n un simple jeu de valeurs de repli
- **§42. Blocage d'un membre et suppression de compte par l'administration** — D-182, qui referme la conséquence non résolue de C-08 et applique D-19
- **§43. « Remonter une information » (module Communication, premier volet)** — D-183, extension du module support : natures, six statuts, quatre priorités, pièces jointes

### [Partie 10 — Dons, organisations, cadrage et pastilles](decisions/10-dons-organisations-cadrage-et-pastilles.md)

Sections 44 à 58.

- **§44. Lien de retour vers l'espace membre depuis Administration et CMS** — D-184
- **§45. Proposition de contenu par les ISE, avec validation administrative** — D-185, bucket privé `content-proposals`, gap ouvert sur l'image des opportunités
- **§46. Bandeau sponsors, logos des organisations et nouvelles sections de landing** — D-186
- **§47. Carte mondiale de présence des ISE et bloc « Le réseau en quelques chiffres »** — D-187
- **§48. Seuil de confidentialité de la carte des pays abaissé de 3 à 1** — D-188, révise D-187
- **§49. Module de dons — architecture et migration vers CinetPay v2** — D-189, D-190
- **§50. Correctifs des encarts Événement et Opportunité de la landing** — D-191, D-192
- **§51. Pastilles de comptage dans les menus Administration et CMS** — D-193
- **§52. Peuplement du référentiel des organisations et section « Ils nous font confiance »** — D-194, réserve non résolue sur le doublon `0140`/`0142`
- **§53. Cadrage ajustable de la photo « ISE du jour »** — D-195
- **§54. Crédit auteur dans le pied de page** — D-196
- **Note méthodologique — dérive de migrations non committées** — D-197 (pratique établie), D-198 (OUVERTE, cause racine non corrigée)
- **§55. Ouverture des trois modules du tableau de bord membre** — D-199, critères de secteur/pays dérivés du profil pour « ISE que vous pourriez connaître »
- **§56. Bandeau d'annonces admin en tête du tableau de bord membre** — D-200, diffusion descendante distincte du module Communication ascendant (D-183)
- **§57. Rattachement automatique d'un compte Google à un profil ISE non réclamé** — D-201, l'e-mail Google vérifié fait office de preuve de possession, au même titre que le clic sur le lien d'activation (D-161)
- **§58. Sixième emplacement « Organisations (logos) » dans la médiathèque CMS** — D-203, sixième préfixe reconnu par `private.is_landing_media_path()` + comptage de références étendu à `cms_landing_organizations`
