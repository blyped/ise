-- =====================================================================
-- 0060_cms_cron_schedule
-- Applique le 2026-08-08. Export fidele de la migration appliquee.
-- Ne pas editer : toute correction passe par une nouvelle migration.
--
-- CORRECTIF de la section 12 de 0059.
--   0059 a bien cree l'extension `pg_cron` (1.6.4) sur ce projet, mais sa
--   garde utilisait `to_regproc('cron.schedule(text,text,text)')`, qui rend
--   NULL : `to_regproc` n'accepte PAS de liste d'arguments. Le bloc est donc
--   sorti avant de planifier, et `cron.job` est reste vide. Constate, pas
--   suppose : `select count(*) from cron.job` renvoyait 0.
--
--   Cette migration planifie reellement les quatre taches, avec la bonne
--   garde (`to_regprocedure`), et reste idempotente : elle deprogramme avant
--   de reprogrammer.
--
-- ORDONNANCEMENT RETENU (addendum §20, §27, §42) — heures UTC
--   */10 * * * *  cms_expire_content            expiration des campagnes et slides
--   */10 * * * *  cms_publish_scheduled         ordres de programmation echus
--   30 5   * * *  cms_select_featured_profile   selection de « ISE du jour »
--   0 6    * * *  cms_publish_featured_profile  publication de la selection
--
-- Les quatre taches sont idempotentes : une double execution du cron ne
-- produit ni doublon ni effet de bord (addendum §20, §57).
-- =====================================================================

do $$
declare
  v_jobs text[] := array['cms_expire_content', 'cms_publish_scheduled',
                         'cms_select_featured_profile', 'cms_publish_featured_profile'];
  j text;
begin
  if to_regprocedure('cron.schedule(text,text,text)') is null then
    raise warning 'pg_cron absent : la planification doit etre assuree a l''exterieur (docs/cms-automation.md)';
    return;
  end if;

  foreach j in array v_jobs loop
    if exists (select 1 from cron.job where jobname = j) then
      perform cron.unschedule(j);
    end if;
  end loop;

  perform cron.schedule('cms_expire_content',           '*/10 * * * *', 'select private.expire_cms_content()');
  perform cron.schedule('cms_publish_scheduled',        '*/10 * * * *', 'select private.publish_scheduled_cms_content()');
  perform cron.schedule('cms_select_featured_profile',  '30 5 * * *',   'select private.run_daily_featured_profile()');
  perform cron.schedule('cms_publish_featured_profile', '0 6 * * *',    'select private.publish_featured_profile()');
end $$;

-- ---------------------------------------------------------------------
-- Observabilite de la planification (addendum §20 : « observable »).
-- Expose l'etat REEL des taches : nom, cadence, activite, derniere
-- execution et son resultat. Aucun chiffre d'illustration.
-- ---------------------------------------------------------------------
create or replace function private.cms_automation_status()
returns table (
  job_name        text,
  schedule        text,
  is_active       boolean,
  last_run_at     timestamptz,
  last_status     text,
  last_message    text
)
language sql
stable
security definer
set search_path = ''
as $$
  select j.jobname::text,
         j.schedule::text,
         j.active,
         d.start_time,
         d.status::text,
         d.return_message::text
  from cron.job j
  left join lateral (
    select r.start_time, r.status, r.return_message
    from cron.job_run_details r
    where r.jobid = j.jobid
    order by r.start_time desc
    limit 1
  ) d on true
  where j.jobname like 'cms\_%'
  order by j.jobname
$$;

revoke all on function private.cms_automation_status() from public, anon, authenticated;

comment on function private.cms_automation_status() is
  'Etat reel des taches planifiees du CMS, lu dans cron.job et cron.job_run_details. Aucune tache n''est declaree « qui tourne » sans preuve d''execution (addendum §20).';

create or replace function public.get_cms_automation_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not (private.has_permission('cms.read') or private.has_permission('ops.read')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.job_name), '[]'::jsonb)
    into v
  from private.cms_automation_status() s;

  return jsonb_build_object('scheduler', 'pg_cron', 'jobs', v, 'read_at', now());
end
$$;

revoke all on function public.get_cms_automation_status() from public, anon;
grant execute on function public.get_cms_automation_status() to authenticated;

comment on function public.get_cms_automation_status() is
  'CMS-001 : etat des automatisations pour le tableau de bord editorial. Exige cms.read ou ops.read.';
