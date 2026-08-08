# Contrôle d'intégrité des migrations

Ce document décrit le contrôle qui vérifie que les fichiers de
`supabase/migrations/*.sql` correspondent réellement au SQL appliqué sur le projet
Supabase, et consigne le verdict du dernier contrôle.

---

## Verdict du 8 août 2026 — contrôle rejoué sur les **74** migrations

> Les passes antérieures consignées plus bas ne portaient chacune que sur la tranche du moment
> (26 migrations, puis `0029`, puis `0035`/`0036`, puis `0039`/`0040`, puis `0057` → `0066`).
> Le présent contrôle porte sur **l'intégralité** du dossier. Il contredit la phrase
> « toutes appliquées et vérifiées identiques » qui figurait ailleurs dans la documentation.

**Appariement dépôt ↔ base : parfait.**

| Contrôle                                        | Résultat                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| Fichiers `supabase/migrations/*.sql`            | 74                                                                   |
| Entrées `supabase_migrations.schema_migrations` | 74                                                                   |
| Fichier sans entrée en base                     | **0**                                                                |
| Entrée en base sans fichier                     | **0**                                                                |
| Numéros de fichier en double                    | **0**                                                                |
| Numéro manquant                                 | **`0069`** — jamais attribué, ni fichier ni entrée                   |
| Entrée enregistrée sans préfixe numérique       | **1** — `cms_backoffice_api` (fichier `0067_cms_backoffice_api.sql`) |

**Équivalence du SQL : 54 conformes, 20 divergentes.**

| Niveau de normalisation                                                   | Conformes   |
| ------------------------------------------------------------------------- | ----------- |
| N1 — méthode historique (commentaires pleins retirés, espaces normalisés) | 47 / 74     |
| N2 — N1 + littéraux adjacents recollés (`'a' 'b'` → `'ab'`)               | 50 / 74     |
| N3 — N2 + espacement autour de `( ) , ;` neutralisé                       | **54 / 74** |

Le verdict retenu est **N3**, le plus indulgent : il neutralise tout ce qui relève de la mise en
forme. Les 20 migrations qui divergent encore à ce niveau divergent donc par leur **contenu**.

### Les 20 migrations divergentes (niveau N3)

`0030_search_engine` · `0031_matching_engine` · `0032_profile_completion` ·
`0033_search_matching_performance` · `0034_matching_set_based` ·
`0036_member_profile_and_saved_searches` · `0038_get_member_profile_field_list_fix` ·
`0040_rls_network_calls` · `0042_rls_internships` · `0043_rls_mentorship` ·
`0045_rls_projects_consortiums` · `0046_rls_news_events` · `0049_rls_support_moderation` ·
`0056_opportunities_api` · `0067_cms_backoffice_api` · `0070_promotions_api` ·
`0072_communities_api` · `0073_projects_api` · `0074_news_events_api` · `0075_mentorship_api`.

Quatre autres (`0027_storage_buckets`, `0041_rls_opportunities_applications`,
`0044_rls_communities`, `0047_rls_messaging`) ne divergeaient qu'en N1/N2 : leur écart est
purement typographique et il est accepté.

### Nature des écarts — trois sondages détaillés

Le premier point de divergence a été localisé par comparaison de blocs de 300 caractères.

| Migration                     | Dépôt                                                              | Base                                                      | Portée                 |
| ----------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------- | ---------------------- |
| `0032_profile_completion`     | `comment on column … is '… Recalibrable par le back-office …'`     | `'… Recalibrable sans migration (D-71) …'`                | Libellé de commentaire |
| `0043_rls_mentorship`         | `execute format('grant update(dismissed_at) …', …)`                | `execute 'grant update(dismissed_at) … to authenticated'` | Code équivalent        |
| `0049_rls_support_moderation` | `comment on function … 'elles s''executent avec current_user = …'` | `'… s''executent donc avec current_user = …'`             | Libellé de commentaire |

**Verdict honnête.** Aucun des écarts sondés ne change la structure du schéma, les politiques RLS
ni le comportement des fonctions. Mais ils établissent un fait : **des fichiers déjà appliqués ont
été édités après coup**, ce que le README du dossier interdit explicitement (« aucun fichier de ce
dossier ne doit jamais être modifié après son application »). Le dépôt n'est donc plus, à la
lettre, le reflet de ce qui a été exécuté. Trois conséquences pratiques :

1. Une base reconstruite à partir du dépôt n'aura **pas** exactement les mêmes commentaires
   d'objet que la base actuelle.
2. Le contrôle d'intégrité ne peut plus servir de détecteur de dérive tant que ces 20 écarts
   subsistent : ils masqueraient un vrai écart s'il survenait.
3. La régularisation ne doit **pas** se faire en éditant encore les fichiers, mais en décidant
   explicitement quelle version fait foi, et — si c'est le dépôt — en posant une migration
   corrective qui réaligne les `comment on` concernés.

Les 20 divergences sont donc **ouvertes**, pas refermées.

### Méthode reproductible

Côté base :

```sql
select name,
       md5(regexp_replace(
             replace(btrim(regexp_replace(regexp_replace(
                 array_to_string(statements, E'\n'),
                 '^[ \t]*--[^\n]*$', '', 'gn'),
               '[ \t\r\n]+', ' ', 'g')), ''' ''', ''),
             ' ?([(),;]) ?', '\1', 'g')) as h
from supabase_migrations.schema_migrations
order by name;
```

Côté dépôt, la même transformation appliquée au contenu de chaque `*.sql`, puis comparaison des
empreintes en appariant `0067_cms_backoffice_api.sql` ↔ `cms_backoffice_api`.

---

## 1. Méthode

Le SQL réellement appliqué est conservé par Supabase dans
`supabase_migrations.schema_migrations` (colonne `statements`, tableau de textes ;
colonne `name` = nom du fichier sans le suffixe `.sql`).

Comparer octet à octet n'a pas de sens : le SQL stocké en base est la forme
condensée envoyée par `apply_migration`, alors que les fichiers du dépôt portent
volontairement les bandeaux d'en-tête et les commentaires de traçabilité
(MASTER PROMPT, décisions `D-xx`, renvois aux documents source). Ces écarts sont
**rédactionnels** et sont acceptés.

Ce qui doit être identique, c'est l'**équivalence exécutable**. Le contrôle
compare donc une **forme canonique** des deux côtés :

1. suppression des lignes de commentaire pleines (`^\s*--.*$`) ;
2. réduction de toute suite d'espaces, tabulations, `\r` et sauts de ligne à une
   espace unique (neutralise l'indentation, l'alignement des alias et les fins de
   ligne CRLF/LF) ;
3. `trim` puis empreinte `md5`.

Une migration est **conforme** si les deux empreintes coïncident.

> Limite connue et assumée : la normalisation supprime les commentaires en début
> de ligne, pas les commentaires `--` en fin de ligne de code. Aucune migration
> du dépôt n'en contient à ce jour. Elle ne réécrit pas non plus les littéraux
> chaîne, donc **toute différence de contenu de données reste détectée** — c'est
> exactement ce qui a permis de trouver l'écart de `0024`.

---

## Annexe A — passes historiques

### A.1 Verdict par migration (26 premières, passe initiale)

| Migration                                | Verdict                  |
| ---------------------------------------- | ------------------------ |
| `0001_foundation`                        | conforme                 |
| `0002_reference_data`                    | conforme                 |
| `0003_identity_core`                     | conforme                 |
| `0004_rbac_and_helpers`                  | conforme                 |
| `0005_profile_content`                   | conforme                 |
| `0006_network_connections_introductions` | conforme                 |
| `0007_network_calls`                     | conforme                 |
| `0008_opportunities`                     | conforme                 |
| `0009_internships`                       | conforme                 |
| `0010_mentorship`                        | conforme                 |
| `0011_communities`                       | conforme                 |
| `0012_projects`                          | conforme                 |
| `0013_news_events`                       | conforme                 |
| `0014_messaging`                         | conforme                 |
| `0015_notifications`                     | conforme                 |
| `0016_support_moderation`                | conforme                 |
| `0017_imports_data_quality`              | **cosmétique** — voir §3 |
| `0018_platform_audit_events`             | conforme                 |
| `0019_analytics_impact`                  | conforme                 |
| `0020_security_baseline_rls`             | conforme                 |
| `0021_rls_identity_profile_network`      | conforme                 |
| `0022_seed_geography_languages`          | conforme                 |
| `0023_seed_taxonomy_skills`              | conforme                 |
| `0024_seed_taxonomy_business`            | **corrigée** — voir §4   |
| `0025_seed_profile_rules`                | conforme                 |
| `0026_security_baseline_reassert`        | conforme                 |

Après correction : **26 / 26 empreintes identiques**.

---

## 2.2 Contrôle complémentaire du 8 août 2026 — `0029_profile_claim`

| Migration            | Empreinte dépôt                    | Empreinte base                     | Verdict      |
| -------------------- | ---------------------------------- | ---------------------------------- | ------------ |
| `0029_profile_claim` | `a8f737dc96bf46ba51303f2abd717a3e` | `a8f737dc96bf46ba51303f2abd717a3e` | **conforme** |

Deux points relevés à cette occasion, à traiter par le propriétaire des lots
concernés — ils ne sont **pas** imputables à `0029` :

1. **Deux migrations sont enregistrées sans leur préfixe numérique** :
   `supabase_migrations.schema_migrations` contient `storage_buckets` et
   `rls_fixes` là où le dépôt porte `0027_storage_buckets.sql` et
   `0028_rls_fixes.sql`. Le script de §6 les signalera comme `MANQUANT` puis
   `NON APPLIQUÉ` : ce sont des **faux positifs de nommage**, mais ils rendent
   le contrôle rouge tant qu'ils ne sont pas régularisés.
2. **Trois migrations appliquées sont absentes du dépôt** :
   `0030_search_engine`, `0031_matching_engine` et `0032_profile_completion`
   existent dans `schema_migrations` (versions `20260808043608`,
   `20260808043942`, `20260808044143`) sans fichier correspondant dans
   `supabase/migrations/`. La règle du MASTER PROMPT §77 impose que le dépôt
   soit la source de vérité : ces trois fichiers doivent y être ajoutés.

Aucune des trois ne touche `profile_claims` ni les fonctions de `0029` ; la
suite `0002_claim_suite.sql` a été rejouée après leur application et reste à
`CLAIM_TESTS_OK: 29 cas, 0 echec`.

### 2.1 Écarts purement rédactionnels

Douze fichiers présentent, en comparaison brute, un écart limité aux bandeaux
d'en-tête et aux commentaires de traçabilité. Arbitrage retenu : **accepté, aucune
action**. Le dépôt est la source documentée, la base ne stocke que l'exécutable.

---

## 2.3 Contrôle du 8 août 2026 — `0035_rls_profile_sections` et `0036_education_fields`

Livrées avec l'onboarding (ISE-008 → ISE-014) et le profil membre
(ISE-016 → ISE-023).

| Migration                   | Empreinte dépôt                    | Empreinte base                     | Verdict      |
| --------------------------- | ---------------------------------- | ---------------------------------- | ------------ |
| `0035_rls_profile_sections` | `2899b4c7fb6f053988fbfd75b69fe93d` | `2899b4c7fb6f053988fbfd75b69fe93d` | **conforme** |
| `0036_education_fields`     | `042b6cf1d1ac2fdaa27d4fa3c836070b` | `042b6cf1d1ac2fdaa27d4fa3c836070b` | **conforme** |

Première passe **divergente** : les fichiers du dépôt écrivaient certains
`comment on … is` en littéraux adjacents concaténés
(`'début… ' 'suite…'`), là où la migration appliquée portait un littéral
unique. La normalisation supprime les commentaires SQL, pas le contenu des
**chaînes** : l'écart était donc réel, et détecté. Les fichiers ont été
réécrits pour refléter l'appliqué (arbitrage « SQL présent en base et absent
du fichier », §6). `0036` a en outre récupéré le bloc de contrôle
`security_baseline_violations()` qui n'existait que dans la version appliquée.

### Collision de numérotation à signaler

Deux lots ont été développés en parallèle sur la même base. Le dépôt contient
donc **deux `0035_*` et deux `0036_*`** :

| Fichier                                      | Version appliquée     | Lot                 |
| -------------------------------------------- | --------------------- | ------------------- |
| `0035_rls_profile_sections.sql`              | `20260808052700`      | onboarding / profil |
| `0035_member_profile_and_saved_searches.sql` | `20260808052719`      | recherche / réseau  |
| `0036_education_fields.sql`                  | `20260808052900`      | onboarding / profil |
| `0036_get_member_profile_field_list_fix.sql` | _(cf. lot recherche)_ | recherche / réseau  |

Le contrôle d'intégrité **n'est pas affecté** : il apparie dépôt et base par
le `name` de `supabase_migrations.schema_migrations`, qui reste unique. Seul
l'ordre de lecture alphabétique du répertoire ne reflète plus l'ordre
d'application. Renuméroter suppose de renommer aussi l'entrée du registre :
à faire en une seule passe, une fois les deux lots stabilisés.

---

## 2.4 Contrôle du 8 août 2026 — `0039` et `0040` (relations & introductions)

Même méthode qu'en §1 : forme canonique (commentaires pleins retirés, espaces
normalisés), empreinte `md5` des deux côtés.

| Migration                              | Empreinte dépôt                    | Empreinte base                     | Verdict      |
| -------------------------------------- | ---------------------------------- | ---------------------------------- | ------------ |
| `0039_network_relations_introductions` | `06eaf6f6c95aaf89dfbe485548f12ef2` | `06eaf6f6c95aaf89dfbe485548f12ef2` | **conforme** |
| `0040_introduction_event_type_fix`     | `fb40e2f7a046007ab9544e8fae6e16c2` | `fb40e2f7a046007ab9544e8fae6e16c2` | **conforme** |

Un premier passage avait relevé une divergence sur `0039` : le fichier du dépôt
écrivait `select pg.*` là où la version appliquée énumérait les colonnes de la
CTE `cards` de `list_connection_requests()`. C'est exactement ce que la
normalisation **ne** doit pas absorber : un `select *` et une liste explicite
n'ont pas la même stabilité face à un ajout de colonne. Le fichier a été aligné
sur l'appliqué (§6, dernier cas d'arbitrage), pas l'inverse.

---

## 3. `0017_imports_data_quality` — cosmétique, aucune action

Signalé en première passe comme divergent « sur du SQL exécutable ». Le contrôle
canonique montre que c'est un **faux positif**.

L'écart se situe dans la vue `private.import_batch_progress` et porte uniquement
sur le **nombre d'espaces d'alignement** avant les alias de colonnes :

```
-- dépôt
  b.id                                                              as batch_id,
  max(r.processed_at)                                               as last_processed_at
-- appliqué
  b.id                                                                 as batch_id,
  max(r.processed_at)                                                  as last_processed_at
```

Aucune conséquence : l'ordre, le nom et l'expression des colonnes sont identiques.
Empreinte canonique dépôt = empreinte canonique base
(`4941ab91d001b9ef8f27c2ecd35d4879`).

**Décision : rien à faire.** Ni nouvelle migration, ni réécriture du fichier. La
migration `0027_fix_imports_drift.sql` envisagée n'a **pas** lieu d'être.

---

## 4. `0024_seed_taxonomy_business` — fichier corrigé

Écart réel sur une donnée seedée, et un seul : la description du type de
disponibilité `partnership`.

```diff
-  ('partnership', 'Partenariat', 'Ouvert a un partenariat professionnel ou institutionnel.', 130),
+  ('partnership', 'Partenariat', 'Ouvert à un partenariat professionnel ou institutionnel.', 130),
```

Le reste du fichier (35 secteurs, 7 rattachements parents, 56 couples
d'adjacences, 36 fonctions, 14 domaines d'expertise, 44 outils, 14 types de
disponibilité, 9 motifs de signalement, promotions 1960→2031) est identique au
SQL appliqué, à l'espacement et aux commentaires près.

**Sens de l'écart : le fichier était en retard.** La base porte la forme accentuée
« Ouvert **à** un partenariat », qui est la bonne :

- elle est cohérente avec les treize autres descriptions du même `insert`, toutes
  accentuées (« Ouvert à une opportunité d'emploi salarié. ») ;
- `docs/db-conventions.md` §5 impose le français pour les libellés utilisateur,
  et `0024` applique déjà cette règle aux motifs de signalement (« Les 9 motifs
  ont été créés en 0016 avec des libellés non accentués. Mise en conformité… ») ;
- la valeur en base est déjà la bonne :
  `public.availability_types.description` pour `partnership` vaut
  « Ouvert à un partenariat professionnel ou institutionnel. ».

**Décision : réécriture du fichier** `supabase/migrations/0024_seed_taxonomy_business.sql`
pour refléter fidèlement l'appliqué. Aucune migration corrective n'est créée :
la migration `0028_fix_taxonomy_drift.sql` envisagée n'a **pas** lieu d'être,
la base n'ayant rien à rattraper. Conformément au MASTER PROMPT §77, cette
réécriture ne modifie **aucun effet exécutable** de la migration déjà appliquée —
c'est un alignement du dépôt sur la réalité, pas une réédition de son
comportement.

---

## 5. Vérifications d'état

Toutes exécutées après correction, résultats attendus obtenus.

| Contrôle                                   | Attendu                   | Constaté |
| ------------------------------------------ | ------------------------- | -------- |
| `private.security_baseline_violations()`   | 0 ligne                   | **0**    |
| `public.sectors`                           | 35                        | 35       |
| `public.sectors` avec `parent_id`          | 7                         | 7        |
| `public.sector_adjacencies`                | 112 (56 couples × 2 sens) | 112      |
| `public.job_functions`                     | 36                        | 36       |
| `public.expertise_areas`                   | 14                        | 14       |
| `public.tools`                             | 44                        | 44       |
| `public.availability_types`                | 14 (D-65)                 | 14       |
| `public.report_reasons`                    | 9 (D-66)                  | 9        |
| `public.promotions` `program_code = 'ISE'` | 72 (1960→2031)            | 72       |

---

## 6. Commande de vérification à rejouer en CI

Le contrôle est rejouable tel quel. Il suppose `DATABASE_URL` pointant sur la base
à auditer (connexion directe, pas le pooler en mode transaction), `psql` et
`md5sum` disponibles.

```bash
#!/usr/bin/env bash
# Intégrité des migrations : fichiers du dépôt == SQL appliqué.
# Sort en échec (1) dès qu'une migration diverge sur du SQL exécutable.
set -euo pipefail

MIGRATIONS_DIR="supabase/migrations"

canon_file() {
  sed -E 's/^[[:space:]]*--.*$//' "$1" \
    | tr -s ' \t\r\n' ' ' \
    | sed -E 's/^ //; s/ $//' \
    | md5sum | cut -d' ' -f1
}

# Empreintes canoniques du SQL réellement appliqué.
psql "$DATABASE_URL" -At -F'|' -c "
  select name,
         md5(btrim(regexp_replace(regexp_replace(
           array_to_string(statements, E'\n'),
           '(?m)^[ \t]*--.*\$', '', 'g'),
           '[ \t\r\n]+', ' ', 'g'), ' '))
  from supabase_migrations.schema_migrations
  order by name;" > /tmp/applied.txt

status=0
while IFS='|' read -r name applied_hash; do
  file="$MIGRATIONS_DIR/$name.sql"
  if [[ ! -f "$file" ]]; then
    echo "MANQUANT  $name  (appliqué en base, absent du dépôt)"; status=1; continue
  fi
  file_hash="$(canon_file "$file")"
  if [[ "$file_hash" != "$applied_hash" ]]; then
    echo "DIVERGENT $name  depot=$file_hash  base=$applied_hash"; status=1
  else
    echo "ok        $name"
  fi
done < /tmp/applied.txt

# Migrations présentes dans le dépôt mais jamais appliquées.
for f in "$MIGRATIONS_DIR"/*.sql; do
  n="$(basename "$f" .sql)"
  grep -q "^$n|" /tmp/applied.txt || { echo "NON APPLIQUÉ $n"; status=1; }
done

# Base de sécurité : doit toujours renvoyer 0 ligne.
violations="$(psql "$DATABASE_URL" -At -c \
  'select count(*) from private.security_baseline_violations();')"
if [[ "$violations" != "0" ]]; then
  echo "BASELINE  $violations violation(s) de sécurité"; status=1
fi

exit "$status"
```

En cas de `DIVERGENT`, appliquer l'arbitrage documenté ici :

- écart limité aux commentaires ou à l'indentation → la normalisation l'aurait
  absorbé ; si l'empreinte diverge quand même, c'est un écart **exécutable** ;
- SQL présent dans le fichier mais jamais appliqué → **nouvelle** migration
  portant le delta, jamais d'édition d'une migration déjà appliquée
  (MASTER PROMPT §77) ;
- SQL présent en base et absent du fichier → réécrire le fichier pour refléter
  l'appliqué.
