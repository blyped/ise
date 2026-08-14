-- =====================================================================
-- 0121_landing_queue_and_featured_rotation
--
-- FILE DE PASSAGE DES ENCARTS « A LA UNE DU RESEAU » + FREQUENCE DE
-- ROTATION DE L'ISE DU JOUR.
--
-- CE QUI EXISTAIT DEJA, ET QUI N'EST PAS REFAIT ICI
--   * `cms_publication_schedule` + `private.publish_scheduled_cms_content()`
--     programment UNE bascule d'exposition par contenu (index unique
--     partiel `cms_publication_schedule_pending_uidx`). Utile, mais ce
--     n'est pas une file : rien n'y dit QUEL contenu occupe l'encart.
--   * `cms_content_overrides` porte deja un epinglage FENETRE DANS LE TEMPS
--     (`override_kind = 'pin'`, `starts_at`, `ends_at`, `display_position`),
--     que `private.landing_override_position()` lit a chaque projection.
--     C'est exactement la primitive d'une file de passage : elle etait la,
--     elle n'etait ni ordonnee, ni programmable a l'avance depuis le CMS.
--   * `cms_select_featured_profile` / `cms_publish_featured_profile`
--     tournent reellement (verifie dans `cron.job`), tous les jours.
--
-- CE QUE CETTE MIGRATION AJOUTE
--   1. une FILE ordonnee et normalisee au-dessus des epinglages existants,
--      avec ses fonctions de lecture, d'ajout, de reordonnancement et de
--      retrait ;
--   2. une automatisation `cms_apply_landing_queue` qui EXPOSE le contenu
--      dont le tour est venu ;
--   3. `rotation_interval_days` sur les regles de l'ISE du jour, pour que
--      la frequence de rotation soit reglable sans toucher au cron.
--
-- D-128 EST RESPECTEE SANS EXCEPTION : rien ici n'ecrit `news.editorial_status`,
-- `events.status` ni `opportunities.status`. La file ne pilote QUE
-- `landing_visibility` et la position d'epinglage. Le circuit editorial
-- reste la propriete des ecrans metier.
--
-- D-129 EST RESPECTEE : la nouvelle tache est reellement planifiee dans
-- `cron.job`, et son nom commence par `cms_` — donc elle apparait dans
-- `public.get_cms_automation_status()` avec son etat REEL, sans qu'aucune
-- liste ne soit recopiee ailleurs.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Correspondance type de contenu -> section de la vitrine
--
--    Trois encarts programmables, trois sections deja declarees dans
--    `cms_sections` (`news`, `events`, `opportunities`). Le quatrieme
--    encart, l'ISE du jour, ne prend PAS de file : il se choisit tout
--    seul (section 6).
-- ---------------------------------------------------------------------

create or replace function private.landing_queue_section_for(p_entity_type text)
returns text
language sql
immutable
set search_path to ''
as $$
  select case p_entity_type
           when 'news'        then 'news'
           when 'event'       then 'events'
           when 'opportunity' then 'opportunities'
         end
$$;

comment on function private.landing_queue_section_for(text) is
  'Section de vitrine correspondant a un type de contenu programmable. NULL si le type ne peut pas etre mis en file (0121).';

-- ---------------------------------------------------------------------
-- 2. Normalisation de la file
--
--    Une file, c'est une suite de passages QUI NE SE CHEVAUCHENT PAS.
--    Chaque entree court jusqu'a la prise de relais de la suivante ; la
--    derniere peut rester ouverte (`ends_at` NULL = jusqu'a nouvel ordre).
--
--    On ne touche jamais aux entrees deja terminees : elles appartiennent
--    au passe, et `private.expire_cms_content()` les efface de lui-meme.
-- ---------------------------------------------------------------------

create or replace function private.normalise_landing_queue(p_section_key text)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_changed integer := 0;
begin
  with ordonnee as (
    select o.id,
           o.starts_at,
           o.ends_at,
           lead(o.starts_at) over (order by o.starts_at, o.created_at) as prochain_debut
      from public.cms_content_overrides o
     where o.section_key   = p_section_key
       and o.override_kind = 'pin'
       and (o.ends_at is null or o.ends_at > now())
  ),
  corrections as (
    select id, prochain_debut
      from ordonnee
     where prochain_debut is not null
       and prochain_debut > starts_at
       and (ends_at is null or ends_at > prochain_debut)
  ),
  appliquees as (
    update public.cms_content_overrides o
       set ends_at    = c.prochain_debut,
           updated_at = now()
      from corrections c
     where o.id = c.id
    returning o.id
  )
  select count(*) into v_changed from appliquees;

  return v_changed;
end
$$;

comment on function private.normalise_landing_queue(text) is
  'Ferme la fenetre de chaque passage a l''instant ou le suivant prend le relais. Garantit une file sans chevauchement (0121).';

-- ---------------------------------------------------------------------
-- 3. Lecture de la file
--
--    L'ecran CMS doit pouvoir dire QUOI, QUAND, DANS QUEL ORDRE, et
--    surtout SI CA MARCHERA. `est_pret` repond a la derniere question :
--    un article programme mais encore en brouillon editorial n'apparaitra
--    pas, et l'ecran doit le dire AVANT la date de passage plutot que de
--    laisser l'encart vide le jour J.
-- ---------------------------------------------------------------------

create or replace function public.list_landing_queue(p_section_key text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v jsonb;
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
             when o.starts_at <= now() and (o.ends_at is null or o.ends_at > now())
               then 'en_cours'
             when o.starts_at > now() then 'a_venir'
             else 'termine'
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
  ) t;

  return jsonb_build_object('read_at', now(), 'entries', v);
end
$$;

comment on function public.list_landing_queue(text) is
  'File de passage des encarts « A la une du reseau » : quoi, quand, dans quel ordre, et si le contenu est reellement diffusable (0121).';

revoke all on function public.list_landing_queue(text) from public, anon;
grant execute on function public.list_landing_queue(text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. Ajout d'un passage
--
--    `p_starts_at` NULL veut dire « a la suite » : le nouveau passage
--    commence quand le dernier de la file se termine. C'est le geste que
--    le porteur decrit — poser plusieurs contenus d'affilee sans calculer
--    les dates soi-meme.
--
--    Deux passages ne peuvent pas commencer au meme instant : la file
--    serait ambigue. Plutot que de refuser, on decale d'une minute — le
--    resultat reste celui que l'utilisateur voulait, dans l'ordre ou il
--    l'a demande.
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

  if p_starts_at is not null then
    v_start := p_starts_at;
  else
    -- A la suite du dernier passage non termine, sinon tout de suite.
    select greatest(now(),
                    coalesce(max(coalesce(o.ends_at, o.starts_at + interval '7 days')), now()))
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
                                        'ends_at',     v_fin));

  select o.ends_at into v_fin from public.cms_content_overrides o where o.id = v_id;

  return jsonb_build_object('id', v_id, 'section_key', v_section,
                            'starts_at', v_start, 'ends_at', v_fin);
end
$$;

comment on function public.add_landing_queue_entry(text, uuid, timestamptz, timestamptz, text) is
  'Ajoute un passage a la file d''un encart « A la une du reseau ». Sans date de debut, le passage suit le dernier de la file (0121).';

revoke all on function public.add_landing_queue_entry(text, uuid, timestamptz, timestamptz, text)
  from public, anon;
grant execute on function public.add_landing_queue_entry(text, uuid, timestamptz, timestamptz, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. Reordonnancement et retrait
--
--    REORDONNER, C'EST ECHANGER LES CONTENUS, PAS LES DATES. Les creneaux
--    prepares par le porteur restent en place ; ce qui change, c'est ce
--    qui passe dedans. Deplacer les dates aurait decale toute la file.
-- ---------------------------------------------------------------------

create or replace function public.move_landing_queue_entry(
  p_entry_id  uuid,
  p_direction text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_section  text;
  v_debut    timestamptz;
  v_cree     timestamptz;
  v_voisin   uuid;
  v_type_a   text;
  v_id_a     uuid;
  v_raison_a text;
  v_type_b   text;
  v_id_b     uuid;
  v_raison_b text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.schedule') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_direction not in ('up', 'down') then
    raise exception 'invalid_direction' using errcode = '22023';
  end if;

  select o.section_key, o.starts_at, o.created_at, o.entity_type, o.entity_id, o.reason
    into v_section, v_debut, v_cree, v_type_a, v_id_a, v_raison_a
    from public.cms_content_overrides o
   where o.id = p_entry_id and o.override_kind = 'pin'
     and o.section_key in ('news', 'events', 'opportunities');
  if not found then
    raise exception 'entry_not_found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtext('cms.landing_queue'), hashtext(v_section));

  if p_direction = 'up' then
    select o.id, o.entity_type, o.entity_id, o.reason
      into v_voisin, v_type_b, v_id_b, v_raison_b
      from public.cms_content_overrides o
     where o.section_key = v_section and o.override_kind = 'pin'
       and (o.ends_at is null or o.ends_at > now())
       and (o.starts_at, o.created_at) < (v_debut, v_cree)
     order by o.starts_at desc, o.created_at desc
     limit 1;
  else
    select o.id, o.entity_type, o.entity_id, o.reason
      into v_voisin, v_type_b, v_id_b, v_raison_b
      from public.cms_content_overrides o
     where o.section_key = v_section and o.override_kind = 'pin'
       and (o.ends_at is null or o.ends_at > now())
       and (o.starts_at, o.created_at) > (v_debut, v_cree)
     order by o.starts_at asc, o.created_at asc
     limit 1;
  end if;

  if v_voisin is null then
    return jsonb_build_object('moved', false, 'reason', 'boundary');
  end if;

  update public.cms_content_overrides
     set entity_type = v_type_b, entity_id = v_id_b, reason = v_raison_b, updated_at = now()
   where id = p_entry_id;
  update public.cms_content_overrides
     set entity_type = v_type_a, entity_id = v_id_a, reason = v_raison_a, updated_at = now()
   where id = v_voisin;

  perform private.log_audit(
    p_action      => 'cms.landing_queue.reordered',
    p_object_type => 'cms_content_overrides',
    p_object_id   => p_entry_id::text,
    p_context     => jsonb_build_object('section_key', v_section,
                                        'direction',   p_direction,
                                        'swapped_with', v_voisin));

  return jsonb_build_object('moved', true, 'swapped_with', v_voisin);
end
$$;

comment on function public.move_landing_queue_entry(uuid, text) is
  'Echange le contenu d''un passage avec celui du creneau voisin. Les dates preparees restent en place (0121).';

revoke all on function public.move_landing_queue_entry(uuid, text) from public, anon;
grant execute on function public.move_landing_queue_entry(uuid, text) to authenticated, service_role;

create or replace function public.remove_landing_queue_entry(p_entry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_section text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.schedule') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  delete from public.cms_content_overrides o
   where o.id = p_entry_id
     and o.override_kind = 'pin'
     and o.section_key in ('news', 'events', 'opportunities')
  returning o.section_key into v_section;

  if v_section is null then
    raise exception 'entry_not_found' using errcode = 'P0002';
  end if;

  perform private.normalise_landing_queue(v_section);

  perform private.log_audit(
    p_action      => 'cms.landing_queue.removed',
    p_object_type => 'cms_content_overrides',
    p_object_id   => p_entry_id::text,
    p_context     => jsonb_build_object('section_key', v_section));

  return jsonb_build_object('removed', true, 'section_key', v_section);
end
$$;

comment on function public.remove_landing_queue_entry(uuid) is
  'Retire un passage de la file et referme les fenetres restantes (0121).';

revoke all on function public.remove_landing_queue_entry(uuid) from public, anon;
grant execute on function public.remove_landing_queue_entry(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6. Automatisation : exposer le contenu dont le tour est venu
--
--    L'epinglage decide de la POSITION ; il ne rend pas un contenu
--    visible. Sans cette tache, un article programme mais masque de la
--    vitrine resterait invisible le jour de son passage — le porteur
--    aurait a revenir a la main, ce qui est exactement ce qu'il ne veut
--    plus faire.
--
--    D-128 : on ecrit `landing_visibility`, RIEN D'AUTRE. Aucun statut
--    editorial n'est touche, et un brouillon reste un brouillon : la
--    projection publique le filtre de toute facon.
--
--    On ne remasque JAMAIS a la fin d'un passage. Le relais suffit :
--    le suivant prend la premiere place. Masquer serait une decision
--    editoriale que personne n'a demandee.
-- ---------------------------------------------------------------------

create or replace function private.apply_landing_queue()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_news integer := 0;
  v_evts integer := 0;
  v_opps integer := 0;
begin
  with actifs as (
    select o.entity_id
      from public.cms_content_overrides o
     where o.section_key = 'news' and o.override_kind = 'pin' and o.entity_type = 'news'
       and o.starts_at <= now() and (o.ends_at is null or o.ends_at > now())
  )
  update public.news n
     set landing_visibility = 'visible'
   where n.id in (select entity_id from actifs)
     and n.deleted_at is null
     and n.landing_visibility is distinct from 'visible';
  get diagnostics v_news = row_count;

  with actifs as (
    select o.entity_id
      from public.cms_content_overrides o
     where o.section_key = 'events' and o.override_kind = 'pin' and o.entity_type = 'event'
       and o.starts_at <= now() and (o.ends_at is null or o.ends_at > now())
  )
  update public.events e
     set landing_visibility = 'visible'
   where e.id in (select entity_id from actifs)
     and e.deleted_at is null
     and e.landing_visibility is distinct from 'visible';
  get diagnostics v_evts = row_count;

  with actifs as (
    select o.entity_id
      from public.cms_content_overrides o
     where o.section_key = 'opportunities' and o.override_kind = 'pin'
       and o.entity_type = 'opportunity'
       and o.starts_at <= now() and (o.ends_at is null or o.ends_at > now())
  )
  update public.opportunities op
     set landing_visibility = 'visible'
   where op.id in (select entity_id from actifs)
     and op.deleted_at is null
     and op.landing_visibility is distinct from 'visible';
  get diagnostics v_opps = row_count;

  if v_news + v_evts + v_opps > 0 then
    perform private.log_audit(
      p_action      => 'cms.landing_queue.applied',
      p_object_type => 'cms_content_overrides',
      p_actor_kind  => 'system',
      p_context     => jsonb_build_object('news', v_news, 'events', v_evts,
                                          'opportunities', v_opps));
  end if;

  return jsonb_build_object('news_exposed', v_news, 'events_exposed', v_evts,
                            'opportunities_exposed', v_opps, 'ran_at', now());
end
$$;

comment on function private.apply_landing_queue() is
  'Expose sur la vitrine (landing_visibility) le contenu dont le passage est en cours. N''ecrit aucun statut editorial (D-128, 0121).';

-- Les fonctions du schema `private` heritent du GRANT EXECUTE implicite a
-- PUBLIC. `private.security_baseline_violations()` l'a signale (kind
-- `anon_function_grant`) : constate, pas suppose. On le retire.
revoke all on function private.landing_queue_section_for(text) from public, anon, authenticated;
revoke all on function private.normalise_landing_queue(text)    from public, anon, authenticated;
revoke all on function private.apply_landing_queue()            from public, anon, authenticated;
grant execute on function private.landing_queue_section_for(text) to service_role;
grant execute on function private.normalise_landing_queue(text)   to service_role;
grant execute on function private.apply_landing_queue()           to service_role;

-- ---------------------------------------------------------------------
-- 7. Frequence de rotation de l'ISE du jour
--
--    La selection tournait tous les jours, sans reglage possible. Le
--    porteur veut pouvoir espacer : un ISE par semaine, par exemple.
--    On ne touche PAS au cron — il continue de passer chaque matin — et
--    on ne touche pas non plus a `private.featured_profile_eligible()`,
--    qui appartient a la migration 0120. Seul change le moment ou la
--    selection consent a designer quelqu'un de nouveau.
--
--    Sauter un jour ne vide pas l'encart : `get_landing_featured_profile()`
--    reprend la derniere selection publiee (`featured_date <= aujourd'hui`,
--    la plus recente). Le profil reste donc affiche jusqu'a la rotation
--    suivante. C'est constate dans le code de la fonction, pas suppose.
-- ---------------------------------------------------------------------

alter table public.cms_featured_profile_rules
  add column if not exists rotation_interval_days integer not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.cms_featured_profile_rules'::regclass
                    and conname  = 'cms_featured_profile_rules_rotation_interval_check') then
    alter table public.cms_featured_profile_rules
      add constraint cms_featured_profile_rules_rotation_interval_check
      check (rotation_interval_days between 1 and 90);
  end if;
end $$;

comment on column public.cms_featured_profile_rules.rotation_interval_days is
  'Nombre de jours entre deux rotations de l''ISE du jour. 1 = tous les jours (0121).';

create or replace function public.set_featured_profile_rotation(p_interval_days integer)
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
  if not private.has_permission('cms.featured_profile.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_interval_days is null or p_interval_days < 1 or p_interval_days > 90 then
    raise exception 'invalid_interval' using errcode = '22023';
  end if;

  update public.cms_featured_profile_rules
     set rotation_interval_days = p_interval_days,
         updated_by_profile_id  = v_actor
   where is_active;

  perform private.log_audit(
    p_action      => 'cms.featured_profile.rotation_changed',
    p_object_type => 'cms_featured_profile_rules',
    p_context     => jsonb_build_object('rotation_interval_days', p_interval_days));

  return jsonb_build_object('rotation_interval_days', p_interval_days);
end
$$;

comment on function public.set_featured_profile_rotation(integer) is
  'Regle la frequence de rotation automatique de l''ISE du jour, en jours (0121).';

revoke all on function public.set_featured_profile_rotation(integer) from public, anon;
grant execute on function public.set_featured_profile_rotation(integer) to authenticated, service_role;

-- Selection quotidienne : meme algorithme, meme equite par promotion, meme
-- depart aleatoire par empreinte SHA-256 du couple (jour, profil). SEUL
-- AJOUT : le respect de l'intervalle de rotation. Une designation manuelle
-- (`pin`) reste prioritaire et n'attend pas l'intervalle — c'est le sens
-- meme d'un forcage.
create or replace function private.run_daily_featured_profile(p_for_date date default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
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
  v_last      date;
begin
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
    -- 0121 — frequence de rotation. Tant que l'intervalle n'est pas ecoule,
    -- on ne designe personne : la selection precedente reste a l'affiche.
    if coalesce(v_rules.rotation_interval_days, 1) > 1 then
      select max(h.featured_date) into v_last
        from public.cms_featured_profile_history h
       where h.status in ('scheduled', 'published')
         and h.featured_date <= v_day;

      if v_last is not null
         and v_day - v_last < coalesce(v_rules.rotation_interval_days, 1) then
        return jsonb_build_object('date', v_day, 'profile_id', null, 'created', false,
                                  'reason', 'rotation_interval_not_elapsed',
                                  'last_featured_date', v_last,
                                  'rotation_interval_days', v_rules.rotation_interval_days);
      end if;
    end if;

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
                        'min_days_between_features', v_rules.min_days_between_features,
                        'rotation_interval_days', v_rules.rotation_interval_days))
  on conflict do nothing;

  perform private.log_audit(
    p_action => 'cms.featured_profile.selected',
    p_object_type => 'cms_featured_profile_history', p_object_id => v_chosen::text,
    p_actor_profile_id => case when v_mode = 'manual' then v_actor end,
    p_actor_kind => case when v_mode = 'manual' and v_actor is not null then 'user' else 'system' end,
    p_context => jsonb_build_object('date', v_day, 'mode', v_mode, 'pool', v_pool));

  return jsonb_build_object('date', v_day, 'profile_id', v_chosen, 'selection_mode', v_mode,
                            'status', 'scheduled', 'created', true, 'pool', v_pool);
end
$$;

-- ---------------------------------------------------------------------
-- 8. Orchestration
--
--    `run_cms_automations()` reste le declencheur manuel unique. La file
--    est appliquee AVANT la programmation d'exposition existante : si les
--    deux visent le meme contenu, la bascule programmee garde le dernier
--    mot, ce qui est l'ordre attendu (un ordre explicite prime).
-- ---------------------------------------------------------------------

create or replace function public.run_cms_automations()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_schedule jsonb;
  v_expire   jsonb;
  v_queue    jsonb;
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
  v_queue    := private.apply_landing_queue();
  v_schedule := private.publish_scheduled_cms_content();
  v_select   := private.run_daily_featured_profile();
  v_publish  := private.publish_featured_profile();

  return jsonb_build_object('expire', v_expire, 'landing_queue', v_queue,
                            'schedule', v_schedule,
                            'featured_profile_selection', v_select,
                            'featured_profile_publication', v_publish,
                            'ran_at', now());
end
$$;

-- ---------------------------------------------------------------------
-- 9. Planification reelle (D-129)
--
--    On ne declare rien : on planifie, et `get_cms_automation_status()`
--    lira l'etat dans `cron.job` / `cron.job_run_details`. Si pg_cron
--    manquait, la migration le DIRAIT au lieu de laisser croire.
-- ---------------------------------------------------------------------

do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is null then
    raise warning 'pg_cron absent : cms_apply_landing_queue ne sera PAS planifiee';
    return;
  end if;

  if exists (select 1 from cron.job where jobname = 'cms_apply_landing_queue') then
    perform cron.unschedule('cms_apply_landing_queue');
  end if;

  perform cron.schedule('cms_apply_landing_queue', '*/10 * * * *',
                        'select private.apply_landing_queue()');
end $$;
