# Imports d'annuaire — protocole tel qu'implémenté

> Écrans SA-040 → SA-045 · migrations `0017` (modèle), `0027` (bucket),
> `0080` (API), `0084` (maintenance) · code web `apps/web/src/app/administration/imports/**`
> et `apps/web/src/lib/admin-data/**` · suite de tests `supabase/tests/rls/0031_imports_suite.sql`.
>
> Références : MASTER PROMPT §6, §36, §37, §98 ; DIGEST B section 6 « Protocole
> d'import » ; docs/decisions.md D-16, D-102, D-104, D-126.

## Règles non négociables (et où elles sont tenues)

| Règle                                                                                                                                                                                  | Où elle est appliquée                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Un import ne crée JAMAIS de compte `auth.users`** (§6, D-104). Il crée des profils **référencés** : `user_id = NULL`, `claim_status = 'unclaimed'`, `profile_status = 'referenced'`. | `admin_execute_import_batch()` (0080) ne touche jamais `auth.users` ; assertion explicite compte avant/après dans la suite 0031 (cas E02).                                                                                                                                                   |
| **Workflow verrouillé** : upload → staging → mapping → validation → normalisation → détection doublons → revue humaine → import → rapport (§37).                                       | `private.transition_import_batch()` (0017) — seule voie de changement d'étape ; chaque franchissement est tracé dans `private.import_stage_events`.                                                                                                                                          |
| **Aucune fusion automatique.** Un candidat doublon exige un réviseur humain identifié ; une fusion exige un candidat **confirmé**.                                                     | Contrainte `duplicate_candidates_human_review` (0017) ; `admin_decide_import_row()` refuse `merge` sans candidat confirmé (cas D02).                                                                                                                                                         |
| **La donnée brute n'est jamais écrasée.**                                                                                                                                              | `private.import_rows.raw_source_data` conserve la ligne d'origine ; le fichier original est déposé tel quel dans le bucket privé `admin-imports`.                                                                                                                                            |
| **Normalisation sans perte uniquement** (§37).                                                                                                                                         | Formes normalisées dans `normalized_data._norm`, à côté du brut. Téléphone : E.164 seulement si la chaîne en est déjà un aux séparateurs près, sinon conservé brut et signalé. Organisations / secteurs / pays non reconnus : file de revue (`import_value_reviews`), jamais créés d'office. |
| **Compteurs réels** (§98).                                                                                                                                                             | Tous les totaux sont des `COUNT` ; le rapport (`import_reports`) est produit par l'exécution elle-même.                                                                                                                                                                                      |
| **Idempotence.**                                                                                                                                                                       | Empreinte SHA-256 du fichier (`file_checksum`, index unique) : recharger le même fichier est refusé (`import_file_already_loaded`). `row_hash` déduplique les lignes brutes identiques. Rejouer un lot terminé est une `invalid_transition` ; rien n'est dupliqué (cas E08).                 |

## Déroulé d'un import (ce que fait réellement chaque étape)

1. **Téléversement** (`/administration/imports/nouveau`, permission `imports.execute`)
   - parse serveur du fichier (Server Action `uploadImportAction`) ;
   - `admin_create_import_batch(...)` avec l'empreinte SHA-256 ;
   - dépôt de l'original dans `admin-imports/{batch_id}/{fichier}` (bucket privé, politique 0027) ;
   - `admin_stage_import_rows(...)` : chaque ligne brute part en `private.import_rows`.
2. **Mapping** (`/administration/imports/[batchId]`) — chaque colonne du fichier est
   rattachée à un champ cible **ou explicitement ignorée**. `admin_set_import_mapping()`
   refuse un mapping incomplet (`import_mapping_incomplete`). Des propositions sont
   déduites des en-têtes (`lib/admin-data/mapping.ts`) mais rien n'est enregistré sans
   validation de l'opérateur.
3. **Validation** — `admin_validate_import_batch()` : nom/prénom obligatoires (rejet),
   année de promotion aberrante (rejet), promotion absente ou inconnue (avertissement),
   e-mail invalide (avertissement, jamais utilisé pour les invitations), téléphone non
   normalisable (avertissement, conservé brut). Chaque anomalie devient une ligne
   `data_quality_issues` avec un code machine (D-102) et une action recommandée.
4. **Normalisation** — `admin_normalize_import_batch()` : e-mails en minuscules,
   téléphones E.164 prudents, rapprochement des promotions / organisations / pays vers
   les référentiels. En cas d'incertitude : non mappé + file de revue, jamais inventé.
5. **Détection de doublons** — `admin_detect_import_duplicates()` applique le barème
   `private.duplicate_match_rules` (seedé en 0017 : email 45, téléphone 40, nom proche 25,
   promotion 20, organisation 8, pays 5 — recalibrable en base sans migration) contre les
   profils existants **et** entre lignes du lot. Seuils : ≥ 80 doublon probable,
   60–79 à examiner. Un candidat n'existe que sur indice fort (email, téléphone ou nom
   proche) : pays/organisation seuls ne désignent personne.
6. **Revue humaine** (`/administration/imports/[batchId]/doublons`, permission
   `imports.review`) — comparaison côte à côte, décision par candidat
   (confirmer / écarter / reporter) puis par ligne (fusionner / créer / ignorer /
   examiner plus tard). Chaque décision est journalisée (`private.audit_log`).
   L'arbitrage champ par champ d'une fusion passe par `admin_resolve_merge_fields()` :
   par défaut, **rien** n'est écrasé sur le profil existant.
7. **Import** — `admin_execute_import_batch()` refuse de démarrer tant qu'une ligne en
   revue ou un candidat doublon reste sans décision. Il crée des profils référencés,
   verse les coordonnées historiques dans `private.profile_contacts` (jamais exposé —
   usage : invitation, rapprochement, vérification), applique les fusions décidées.
8. **Rapport** — `import_reports` (`summary`, `errors`, `duplicates`) : créés / fusionnés /
   ignorés / erreurs / reportés. Affiché sur l'écran du lot ; le lot passe `reported`.

Un profil importé est immédiatement trouvable par `search_claimable_profiles`
(ISE-005) : la personne peut réclamer son profil — c'est le seul chemin vers un compte.

## Format de fichier attendu

- **Formats** : CSV (recommandé) ou XLSX. Taille maximale 10 Mo, 20 000 lignes de données.
- **CSV** : séparateur `;`, `,` ou tabulation (détecté automatiquement) ; encodage UTF-8
  (avec ou sans BOM) ou Windows-1252 (export Excel français accepté) ; guillemets
  RFC 4180 (valeurs contenant `;` ou des retours à la ligne entre `"…"`).
- **XLSX** : la feuille nommée `ISE_IMPORT` est utilisée si elle existe, sinon la
  première feuille. Cellules texte et nombre prises telles quelles. **Attention** : une
  cellule formatée « Date » arrive comme numéro de série Excel et sera signalée par la
  validation — mettre les dates en texte `AAAA-MM-JJ` ou `JJ/MM/AAAA`.
- **Ligne 1 = en-têtes de colonnes.** Les noms sont libres : l'écran de mapping propose
  automatiquement les correspondances (« Prénom », « NOM », « Année de promotion »,
  « E-mail », « Employeur »… sont reconnus) et l'opérateur tranche colonne par colonne.
- **Champs cibles disponibles** (0017) : `source_id`, `first_name`, `middle_names`,
  `last_name`, `display_name`, `promotion_year`, `email`, `phone`, `secondary_phone`,
  `country`, `city`, `current_position`, `organization`, `sector`, `linkedin_url`,
  `notes_source`, `last_known_update`, `source_name`, `source_date`, `import_comment`.
- **Obligatoires pour l'import d'une ligne** : nom et prénom. Le reste est facultatif —
  un manque devient une anomalie tracée, pas un blocage silencieux.
- Exemple minimal :

  ```csv
  Nom;Prénom;Promotion;Email;Téléphone;Organisation;Pays
  Diallo;Aïcha;2003;aicha.diallo@exemple.org;+221771234567;Ministère du Plan;Sénégal
  Ndiaye;Moussa;1998;;;Banque mondiale;États-Unis
  ```

## Sécurité et accès

- Les tables `private.import_*` ne sont **pas** exposées à PostgREST (D-16). Toute
  l'interface passe par les fonctions `admin_*` de 0080 : `SECURITY DEFINER`,
  `search_path = ''`, permission vérifiée en tête, `REVOKE … FROM PUBLIC, anon` +
  `GRANT` explicite (D-126).
- Permissions : `imports.execute` (lancer et faire avancer un lot),
  `imports.review` (revue des doublons et décisions de ligne). Le rôle seedé
  `import_manager` porte les deux ; `superadmin` aussi.
- Bucket `admin-imports` : privé, lecture/écriture sous `imports.execute` (0027).
- Chaque action (création de lot, staging, mapping, validation, normalisation,
  détection, revue, décision, exécution, abandon) écrit dans `private.audit_log`
  avec `correlation_id` (§40, D-102).

## Ce qui n'est pas couvert dans cette version

- **Campagnes de complétude (SA-044/045)** : aucun modèle de données ni canal d'envoi
  n'existe ; l'écran `/administration/imports/campagnes` l'affiche en toutes lettres
  (§98) et renvoie vers la liste réelle des profils incomplets.
- **Expériences professionnelles** : le mapping ne porte que la situation actuelle
  (poste / organisation / secteur) — le fichier source historique ne contient pas de
  parcours structuré. Rien n'est inventé.
- **`promotion_memberships`** : l'import renseigne `ise_profiles.promotion_id` ;
  l'appartenance confirmée reste gérée par le module Promotions.
- **File de revue des valeurs** (`import_value_reviews`) : alimentée par la
  normalisation et comptée sur SA-040 ; l'écran d'arbitrage dédié (rattacher une
  organisation libre à une organisation canonique) reste à livrer.
