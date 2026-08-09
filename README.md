# COMPÉTENCES ISE

**Une expertise. Un réseau. Un impact.**

Réseau professionnel structuré des Ingénieurs Statisticien Économistes : site public, application
web responsive et application mobile native iOS/Android.

Compétences ISE n'est pas un mini-LinkedIn. Le produit répond à quatre verbes — **connecter,
entraider, collaborer, impacter** — et écarte délibérément les mécaniques de popularité :
pas de followers, pas de likes, pas de score social, pas de classement de personnes.

---

## État du projet

| Phase                           | Périmètre                                                                      | Statut         |
| -------------------------------- | ------------------------------------------------------------------------------ | -------------- |
| 0 — Audit                       | 199 maquettes inventoriées, matrice de traçabilité, ~140 arbitrages tranchés   | ✅ Terminée    |
| 0 — Données                     | 68 migrations · 201 tables `public`, 24 `private`, 4 `analytics` · RLS partout | ✅ Terminée    |
| 1 — Fondations                  | Monorepo, design system, moteur de matching, auth réelle, écrans système, CI   | ✅ Terminée    |
| 2 — Identité                    | Réclamation de profil, onboarding 7 étapes, profil, disponibilité              | ✅ Terminée    |
| 3 — Réseau                      | Recherche, matching, relations, introductions                                  | ✅ Terminée    |
| 4–5 — Valeur & engagement       | Appels, opportunités, messagerie, notifications, paramètres, support           | 🟡 En cours    |
| Site public & CMS               | PUB-001, CMS-001 → CMS-010, ISE du jour, partenaires, automatisations          | ✅ Terminée    |
| 6–7 — Administration & OPS      | Superadmin (SA-001→050 ; import en masse abandonné, décision C-06), supervision (OPS abandonné, décision C-05) | ⬜ Schéma prêt |
| Mobile                          | Expo / React Native                                                            | ⬜ À venir     |
| 8–9 — Durcissement & production | Tests E2E, accessibilité, performance, déploiement                             | ⬜ À venir     |

Détail module par module : [`docs/implementation-status.md`](docs/implementation-status.md).

**101 routes** livrées côté web · **68 migrations** appliquées · **459 politiques RLS** ·
**25 harnais SQL** auto-nettoyants · **411 tests unitaires**.

---

## Démarrage

```bash
# Prérequis : Node 22+, pnpm 9
corepack enable pnpm

pnpm install

cp .env.example apps/web/.env.local   # puis renseigner les variables
pnpm --filter @ise/db-types generate  # types TypeScript depuis le schéma Supabase

pnpm dev                              # http://localhost:3000
```

### Commandes

| Commande            | Effet                                  |
| -------------------- | --------------------------------------- |
| `pnpm dev`          | Serveur de développement               |
| `pnpm build`        | Build de production                    |
| `pnpm typecheck`    | TypeScript strict sur tout le monorepo |
| `pnpm test`         | Tests unitaires (411 cas)              |
| `pnpm format:check` | Contrôle de formatage — bloquant en CI |

Les harnais SQL se rejouent avec `psql "$SUPABASE_DB_URL" -f supabase/tests/rls/<fichier>.sql`.
Chacun crée ses fixtures, exécute ses assertions et **annule toute la transaction** : aucune donnée
de test ne subsiste. Un harnais qui réussit se termine par `…_TESTS_OK: N cas, 0 echec`.

---

## Architecture

```
apps/
  web/                Next.js 16, App Router, React Server Components
  mobile/             Expo + Expo Router                        (à venir)

packages/
  design-tokens/      Palette, typographie, espacement, grille — source unique
  config/             Validation d'environnement, limites et quotas chiffrés
  domain/             Moteur de matching, machines d'états, permissions, erreurs métier
  validation/         Schémas Zod partagés client ↔ serveur
  db-types/           Types TypeScript générés depuis le schéma Supabase
  ui-web/             Bibliothèque de composants React accessibles

supabase/
  migrations/         68 migrations versionnées — source de vérité du schéma
  tests/              25 harnais RLS et recherche, auto-nettoyants
  functions/          Edge Functions

docs/                 Décisions, conventions, traçabilité, RLS, CMS
```

Le web et le mobile partagent les types, les schémas de validation, la logique métier pure,
les permissions et les tokens graphiques. Ils ne partagent **pas** de composants d'interface :
React DOM et React Native restent séparés.

### Backend

PostgreSQL sur Supabase, en quatre schémas :

| Schéma      | Contenu                                                        | Exposé au client                       |
| ------------ | ---------------------------------------------------------------- | ---------------------------------------- |
| `public`    | Données métier                                                 | Oui, **RLS active sur les 201 tables** |
| `private`   | RBAC, coordonnées, imports bruts, notes administratives, audit | Non                                    |
| `analytics` | Agrégats et vues matérialisées                                 | Non                                    |
| `auth`      | Géré par Supabase                                              | —                                       |

RLS est **fermée par défaut** : une table sans politique est totalement inaccessible. Trois tables
le restent volontairement (`domain_events`, `notification_deliveries`, `profile_search_documents`),
consommées par le serveur seul.

Le rôle `anon` n'a **aucun** privilège de table. Le site public passe exclusivement par
**10 fonctions `SECURITY DEFINER` explicitement public-safe** (`get_landing_*`) : un onzième
`GRANT` à `anon` fait échouer la CI.

Deux contrôles doivent toujours renvoyer zéro ligne :

```sql
select * from private.security_baseline_violations();
select * from private.storage_baseline_violations();
```

### Stockage

Neuf buckets. **Un seul est public** : `landing-media`, qui ne contient que des médias éditoriaux
délibérément publiés sur la vitrine. Avatars, documents de profil, pièces jointes, preuves de
vérification et fichiers d'import restent privés — et le contrôle de sécurité échoue si l'un
d'eux devient public.

---

## Principes non négociables

Ces règles ont dicté le schéma et le code ; les enfreindre casse le produit.

1. **Un profil ISE n'est pas un compte.** `ise_profiles.user_id` est nullable : un ISE de
   l'annuaire existe avant d'avoir un compte. Aucun compte `auth.users` n'est jamais créé pour
   représenter une personne importée, dans aucun environnement.
2. **Aucun pourcentage de compatibilité affiché.** Le moteur produit un score interne pour
   classer ; l'interface montre « Très pertinent », « Pertinent », « Profil proche ». Le curseur
   de pagination est chiffré pour que le score ne fuite pas par la porte de derrière.
3. **Toute recommandation est explicable.** Un candidat sans raison factuelle affichable est
   écarté du résultat, quel que soit son score.
4. **Les statuts reflètent des faits.** « Intermédiaire accepté » n'est pas « introduction
   réussie ». Un clic sur un lien sortant n'est pas une candidature : seul le membre déclare
   ce qu'il a réellement fait.
5. **Aucun faux KPI.** Chaque chiffre affiché se calcule depuis une source réelle. Les
   statistiques de la vitrine valent zéro tant que l'annuaire n'est pas importé — c'est la
   réponse correcte.
6. **La sécurité est en base, pas dans l'interface.** Une politique RLS ne se remplace pas par
   un `if` côté client. `service_role` ne quitte jamais le serveur.
7. **Aucun bouton décoratif.** Une fonctionnalité non développée s'affiche comme telle, pas
   comme un lien mort.

---

## Documentation

| Document                                                                   | Contenu                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------- |
| [`docs/decisions.md`](docs/decisions.md)                                   | Tous les arbitrages rendus, avec leur justification   |
| [`docs/implementation-status.md`](docs/implementation-status.md)           | Avancement module par module, et ce qui manque        |
| [`docs/db-conventions.md`](docs/db-conventions.md)                         | Conventions normatives de la base                     |
| [`docs/rls.md`](docs/rls.md)                                               | Modèle d'autorisation, politiques, `SECURITY DEFINER` |
| [`docs/screen-traceability-matrix.md`](docs/screen-traceability-matrix.md) | 199 écrans → routes, tables, RLS, tests               |
| [`docs/migration-integrity.md`](docs/migration-integrity.md)               | Contrôle dépôt ↔ base                                 |
| [`docs/public-routing.md`](docs/public-routing.md)                         | Landing publique, `redirectTo`, open redirects        |
| [`docs/cms.md`](docs/cms.md)                                               | Couche CMS et réutilisation du métier existant        |
| [`docs/cms-automation.md`](docs/cms-automation.md)                         | Programmation, expiration, tâches planifiées          |
| [`docs/featured-profile.md`](docs/featured-profile.md)                     | ISE du jour : éligibilité, rotation, override         |

---

## Sécurité

Aucun secret ne figure dans ce dépôt. Les variables sensibles vivent dans les secrets Vercel,
EAS et Supabase. `.env.example` liste les variables attendues, sans aucune valeur sensible.

Trois workflows CI : qualité (formatage, typage, tests, build), recherche de secrets versionnés,
intégrité des migrations, plus un contrôle quotidien de la ligne de base de sécurité de la base.

Pour signaler une vulnérabilité, ouvrez une issue privée plutôt qu'une issue publique.
