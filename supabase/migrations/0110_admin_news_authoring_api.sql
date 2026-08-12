-- =====================================================================
-- 0110 — API Superadmin de redaction des actualites (module manquant,
-- tache #83 : « le CMS ne remplace pas le circuit editorial »).
-- =====================================================================
-- CONTEXTE — jusqu'ici AUCUNE fonction, membre ou admin, ne permettait de
-- creer un article. `/cms/actualites` (0067) pilote uniquement
-- l'EXPOSITION sur la landing (`landing_visibility`, `landing_priority`,
-- `is_featured`) — jamais `editorial_status` ni `body` (D-128). Les deux
-- premiers articles de lancement ont ete inseres a la main par SQL en
-- attendant cette tranche.
--
-- Reutilise directement (sans nouvelle fonction), meme principe que 0100 :
--   * public.get_news(p_news)            — `private.can_see_news` (0046)
--     bypasse deja `has_permission('content.publish')`, y compris pour
--     les statuts non publies. Sert de LECTURE detail (comme `get_event`
--     pour SA-031).
--   * private.news_card(p_news, p_full)  — meme bypass, reutilise ICI
--     comme forme de ligne de `admin_list_news`.
--
-- Nouveau, car aucune fonction ne couvrait ces cas :
--   * admin_list_news    — liste TOUS les statuts editoriaux, avec
--     filtre optionnel par statut/categorie, pagination par curseur
--     (meme construction que `admin_list_events`).
--   * admin_create_news  — creation directe d'un article par un titulaire
--     de `content.publish` (toujours en 'draft', meme principe que
--     `admin_create_event`). Aucune politique RLS n'ouvrait l'insertion
--     directe sur `news` pour l'admin (seule la policy `news_manage`,
--     0046, couvre l'UPDATE ; aucune n'ouvre l'INSERT).
--   * admin_update_news  — edition du contenu, hors statuts terminaux.
--   * admin_set_news_status — cycle de vie restreint a l'usage reel
--     ('draft' <-> 'published' <-> 'archived') : les statuts
--     'submitted'/'under_review'/'approved'/'rejected'/'duplicate'
--     appartiennent a un eventuel circuit de SOUMISSION MEMBRE, non
--     construit (aucun ecran ne l'expose) — cette fonction ne les
--     touche pas, `news_editorial_status_check` (0013) les accepte
--     neanmoins pour ne pas re-contraindre la table.
--
-- Conventions (identiques a 0100) : security definer, search_path vide,
-- has_permission('content.publish'), erreurs 28000/42501/P0001/P0002,
-- revoke public/anon, grant authenticated.
-- =====================================================================

-- ---------------------------------------------------------------------
-- admin_list_news — tous statuts editoriaux, pagination par curseur
-- ---------------------------------------------------------------------
create or replace function public.admin_list_news(
  p_status text default null,
  p_category_code text default null,
  p_query text default null,
  p_cursor text default null,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
  v_c_at timestamptz;
  v_c_id uuid;
  v_rows jsonb := '[]'::jsonb;
  v_next text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('content.publish') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in
     ('draft', 'submitted', 'under_review', 'approved', 'published',
      'rejected', 'archived', 'duplicate') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

  with base as (
    select n.id, n.created_at as at
      from public.news n
     where n.deleted_at is null
       and (p_status is null or n.editorial_status = p_status)
       and (p_category_code is null or n.category_code = p_category_code)
       and (v_q is null or n.title ilike '%' || v_q || '%')
       and (v_c_at is null or (n.created_at, n.id) < (v_c_at, v_c_id))
     order by n.created_at desc, n.id desc
     limit v_limit
  )
  select coalesce(jsonb_agg(private.news_card(b.id, false) order by b.at desc, b.id desc), '[]'::jsonb),
         private.encode_keyset_cursor(min(b.at), (array_agg(b.id order by b.at, b.id))[1])
    into v_rows, v_next
    from base b;

  if jsonb_array_length(v_rows) < v_limit then
    v_next := null;
  end if;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end;
$$;

revoke all on function public.admin_list_news(text, text, text, text, integer) from public, anon;
grant execute on function public.admin_list_news(text, text, text, text, integer) to authenticated;
comment on function public.admin_list_news(text, text, text, text, integer) is
  'Liste administrative des actualites, tous statuts editoriaux. Reserve a content.publish.';

-- ---------------------------------------------------------------------
-- admin_create_news — creation directe (toujours en 'draft')
-- ---------------------------------------------------------------------
create or replace function public.admin_create_news(
  p_category_code text,
  p_title text,
  p_slug text,
  p_summary text,
  p_body text default null,
  p_event_date date default null,
  p_image_path text default null,
  p_source_type text default null,
  p_source_url text default null,
  p_visibility text default 'members',
  p_promotion_id bigint default null,
  p_community_id uuid default null,
  p_editorial_level smallint default 3
)
returns public.news
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_title text := btrim(coalesce(p_title, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_summary text := btrim(coalesce(p_summary, ''));
  v_news public.news;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('content.publish') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_title = '' or length(v_title) < 3 or length(v_title) > 240
     or v_slug = '' or v_summary = '' or length(v_summary) > 400 then
    raise exception 'news_missing_required_field' using errcode = 'P0001';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'invalid_slug' using errcode = 'P0001';
  end if;
  if p_category_code is null or not exists (
       select 1 from public.news_categories c where c.code = p_category_code and c.is_active
     ) then
    raise exception 'invalid_category' using errcode = 'P0001';
  end if;
  if coalesce(p_visibility, 'members') not in ('members', 'promotion', 'community') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if p_visibility = 'promotion' and p_promotion_id is null then
    raise exception 'news_scope_target_required' using errcode = 'P0001';
  end if;
  if p_visibility = 'community' and p_community_id is null then
    raise exception 'news_scope_target_required' using errcode = 'P0001';
  end if;
  if p_source_type is not null and p_source_type not in
     ('internal', 'linkedin_public', 'organization_site', 'media_article',
      'scientific_publication', 'institutional_site', 'other') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if p_source_type is not null and p_source_type not in ('internal', 'other') and p_source_url is null then
    raise exception 'news_source_url_required' using errcode = 'P0001';
  end if;
  if coalesce(p_editorial_level, 3) < 1 or coalesce(p_editorial_level, 3) > 3 then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  begin
    insert into public.news (
      category_code, title, slug, summary, body, event_date, image_path,
      source_type, source_url, visibility, promotion_id, community_id,
      editorial_level, editorial_status, submitted_by_profile_id
    )
    values (
      p_category_code, v_title, v_slug, v_summary, nullif(btrim(coalesce(p_body, '')), ''),
      p_event_date, nullif(btrim(coalesce(p_image_path, '')), ''),
      p_source_type, p_source_url, coalesce(p_visibility, 'members'), p_promotion_id, p_community_id,
      coalesce(p_editorial_level, 3), 'draft', v_me
    )
    returning * into v_news;
  exception when unique_violation then
    raise exception 'slug_already_exists' using errcode = 'P0001';
  end;

  return v_news;
end;
$$;

revoke all on function public.admin_create_news(
  text, text, text, text, text, date, text, text, text, text, bigint, uuid, smallint
) from public, anon;
grant execute on function public.admin_create_news(
  text, text, text, text, text, date, text, text, text, text, bigint, uuid, smallint
) to authenticated;
comment on function public.admin_create_news(
  text, text, text, text, text, date, text, text, text, text, bigint, uuid, smallint
) is
  'Creation administrative directe d''un article (toujours en brouillon). Reserve a content.publish.';

-- ---------------------------------------------------------------------
-- admin_update_news — edition du contenu, hors statuts terminaux
-- ---------------------------------------------------------------------
create or replace function public.admin_update_news(
  p_news_id uuid,
  p_category_code text,
  p_title text,
  p_summary text,
  p_body text default null,
  p_event_date date default null,
  p_image_path text default null,
  p_source_type text default null,
  p_source_url text default null,
  p_visibility text default null,
  p_promotion_id bigint default null,
  p_community_id uuid default null,
  p_editorial_level smallint default null
)
returns public.news
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_title text := btrim(coalesce(p_title, ''));
  v_summary text := btrim(coalesce(p_summary, ''));
  v_news public.news;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('content.publish') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_title = '' or length(v_title) < 3 or length(v_title) > 240
     or v_summary = '' or length(v_summary) > 400 then
    raise exception 'news_missing_required_field' using errcode = 'P0001';
  end if;
  if p_category_code is null or not exists (
       select 1 from public.news_categories c where c.code = p_category_code and c.is_active
     ) then
    raise exception 'invalid_category' using errcode = 'P0001';
  end if;
  if p_visibility is not null and p_visibility not in ('members', 'promotion', 'community') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if p_source_type is not null and p_source_type not in
     ('internal', 'linkedin_public', 'organization_site', 'media_article',
      'scientific_publication', 'institutional_site', 'other') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if p_source_type is not null and p_source_type not in ('internal', 'other') and p_source_url is null then
    raise exception 'news_source_url_required' using errcode = 'P0001';
  end if;
  if p_editorial_level is not null and (p_editorial_level < 1 or p_editorial_level > 3) then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  select * into v_news from public.news where id = p_news_id and deleted_at is null for update;
  if not found then
    raise exception 'news_not_found' using errcode = 'P0002';
  end if;
  if v_news.editorial_status in ('archived', 'duplicate') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if p_visibility = 'promotion' and coalesce(p_promotion_id, v_news.promotion_id) is null then
    raise exception 'news_scope_target_required' using errcode = 'P0001';
  end if;
  if p_visibility = 'community' and coalesce(p_community_id, v_news.community_id) is null then
    raise exception 'news_scope_target_required' using errcode = 'P0001';
  end if;

  update public.news
     set category_code = p_category_code,
         title = v_title,
         summary = v_summary,
         body = coalesce(nullif(btrim(coalesce(p_body, '')), ''), body),
         event_date = coalesce(p_event_date, event_date),
         image_path = coalesce(nullif(btrim(coalesce(p_image_path, '')), ''), image_path),
         source_type = coalesce(p_source_type, source_type),
         source_url = coalesce(p_source_url, source_url),
         visibility = coalesce(p_visibility, visibility),
         promotion_id = case when p_visibility is not null then p_promotion_id else promotion_id end,
         community_id = case when p_visibility is not null then p_community_id else community_id end,
         editorial_level = coalesce(p_editorial_level, editorial_level)
   where id = p_news_id
  returning * into v_news;

  return v_news;
end;
$$;

revoke all on function public.admin_update_news(
  uuid, text, text, text, text, date, text, text, text, text, bigint, uuid, smallint
) from public, anon;
grant execute on function public.admin_update_news(
  uuid, text, text, text, text, date, text, text, text, text, bigint, uuid, smallint
) to authenticated;
comment on function public.admin_update_news(
  uuid, text, text, text, text, date, text, text, text, text, bigint, uuid, smallint
) is
  'Edition administrative du contenu d''un article non archive. Reserve a content.publish.';

-- ---------------------------------------------------------------------
-- admin_set_news_status — cycle de vie restreint a l'usage reel
-- ---------------------------------------------------------------------
create or replace function public.admin_set_news_status(
  p_news_id uuid,
  p_status text
)
returns public.news
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_news public.news;
  v_allowed text[];
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('content.publish') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('draft', 'published', 'archived') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  select * into v_news from public.news where id = p_news_id and deleted_at is null for update;
  if not found then
    raise exception 'news_not_found' using errcode = 'P0002';
  end if;

  v_allowed := case v_news.editorial_status
                 when 'draft' then array['published', 'archived']
                 when 'published' then array['draft', 'archived']
                 when 'archived' then array['draft']
                 else array[]::text[]
               end;
  if not (p_status = any(v_allowed)) then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  update public.news
     set editorial_status = p_status,
         published_at = case when p_status = 'published' then coalesce(published_at, now())
                              else published_at end,
         reviewed_by_profile_id = v_me,
         reviewed_at = now()
   where id = p_news_id
  returning * into v_news;

  return v_news;
end;
$$;

revoke all on function public.admin_set_news_status(uuid, text) from public, anon;
grant execute on function public.admin_set_news_status(uuid, text) to authenticated;
comment on function public.admin_set_news_status(uuid, text) is
  'Cycle de vie editorial restreint (brouillon / publie / archive) d''un article redige par l''admin. Reserve a content.publish.';
