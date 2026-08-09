# Imports d'annuaire — ABANDONNÉ (décision C-06)

> Voir `docs/decisions.md`, décision C-06 (09/08/2026).

Ce document décrivait le protocole d'import en masse (SA-040, SA-041, SA-042,
SA-044, SA-045) : téléversement, mapping, validation, normalisation,
détection de doublons, revue humaine, exécution, rapport. Le code web
correspondant a été retiré du dépôt.

**Ce module n'a jamais servi.** L'unique jeu de données réel — le recensement
Excel de 275 réponses fourni par le porteur du projet — a été importé
directement en migration (`0088_import_ise_census`, 6 parties), en
contournant volontairement ce pipeline. Aucun autre import de masse n'est
prévu : toute intégration future de nouveaux membres se fait par création de
profil individuel (auto-inscription ou création de profil référencé au cas
par cas par un superadmin).

## Ce qui reste

- **SA-043 « Profils incomplets »** est conservé — utile indépendamment de
  l'origine du profil, pas seulement dans un contexte d'import — et déplacé
  vers `/administration/profils-incomplets` (code web
  `apps/web/src/app/administration/profils-incomplets/**`).
- Les **tables** de la migration `0017_imports_data_quality` (`private.import_batches`,
  `private.import_rows`, `private.duplicate_candidates`, etc.) et les
  **fonctions** `admin_*` de la migration `0080_admin_imports_api` (à
  l'exception de `admin_list_incomplete_profiles`, toujours utilisée)
  restent en base. Elles sont inoffensives : `SECURITY DEFINER`, permission
  vérifiée en tête, RLS/`REVOKE` déjà en place, et plus aucun écran ne les
  appelle. Leur suppression propre (migration dédiée + mise à jour de la
  suite `supabase/tests/rls/0031_imports_suite.sql`) est un nettoyage
  optionnel, à traiter en Phase 8-9 (hardening) plutôt que dans l'urgence —
  ce n'est pas un risque de sécurité, seulement de la dette technique.
- La permission `imports.review` continue de protéger SA-043.
  `imports.execute` n'est plus consommée par aucun écran mais reste en base
  (même logique que `ops.read` / `ops.manage` après la décision C-05).
