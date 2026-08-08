# Automatisations du CMS et du site public

Migrations `0059`, `0060`, `0064`, `0065`. Sources : `ADDENDUM` §20, §27, §40, §42, §43, §57 ·
CDC additionnel §35, §37, §38.

---

## 1. État réel de la planification

**`pg_cron` 1.6.4 est installé sur ce projet Supabase et les quatre tâches sont planifiées.**
Ce n'est pas une intention : `select * from cron.job` les renvoie.

| Tâche `cron.job`               | Cadence (UTC)  | Commande                                         |
| ------------------------------ | -------------- | ------------------------------------------------ |
| `cms_expire_content`           | `*/10 * * * *` | `select private.expire_cms_content()`            |
| `cms_publish_scheduled`        | `*/10 * * * *` | `select private.publish_scheduled_cms_content()` |
| `cms_select_featured_profile`  | `30 5 * * *`   | `select private.run_daily_featured_profile()`    |
| `cms_publish_featured_profile` | `0 6 * * *`    | `select private.publish_featured_profile()`      |

Les jobs tournent dans la base `postgres` sous le rôle `postgres`, qui possède les fonctions
`SECURITY DEFINER` appelées.

### Incident de mise en place, consigné

`0059` créait bien l'extension mais gardait la planification derrière
`to_regproc('cron.schedule(text,text,text)') is null`. **`to_regproc` n'accepte pas de liste
d'arguments** : l'expression rend `NULL`, le bloc sortait avant de planifier, et `cron.job` restait
vide. Constaté après application, corrigé par `0060` avec `to_regprocedure`. L'en-tête de `0059`
porte ce constat ; on ne prétend jamais qu'une tâche tourne alors qu'elle n'est pas planifiée.

### Si `pg_cron` disparaît (restauration, autre projet)

`0060` émet un `WARNING` et n'échoue pas. Le point d'appel unique reste :

```sql
select public.run_cms_automations();
```

Idempotent, il enchaîne les quatre traitements et renvoie un rapport JSON. Deux voies de secours :

- **Supabase Scheduled Function** — une Edge Function appelant le RPC avec la clé `service_role`,
  planifiée toutes les 10 minutes ;
- **cron externe** — `curl -X POST "$SUPABASE_URL/rest/v1/rpc/run_cms_automations"` avec l'en-tête
  `Authorization: Bearer $SERVICE_ROLE_KEY`.

`run_cms_automations()` exige `ops.manage` pour un appelant authentifié, ou l'identité
`service_role` / `postgres` pour un ordonnanceur. `anon` ne l'atteint pas.

---

## 2. Les quatre traitements

### 2.1 `private.expire_cms_content()` — expiration automatique (§27)

À `end_at` : `published` → `expired`, `published_snapshot` vidé, `expired_at` posé.

Porte sur : campagnes partenaires échues · slides de carrousel échues · **slides sponsorisées dont
la campagne n'est plus publiée** (§26 : pas de mention, pas de diffusion) · suppression des
overrides éditoriaux arrivés à échéance, ce qui fait revenir la source automatique d'elle-même
(§43).

**Aucune intervention humaine.** Idempotente : la clause `status = 'published'` rend la seconde
exécution sans effet (cas F03 : le second passage renvoie `campaigns_expired = 0`).

### 2.2 `private.publish_scheduled_cms_content()` — programmation (§40)

Traite les ordres `cms_publication_schedule` échus, en `for update skip locked`.

**Frontière assumée** — décision **D-128** :

| `entity_type`                                              | Effet de `publish_at`                    | Effet de `unpublish_at`             |
| ---------------------------------------------------------- | ---------------------------------------- | ----------------------------------- |
| `cms_carousel_item`, `cms_partner_campaign`, `cms_section` | fige le snapshot, `status = 'published'` | `status = 'expired'`, snapshot vidé |
| `news`, `event`, `opportunity`                             | `landing_visibility = 'visible'`         | `landing_visibility = 'hidden'`     |

Le CMS orchestre **l'exposition sur la landing**. Il ne se substitue ni au circuit éditorial du
module Actualités (`content.publish`, `editorial_status`) ni au cycle de vie métier d'une offre.
Un ordre portant _à la fois_ `publish_at` et `unpublish_at` reste `pending` après publication : il
sera repris à la date de fin.

Observabilité : `run_count`, `last_run_at`, `last_error`, `applied_at` par ordre. Un ordre en échec
passe `failed` avec `SQLSTATE + message`, reste consultable dans CMS-009 et peut être rejoué.

### 2.3 `private.run_daily_featured_profile()` — sélection (§20)

05:30 UTC. Détail complet dans `docs/featured-profile.md`. Crée une ligne d'historique en
`scheduled`.

### 2.4 `private.publish_featured_profile()` — publication (§20)

06:00 UTC. `scheduled` → `published`, **si le profil est toujours éligible au moment de publier**.
Entre les deux actes, le CMS peut relire, corriger ou remplacer la sélection.

---

## 3. Les trois propriétés exigées (§20)

### Idempotent

| Traitement    | Mécanisme                                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| expiration    | prédicat `status = 'published'` ; un second passage ne trouve plus rien                                                       |
| programmation | `status = 'pending'` + `for update skip locked`                                                                               |
| sélection     | `pg_advisory_xact_lock` sur la journée + index unique partiel sur `featured_date` + sortie anticipée si une ligne existe déjà |
| publication   | prédicat `status = 'scheduled'`                                                                                               |

Testé : cas F03, G07, G08, G10 de `supabase/tests/rls/0021_cms_suite.sql`.

### Observable

- `private.log_audit()` à chaque exécution, avec le décompte de ce qui a été fait :
  `cms.scheduler.expire`, `cms.scheduler.publish`, `cms.featured_profile.selected`,
  `cms.featured_profile.published`, `cms.featured_profile.skipped`,
  `cms.featured_profile.no_candidate` ;
- `cms_publication_schedule.run_count` / `last_error` par ordre ;
- `cms_featured_profile_history.selection_context` : taille du vivier, dimension d'équilibrage,
  fenêtre de rotation appliquée ;
- `public.get_cms_automation_status()` (permission `cms.read` ou `ops.read`) renvoie, pour chaque
  tâche, sa cadence, son activité, sa **dernière exécution réelle** et son résultat, lus dans
  `cron.job` et `cron.job_run_details`. Aucune tâche n'est déclarée « qui tourne » sans preuve.

### Rejouable

Toutes les fonctions acceptent une date explicite ou n'ont aucun paramètre d'état. Rejouer une
journée :

```sql
select private.run_daily_featured_profile('2026-08-07');
select private.publish_featured_profile('2026-08-07');
```

La sélection automatique est **déterministe** : l'ordre de départage est
`extensions.digest(jour || profil_id, 'sha256')`. Rejouer la même journée sur le même vivier
redonne le même profil. C'est ce qui la rend vérifiable.

---

## 4. Défauts trouvés par le harnais et corrigés

Aucun test n'a été affaibli pour passer.

| #   | Migration | Défaut                                                                                                                                                                                                                                                                                                                                      | Correctif                                                                                                                                                                                              |
| --- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | `0064`    | Une sélection **manuelle** exécutée par le cron journalisait `actor_kind = 'user'` avec un acteur `NULL` (hors session, `auth.uid()` est nul) → violation de `audit_log_actor_required`. La tâche quotidienne aurait échoué **le jour même où un override éditorial était actif**, c'est-à-dire précisément quand le CMS reprenait la main. | L'acteur est l'auteur de l'override (`cms_content_overrides.created_by_profile_id`), déjà lu par la fonction. Sans auteur identifié : `actor_kind = 'system'`. On n'invente jamais un acteur. Cas G15. |
| A2  | `0065`    | `set_featured_profile_automation(true)` clôturait les épinglages par `ends_at = now()`. `now()` étant l'heure de **début de transaction**, un épinglage créé dans la même seconde obtenait `ends_at = starts_at` → violation de `cms_content_overrides_period`, remontée en erreur technique brute (contraire à D-102).                     | `ends_at = greatest(now(), starts_at + 1 ms)`. Les deux fonctions d'override valident aussi leur période en amont et lèvent `invalid_period` (P0001). Cas G18.                                         |
| A3  | `0066`    | Le garde-fou anti-régression de `0062` (`ALTER DEFAULT PRIVILEGES … REVOKE` seul) n'avait créé **aucune** entrée `pg_default_acl` pour `private` : la première fonction créée ensuite y naissait avec `proacl = NULL`, donc `EXECUTE` pour `PUBLIC`, donc pour `anon`.                                                                      | `GRANT` explicite d'abord, puis `REVOKE`. La migration **vérifie son propre effet** et échoue si l'entrée n'est pas conforme. Cas J01.                                                                 |

---

## 5. Rejouer le harnais

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=0 -f supabase/tests/rls/0021_cms_suite.sql
```

Sortie attendue :

```
ERROR:  P0001: CMS_TESTS_OK: 60 cas, 0 echec
```

L'exception **est** le mécanisme de rollback. La CI doit chercher `CMS_TESTS_OK:` **et**
`0 echec`, et échouer sur l'absence de l'un des deux.
