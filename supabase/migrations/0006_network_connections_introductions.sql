-- 0006_network_connections_introductions
-- Applique le 2026-08-08 (version 20260808003422)
-- Export fidele de la migration appliquee. Ne pas editer : creer une nouvelle migration.
-- Relations professionnelles et introductions.
-- MASTER PROMPT §23, §24, §25, §54, §100 ; docs/decisions.md D-50, D-51.
-- Pas de modele followers/following : une relation est une connexion acceptee.

create table if not exists public.connection_requests (
  id                   uuid primary key default extensions.gen_random_uuid(),
  requester_profile_id uuid not null references public.ise_profiles(id) on delete cascade,
  addressee_profile_id uuid not null references public.ise_profiles(id) on delete cascade,
  message              text check (message is null or length(message) <= 600),
  context              text check (context is null or context in
                         ('promotion', 'organization', 'sector', 'event', 'project',
                          'network_call', 'opportunity', 'introduction', 'other')),
  status               text not null default 'pending'
                         check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'expired')),
  responded_at         timestamptz,
  expires_at           timestamptz not null default (now() + interval '30 days'),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint connection_requests_not_self check (requester_profile_id <> addressee_profile_id)
);

-- Une seule demande en cours par paire, quel que soit le sens. MASTER PROMPT §100.
create unique index if not exists connection_requests_one_pending_per_pair
  on public.connection_requests(
    least(requester_profile_id, addressee_profile_id),
    greatest(requester_profile_id, addressee_profile_id)
  )
  where status = 'pending';
create index if not exists connection_requests_addressee_idx
  on public.connection_requests(addressee_profile_id, status, created_at desc);
create index if not exists connection_requests_requester_idx
  on public.connection_requests(requester_profile_id, status, created_at desc);
select private.attach_updated_at('public', 'connection_requests');

-- Relation acceptee. Stockee une seule fois, paire ordonnee (a < b).
create table if not exists public.connections (
  profile_a_id  uuid not null references public.ise_profiles(id) on delete cascade,
  profile_b_id  uuid not null references public.ise_profiles(id) on delete cascade,
  request_id    uuid references public.connection_requests(id) on delete set null,
  connected_at  timestamptz not null default now(),
  context       text,
  primary key (profile_a_id, profile_b_id),
  constraint connections_ordered_pair check (profile_a_id < profile_b_id)
);
create index if not exists connections_b_idx on public.connections(profile_b_id);

comment on table public.connections is
  'Relation professionnelle acceptee. Paire ordonnee (profile_a_id < profile_b_id) : une seule ligne par relation.';

-- Helper RLS : deux profils sont-ils en relation ? D-12.
create or replace function private.is_connected_to(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.connections c
    where (c.profile_a_id, c.profile_b_id) = (
            least(private.current_profile_id(), p_other),
            greatest(private.current_profile_id(), p_other)
          )
  )
$$;
grant execute on function private.is_connected_to(uuid) to authenticated;

-- Meme promotion ? Utilise par la visibilite 'promotion'. D-73.
create or replace function private.shares_promotion_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ise_profiles me, public.ise_profiles other
    where me.id = private.current_profile_id()
      and other.id = p_other
      and me.promotion_id is not null
      and me.promotion_id = other.promotion_id
  )
$$;
grant execute on function private.shares_promotion_with(uuid) to authenticated;

-- =====================================================================
-- Introductions. D-50, D-51.
-- Chemin limite a UN intermediaire : demandeur -> relation directe -> cible.
-- =====================================================================
create table if not exists public.introduction_requests (
  id                      uuid primary key default extensions.gen_random_uuid(),
  requester_profile_id    uuid not null references public.ise_profiles(id) on delete cascade,
  intermediary_profile_id uuid not null references public.ise_profiles(id) on delete cascade,
  target_profile_id       uuid not null references public.ise_profiles(id) on delete cascade,

  purpose                 text not null check (purpose in
                            ('advice', 'expertise', 'opportunity', 'consortium',
                             'mentorship', 'partnership', 'other')),
  message_to_intermediary text not null check (length(message_to_intermediary) between 20 and 1500),
  message_to_target       text check (message_to_target is null or length(message_to_target) <= 1500),

  -- D-50 : machine d'etats explicite. Transitions controlees par fonction atomique.
  status                  text not null default 'requested'
                            check (status in ('requested', 'intermediary_accepted', 'intermediary_declined',
                                              'withdrawn', 'expired', 'introduced', 'target_responded',
                                              'completed', 'no_outcome')),
  decline_reason          text,

  -- Bilan factuel. MASTER PROMPT §25 : les statuts refletent les faits constates.
  outcome                 text check (outcome is null or outcome in
                            ('exchange_held', 'collaboration_considered', 'collaboration_confirmed',
                             'no_response', 'not_relevant')),
  outcome_declared_by     uuid references public.ise_profiles(id) on delete set null,
  outcome_declared_at     timestamptz,
  outcome_note            text,

  intermediary_responded_at timestamptz,
  introduced_at           timestamptz,
  target_responded_at     timestamptz,
  completed_at            timestamptz,
  expires_at              timestamptz not null default (now() + interval '14 days'),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint introduction_distinct_actors check (
    requester_profile_id <> intermediary_profile_id
    and requester_profile_id <> target_profile_id
    and intermediary_profile_id <> target_profile_id
  )
);

-- Une seule demande active par triplet.
create unique index if not exists introduction_requests_one_active
  on public.introduction_requests(requester_profile_id, intermediary_profile_id, target_profile_id)
  where status in ('requested', 'intermediary_accepted', 'introduced', 'target_responded');
create index if not exists introduction_requests_intermediary_idx
  on public.introduction_requests(intermediary_profile_id, status, created_at desc);
create index if not exists introduction_requests_requester_idx
  on public.introduction_requests(requester_profile_id, status, created_at desc);
create index if not exists introduction_requests_target_idx
  on public.introduction_requests(target_profile_id, status);
select private.attach_updated_at('public', 'introduction_requests');

comment on column public.introduction_requests.status is
  'D-50. Aucune transition hors de la machine d''etats. « introduced » n''implique jamais « completed ».';

-- Journal factuel des evenements d'une introduction.
create table if not exists public.introduction_events (
  id              uuid primary key default extensions.gen_random_uuid(),
  introduction_id uuid not null references public.introduction_requests(id) on delete cascade,
  event_type      text not null check (event_type in
                    ('requested', 'intermediary_accepted', 'intermediary_declined', 'withdrawn',
                     'expired', 'introduced', 'target_responded', 'outcome_declared')),
  actor_profile_id uuid references public.ise_profiles(id) on delete set null,
  from_status     text,
  to_status       text,
  note            text,
  created_at      timestamptz not null default now()
);
create index if not exists introduction_events_intro_idx
  on public.introduction_events(introduction_id, created_at);

-- =====================================================================
-- Transitions atomiques. MASTER PROMPT §53, §100.
-- Toute mutation sensible valide : acteur, permission, etat courant,
-- transition autorisee, unicite, transaction, evenement.
-- =====================================================================

create or replace function public.accept_connection_request(p_request_id uuid)
returns public.connections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := private.current_profile_id();
  v_req     public.connection_requests;
  v_conn    public.connections;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Verrouille la demande : deux acceptations simultanees ne peuvent pas
  -- creer deux relations (MASTER PROMPT §100).
  select * into v_req
  from public.connection_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'request_not_found' using errcode = 'P0002';
  end if;
  if v_req.addressee_profile_id <> v_me then
    raise exception 'not_addressee' using errcode = '42501';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if v_req.expires_at <= now() then
    update public.connection_requests set status = 'expired' where id = p_request_id;
    raise exception 'request_expired' using errcode = 'P0001';
  end if;

  update public.connection_requests
     set status = 'accepted', responded_at = now()
   where id = p_request_id;

  insert into public.connections (profile_a_id, profile_b_id, request_id, context)
  values (
    least(v_req.requester_profile_id, v_req.addressee_profile_id),
    greatest(v_req.requester_profile_id, v_req.addressee_profile_id),
    v_req.id,
    v_req.context
  )
  on conflict (profile_a_id, profile_b_id) do nothing
  returning * into v_conn;

  if v_conn is null then
    select * into v_conn from public.connections
    where profile_a_id = least(v_req.requester_profile_id, v_req.addressee_profile_id)
      and profile_b_id = greatest(v_req.requester_profile_id, v_req.addressee_profile_id);
  end if;

  return v_conn;
end
$$;
grant execute on function public.accept_connection_request(uuid) to authenticated;

create or replace function public.transition_introduction(
  p_introduction_id uuid,
  p_to_status       text,
  p_note            text default null
)
returns public.introduction_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := private.current_profile_id();
  v_intro public.introduction_requests;
  v_allowed boolean := false;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_intro from public.introduction_requests where id = p_introduction_id for update;
  if not found then
    raise exception 'introduction_not_found' using errcode = 'P0002';
  end if;

  -- Matrice de transitions autorisees, par acteur. D-50.
  v_allowed := case
    when p_to_status = 'intermediary_accepted'
      then v_intro.status = 'requested' and v_me = v_intro.intermediary_profile_id
    when p_to_status = 'intermediary_declined'
      then v_intro.status = 'requested' and v_me = v_intro.intermediary_profile_id
    when p_to_status = 'withdrawn'
      then v_intro.status in ('requested', 'intermediary_accepted') and v_me = v_intro.requester_profile_id
    when p_to_status = 'introduced'
      then v_intro.status = 'intermediary_accepted' and v_me = v_intro.intermediary_profile_id
    when p_to_status = 'target_responded'
      then v_intro.status = 'introduced' and v_me in (v_intro.target_profile_id, v_intro.requester_profile_id)
    when p_to_status = 'completed'
      then v_intro.status = 'target_responded' and v_me in (v_intro.requester_profile_id, v_intro.target_profile_id)
    when p_to_status = 'no_outcome'
      then v_intro.status in ('introduced', 'target_responded') and v_me = v_intro.requester_profile_id
    else false
  end;

  if not v_allowed then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  update public.introduction_requests
     set status = p_to_status,
         intermediary_responded_at = case when p_to_status in ('intermediary_accepted','intermediary_declined')
                                          then now() else intermediary_responded_at end,
         introduced_at            = case when p_to_status = 'introduced'        then now() else introduced_at end,
         target_responded_at      = case when p_to_status = 'target_responded'  then now() else target_responded_at end,
         completed_at             = case when p_to_status = 'completed'         then now() else completed_at end,
         decline_reason           = case when p_to_status = 'intermediary_declined' then p_note else decline_reason end
   where id = p_introduction_id
  returning * into v_intro;

  insert into public.introduction_events (introduction_id, event_type, actor_profile_id, to_status, note)
  values (p_introduction_id, p_to_status, v_me, p_to_status, p_note);

  return v_intro;
end
$$;
grant execute on function public.transition_introduction(uuid, text, text) to authenticated;
