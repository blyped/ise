-- =====================================================================
-- 0061_public_landing_projections
-- Applique le 2026-08-08. Export fidele de la migration appliquee.
-- Ne pas editer : toute correction passe par une nouvelle migration.
--
-- PROJECTIONS PUBLIC-SAFE DE PUB-001.
-- Sources : ADDENDUM §44, §45, §23, §13, §21, §24, §26, §47 ;
--           CDC additionnel §11, §14, §19, §21, §22.
--
-- PRINCIPE NON NEGOCIABLE
--   `anon` n'a AUCUN privilege sur `public` depuis 0026, et cette migration
--   NE L'ASSOUPLIT PAS. Aucune table metier n'est exposee au web ouvert.
--   La landing lit exclusivement les fonctions ci-dessous, dont le contrat
--   est de ne projeter QUE des champs explicitement autorises.
--   « Ne pas assouplir RLS sur une table complete uniquement pour afficher
--   quatre cartes » (addendum §45).
--
-- CE QUI N'EST JAMAIS PROJETE
--   e-mail, telephone, adresse, date de naissance, score de completion,
--   `bio`, `headline`, corps d'article, description complete d'une offre,
--   remuneration, coordonnees de contact, `events.online_url_private`,
--   identifiants de membres tiers, contenu de message, note administrative.
--
-- RESILIENCE (addendum §47)
--   Les contenus CMS sont lus dans `published_snapshot`, jamais dans les
--   colonnes vivantes : une edition en cours n'atteint pas le site, et une
--   panne du CMS laisse la derniere version publiee servie telle quelle.
--
-- AUCUN CHIFFRE EN DUR (addendum §23, MASTER PROMPT §98)
--   get_landing_stats() compte des lignes reelles. Un compteur a 0 parce que
--   l'annuaire n'est pas importe renvoie 0, jamais un chiffre d'illustration.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. HELPERS D'OVERRIDE EDITORIAL (addendum §43)
-- ---------------------------------------------------------------------
create or replace function private.landing_section_hidden(p_section_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cms_content_overrides o
    where o.section_key = p_section_key
      and o.override_kind = 'hide'
      and o.starts_at <= now()
      and (o.ends_at is null or o.ends_at > now())
  )
$$;

revoke all on function private.landing_section_hidden(text) from public, anon, authenticated;

create or replace function private.landing_override_position(
  p_section_key text, p_entity_type text, p_entity_id uuid
)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select min(coalesce(o.display_position, 0))::smallint
  from public.cms_content_overrides o
  where o.section_key = p_section_key
    and o.override_kind = 'pin'
    and o.entity_type = p_entity_type
    and o.entity_id = p_entity_id
    and o.starts_at <= now()
    and (o.ends_at is null or o.ends_at > now())
$$;

revoke all on function private.landing_override_position(text, text, uuid) from public, anon, authenticated;

create or replace function private.landing_is_excluded(
  p_section_key text, p_entity_type text, p_entity_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cms_content_overrides o
    where o.section_key = p_section_key
      and o.override_kind = 'exclude'
      and o.entity_type = p_entity_type
      and o.entity_id = p_entity_id
      and o.starts_at <= now()
      and (o.ends_at is null or o.ends_at > now())
  )
$$;

revoke all on function private.landing_is_excluded(text, text, uuid) from public, anon, authenticated;

comment on function private.landing_section_hidden(text) is
  'Un override « hide » actif masque une section entiere de PUB-001 (addendum §43). A expiration, la section revient d''elle-meme.';

-- ---------------------------------------------------------------------
-- 2. MEDIA PUBLIC-SAFE
--    Projette le chemin Storage et l'alternative textuelle, jamais l'auteur
--    du depot ni les metadonnees internes.
-- ---------------------------------------------------------------------
create or replace function private.landing_media(p_media_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'bucket', m.bucket_id, 'path', m.storage_path, 'alt_text', m.alt_text,
           'credit', m.credit, 'width', m.width, 'height', m.height)
  from public.cms_media_assets m
  where m.id = p_media_id and m.deleted_at is null
$$;

revoke all on function private.landing_media(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. CARROUSEL (addendum §9, §26)
--    Une slide sponsorisee dont la campagne n'est plus publiee est EXCLUE :
--    elle perdrait sa mention de transparence.
-- ---------------------------------------------------------------------
create or replace function public.get_landing_carousel()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.landing_section_hidden('hero_carousel') then '[]'::jsonb
         else coalesce((
           select jsonb_agg(s.item order by s.prio desc, s.id)
           from (
             select c.id, c.priority as prio,
                    jsonb_build_object(
                      'id',            c.id,
                      'title',         c.published_snapshot->>'title',
                      'subtitle',      c.published_snapshot->>'subtitle',
                      'description',   c.published_snapshot->>'description',
                      'content_type',  c.published_snapshot->>'content_type',
                      'entity_type',   c.published_snapshot->>'entity_type',
                      'entity_id',     c.published_snapshot->>'entity_id',
                      'cta_label',     c.published_snapshot->>'cta_label',
                      'priority',      c.priority,
                      'media',         private.landing_media((c.published_snapshot->>'media_id')::uuid),
                      'mobile_media',  private.landing_media((c.published_snapshot->>'mobile_media_id')::uuid),
                      'is_sponsored',  c.is_sponsored,
                      'sponsored_label', pc.sponsored_label
                    ) as item
             from public.cms_carousel_items c
             left join public.cms_partner_campaigns pc on pc.id = c.partner_campaign_id
             where c.status = 'published'
               and c.published_snapshot is not null
               and (c.start_at is null or c.start_at <= now())
               and (c.end_at   is null or c.end_at   >  now())
               and (
                 not c.is_sponsored
                 or (pc.id is not null and pc.status = 'published'
                     and pc.start_at <= now() and pc.end_at > now())
               )
           ) s
         ), '[]'::jsonb) end
$$;

revoke all on function public.get_landing_carousel() from public;
grant execute on function public.get_landing_carousel() to anon, authenticated, service_role;

comment on function public.get_landing_carousel() is
  'PUB-001 : slides publiees et dans leur periode. Lit published_snapshot (addendum §48). Une slide sponsorisee sans campagne active est exclue : pas de mention, pas de diffusion (§26).';

-- ---------------------------------------------------------------------
-- 4. SECTIONS (addendum §33)
-- ---------------------------------------------------------------------
create or replace function public.get_landing_sections()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
             'section_key',   s.section_key,
             'title',         s.published_snapshot->>'title',
             'subtitle',      s.published_snapshot->>'subtitle',
             'display_order', s.display_order,
             'source_mode',   s.published_snapshot->>'source_mode',
             'max_items',     (s.published_snapshot->>'max_items')::int,
             'cta_label',     s.published_snapshot->>'cta_label',
             'cta_entity_type', s.published_snapshot->>'cta_entity_type',
             'cta_entity_id',   s.published_snapshot->>'cta_entity_id',
             'configuration', s.published_snapshot->'configuration')
           order by s.display_order, s.section_key)
    from public.cms_sections s
    where s.status = 'published'
      and s.is_enabled
      and s.published_snapshot is not null
      and not private.landing_section_hidden(s.section_key)
  ), '[]'::jsonb)
$$;

revoke all on function public.get_landing_sections() from public;
grant execute on function public.get_landing_sections() to anon, authenticated, service_role;

comment on function public.get_landing_sections() is
  'PUB-001 : squelette publie de la landing (ordre, titres, nombre de cartes). Une section non publiee n''existe pas pour le site public (addendum §48).';

-- ---------------------------------------------------------------------
-- 5. ACTUALITES (addendum §11 ; CDC §9)
--    Source unique : public.news. Aucune table d'actualites publiques.
--    `visibility = 'members'` est exige : une actualite reservee a une
--    promotion ou a une communaute n'a rien a faire sur le web ouvert.
--    Le corps de l'article (`body`) n'est JAMAIS projete : c'est le teaser.
-- ---------------------------------------------------------------------
create or replace function public.get_landing_news(p_limit integer default 3)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.landing_section_hidden('news') then '[]'::jsonb
         else coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id',            n.id,
                    'entity_type',   'news',
                    'title',         n.title,
                    'slug',          n.slug,
                    'summary',       n.summary,
                    'category_code', n.category_code,
                    'image_path',    n.image_path,
                    'published_at',  n.published_at,
                    'is_featured',   n.is_featured,
                    'is_pinned',     private.landing_override_position('news', 'news', n.id) is not null)
                  order by private.landing_override_position('news', 'news', n.id) asc nulls last,
                           n.landing_priority desc, n.published_at desc, n.id desc)
           from public.news n
           where n.deleted_at is null
             and n.editorial_status = 'published'
             and n.visibility = 'members'
             and n.landing_visibility = 'visible'
             and n.published_at is not null
             and n.published_at <= now()
             and n.duplicate_of_news_id is null
             and not private.landing_is_excluded('news', 'news', n.id)
             and n.id in (
               select n2.id from public.news n2
               where n2.deleted_at is null
                 and n2.editorial_status = 'published'
                 and n2.visibility = 'members'
                 and n2.landing_visibility = 'visible'
                 and n2.published_at is not null
                 and n2.published_at <= now()
                 and n2.duplicate_of_news_id is null
                 and not private.landing_is_excluded('news', 'news', n2.id)
               order by private.landing_override_position('news', 'news', n2.id) asc nulls last,
                        n2.landing_priority desc, n2.published_at desc, n2.id desc
               limit least(greatest(coalesce(p_limit, 3), 1), 24))
         ), '[]'::jsonb) end
$$;

revoke all on function public.get_landing_news(integer) from public;
grant execute on function public.get_landing_news(integer) to anon, authenticated, service_role;

comment on function public.get_landing_news(integer) is
  'PUB-001 : dernieres actualites reellement publiees, issues du module Actualites (addendum §11). Le corps de l''article n''est jamais projete : le detail exige la connexion.';

-- ---------------------------------------------------------------------
-- 6. EVENEMENTS (addendum §12 ; CDC §10)
--    Un evenement passe quitte la section de lui-meme : le filtre porte sur
--    starts_at, pas sur un drapeau a maintenir a la main.
--    `online_url_private` n'est JAMAIS projete (privilege de colonne, 0050).
-- ---------------------------------------------------------------------
create or replace function public.get_landing_events(p_limit integer default 3)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.landing_section_hidden('events') then '[]'::jsonb
         else coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id',              e.id,
                    'entity_type',     'event',
                    'title',           e.title,
                    'slug',            e.slug,
                    'event_type_code', e.event_type_code,
                    'starts_at',       e.starts_at,
                    'ends_at',         e.ends_at,
                    'timezone',        e.timezone,
                    'format',          e.format,
                    'city',            e.city,
                    'country_code',    e.country_code,
                    'is_pinned',       private.landing_override_position('events', 'event', e.id) is not null)
                  order by private.landing_override_position('events', 'event', e.id) asc nulls last,
                           e.landing_priority desc, e.starts_at asc, e.id desc)
           from public.events e
           where e.id in (
             select e2.id from public.events e2
             where e2.deleted_at is null
               and e2.status = 'published'
               and e2.cancelled_at is null
               and e2.visibility = 'members'
               and e2.landing_visibility = 'visible'
               and e2.starts_at > now()
               and not private.landing_is_excluded('events', 'event', e2.id)
             order by private.landing_override_position('events', 'event', e2.id) asc nulls last,
                      e2.landing_priority desc, e2.starts_at asc, e2.id desc
             limit least(greatest(coalesce(p_limit, 3), 1), 24))
         ), '[]'::jsonb) end
$$;

revoke all on function public.get_landing_events(integer) from public;
grant execute on function public.get_landing_events(integer) to anon, authenticated, service_role;

comment on function public.get_landing_events(integer) is
  'PUB-001 : prochains evenements publies. Le lien de connexion (online_url_private) n''est jamais projete. Un evenement passe ou annule sort automatiquement (addendum §12).';

-- ---------------------------------------------------------------------
-- 7. OPPORTUNITES — TEASER UNIQUEMENT (addendum §13 ; CDC §11)
--    Champs autorises : titre, type, secteur, zone, echeance, organisation
--    SI elle est verifiee. Jamais la description, la remuneration, le
--    contact, ni l'URL de candidature externe.
-- ---------------------------------------------------------------------
create or replace function public.get_landing_opportunities(p_limit integer default 3)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.landing_section_hidden('opportunities') then '[]'::jsonb
         else coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id',              o.id,
                    'entity_type',     'opportunity',
                    'title',           o.title,
                    'opportunity_type', o.opportunity_type,
                    'contract_type',   o.contract_type,
                    'sector',          sec.name,
                    'country_code',    o.country_code,
                    'city',            o.city,
                    'remote_allowed',  o.remote_allowed,
                    'deadline',        o.deadline,
                    'organization',    case when org.id is not null and org.is_verified
                                            then org.canonical_name end,
                    'is_pinned',       private.landing_override_position('opportunities', 'opportunity', o.id) is not null)
                  order by private.landing_override_position('opportunities', 'opportunity', o.id) asc nulls last,
                           o.landing_priority desc, o.published_at desc, o.id desc)
           from public.opportunities o
           left join public.sectors       sec on sec.id = o.sector_id
           left join public.organizations org on org.id = o.organization_id
           where o.id in (
             select o2.id from public.opportunities o2
             where o2.deleted_at is null
               and o2.status = 'active'
               and o2.visibility = 'members'
               and o2.landing_visibility = 'visible'
               and o2.moderation_status in ('not_required', 'approved')
               and o2.published_at is not null
               and o2.published_at <= now()
               and (o2.deadline is null or o2.deadline > now())
               and not private.landing_is_excluded('opportunities', 'opportunity', o2.id)
             order by private.landing_override_position('opportunities', 'opportunity', o2.id) asc nulls last,
                      o2.landing_priority desc, o2.published_at desc, o2.id desc
             limit least(greatest(coalesce(p_limit, 3), 1), 24))
         ), '[]'::jsonb) end
$$;

revoke all on function public.get_landing_opportunities(integer) from public;
grant execute on function public.get_landing_opportunities(integer) to anon, authenticated, service_role;

comment on function public.get_landing_opportunities(integer) is
  'PUB-001 : TEASER d''opportunites (addendum §13). Ni description, ni remuneration, ni contact, ni URL de candidature. Le detail complet reste authentifie.';

-- ---------------------------------------------------------------------
-- 8. ISE DU JOUR (addendum §15, §21, §44 ; CDC §13, §14, §19)
--
--    Le teaser est COMPOSE depuis ise_profiles et profile_expertise_areas.
--    Aucune copie du profil ne vit dans le CMS : cms_featured_profile_history
--    ne porte qu'un identifiant, une date et un mode de selection.
--
--    Champs projetes : nom d'affichage, promotion, poste, organisation,
--    resume public, domaines d'expertise, avatar. RIEN D'AUTRE.
--    Jamais : e-mail, telephone, adresse, date de naissance, bio interne,
--    headline, score de completion, LinkedIn, disponibilite.
--
--    FALLBACK (addendum §21) : selection du jour -> derniere selection
--    publiee encore eligible -> NULL (le bloc est masque). Jamais d'erreur,
--    jamais un profil incomplet.
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
  v_result     jsonb;
begin
  if private.landing_section_hidden('featured_profile') then
    return null;
  end if;

  select h.profile_id, h.featured_date, h.selection_mode
    into v_profile, v_date, v_mode
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
           'avatar_path',      p.avatar_path,
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
  'PUB-001 : teaser « ISE du jour », COMPOSE depuis ise_profiles (addendum §15). Sept champs autorises, aucune donnee privee. Fallback en cascade puis NULL : la landing n''est jamais cassee (§21).';

-- ---------------------------------------------------------------------
-- 9. EXPERTISES (addendum §24 ; CDC §22)
--    Taxonomie reelle. Le nombre de profils est COMPTE, jamais illustre :
--    tant que l'annuaire n'est pas importe, il vaut 0 et doit valoir 0.
--
--    La selection editoriale (choisir, ordonner, masquer) passe par
--    cms_sections.configuration -> expertise_slugs, et non par
--    cms_content_overrides : expertise_areas.id est un bigint, incompatible
--    avec entity_id (uuid). Liste vide ou absente = taxonomie complete.
-- ---------------------------------------------------------------------
create or replace function public.get_landing_expertises(p_limit integer default 8)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with sel as (
    select (e.value #>> '{}') as slug, e.ordinality as ord
    from public.cms_sections s
    cross join lateral jsonb_array_elements(
        coalesce(s.published_snapshot->'configuration'->'expertise_slugs', '[]'::jsonb)
      ) with ordinality as e(value, ordinality)
    where s.section_key = 'expertises' and s.status = 'published'
  ),
  base as (
    select ea.id, ea.name, ea.slug, ea.description, ea.sort_order,
           (select x.ord from sel x where x.slug = ea.slug) as ord,
           (select count(*)
              from public.profile_expertise_areas pea
              join public.ise_profiles p on p.id = pea.profile_id
             where pea.expertise_area_id = ea.id
               and p.deleted_at is null
               and p.profile_status = 'active'
               and not p.is_test_account) as profile_count
    from public.expertise_areas ea
    where ea.is_active
      and (not exists (select 1 from sel)
           or exists (select 1 from sel x where x.slug = ea.slug))
  )
  select case when private.landing_section_hidden('expertises') then '[]'::jsonb
         else coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id',            b.id,
                    'entity_type',   'expertise_area',
                    'name',          b.name,
                    'slug',          b.slug,
                    'description',   b.description,
                    'profile_count', b.profile_count)
                  order by b.ord nulls last, b.sort_order, b.name)
           from (select * from base
                  order by ord nulls last, sort_order, name
                  limit least(greatest(coalesce(p_limit, 8), 1), 24)) b
         ), '[]'::jsonb) end
$$;

revoke all on function public.get_landing_expertises(integer) from public;
grant execute on function public.get_landing_expertises(integer) to anon, authenticated, service_role;

comment on function public.get_landing_expertises(integer) is
  'PUB-001 : taxonomie reelle des domaines d''expertise, avec un decompte de profils REELLEMENT calcule (addendum §24, CDC §22). Zero reste zero.';

-- ---------------------------------------------------------------------
-- 10. PARTENAIRES (addendum §25, §26, §27)
--     `sponsored_label` est toujours renvoye : c'est la contrepartie de
--     l'affichage. Une campagne hors periode n'apparait pas ; une campagne
--     expiree a deja ete basculee par private.expire_cms_content().
-- ---------------------------------------------------------------------
create or replace function public.get_landing_partners(p_placement text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.landing_section_hidden('partners') then '[]'::jsonb
         else coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id',               pc.id,
                    'entity_type',      'organization',
                    'organization_id',  org.id,
                    'organization_name', org.canonical_name,
                    'organization_logo', org.logo_path,
                    'campaign_name',    pc.published_snapshot->>'campaign_name',
                    'placement',        pc.placement,
                    'title',            pc.published_snapshot->>'title',
                    'description',      pc.published_snapshot->>'description',
                    'cta_label',        pc.published_snapshot->>'cta_label',
                    'target_entity_type', pc.published_snapshot->>'target_entity_type',
                    'target_entity_id',   pc.published_snapshot->>'target_entity_id',
                    'target_url',       pc.published_snapshot->>'target_url',
                    'sponsored_label',  pc.sponsored_label,
                    'media',            private.landing_media((pc.published_snapshot->>'media_id')::uuid),
                    'mobile_media',     private.landing_media((pc.published_snapshot->>'mobile_media_id')::uuid))
                  order by pc.placement, pc.start_at desc, pc.id)
           from public.cms_partner_campaigns pc
           join public.organizations org on org.id = pc.organization_id
           where pc.status = 'published'
             and pc.published_snapshot is not null
             and pc.start_at <= now()
             and pc.end_at   >  now()
             and (p_placement is null or pc.placement = p_placement)
         ), '[]'::jsonb) end
$$;

revoke all on function public.get_landing_partners(text) from public;
grant execute on function public.get_landing_partners(text) to anon, authenticated, service_role;

comment on function public.get_landing_partners(text) is
  'PUB-001 : campagnes partenaires actives. sponsored_label accompagne SYSTEMATIQUEMENT la campagne (addendum §26). Hors periode : absente (§27).';

-- ---------------------------------------------------------------------
-- 11. CHIFFRES DU RESEAU (addendum §23 ; CDC §21 ; MASTER PROMPT §98)
--
--     Chaque compteur nomme sa source. Aucun nombre n'est ecrit en dur :
--     les 1842 / 37 / 29 / 126 des maquettes sont des illustrations et ne
--     doivent jamais atteindre la Production.
--
--     « promotions representees » compte les promotions ayant AU MOINS un
--     profil reference, pas les 72 lignes du referentiel : une promotion
--     sans aucun ISE n'est pas representee.
--     « pays d'exercice » agrege le pays courant et les pays des experiences
--     professionnelles reellement saisies.
-- ---------------------------------------------------------------------
create or replace function public.get_landing_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with live as (
    select p.id, p.promotion_id, p.current_country_code, p.current_organization_id
    from public.ise_profiles p
    where p.deleted_at is null
      and not p.is_test_account
      and p.profile_status in ('referenced', 'active')
  ),
  countries as (
    select country_code from (
      select l.current_country_code as country_code from live l
      union
      select e.country_code from public.experiences e join live l on l.id = e.profile_id
    ) c where country_code is not null
  ),
  orgs as (
    select organization_id from (
      select l.current_organization_id as organization_id from live l
      union
      select e.organization_id from public.experiences e join live l on l.id = e.profile_id
    ) o where organization_id is not null
  )
  select jsonb_build_object(
    'profiles',      jsonb_build_object(
                       'value', (select count(*) from live),
                       'source', 'ise_profiles hors test, non supprimes, statut referenced ou active'),
    'promotions',    jsonb_build_object(
                       'value', (select count(distinct promotion_id) from live where promotion_id is not null),
                       'source', 'promotions effectivement representees par au moins un profil'),
    'countries',     jsonb_build_object(
                       'value', (select count(distinct country_code) from countries),
                       'source', 'pays d''exercice distincts : ise_profiles.current_country_code et experiences.country_code'),
    'organizations', jsonb_build_object(
                       'value', (select count(distinct organization_id) from orgs),
                       'source', 'organisations resolues : ise_profiles.current_organization_id et experiences.organization_id'),
    'computed_at',   now())
$$;

revoke all on function public.get_landing_stats() from public;
grant execute on function public.get_landing_stats() to anon, authenticated, service_role;

comment on function public.get_landing_stats() is
  'PUB-001 : chiffres du reseau COMPTES sur les donnees reelles (addendum §23, MASTER PROMPT §98). Chaque compteur nomme sa source. Un annuaire vide renvoie 0, jamais un chiffre d''illustration.';

-- ---------------------------------------------------------------------
-- 12. EXTENSION DU CONTROLE DE SECURITE
--
--     Cette migration accorde pour la PREMIERE FOIS un privilege EXECUTE a
--     `anon`. Le controle de base doit donc verifier que cette ouverture
--     reste bornee a la liste blanche des neuf projections public-safe.
--     Toute fonction supplementaire exposee a `anon` fait echouer la CI.
--
--     Les quatre controles historiques sont conserves a l'identique
--     (0050) : RLS, privileges de table `anon`, search_path fige,
--     schemas prives, colonnes masquees.
-- ---------------------------------------------------------------------
create or replace function private.security_baseline_violations()
returns table (kind text, object_name text, detail text)
language sql
stable
security definer
set search_path = ''
as $$
  select 'rls_disabled', c.relname::text, 'table public sans RLS'
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  union all
  select 'anon_grant', g.table_schema || '.' || g.table_name, 'privilege ' || g.privilege_type || ' accorde a anon'
  from information_schema.role_table_grants g
  where g.grantee = 'anon' and g.table_schema in ('public', 'private', 'analytics')
  union all
  select 'secdef_no_search_path', n.nspname || '.' || p.proname, 'SECURITY DEFINER sans search_path fige'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  union all
  select 'private_exposed', g.table_schema || '.' || g.table_name, 'schema prive accessible a authenticated'
  from information_schema.role_table_grants g
  where g.grantee = 'authenticated' and g.table_schema in ('private', 'analytics')
  union all
  select 'private_column_exposed',
         cp.table_schema || '.' || cp.table_name || '.' || cp.column_name,
         'privilege ' || cp.privilege_type || ' accorde a ' || cp.grantee
  from information_schema.column_privileges cp
  join (values
          ('public', 'ise_profiles',         'profile_completion', 'SELECT'),
          ('public', 'ise_profiles',         'profile_completion', 'UPDATE'),
          ('public', 'ise_profiles',         'profile_completion', 'INSERT'),
          ('public', 'network_call_matches', 'score',              'SELECT'),
          ('public', 'network_call_matches', 'component_scores',   'SELECT'),
          ('public', 'opportunity_matches',  'score',              'SELECT'),
          ('public', 'opportunity_matches',  'component_scores',   'SELECT'),
          ('public', 'mentorship_matches',   'score',              'SELECT'),
          ('public', 'events',               'online_url_private', 'SELECT')
       ) as masked(s, t, c, p)
    on masked.s = cp.table_schema
   and masked.t = cp.table_name
   and masked.c = cp.column_name
   and masked.p = cp.privilege_type
  where cp.grantee in ('authenticated', 'anon')
  union all
  select 'anon_function_grant', n.nspname || '.' || p.proname,
         'EXECUTE accorde a anon hors liste blanche des projections public-safe'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
    and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
    and p.proname not in (
      'get_landing_carousel', 'get_landing_sections', 'get_landing_news',
      'get_landing_events', 'get_landing_opportunities', 'get_landing_featured_profile',
      'get_landing_expertises', 'get_landing_partners', 'get_landing_stats')
  order by 1, 2
$$;

comment on function private.security_baseline_violations() is
  'Controle de securite execute par la CI et les tests (MASTER PROMPT §80, §84). Doit renvoyer 0 ligne. Six controles : RLS, privileges de table anon, search_path fige, schemas prives, neuf colonnes masquees, et liste blanche des fonctions exposees a anon (0061).';
