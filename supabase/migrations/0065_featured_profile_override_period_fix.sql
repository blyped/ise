-- =====================================================================
-- 0065_featured_profile_override_period_fix
-- Applique le 2026-08-08. Export fidele de la migration appliquee.
-- Ne pas editer : toute correction passe par une nouvelle migration.
--
-- DEFAUT TROUVE PAR supabase/tests/rls/0021_cms_suite.sql (cas G18).
--
--   `public.set_featured_profile_automation(true)` clot les epinglages en
--   cours par `ends_at = now()`. Or `now()` est l'heure de DEBUT DE
--   TRANSACTION : si l'epinglage a ete cree dans la meme transaction (ou
--   dans la meme seconde), `ends_at` devient EGAL a `starts_at` et la
--   contrainte `cms_content_overrides_period` (ends_at > starts_at) rejette
--   la mise a jour :
--
--     ERROR 23514: new row for relation "cms_content_overrides" violates
--     check constraint "cms_content_overrides_period"
--
--   Consequence reelle : « epingler un ISE puis reprendre l'automatisation »
--   depuis CMS-006 echouait avec une erreur technique brute (D-102) des lors
--   que les deux actions tombaient dans la meme seconde. Peu probable en
--   usage humain, certain en test et en script d'exploitation.
--
-- CORRECTIF
--   La cloture pose `greatest(now(), starts_at + 1 milliseconde)` : la
--   periode reste non vide par construction, sans jamais prolonger un
--   epinglage au-dela de l'instant de la reprise.
--
--   Les deux fonctions d'override valident par ailleurs leur periode en
--   amont et levent un code machine (`invalid_period`, P0001) plutot que de
--   laisser remonter une violation de contrainte 23514 (D-102).
-- =====================================================================

create or replace function public.set_featured_profile_automation(
  p_enabled boolean,
  p_reason  text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.current_profile_id();
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.featured_profile.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update public.cms_featured_profile_rules
     set is_automation_enabled = p_enabled, updated_by_profile_id = v_actor
   where is_active;

  -- Reprendre l'automatisation met fin aux epinglages en cours : sinon le
  -- systeme resterait bloque sur le dernier override (addendum §43).
  -- CORRECTIF 0065 : la borne de fin ne peut jamais preceder ni egaler la
  -- borne de debut, meme si les deux actes tombent dans la meme transaction.
  if p_enabled then
    update public.cms_content_overrides
       set ends_at = greatest(now(), starts_at + interval '1 millisecond')
     where section_key = 'featured_profile' and override_kind = 'pin'
       and (ends_at is null or ends_at > now());
  end if;

  perform private.log_audit(
    p_action => case when p_enabled then 'cms.featured_profile.automation_resumed'
                     else 'cms.featured_profile.automation_suspended' end,
    p_object_type => 'cms_featured_profile_rules',
    p_context => jsonb_build_object('reason', p_reason));

  return jsonb_build_object('is_automation_enabled', p_enabled);
end
$$;

revoke all on function public.set_featured_profile_automation(boolean, text) from public, anon;
grant execute on function public.set_featured_profile_automation(boolean, text) to authenticated;

comment on function public.set_featured_profile_automation(boolean, text) is
  'Suspend ou reprend l''automatisation de « ISE du jour » (addendum §22). La reprise clot les epinglages en cours pour que la source automatique redevienne effective (§43). Correctif 0065 : la cloture ne produit jamais une periode vide.';

create or replace function public.override_featured_profile(
  p_profile_id uuid,
  p_starts_at  timestamptz default now(),
  p_ends_at    timestamptz default null,
  p_reason     text        default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.current_profile_id();
  v_id    uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.featured_profile.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  -- D-102 : code machine, jamais une violation de contrainte brute.
  if p_ends_at is not null and p_ends_at <= coalesce(p_starts_at, now()) then
    raise exception 'invalid_period' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.ise_profiles p where p.id = p_profile_id and p.deleted_at is null) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not private.featured_profile_eligible(p_profile_id, null) then
    raise exception 'profile_not_eligible' using errcode = 'P0001';
  end if;

  insert into public.cms_content_overrides
    (section_key, override_kind, entity_type, entity_id, starts_at, ends_at, reason, created_by_profile_id)
  values ('featured_profile', 'pin', 'profile', p_profile_id,
          coalesce(p_starts_at, now()), p_ends_at, p_reason, v_actor)
  returning id into v_id;

  perform private.log_audit(
    p_action => 'cms.featured_profile.override',
    p_object_type => 'ise_profile', p_object_id => p_profile_id::text,
    p_context => jsonb_build_object('override_id', v_id, 'starts_at', p_starts_at,
                                    'ends_at', p_ends_at, 'reason', p_reason));

  return jsonb_build_object('override_id', v_id, 'profile_id', p_profile_id,
                            'starts_at', coalesce(p_starts_at, now()), 'ends_at', p_ends_at);
end
$$;

revoke all on function public.override_featured_profile(uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.override_featured_profile(uuid, timestamptz, timestamptz, text) to authenticated;

comment on function public.override_featured_profile(uuid, timestamptz, timestamptz, text) is
  'Force un profil comme « ISE du jour » sur une periode bornee (addendum §22). Refuse un profil non eligible : l''override ne contourne pas le consentement. Audite. Correctif 0065 : periode validee en amont (invalid_period).';

create or replace function public.exclude_profile_from_featured(
  p_profile_id uuid,
  p_until      timestamptz default null,
  p_reason     text        default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.current_profile_id();
  v_id    uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.featured_profile.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_until is not null and p_until <= now() then
    raise exception 'invalid_period' using errcode = 'P0001';
  end if;

  insert into public.cms_content_overrides
    (section_key, override_kind, entity_type, entity_id, starts_at, ends_at, reason, created_by_profile_id)
  values ('featured_profile', 'exclude', 'profile', p_profile_id, now(), p_until, p_reason, v_actor)
  returning id into v_id;

  perform private.log_audit(
    p_action => 'cms.featured_profile.exclude',
    p_object_type => 'ise_profile', p_object_id => p_profile_id::text,
    p_context => jsonb_build_object('override_id', v_id, 'until', p_until, 'reason', p_reason));

  return jsonb_build_object('override_id', v_id, 'profile_id', p_profile_id, 'until', p_until);
end
$$;

revoke all on function public.exclude_profile_from_featured(uuid, timestamptz, text) from public, anon;
grant execute on function public.exclude_profile_from_featured(uuid, timestamptz, text) to authenticated;

comment on function public.exclude_profile_from_featured(uuid, timestamptz, text) is
  'Exclut temporairement un profil de « ISE du jour » (addendum §22). L''exclusion est un acte editorial date et audite, pas un attribut du profil. Correctif 0065 : periode validee en amont (invalid_period).';
