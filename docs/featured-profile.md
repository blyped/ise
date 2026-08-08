# ISE du jour — sélection, éligibilité, override, teaser

Migrations `0057` (tables), `0059` (moteur), `0064` et `0065` (correctifs), `0061` (projection
publique). Sources : `ADDENDUM` §14 → §22, §44 · CDC additionnel §12 → §20.

---

## 1. Ce que « ISE du jour » n'est pas

> Il s'agit d'une mise en lumière éditoriale tournante, pas d'un classement.

**Interdiction absolue** (addendum §19, CDC §12) : la sélection n'utilise **aucun** signal de
popularité — ni nombre de connexions, ni messages, ni likes, ni vues, ni score réseau, ni score de
complétion. Le prédicat `private.featured_profile_eligible()` ne lit que le **consentement**,
l'**état du profil**, la **complétude des champs publics** et l'**absence de modération active**.
Aucune de ces lectures ne peut exprimer un mérite.

Le seul paramètre d'ordonnancement, `cms_featured_profile_rules.balance_dimension`, est un critère
de **diversité** (promotion, pays, secteur, expertise), pas de valeur.

---

## 2. Modèle de données

Deux tables, aucune copie de profil.

### `cms_featured_profile_rules` — une seule ligne active

| Colonne                         | Défaut        | Rôle                                                      |
| ------------------------------- | ------------- | --------------------------------------------------------- |
| `min_days_between_features`     | `90`          | fenêtre de rotation (CDC §16)                             |
| `require_claimed_profile`       | `true`        | profil réclamé exigé                                      |
| `require_promotion`             | `true`        | promotion renseignée exigée                               |
| `require_avatar`                | `false`       | avatar exigé ou non                                       |
| `require_expertise_or_position` | `true`        | poste **ou** au moins un domaine d'expertise              |
| `balance_dimension`             | `'promotion'` | `none` / `promotion` / `country` / `sector` / `expertise` |
| `is_automation_enabled`         | `true`        | suspension de l'automatisation (§22)                      |

Unicité garantie par `create unique index … (is_active) where is_active`.

### `cms_featured_profile_history`

`profile_id` · `featured_date` · `selection_mode` (`automatic` / `manual` / `fallback`) ·
`selected_by_profile_id` · `status` (`scheduled` / `published` / `superseded`) · `published_at` ·
`selection_context jsonb`.

**Ne stocke aucune donnée de profil** : qui, quand, selon quel mode. Le teaser est recomposé depuis
`ise_profiles` à **chaque** lecture (addendum §15). Une seule mise en avant retenue par jour
(index unique partiel sur `featured_date`).

`selection_context` porte la trace de la décision — taille du vivier, dimension d'équilibrage,
fenêtre appliquée — et rend la sélection vérifiable. Aucune donnée personnelle.

### Où vit l'exclusion

Dans `cms_content_overrides`, `section_key = 'featured_profile'`, `override_kind = 'exclude'`,
bornée par `starts_at` / `ends_at`. **Pas** dans une colonne de `ise_profiles` : une exclusion est
un acte éditorial daté, attribuable et réversible, pas un attribut permanent d'une personne.
Décision **D-122**.

---

## 3. Éligibilité (§17)

`private.featured_profile_eligible(profile_id, date)` exige **toutes** ces conditions :

```
deleted_at is null
and profile_status = 'active'
and allow_public_feature                       -- consentement explicite, faux par défaut
and public_summary is not null                 -- 40 à 400 caractères, public-safe
and not is_test_account                        -- un compte de test ne paraît jamais publiquement
and (claim_status = 'claimed'          si require_claimed_profile)
and (promotion_id is not null          si require_promotion)
and (avatar_path is not null           si require_avatar)
and (current_position is not null
     or au moins un profile_expertise_areas    si require_expertise_or_position)
and aucun report `open` ou `reviewing` visant ce profil
and aucune suspension de modération en cours
and aucun override `exclude` actif sur ce profil
```

La **fenêtre de rotation** n'est pas dans ce prédicat : elle filtre le vivier au moment de la
sélection automatique, mais n'empêche pas un override manuel ni le fallback.

---

## 4. Sélection quotidienne (05:30 UTC)

`private.run_daily_featured_profile(date)` :

1. **Verrou consultatif** sur la journée — deux crons qui se chevauchent ne produisent pas deux
   sélections.
2. **Sortie anticipée** si une ligne `scheduled` ou `published` existe déjà pour la date :
   idempotence.
3. **Override manuel** — un `pin` actif et **éligible** l'emporte, y compris quand l'automatisation
   est suspendue (§22) → `selection_mode = 'manual'`.
4. **Automatisation suspendue** et aucun `pin` → aucune sélection, journalisée
   `cms.featured_profile.skipped`.
5. **Sélection automatique** — vivier = profils éligibles **moins** ceux mis en avant depuis moins
   de `min_days_between_features` jours. Ordre :
   1. promotion la moins récemment mise en avant d'abord (diversité),
   2. puis profil jamais mis en avant, ou le plus anciennement,
   3. puis `extensions.digest(jour || profil_id, 'sha256')` — pseudo-aléatoire **déterministe**,
      semé par la date.
      Le point 3 rend la sélection rejouable à l'identique, donc vérifiable.
6. **Fallback** (§21) — si le vivier est vide : le dernier profil publié **encore éligible
   aujourd'hui** → `selection_mode = 'fallback'`.
7. **Rien** — aucune ligne créée, journalisation `cms.featured_profile.no_candidate`. Le bloc est
   masqué côté public. La landing n'est jamais cassée, et aucun profil incomplet n'est affiché par
   défaut (CDC §19).

La ligne est créée en `scheduled`. La publication est un **second acte** (06:00 UTC), qui revérifie
l'éligibilité : un profil suspendu entre 05:30 et 06:00 n'est pas publié.

---

## 5. Override, exclusion, suspension (§22)

Trois fonctions, toutes exigeant `cms.featured_profile.manage` et toutes **auditées** via
`private.log_audit()` :

| Fonction                                                                   | Effet                                    | Garde-fou                                                                                                                                     |
| -------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `public.override_featured_profile(profile_id, starts_at, ends_at, reason)` | épingle un profil sur une période bornée | **refuse un profil non éligible** (`profile_not_eligible`) : l'override ne contourne pas le consentement · période validée (`invalid_period`) |
| `public.exclude_profile_from_featured(profile_id, until, reason)`          | exclut temporairement                    | période validée                                                                                                                               |
| `public.set_featured_profile_automation(enabled, reason)`                  | suspend / reprend                        | la **reprise clôt les épinglages en cours**, sinon le système resterait bloqué sur le dernier override (§43)                                  |

Journal : `cms.featured_profile.override`, `.exclude`, `.automation_suspended`,
`.automation_resumed`, `.selected`, `.published`.

---

## 6. Le teaser public (§44, CDC §14)

`public.get_landing_featured_profile()` compose le teaser **depuis `ise_profiles`**. Onze clés,
exactement :

```
entity_type · profile_id · display_name · promotion {id, name, graduation_year}
current_position · organization · public_summary · avatar_path
expertise_areas [{id, name, slug}] · featured_date · selection_mode
```

**Jamais** : e-mail, téléphone, adresse, date de naissance, `bio`, `headline`,
`profile_completion`, LinkedIn, disponibilité, messagerie, note administrative.

Le cas de test **G12** compare l'ensemble des clés à cette liste, à l'identique. Le cas **G13**
échoue si la charge utile contient `@ise.test`, `email`, `phone`, `telephone`,
`profile_completion`, `birth`, `bio` ou `headline`. Ajouter un champ au teaser fait donc échouer la
CI tant que la liste n'est pas mise à jour **sciemment**.

Cascade de repli à la lecture : sélection publiée du jour → dernière sélection publiée encore
éligible → `NULL` (bloc masqué). Jamais d'erreur.

---

## 7. Couverture de test (`supabase/tests/rls/0021_cms_suite.sql`)

| Cas       | Vérifie                                                                             |
| --------- | ----------------------------------------------------------------------------------- |
| G00       | une sélection a bien lieu quand le vivier est non vide                              |
| G01       | un compte marqué `is_test_account` n'est **jamais** sélectionné                     |
| G02       | un profil sans `allow_public_feature` n'est jamais sélectionné                      |
| G03       | un profil sans `public_summary` n'est jamais sélectionné                            |
| G04       | un profil sous modération active (report `open`) n'est jamais sélectionné           |
| G05       | l'historique empêche une re-sélection à 10 jours (règle 90 jours)                   |
| G06       | le profil retenu appartient bien au vivier éligible                                 |
| G07, G08  | double exécution du cron = une seule ligne, `created = false`                       |
| G09, G10  | publication idempotente                                                             |
| G11 – G14 | teaser présent, **exactement 11 clés**, aucune donnée privée, résumé public présent |
| G15, G16  | l'override manuel est pris en compte, `selection_mode = 'manual'`                   |
| G17       | forcer un profil non éligible est refusé (`profile_not_eligible`)                   |
| G18       | la reprise clôt les épinglages                                                      |
| G19, G20  | l'automatisation reprend et ne resélectionne pas le profil épinglé                  |
| G21       | l'automatisation suspendue ne sélectionne pas                                       |

---

## 8. Écart assumé sur D-104 dans le harnais

`featured_profile_eligible()` exclut volontairement les comptes `is_test_account` : un compte de
test ne doit jamais paraître sur le web ouvert. Les profils candidats de la suite `0021` sont donc
créés avec `is_test_account = false` — leurs comptes Auth restent préfixés `test+`, et le
`ROLLBACK` final garantit qu'aucune ligne ne subsiste. Le cas G01 vérifie par ailleurs qu'un profil
_marqué_ compte de test n'est jamais sélectionné. Décision **D-130**.
