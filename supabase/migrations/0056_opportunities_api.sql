-- =====================================================================
-- 0053_opportunities_api
--
-- Couche base de donnees de la tranche OPPORTUNITES
-- (ISE-055 -> ISE-066).
--
-- Les tables et quatre fonctions atomiques existent depuis 0008
-- (`submit_application`, `declare_external_application`,
-- `transition_application_status`, `close_opportunity`) ; les politiques
-- depuis 0041. Aucune des deux migrations n'est modifiee ici.
--
-- DEFAUT REEL CONSTATE ET CORRIGE. 0008 livre une machine d'etats
-- d'opportunite (`draft -> active -> paused / closed / expired /
-- cancelled / moderated`) mais AUCUNE fonction pour la parcourir, et
-- 0041 n'ouvre `UPDATE` que sur le brouillon. Consequence : une
-- opportunite creee ne pouvait JAMAIS etre publiee. Cette migration
-- ajoute donc `publish_opportunity`, `transition_opportunity` et
-- `moderate_opportunity`, sur le modele exact de 0007 : verrou de ligne,
-- matrice de transitions, codes d'erreur machine (D-102).
--
-- REGLE CARDINALE DE LA TRANCHE (MASTER PROMPT 27, D-55) --------------
-- La plateforme ne declare JAMAIS "candidature envoyee" a un organisme
-- externe. Trois consequences portees ici :
--   1. `record_opportunity_outbound_click()` enregistre un CLIC. Elle
--      renvoie explicitement `is_application = false` et n'ecrit
--      aucune ligne dans `applications`. C'est un fait technique.
--   2. Le seul chemin vers une candidature externe reste
--      `declare_external_application()` (0008), appelee sur un geste
--      explicite du membre.
--   3. `get_opportunity()` renvoie `application_mode` et
--      `can_apply_internally` : l'interface doit distinguer "postuler
--      ici" de "consulter l'offre ailleurs", jamais les confondre.
--
-- References : MASTER PROMPT 15, 25, 27, 43, 47, 53, 64, 98, 100, 101,
--              113 ; D-40, D-41, D-42, D-43, D-44, D-55, D-73, D-93,
--              D-101, D-102, D-103.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Catalogue d'evenements de domaine
--
-- 0018 ne declarait que `opportunity.created`, `application.submitted`
-- et `application.selected`. Une declaration du membre (D-55) et une
-- publication ne sont pas des candidatures : sans code propre, elles
-- seraient indiscernables d'un fait constate par la plateforme.
-- ---------------------------------------------------------------------
insert into public.domain_event_types (code, description, aggregate, sort_order) values
  ('opportunity.published',
   'Une opportunite a ete publiee et son audience calculee.',            'opportunity', 91),
  ('opportunity.paused',
   'Une opportunite a ete mise en pause par son auteur.',                'opportunity', 92),
  ('opportunity.moderated',
   'Une opportunite a ete validee ou refusee par la moderation.',        'opportunity', 94),
  ('opportunity.closed',
   'Une opportunite a ete cloturee et son resultat enregistre.',         'opportunity', 93),
  ('application.declared_external',
   'Le membre DECLARE avoir postule hors plateforme (D-55).',            'application', 96),
  ('application.status_declared',
   'Le membre declare lui-meme une etape de sa candidature (D-55).',     'application', 97),
  ('application.withdrawn',
   'Le candidat a retire sa candidature.',                               'application', 98)
on conflict (code) do nothing;


-- =====================================================================
-- 1. Correspondance
-- =====================================================================

-- Criteres d'une opportunite, au format attendu par
-- `private.profile_match_set()` (0052).
--
-- ARBITRAGE identique a celui de 0052 pour la disponibilite : le type
-- d'opportunite est projete sur les types REELLEMENT declarables par un
-- membre (`availability_types`, 0025). `business`, `research` et
-- `scholarship` n'ont aucune contrepartie de disponibilite : elles ne
-- projettent rien, plutot qu'une correspondance inventee.
create or replace function private.opportunity_criteria(p_opportunity uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'required_skill_ids',  coalesce((select jsonb_agg(s.skill_id) from public.opportunity_skills s
                                      where s.opportunity_id = o.id and s.importance = 'required'), '[]'::jsonb),
    'preferred_skill_ids', coalesce((select jsonb_agg(s.skill_id) from public.opportunity_skills s
                                      where s.opportunity_id = o.id and s.importance = 'preferred'), '[]'::jsonb),
    'required_tool_ids',   coalesce((select jsonb_agg(t.tool_id) from public.opportunity_tools t
                                      where t.opportunity_id = o.id and t.importance = 'required'), '[]'::jsonb),
    'preferred_tool_ids',  coalesce((select jsonb_agg(t.tool_id) from public.opportunity_tools t
                                      where t.opportunity_id = o.id and t.importance = 'preferred'), '[]'::jsonb),
    'required_languages',  coalesce((select jsonb_agg(jsonb_build_object(
                                              'code', l.language_code,
                                              'min_proficiency', l.min_proficiency))
                                       from public.opportunity_languages l
                                      where l.opportunity_id = o.id and l.importance = 'required'), '[]'::jsonb),
    'preferred_languages', coalesce((select jsonb_agg(jsonb_build_object(
                                              'code', l.language_code,
                                              'min_proficiency', l.min_proficiency))
                                       from public.opportunity_languages l
                                      where l.opportunity_id = o.id and l.importance = 'preferred'), '[]'::jsonb),
    'sector_id',           o.sector_id,
    'sector_required',     (o.sector_importance = 'required'),
    'residence_country_codes',
      coalesce((select jsonb_agg(distinct k.code) from (
                 select n.country_code::text as code from public.opportunity_countries n
                  where n.opportunity_id = o.id and n.scope = 'residence'
                 union
                 select o.country_code::text where o.country_code is not null) k
                where k.code is not null), '[]'::jsonb),
    'experience_country_codes',
      coalesce((select jsonb_agg(n.country_code) from public.opportunity_countries n
                 where n.opportunity_id = o.id and n.scope = 'experience'), '[]'::jsonb),
    'geography_required',  exists (select 1 from public.opportunity_countries n
                                    where n.opportunity_id = o.id and n.importance = 'required'),
    'availability_types',
      coalesce((select jsonb_agg(distinct a.code) from (
                 select unnest(case o.opportunity_type
                                 when 'job'        then array['employment']
                                 when 'internship' then array['internship_hosting']
                                 when 'mission'    then array['mission','consulting','ad_hoc_expertise']
                                 else array[]::text[] end) as code) a), '[]'::jsonb),
    -- "Adapte aux jeunes diplomes" (D7 20) : dans ce cas l'anciennete
    -- minimale ne doit PAS ecarter une promotion sortante.
    'min_experience_years', case when o.suitable_for_new_graduates then null
                                 else o.min_experience_years end,
    'organization_id',      o.organization_id,
    'organization_required',false,
    'promotion_year_from',  null,
    'promotion_year_to',    null
  )
  from public.opportunities o
  where o.id = p_opportunity
$$;

revoke all on function private.opportunity_criteria(uuid) from public, anon, authenticated;


-- SECURITY DEFINER, motif B : ecrit `opportunity_matches`, table sans
-- politique d'ecriture cliente. Le score reste interne (0041 retire le
-- privilege de colonne a `authenticated`).
create or replace function public.compute_opportunity_matches(p_opportunity_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me    uuid := private.current_profile_id();
  v_opp   public.opportunities;
  v_count integer := 0;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_opp from public.opportunities where id = p_opportunity_id;
  if not found or v_opp.deleted_at is not null then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;
  if not private.is_opportunity_manager(p_opportunity_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  delete from public.opportunity_matches where opportunity_id = p_opportunity_id;

  insert into public.opportunity_matches
    (opportunity_id, profile_id, score, component_scores, reasons, missing_criteria,
     relevance_label, notification_tier, computed_at)
  select
    p_opportunity_id, m.profile_id, m.score, m.component_scores, m.reasons, m.missing_criteria,
    m.relevance_label,
    case when m.score >= 75 then 'immediate'
         when m.score >= 60 then 'digest'
         else 'none' end,
    now()
  from private.profile_match_set(v_opp.author_profile_id,
                                 private.opportunity_criteria(p_opportunity_id)) m
  where (
    not exists (select 1 from public.opportunity_audience_profiles ap
                 where ap.opportunity_id = p_opportunity_id)
    and not exists (select 1 from public.opportunity_audience_promotions aq
                     where aq.opportunity_id = p_opportunity_id)
  )
  or exists (select 1 from public.opportunity_audience_profiles ap
              where ap.opportunity_id = p_opportunity_id and ap.profile_id = m.profile_id)
  or exists (select 1 from public.opportunity_audience_promotions aq
              join public.ise_profiles p on p.id = m.profile_id
             where aq.opportunity_id = p_opportunity_id and p.promotion_id = aq.promotion_id);

  get diagnostics v_count = row_count;
  return v_count;
end
$fn$;

revoke all on function public.compute_opportunity_matches(uuid) from public, anon;
grant execute on function public.compute_opportunity_matches(uuid) to authenticated;


-- =====================================================================
-- 2. Machine d'etats de l'opportunite (absente de 0008)
-- =====================================================================

-- Publication. D7 62 : le niveau de confiance decide de la moderation.
--   auteur ISE verifie et offre interne -> `not_required`, visible tout de suite
--   offre relayee d'une source externe -> `pending`, invisible jusqu'a validation
-- Le statut passe a `active` dans les deux cas : `can_see_opportunity`
-- (0041) filtre deja sur `moderation_status`. L'auteur voit donc son
-- offre et son etat reel, sans qu'aucun tiers ne la voie avant validation.
create or replace function public.publish_opportunity(p_opportunity_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me       uuid := private.current_profile_id();
  v_opp      public.opportunities;
  v_from     text;
  v_verified boolean;
  v_mod      text;
  v_count    integer;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_opp from public.opportunities where id = p_opportunity_id for update;
  if not found or v_opp.deleted_at is not null then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;
  if v_opp.author_profile_id is distinct from v_me
     and not private.has_permission('opportunities.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_opp.status not in ('draft', 'paused', 'expired') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if v_opp.deadline is not null and v_opp.deadline <= now() then
    raise exception 'opportunity_deadline_passed' using errcode = 'P0001';
  end if;

  select (p.verification_status = 'verified') into v_verified
    from public.ise_profiles p where p.id = v_opp.author_profile_id;

  v_from := v_opp.status;
  v_mod  := case
              when v_opp.moderation_status = 'approved' then 'approved'
              when v_opp.origin = 'internal' and coalesce(v_verified, false) then 'not_required'
              else 'pending'
            end;

  update public.opportunities
     set status            = 'active',
         moderation_status = v_mod,
         published_at      = coalesce(published_at, now()),
         paused_at         = null
   where id = p_opportunity_id
  returning * into v_opp;

  v_count := public.compute_opportunity_matches(p_opportunity_id);

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('opportunity.published', 'opportunity', p_opportunity_id, v_me,
          jsonb_build_object('from_status', v_from, 'moderation_status', v_mod,
                             'targeted', v_count));

  return jsonb_build_object('opportunity_id', p_opportunity_id,
                            'moderation_status', v_mod,
                            'targeted', v_count);
end
$fn$;

revoke all on function public.publish_opportunity(uuid) from public, anon;
grant execute on function public.publish_opportunity(uuid) to authenticated;

comment on function public.publish_opportunity(uuid) is
  'Publie une opportunite. Une offre relayee d''une source externe reste `pending` jusqu''a validation (D7 62) : elle est visible de son auteur, de personne d''autre.';


-- Transitions non terminales. La CLOTURE passe obligatoirement par
-- `close_opportunity` (0008) : elle porte la declaration du resultat.
create or replace function public.transition_opportunity(
  p_opportunity_id uuid,
  p_to_status      text,
  p_note           text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me      uuid := private.current_profile_id();
  v_opp     public.opportunities;
  v_from    text;
  v_owner   boolean;
  v_allowed boolean := false;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_opp from public.opportunities where id = p_opportunity_id for update;
  if not found or v_opp.deleted_at is not null then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;

  v_from  := v_opp.status;
  v_owner := (v_opp.author_profile_id is not distinct from v_me);

  v_allowed := case
    when p_to_status = 'paused'    then v_from = 'active' and v_owner
    when p_to_status = 'cancelled' then v_from in ('draft','active','paused','expired') and v_owner
    when p_to_status = 'moderated' then v_from <> 'moderated'
                                        and private.has_permission('opportunities.manage')
    else false
  end;

  if not v_allowed then
    if not v_owner and not private.has_permission('opportunities.manage') then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  update public.opportunities
     set status    = p_to_status,
         paused_at = case when p_to_status = 'paused' then now() else paused_at end,
         closed_at = case when p_to_status = 'cancelled' then now() else closed_at end
   where id = p_opportunity_id;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values (case p_to_status
            when 'moderated' then 'opportunity.moderated'
            when 'paused'    then 'opportunity.paused'
            else 'opportunity.closed' end,
          'opportunity', p_opportunity_id, v_me,
          jsonb_build_object('from_status', v_from, 'to_status', p_to_status, 'note', p_note));

  return jsonb_build_object('opportunity_id', p_opportunity_id, 'status', p_to_status);
end
$fn$;

revoke all on function public.transition_opportunity(uuid, text, text) from public, anon;
grant execute on function public.transition_opportunity(uuid, text, text) to authenticated;


-- Validation ou refus par la moderation (SA-020). Ajoutee ici pour que
-- `pending` ne soit pas un cul-de-sac : sans elle, une offre relayee
-- resterait invisible pour toujours. L'ecran d'administration n'est pas
-- livre dans cette tranche.
create or replace function public.moderate_opportunity(
  p_opportunity_id uuid,
  p_decision       text,
  p_note           text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('opportunities.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  update public.opportunities
     set moderation_status = p_decision,
         status = case when p_decision = 'rejected' then 'moderated' else status end
   where id = p_opportunity_id and deleted_at is null;

  if not found then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;

  insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
  values ('opportunity.moderated', 'opportunity', p_opportunity_id, v_me,
          jsonb_build_object('decision', p_decision, 'note', p_note));

  return jsonb_build_object('opportunity_id', p_opportunity_id, 'moderation_status', p_decision);
end
$fn$;

revoke all on function public.moderate_opportunity(uuid, text, text) from public, anon;
grant execute on function public.moderate_opportunity(uuid, text, text) to authenticated;


-- =====================================================================
-- 3. Lectures
-- =====================================================================

-- ---------------------------------------------------------------------
-- private.opportunity_card(uuid, boolean)
--
-- SECURITY DEFINER motif A : appelle `private.network_profile_card()`.
--
-- REMUNERATION (D27 32) : jamais inventee. Les montants ne sont projetes
-- que si `compensation_disclosed` est vrai. Sinon la cle est ABSENTE, et
-- l'interface affiche "non precisee" -- elle ne recoit pas un zero.
--
-- MODE DE CANDIDATURE (D-55) : `application_mode` et
-- `can_apply_internally` sont toujours renvoyes. L'URL externe n'est
-- projetee que pour le mode `external_url` ; elle n'est jamais presentee
-- comme un depot de candidature.
-- ---------------------------------------------------------------------
create or replace function private.opportunity_card(p_opportunity uuid, p_full boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me  uuid := private.current_profile_id();
  v_o   public.opportunities;
  v_out jsonb;
begin
  select * into v_o from public.opportunities where id = p_opportunity;
  if not found then return null; end if;

  v_out := jsonb_build_object(
    'opportunity_id',   v_o.id,
    'opportunity_type', v_o.opportunity_type,
    'contract_type',    v_o.contract_type,
    'title',            v_o.title,
    'summary',          v_o.summary,
    'status',           v_o.status,
    'moderation_status',v_o.moderation_status,
    'visibility',       v_o.visibility,
    'origin',           v_o.origin,
    'source_type',      v_o.source_type,
    'source_verified',  (v_o.source_verified_at is not null),
    'organization',     coalesce((select org.canonical_name from public.organizations org
                                   where org.id = v_o.organization_id),
                                 v_o.organization_name_raw),
    'country',          (select cn.name_fr from public.countries cn where cn.code = v_o.country_code),
    'city',             v_o.city,
    'remote_mode',      v_o.remote_mode,
    'remote_allowed',   v_o.remote_allowed,
    'sector',           (select s.name from public.sectors s where s.id = v_o.sector_id),
    'job_function',     (select f.name from public.job_functions f where f.id = v_o.job_function_id),
    'experience_level', v_o.experience_level,
    'min_experience_years', v_o.min_experience_years,
    'suitable_for_new_graduates', v_o.suitable_for_new_graduates,
    'start_date',       v_o.start_date,
    'duration_days',    v_o.duration_days,
    'deadline',         v_o.deadline,
    'positions_count',  v_o.positions_count,
    'published_at',     v_o.published_at,
    'created_at',       v_o.created_at,
    'closed_at',        v_o.closed_at,
    'application_mode', v_o.application_mode,
    -- D-55 : seul le mode `internal` permet a la plateforme de constater
    -- le resultat. Partout ailleurs, elle ne peut que renvoyer vers la
    -- source et attendre la declaration du membre.
    'can_apply_internally', (v_o.application_mode = 'internal'),
    'is_manager',       private.is_opportunity_manager(v_o.id),
    'author',           private.network_profile_card(v_o.author_profile_id),
    'skills',           coalesce((select jsonb_agg(jsonb_build_object('name', s.name,
                                                                     'importance', os.importance)
                                                   order by os.importance, s.name)
                                    from public.opportunity_skills os
                                    join public.skills s on s.id = os.skill_id
                                   where os.opportunity_id = v_o.id), '[]'::jsonb),
    'is_saved',         exists (select 1 from public.saved_opportunities sv
                                 where sv.opportunity_id = v_o.id and sv.profile_id = v_me),
    -- Le libelle qualitatif et les raisons, jamais le score (D-42, D-43).
    'relevance',        (select jsonb_build_object('label', m.relevance_label, 'reasons', m.reasons)
                           from public.opportunity_matches m
                          where m.opportunity_id = v_o.id and m.profile_id = v_me),
    'my_application',   (select jsonb_build_object(
                                  'application_id',   a.id,
                                  'status',           a.status,
                                  'channel',          a.channel,
                                  'is_self_declared', a.is_self_declared,
                                  'submitted_at',     a.submitted_at)
                           from public.applications a
                          where a.opportunity_id = v_o.id and a.applicant_profile_id = v_me));

  if v_o.compensation_disclosed then
    v_out := v_out || jsonb_build_object(
      'compensation_min', v_o.compensation_min,
      'compensation_max', v_o.compensation_max,
      'currency',         v_o.currency);
  end if;

  if v_o.application_mode = 'external_url' then
    v_out := v_out || jsonb_build_object('external_application_url', v_o.external_application_url);
  end if;
  if v_o.application_mode = 'external_email' then
    v_out := v_out || jsonb_build_object('external_application_email', v_o.external_application_email);
  end if;
  if v_o.application_mode = 'contact_recruiter' then
    v_out := v_out || jsonb_build_object(
      'contact', private.network_profile_card(v_o.contact_profile_id));
  end if;

  if p_full then
    v_out := v_out || jsonb_build_object(
      'description', v_o.description,
      'source_url',  case when v_o.origin = 'external' then v_o.source_url end,
      'tools',     coalesce((select jsonb_agg(jsonb_build_object('name', t.name,
                                                                'importance', ot.importance)
                                              order by ot.importance, t.name)
                               from public.opportunity_tools ot
                               join public.tools t on t.id = ot.tool_id
                              where ot.opportunity_id = v_o.id), '[]'::jsonb),
      'languages', coalesce((select jsonb_agg(jsonb_build_object('name', lg.name_fr,
                                                                'min_proficiency', ol.min_proficiency,
                                                                'importance', ol.importance)
                                              order by ol.importance, lg.name_fr)
                               from public.opportunity_languages ol
                               join public.languages lg on lg.code = ol.language_code
                              where ol.opportunity_id = v_o.id), '[]'::jsonb),
      'countries', coalesce((select jsonb_agg(jsonb_build_object('name', cn.name_fr,
                                                                'scope', oc.scope,
                                                                'importance', oc.importance)
                                              order by oc.scope, cn.name_fr)
                               from public.opportunity_countries oc
                               join public.countries cn on cn.code = oc.country_code
                              where oc.opportunity_id = v_o.id), '[]'::jsonb),
      'questions', coalesce((select jsonb_agg(jsonb_build_object('question_id', q.id,
                                                                'question', q.question,
                                                                'is_required', q.is_required)
                                              order by q.display_order)
                               from public.opportunity_questions q
                              where q.opportunity_id = v_o.id), '[]'::jsonb),
      'audience_promotions', coalesce((select jsonb_agg(concat_ws(' ', pr.program_code,
                                                                  pr.graduation_year::text)
                                                        order by pr.graduation_year)
                                         from public.opportunity_audience_promotions ap
                                         join public.promotions pr on pr.id = ap.promotion_id
                                        where ap.opportunity_id = v_o.id), '[]'::jsonb),
      'outcome', (select jsonb_build_object(
                           'outcome_type',            oo.outcome_type,
                           'hires_count',             oo.hires_count,
                           'facilitated_by_platform', oo.facilitated_by_platform,
                           'attribution_level',       oo.attribution_level,
                           'notes',                   oo.notes)
                    from public.opportunity_outcomes oo where oo.opportunity_id = v_o.id));
  end if;

  return v_out;
end
$fn$;

revoke all on function private.opportunity_card(uuid, boolean) from public, anon, authenticated;

comment on function private.opportunity_card(uuid, boolean) is
  'Carte d''opportunite. La remuneration n''est projetee que si elle est reellement divulguee (D27 32). `can_apply_internally` porte la distinction D-55.';


-- ---------------------------------------------------------------------
-- ISE-055 / ISE-062 -- liste des opportunites
--   'for_you' correspondances reelles, classees par score interne
--   'all'     tout mon perimetre
--   'saved'   mes offres enregistrees (ISE-062)
-- ---------------------------------------------------------------------
create or replace function public.list_opportunities(
  p_scope            text    default 'for_you',
  p_query            text    default null,
  p_opportunity_type text    default null,
  p_sector_id        bigint  default null,
  p_country_code     char(2) default null,
  p_experience_level text    default null,
  p_remote_only      boolean default false,
  p_new_graduates    boolean default false,
  p_status           text    default 'open',
  p_cursor           text    default null,
  p_limit            integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me      uuid    := private.current_profile_id();
  v_limit   integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_scope   text    := coalesce(p_scope, 'for_you');
  v_q       text    := nullif(btrim(coalesce(p_query, '')), '');
  v_rows    jsonb   := '[]'::jsonb;
  v_next    text;
  v_c_at    timestamptz;
  v_c_id    uuid;
  v_c_score numeric;
begin
  if v_me is null or not private.is_active_member() then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_scope not in ('for_you', 'all', 'saved') then
    raise exception 'invalid_scope' using errcode = 'P0001';
  end if;

  if v_scope = 'for_you' then
    select c_score, c_id into v_c_score, v_c_id from private.decode_score_cursor(p_cursor);

    with base as (
      select o.id, m.score
      from public.opportunities o
      join public.opportunity_matches m on m.opportunity_id = o.id and m.profile_id = v_me
      where private.can_see_opportunity(o.id)
        and o.author_profile_id is distinct from v_me
        and (case when coalesce(p_status, 'open') = 'open'
                  then o.status = 'active'
                  else o.status in ('active','paused','closed','expired') end)
        and (p_opportunity_type is null or o.opportunity_type = p_opportunity_type)
        and (p_sector_id is null or o.sector_id = p_sector_id)
        and (p_country_code is null or o.country_code = p_country_code)
        and (p_experience_level is null or o.experience_level = p_experience_level)
        and (not coalesce(p_remote_only, false) or o.remote_allowed)
        and (not coalesce(p_new_graduates, false) or o.suitable_for_new_graduates)
        and (v_q is null or public.normalize_text(o.title) like '%' || public.normalize_text(v_q) || '%')
        and (v_c_score is null or (m.score, o.id) < (v_c_score, v_c_id))
      order by m.score desc, o.id desc
      limit v_limit
    )
    select coalesce(jsonb_agg(private.opportunity_card(b.id, false) order by b.score desc, b.id desc),
                    '[]'::jsonb),
           private.encode_score_cursor(min(b.score), (array_agg(b.id order by b.score, b.id))[1])
      into v_rows, v_next
    from base b;

    if jsonb_array_length(v_rows) < v_limit then v_next := null; end if;
    return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
  end if;

  select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

  with base as (
    select o.id, coalesce(o.published_at, o.created_at) as at
    from public.opportunities o
    where private.can_see_opportunity(o.id)
      and o.status in ('active','paused','closed','expired')
      and (case when coalesce(p_status, 'open') = 'open' then o.status = 'active' else true end)
      and (v_scope <> 'saved' or exists (select 1 from public.saved_opportunities sv
                                          where sv.opportunity_id = o.id and sv.profile_id = v_me))
      and (p_opportunity_type is null or o.opportunity_type = p_opportunity_type)
      and (p_sector_id is null or o.sector_id = p_sector_id)
      and (p_country_code is null or o.country_code = p_country_code)
      and (p_experience_level is null or o.experience_level = p_experience_level)
      and (not coalesce(p_remote_only, false) or o.remote_allowed)
      and (not coalesce(p_new_graduates, false) or o.suitable_for_new_graduates)
      and (v_q is null or public.normalize_text(o.title) like '%' || public.normalize_text(v_q) || '%')
      and (v_c_at is null or (coalesce(o.published_at, o.created_at), o.id) < (v_c_at, v_c_id))
    order by coalesce(o.published_at, o.created_at) desc, o.id desc
    limit v_limit
  )
  select coalesce(jsonb_agg(private.opportunity_card(b.id, false) order by b.at desc, b.id desc),
                  '[]'::jsonb),
         private.encode_keyset_cursor(min(b.at), (array_agg(b.id order by b.at, b.id))[1])
    into v_rows, v_next
  from base b;

  if jsonb_array_length(v_rows) < v_limit then v_next := null; end if;
  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$fn$;

revoke all on function public.list_opportunities(text, text, text, bigint, char(2), text, boolean, boolean, text, text, integer) from public, anon;
grant execute on function public.list_opportunities(text, text, text, bigint, char(2), text, boolean, boolean, text, text, integer) to authenticated;


-- ISE-056 -- detail d'une opportunite.
create or replace function public.get_opportunity(p_opportunity_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.can_see_opportunity(p_opportunity_id) then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;
  return private.opportunity_card(p_opportunity_id, true);
end
$fn$;

revoke all on function public.get_opportunity(uuid) from public, anon;
grant execute on function public.get_opportunity(uuid) to authenticated;


-- ISE-060 -- mes offres publiees, groupees par etat.
create or replace function public.list_my_opportunities(
  p_group  text    default 'active',
  p_cursor text    default null,
  p_limit  integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me    uuid    := private.current_profile_id();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_group text    := coalesce(p_group, 'active');
  v_rows  jsonb   := '[]'::jsonb;
  v_next  text;
  v_c_at  timestamptz;
  v_c_id  uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_group not in ('active', 'drafts', 'closed', 'expired') then
    raise exception 'invalid_scope' using errcode = 'P0001';
  end if;

  select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

  with base as (
    select o.id, coalesce(o.published_at, o.created_at) as at
    from public.opportunities o
    where o.author_profile_id = v_me
      and o.deleted_at is null
      and case v_group
            when 'active' then o.status in ('active','paused')
            when 'drafts' then o.status = 'draft'
            when 'closed' then o.status = 'closed'
            else o.status in ('expired','cancelled','moderated')
          end
      and (v_c_at is null or (coalesce(o.published_at, o.created_at), o.id) < (v_c_at, v_c_id))
    order by coalesce(o.published_at, o.created_at) desc, o.id desc
    limit v_limit
  )
  select coalesce(jsonb_agg(
           private.opportunity_card(b.id, false)
           || jsonb_build_object(
                'application_count',
                  (select count(*) from public.applications a
                    where a.opportunity_id = b.id and a.status <> 'draft'),
                'targeted_count',
                  (select count(*) from public.opportunity_matches m where m.opportunity_id = b.id),
                'strong_match_count',
                  (select count(*) from public.opportunity_matches m
                    where m.opportunity_id = b.id and m.relevance_label = 'very_relevant'))
           order by b.at desc, b.id desc), '[]'::jsonb),
         private.encode_keyset_cursor(min(b.at), (array_agg(b.id order by b.at, b.id))[1])
    into v_rows, v_next
  from base b;

  if jsonb_array_length(v_rows) < v_limit then v_next := null; end if;
  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$fn$;

revoke all on function public.list_my_opportunities(text, text, integer) from public, anon;
grant execute on function public.list_my_opportunities(text, text, integer) to authenticated;


-- ISE-058 / ISE-059 -- profils correspondants, vus par le responsable.
-- Libelle et raisons uniquement. Le score n'est jamais renvoye, et
-- AUCUN candidat n'est ecarte par un score : le classement est un outil
-- d'aide, pas un filtre automatique (CA-OPP-06, D7 91).
create or replace function public.list_opportunity_matches(
  p_opportunity_id uuid,
  p_cursor         text    default null,
  p_limit          integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me      uuid    := private.current_profile_id();
  v_limit   integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_rows    jsonb   := '[]'::jsonb;
  v_next    text;
  v_c_score numeric;
  v_c_id    uuid;
  v_total   bigint;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_opportunity_manager(p_opportunity_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select c_score, c_id into v_c_score, v_c_id from private.decode_score_cursor(p_cursor);

  select count(*) into v_total
    from public.opportunity_matches m
   where m.opportunity_id = p_opportunity_id
     and (v_c_score is null or (m.score, m.profile_id) < (v_c_score, v_c_id));

  with base as (
    select m.profile_id, m.score, m.relevance_label, m.reasons
    from public.opportunity_matches m
    where m.opportunity_id = p_opportunity_id
      and (v_c_score is null or (m.score, m.profile_id) < (v_c_score, v_c_id))
    order by m.score desc, m.profile_id desc
    limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
             'profile', private.network_profile_card(b.profile_id),
             'label',   b.relevance_label,
             'reasons', b.reasons)
           order by b.score desc, b.profile_id desc)
           filter (where private.network_profile_card(b.profile_id) is not null), '[]'::jsonb),
         private.encode_score_cursor(min(b.score),
                                     (array_agg(b.profile_id order by b.score, b.profile_id))[1])
    into v_rows, v_next
  from base b;

  if v_total <= v_limit then v_next := null; end if;
  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$fn$;

revoke all on function public.list_opportunity_matches(uuid, text, integer) from public, anon;
grant execute on function public.list_opportunity_matches(uuid, text, integer) to authenticated;


-- ISE-058 / ISE-059 -- apercu du ciblage avant publication.
create or replace function public.preview_opportunity_audience(p_opportunity_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_opportunity_manager(p_opportunity_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  perform public.compute_opportunity_matches(p_opportunity_id);

  return jsonb_build_object(
    'computed', true,
    'total',         (select count(*) from public.opportunity_matches m
                       where m.opportunity_id = p_opportunity_id),
    'very_relevant', (select count(*) from public.opportunity_matches m
                       where m.opportunity_id = p_opportunity_id and m.relevance_label = 'very_relevant'),
    'relevant',      (select count(*) from public.opportunity_matches m
                       where m.opportunity_id = p_opportunity_id and m.relevance_label = 'relevant'),
    'close_profile', (select count(*) from public.opportunity_matches m
                       where m.opportunity_id = p_opportunity_id and m.relevance_label = 'close_profile'),
    'samples',       coalesce((select jsonb_agg(jsonb_build_object(
                                        'profile', private.network_profile_card(x.profile_id),
                                        'label',   x.relevance_label,
                                        'reasons', x.reasons))
                                 from (select m.profile_id, m.relevance_label, m.reasons
                                         from public.opportunity_matches m
                                        where m.opportunity_id = p_opportunity_id
                                        order by m.score desc, m.profile_id desc
                                        limit 3) x
                                where private.network_profile_card(x.profile_id) is not null),
                              '[]'::jsonb));
end
$fn$;

revoke all on function public.preview_opportunity_audience(uuid) from public, anon;
grant execute on function public.preview_opportunity_audience(uuid) to authenticated;


-- ISE-060 -- candidatures recues. Le responsable ne voit JAMAIS le
-- brouillon d'un candidat (0041) ; un candidat ne voit jamais les
-- candidatures des autres, cette fonction ne lui etant pas ouverte.
create or replace function public.list_opportunity_applications(
  p_opportunity_id uuid,
  p_status         text    default null,
  p_cursor         text    default null,
  p_limit          integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me    uuid    := private.current_profile_id();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_rows  jsonb   := '[]'::jsonb;
  v_next  text;
  v_c_at  timestamptz;
  v_c_id  uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_opportunity_manager(p_opportunity_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

  with base as (
    select a.id, coalesce(a.submitted_at, a.created_at) as at
    from public.applications a
    where a.opportunity_id = p_opportunity_id
      and a.status <> 'draft'
      and (p_status is null or a.status = p_status)
      and (v_c_at is null or (coalesce(a.submitted_at, a.created_at), a.id) < (v_c_at, v_c_id))
    order by coalesce(a.submitted_at, a.created_at) desc, a.id desc
    limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
             'application_id',   a.id,
             'status',           a.status,
             'channel',          a.channel,
             'is_self_declared', a.is_self_declared,
             'message',          a.message,
             'submitted_at',     a.submitted_at,
             'has_cv',           (a.cv_document_id is not null),
             'applicant',        private.network_profile_card(a.applicant_profile_id),
             'relevance',        (select jsonb_build_object('label', m.relevance_label,
                                                            'reasons', m.reasons,
                                                            'missing', m.missing_criteria)
                                    from public.opportunity_matches m
                                   where m.opportunity_id = p_opportunity_id
                                     and m.profile_id = a.applicant_profile_id))
           order by b.at desc, b.id desc), '[]'::jsonb),
         private.encode_keyset_cursor(min(b.at), (array_agg(b.id order by b.at, b.id))[1])
    into v_rows, v_next
  from base b
  join public.applications a on a.id = b.id;

  if jsonb_array_length(v_rows) < v_limit then v_next := null; end if;
  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$fn$;

revoke all on function public.list_opportunity_applications(uuid, text, text, integer) from public, anon;
grant execute on function public.list_opportunity_applications(uuid, text, text, integer) to authenticated;


-- ISE-063 -- mes candidatures.
create or replace function public.list_my_applications(
  p_group  text    default 'in_progress',
  p_cursor text    default null,
  p_limit  integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me    uuid    := private.current_profile_id();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_group text    := coalesce(p_group, 'in_progress');
  v_rows  jsonb   := '[]'::jsonb;
  v_next  text;
  v_c_at  timestamptz;
  v_c_id  uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_group not in ('in_progress', 'finished', 'withdrawn', 'drafts') then
    raise exception 'invalid_scope' using errcode = 'P0001';
  end if;

  select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

  with base as (
    select a.id, coalesce(a.submitted_at, a.created_at) as at
    from public.applications a
    where a.applicant_profile_id = v_me
      and case v_group
            when 'in_progress' then a.status in ('submitted','viewed','under_review','interview')
            when 'finished'    then a.status in ('selected','not_selected','closed')
            when 'withdrawn'   then a.status = 'withdrawn'
            else a.status = 'draft'
          end
      and (v_c_at is null or (coalesce(a.submitted_at, a.created_at), a.id) < (v_c_at, v_c_id))
    order by coalesce(a.submitted_at, a.created_at) desc, a.id desc
    limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
             'application_id',   a.id,
             'status',           a.status,
             'channel',          a.channel,
             'is_self_declared', a.is_self_declared,
             'submitted_at',     a.submitted_at,
             'declared_at',      a.declared_at,
             'decided_at',       a.decided_at,
             'opportunity',      private.opportunity_card(a.opportunity_id, false))
           order by b.at desc, b.id desc), '[]'::jsonb),
         private.encode_keyset_cursor(min(b.at), (array_agg(b.id order by b.at, b.id))[1])
    into v_rows, v_next
  from base b
  join public.applications a on a.id = b.id;

  if jsonb_array_length(v_rows) < v_limit then v_next := null; end if;
  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end
$fn$;

revoke all on function public.list_my_applications(text, text, integer) from public, anon;
grant execute on function public.list_my_applications(text, text, integer) to authenticated;


-- ISE-064 / ISE-065 / ISE-066 -- detail d'une candidature.
--
-- `allowed_transitions` est calcule EN BASE, exactement selon la matrice
-- de `transition_application_status` (0008). L'interface ne devine
-- jamais ce qui est possible : elle n'affiche que ce que la base
-- accepterait. Un bouton sans transition possible n'existe pas.
--
-- D-55 : sur une candidature auto-declaree, les etapes sont declarees
-- par le MEMBRE. Le champ `steps_are_self_declared` le dit explicitement
-- pour que l'ecran ne presente jamais une declaration comme un constat.
create or replace function public.get_application(p_application_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me  uuid := private.current_profile_id();
  v_a   public.applications;
  v_is_applicant boolean;
  v_is_manager   boolean;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.can_see_application(p_application_id) then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;

  select * into v_a from public.applications where id = p_application_id;
  v_is_applicant := (v_a.applicant_profile_id = v_me);
  v_is_manager   := private.is_opportunity_manager(v_a.opportunity_id);

  return jsonb_build_object(
    'application_id',   v_a.id,
    'status',           v_a.status,
    'channel',          v_a.channel,
    'is_self_declared', v_a.is_self_declared,
    'steps_are_self_declared', (v_a.is_self_declared and v_is_applicant),
    'is_applicant',     v_is_applicant,
    'is_manager',       v_is_manager,
    'message',          v_a.message,
    'submitted_at',     v_a.submitted_at,
    'declared_at',      v_a.declared_at,
    'viewed_at',        v_a.viewed_at,
    'reviewed_at',      v_a.reviewed_at,
    'decided_at',       v_a.decided_at,
    'withdrawn_at',     v_a.withdrawn_at,
    'opportunity',      private.opportunity_card(v_a.opportunity_id, false),
    'applicant',        case when v_is_manager
                             then private.network_profile_card(v_a.applicant_profile_id) end,
    'documents', coalesce((select jsonb_agg(jsonb_build_object(
                                    'document_id', d.id,
                                    'role',        ad.role,
                                    'title',       d.title,
                                    'filename',    d.original_filename,
                                    'created_at',  d.created_at)
                                  order by ad.role)
                             from public.application_documents ad
                             join public.profile_documents d on d.id = ad.document_id
                            where ad.application_id = v_a.id), '[]'::jsonb),
    'answers', coalesce((select jsonb_agg(jsonb_build_object(
                                  'question', q.question,
                                  'answer',   an.answer)
                                order by q.display_order)
                           from public.application_answers an
                           join public.opportunity_questions q on q.id = an.question_id
                          where an.application_id = v_a.id), '[]'::jsonb),
    'timeline', coalesce((select jsonb_agg(jsonb_build_object(
                                   'from_status', h.from_status,
                                   'to_status',   h.to_status,
                                   'actor_kind',  h.actor_kind,
                                   'note',        h.note,
                                   'created_at',  h.created_at)
                                 order by h.created_at)
                            from public.application_status_history h
                           where h.application_id = v_a.id), '[]'::jsonb),
    'allowed_transitions', (
      select coalesce(jsonb_agg(t.s order by t.ord), '[]'::jsonb)
      from (values
        (1, case when v_is_applicant
                  and v_a.status in ('submitted','viewed','under_review','interview')
                 then 'withdrawn' end),
        (2, case when (v_is_manager or (v_is_applicant and v_a.is_self_declared))
                  and v_a.status = 'submitted' then 'viewed' end),
        (3, case when (v_is_manager or (v_is_applicant and v_a.is_self_declared))
                  and v_a.status in ('submitted','viewed') then 'under_review' end),
        (4, case when (v_is_manager or (v_is_applicant and v_a.is_self_declared))
                  and v_a.status in ('viewed','under_review') then 'interview' end),
        (5, case when (v_is_manager or (v_is_applicant and v_a.is_self_declared))
                  and v_a.status in ('under_review','interview') then 'selected' end),
        (6, case when (v_is_manager or (v_is_applicant and v_a.is_self_declared))
                  and v_a.status in ('submitted','viewed','under_review','interview')
                 then 'not_selected' end),
        (7, case when v_is_manager
                  and v_a.status in ('submitted','viewed','under_review','interview')
                 then 'closed' end)
      ) as t(ord, s)
      where t.s is not null));
end
$fn$;

revoke all on function public.get_application(uuid) from public, anon;
grant execute on function public.get_application(uuid) to authenticated;


-- ISE-061 -- beneficiaires proposables a la cloture : uniquement des
-- candidats REELS de cette offre. On ne peut pas crediter un membre qui
-- n'a jamais candidate.
create or replace function public.list_opportunity_candidates(p_opportunity_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_opportunity_manager(p_opportunity_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'profile_id', a.applicant_profile_id,
             'profile',    private.network_profile_card(a.applicant_profile_id),
             'status',     a.status,
             'channel',    a.channel)
           order by a.submitted_at)
      from public.applications a
     where a.opportunity_id = p_opportunity_id
       and a.status <> 'draft'
       and private.network_profile_card(a.applicant_profile_id) is not null), '[]'::jsonb);
end
$fn$;

revoke all on function public.list_opportunity_candidates(uuid) from public, anon;
grant execute on function public.list_opportunity_candidates(uuid) to authenticated;


-- Mes documents de profil, pour joindre un CV (ISE-056 -> candidature).
-- `profile_documents` n'est jamais lue en clair par le client : la
-- fonction n'enumere que les colonnes utiles a la selection.
create or replace function public.list_my_documents(p_document_type text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'document_id', d.id,
             'document_type', d.document_type,
             'title',       d.title,
             'filename',    d.original_filename,
             'is_primary',  d.is_primary,
             'created_at',  d.created_at)
           order by d.is_primary desc, d.created_at desc)
      from public.profile_documents d
     where d.profile_id = v_me
       and d.deleted_at is null
       and (p_document_type is null or d.document_type = p_document_type)), '[]'::jsonb);
end
$fn$;

revoke all on function public.list_my_documents(text) from public, anon;
grant execute on function public.list_my_documents(text) to authenticated;


-- =====================================================================
-- 4. Ecritures
-- =====================================================================

-- ISE-057 / ISE-058 -- brouillon d'opportunite, atomique.
-- Refuse toute offre deja publiee : la modification d'une offre active
-- n'est pas livree dans cette tranche, et un demi-chemin serait pire
-- qu'aucun.
create or replace function public.save_opportunity_draft(
  p_opportunity_id uuid,
  p_payload        jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid  := private.current_profile_id();
  v_id uuid  := p_opportunity_id;
  v_o  public.opportunities;
  p    jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.is_active_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_id is null then
    -- D-103 : 10 creations d'offre par jour et par compte.
    if not private.consume_rate_limit(v_me::text, 'opportunity.create', 10, 86400) then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;

    insert into public.opportunities (
      author_profile_id, organization_id, organization_name_raw,
      opportunity_type, contract_type, title, summary, description,
      sector_id, sector_importance, job_function_id,
      experience_level, min_experience_years, ideal_experience_years,
      suitable_for_new_graduates,
      country_code, city, remote_allowed, remote_mode,
      start_date, duration_days,
      compensation_min, compensation_max, currency, compensation_disclosed,
      deadline, positions_count,
      application_mode, external_application_url, external_application_email,
      contact_profile_id, visibility, status
    ) values (
      v_me,
      nullif(p->>'organization_id','')::uuid,
      nullif(p->>'organization_name_raw',''),
      coalesce(nullif(p->>'opportunity_type',''), 'job'),
      nullif(p->>'contract_type',''),
      coalesce(nullif(btrim(p->>'title'),''), 'Brouillon sans titre'),
      nullif(p->>'summary',''),
      coalesce(nullif(btrim(p->>'description'),''),
               'Brouillon en cours de redaction, description a completer.'),
      nullif(p->>'sector_id','')::bigint,
      coalesce(nullif(p->>'sector_importance',''), 'preferred'),
      nullif(p->>'job_function_id','')::bigint,
      nullif(p->>'experience_level',''),
      nullif(p->>'min_experience_years','')::smallint,
      nullif(p->>'ideal_experience_years','')::smallint,
      coalesce((p->>'suitable_for_new_graduates')::boolean, false),
      nullif(p->>'country_code','')::char(2),
      nullif(p->>'city',''),
      coalesce((p->>'remote_allowed')::boolean, false),
      nullif(p->>'remote_mode',''),
      nullif(p->>'start_date','')::date,
      nullif(p->>'duration_days','')::integer,
      nullif(p->>'compensation_min','')::numeric,
      nullif(p->>'compensation_max','')::numeric,
      nullif(p->>'currency','')::char(3),
      coalesce((p->>'compensation_disclosed')::boolean, false),
      nullif(p->>'deadline','')::timestamptz,
      coalesce(nullif(p->>'positions_count','')::integer, 1),
      coalesce(nullif(p->>'application_mode',''), 'internal'),
      nullif(p->>'external_application_url',''),
      nullif(p->>'external_application_email',''),
      nullif(p->>'contact_profile_id','')::uuid,
      coalesce(nullif(p->>'visibility',''), 'members'),
      'draft'
    ) returning id into v_id;
  else
    select * into v_o from public.opportunities where id = v_id for update;
    if not found or v_o.deleted_at is not null then
      raise exception 'opportunity_not_found' using errcode = 'P0002';
    end if;
    if v_o.author_profile_id is distinct from v_me then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
    if v_o.status <> 'draft' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;

    update public.opportunities set
      organization_id        = case when jsonb_exists(p, 'organization_id') then nullif(p->>'organization_id','')::uuid else organization_id end,
      organization_name_raw  = case when jsonb_exists(p, 'organization_name_raw') then nullif(p->>'organization_name_raw','') else organization_name_raw end,
      opportunity_type       = coalesce(nullif(p->>'opportunity_type',''), opportunity_type),
      contract_type          = case when jsonb_exists(p, 'contract_type') then nullif(p->>'contract_type','') else contract_type end,
      title                  = coalesce(nullif(btrim(p->>'title'),''), title),
      summary                = case when jsonb_exists(p, 'summary') then nullif(p->>'summary','') else summary end,
      description            = coalesce(nullif(btrim(p->>'description'),''), description),
      sector_id              = case when jsonb_exists(p, 'sector_id') then nullif(p->>'sector_id','')::bigint else sector_id end,
      sector_importance      = coalesce(nullif(p->>'sector_importance',''), sector_importance),
      job_function_id        = case when jsonb_exists(p, 'job_function_id') then nullif(p->>'job_function_id','')::bigint else job_function_id end,
      experience_level       = case when jsonb_exists(p, 'experience_level') then nullif(p->>'experience_level','') else experience_level end,
      min_experience_years   = case when jsonb_exists(p, 'min_experience_years') then nullif(p->>'min_experience_years','')::smallint else min_experience_years end,
      ideal_experience_years = case when jsonb_exists(p, 'ideal_experience_years') then nullif(p->>'ideal_experience_years','')::smallint else ideal_experience_years end,
      suitable_for_new_graduates = coalesce((p->>'suitable_for_new_graduates')::boolean, suitable_for_new_graduates),
      country_code           = case when jsonb_exists(p, 'country_code') then nullif(p->>'country_code','')::char(2) else country_code end,
      city                   = case when jsonb_exists(p, 'city') then nullif(p->>'city','') else city end,
      remote_allowed         = coalesce((p->>'remote_allowed')::boolean, remote_allowed),
      remote_mode            = case when jsonb_exists(p, 'remote_mode') then nullif(p->>'remote_mode','') else remote_mode end,
      start_date             = case when jsonb_exists(p, 'start_date') then nullif(p->>'start_date','')::date else start_date end,
      duration_days          = case when jsonb_exists(p, 'duration_days') then nullif(p->>'duration_days','')::integer else duration_days end,
      compensation_min       = case when jsonb_exists(p, 'compensation_min') then nullif(p->>'compensation_min','')::numeric else compensation_min end,
      compensation_max       = case when jsonb_exists(p, 'compensation_max') then nullif(p->>'compensation_max','')::numeric else compensation_max end,
      currency               = case when jsonb_exists(p, 'currency') then nullif(p->>'currency','')::char(3) else currency end,
      compensation_disclosed = coalesce((p->>'compensation_disclosed')::boolean, compensation_disclosed),
      deadline               = case when jsonb_exists(p, 'deadline') then nullif(p->>'deadline','')::timestamptz else deadline end,
      positions_count        = coalesce(nullif(p->>'positions_count','')::integer, positions_count),
      application_mode       = coalesce(nullif(p->>'application_mode',''), application_mode),
      external_application_url   = case when jsonb_exists(p, 'external_application_url') then nullif(p->>'external_application_url','') else external_application_url end,
      external_application_email = case when jsonb_exists(p, 'external_application_email') then nullif(p->>'external_application_email','') else external_application_email end,
      contact_profile_id     = case when jsonb_exists(p, 'contact_profile_id') then nullif(p->>'contact_profile_id','')::uuid else contact_profile_id end,
      visibility             = coalesce(nullif(p->>'visibility',''), visibility)
    where id = v_id;
  end if;

  if jsonb_exists(p, 'skills') then
    delete from public.opportunity_skills where opportunity_id = v_id;
    insert into public.opportunity_skills (opportunity_id, skill_id, importance)
    select v_id, (e->>'skill_id')::bigint, coalesce(nullif(e->>'importance',''), 'preferred')
      from jsonb_array_elements(p->'skills') e
     where nullif(e->>'skill_id','') is not null
    on conflict do nothing;
  end if;

  if jsonb_exists(p, 'tools') then
    delete from public.opportunity_tools where opportunity_id = v_id;
    insert into public.opportunity_tools (opportunity_id, tool_id, importance)
    select v_id, (e->>'tool_id')::bigint, coalesce(nullif(e->>'importance',''), 'preferred')
      from jsonb_array_elements(p->'tools') e
     where nullif(e->>'tool_id','') is not null
    on conflict do nothing;
  end if;

  if jsonb_exists(p, 'languages') then
    delete from public.opportunity_languages where opportunity_id = v_id;
    insert into public.opportunity_languages (opportunity_id, language_code, min_proficiency, importance)
    select v_id, (e->>'language_code')::varchar(10),
           coalesce(nullif(e->>'min_proficiency',''), 'professional'),
           coalesce(nullif(e->>'importance',''), 'preferred')
      from jsonb_array_elements(p->'languages') e
     where nullif(e->>'language_code','') is not null
    on conflict do nothing;
  end if;

  if jsonb_exists(p, 'countries') then
    delete from public.opportunity_countries where opportunity_id = v_id;
    insert into public.opportunity_countries (opportunity_id, country_code, scope, importance)
    select v_id, (e->>'country_code')::char(2),
           coalesce(nullif(e->>'scope',''), 'experience'),
           coalesce(nullif(e->>'importance',''), 'preferred')
      from jsonb_array_elements(p->'countries') e
     where nullif(e->>'country_code','') is not null
    on conflict do nothing;
  end if;

  if jsonb_exists(p, 'audience_promotion_ids') then
    delete from public.opportunity_audience_promotions where opportunity_id = v_id;
    insert into public.opportunity_audience_promotions (opportunity_id, promotion_id)
    select v_id, e::bigint from jsonb_array_elements_text(p->'audience_promotion_ids') e
    on conflict do nothing;
  end if;

  if jsonb_exists(p, 'audience_profile_ids') then
    delete from public.opportunity_audience_profiles where opportunity_id = v_id;
    insert into public.opportunity_audience_profiles (opportunity_id, profile_id)
    select v_id, e::uuid from jsonb_array_elements_text(p->'audience_profile_ids') e
    on conflict do nothing;
  end if;

  -- "Pas de formulaire geant" (D7 57) : le plafond de l'offre fait foi.
  if jsonb_exists(p, 'questions') then
    delete from public.opportunity_questions where opportunity_id = v_id;
    insert into public.opportunity_questions (opportunity_id, display_order, question, is_required)
    select v_id, (row_number() over ())::smallint,
           btrim(e->>'question'), coalesce((e->>'is_required')::boolean, false)
      from jsonb_array_elements(p->'questions') e
     where length(btrim(coalesce(e->>'question',''))) between 5 and 300
     limit (select o.max_extra_questions from public.opportunities o where o.id = v_id);
  end if;

  if p_opportunity_id is null then
    insert into public.domain_events (event_type, aggregate_type, aggregate_id, actor_profile_id, payload)
    values ('opportunity.created', 'opportunity', v_id, v_me,
            jsonb_build_object('opportunity_type',
                               coalesce(nullif(p->>'opportunity_type',''), 'job')));
  end if;

  return jsonb_build_object('opportunity_id', v_id);
end
$fn$;

revoke all on function public.save_opportunity_draft(uuid, jsonb) from public, anon;
grant execute on function public.save_opportunity_draft(uuid, jsonb) to authenticated;


-- ISE-062 -- "Enregistrer" / "Retirer" une opportunite.
create or replace function public.toggle_saved_opportunity(
  p_opportunity_id uuid,
  p_saved          boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.can_see_opportunity(p_opportunity_id) then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;

  if coalesce(p_saved, false) then
    insert into public.saved_opportunities (profile_id, opportunity_id)
    values (v_me, p_opportunity_id) on conflict do nothing;
  else
    delete from public.saved_opportunities
     where profile_id = v_me and opportunity_id = p_opportunity_id;
  end if;

  return jsonb_build_object('opportunity_id', p_opportunity_id,
                            'is_saved', coalesce(p_saved, false));
end
$fn$;

revoke all on function public.toggle_saved_opportunity(uuid, boolean) from public, anon;
grant execute on function public.toggle_saved_opportunity(uuid, boolean) to authenticated;


-- ---------------------------------------------------------------------
-- ISE-056 -- clic vers une offre externe (MASTER PROMPT 27, D-55)
--
-- Un clic sortant est un FAIT TECHNIQUE, pas une candidature. Cette
-- fonction :
--   * ecrit une ligne dans `opportunity_outbound_clicks` ;
--   * n'ecrit RIEN dans `applications` ;
--   * renvoie `is_application = false`, que l'interface affiche
--     litteralement.
-- Le seul chemin vers une candidature externe reste
-- `declare_external_application()` (0008), sur un geste explicite.
-- ---------------------------------------------------------------------
create or replace function public.record_opportunity_outbound_click(p_opportunity_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_me  uuid := private.current_profile_id();
  v_o   public.opportunities;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.can_see_opportunity(p_opportunity_id) then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;

  select * into v_o from public.opportunities where id = p_opportunity_id;
  if v_o.application_mode = 'internal' then
    -- Aucune sortie a tracer : la candidature se depose ici.
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  insert into public.opportunity_outbound_clicks (opportunity_id, profile_id)
  values (p_opportunity_id, v_me);

  return jsonb_build_object(
    'opportunity_id',   p_opportunity_id,
    'application_mode', v_o.application_mode,
    'url',              case when v_o.application_mode = 'external_url'
                             then v_o.external_application_url end,
    'email',            case when v_o.application_mode = 'external_email'
                             then v_o.external_application_email end,
    -- La plateforme ne saura JAMAIS, par ce chemin, si le membre a
    -- reellement postule. Elle le dit (D-55).
    'is_application',   false);
end
$fn$;

revoke all on function public.record_opportunity_outbound_click(uuid) from public, anon;
grant execute on function public.record_opportunity_outbound_click(uuid) to authenticated;

comment on function public.record_opportunity_outbound_click(uuid) is
  'Enregistre un CLIC sortant. N''ecrit aucune candidature et renvoie is_application = false (MASTER PROMPT 27, D-55).';
