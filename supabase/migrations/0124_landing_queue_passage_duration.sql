-- =====================================================================
-- 0124_landing_queue_passage_duration
--
-- DUREE DE PASSAGE PAR DEFAUT DE LA FILE « A LA UNE DU RESEAU »,
-- ET FILE AFFICHEE CONFORME A LA FILE MANIPULABLE.
--
-- CE QUI EXISTE DEJA, ET QUI N'EST PAS REFAIT ICI
--   0121 a livre la file complete : `list_landing_queue()`,
--   `add_landing_queue_entry()`, `move_landing_queue_entry()`,
--   `remove_landing_queue_entry()`, la normalisation sans chevauchement,
--   la tache `cms_apply_landing_queue` (reellement planifiee, verifie dans
--   `cron.job`) et le reglage `rotation_interval_days` de l'ISE du jour.
--   0123 a aligne la regle photo sur le portrait public consenti.
--   Rien de tout cela n'est reecrit : cette migration corrige DEUX defauts
--   constates a la lecture du code livre, et n'ajoute aucun concept.
--
-- DEFAUT 1 — UNE CADENCE INVENTEE, INVISIBLE ET NON REGLABLE
--   `add_landing_queue_entry()` calcule le debut d'un passage « a la
--   suite » ainsi :
--
--       coalesce(o.ends_at, o.starts_at + interval '7 days')
--
--   Or le cas courant est justement `ends_at IS NULL` — c'est le defaut
--   de la fonction, et le geste que le porteur decrit (poser quatre
--   articles d'affilee sans saisir de dates). Ces « 7 jours » ne sont
--   donc pas un garde-fou marginal : ils sont LA CADENCE REELLE de la
--   file. Pire, `private.normalise_landing_queue()` referme ensuite
--   chaque fenetre sur le debut de la suivante, ce qui GRAVE cette duree
--   inventee dans `ends_at`.
--
--   Une constante ecrite en dur au milieu d'une fonction, qui decide du
--   rythme editorial de la page d'accueil sans que personne ne puisse la
--   lire ni la changer depuis le CMS, n'est pas un reglage : c'est une
--   decision prise a la place du porteur. On la sort du code, on la rend
--   visible et reglable par encart. La valeur par defaut reste 7 jours :
--   le comportement actuel est conserve a l'identique tant que personne
--   n'y touche.
--
-- DEFAUT 2 — LA FILE AFFICHEE N'EST PAS LA FILE MANIPULABLE
--   `list_landing_queue()` renvoie AUSSI les passages termines (etat
--   `termine`), alors que `move_landing_queue_entry()` ne considere que
--   les passages non termines pour trouver le voisin a echanger. L'ecran
--   numerote donc ses lignes sur un ensemble, et les fleches « Monter » /
--   « Descendre » operent sur un autre : sur une file contenant un
--   passage termine, le premier rang affiche n'est pas le premier rang
--   deplacable, et un echange peut sauter une ligne visible.
--
--   Ces lignes terminees sont de toute facon ephemeres :
--   `private.expire_cms_content()` supprime toutes les surcharges dont
--   `ends_at <= now()`, toutes les dix minutes. L'ecran montrait donc un
--   passe qui disparait tout seul, au prix d'une numerotation fausse.
--   La file rendue est desormais celle qui existe vraiment : le passage
--   en cours et ceux a venir.
--
-- D-128 : aucune ecriture sur `news.editorial_status`, `events.status`
--         ni `opportunities.status`. Cette migration ne touche qu'aux
--         reglages de la file et a sa lecture.
-- D-129 : aucune tache n'est ajoutee ni modifiee. `cron.job` reste tel
--         quel, et `public.get_cms_automation_status()` — qui lit
--         `cron.job` directement, sans liste recopiee — continue de dire
--         l'etat reel. Rien de nouveau a declarer.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Le reglage, par encart
--
--    Une table plutot qu'une colonne sur une table existante : la duree
--    de passage appartient a la FILE, pas aux regles de l'ISE du jour
--    (qui n'a pas de file) ni a `cms_sections` (qui decrit l'affichage
--    d'une section, pas son rythme editorial).
--
--    Les trois lignes sont creees ici : un reglage absent obligerait
--    chaque lecteur a redecider d'un defaut, ce qui ramenerait la
--    constante cachee que cette migration retire.
-- ---------------------------------------------------------------------

create table if not exists public.cms_landing_queue_settings (
  section_key           text primary key
                          check (section_key in ('news', 'events', 'opportunities')),
  default_passage_days  integer not null default 7
                          check (default_passage_days between 1 and 90),
  updated_at            timestamptz not null default now(),
  updated_by_profile_id uuid references public.ise_profiles(id) on delete set null
);

comment on table public.cms_landing_queue_settings is
  'Reglages de la file de passage des encarts « A la une du reseau », un par encart (0124).';
comment on column public.cms_landing_queue_settings.default_passage_days is
  'Duree d''un passage ajoute « a la suite », sans date saisie. Remplace la constante de 7 jours ecrite en dur dans add_landing_queue_entry (0121).';

insert into public.cms_landing_queue_settings (section_key, default_passage_days)
values ('news', 7), ('events', 7), ('opportunities', 7)
on conflict (section_key) do nothing;

-- RLS alignee sur `cms_content_overrides` : lecture pour qui peut lire le
-- CMS, ecriture pour qui peut l'editer. Les RPC ci-dessous restent le
-- chemin normal ; la politique evite qu'une table du schema `public` soit
-- exposee sans regle.
alter table public.cms_landing_queue_settings enable row level security;

drop policy if exists cms_landing_queue_settings_read  on public.cms_landing_queue_settings;
drop policy if exists cms_landing_queue_settings_write on public.cms_landing_queue_settings;

create policy cms_landing_queue_settings_read
  on public.cms_landing_queue_settings
  for select to authenticated
  using (private.has_permission('cms.read'));

create policy cms_landing_queue_settings_write
  on public.cms_landing_queue_settings
  for all to authenticated
  using (private.has_permission('cms.edit'))
  with check (private.has_permission('cms.edit'));

revoke all on table public.cms_landing_queue_settings from anon;
grant select on table public.cms_landing_queue_settings to authenticated;

-- ---------------------------------------------------------------------
-- 2. Lecture du reglage
--
--    `coalesce` sur 7 : si quelqu'un supprimait une ligne, la file
--    garderait le comportement d'avant plutot que de tomber en panne.
-- ---------------------------------------------------------------------

create or replace function private.landing_queue_default_days(p_section_key text)
returns integer
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(
           (select s.default_passage_days
              from public.cms_landing_queue_settings s
             where s.section_key = p_section_key),
           7)
$$;

comment on function private.landing_queue_default_days(text) is
  'Duree par defaut d''un passage pour un encart donne, en jours (0124).';

revoke all on function private.landing_queue_default_days(text) from public, anon, authenticated;
grant execute on function private.landing_queue_default_days(text) to service_role;

-- ---------------------------------------------------------------------
-- 3. Reglage depuis le CMS
--
--    Permission `cms.schedule`, la meme que pour ajouter ou deplacer un
--    passage : changer le rythme de la file est un geste de
--    programmation, pas de redaction.
--
--    Le changement ne retouche PAS les passages deja programmes. Leurs
--    dates ont ete preparees par le porteur ; les recalculer derriere lui
--    deplacerait un calendrier qu'il croyait fige. Le nouveau reglage
--    vaut pour les ajouts suivants.
-- ---------------------------------------------------------------------

create or replace function public.set_landing_queue_default_days(
  p_section_key text,
  p_days        integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_actor uuid := private.current_profile_id();
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.schedule') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_section_key not in ('news', 'events', 'opportunities') then
    raise exception 'invalid_section' using errcode = '22023';
  end if;
  if p_days is null or p_days < 1 or p_days > 90 then
    raise exception 'invalid_duration' using errcode = '22023';
  end if;

  insert into public.cms_landing_queue_settings
    (section_key, default_passage_days, updated_at, updated_by_profile_id)
  values (p_section_key, p_days, now(), v_actor)
  on conflict (section_key) do update
    set default_passage_days  = excluded.default_passage_days,
        updated_at            = now(),
        updated_by_profile_id = excluded.updated_by_profile_id;

  perform private.log_audit(
    p_action      => 'cms.landing_queue.duration_changed',
    p_object_type => 'cms_landing_queue_settings',
    p_object_id   => p_section_key,
    p_context     => jsonb_build_object('section_key', p_section_key,
                                        'default_passage_days', p_days));

  return jsonb_build_object('section_key', p_section_key, 'default_passage_days', p_days);
end
$$;

comment on function public.set_landing_queue_default_days(text, integer) is
  'Regle la duree par defaut d''un passage ajoute « a la suite » dans un encart. Sans effet sur les passages deja programmes (0124).';

revoke all on function public.set_landing_queue_default_days(text, integer) from public, anon;
grant execute on function public.set_landing_queue_default_days(text, integer)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. Ajout d'un passage : la duree vient du reglage, plus du code
--
--    Corps identique a celui de 0121, A UNE EXPRESSION PRES : la duree
--    supposee d'un passage sans fin connue devient
--    `private.landing_queue_default_days(v_section)` au lieu de
--    `interval '7 days'`. Tout le reste — controle de permission,
--    existence du contenu, verrou d'avance par section, unicite des
--    instants de debut, normalisation, journalisation — est reconduit
--    tel quel.
-- ---------------------------------------------------------------------

create or replace function public.add_landing_queue_entry(
  p_entity_type text,
  p_entity_id   uuid,
  p_starts_at   timestamptz default null,
  p_ends_at     timestamptz default null,
  p_reason      text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_section text := private.landing_queue_section_for(p_entity_type);
  v_actor   uuid := private.current_profile_id();
  v_start   timestamptz;
  v_fin     timestamptz := p_ends_at;
  v_exists  boolean := false;
  v_id      uuid;
  v_garde   integer := 0;
  v_duree   integer;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.schedule') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_section is null then
    raise exception 'invalid_entity_type' using errcode = '22023';
  end if;

  -- Le contenu doit exister. Programmer un UUID inexistant produirait une
  -- file qui ment : elle annoncerait un passage qui n'aura jamais lieu.
  select case p_entity_type
           when 'news'        then exists (select 1 from public.news n
                                            where n.id = p_entity_id and n.deleted_at is null)
           when 'event'       then exists (select 1 from public.events e
                                            where e.id = p_entity_id and e.deleted_at is null)
           when 'opportunity' then exists (select 1 from public.opportunities o
                                            where o.id = p_entity_id and o.deleted_at is null)
         end
    into v_exists;
  if not coalesce(v_exists, false) then
    raise exception 'entity_not_found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtext('cms.landing_queue'), hashtext(v_section));

  v_duree := private.landing_queue_default_days(v_section);

  if p_starts_at is not null then
    v_start := p_starts_at;
  else
    -- A la suite du dernier passage non termine, sinon tout de suite. Un
    -- passage sans fin connue est suppose durer la duree reglee pour
    -- l'encart (0124), et non plus sept jours ecrits en dur (0121).
    select greatest(now(),
                    coalesce(max(coalesce(o.ends_at,
                                          o.starts_at + make_interval(days => v_duree))),
                             now()))
      into v_start
      from public.cms_content_overrides o
     where o.section_key   = v_section
       and o.override_kind = 'pin'
       and (o.ends_at is null or o.ends_at > now());
    v_start := coalesce(v_start, now());
  end if;

  -- Deux debuts identiques rendraient l'ordre indecidable.
  while v_garde < 60 and exists (
    select 1 from public.cms_content_overrides o
     where o.section_key   = v_section
       and o.override_kind = 'pin'
       and o.starts_at     = v_start)
  loop
    v_start := v_start + interval '1 minute';
    v_garde := v_garde + 1;
  end loop;

  if v_fin is not null and v_fin <= v_start then
    v_fin := null;
  end if;

  insert into public.cms_content_overrides
    (section_key, override_kind, entity_type, entity_id, display_position,
     starts_at, ends_at, reason, created_by_profile_id)
  values
    (v_section, 'pin', p_entity_type, p_entity_id, 0,
     v_start, v_fin, p_reason, v_actor)
  returning id into v_id;

  perform private.normalise_landing_queue(v_section);

  perform private.log_audit(
    p_action      => 'cms.landing_queue.added',
    p_object_type => 'cms_content_overrides',
    p_object_id   => v_id::text,
    p_context     => jsonb_build_object('section_key', v_section,
                                        'entity_type', p_entity_type,
                                        'entity_id',   p_entity_id,
                                        'starts_at',   v_start,
                                        'ends_at',     v_fin,
                                        'default_passage_days', v_duree));

  select o.ends_at into v_fin from public.cms_content_overrides o where o.id = v_id;

  return jsonb_build_object('id', v_id, 'section_key', v_section,
                            'starts_at', v_start, 'ends_at', v_fin,
                            'default_passage_days', v_duree);
end
$$;

comment on function public.add_landing_queue_entry(text, uuid, timestamptz, timestamptz, text) is
  'Ajoute un passage a la file d''un encart « A la une du reseau ». Sans date de debut, le passage suit le dernier de la file, pour la duree reglee sur l''encart (0121, 0124).';

revoke all on function public.add_landing_queue_entry(text, uuid, timestamptz, timestamptz, text)
  from public, anon;
grant execute on function public.add_landing_queue_entry(text, uuid, timestamptz, timestamptz, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. Lecture de la file : ce qui est montre est ce qui est manipulable
--
--    Deux changements par rapport a 0121 :
--      * les passages termines sortent du resultat (defaut 2 ci-dessus) ;
--      * le reglage de duree accompagne la file, pour que l'ecran puisse
--        dire quelle cadence il applique sans avoir a la deviner.
--
--    Le calcul de `est_pret` — le contenu passera-t-il reellement les
--    filtres de la vitrine le jour J — est reconduit a l'identique. Il
--    reste ce qui evite de decouvrir un encart vide le matin du passage.
-- ---------------------------------------------------------------------

create or replace function public.list_landing_queue(p_section_key text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v         jsonb;
  v_reglage jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.read') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.section_key, t.starts_at), '[]'::jsonb)
    into v
  from (
    select o.id,
           o.section_key,
           o.entity_type,
           o.entity_id,
           o.starts_at,
           o.ends_at,
           o.reason,
           row_number() over (partition by o.section_key order by o.starts_at, o.created_at)
             as position,
           coalesce(n.title, e.title, op.title) as title,
           coalesce(n.landing_visibility, e.landing_visibility, op.landing_visibility, 'hidden')
             = 'visible' as est_visible,
           case
             when o.starts_at <= now() then 'en_cours'
             else 'a_venir'
           end as etat,
           case o.entity_type
             when 'news' then
               n.id is not null and n.deleted_at is null
               and n.editorial_status = 'published'
               and n.visibility = 'members'
               and n.published_at is not null and n.published_at <= now()
               and n.duplicate_of_news_id is null
             when 'event' then
               e.id is not null and e.deleted_at is null
               and e.status = 'published'
               and e.cancelled_at is null
               and e.visibility = 'members'
               and e.starts_at > now()
             when 'opportunity' then
               op.id is not null and op.deleted_at is null
               and op.status = 'active'
               and op.visibility = 'members'
               and op.moderation_status in ('not_required', 'approved')
               and op.published_at is not null and op.published_at <= now()
               and (op.deadline is null or op.deadline > now())
             else false
           end as est_pret
      from public.cms_content_overrides o
      left join public.news          n  on o.entity_type = 'news'        and n.id  = o.entity_id
      left join public.events        e  on o.entity_type = 'event'       and e.id  = o.entity_id
      left join public.opportunities op on o.entity_type = 'opportunity' and op.id = o.entity_id
     where o.override_kind = 'pin'
       and o.section_key in ('news', 'events', 'opportunities')
       and (p_section_key is null or o.section_key = p_section_key)
       -- 0124 — la file, c'est le passage en cours et ceux a venir. Les
       -- passages termines sont supprimes par private.expire_cms_content()
       -- dans les dix minutes : les afficher faussait la numerotation sans
       -- rien apprendre de durable.
       and (o.ends_at is null or o.ends_at > now())
  ) t;

  select coalesce(jsonb_object_agg(s.section_key, s.default_passage_days), '{}'::jsonb)
    into v_reglage
    from public.cms_landing_queue_settings s
   where p_section_key is null or s.section_key = p_section_key;

  return jsonb_build_object('read_at', now(),
                            'entries', v,
                            'default_passage_days', v_reglage);
end
$$;

comment on function public.list_landing_queue(text) is
  'File de passage des encarts « A la une du reseau » : quoi, quand, dans quel ordre, si le contenu est reellement diffusable, et la duree par defaut reglee sur chaque encart (0121, 0124).';

revoke all on function public.list_landing_queue(text) from public, anon;
grant execute on function public.list_landing_queue(text) to authenticated, service_role;
