-- 0101_security_advisor_hardening
-- Corrige les constats reels de l'audit des Supabase Advisors (securite) :
--
-- 1. `function_search_path_mutable` : 10 fonctions sans `search_path` fige.
--    Aucune n'est SECURITY DEFINER (verifie), mais D-101 exige `SET search_path = ''`
--    sur toute fonction, par hygiene et coherence avec le reste du schema.
--    Toutes sont des fonctions SQL pures (listes de codes / predicats), sans
--    reference a un objet non qualifie : le passage a search_path = '' est sans
--    risque de rupture.
--
-- 2. `rls_enabled_no_policy` : domain_events, notification_deliveries,
--    profile_search_documents ont RLS active + FORCE mais aucune politique.
--    Conformement a 0020 ("Sans politique, une table est totalement fermee :
--    c'est l'etat voulu"), ces 3 tables sont des tables techniques internes
--    (journal d'evenements, journal d'envoi de notifications, index de
--    recherche materialise) : aucun ecran ne les lit ni ne les ecrit en direct
--    (verifie : aucune fonction publique ni trigger ne les referencent hors
--    ecriture interne). Elles resteront fermees en permanence, pas seulement
--    "en attente d'une tranche verticale". On rend ce refus explicite avec une
--    politique `using (false)` plutot que de laisser un etat implicite,
--    ambigu pour l'advisor et les futurs lecteurs.
--    Comportement : AUCUN changement (acces deja refuse en pratique).
--
-- Non modifie (constats revus et intentionnels, voir docs/decisions.md) :
--  - `anon_security_definer_function_executable` sur les 10 fonctions
--    `get_landing_*` / `record_public_landing_event` : D-125 (EXECUTE anon
--    limite a ces 10 fonctions "public-safe", rien d'autre).
--  - `authenticated_security_definer_function_executable` sur l'ensemble des
--    fonctions RPC `public` : c'est la surface d'API RPC de l'application
--    (D-126 : privileges explicites accordes a `authenticated` apres retrait
--    du EXECUTE implicite de `PUBLIC`). Chaque fonction applique ses propres
--    controles d'autorisation en interne (private.has_permission, appartenance
--    au profil appelant, etc.) ; ce n'est pas un acces table direct.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. search_path fige sur les fonctions listees par l'advisor
-- ---------------------------------------------------------------------
alter function public.internship_organization_type_codes() set search_path = '';
alter function public.internship_purpose_codes() set search_path = '';
alter function public.is_cms_entity_type(text) set search_path = '';
alter function public.is_cms_status(text) set search_path = '';
alter function public.mentorship_audience_codes() set search_path = '';
alter function public.mentorship_channel_codes() set search_path = '';
alter function public.mentorship_expectation_codes() set search_path = '';
alter function public.mentorship_format_codes() set search_path = '';
alter function public.mentorship_objective_codes() set search_path = '';
alter function private.cms_table_for(text) set search_path = '';

-- ---------------------------------------------------------------------
-- 2. Politiques de refus explicite sur les 3 tables techniques internes
--    (aucun changement de comportement : deja fermees par defaut)
-- ---------------------------------------------------------------------
drop policy if exists domain_events_deny_all on public.domain_events;
create policy domain_events_deny_all on public.domain_events
  for all to authenticated
  using (false)
  with check (false);
comment on policy domain_events_deny_all on public.domain_events is
  'Journal d''evenements interne : jamais lu ni ecrit directement par un client. Ecriture exclusivement via service_role / fonctions internes.';

drop policy if exists notification_deliveries_deny_all on public.notification_deliveries;
create policy notification_deliveries_deny_all on public.notification_deliveries
  for all to authenticated
  using (false)
  with check (false);
comment on policy notification_deliveries_deny_all on public.notification_deliveries is
  'Journal d''envoi de notifications (push/email) : gere par le worker de livraison (service_role) uniquement. Le contenu visible cote membre passe par public.notifications.';

drop policy if exists profile_search_documents_deny_all on public.profile_search_documents;
create policy profile_search_documents_deny_all on public.profile_search_documents
  for all to authenticated
  using (false)
  with check (false);
comment on policy profile_search_documents_deny_all on public.profile_search_documents is
  'Index de recherche materialise (search_vector) : maintenu par les fonctions internes de reindexation. La recherche cote membre passe par les fonctions RPC dediees, jamais par une lecture directe de cette table.';
