-- =========================================================================
-- 0115 — domain_events manquants : candidatures et recommandations
-- =========================================================================
-- Constat (docs/journal-session-2026-08-12.md, docs/journal-session-2026-08-13.md,
-- commentaire d'origine dans 0105_notification_consumer.sql) : ni
-- `submit_application`, ni `declare_external_application`, ni
-- `transition_application_status`, ni la creation d'une demande de
-- recommandation (`recommendation_requests`, insert direct cote client) ne
-- deposaient de ligne dans `public.domain_events`. Consequence directe :
-- le consommateur de notifications (0105) ne pouvait rien relayer pour ces
-- deux familles d'usage, quel que soit son propre code.
--
-- Cette migration :
--   1. ajoute les codes `domain_event_types` manquants ;
--   2. reprend `submit_application`, `declare_external_application` et
--      `transition_application_status` (0008) a l'identique, en n'ajoutant
--      que l'`insert into public.domain_events (...)` manquant ;
--   3. reprend `respond_recommendation_request` (0085) a l'identique, avec
--      la meme addition sur ses trois issues (accepter / decliner / retirer) ;
--   4. cree un trigger AFTER INSERT sur `recommendation_requests`, puisque sa
--      creation n'est pas mediee par une fonction RPC mais par un insert
--      direct cote client protege par RLS (0021) — aucun changement du
--      chemin d'ecriture existant n'est necessaire.
-- Aucune table applicative n'est modifiee. Aucune donnee existante n'est
-- retro-alimentee : seuls les evenements futurs sont couverts (D27 §MASTER
-- PROMPT sur la non-reecriture de l'historique).
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1. Nouveaux codes `domain_event_types`.
-- ---------------------------------------------------------------------
-- `application.submitted` (0018), `application.selected` (0018),
-- `application.declared_external` (0056), `application.status_declared` (0056)
-- et `application.withdrawn` (0056) existent deja et n'etaient jamais emis :
-- ils sont reutilises tels quels ci-dessous. Seul un code generique manque
-- pour les transitions pilotees par le recruteur ou l'administration qui ne
-- correspondent a aucun code specifique existant.
insert into public.domain_event_types (code, description, aggregate, sort_order) values
  ('application.status_changed',
   'Le recruteur ou l''administration a fait avancer le statut d''une candidature.',
   'application', 175),
  ('recommendation.requested',
   'Une demande de recommandation a ete envoyee.',
   'recommendation', 180),
  ('recommendation.request_answered',
   'Le destinataire a repondu a une demande de recommandation : redigee ou declinee.',
   'recommendation', 181),
  ('recommendation.withdrawn',
   'Le demandeur a retire sa demande de recommandation.',
   'recommendation', 182)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- 2. public.submit_application — ajout de l'evenement 'application.submitted'.
-- ---------------------------------------------------------------------
create or replace function public.submit_application(
  p_opportunity_id uuid,
  p_message        text default null,
  p_cv_document_id uuid default null
)
returns public.applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := private.current_profile_id();
  v_opp   public.opportunities;
  v_app   public.applications;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_opp from public.opportunities where id = p_opportunity_id for update;
  if not found or v_opp.deleted_at is not null then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;
  if v_opp.status <> 'active' then
    raise exception 'opportunity_not_open' using errcode = 'P0001';
  end if;
  if v_opp.application_mode <> 'internal' then
    raise exception 'external_application_must_be_declared' using errcode = 'P0001';
  end if;
  if v_opp.deadline is not null and v_opp.deadline <= now() then
    raise exception 'opportunity_deadline_passed' using errcode = 'P0001';
  end if;
  if v_opp.author_profile_id = v_me then
    raise exception 'cannot_apply_to_own_opportunity' using errcode = 'P0001';
  end if;

  -- Le CV joint doit appartenir au candidat (CA-OPP-07).
  if p_cv_document_id is not null then
    perform 1
       from public.profile_documents d
      where d.id = p_cv_document_id
        and d.profile_id = v_me
        and d.deleted_at is null;
    if not found then
      raise exception 'document_not_found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.applications (
    opportunity_id, applicant_profile_id, channel, is_self_declared,
    status, message, cv_document_id, submitted_at
  )
  values (p_opportunity_id, v_me, 'platform', false,
          'submitted', p_message, p_cv_document_id, now())
  on conflict on constraint applications_unique_pair do nothing
  returning * into v_app;

  if v_app.id is null then
    raise exception 'already_applied' using errcode = 'P0001';
  end if;

  insert into public.application_status_history (application_id, to_status, actor_profile_id, actor_kind)
  values (v_app.id, 'submitted', v_me, 'applicant');

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('application.submitted', 'application', v_app.id, v_me,
          jsonb_build_object('opportunity_id', p_opportunity_id));

  return v_app;
end
$$;

comment on function public.submit_application(uuid, text, uuid) is
  'Depose une candidature interne. Refuse les doublons (test 7) et les offres externes, dont le resultat ne peut pas etre constate (D-55).';

-- ---------------------------------------------------------------------
-- 3. public.declare_external_application — ajout de l'evenement
--    'application.declared_external'.
-- ---------------------------------------------------------------------
create or replace function public.declare_external_application(
  p_opportunity_id uuid,
  p_declared_at    timestamptz default now(),
  p_note           text default null
)
returns public.applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  uuid := private.current_profile_id();
  v_opp public.opportunities;
  v_app public.applications;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_declared_at is null or p_declared_at > now() then
    raise exception 'invalid_declared_date' using errcode = 'P0001';
  end if;

  select * into v_opp from public.opportunities where id = p_opportunity_id;
  if not found or v_opp.deleted_at is not null then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;

  insert into public.applications (
    opportunity_id, applicant_profile_id, channel, is_self_declared,
    status, message, submitted_at, declared_at
  )
  values (p_opportunity_id, v_me, 'external', true,
          'submitted', p_note, p_declared_at, p_declared_at)
  on conflict on constraint applications_unique_pair do nothing
  returning * into v_app;

  if v_app.id is null then
    raise exception 'already_applied' using errcode = 'P0001';
  end if;

  insert into public.application_status_history (application_id, to_status, actor_profile_id, actor_kind, note)
  values (v_app.id, 'submitted', v_me, 'applicant', p_note);

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('application.declared_external', 'application', v_app.id, v_me,
          jsonb_build_object('opportunity_id', p_opportunity_id));

  return v_app;
end
$$;

comment on function public.declare_external_application(uuid, timestamptz, text) is
  'Le membre declare avoir postule hors plateforme. Aucun clic ne cree cette ligne (D-55).';

-- ---------------------------------------------------------------------
-- 4. public.transition_application_status — ajout d'un evenement par
--    transition. Codes reutilises tels quels : 'application.withdrawn' et
--    'application.selected' (deja seedes, jamais emis) ; 'application.
--    status_declared' quand le CANDIDAT constate lui-meme une etape sur une
--    candidature auto-declaree (D-55) ; sinon le nouveau code generique
--    'application.status_changed' (recruteur ou administration).
-- ---------------------------------------------------------------------
create or replace function public.transition_application_status(
  p_application_id uuid,
  p_to_status      text,
  p_note           text default null
)
returns public.applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me           uuid := private.current_profile_id();
  v_app          public.applications;
  v_opp_author   uuid;
  v_opp_contact  uuid;
  v_from         text;
  v_is_applicant boolean;
  v_is_recruiter boolean;
  v_is_admin     boolean;
  v_actor_kind   text;
  v_allowed      boolean := false;
  v_event_type   text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_app from public.applications where id = p_application_id for update;
  if not found then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;

  select o.author_profile_id, o.contact_profile_id
    into v_opp_author, v_opp_contact
    from public.opportunities o
   where o.id = v_app.opportunity_id;

  v_from         := v_app.status;
  v_is_applicant := (v_app.applicant_profile_id = v_me);
  v_is_recruiter := (v_me is not distinct from v_opp_author)
                    or (v_me is not distinct from v_opp_contact);
  v_is_admin     := private.has_permission('opportunities.manage');

  if not (v_is_applicant or v_is_recruiter or v_is_admin) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  v_allowed := case
    -- Retrait : toujours a l'initiative du candidat, avant decision.
    when p_to_status = 'withdrawn'
      then v_is_applicant and v_from in ('submitted', 'viewed', 'under_review', 'interview')
    -- Etapes constatees par le recruteur sur une candidature interne.
    when p_to_status = 'viewed'
      then v_from = 'submitted' and (v_is_recruiter or (v_is_applicant and v_app.is_self_declared))
    when p_to_status = 'under_review'
      then v_from in ('submitted', 'viewed') and (v_is_recruiter or (v_is_applicant and v_app.is_self_declared))
    when p_to_status = 'interview'
      then v_from in ('viewed', 'under_review') and (v_is_recruiter or (v_is_applicant and v_app.is_self_declared))
    when p_to_status = 'selected'
      then v_from in ('under_review', 'interview') and (v_is_recruiter or (v_is_applicant and v_app.is_self_declared))
    when p_to_status = 'not_selected'
      then v_from in ('submitted', 'viewed', 'under_review', 'interview')
           and (v_is_recruiter or (v_is_applicant and v_app.is_self_declared))
    -- Cloture sans decision individuelle (offre fermee).
    when p_to_status = 'closed'
      then v_from in ('submitted', 'viewed', 'under_review', 'interview')
           and (v_is_recruiter or v_is_admin)
    else false
  end;

  -- D27 §109 : `not_selected` ne revient jamais automatiquement en arriere.
  -- Seule une correction administrative explicite le permet.
  if v_from = 'not_selected' then
    v_allowed := v_is_admin and p_to_status in ('under_review', 'interview');
  end if;

  if not v_allowed then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  v_actor_kind := case
    when v_is_applicant then 'applicant'
    when v_is_recruiter then 'recruiter'
    else 'admin'
  end;

  update public.applications
     set status       = p_to_status,
         viewed_at    = case when p_to_status = 'viewed' then coalesce(viewed_at, now()) else viewed_at end,
         reviewed_at  = case when p_to_status in ('under_review', 'interview') then coalesce(reviewed_at, now()) else reviewed_at end,
         decided_at   = case when p_to_status in ('selected', 'not_selected') then now() else decided_at end,
         withdrawn_at = case when p_to_status = 'withdrawn' then now() else withdrawn_at end
   where id = p_application_id
  returning * into v_app;

  insert into public.application_status_history (
    application_id, from_status, to_status, actor_profile_id, actor_kind, note
  )
  values (p_application_id, v_from, p_to_status, v_me, v_actor_kind, p_note);

  v_event_type := case
    when p_to_status = 'withdrawn' then 'application.withdrawn'
    when p_to_status = 'selected'  then 'application.selected'
    when v_is_applicant and v_app.is_self_declared then 'application.status_declared'
    else 'application.status_changed'
  end;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values (v_event_type, 'application', v_app.id, v_me,
          jsonb_build_object('from_status', v_from, 'to_status', p_to_status, 'actor_kind', v_actor_kind));

  return v_app;
end
$$;

comment on function public.transition_application_status(uuid, text, text) is
  'Machine d''etats des candidatures. Sur une candidature auto-declaree, seul le membre constate les etapes (D-55) ; un retour depuis not_selected exige opportunities.manage (D27 §109).';

-- ---------------------------------------------------------------------
-- 5. public.respond_recommendation_request — ajout d'un evenement sur
--    chacune des trois issues (retrait, refus, acceptation).
-- ---------------------------------------------------------------------
create or replace function public.respond_recommendation_request(
  p_request_id           uuid,
  p_action               text,
  p_body                 text default null,
  p_relationship_context text default null,
  p_engagement_context   text default null,
  p_skill_id             bigint default null,
  p_visibility           text default 'members'
)
returns uuid
language plpgsql
volatile
set search_path = ''
as $fn$
declare
  v_me  uuid := private.current_profile_id();
  v_req public.recommendation_requests;
  v_rec uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_action not in ('accept', 'decline', 'withdraw') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select * into v_req
    from public.recommendation_requests r
   where r.id = p_request_id
   for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'recommendation_request_closed' using errcode = 'P0001';
  end if;

  if p_action = 'withdraw' then
    if v_me <> v_req.requester_profile_id then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
    update public.recommendation_requests
       set status = 'withdrawn'
     where id = v_req.id;

    insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
    values ('recommendation.withdrawn', 'recommendation', v_req.id, v_me,
            jsonb_build_object('recipient_profile_id', v_req.recipient_profile_id));

    return v_req.id;
  end if;

  if v_me <> v_req.recipient_profile_id then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_action = 'decline' then
    update public.recommendation_requests
       set status = 'declined'
     where id = v_req.id;

    insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
    values ('recommendation.request_answered', 'recommendation', v_req.id, v_me,
            jsonb_build_object('decision', 'declined', 'requester_profile_id', v_req.requester_profile_id));

    return v_req.id;
  end if;

  -- Acceptation : ECRIRE le temoignage, aux bornes de la table (40-2000).
  if length(btrim(coalesce(p_body, ''))) not between 40 and 2000
     or coalesce(btrim(p_relationship_context), '') = ''
     or not public.is_visibility_level(coalesce(p_visibility, 'members')) then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  insert into public.recommendations
    (request_id, author_profile_id, subject_profile_id, relationship_context,
     engagement_context, skill_id, body, status, visibility)
  values
    (v_req.id, v_me, v_req.requester_profile_id, btrim(p_relationship_context),
     nullif(btrim(coalesce(p_engagement_context, '')), ''),
     coalesce(p_skill_id, v_req.skill_id), btrim(p_body), 'draft',
     coalesce(p_visibility, 'members'))
  returning id into v_rec;

  update public.recommendation_requests
     set status = 'accepted'
   where id = v_req.id;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('recommendation.request_answered', 'recommendation', v_req.id, v_me,
          jsonb_build_object('decision', 'accepted', 'recommendation_id', v_rec,
                             'requester_profile_id', v_req.requester_profile_id));

  return v_rec;
end
$fn$;

comment on function public.respond_recommendation_request(uuid, text, text, text, text, bigint, text) is
  'ISE-028 — accepter (= rediger, jamais un like, §19), decliner ou retirer une demande de '
  'recommandation. SECURITY INVOKER : la RLS de l''appelant fait foi. La recommandation nait '
  '`draft` : elle ne devient visible qu''apres validation par son sujet.';

revoke all on function public.respond_recommendation_request(uuid, text, text, text, text, bigint, text)
  from public, anon;
grant execute on function public.respond_recommendation_request(uuid, text, text, text, text, bigint, text)
  to authenticated;

-- ---------------------------------------------------------------------
-- 6. Creation d'une demande de recommandation — pas de fonction RPC
--    dediee (insert direct cote client, RLS `recommendation_requests_create`
--    de 0021) : un trigger AFTER INSERT emet l'evenement sans changer le
--    chemin d'ecriture existant.
-- ---------------------------------------------------------------------
create or replace function private.emit_recommendation_requested_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('recommendation.requested', 'recommendation', new.id, new.requester_profile_id,
          jsonb_build_object('recipient_profile_id', new.recipient_profile_id,
                             'skill_id', new.skill_id));
  return new;
end
$fn$;

comment on function private.emit_recommendation_requested_event() is
  'AFTER INSERT sur public.recommendation_requests : depose l''evenement de creation, absent '
  'jusqu''ici car la creation passe par un insert direct cote client (RLS 0021), sans RPC dediee.';

revoke all on function private.emit_recommendation_requested_event() from public, anon, authenticated;

drop trigger if exists trg_emit_recommendation_requested on public.recommendation_requests;
create trigger trg_emit_recommendation_requested
  after insert on public.recommendation_requests
  for each row execute function private.emit_recommendation_requested_event();

-- ---------------------------------------------------------------------
-- 7. Verification.
-- ---------------------------------------------------------------------
do $verify$
declare
  v_n integer;
begin
  select count(*) into v_n
  from public.domain_event_types
  where code in (
    'application.status_changed',
    'recommendation.requested',
    'recommendation.request_answered',
    'recommendation.withdrawn'
  );
  if v_n <> 4 then
    raise exception '0115: 4 nouveaux codes domain_event_types attendus, % trouve(s)', v_n;
  end if;

  select count(*) into v_n
  from pg_trigger
  where tgname = 'trg_emit_recommendation_requested'
    and tgrelid = 'public.recommendation_requests'::regclass;
  if v_n <> 1 then
    raise exception '0115: trigger trg_emit_recommendation_requested absent';
  end if;

  select count(*) into v_n from private.security_baseline_violations();
  if v_n <> 0 then
    raise exception '0115: security_baseline_violations() renvoie % ligne(s)', v_n;
  end if;

  select count(*) into v_n from private.storage_baseline_violations();
  if v_n <> 0 then
    raise exception '0115: storage_baseline_violations() renvoie % ligne(s)', v_n;
  end if;
end
$verify$;
