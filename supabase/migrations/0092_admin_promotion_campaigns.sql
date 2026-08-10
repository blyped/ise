-- 0092_admin_promotion_campaigns.sql
--
-- SA-011 (suivi individuel des invitations d'une promotion), SA-012 a
-- SA-015 (campagnes d'invitation en masse : creation, apercu/lancement,
-- suivi, cloture/bilan). S'appuie sur `public.promotion_activation_campaigns`
-- (deja creee en 0011, protegee par la policy RLS `promotions.manage`
-- depuis 0050, mais jamais consommee par aucune fonction ni ecran) :
-- aucune nouvelle table de campagne n'est necessaire.
--
-- Perimetre V1 assume : le lancement en masse (`admin_launch_campaign_batch`)
-- n'est ouvert qu'aux campagnes `channel = 'email'`. Le canal `in_app`
-- reste creable (contrainte existante de la table) mais son lancement en
-- masse est refuse explicitement : exposer plusieurs dizaines de jetons
-- en clair a l'ecran sans les envoyer nulle part serait plus risque que
-- de ne pas le construire (cf. `admin_merge_profiles`/decision C-08 :
-- ne pas construire ce qui introduit un risque non maitrise).
--
-- Meme discipline que le flux membre (ISE-070, migration 0070) : le
-- jeton en clair n'existe qu'une fois, dans la reponse RPC, jamais
-- journalise ; la fonction re-utilise le meme hachage sha256.

-- ---------------------------------------------------------------------
-- 1. Rattachement d'une invitation a une campagne (nullable : les
--    invitations individuelles ISE-070 restent hors campagne).
-- ---------------------------------------------------------------------
alter table public.promotion_invitations
  add column if not exists campaign_id uuid references public.promotion_activation_campaigns(id) on delete set null;

create index if not exists promotion_invitations_campaign_idx
  on public.promotion_invitations(campaign_id) where campaign_id is not null;

comment on column public.promotion_invitations.campaign_id is
  'SA-011->015. Renseigne quand l''invitation a ete generee par une campagne (admin_launch_campaign_batch, 0092). NULL pour les invitations individuelles ISE-070.';

-- ---------------------------------------------------------------------
-- 2. SA-011 : liste des invitations d'une promotion (oversight admin,
--    tous emetteurs confondus -- distinct du suivi personnel ISE-071).
-- ---------------------------------------------------------------------
create or replace function public.admin_list_promotion_invitations(
  p_promotion_id bigint,
  p_status text default null,
  p_cursor text default null,
  p_limit integer default 25
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  v_cur_ts timestamptz; v_cur_id uuid;
  v_rows jsonb; v_next text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('promotions.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('sent','opened','claimed','expired','revoked') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_cursor is not null then
    begin
      v_cur_ts := split_part(p_cursor, '|', 1)::timestamptz;
      v_cur_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then
      raise exception 'validation_failed' using errcode = 'P0001';
    end;
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) - 'cur' order by r.created_at desc, r.id desc), '[]'::jsonb),
         case when count(*) = v_limit then max(r.cur) filter (where r.rn = v_limit) end
    into v_rows, v_next
  from (
    select i.id, i.status, i.created_at, i.opened_at, i.claimed_at, i.expires_at, i.campaign_id,
           p.id as profile_id, p.display_name,
           inv.display_name as inviter_name,
           i.created_at::text || '|' || i.id::text as cur,
           row_number() over (order by i.created_at desc, i.id desc) as rn
    from public.promotion_invitations i
    join public.ise_profiles p on p.id = i.profile_id
    left join public.ise_profiles inv on inv.id = i.inviter_profile_id
    where i.promotion_id = p_promotion_id
      and (p_status is null or i.status = p_status)
      and (v_cur_ts is null or (i.created_at, i.id) < (v_cur_ts, v_cur_id))
    order by i.created_at desc, i.id desc
    limit v_limit
  ) r;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end;
$$;

revoke all on function public.admin_list_promotion_invitations(bigint, text, text, integer) from public, anon;
grant execute on function public.admin_list_promotion_invitations(bigint, text, text, integer) to authenticated;

comment on function public.admin_list_promotion_invitations(bigint, text, text, integer) is
  'SA-011. Liste (oversight) de toutes les invitations d''une promotion, tous emetteurs confondus. Exige promotions.manage.';

-- ---------------------------------------------------------------------
-- 3. SA-012 : creation d'une campagne (draft)
-- ---------------------------------------------------------------------
create or replace function public.admin_create_campaign(
  p_promotion_id bigint,
  p_name text,
  p_objective text default null,
  p_channel text default 'email',
  p_daily_quota integer default 20,
  p_total_quota integer default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('promotions.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.promotions where id = p_promotion_id) then
    raise exception 'promotion_not_found' using errcode = 'P0002';
  end if;
  if length(btrim(coalesce(p_name, ''))) < 3 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_channel not in ('in_app', 'email') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_daily_quota is null or p_daily_quota < 1 or p_daily_quota > 200 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_total_quota is not null and p_total_quota < 1 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  insert into public.promotion_activation_campaigns
    (promotion_id, created_by_profile_id, name, objective, channel, daily_quota, total_quota, starts_at, ends_at)
  values
    (p_promotion_id, v_me, btrim(p_name), nullif(btrim(coalesce(p_objective, '')), ''), p_channel,
     p_daily_quota, p_total_quota, p_starts_at, p_ends_at)
  returning id into v_id;

  perform private.log_audit(p_action=>'admin.campaign_created', p_object_type=>'promotion_activation_campaign',
    p_object_id=>v_id::text, p_result=>'success', p_context=>jsonb_build_object('promotion_id', p_promotion_id));

  return jsonb_build_object('campaign_id', v_id);
end;
$$;

revoke all on function public.admin_create_campaign(bigint, text, text, text, integer, integer, timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_create_campaign(bigint, text, text, text, integer, integer, timestamptz, timestamptz) to authenticated;

comment on function public.admin_create_campaign(bigint, text, text, text, integer, integer, timestamptz, timestamptz) is
  'SA-012. Cree une campagne d''invitation (statut draft) sur promotion_activation_campaigns (0011). Exige promotions.manage.';

-- ---------------------------------------------------------------------
-- 4. SA-013/014 : lecture d'une campagne (apercu si draft, suivi si
--    lancee -- une seule fonction, l'ecran adapte son rendu au statut).
-- ---------------------------------------------------------------------
create or replace function public.admin_get_campaign(p_campaign_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_c public.promotion_activation_campaigns;
  v_promo public.promotions;
  v_stats record;
  v_eligible bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('promotions.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_c from public.promotion_activation_campaigns where id = p_campaign_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into v_promo from public.promotions where id = v_c.promotion_id;

  select
    count(*) filter (where status in ('sent','opened','claimed')) as sent,
    count(*) filter (where status in ('opened','claimed')) as opened,
    count(*) filter (where status = 'claimed') as claimed,
    count(*) filter (where status = 'expired') as expired,
    count(*) filter (where status = 'revoked') as revoked
  into v_stats
  from public.promotion_invitations where campaign_id = p_campaign_id;

  select count(*) into v_eligible
  from public.ise_profiles p
  join private.profile_contacts pc on pc.profile_id = p.id and pc.primary_email is not null
  where p.promotion_id = v_c.promotion_id
    and p.deleted_at is null
    and p.profile_status <> 'archived'
    and p.claim_status = 'unclaimed'
    and not exists (
      select 1 from public.promotion_invitations i
      where i.profile_id = p.id and i.status in ('sent','opened') and i.expires_at > now()
    );

  return jsonb_build_object(
    'campaignId', v_c.id, 'promotionId', v_c.promotion_id, 'promotionName', v_promo.name,
    'name', v_c.name, 'objective', v_c.objective, 'channel', v_c.channel, 'status', v_c.status,
    'dailyQuota', v_c.daily_quota, 'totalQuota', v_c.total_quota, 'sentCount', v_c.sent_count,
    'startsAt', v_c.starts_at, 'endsAt', v_c.ends_at, 'createdAt', v_c.created_at,
    'stats', jsonb_build_object(
      'sent', coalesce(v_stats.sent, 0), 'opened', coalesce(v_stats.opened, 0),
      'claimed', coalesce(v_stats.claimed, 0), 'expired', coalesce(v_stats.expired, 0),
      'revoked', coalesce(v_stats.revoked, 0)
    ),
    'eligibleTargets', v_eligible
  );
end;
$$;

revoke all on function public.admin_get_campaign(uuid) from public, anon;
grant execute on function public.admin_get_campaign(uuid) to authenticated;

comment on function public.admin_get_campaign(uuid) is
  'SA-013/SA-014. Detail + stats reelles d''une campagne (apercu si draft, suivi si lancee). Exige promotions.manage.';

-- ---------------------------------------------------------------------
-- 5. SA-013->014 : lancement d'un lot (respect strict des quotas)
-- ---------------------------------------------------------------------
create or replace function public.admin_launch_campaign_batch(p_campaign_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_c public.promotion_activation_campaigns;
  v_sent_today integer;
  v_remaining_daily integer;
  v_batch_size integer;
  v_invitations jsonb;
  v_count integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('promotions.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_c from public.promotion_activation_campaigns where id = p_campaign_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_c.status not in ('draft', 'scheduled', 'running', 'paused') then
    raise exception 'campaign_closed' using errcode = 'P0001';
  end if;
  if v_c.channel <> 'email' then
    raise exception 'channel_not_supported_for_bulk_launch' using errcode = 'P0001';
  end if;

  select count(*) into v_sent_today
  from public.promotion_invitations
  where campaign_id = p_campaign_id and created_at >= date_trunc('day', now());

  v_remaining_daily := greatest(v_c.daily_quota - v_sent_today, 0);
  v_batch_size := least(
    v_remaining_daily,
    case when v_c.total_quota is null then v_remaining_daily
         else greatest(v_c.total_quota - v_c.sent_count, 0) end,
    50
  );

  if v_batch_size <= 0 then
    raise exception 'quota_exhausted' using errcode = 'P0001';
  end if;

  with targets as materialized (
    select p.id as profile_id, p.first_name, pc.primary_email,
           encode(extensions.gen_random_bytes(24), 'hex') as token
    from public.ise_profiles p
    join private.profile_contacts pc on pc.profile_id = p.id and pc.primary_email is not null
    where p.promotion_id = v_c.promotion_id
      and p.deleted_at is null
      and p.profile_status <> 'archived'
      and p.claim_status = 'unclaimed'
      and not exists (
        select 1 from public.promotion_invitations i
        where i.profile_id = p.id and i.status in ('sent', 'opened') and i.expires_at > now()
      )
    order by p.created_at asc
    limit v_batch_size
    for update of p skip locked
  ),
  created as (
    insert into public.promotion_invitations
      (promotion_id, profile_id, inviter_profile_id, token_hash, status, expires_at, campaign_id)
    select v_c.promotion_id, t.profile_id, v_me,
           encode(extensions.digest(t.token, 'sha256'), 'hex'),
           'sent', now() + interval '14 days', p_campaign_id
    from targets t
    returning id, profile_id
  )
  select
    count(*),
    coalesce(jsonb_agg(jsonb_build_object(
      'invitationId', c.id, 'profileId', c.profile_id,
      'firstName', t.first_name, 'primaryEmail', t.primary_email, 'token', t.token
    )), '[]'::jsonb)
  into v_count, v_invitations
  from created c
  join targets t on t.profile_id = c.profile_id;

  update public.promotion_activation_campaigns
  set sent_count = sent_count + v_count,
      status = case when status in ('draft', 'scheduled') then 'running' else status end,
      starts_at = coalesce(starts_at, now())
  where id = p_campaign_id;

  perform private.log_audit(p_action=>'admin.campaign_batch_sent', p_object_type=>'promotion_activation_campaign',
    p_object_id=>p_campaign_id::text, p_result=>'success', p_context=>jsonb_build_object('sent_count', v_count));

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  select 'promotion.invitation_created', 'promotion', null, v_me,
         jsonb_build_object('invitation_id', inv->>'invitationId', 'promotion_id', v_c.promotion_id,
                             'campaign_id', p_campaign_id, 'channel', 'email')
  from jsonb_array_elements(v_invitations) inv;

  return jsonb_build_object('sent_count', v_count, 'invitations', v_invitations);
end;
$$;

revoke all on function public.admin_launch_campaign_batch(uuid) from public, anon;
grant execute on function public.admin_launch_campaign_batch(uuid) to authenticated;

comment on function public.admin_launch_campaign_batch(uuid) is
  'SA-013/SA-014. Lance un lot d''invitations (email uniquement), respecte daily_quota/total_quota, plafonne a 50/appel. Jetons en clair renvoyes UNE FOIS. Exige promotions.manage.';

-- ---------------------------------------------------------------------
-- 6. SA-014 : pause / reprise
-- ---------------------------------------------------------------------
create or replace function public.admin_pause_campaign(p_campaign_id uuid, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_n integer;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('promotions.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  update public.promotion_activation_campaigns set status = 'paused'
  where id = p_campaign_id and status = 'running';
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'not_found' using errcode = 'P0002'; end if;

  perform private.log_audit(p_action=>'admin.campaign_paused', p_object_type=>'promotion_activation_campaign',
    p_object_id=>p_campaign_id::text, p_result=>'success', p_context=>jsonb_build_object('reason', btrim(p_reason)));

  return jsonb_build_object('campaign_id', p_campaign_id, 'status', 'paused');
end;
$$;

revoke all on function public.admin_pause_campaign(uuid, text) from public, anon;
grant execute on function public.admin_pause_campaign(uuid, text) to authenticated;

comment on function public.admin_pause_campaign(uuid, text) is
  'SA-014. Met en pause une campagne en cours, motive. Exige promotions.manage.';

create or replace function public.admin_resume_campaign(p_campaign_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_n integer;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('promotions.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update public.promotion_activation_campaigns set status = 'running'
  where id = p_campaign_id and status = 'paused';
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'not_found' using errcode = 'P0002'; end if;

  perform private.log_audit(p_action=>'admin.campaign_resumed', p_object_type=>'promotion_activation_campaign',
    p_object_id=>p_campaign_id::text, p_result=>'success');

  return jsonb_build_object('campaign_id', p_campaign_id, 'status', 'running');
end;
$$;

revoke all on function public.admin_resume_campaign(uuid) from public, anon;
grant execute on function public.admin_resume_campaign(uuid) to authenticated;

comment on function public.admin_resume_campaign(uuid) is
  'SA-014. Reprend une campagne en pause. Exige promotions.manage.';

-- ---------------------------------------------------------------------
-- 7. SA-015 : cloture + bilan
-- ---------------------------------------------------------------------
create or replace function public.admin_close_campaign(p_campaign_id uuid, p_reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_c public.promotion_activation_campaigns;
  v_stats record;
  v_new_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('promotions.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select * into v_c from public.promotion_activation_campaigns where id = p_campaign_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_c.status in ('completed', 'cancelled') then
    raise exception 'campaign_already_closed' using errcode = 'P0001';
  end if;

  v_new_status := case when v_c.sent_count > 0 then 'completed' else 'cancelled' end;

  update public.promotion_activation_campaigns
  set status = v_new_status, ends_at = coalesce(ends_at, now())
  where id = p_campaign_id;

  select
    count(*) filter (where status in ('sent', 'opened', 'claimed')) as sent,
    count(*) filter (where status in ('opened', 'claimed')) as opened,
    count(*) filter (where status = 'claimed') as claimed
  into v_stats
  from public.promotion_invitations where campaign_id = p_campaign_id;

  perform private.log_audit(p_action=>'admin.campaign_closed', p_object_type=>'promotion_activation_campaign',
    p_object_id=>p_campaign_id::text, p_result=>'success',
    p_context=>jsonb_build_object('reason', btrim(p_reason), 'final_status', v_new_status));

  return jsonb_build_object(
    'campaign_id', p_campaign_id, 'status', v_new_status,
    'stats', jsonb_build_object('sent', coalesce(v_stats.sent, 0), 'opened', coalesce(v_stats.opened, 0), 'claimed', coalesce(v_stats.claimed, 0))
  );
end;
$$;

revoke all on function public.admin_close_campaign(uuid, text) from public, anon;
grant execute on function public.admin_close_campaign(uuid, text) to authenticated;

comment on function public.admin_close_campaign(uuid, text) is
  'SA-015. Cloture une campagne (completed si au moins un envoi, sinon cancelled) et renvoie le bilan reel. Exige promotions.manage.';

-- ---------------------------------------------------------------------
-- 8. SA-012 : liste des campagnes d'une promotion
-- ---------------------------------------------------------------------
create or replace function public.admin_list_campaigns(
  p_promotion_id bigint,
  p_cursor text default null,
  p_limit integer default 25
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  v_cur_ts timestamptz; v_cur_id uuid;
  v_rows jsonb; v_next text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('promotions.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_cursor is not null then
    begin
      v_cur_ts := split_part(p_cursor, '|', 1)::timestamptz;
      v_cur_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then
      raise exception 'validation_failed' using errcode = 'P0001';
    end;
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) - 'cur' order by r.created_at desc, r.id desc), '[]'::jsonb),
         case when count(*) = v_limit then max(r.cur) filter (where r.rn = v_limit) end
    into v_rows, v_next
  from (
    select c.id, c.name, c.status, c.channel, c.daily_quota, c.total_quota, c.sent_count,
           c.created_at, c.starts_at, c.ends_at,
           c.created_at::text || '|' || c.id::text as cur,
           row_number() over (order by c.created_at desc, c.id desc) as rn
    from public.promotion_activation_campaigns c
    where c.promotion_id = p_promotion_id
      and (v_cur_ts is null or (c.created_at, c.id) < (v_cur_ts, v_cur_id))
    order by c.created_at desc, c.id desc
    limit v_limit
  ) r;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end;
$$;

revoke all on function public.admin_list_campaigns(bigint, text, integer) from public, anon;
grant execute on function public.admin_list_campaigns(bigint, text, integer) to authenticated;

comment on function public.admin_list_campaigns(bigint, text, integer) is
  'SA-012. Liste paginee des campagnes d''une promotion. Exige promotions.manage.';
