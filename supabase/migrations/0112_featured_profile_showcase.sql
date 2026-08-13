-- =====================================================================
-- 0112_featured_profile_showcase
-- Photo et accroche editoriales pour « ISE du jour » (D-165).
--
-- CONTEXTE
--   Le teaser « ISE du jour » n'affichait qu'un monogramme (D-135) : le
--   bucket `avatars` est prive, et `allow_public_feature` ne consent qu'a
--   un teaser TEXTUEL, pas a la copie d'une photographie personnelle dans
--   un espace public (MASTER PROMPT §47). Cette regle ne change PAS ici.
--
--   Le porteur demande neanmoins qu'une vraie photo et une courte accroche
--   ("Gilles N'GATTA, le ISE qui voulait parler l'anglais...") paraissent
--   sur la carte. Or aucun ecran ne permet a ce jour a un membre de deposer
--   sa propre photo de profil (D-117 : « Depot de photo... non ouvert »).
--   Il n'existe donc aucune photo personnelle a exposer.
--
--   La reponse retenue : un visuel choisi par l'administrateur au moment
--   ou il programme la mise en avant, dans la MEME mediatheque publique
--   que le carrousel et les actualites (`cms_media_assets` / bucket
--   `landing-media`, deja public, deja soumise a l'obligation d'un texte
--   alternatif — CMS-008). Ce n'est donc PAS une photo personnelle tiree
--   du bucket prive `avatars` : c'est un visuel editorial que l'admin
--   choisit et decrit, exactement comme pour une diapositive de carrousel.
--   `avatars` reste prive, `avatar_path` n'est toujours pas projete.
--
--   L'accroche suit le meme principe : un texte court et volontairement
--   distinct de `public_summary` (qui reste affiche a cote), propre a
--   CHAQUE mise en avant plutot qu'au profil — la meme personne peut etre
--   remise en avant plus tard avec une accroche differente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Colonnes portees par l'INSTANCE de mise en avant, pas par le profil
--    (`cms_featured_profile_history`, une ligne par `featured_date`).
-- ---------------------------------------------------------------------
alter table public.cms_featured_profile_history
  add column if not exists showcase_media_id uuid references public.cms_media_assets(id) on delete set null,
  add column if not exists showcase_tagline   text;

alter table public.cms_featured_profile_history
  drop constraint if exists cms_featured_profile_history_tagline_length;
alter table public.cms_featured_profile_history
  add constraint cms_featured_profile_history_tagline_length
  check (showcase_tagline is null or char_length(btrim(showcase_tagline)) between 3 and 160);

comment on column public.cms_featured_profile_history.showcase_media_id is
  'Visuel editorial choisi par l''admin pour cette mise en avant (D-165). Reference la mediatheque publique (cms_media_assets, bucket landing-media) — jamais le bucket prive avatars.';
comment on column public.cms_featured_profile_history.showcase_tagline is
  'Accroche courte (3-160 caracteres), propre a cette mise en avant. Distincte de ise_profiles.public_summary, qui reste affiche a cote (D-165).';

-- ---------------------------------------------------------------------
-- 2. Ecriture reservee a cms.featured_profile.manage, auditee.
--    Cible la ligne d'historique par sa date : c'est la meme granularite
--    que « ISE du jour actuel » dans /cms/ise-du-jour (une seule ligne
--    courante ou a venir a la fois, cf. get_cms_featured_profile_overview).
-- ---------------------------------------------------------------------
create or replace function public.set_featured_profile_showcase(
  p_featured_date date,
  p_media_id      uuid default null,
  p_tagline       text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tagline text := nullif(btrim(coalesce(p_tagline, '')), '');
  v_history public.cms_featured_profile_history%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.featured_profile.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_tagline is not null and char_length(v_tagline) not between 3 and 160 then
    raise exception 'invalid_tagline' using errcode = 'P0001';
  end if;

  if p_media_id is not null and not exists (
    select 1 from public.cms_media_assets m
    where m.id = p_media_id
      and m.deleted_at is null
      and m.bucket_id = 'landing-media'
      and char_length(btrim(coalesce(m.alt_text, ''))) >= 3
  ) then
    raise exception 'invalid_media' using errcode = 'P0001';
  end if;

  select * into v_history
  from public.cms_featured_profile_history h
  where h.featured_date = p_featured_date
    and h.status in ('scheduled', 'published')
  order by h.created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  update public.cms_featured_profile_history
     set showcase_media_id = p_media_id,
         showcase_tagline  = v_tagline
   where id = v_history.id;

  perform private.log_audit(
    p_action      => 'cms.featured_profile.showcase_updated',
    p_object_type => 'cms_featured_profile_history',
    p_object_id   => v_history.id::text,
    p_context     => jsonb_build_object(
                       'featured_date', p_featured_date,
                       'from_media_id', v_history.showcase_media_id,
                       'to_media_id', p_media_id,
                       'from_tagline', v_history.showcase_tagline,
                       'to_tagline', v_tagline));

  return jsonb_build_object(
    'featured_date', p_featured_date,
    'showcase_media_id', p_media_id,
    'showcase_tagline', v_tagline);
end
$$;

revoke all on function public.set_featured_profile_showcase(date, uuid, text) from public, anon;
grant execute on function public.set_featured_profile_showcase(date, uuid, text) to authenticated;

comment on function public.set_featured_profile_showcase(date, uuid, text) is
  'D-165. Attache un visuel de la mediatheque publique et une accroche courte a une mise en avant « ISE du jour » donnee. Reserve a cms.featured_profile.manage. Audite (cms.featured_profile.showcase_updated).';

-- ---------------------------------------------------------------------
-- 3. Overview CMS-006 : expose les deux nouveaux champs sur la carte
--    « actuelle », pour que /cms/ise-du-jour puisse pre-remplir le
--    formulaire. Corps identique a la forme live (0067), seuls les deux
--    champs sont ajoutes a l'objet 'current'.
-- ---------------------------------------------------------------------
create or replace function public.get_cms_featured_profile_overview(
  p_history_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_history_limit, 20), 1), 100);
  v_day   date := (now() at time zone 'utc')::date;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.read') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'read_at', now(),
    'day', v_day,
    'rules', (
      select to_jsonb(r) from public.cms_featured_profile_rules r where r.is_active limit 1),
    'current', (
      select jsonb_build_object(
               'history_id',        h.id,
               'featured_date',     h.featured_date,
               'selection_mode',    h.selection_mode,
               'status',            h.status,
               'published_at',      h.published_at,
               'selection_context', h.selection_context,
               'showcase_media_id', h.showcase_media_id,
               'showcase_tagline',  h.showcase_tagline,
               'profile_id',        p.id,
               'display_name',      coalesce(nullif(btrim(p.display_name), ''),
                                             btrim(p.first_name || ' ' || p.last_name)),
               'current_position',  p.current_position,
               'organization',      org.canonical_name,
               'promotion',         case when pr.id is not null
                                         then pr.name || ' ' || pr.graduation_year::text end,
               'public_summary',    p.public_summary,
               'avatar_path',       p.avatar_path)
        from public.cms_featured_profile_history h
        join public.ise_profiles p on p.id = h.profile_id
        left join public.promotions pr on pr.id = p.promotion_id
        left join public.organizations org on org.id = p.current_organization_id
       where h.featured_date <= v_day
       order by h.featured_date desc, h.created_at desc
       limit 1),
    'history', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.featured_date desc)
        from (
          select h.featured_date,
                 h.selection_mode,
                 h.status,
                 h.published_at,
                 h.profile_id,
                 coalesce(nullif(btrim(p.display_name), ''),
                          btrim(p.first_name || ' ' || p.last_name)) as display_name,
                 p.current_position,
                 coalesce(nullif(btrim(a.display_name), ''),
                          btrim(a.first_name || ' ' || a.last_name)) as selected_by,
                 h.selection_context
            from public.cms_featured_profile_history h
            join public.ise_profiles p on p.id = h.profile_id
            left join public.ise_profiles a on a.id = h.selected_by_profile_id
           order by h.featured_date desc, h.created_at desc
           limit v_limit) x), '[]'::jsonb),
    'overrides', coalesce((
      select jsonb_agg(to_jsonb(y) order by y.starts_at desc)
        from (
          select o.id,
                 o.override_kind,
                 o.entity_id as profile_id,
                 coalesce(nullif(btrim(p.display_name), ''),
                          btrim(p.first_name || ' ' || p.last_name)) as display_name,
                 o.starts_at,
                 o.ends_at,
                 o.reason,
                 (o.starts_at <= now() and (o.ends_at is null or o.ends_at > now())) as is_active,
                 coalesce(nullif(btrim(a.display_name), ''),
                          btrim(a.first_name || ' ' || a.last_name)) as created_by
            from public.cms_content_overrides o
            left join public.ise_profiles p on p.id = o.entity_id
            left join public.ise_profiles a on a.id = o.created_by_profile_id
           where o.section_key = 'featured_profile'
           order by o.starts_at desc
           limit v_limit) y), '[]'::jsonb),
    'eligible_count', (
      select count(*) from public.ise_profiles p
       where p.deleted_at is null and private.featured_profile_eligible(p.id, v_day)));
end
$$;

comment on function public.get_cms_featured_profile_overview(integer) is
  'CMS-006. Regle active, selection courante (avec sa vitrine D-165), historique et overrides avec leur auteur. Ne projette AUCUNE donnee privee.';

-- ---------------------------------------------------------------------
-- 4. Teaser public : la photo (media public-safe, jamais l'avatar prive)
--    et l'accroche rejoignent les champs deja projetes. Corps identique a
--    la forme live (0068), deux cles ajoutees a l'objet renvoye.
-- ---------------------------------------------------------------------
create or replace function public.get_landing_featured_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_day        date := (now() at time zone 'utc')::date;
  v_profile    uuid;
  v_date       date;
  v_mode       text;
  v_media_id   uuid;
  v_tagline    text;
  v_result     jsonb;
begin
  if private.landing_section_hidden('featured_profile') then
    return null;
  end if;

  select h.profile_id, h.featured_date, h.selection_mode, h.showcase_media_id, h.showcase_tagline
    into v_profile, v_date, v_mode, v_media_id, v_tagline
  from public.cms_featured_profile_history h
  where h.status = 'published'
    and h.featured_date <= v_day
    and private.featured_profile_eligible(h.profile_id, v_day)
  order by h.featured_date desc
  limit 1;

  if v_profile is null then
    return null;
  end if;

  select jsonb_build_object(
           'entity_type',      'profile',
           'profile_id',       p.id,
           'display_name',     coalesce(nullif(btrim(p.display_name), ''),
                                        btrim(p.first_name || ' ' || p.last_name)),
           'promotion',        case when pr.id is not null
                                    then jsonb_build_object('id', pr.id, 'name', pr.name,
                                                            'graduation_year', pr.graduation_year) end,
           'current_position', p.current_position,
           'organization',     org.canonical_name,
           'public_summary',   p.public_summary,
           -- D-135 (inchangee) : aucune photographie personnelle, et pas
           -- meme son chemin. 'photo' ci-dessous vient de la mediatheque
           -- PUBLIQUE (D-165), jamais du bucket prive `avatars`.
           'photo',            case when v_media_id is null then null
                                     else private.landing_media(v_media_id) end,
           'tagline',          v_tagline,
           'expertise_areas',  coalesce((
                                 select jsonb_agg(jsonb_build_object('id', ea.id, 'name', ea.name,
                                                                     'slug', ea.slug)
                                                  order by ea.sort_order, ea.name)
                                 from public.profile_expertise_areas pea
                                 join public.expertise_areas ea on ea.id = pea.expertise_area_id
                                 where pea.profile_id = p.id and ea.is_active), '[]'::jsonb),
           'featured_date',    v_date,
           'selection_mode',   v_mode)
    into v_result
  from public.ise_profiles p
  left join public.promotions    pr  on pr.id  = p.promotion_id
  left join public.organizations org on org.id = p.current_organization_id
  where p.id = v_profile;

  return v_result;
end
$$;

revoke all on function public.get_landing_featured_profile() from public;
grant execute on function public.get_landing_featured_profile() to anon, authenticated, service_role;

comment on function public.get_landing_featured_profile() is
  'PUB-001 : teaser « ISE du jour », COMPOSE depuis ise_profiles (addendum §15). Aucune donnee privee. `avatar_path` toujours absent (D-135) ; `photo` (D-165) est un visuel de la mediatheque PUBLIQUE choisi par l''admin pour cette mise en avant, jamais l''avatar prive du membre.';

-- ---------------------------------------------------------------------
-- 5. Verification (D-125, D-135) : aucune fuite introduite.
--    Cette migration ne cree aucune nouvelle fonction anon-safe (le
--    nombre de fonctions dans la liste blanche `anon_function_grant` ne
--    change pas), et ne doit pas reintroduire `avatar_path`.
-- ---------------------------------------------------------------------
do $verify$
declare
  v_n integer;
begin
  if pg_get_functiondef('public.get_landing_featured_profile()'::regprocedure) like '%''avatar_path''%' then
    raise exception '0112: get_landing_featured_profile() projette avatar_path (D-135)';
  end if;

  select count(*) into v_n from private.security_baseline_violations();
  if v_n <> 0 then
    raise exception '0112: security_baseline_violations() renvoie % ligne(s)', v_n;
  end if;

  select count(*) into v_n from private.storage_baseline_violations();
  if v_n <> 0 then
    raise exception '0112: storage_baseline_violations() renvoie % ligne(s)', v_n;
  end if;
end
$verify$;
