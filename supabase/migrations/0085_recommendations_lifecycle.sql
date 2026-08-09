-- =====================================================================
-- 0085_recommendations_lifecycle
-- Tranche « Profil ISE-028 / ISE-029 » : cycle de vie des
-- recommandations et de leurs demandes.
--
-- Sources : 0005 (tables), 0021 (politiques RLS), docs/decisions.md
-- D-73, D-102 ; MASTER PROMPT §19 (« contextualisée, jamais un like »).
--
-- POURQUOI cette migration :
--   * 0021 donnait au sujet une politique UPDATE sans restriction de
--     colonnes : « le sujet peut masquer » devenait en pratique « le
--     sujet peut REECRIRE le témoignage d'un tiers ». La RLS est un
--     contrôle de ligne : la restriction de transition passe par un
--     trigger.
--   * la politique SELECT de 0021 ne regardait que `visibility` : un
--     brouillon (`draft`) ou une recommandation masquée (`hidden`)
--     restait lisible par des tiers. Seul `published` doit l'être.
--   * accepter une demande = écrire la recommandation ET clore la
--     demande : deux écritures qui doivent rester solidaires, d'où une
--     fonction de transition (docs/rls.md §4, motif B — mais SECURITY
--     INVOKER : rien à contourner, la RLS de l'appelant suffit).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SELECT : un tiers ne voit que les recommandations PUBLIEES.
--    L'auteur et le sujet continuent de voir brouillons et masquées.
-- ---------------------------------------------------------------------
drop policy if exists recommendations_select on public.recommendations;
create policy recommendations_select on public.recommendations
  for select to authenticated
  using (
    author_profile_id = private.current_profile_id()
    or subject_profile_id = private.current_profile_id()
    or (status = 'published' and private.can_see_field(subject_profile_id, visibility))
  );

-- ---------------------------------------------------------------------
-- 2. Trigger : transitions autorisees sur `recommendations`.
--
--    Auteur   : redige tant que c'est un brouillon ; une fois validee
--               par le sujet, il ne peut que la retirer (`removed`).
--               Il ne publie JAMAIS lui-meme : la publication est la
--               validation du sujet (onglet « À valider », ISE-028).
--    Sujet    : valide (`draft -> published`), masque
--               (`published -> hidden`), reaffiche
--               (`hidden -> published`). RIEN d'autre : le texte d'un
--               tiers ne se reecrit pas.
--    Personne : les identites (auteur, sujet, demande) sont immuables.
--    Un contexte de service (current_profile_id() null) n'est pas
--    contraint : les operations d'exploitation restent possibles.
-- ---------------------------------------------------------------------
create or replace function private.guard_recommendation_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Une recommandation naît brouillon : elle ne devient visible que
    -- validee par son sujet. Normalisation plutôt qu'erreur : le chemin
    -- nominal (respond_recommendation_request) insère déjà `draft`.
    new.status := 'draft';
    new.published_at := null;
    return new;
  end if;

  -- Identites immuables.
  if new.author_profile_id  is distinct from old.author_profile_id
     or new.subject_profile_id is distinct from old.subject_profile_id
     or new.request_id         is distinct from old.request_id then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_me = old.author_profile_id then
    if old.status = 'draft' then
      -- Redaction libre, mais pas d'auto-publication.
      if new.status not in ('draft', 'removed') then
        raise exception 'recommendation_subject_validates' using errcode = '42501';
      end if;
      if new.published_at is distinct from old.published_at then
        raise exception 'not_authorized' using errcode = '42501';
      end if;
      return new;
    end if;
    -- Publiee ou masquee : seule la retractation reste possible.
    if new.status <> 'removed'
       or new.body is distinct from old.body
       or new.relationship_context is distinct from old.relationship_context
       or new.engagement_context is distinct from old.engagement_context
       or new.skill_id is distinct from old.skill_id
       or new.visibility is distinct from old.visibility
       or new.published_at is distinct from old.published_at then
      raise exception 'recommendation_locked' using errcode = '42501';
    end if;
    return new;
  end if;

  if v_me = old.subject_profile_id then
    -- Le sujet ne touche qu'au statut.
    if new.body is distinct from old.body
       or new.relationship_context is distinct from old.relationship_context
       or new.engagement_context is distinct from old.engagement_context
       or new.skill_id is distinct from old.skill_id
       or new.visibility is distinct from old.visibility then
      raise exception 'recommendation_readonly_for_subject' using errcode = '42501';
    end if;
    if not (
         (old.status = 'draft'     and new.status in ('published', 'hidden'))
      or (old.status = 'published' and new.status = 'hidden')
      or (old.status = 'hidden'    and new.status = 'published')
    ) then
      raise exception 'recommendation_transition_invalid' using errcode = '42501';
    end if;
    -- `published_at` : pose a la premiere publication, puis conserve.
    if new.status = 'published' and old.published_at is null then
      new.published_at := coalesce(new.published_at, now());
    elsif new.published_at is distinct from old.published_at then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Ni auteur ni sujet : un porteur de `profiles.edit` passe par la
  -- politique admin de 0021, mais reste soumis aux identites immuables
  -- verifiees plus haut ; tout le reste est refuse.
  if private.has_permission('profiles.edit') then
    return new;
  end if;
  raise exception 'not_authorized' using errcode = '42501';
end
$fn$;

comment on function private.guard_recommendation_write() is
  'ISE-028 — transitions autorisees sur recommendations : le sujet valide/masque sans reecrire, '
  'l''auteur redige sans s''auto-publier, les identites sont immuables (MASTER PROMPT §19).';

revoke all on function private.guard_recommendation_write() from public, anon, authenticated;

drop trigger if exists trg_guard_recommendation_write on public.recommendations;
create trigger trg_guard_recommendation_write
before insert or update on public.recommendations
for each row execute function private.guard_recommendation_write();

-- ---------------------------------------------------------------------
-- 3. Trigger : transitions autorisees sur `recommendation_requests`.
--    Le demandeur retire (`pending -> withdrawn`), le destinataire
--    accepte ou decline (`pending -> accepted | declined`). Aucune autre
--    colonne ne change apres depot : une demande ne se reecrit pas.
-- ---------------------------------------------------------------------
create or replace function private.guard_recommendation_request_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    return new;
  end if;

  if new.requester_profile_id is distinct from old.requester_profile_id
     or new.recipient_profile_id is distinct from old.recipient_profile_id
     or new.skill_id   is distinct from old.skill_id
     or new.context    is distinct from old.context
     or new.message    is distinct from old.message
     or new.expires_at is distinct from old.expires_at then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if old.status <> 'pending' then
    raise exception 'recommendation_request_closed' using errcode = '42501';
  end if;

  if v_me = old.requester_profile_id and new.status = 'withdrawn' then
    new.responded_at := coalesce(new.responded_at, now());
    return new;
  end if;
  if v_me = old.recipient_profile_id and new.status in ('accepted', 'declined') then
    new.responded_at := coalesce(new.responded_at, now());
    return new;
  end if;

  raise exception 'not_authorized' using errcode = '42501';
end
$fn$;

comment on function private.guard_recommendation_request_update() is
  'ISE-028 / ISE-029 — le demandeur retire, le destinataire accepte ou decline ; '
  'une demande deposee ne se reecrit pas.';

revoke all on function private.guard_recommendation_request_update()
  from public, anon, authenticated;

drop trigger if exists trg_guard_recommendation_request_update on public.recommendation_requests;
create trigger trg_guard_recommendation_request_update
before update on public.recommendation_requests
for each row execute function private.guard_recommendation_request_update();

-- ---------------------------------------------------------------------
-- 4. Reponse a une demande : transition atomique.
--
--    SECURITY INVOKER assume : l'appelant a deja, par la RLS de 0021,
--    le droit de mettre a jour la demande qui le concerne et d'inserer
--    une recommandation dont il est l'auteur. La fonction n'ajoute
--    aucun privilege : elle garantit seulement que les deux ecritures
--    de l'acceptation restent solidaires.
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
    return v_req.id;
  end if;

  if v_me <> v_req.recipient_profile_id then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_action = 'decline' then
    update public.recommendation_requests
       set status = 'declined'
     where id = v_req.id;
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
-- 5. Controle de non-regression (meme garde-fou que 0035).
-- ---------------------------------------------------------------------
do $mig$
declare
  v_n bigint;
begin
  select count(*) into v_n from private.security_baseline_violations();
  if v_n <> 0 then
    raise exception 'security_baseline_violations: % ligne(s)', v_n;
  end if;

  select count(*) into v_n from private.tables_without_rls();
  if v_n <> 0 then
    raise exception 'tables_without_rls: % ligne(s)', v_n;
  end if;
end
$mig$;
