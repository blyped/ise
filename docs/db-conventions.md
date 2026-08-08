# Conventions base de données — Compétences ISE

Ce document est **normatif**. Toute migration doit s'y conformer.
Il complète `docs/decisions.md` (arbitrages) et `docs/data-model.md` (contenu).

## 1. Migrations

- Fichiers `supabase/migrations/NNNN_nom_snake_case.sql`, numérotation à 4 chiffres, jamais réutilisée.
- Une migration est **rejouable** : `create table if not exists`, `create index if not exists`,
  `create or replace function`, `insert … on conflict do nothing`.
- **Aucune** modification manuelle de la base hors migration (MASTER PROMPT §77).
- Aucun `DROP` destructif sans entrée dédiée dans `docs/decisions.md`.

## 2. Schémas

| Schéma      | Contenu                                                                             | Exposé à la Data API                 |
| ----------- | ----------------------------------------------------------------------------------- | ------------------------------------ |
| `public`    | Données métier                                                                      | Oui, **RLS active sur chaque table** |
| `private`   | RBAC, coordonnées sensibles, imports bruts, notes admin, audit, compteurs anti-abus | Non                                  |
| `analytics` | Agrégats, vues matérialisées                                                        | Non                                  |

## 3. Colonnes standard

```sql
id          uuid primary key default extensions.gen_random_uuid()   -- entités métier
id          bigint generated always as identity primary key          -- tables de référence
created_at  timestamptz not null default now()
updated_at  timestamptz not null default now()   -- + select private.attach_updated_at('public','ma_table');
created_by  uuid references public.ise_profiles(id) on delete set null   -- si l'auteur compte
deleted_at  timestamptz                                              -- soft delete des entités sensibles
```

- **Jamais** `timestamp` sans fuseau. Toujours `timestamptz` (MASTER PROMPT §67).
- Le rattachement métier se fait **toujours** sur `profile_id` → `public.ise_profiles(id)`,
  jamais sur `auth.users(id)` (décision **D-10**). Seule exception : `ise_profiles.user_id`
  et `profile_claims.claimant_user_id`.

## 4. Énumérations

Décision **D-13** : `text` + contrainte `CHECK`, **pas** de type `ENUM` PostgreSQL.

```sql
status text not null default 'draft'
  check (status in ('draft', 'published', 'closed', 'archived'))
```

Les taxonomies évolutives (compétences, secteurs, fonctions, langues, pays, types de
disponibilité, motifs de signalement) sont des **tables de référence**, pas des `CHECK`.

## 5. Nommage

| Objet                  | Convention                | Exemple                                  |
| ---------------------- | ------------------------- | ---------------------------------------- |
| Table                  | pluriel, snake_case       | `network_calls`                          |
| Table de liaison       | `<entité>_<entité>`       | `profile_skills`                         |
| FK vers un profil      | `<rôle>_profile_id`       | `author_profile_id`, `target_profile_id` |
| Booléen                | `is_` / `has_`            | `is_primary`, `has_attachments`          |
| Horodatage d'événement | `<verbe au participe>_at` | `published_at`, `closed_at`              |
| Index                  | `<table>_<colonnes>_idx`  | `network_calls_status_idx`               |
| Index unique           | `<table>_<colonnes>_uidx` | `connections_pair_uidx`                  |
| Contrainte             | `<table>_<règle>`         | `experiences_dates_order`                |

Les identifiants SQL sont en **anglais**. Les libellés destinés à l'utilisateur (colonnes `name`,
`label`, contenus seedés) sont en **français**.

## 6. Index

- Toute FK utilisée en jointure, filtre ou politique RLS est indexée (PostgreSQL ne le fait pas).
- Index partiels dès qu'un filtre est quasi systématique : `where deleted_at is null`,
  `where status = 'published'`, `where active`.
- Recherche textuelle : `gin (public.normalize_text(colonne) extensions.gin_trgm_ops)`.
- Pagination par curseur : index composite `(critère_de_tri desc, id desc)` (**D-44**).

## 7. Fonctions

- Fonction métier atomique pour **toute** transition d'état sensible (MASTER PROMPT §53) :
  elle valide acteur → permission → état courant → transition autorisée → unicité, dans une
  transaction, et journalise l'événement.
- `SELECT … FOR UPDATE` sur la ligne pivot avant toute transition (MASTER PROMPT §100).
- Toute fonction `SECURITY DEFINER` déclare `set search_path = ''` et qualifie chaque objet
  (`public.`, `private.`, `extensions.`) — décision **D-101**.
- Codes d'erreur levés : `28000` non authentifié · `42501` non autorisé · `P0002` introuvable ·
  `P0001` transition invalide. Le message est un **code machine** (`invalid_transition`), jamais
  une phrase : la traduction en français se fait côté application (**D-102**).

## 8. Helpers RLS disponibles

Créés en `0004` et `0006`, à réutiliser — **ne jamais les redéfinir** :

```sql
private.current_profile_id()        -- uuid du profil du compte courant, NULL sinon
private.has_role(text)              -- rôle actif
private.has_permission(text)        -- permission effective (seul point d'autorisation)
private.is_admin()                  -- porteur d'au moins un rôle administratif
private.is_active_member()          -- profil réclamé et actif
private.is_connected_to(uuid)       -- relation acceptée avec ce profil
private.shares_promotion_with(uuid) -- même promotion
```

Utilitaires : `public.normalize_text(text)`, `public.slugify(text)`, `public.f_unaccent(text)`,
`public.is_visibility_level(text)`, `public.new_correlation_id()`,
`private.attach_updated_at(schema, table)`.

## 9. RLS

- `alter table … enable row level security;` sur **toutes** les tables `public`.
- Politiques regroupées dans une migration dédiée par lot, pas dispersées.
- Toujours cibler explicitement `to authenticated` (ou `to anon` si réellement voulu).
- Toujours `(select auth.uid())` et non `auth.uid()` : la sous-requête est évaluée une fois
  par requête au lieu d'une fois par ligne.
- Une politique non testée n'est pas terminée (MASTER PROMPT §80).

## 10. Interdits

- Créer un compte `auth.users` pour représenter un profil importé (MASTER PROMPT §6).
- Remplacer une politique RLS par un `if` côté client (MASTER PROMPT §113).
- Exposer `service_role` au navigateur ou à l'application mobile (**D-100**).
- Stocker un token en clair : uniquement son empreinte (`token_hash`).
- Stocker une liste structurée dans un champ texte (MASTER PROMPT §9).
- Utiliser `SECURITY DEFINER` pour contourner RLS (MASTER PROMPT §72).
- Marquer un état non constaté : « candidature envoyée », « introduction réussie » (**D-55**).
