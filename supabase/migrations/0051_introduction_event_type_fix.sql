-- =====================================================================
-- 0040_introduction_event_type_fix
--
-- DEFAUT REEL trouve par `supabase/tests/rls/0004_network_suite.sql`,
-- cas N20 / N21 / N22 / N23, avant toute mise en service de l'ecran
-- ISE-046.
--
-- Constat
-- -------
-- `public.transition_introduction()` (migration 0006) journalise chaque
-- transition ainsi :
--
--     insert into public.introduction_events
--       (introduction_id, event_type, actor_profile_id, to_status, note)
--     values (p_introduction_id, p_to_status, v_me, p_to_status, p_note);
--
-- c'est-a-dire `event_type = <statut d'arrivee>`. Or la contrainte
-- `introduction_events_event_type_check`, posee dans la MEME migration,
-- n'enumere que :
--
--     'requested', 'intermediary_accepted', 'intermediary_declined',
--     'withdrawn', 'expired', 'introduced', 'target_responded',
--     'outcome_declared'
--
-- Il y manque **'completed'** et **'no_outcome'**, qui sont pourtant
-- deux etats terminaux declares par la machine d'etats D-50 et par le
-- `CHECK` de `introduction_requests.status`.
--
-- Consequence : les deux DERNIERES transitions de la machine —
-- `target_responded -> completed` et `... -> no_outcome` — echouaient
-- avec `23514 check_violation` sur `introduction_events`. Autrement dit,
-- une introduction ne pouvait jamais etre close. Le bilan d'ISE-046
-- etait structurellement impossible.
--
-- Le defaut ne se voyait pas jusqu'ici parce qu'aucun test ne poussait
-- une introduction jusqu'a son terme : 0001 s'arretait a
-- `invalid_transition` (cas C16, C17).
--
-- Correctif
-- ---------
-- La contrainte est remplacee, en alignant son enumeration sur celle de
-- `introduction_requests.status` augmentee de `outcome_declared`.
-- **0006 n'est pas editee** — meme convention qu'en 0028, 0036, 0038 et
-- 0039 — et aucune assertion de la suite n'a ete affaiblie.
--
-- References : MASTER PROMPT §54, §80, §100 ; D-50, D-55.
-- =====================================================================

alter table public.introduction_events
  drop constraint if exists introduction_events_event_type_check;

alter table public.introduction_events
  add constraint introduction_events_event_type_check
  check (event_type in (
    'requested',
    'intermediary_accepted',
    'intermediary_declined',
    'withdrawn',
    'expired',
    'introduced',
    'target_responded',
    'completed',
    'no_outcome',
    'outcome_declared'));

comment on column public.introduction_events.event_type is
  'Fait journalise. Aligne sur introduction_requests.status, plus outcome_declared. Corrige en 0040 : completed et no_outcome manquaient, ce qui rendait la cloture d''une introduction impossible (D-50).';
