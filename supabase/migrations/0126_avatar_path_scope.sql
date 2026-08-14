-- =====================================================================
-- 0126_avatar_path_scope
-- Ouverture du depot de photo de profil (avatar) — REVISION DE D-117.
--
-- CE QUI EXISTAIT DEJA, ET N'EST PAS RETOUCHE ICI
--   * le bucket prive `avatars` (0027) : 2 Mo, `image/png`, `image/jpeg`,
--     `image/webp` ;
--   * la politique Storage `ise_avatars_write` (0027) : un membre n'ecrit
--     que sous `avatars/<son profile_id>/…` ;
--   * la politique `ise_avatars_read` : lecture reservee aux membres actifs,
--     jamais au web ouvert (le bucket reste PRIVE, D-73 / 0120) ;
--   * le privilege UPDATE de `authenticated` sur `ise_profiles.avatar_path`,
--     borne par la politique `ise_profiles_update_own` (id = mon profil).
--
--   Conclusion : AUCUNE RPC n'est necessaire pour enregistrer le chemin.
--   Un UPDATE direct sur sa propre ligne est deja exactement encadre.
--   En ecrire une n'ajouterait qu'une couche sans pouvoir supplementaire.
--
-- CE QUI MANQUAIT REELLEMENT, ET QUE CETTE MIGRATION AJOUTE
--   La politique Storage garde le DEPOT DES OCTETS, pas la valeur ECRITE
--   dans `avatar_path`. Sans garde, un membre pouvait enregistrer le chemin
--   d'un AUTRE membre (`<autre profile_id>/photo.png`) et afficher le
--   portrait d'autrui comme le sien : le bucket etant lisible par tout
--   membre actif, l'URL signee aurait fonctionne.
--
--   La contrainte ci-dessous ferme cet ecart en base, et non dans l'ecran —
--   meme motif et meme forme que `ise_profiles_public_photo_path_scope`
--   posee en 0120 pour le portrait public.
--
-- POURQUOI L'ECART D-117 EST LEVE
--   D-117 ne disait pas « c'est impossible » : elle constatait qu'aucun
--   ecran de televersement n'etait livre, et refusait donc d'afficher un
--   bouton decoratif (MASTER PROMPT §113). Le mecanisme de depot existe
--   desormais — il a ete livre pour le portrait public (0120) et il est
--   transpose au bucket `avatars`. Le motif du refus a disparu ; l'ecran
--   `/mon-profil/en-tete` porte maintenant un vrai formulaire de depot,
--   avec retrait.
--
-- AUCUNE DONNEE A REPRENDRE : `avatar_path` est NULL sur les 260 profils
-- (le module n'a jamais ete ouvert), la contrainte est donc validee
-- immediatement sans risque de rejet retroactif.
-- =====================================================================

alter table public.ise_profiles
  drop constraint if exists ise_profiles_avatar_path_scope;

alter table public.ise_profiles
  add constraint ise_profiles_avatar_path_scope
  check (avatar_path is null or avatar_path like (id::text || '/%'));

comment on column public.ise_profiles.avatar_path is
  'Chemin de la photo de profil dans le bucket PRIVE `avatars`, toujours '
  'prefixe par `<profile_id>/` (contrainte `ise_profiles_avatar_path_scope`, '
  '0126). Jamais servi au web ouvert : la lecture passe par une URL signee '
  'reservee aux membres actifs. Le portrait PUBLIC est une autre colonne, '
  '`public_photo_path` (0120).';
