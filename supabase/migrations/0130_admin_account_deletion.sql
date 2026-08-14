-- =====================================================================
-- 0130_admin_account_deletion
-- Suppression d'un COMPTE par la moderation (permission `profiles.moderate`).
--
-- CE QUI EXISTAIT DEJA, ET N'EST PAS REFAIT ICI
--   * `public.block_profile()` / `public.unblock_profile()` (0016) et la
--     table `public.profile_blocks` : mesure PERSONNELLE, bidirectionnelle,
--     lue par `private.is_blocked_between()` dans `private.can_see_profile()`
--     et dans une quinzaine de politiques d'ecriture (demandes de relation,
--     d'introduction, de recommandation, de mentorat, invitations
--     communaute / projet / opportunite, interets de stage...). Il ne
--     manquait AUCUN mecanisme : il manquait un point d'entree d'interface,
--     retire avec la messagerie (decision C-08). Ce point d'entree est
--     rouvert cote applicatif, pas ici.
--   * `public.create_report()` + `public.report_reasons` (9 motifs, 0016) :
--     le signalement d'un profil fonctionne deja et l'ecran /aide/signaler
--     l'expose. Rien a ajouter.
--   * `public.admin_set_profile_status()` (suspend / reactivate / archive /
--     restore) et `public.admin_record_moderation_action()` (warn,
--     account_suspension, lift_suspension, escalate) — 0077. L'arsenal de
--     sanction PROPORTIONNEE est complet ; on n'y touche pas.
--   * `public.delete_my_account()` (SYS-008) : suppression a l'initiative du
--     membre, conforme a D-19.
--
-- CE QUI MANQUAIT, ET QUE CETTE MIGRATION AJOUTE
--   La suppression d'un compte a l'initiative de la MODERATION. Un profil
--   suspendu reste un compte ouvert : la personne conserve sa session, son
--   authentification, ses jetons d'appareil. Aucune fonction ne permettait
--   de dissocier le compte du profil.
--
-- D-19 — CE QUE « SUPPRIMER » VEUT DIRE ICI
--   On ne supprime PAS le profil ISE. Le profil est un objet de l'annuaire,
--   il precede le compte et lui survit. On supprime le COMPTE :
--     * `auth.users` est supprime, donc `ise_profiles.user_id` -> NULL par
--       `ON DELETE SET NULL` ;
--     * `claim_status` repasse a 'unclaimed', `profile_status` a
--       'referenced' — sauf si le profil etait 'archived', auquel cas
--       l'archivage decide par la moderation est PRESERVE : supprimer un
--       compte ne doit pas desarchiver un profil.
--   Le profil peut donc etre reclame a nouveau plus tard. C'est une
--   dissociation, pas un effacement.
--
-- PORTRAIT PUBLIC ET DOCUMENTS
--   Le passage de `user_id` a NULL est un UPDATE sur `ise_profiles`, donc le
--   declencheur `ise_profiles_public_photo_guard` (0120) se declenche :
--   il purge l'objet du bucket PUBLIC et remet a NULL `public_photo_path`,
--   `public_photo_alt`, les dimensions et `public_photo_set_at`. Verifie :
--   aucune image publique ne survit a la suppression. Les documents de
--   profil (`public.profile_documents`, bucket PRIVE `profile-documents`)
--   ne sont PAS purges : ils suivent le profil, qui subsiste, et le bucket
--   n'est pas public. C'est un choix explicite, pas un oubli.
--
-- REGLES : permission verifiee DANS la fonction, motif >= 10 caracteres,
-- confirmation exacte « SUPPRIMER » (MASTER PROMPT §48), journalisation
-- `private.log_audit` y compris des refus, REVOKE ... FROM public, anon
-- puis GRANT explicite (D-126), codes d'erreur D-102.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Un type d'action de moderation supplementaire.
--
-- `moderation_actions` est le registre des sanctions a effet reel. La
-- suppression d'un compte en est une : elle doit y apparaitre au meme
-- titre que la suspension, sinon la fiche d'un membre mentirait par
-- omission sur ce qui lui est arrive.
-- ---------------------------------------------------------------------
alter table public.moderation_actions
  drop constraint if exists moderation_actions_action_type_check;

alter table public.moderation_actions
  add constraint moderation_actions_action_type_check
  check (action_type = any (array[
    'dismiss', 'warn', 'hide_content', 'restore_content',
    'temporary_suspension', 'account_suspension', 'lift_suspension',
    'escalate', 'account_deletion'
  ]));


-- ---------------------------------------------------------------------
-- 2. `public.admin_delete_member_account`
--
-- Miroir administratif de `delete_my_account()` : meme portee de purge,
-- meme respect de D-19. Les differences tiennent a l'acteur :
--   * permission `profiles.moderate` exigee et journalisee ;
--   * motif obligatoire (>= 10 caracteres), comme toute sanction ;
--   * impossible de se cibler soi-meme (on ne se supprime pas depuis le
--     back-office : `/parametres` existe pour cela) ;
--   * une ligne dans `moderation_actions`, visible sur la fiche du membre.
--
-- Le compte doit EXISTER : sur un profil simplement reference (user_id
-- deja NULL) il n'y a rien a supprimer, et la fonction le dit plutot que
-- de reussir sans effet.
-- ---------------------------------------------------------------------
create or replace function public.admin_delete_member_account(
  p_profile_id   uuid,
  p_reason       text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_me        uuid := private.current_profile_id();
  v_profile   public.ise_profiles;
  v_new_status text;
  v_action_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not private.has_permission('profiles.moderate') then
    perform private.log_audit(
      p_action      => 'admin.account_deleted',
      p_object_type => 'ise_profile',
      p_object_id   => p_profile_id::text,
      p_result      => 'denied',
      p_error_code  => '42501'
    );
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  -- Confirmation explicite, jamais implicite (MASTER PROMPT §48).
  if upper(btrim(coalesce(p_confirmation, ''))) <> 'SUPPRIMER' then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  if p_profile_id is null or p_profile_id = v_me then
    raise exception 'cannot_target_self' using errcode = 'P0001';
  end if;

  select * into v_profile
    from public.ise_profiles
   where id = p_profile_id and deleted_at is null
   for update;

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  -- Rien a supprimer : le profil n'a pas de compte associe.
  if v_profile.user_id is null then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  -- L'archivage prime : supprimer un compte ne desarchive pas un profil.
  v_new_status := case
    when v_profile.profile_status = 'archived' then 'archived'
    else 'referenced'
  end;

  -- La sanction est enregistree AVANT la purge : si la suite echoue, la
  -- transaction entiere est annulee, registre compris.
  insert into public.moderation_actions
    (moderator_profile_id, action_type, target_type, target_id,
     target_profile_id, reason)
  values
    (v_me, 'account_deletion', 'profile', p_profile_id,
     p_profile_id, btrim(p_reason))
  returning id into v_action_id;

  perform private.log_audit(
    p_action      => 'admin.account_deleted',
    p_object_type => 'ise_profile',
    p_object_id   => p_profile_id::text,
    p_result      => 'success',
    p_context     => jsonb_build_object(
      'decision',    'compte supprime, profil reference conserve (D-19)',
      'action_id',   v_action_id,
      'from_status', v_profile.profile_status,
      'to_status',   v_new_status,
      'reason',      btrim(p_reason)
    )
  );

  -- Meme portee de purge que `delete_my_account()`.
  update public.user_settings set deletion_requested_at = now()
   where profile_id = p_profile_id;

  delete from private.profile_contacts                  where profile_id = p_profile_id;
  delete from public.device_tokens                      where profile_id = p_profile_id;
  delete from public.notification_preferences           where profile_id = p_profile_id;
  delete from public.notification_community_preferences where profile_id = p_profile_id;
  delete from public.notifications                      where profile_id = p_profile_id;
  delete from public.saved_searches                     where profile_id = p_profile_id;
  delete from public.user_settings                      where profile_id = p_profile_id;
  delete from private.user_roles                        where profile_id = p_profile_id;

  update public.ise_profiles
     set claim_status            = 'unclaimed',
         profile_status          = v_new_status,
         claimed_at              = null,
         onboarding_completed_at = null,
         verification_status     = 'unverified',
         verification_level      = null,
         verified_at             = null
   where id = p_profile_id;

  -- `ise_profiles.user_id` -> NULL par ON DELETE SET NULL. Cet UPDATE
  -- declenche `ise_profiles_public_photo_guard` (0120), qui purge le
  -- portrait public du bucket public et vide ses colonnes.
  delete from auth.users where id = v_profile.user_id;

  return jsonb_build_object(
    'profile_id',     p_profile_id,
    'deleted',        true,
    'profile_kept',   true,
    'profile_status', v_new_status,
    'action_id',      v_action_id
  );
end
$$;

comment on function public.admin_delete_member_account(uuid, text, text) is
  'Supprime le COMPTE d''un membre (D-19) : auth.users supprime, profil '
  'conserve et repasse en unclaimed/referenced. Permission profiles.moderate, '
  'motif obligatoire, confirmation « SUPPRIMER », journalise.';

revoke all on function public.admin_delete_member_account(uuid, text, text)
  from public, anon;
grant execute on function public.admin_delete_member_account(uuid, text, text)
  to authenticated;
