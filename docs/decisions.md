# Journal des décisions — Compétences ISE

Ce document consigne tout arbitrage rendu lorsque les sources se contredisent, conformément au
MASTER PROMPT §2 (hiérarchie : sécurité > règles du MASTER PROMPT > maquettes & spécifications >
détails visuels) et §114 (« prendre une décision raisonnable, la documenter, continuer »).

Statut des décisions : **ADOPTÉE** (appliquée au code) · **PROVISOIRE** (à confirmer par le métier)
· **OUVERTE** (bloquante, en attente).

---

## 0. Décisions de cadrage (validées par le porteur du projet, 07/08/2026)

| #    | Décision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Justification                                                                                                                                                                                                                                     |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | **Un seul projet Supabase**, utilisé directement comme Production.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Choix explicite du porteur. Mitigation : 100 % des changements DB passent par des migrations versionnées et rejouables ; aucun `DROP` destructif hors migration documentée ; l'ajout ultérieur d'un projet `staging` reste possible sans refonte. |
| C-02 | **Web d'abord, mobile ensuite.** Le monorepo et les packages partagés (`domain`, `validation`, `design-tokens`, `db-types`) sont créés dès la Phase 1 pour que `apps/mobile` n'ait rien à réécrire.                                                                                                                                                                                                                                                                                                                                                                                          | Évite de déboguer deux fois la même règle métier ; MASTER PROMPT §4 et §53.                                                                                                                                                                       |
| C-03 | **Push direct sur `main`** du dépôt `blyped/ise` pendant la construction initiale, avec CI GitHub Actions bloquante (lint, typecheck, tests, build). Passage au modèle par PR une fois les Phases 0–2 stabilisées.                                                                                                                                                                                                                                                                                                                                                                           | Choix explicite du porteur.                                                                                                                                                                                                                       |
| C-04 | Le code vit dans `C:\Services\Ise\app` sur le poste et dans `blyped/ise` sur GitHub. Les documents de spécification restent à la racine `C:\Services\Ise` et ne sont pas versionnés dans le dépôt applicatif.                                                                                                                                                                                                                                                                                                                                                                                | Sépare les sources métier du livrable logiciel.                                                                                                                                                                                                   |
| C-05 | **Le back-office OPS (OPS-001 → OPS-028) est abandonné** — décision du porteur du projet, 08/08/2026 (« trop technique »). Les 28 maquettes OPS ne seront pas implémentées. La supervision reste assurée par les outils natifs Supabase (logs, advisors) et Vercel (observabilité), par les contrôles internes `security_baseline_violations()` / `storage_baseline_violations()` et par `get_cms_automation_status()`. Les permissions `ops.read` / `ops.manage` et le rôle `ops` restent en base, inoffensifs et réutilisables si la décision est revue, mais aucun écran ne les consomme. | Choix explicite du porteur. Cohérent avec le MASTER PROMPT §41, qui demandait déjà de ne pas construire « un deuxième gigantesque back-office technique » : Supabase et Vercel couvrent le besoin V1.                                             |
| C-06 | **L'import en masse d'annuaire (SA-040, SA-041, SA-042, SA-044, SA-045) est abandonné** — décision du porteur du projet, 09/08/2026. L'unique jeu de données (recensement Excel de 275 réponses, 255 profils après dédoublonnage) a été importé directement en migration (`0088_import_ise_census`), en contournant volontairement ce module ; aucun autre import de masse n'est prévu, toute intégration future se fait par création de profil individuel. Les écrans de téléversement, mapping/anomalies, revue de doublons et campagnes de complétude sont retirés du code web. SA-043 (Profils incomplets) est conservé — utile indépendamment de l'origine du profil — et déplacé de `/administration/imports/profils-incomplets` vers `/administration/profils-incomplets`. Les tables (migration `0017`) et fonctions `admin_*` du pipeline d'import (migration `0080`) restent en base, inoffensives (SECURITY DEFINER + RLS), non consommées par aucun écran ; leur suppression est un nettoyage optionnel de la Phase 8-9 (dette technique, pas un risque de sécurité). La permission `imports.execute` n'est plus consommée par aucun écran ; `imports.review` continue de protéger SA-043. | Choix explicite du porteur, formulé après l'import réel du recensement ISE : le module d'import en masse n'a jamais servi (l'import a été fait en migration directe) et ne servira plus, il ne doit pas rester comme surface de produit décorative (MASTER PROMPT §113). |

---

## 29. Rognage du carrousel héros — le conteneur desktop passe d'une hauteur plein écran à un ratio panoramique fixe (D-170)

| #     | Décision | Source |
| ----- | -------- | ------ |
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
