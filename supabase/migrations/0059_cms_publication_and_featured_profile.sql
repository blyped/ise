-- =====================================================================
-- 0059_cms_publication_and_featured_profile
-- Applique le 2026-08-08. Export fidele de la migration appliquee.
-- Ne pas editer : toute correction passe par une nouvelle migration.
--
-- Machine d'etats CMS, separation brouillon / version publiee, rollback,
-- expiration automatique et selection automatisee de « ISE du jour ».
-- Sources : ADDENDUM §20, §21, §22, §27, §30, §42, §43, §48, §49 ;
--           CDC additionnel §17 a §20, §35, §38, §48, §49.
--
-- CONVENTIONS §7 : toute transition d'etat sensible passe par une fonction
-- atomique qui valide acteur -> permission -> etat courant -> transition,
-- sous SELECT ... FOR UPDATE, et journalise (MASTER PROMPT §53, §100).
-- Les triggers de 0058 rendent tout autre chemin impossible.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. RESOLUTION DU TYPE D'OBJET CMS
--    Liste blanche fermee : le nom de table n'est jamais construit a
--    partir d'une entree client sans passer par ce mapping.
-- ---------------------------------------------------------------------
create or replace function private.cms_table_for(p_entity_type text)
returns text
language sql
immutable
as $$
  select case p_entity_type
    when 'cms_section'          then 'cms_sections'
    when 'cms_carousel_item'    then 'cms_carousel_items'
    when 'cms_partner_campaign' then 'cms_partner_campaigns'
  end
$$;

revoke all on function private.cms_table_for(text) from public, anon, authenticated;

comment on function private.cms_table_for(text) is
  'Liste blanche des tables CMS publiables. Un type inconnu rend NULL : aucun nom de table ne provient jamais directement du client.';

-- ---------------------------------------------------------------------
-- 2. PUBLICATION : brouillon -> version publiee (addendum §48)
--
--    Les colonnes vivantes de la ligne sont LE BROUILLON. Publier fige un
--    instantane dans published_snapshot, en conservant le precedent dans
--    previous_published_snapshot pour permettre le rollback (§49).
--    Les fonctions de PUB-001 (0060) ne lisent que l'instantane : une
--    edition en cours n'atteint jamais le site public.
-- ---------------------------------------------------------------------
create or replace function public.publish_cms_content(
  p_entity_type text,
  p_id          uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_table  text := private.cms_table_for(p_entity_type);
  v_actor  uuid := private.current_profile_id();
  v_status text;
  v_extra  text;
  v_skip   text[] := array['published_snapshot', 'previous_published_snapshot',
                           'published_at', 'published_by_profile_id', 'expired_at'];
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.publish') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_table is null then
    raise exception 'unknown_entity_type' using errcode = 'P0002';
  end if;

  execute format('select status from public.%I where id = $1 for update', v_table)
    into v_status using p_id;
  if v_status is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_status not in ('draft', 'scheduled', 'expired', 'archived') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  v_extra := case when v_table = 'cms_sections' then '' else ', expired_at = null' end;

  execute format(
    'update public.%I set previous_published_snapshot = published_snapshot,'
    || ' published_snapshot = (select to_jsonb(t) - $3::text[] from public.%I t where t.id = $1),'
    || ' published_at = now(), published_by_profile_id = $2, status = ''published''%s'
    || ' where id = $1',
    v_table, v_table, v_extra)
  using p_id, v_actor, v_skip;

  perform private.log_audit(
    p_action      => 'cms.publish',
    p_object_type => p_entity_type,
    p_object_id   => p_id::text,
    p_context     => jsonb_build_object('from_status', v_status));

  return jsonb_build_object('entity_type', p_entity_type, 'id', p_id,
                            'status', 'published', 'from_status', v_status);
end
$$;

revoke all on function public.publish_cms_content(text, uuid) from public, anon;
grant execute on function public.publish_cms_content(text, uuid) to authenticated;

comment on function public.publish_cms_content(text, uuid) is
  'Seul chemin de publication d''un contenu CMS. Exige cms.publish, verrouille la ligne, fige un instantane public et conserve le precedent pour le rollback (addendum §48, §49).';

-- ---------------------------------------------------------------------
-- 3. AUTRES TRANSITIONS (addendum §30)
--    draft <-> scheduled       : cms.schedule
--    published -> expired      : cms.publish (ou le traitement planifie)
--    published/expired -> archived, archived -> draft : cms.publish
--    La depublication VIDE l'instantane : le site public cesse d'y avoir
--    acces dans la meme transaction.
-- ---------------------------------------------------------------------
create or replace function public.transition_cms_content(
  p_entity_type text,
  p_id          uuid,
  p_to_status   text,
  p_reason      text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_table  text := private.cms_table_for(p_entity_type);
  v_status text;
  v_perm   text;
  v_extra  text := '';
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_table is null then
    raise exception 'unknown_entity_type' using errcode = 'P0002';
  end if;
  if not public.is_cms_status(p_to_status) then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if p_to_status = 'published' then
    raise exception 'use_publish_cms_content' using errcode = 'P0001';
  end if;

  v_perm := case when p_to_status = 'scheduled' then 'cms.schedule' else 'cms.publish' end;
  if not private.has_permission(v_perm) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  execute format('select status from public.%I where id = $1 for update', v_table)
    into v_status using p_id;
  if v_status is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if not (
       (v_status = 'draft'     and p_to_status in ('scheduled', 'archived'))
    or (v_status = 'scheduled' and p_to_status in ('draft', 'archived'))
    or (v_status = 'published' and p_to_status in ('expired', 'archived'))
    or (v_status = 'expired'   and p_to_status in ('archived', 'draft'))
    or (v_status = 'archived'  and p_to_status = 'draft')
  ) then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  if p_to_status in ('expired', 'archived') then
    v_extra := ', published_snapshot = null';
    if v_table <> 'cms_sections' then
      v_extra := v_extra || ', expired_at = now()';
    end if;
  end if;

  execute format('update public.%I set status = $2%s where id = $1', v_table, v_extra)
  using p_id, p_to_status;

  perform private.log_audit(
    p_action      => 'cms.transition',
    p_object_type => p_entity_type,
    p_object_id   => p_id::text,
    p_context     => jsonb_build_object('from_status', v_status, 'to_status', p_to_status,
                                        'reason', p_reason));

  return jsonb_build_object('entity_type', p_entity_type, 'id', p_id,
                            'status', p_to_status, 'from_status', v_status);
end
$$;

revoke all on function public.transition_cms_content(text, uuid, text, text) from public, anon;
grant execute on function public.transition_cms_content(text, uuid, text, text) to authenticated;

comment on function public.transition_cms_content(text, uuid, text, text) is
  'Matrice des transitions CMS hors publication (addendum §30). Depublier vide l''instantane public dans la meme transaction.';

-- ---------------------------------------------------------------------
-- 4. ROLLBACK (addendum §49)
--    Restaure la version publiee precedente. Le brouillon courant n'est
--    pas touche : rollback ne perd aucun travail en cours.
-- ---------------------------------------------------------------------
create or replace function public.rollback_cms_content(
  p_entity_type text,
  p_id          uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_table text := private.cms_table_for(p_entity_type);
  v_prev  jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.publish') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_table is null then
    raise exception 'unknown_entity_type' using errcode = 'P0002';
  end if;

  execute format('select previous_published_snapshot from public.%I where id = $1 for update', v_table)
    into v_prev using p_id;
  if v_prev is null then
    raise exception 'no_previous_version' using errcode = 'P0001';
  end if;

  execute format(
    'update public.%I set published_snapshot = previous_published_snapshot,'
    || ' previous_published_snapshot = null, published_at = now(), status = ''published'''
    || ' where id = $1', v_table)
  using p_id;

  perform private.log_audit(
    p_action      => 'cms.rollback',
    p_object_type => p_entity_type,
    p_object_id   => p_id::text);

  return jsonb_build_object('entity_type', p_entity_type, 'id', p_id, 'status', 'published',
                            'restored', true);
end
$$;

revoke all on function public.rollback_cms_content(text, uuid) from public, anon;
grant execute on function public.rollback_cms_content(text, uuid) to authenticated;

comment on function public.rollback_cms_content(text, uuid) is
  'Restaure la derniere version publiee saine (addendum §49). Le brouillon courant est preserve.';

-- ---------------------------------------------------------------------
-- 5. TRAITEMENT PLANIFIE : PUBLICATION PROGRAMMEE (addendum §40, CDC §35)
--
--    Frontiere assumee : pour un contenu CMS, la programmation change le
--    STATUT. Pour une actualite, un evenement ou une opportunite, elle ne
--    change que `landing_visibility` — jamais `editorial_status` ni
--    `status` metier. Le CMS orchestre l'exposition sur la landing ; il ne
--    se substitue pas au circuit editorial du module Actualites
--    (permission content.publish) ni au cycle de vie d'une offre.
--
--    IDEMPOTENT : une seconde execution ne trouve plus l'ordre `pending`
--    et ne fait rien. OBSERVABLE : run_count, last_run_at, last_error.
--    REJOUABLE : un ordre en echec reste consultable et peut etre relance.
-- ---------------------------------------------------------------------
create or replace function private.publish_scheduled_cms_content()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r            record;
  v_published  integer := 0;
  v_unpublished integer := 0;
  v_failed     integer := 0;
  v_table      text;
begin
  for r in
    select s.* from public.cms_publication_schedule s
    where s.status = 'pending'
      and ((s.publish_at is not null and s.publish_at <= now())
        or (s.unpublish_at is not null and s.unpublish_at <= now()))
    order by s.publish_at nulls last, s.unpublish_at nulls last, s.id
    for update skip locked
  loop
    begin
      if r.unpublish_at is not null and r.unpublish_at <= now() then
        -- Fin de periode : le contenu quitte la landing.
        if r.entity_type in ('news', 'event', 'opportunity') then
          execute format('update public.%I set landing_visibility = ''hidden'' where id = $1',
                         case r.entity_type when 'news' then 'news'
                                            when 'event' then 'events'
                                            else 'opportunities' end)
          using r.entity_id;
        else
          v_table := private.cms_table_for(r.entity_type);
          execute format(
            'update public.%I set status = ''expired'', published_snapshot = null%s where id = $1 and status = ''published''',
            v_table, case when v_table = 'cms_sections' then '' else ', expired_at = now()' end)
          using r.entity_id;
        end if;
        v_unpublished := v_unpublished + 1;

        update public.cms_publication_schedule
           set status = 'applied', applied_at = now(), last_run_at = now(),
               run_count = run_count + 1, last_error = null
         where id = r.id;

      elsif r.publish_at is not null and r.publish_at <= now() then
        if r.entity_type in ('news', 'event', 'opportunity') then
          execute format('update public.%I set landing_visibility = ''visible'' where id = $1',
                         case r.entity_type when 'news' then 'news'
                                            when 'event' then 'events'
                                            else 'opportunities' end)
          using r.entity_id;
        else
          v_table := private.cms_table_for(r.entity_type);
          execute format(
            'update public.%I set previous_published_snapshot = published_snapshot,'
            || ' published_snapshot = (select to_jsonb(t) - $2::text[] from public.%I t where t.id = $1),'
            || ' published_at = now(), status = ''published''%s where id = $1',
            v_table, v_table,
            case when v_table = 'cms_sections' then '' else ', expired_at = null' end)
          using r.entity_id,
                array['published_snapshot', 'previous_published_snapshot', 'published_at',
                      'published_by_profile_id', 'expired_at'];
        end if;
        v_published := v_published + 1;

        -- Un ordre qui porte AUSSI une date de fin reste `pending` : il
        -- sera repris a `unpublish_at`. Sinon il est clos.
        if r.unpublish_at is null then
          update public.cms_publication_schedule
             set status = 'applied', applied_at = now(), last_run_at = now(),
                 run_count = run_count + 1, last_error = null
           where id = r.id;
        else
          update public.cms_publication_schedule
             set publish_at = null, last_run_at = now(),
                 run_count = run_count + 1, last_error = null
           where id = r.id;
        end if;
      end if;

    exception when others then
      v_failed := v_failed + 1;
      update public.cms_publication_schedule
         set status = 'failed', last_run_at = now(), run_count = run_count + 1,
             last_error = sqlstate || ' ' || sqlerrm
       where id = r.id;
    end;
  end loop;

  perform private.log_audit(
    p_action      => 'cms.scheduler.publish',
    p_object_type => 'cms_publication_schedule',
    p_actor_kind  => 'system',
    p_context     => jsonb_build_object('published', v_published,
                                        'unpublished', v_unpublished,
                                        'failed', v_failed));

  return jsonb_build_object('published', v_published, 'unpublished', v_unpublished,
                            'failed', v_failed, 'ran_at', now());
end
$$;

revoke all on function private.publish_scheduled_cms_content() from public, anon, authenticated;

comment on function private.publish_scheduled_cms_content() is
  'Applique les ordres de programmation echus (addendum §40). Idempotente, observable (run_count, last_error), rejouable. Ne touche jamais editorial_status ni le statut metier d''une offre.';

-- ---------------------------------------------------------------------
-- 6. TRAITEMENT PLANIFIE : EXPIRATION AUTOMATIQUE (addendum §27)
--    A end_at, published -> expired, SANS intervention humaine.
--    Idempotente : la clause `status = 'published'` rend la seconde
--    execution sans effet.
-- ---------------------------------------------------------------------
create or replace function private.expire_cms_content()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_campaigns integer := 0;
  v_slides    integer := 0;
  v_overrides integer := 0;
begin
  with expired as (
    update public.cms_partner_campaigns
       set status = 'expired', published_snapshot = null, expired_at = now()
     where status = 'published' and end_at <= now()
     returning id
  ) select count(*) into v_campaigns from expired;

  with expired as (
    update public.cms_carousel_items
       set status = 'expired', published_snapshot = null, expired_at = now()
     where status = 'published' and end_at is not null and end_at <= now()
     returning id
  ) select count(*) into v_slides from expired;

  -- Une slide dont la campagne a expire ne peut pas survivre a sa mention
  -- de transparence : elle expire avec elle (addendum §26 + §27).
  with expired as (
    update public.cms_carousel_items c
       set status = 'expired', published_snapshot = null, expired_at = now()
     where c.status = 'published'
       and c.partner_campaign_id is not null
       and exists (select 1 from public.cms_partner_campaigns pc
                    where pc.id = c.partner_campaign_id and pc.status <> 'published')
     returning c.id
  ) select v_slides + count(*) into v_slides from expired;

  -- Les overrides editoriaux echus disparaissent : la source automatique
  -- reprend d'elle-meme (addendum §43).
  with gone as (
    delete from public.cms_content_overrides
     where ends_at is not null and ends_at <= now()
     returning id
  ) select count(*) into v_overrides from gone;

  perform private.log_audit(
    p_action      => 'cms.scheduler.expire',
    p_object_type => 'cms_content',
    p_actor_kind  => 'system',
    p_context     => jsonb_build_object('campaigns', v_campaigns, 'slides', v_slides,
                                        'overrides_cleared', v_overrides));

  return jsonb_build_object('campaigns_expired', v_campaigns, 'slides_expired', v_slides,
                            'overrides_cleared', v_overrides, 'ran_at', now());
end
$$;

revoke all on function private.expire_cms_content() from public, anon, authenticated;

comment on function private.expire_cms_content() is
  'Expiration automatique des campagnes et des slides a end_at, sans intervention humaine (addendum §27). Idempotente et rejouable.';

-- ---------------------------------------------------------------------
-- 7. « ISE DU JOUR » : ELIGIBILITE (addendum §17 ; CDC §15)
--
--    AUCUN SIGNAL DE POPULARITE (addendum §19). Ce predicat ne lit ni
--    connexions, ni messages, ni vues, ni score : uniquement le
--    consentement, l'etat du profil, la completude des champs publics et
--    l'absence de moderation active.
-- ---------------------------------------------------------------------
create or replace function private.featured_profile_eligible(
  p_profile_id uuid,
  p_for_date   date default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with d as (select coalesce(p_for_date, (now() at time zone 'utc')::date) as day),
       rules as (select * from public.cms_featured_profile_rules where is_active limit 1)
  select exists (
    select 1
    from public.ise_profiles p, d, rules r
    where p.id = p_profile_id
      and p.deleted_at is null
      and p.profile_status = 'active'
      and p.allow_public_feature
      and p.public_summary is not null
      and not p.is_test_account
      and (not r.require_claimed_profile or p.claim_status = 'claimed')
      and (not r.require_promotion       or p.promotion_id is not null)
      and (not r.require_avatar          or p.avatar_path is not null)
      and (not r.require_expertise_or_position
           or p.current_position is not null
           or exists (select 1 from public.profile_expertise_areas pea where pea.profile_id = p.id))
      and not exists (
        select 1 from public.reports rep
        where rep.target_type = 'profile' and rep.target_id = p.id
          and rep.status in ('open', 'reviewing'))
      and not exists (
        select 1 from public.moderation_actions ma
        where ma.target_type = 'profile' and ma.target_id = p.id
          and ma.action_type in ('temporary_suspension', 'account_suspension')
          and (ma.suspension_until is null or ma.suspension_until > now()))
      and not exists (
        select 1 from public.cms_content_overrides o
        where o.section_key = 'featured_profile' and o.override_kind = 'exclude'
          and o.entity_type = 'profile' and o.entity_id = p.id
          and o.starts_at <= now() and (o.ends_at is null or o.ends_at > now()))
  )
$$;

revoke all on function private.featured_profile_eligible(uuid, date) from public, anon, authenticated;

comment on function private.featured_profile_eligible(uuid, date) is
  'Predicat d''eligibilite de « ISE du jour » (addendum §17). Ne lit aucun signal de popularite : l''addendum §19 l''interdit explicitement.';

-- ---------------------------------------------------------------------
-- 8. « ISE DU JOUR » : SELECTION QUOTIDIENNE (addendum §20 ; CDC §17)
--
--    ROTATION EDITORIALE EQUITABLE, pas un classement de merite :
--      1. promotion la moins recemment mise en avant d'abord (diversite),
--      2. puis profil jamais mis en avant, ou le plus anciennement,
--      3. puis ordre pseudo-aleatoire DETERMINISTE, seme par la date.
--    Le point 3 rend la selection rejouable a l'identique : c'est ce qui
--    la rend verifiable, et c'est aussi ce qui la rend idempotente.
--
--    La ligne est creee en `scheduled` (05:30 UTC) ; la publication est un
--    second acte (06:00 UTC) porte par private.publish_featured_profile().
-- ---------------------------------------------------------------------
create or replace function private.run_daily_featured_profile(
  p_for_date date default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_day       date := coalesce(p_for_date, (now() at time zone 'utc')::date);
  v_rules     public.cms_featured_profile_rules%rowtype;
  v_existing  public.cms_featured_profile_history%rowtype;
  v_pinned    uuid;
  v_chosen    uuid;
  v_mode      text;
  v_pool      integer := 0;
  v_actor     uuid;
begin
  -- Serialise les executions concurrentes du meme jour : deux crons qui se
  -- chevauchent ne produisent pas deux selections.
  perform pg_advisory_xact_lock(hashtext('cms.featured_profile'), v_day - date '2000-01-01');

  select * into v_existing from public.cms_featured_profile_history
   where featured_date = v_day and status in ('scheduled', 'published');
  if found then
    return jsonb_build_object('date', v_day, 'profile_id', v_existing.profile_id,
                              'selection_mode', v_existing.selection_mode,
                              'status', v_existing.status, 'created', false);
  end if;

  select * into v_rules from public.cms_featured_profile_rules where is_active limit 1;
  if not found then
    return jsonb_build_object('date', v_day, 'profile_id', null, 'created', false,
                              'reason', 'no_active_rule');
  end if;

  -- Override manuel : il prime sur l'automatisation, y compris lorsque
  -- celle-ci est suspendue (addendum §22).
  select o.entity_id, o.created_by_profile_id into v_pinned, v_actor
    from public.cms_content_overrides o
   where o.section_key = 'featured_profile' and o.override_kind = 'pin'
     and o.entity_type = 'profile'
     and o.starts_at <= (v_day + time '23:59:59') at time zone 'utc'
     and (o.ends_at is null or o.ends_at > v_day::timestamptz)
   order by o.display_position nulls last, o.created_at desc
   limit 1;

  if v_pinned is not null and private.featured_profile_eligible(v_pinned, v_day) then
    v_chosen := v_pinned;
    v_mode   := 'manual';
  elsif not v_rules.is_automation_enabled then
    perform private.log_audit(
      p_action => 'cms.featured_profile.skipped', p_object_type => 'cms_featured_profile_history',
      p_actor_kind => 'system',
      p_context => jsonb_build_object('date', v_day, 'reason', 'automation_suspended'));
    return jsonb_build_object('date', v_day, 'profile_id', null, 'created', false,
                              'reason', 'automation_suspended');
  else
    select count(*) into v_pool
    from public.ise_profiles p
    where private.featured_profile_eligible(p.id, v_day)
      and not exists (
        select 1 from public.cms_featured_profile_history h
        where h.profile_id = p.id
          and h.status in ('scheduled', 'published')
          and h.featured_date > v_day - v_rules.min_days_between_features);

    if v_pool > 0 then
      with candidates as (
        select p.id, p.promotion_id
        from public.ise_profiles p
        where private.featured_profile_eligible(p.id, v_day)
          and not exists (
            select 1 from public.cms_featured_profile_history h
            where h.profile_id = p.id
              and h.status in ('scheduled', 'published')
              and h.featured_date > v_day - v_rules.min_days_between_features)
      ),
      promo_last as (
        select pr.promotion_id, max(h.featured_date) as last_date
        from public.cms_featured_profile_history h
        join public.ise_profiles pr on pr.id = h.profile_id
        where h.status in ('scheduled', 'published')
        group by pr.promotion_id
      )
      select c.id into v_chosen
      from candidates c
      left join promo_last pl
        on v_rules.balance_dimension = 'promotion'
       and pl.promotion_id is not distinct from c.promotion_id
      order by pl.last_date asc nulls first,
               (select max(h2.featured_date) from public.cms_featured_profile_history h2
                 where h2.profile_id = c.id) asc nulls first,
               extensions.digest(v_day::text || c.id::text, 'sha256')
      limit 1;
      v_mode := 'automatic';
    end if;
  end if;

  -- FALLBACK (addendum §21) : le dernier profil mis en avant, s'il est
  -- ENCORE eligible aujourd'hui. Aucune landing cassee, et aucun profil
  -- incomplet affiche par defaut (CDC §19).
  if v_chosen is null then
    select h.profile_id into v_chosen
    from public.cms_featured_profile_history h
    where h.status = 'published'
      and private.featured_profile_eligible(h.profile_id, v_day)
    order by h.featured_date desc
    limit 1;
    if v_chosen is not null then
      v_mode := 'fallback';
    end if;
  end if;

  if v_chosen is null then
    perform private.log_audit(
      p_action => 'cms.featured_profile.no_candidate',
      p_object_type => 'cms_featured_profile_history', p_actor_kind => 'system',
      p_context => jsonb_build_object('date', v_day, 'pool', v_pool));
    return jsonb_build_object('date', v_day, 'profile_id', null, 'created', false,
                              'reason', 'no_eligible_profile', 'pool', v_pool);
  end if;

  insert into public.cms_featured_profile_history
    (profile_id, featured_date, selection_mode, selected_by_profile_id, status, selection_context)
  values
    (v_chosen, v_day, v_mode,
     case when v_mode = 'manual' then v_actor end,
     'scheduled',
     jsonb_build_object('pool_size', v_pool,
                        'balance_dimension', v_rules.balance_dimension,
                        'min_days_between_features', v_rules.min_days_between_features))
  on conflict do nothing;

  perform private.log_audit(
    p_action => 'cms.featured_profile.selected',
    p_object_type => 'cms_featured_profile_history', p_object_id => v_chosen::text,
    p_actor_kind => case when v_mode = 'manual' then 'user' else 'system' end,
    p_context => jsonb_build_object('date', v_day, 'mode', v_mode, 'pool', v_pool));

  return jsonb_build_object('date', v_day, 'profile_id', v_chosen, 'selection_mode', v_mode,
                            'status', 'scheduled', 'created', true, 'pool', v_pool);
end
$$;

revoke all on function private.run_daily_featured_profile(date) from public, anon, authenticated;

comment on function private.run_daily_featured_profile(date) is
  'Selection quotidienne de « ISE du jour » (addendum §20). Idempotente (une seule ligne par jour, verrou consultatif), observable (selection_context + journal d''audit), rejouable (ordre pseudo-aleatoire deterministe seme par la date). Aucun signal de popularite (§19).';

-- ---------------------------------------------------------------------
-- 9. « ISE DU JOUR » : PUBLICATION (addendum §20, 06:00 UTC)
--    Second acte, distinct de la selection : entre les deux, le CMS peut
--    encore relire, corriger ou remplacer la selection du jour.
-- ---------------------------------------------------------------------
create or replace function private.publish_featured_profile(
  p_for_date date default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_day date := coalesce(p_for_date, (now() at time zone 'utc')::date);
  v_id  uuid;
begin
  update public.cms_featured_profile_history
     set status = 'published', published_at = now()
   where featured_date = v_day and status = 'scheduled'
     and private.featured_profile_eligible(profile_id, v_day)
  returning id into v_id;

  if v_id is not null then
    perform private.log_audit(
      p_action => 'cms.featured_profile.published',
      p_object_type => 'cms_featured_profile_history', p_object_id => v_id::text,
      p_actor_kind => 'system', p_context => jsonb_build_object('date', v_day));
  end if;

  return jsonb_build_object('date', v_day, 'published', v_id is not null, 'ran_at', now());
end
$$;

revoke all on function private.publish_featured_profile(date) from public, anon, authenticated;

comment on function private.publish_featured_profile(date) is
  'Publie la selection du jour si le profil est TOUJOURS eligible au moment de publier (addendum §20, §21). Idempotente : la clause status = scheduled rend la seconde execution sans effet.';

-- ---------------------------------------------------------------------
-- 10. OVERRIDES « ISE DU JOUR » DEPUIS LE CMS (addendum §22 ; CDC §20)
--     Toute intervention manuelle est auditee.
-- ---------------------------------------------------------------------
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
  if not exists (select 1 from public.ise_profiles p where p.id = p_profile_id and p.deleted_at is null) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not private.featured_profile_eligible(p_profile_id, null) then
    raise exception 'profile_not_eligible' using errcode = 'P0001';
  end if;

  insert into public.cms_content_overrides
    (section_key, override_kind, entity_type, entity_id, starts_at, ends_at, reason, created_by_profile_id)
  values ('featured_profile', 'pin', 'profile', p_profile_id, p_starts_at, p_ends_at, p_reason, v_actor)
  returning id into v_id;

  perform private.log_audit(
    p_action => 'cms.featured_profile.override',
    p_object_type => 'ise_profile', p_object_id => p_profile_id::text,
    p_context => jsonb_build_object('override_id', v_id, 'starts_at', p_starts_at,
                                    'ends_at', p_ends_at, 'reason', p_reason));

  return jsonb_build_object('override_id', v_id, 'profile_id', p_profile_id,
                            'starts_at', p_starts_at, 'ends_at', p_ends_at);
end
$$;

revoke all on function public.override_featured_profile(uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.override_featured_profile(uuid, timestamptz, timestamptz, text) to authenticated;

comment on function public.override_featured_profile(uuid, timestamptz, timestamptz, text) is
  'Force un profil comme « ISE du jour » sur une periode bornee (addendum §22). Refuse un profil non eligible : l''override ne contourne pas le consentement. Audite.';

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
  'Exclut temporairement un profil de « ISE du jour » (addendum §22). L''exclusion est un acte editorial date et audite, pas un attribut du profil.';

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
  if p_enabled then
    update public.cms_content_overrides
       set ends_at = now()
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
  'Suspend ou reprend l''automatisation de « ISE du jour » (addendum §22). La reprise clot les epinglages en cours pour que la source automatique redevienne effective (§43).';

-- ---------------------------------------------------------------------
-- 11. POINT D'ENTREE UNIQUE DES AUTOMATISATIONS (addendum §42)
--
--     Cette fonction est le point d'appel unique, quel que soit
--     l'ordonnanceur retenu : pg_cron, Supabase Scheduled Function, ou cron
--     externe appelant le RPC avec la cle service_role. Voir 0060 et
--     docs/cms-automation.md pour l'etat REEL de la planification.
--     Elle est idempotente : l'appeler dix fois par heure est sans danger.
-- ---------------------------------------------------------------------
create or replace function public.run_cms_automations()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_schedule jsonb;
  v_expire   jsonb;
  v_select   jsonb;
  v_publish  jsonb;
begin
  if (select auth.uid()) is not null then
    if not private.has_permission('ops.manage') then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
  elsif current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  v_expire   := private.expire_cms_content();
  v_schedule := private.publish_scheduled_cms_content();
  v_select   := private.run_daily_featured_profile();
  v_publish  := private.publish_featured_profile();

  return jsonb_build_object('expire', v_expire, 'schedule', v_schedule,
                            'featured_profile_selection', v_select,
                            'featured_profile_publication', v_publish,
                            'ran_at', now());
end
$$;

revoke all on function public.run_cms_automations() from public, anon;
grant execute on function public.run_cms_automations() to authenticated, service_role;

comment on function public.run_cms_automations() is
  'Point d''appel unique des automatisations CMS (addendum §42). Idempotent. Exige ops.manage pour un appelant authentifie, ou l''identite service_role pour un ordonnanceur externe. Voir docs/cms-automation.md.';

-- ---------------------------------------------------------------------
-- 12. ORDONNANCEMENT
--
--     Le bloc ci-dessous installe pg_cron et tente la planification.
--     RESULTAT REEL CONSTATE : l'extension a bien ete creee, mais la garde
--     `to_regproc('cron.schedule(text,text,text)')` rend NULL — to_regproc
--     n'accepte pas de liste d'arguments (il aurait fallu to_regprocedure).
--     Le bloc est donc sorti avant de planifier quoi que ce soit. La
--     planification reelle est faite par la migration 0060, qui corrige la
--     garde. On ne pretend jamais qu'une tache tourne : voir
--     docs/cms-automation.md.
-- ---------------------------------------------------------------------
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron indisponible (%): ordonnancement externe requis', sqlerrm;
    return;
  end;

  if to_regproc('cron.schedule(text,text,text)') is null then
    raise notice 'pg_cron installe sans cron.schedule : ordonnancement externe requis';
    return;
  end if;

  perform cron.unschedule(jobname)
    from cron.job
   where jobname in ('cms_expire_content', 'cms_publish_scheduled',
                     'cms_select_featured_profile', 'cms_publish_featured_profile');

  perform cron.schedule('cms_expire_content',           '*/10 * * * *', 'select private.expire_cms_content()');
  perform cron.schedule('cms_publish_scheduled',        '*/10 * * * *', 'select private.publish_scheduled_cms_content()');
  perform cron.schedule('cms_select_featured_profile',  '30 5 * * *',   'select private.run_daily_featured_profile()');
  perform cron.schedule('cms_publish_featured_profile', '0 6 * * *',    'select private.publish_featured_profile()');
end $$;
