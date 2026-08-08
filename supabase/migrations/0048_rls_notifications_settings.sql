-- =====================================================================
-- 0048_rls_notifications_settings
-- Ouverture des politiques RLS du lot « Notifications et parametres » (0015).
--
-- Tout ce lot est de la donnee STRICTEMENT PERSONNELLE (D-72) : chaque
-- table se lit et s'ecrit par son seul proprietaire. Aucune permission
-- administrative n'y donne acces — un exploitant n'a aucune raison de
-- lire les notifications, les jetons d'appareil ou les preferences d'un
-- membre, et `analytics` travaille sur des agregats, pas sur ces lignes.
--
-- Deux tables restent VOLONTAIREMENT FERMEES :
--   * `notification_deliveries` — file d'envoi technique (fournisseur,
--     `idempotency_key`, `provider_message_id`, compteurs de reprise).
--     C'est de l'infrastructure, pas une donnee de membre : elle
--     n'appartient qu'au serveur. La rendre lisible n'apporterait rien
--     au membre et exposerait la mecanique d'envoi.
--   * `domain_events` — voir 0050.
--
-- `consent_records` et `terms_acceptances` sont APPEND-ONLY : aucune
-- politique UPDATE ni DELETE. Une preuve de consentement se pose, elle ne
-- se reecrit pas ; une revocation est une NOUVELLE ligne.
-- =====================================================================

-- ---------------------------------------------------------------------
-- notifications : destinataire uniquement.
-- ---------------------------------------------------------------------
drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications
  for select to authenticated
  using (profile_id = private.current_profile_id());

-- Marquer comme lue / archiver. Aucune politique INSERT : une notification
-- est EMISE par le serveur, jamais fabriquee par un client (sinon un
-- membre pourrait se forger une alerte, ou en adresser une a un tiers).
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (profile_id = private.current_profile_id())
  with check (profile_id = private.current_profile_id());

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (profile_id = private.current_profile_id());

-- ---------------------------------------------------------------------
-- Preferences et reglages : proprietaire seul, lecture comprise.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['notification_preferences',
                           'notification_community_preferences',
                           'device_tokens',
                           'user_settings'] loop
    execute format($p$
      drop policy if exists %1$I on public.%2$I;
      create policy %1$I on public.%2$I
        for all to authenticated
        using (profile_id = private.current_profile_id())
        with check (profile_id = private.current_profile_id());
    $p$, t || '_own', t);
  end loop;
end
$$;

comment on column public.device_tokens.expo_push_token is
  'Jeton de notification PRIVE. Protege par la politique `device_tokens_own` : aucune ligne d''un tiers '
  'n''est atteignable, donc aucun privilege de colonne n''est necessaire ici.';

-- ---------------------------------------------------------------------
-- Traces de consentement : APPEND-ONLY.
-- ---------------------------------------------------------------------
drop policy if exists consent_records_own on public.consent_records;
create policy consent_records_own on public.consent_records
  for select to authenticated
  using (profile_id = private.current_profile_id());

drop policy if exists consent_records_append on public.consent_records;
create policy consent_records_append on public.consent_records
  for insert to authenticated
  with check (profile_id = private.current_profile_id());

drop policy if exists terms_acceptances_own on public.terms_acceptances;
create policy terms_acceptances_own on public.terms_acceptances
  for select to authenticated
  using (profile_id = private.current_profile_id());

drop policy if exists terms_acceptances_append on public.terms_acceptances;
create policy terms_acceptances_append on public.terms_acceptances
  for insert to authenticated
  with check (profile_id = private.current_profile_id());

comment on table public.consent_records is
  'Journal de consentement APPEND-ONLY (RGPD). Aucune politique UPDATE ni DELETE : une revocation est une nouvelle ligne.';
comment on table public.terms_acceptances is
  'Acceptations des documents contractuels, APPEND-ONLY. Aucune politique UPDATE ni DELETE.';
comment on table public.notification_deliveries is
  'File d''envoi technique. VOLONTAIREMENT SANS POLITIQUE : infrastructure serveur (fournisseur, '
  'idempotence, reprises), aucune valeur pour le membre, et exposerait la mecanique d''envoi.';
