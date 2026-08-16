-- 0150 — corrige l'ambiguite introduite cette nuit par la tache #193 (matching Google, D-201).
--
-- Cette tache a voulu ELARGIR private.provision_referenced_account(uuid, uuid) en lui
-- ajoutant un troisieme parametre p_mechanism avec une valeur par defaut :
--   private.provision_referenced_account(p_profile_id uuid, p_user_id uuid, p_mechanism text default 'invite_link')
-- Mais `create or replace function` ne remplace une fonction que si la signature (types
-- d'arguments) est identique. Un parametre supplementaire, meme avec une valeur par defaut,
-- cree une SURCHARGE distincte : les deux fonctions (2 arguments et 3 arguments) coexistent
-- depuis cette nuit. Tout appel a 2 arguments exacts (public.srv_provision_referenced_account,
-- utilise par l'Edge Function provision-invitations et par le provisioning des 252 comptes,
-- D-161) devient alors ambigu pour Postgres : il pourrait correspondre soit a la fonction a
-- 2 arguments, soit a la fonction a 3 arguments en utilisant sa valeur par defaut. Postgres
-- refuse de trancher et renvoie "function ... is not unique" (42725) — constate en conditions
-- reelles ce matin : 100% des tentatives de provisioning echouaient depuis cette nuit,
-- silencieusement jusqu'a la premiere tentative reelle (le mode dryRun ne passe jamais par
-- cet appel SQL et ne revelait donc rien).
--
-- Correctif : supprime la surcharge a 2 arguments, ne conserve que celle a 3 arguments
-- (defaut 'invite_link' inchange pour tout appelant existant). Aucune perte de comportement :
-- c'est exactement l'intention documentee par D-201 ("signature elargie de facon
-- retrocompatible"), simplement mal executee (surcharge au lieu de remplacement).

drop function if exists private.provision_referenced_account(uuid, uuid);

comment on function private.provision_referenced_account(uuid, uuid, text) is
  'D-161 (0106) + D-201 (0146, elargissement) + correctif 0150 (ambiguite de surcharge levee) — '
  'lie un compte auth.users nouvellement cree a un profil ISE reference non reclame. '
  'p_mechanism distingue le provisioning par lien d''invitation (defaut) du rattachement '
  'automatique via Google (D-201). SECURITY DEFINER, appelable uniquement par service_role.';
