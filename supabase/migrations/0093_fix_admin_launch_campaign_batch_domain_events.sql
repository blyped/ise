-- 0093 : corrige admin_launch_campaign_batch (0092) -- le type d'evenement
-- 'promotion.campaign_batch_sent' n'existe pas dans domain_event_types
-- (FK), provoquant une erreur 23503. Reutilise 'promotion.invitation_created'
-- (deja enregistre, 0070), une ligne par invitation creee dans le lot --
-- coherent avec le flux membre (ISE-070), qui utilise le meme type.
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
