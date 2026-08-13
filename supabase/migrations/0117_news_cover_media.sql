-- =====================================================================
-- 0117_news_cover_media
--
-- UNE SEULE IMAGE PAR ARTICLE, CHOISIE UNE SEULE FOIS, REUTILISEE PARTOUT
-- (carte landing + page article). Reponse directe a la question du porteur
-- de projet : « où est-ce que je mets l'image liée à l'actualité, et
-- comment ne pas devoir en poser 4 pour un seul article ? ».
--
-- CONTEXTE
--   `news.image_path` (0013) est un champ texte libre : jamais valide,
--   jamais garanti d'exister dans la mediatheque. `events` et
--   `opportunities` ont deja recu le bon patron (migration 0113, D-166) :
--   une colonne FK optionnelle vers `cms_media_assets`, jamais un chemin
--   recopie a la main. Cette migration applique EXACTEMENT ce patron a
--   `news`, et ajoute un second reglage propre aux actualites : certaines
--   couvertures (affiches, visuels d'evenement) portent deja un titre
--   incruste dans l'image — la carte d'accueil ne doit alors pas dupliquer
--   le titre par-dessus.
--
-- CE QUI EST AJOUTE
--   * news.cover_media_id  — FK optionnelle vers cms_media_assets,
--     ON DELETE SET NULL, meme patron que 0113 ;
--   * news.cover_has_text  — booleen, defaut false. `true` = l'image
--     contient deja un texte/titre incruste (affiche) : la carte d'accueil
--     masque visuellement (sr-only, jamais retire du DOM) le titre affiche
--     sous l'image, pour ne pas le dupliquer. `false` (defaut) = photo
--     simple, le titre reste affiche normalement ;
--   * backfill best-effort : les lignes dont `image_path` correspond a un
--     media deja enregistre dans la mediatheque publique recoivent leur
--     `cover_media_id` automatiquement. `image_path` n'est PAS supprimee :
--     meme logique que D-137 pour l'ancien bucket, on cesse de s'en servir
--     sans rien casser ;
--   * set_news_cover_media(p_news_id, p_media_id, p_has_text) — calquee sur
--     set_landing_cover_media (0113) : SECURITY DEFINER, search_path fige,
--     cms.edit, validation bucket landing-media + alt_text non vide,
--     audit. UN SEUL ECART VOLONTAIRE au brief : p_has_text est ici
--     `default null`, et une valeur null signifie « ne pas modifier ce
--     reglage » (coalesce sur la valeur existante) — pas « le remettre a
--     false ». Necessaire pour que les DEUX controles CMS (le selecteur de
--     media, et la case a cocher « texte incruste ») puissent chacun
--     n'ecrire QUE le champ qu'ils pilotent, sans lire l'etat courant
--     cote client avant d'ecrire. `p_media_id`, lui, garde exactement la
--     semantique du brief : `null` retire la couverture (aucun defaut,
--     jamais implicite) ;
--   * private.news_card() projette desormais `cover` (media resolu par
--     private.landing_media, meme fonction que evenements/opportunites) et
--     `cover_has_text`. `image_path` reste projete tel quel (compat
--     descendante, aucun appelant existant n'est casse) ;
--   * get_landing_news() remplace `private.landing_media_by_path(image_path)`
--     par `private.landing_media(cover_media_id)`, et projette
--     `cover_has_text` a cote de `cover` — meme cle que private.news_card,
--     pour que le front n'ait qu'une seule forme a connaitre ;
--   * list_cms_news() (0067) projette `cover_media_id` et `cover_has_text`
--     en plus de l'existant, pour prereplir le formulaire CMS.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS
--   * ne supprime pas `news.image_path` (deprecie, conserve) ;
--   * ne touche a aucun autre champ metier (editorial_status, visibility,
--     landing_visibility, landing_priority, is_featured) ;
--   * n'ouvre aucun privilege supplementaire a anon.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Colonnes
-- ---------------------------------------------------------------------
alter table public.news
  add column if not exists cover_media_id uuid references public.cms_media_assets(id) on delete set null;

alter table public.news
  add column if not exists cover_has_text boolean not null default false;

comment on column public.news.cover_media_id is
  'Visuel de couverture, unique et reutilise partout (carte landing + page article) : 0117. Reference la mediatheque publique (cms_media_assets, bucket landing-media) — jamais un chemin libre. Remplace news.image_path (conserve, deprecie, D-137).';

comment on column public.news.cover_has_text is
  'true = l''image de couverture porte deja un texte/titre incruste (affiche) : la carte d''accueil masque visuellement (sr-only) le titre sous l''image plutot que de le dupliquer. false (defaut) = photo simple, titre affiche normalement. Sans effet sur la page article (0117).';

-- ---------------------------------------------------------------------
-- 2. Backfill best-effort depuis image_path.
--    Meme logique de correspondance que private.landing_media_by_path()
--    (0068) : bucket public, chemin identique, alternative textuelle
--    presente. En cas de doublons de chemin, le media le plus recent
--    gagne (meme ordre que landing_media_by_path).
-- ---------------------------------------------------------------------
update public.news n
   set cover_media_id = match.media_id
  from (
    select distinct on (n2.id) n2.id as news_id, m2.id as media_id
      from public.news n2
      join public.cms_media_assets m2
        on m2.bucket_id = 'landing-media'
       and m2.storage_path = n2.image_path
       and m2.deleted_at is null
       and char_length(btrim(coalesce(m2.alt_text, ''))) >= 3
     where n2.image_path is not null
     order by n2.id, m2.created_at desc, m2.id desc
  ) match
 where match.news_id = n.id
   and n.cover_media_id is null;

-- ---------------------------------------------------------------------
-- 3. Ecriture, reservee a cms.edit, auditee.
--    p_has_text = null : ne modifie pas le reglage existant (voir note
--    d'ecart au brief dans l'entete de fichier). p_media_id : aucun
--    defaut, null retire explicitement la couverture.
-- ---------------------------------------------------------------------
create or replace function public.set_news_cover_media(
  p_news_id  uuid,
  p_media_id uuid,
  p_has_text boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket        text;
  v_alt           text;
  v_deleted       timestamptz;
  v_from_media    uuid;
  v_from_has_text boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.edit') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_media_id is not null then
    select m.bucket_id, m.alt_text, m.deleted_at
      into v_bucket, v_alt, v_deleted
      from public.cms_media_assets m
     where m.id = p_media_id;
    if v_bucket is null or v_deleted is not null then
      raise exception 'invalid_media' using errcode = 'P0001';
    end if;
    if v_bucket <> 'landing-media' or char_length(btrim(coalesce(v_alt, ''))) < 3 then
      raise exception 'invalid_media' using errcode = 'P0001';
    end if;
  end if;

  select n.cover_media_id, n.cover_has_text
    into v_from_media, v_from_has_text
    from public.news n
   where n.id = p_news_id and n.deleted_at is null
   for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  update public.news
     set cover_media_id = p_media_id,
         cover_has_text = coalesce(p_has_text, v_from_has_text),
         updated_at = now()
   where id = p_news_id;

  perform private.log_audit(
    p_action      => 'cms.news_cover_media',
    p_object_type => 'news',
    p_object_id   => p_news_id::text,
    p_context     => jsonb_build_object(
                        'from_media_id', v_from_media, 'to_media_id', p_media_id,
                        'from_has_text', v_from_has_text,
                        'to_has_text', coalesce(p_has_text, v_from_has_text)));

  return jsonb_build_object(
    'news_id', p_news_id, 'media_id', p_media_id,
    'has_text', coalesce(p_has_text, v_from_has_text));
end
$$;

revoke all on function public.set_news_cover_media(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_news_cover_media(uuid, uuid, boolean) to authenticated, service_role;

comment on function public.set_news_cover_media(uuid, uuid, boolean) is
  '0117. Pose/retire la couverture d''un article (mediatheque publique, landing-media, alt_text >= 3 caracteres) et/ou son reglage cover_has_text. Exige cms.edit. p_has_text = null preserve le reglage existant (ecart documente au brief, cf. entete du fichier) ; p_media_id n''a pas de defaut, null retire explicitement la couverture.';

-- ---------------------------------------------------------------------
-- 4. private.news_card() : ajoute 'cover' (media resolu) et
--    'cover_has_text'. Corps identique a 0074, deux champs ajoutes.
-- ---------------------------------------------------------------------
create or replace function private.news_card(p_news uuid, p_full boolean default false)
returns jsonb language plpgsql stable security definer set search_path = ''
as $fn$
declare v_me uuid := private.current_profile_id(); v_row record; v_out jsonb;
begin
  if p_news is null or not private.can_see_news(p_news) then return null; end if;
  select n.id, n.category_code, n.title, n.slug, n.summary, n.body, n.event_date,
         n.image_path, n.cover_media_id, n.cover_has_text, n.source_type, n.source_url,
         n.visibility, n.promotion_id,
         n.community_id, n.is_featured, n.editorial_status, n.published_at,
         n.submitted_by_profile_id, n.landing_visibility, n.created_at
    into v_row
  from public.news n where n.id = p_news and n.deleted_at is null;
  if not found then return null; end if;

  v_out := jsonb_build_object(
    'news_id', v_row.id, 'category_code', v_row.category_code,
    'category_name', (select c.name from public.news_categories c where c.code = v_row.category_code),
    'title', v_row.title, 'slug', v_row.slug, 'summary', v_row.summary,
    'event_date', v_row.event_date, 'image_path', v_row.image_path,
    'cover', private.landing_media(v_row.cover_media_id),
    'cover_has_text', v_row.cover_has_text,
    'source_type', v_row.source_type, 'source_url', v_row.source_url,
    'visibility', v_row.visibility, 'is_featured', v_row.is_featured,
    'editorial_status', v_row.editorial_status, 'published_at', v_row.published_at,
    'created_at', v_row.created_at,
    'is_submitter', (v_row.submitted_by_profile_id = v_me),
    -- Fait editorial affiche tel quel par l'interface (D-123, D-131).
    'landing_visibility', v_row.landing_visibility,
    'promotion', (select concat_ws(' ', pr.program_code, pr.graduation_year::text)
                    from public.promotions pr where pr.id = v_row.promotion_id),
    'community', (select c.name from public.communities c where c.id = v_row.community_id),
    'profiles', coalesce((select jsonb_agg(private.network_profile_card(np.profile_id)
                                           || jsonb_build_object('profile_role', np.profile_role))
                            from public.news_profiles np
                           where np.news_id = p_news
                             and private.network_profile_card(np.profile_id) is not null), '[]'::jsonb),
    'skills', coalesce((select jsonb_agg(s.name order by s.name)
                          from public.news_skills ns join public.skills s on s.id = ns.skill_id
                         where ns.news_id = p_news), '[]'::jsonb));

  if p_full then
    v_out := v_out || jsonb_build_object(
      'body', v_row.body,
      'organizations', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.canonical_name)
                                                  order by o.canonical_name)
                                   from public.news_organizations no2
                                   join public.organizations o on o.id = no2.organization_id
                                  where no2.news_id = p_news), '[]'::jsonb),
      'communities', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name)
                                 from public.news_communities nc
                                 join public.communities c on c.id = nc.community_id
                                where nc.news_id = p_news), '[]'::jsonb),
      'sources', coalesce((select jsonb_agg(jsonb_build_object('source_type', s.source_type,
                                     'source_url', s.source_url, 'title', s.title,
                                     'verified_at', s.verified_at) order by s.created_at)
                             from public.news_sources s where s.news_id = p_news), '[]'::jsonb),
      -- Trois actualites connexes au maximum (DIGEST D 6.8, F 29).
      'related', coalesce((select jsonb_agg(jsonb_build_object('news_id', r.id, 'title', r.title,
                                     'category_code', r.category_code, 'published_at', r.published_at)
                                   order by r.published_at desc)
                             from (select n2.id, n2.title, n2.category_code, n2.published_at
                                     from public.news n2
                                    where n2.id <> p_news and n2.deleted_at is null
                                      and n2.editorial_status = 'published'
                                      and n2.category_code = v_row.category_code
                                      and private.can_see_news(n2.id)
                                    order by n2.published_at desc limit 3) r), '[]'::jsonb));
  end if;
  return v_out;
end
$fn$;
revoke all on function private.news_card(uuid, boolean) from public, anon, authenticated;

comment on function private.news_card(uuid, boolean) is
  '0074, etendue par 0117 : projette desormais "cover" (media resolu par private.landing_media, comme evenements/opportunites) et "cover_has_text". "image_path" reste projete tel quel pour compatibilite descendante.';

-- ---------------------------------------------------------------------
-- 5. get_landing_news() : remplace image (resolue par chemin) par cover
--    (resolue par cover_media_id) + cover_has_text. Reste du corps
--    identique a 0068, a la lettre.
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
                    'cover',         private.landing_media(n.cover_media_id),
                    'cover_has_text', n.cover_has_text,
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
  'PUB-001 : dernieres actualites reellement publiees (addendum §11). Le corps de l''article n''est jamais projete. Depuis 0117 : "cover" est resolue par cover_media_id (mediatheque publique, comme evenements/opportunites) au lieu du chemin nu image_path ; "cover_has_text" indique si le titre est deja incruste dans l''image.';

-- ---------------------------------------------------------------------
-- 6. list_cms_news() (0067) : ajoute cover_media_id et cover_has_text,
--    pour prereplir le formulaire CMS. Corps identique, deux colonnes
--    ajoutees a la projection de ligne.
-- ---------------------------------------------------------------------
create or replace function public.list_cms_news(
  p_query  text    default null,
  p_limit  integer default 25,
  p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit  integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_like   text    := case when nullif(btrim(coalesce(p_query, '')), '') is null
                           then null else '%' || btrim(p_query) || '%' end;
  v_total  bigint;
  v_rows   jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.read') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select count(*) into v_total
  from public.news n
  where n.deleted_at is null
    and (v_like is null or n.title ilike v_like or n.summary ilike v_like);

  select coalesce(jsonb_agg(to_jsonb(r) - 'ord' order by r.ord), '[]'::jsonb)
    into v_rows
  from (
    select row_number() over (order by n.landing_priority desc,
                                       coalesce(n.published_at, n.created_at) desc) as ord,
           n.id,
           n.title,
           n.slug,
           n.summary,
           n.category_code,
           n.image_path,
           n.cover_media_id,
           n.cover_has_text,
           n.editorial_status,
           n.visibility,
           n.landing_visibility,
           n.landing_priority,
           n.is_featured,
           n.featured_at,
           n.published_at,
           n.created_at,
           (select jsonb_build_object('id', s.id, 'publish_at', s.publish_at,
                                      'unpublish_at', s.unpublish_at, 'status', s.status)
              from public.cms_publication_schedule s
             where s.entity_type = 'news' and s.entity_id = n.id and s.status = 'pending'
             order by coalesce(s.publish_at, s.unpublish_at)
             limit 1) as pending_schedule
      from public.news n
     where n.deleted_at is null
       and (v_like is null or n.title ilike v_like or n.summary ilike v_like)
     order by n.landing_priority desc, coalesce(n.published_at, n.created_at) desc
     limit v_limit offset v_offset
  ) r;

  return jsonb_build_object('total', v_total, 'limit', v_limit,
                            'offset', v_offset, 'rows', v_rows);
end
$$;

comment on function public.list_cms_news(text, integer, integer) is
  'CMS-004. Colonnes ENUMEREES : news.body ne franchit jamais cette frontiere. Exige cms.read, sans exiger content.publish. Depuis 0117 : cover_media_id et cover_has_text ajoutes pour prereplir le formulaire de couverture.';

-- ---------------------------------------------------------------------
-- 7. Verification — la migration echoue plutot que de mentir (§98).
-- ---------------------------------------------------------------------
do $verify$
declare
  v_n         integer;
  v_news_def  text;
  v_card_def  text;
begin
  select pg_get_functiondef(oid) into v_news_def
    from pg_proc where proname = 'get_landing_news' and pronamespace = 'public'::regnamespace;
  select pg_get_functiondef(oid) into v_card_def
    from pg_proc where proname = 'news_card' and pronamespace = 'private'::regnamespace;

  if v_news_def like '%news.body%' then
    raise exception '0117: get_landing_news() projette un champ prive';
  end if;
  if v_news_def not like '%cover_has_text%' then
    raise exception '0117: get_landing_news() ne projette pas cover_has_text';
  end if;
  if v_card_def not like '%cover_has_text%' then
    raise exception '0117: private.news_card() ne projette pas cover_has_text';
  end if;

  select count(*) into v_n from private.security_baseline_violations();
  if v_n <> 0 then
    raise exception '0117: security_baseline_violations() renvoie % ligne(s)', v_n;
  end if;

  select count(*) into v_n from private.storage_baseline_violations();
  if v_n <> 0 then
    raise exception '0117: storage_baseline_violations() renvoie % ligne(s)', v_n;
  end if;
end
$verify$;
