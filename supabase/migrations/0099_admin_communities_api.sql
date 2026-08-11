-- =====================================================================
-- 0099 — API Superadmin pour les communautes (SA-027 -> 029)
-- =====================================================================
-- Reutilise directement (sans nouvelle fonction), meme principe que
-- 0094 (SA-023->026) :
--   * public.get_community            (private.can_see_community bypass
--     deja `has_permission('communities.manage')`, via
--     private.is_community_member -> 0044)
--   * public.get_community_post       (private.can_see_community_post
--     bypasse de meme, quel que soit le statut du billet)
--   * public.list_community_members   (private.is_community_member idem)
--
-- Nouveau, car aucune fonction (membre ou admin) ne couvrait ces cas :
--   * admin_list_communities   — liste TOUTES les communautes, tous
--     statuts (y compris 'draft', 'archived') et visibilites (y compris
--     'private'). public.list_communities (0072) filtre systematiquement
--     par private.can_see_community(), qui exclut les communautes
--     privees dont l'appelant n'est pas membre.
--   * admin_create_community  — 0072 est explicite : « aucune creation
--     de communaute par un membre : DIGEST D 4.7 la reserve a
--     l'administration en V1 ». La policy RLS `communities_create`
--     (0044) limite l'auto-creation au statut 'draft' par son auteur ;
--     AUCUNE fonction ne l'exposait cote admin non plus.
--   * admin_update_community, admin_set_community_status — edition du
--     contenu et cycle de vie (draft/active/inactive/archived/merged).
--   * admin_list_community_posts — file de moderation : tous statuts
--     (pending_review, flagged, hidden, removed...), alors que
--     public.list_community_posts (0072) ne renvoie que 'published'.
--   * admin_moderate_community_post / admin_moderate_community_comment
--     — masquer/restaurer/retirer un billet ou un commentaire, motif
--     obligatoire, journalise dans community_moderation_actions (0011).
--     Aucune fonction ne materialisait ces actions ; seule la policy
--     RLS `community_posts_moderate` / `community_comments_moderate`
--     (0044) ouvrait la voie a la modification directe, sans
--     validation de transition ni journalisation explicite.
--
-- Conventions (identiques a 0094) : security definer, search_path vide,
-- has_permission('communities.manage'), erreurs 28000/42501/P0001/P0002,
-- revoke public/anon, grant authenticated.
-- =====================================================================

-- ---------------------------------------------------------------------
-- admin_list_communities — tous statuts/visibilites, curseur keyset
-- ---------------------------------------------------------------------
create or replace function public.admin_list_communities(
  p_status text default null,
  p_community_type text default null,
  p_visibility text default null,
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
  if not private.has_permission('communities.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('draft', 'active', 'inactive', 'merged', 'archived') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if p_community_type is not null and p_community_type not in ('country', 'sector', 'thematic', 'special') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if p_visibility is not null and p_visibility not in ('network', 'private') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

  with base as (
    select c.id, c.created_at as at
      from public.communities c
     where c.deleted_at is null
       and (p_status is null or c.status = p_status)
       and (p_community_type is null or c.community_type = p_community_type)
       and (p_visibility is null or c.visibility = p_visibility)
       and (v_q is null or c.name ilike '%' || v_q || '%' or c.description ilike '%' || v_q || '%')
       and (v_c_at is null or (c.created_at, c.id) < (v_c_at, v_c_id))
     order by c.created_at desc, c.id desc
     limit v_limit
  )
  select coalesce(jsonb_agg(private.community_card(b.id, false) order by b.at desc, b.id desc), '[]'::jsonb),
         private.encode_keyset_cursor(min(b.at), (array_agg(b.id order by b.at, b.id))[1])
    into v_rows, v_next
    from base b;

  if jsonb_array_length(v_rows) < v_limit then
    v_next := null;
  end if;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end;
$$;

revoke all on function public.admin_list_communities(text, text, text, text, text, integer) from public, anon;
grant execute on function public.admin_list_communities(text, text, text, text, text, integer) to authenticated;
comment on function public.admin_list_communities(text, text, text, text, text, integer) is
  'SA-027 — Liste administrative des communautes, tous statuts et visibilites (y compris prive/brouillon). Reserve a communities.manage.';

-- ---------------------------------------------------------------------
-- admin_create_community — creation curatee (jamais par un membre)
-- ---------------------------------------------------------------------
create or replace function public.admin_create_community(
  p_name text,
  p_slug text,
  p_description text,
  p_community_type text,
  p_country_code char(2) default null,
  p_sector_id bigint default null,
  p_skill_domain_id bigint default null,
  p_purpose text default null,
  p_charter_text text default null,
  p_visibility text default 'network',
  p_join_policy text default 'open',
  p_post_moderation_mode text default 'immediate',
  p_status text default 'active'
)
returns public.communities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_description text := btrim(coalesce(p_description, ''));
  v_community public.communities;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('communities.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_name = '' or v_slug = '' or v_description = '' then
    raise exception 'community_missing_required_field' using errcode = 'P0001';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'invalid_slug' using errcode = 'P0001';
  end if;
  if p_community_type is null or p_community_type not in ('country', 'sector', 'thematic', 'special') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if p_community_type = 'country' and p_country_code is null then
    raise exception 'community_discriminant_required' using errcode = 'P0001';
  end if;
  if p_community_type = 'sector' and p_sector_id is null then
    raise exception 'community_discriminant_required' using errcode = 'P0001';
  end if;
  if coalesce(p_visibility, 'network') not in ('network', 'private') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if coalesce(p_join_policy, 'open') not in ('open', 'request', 'invitation') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if coalesce(p_post_moderation_mode, 'immediate') not in ('immediate', 'pre_approval') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if coalesce(p_status, 'active') not in ('draft', 'active') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  begin
    insert into public.communities (
      name, slug, description, purpose, charter_text, community_type,
      country_code, sector_id, skill_domain_id, visibility, join_policy,
      post_moderation_mode, status, created_by_profile_id
    )
    values (
      v_name, v_slug, v_description, p_purpose, p_charter_text, p_community_type,
      p_country_code, p_sector_id, p_skill_domain_id,
      coalesce(p_visibility, 'network'), coalesce(p_join_policy, 'open'),
      coalesce(p_post_moderation_mode, 'immediate'), coalesce(p_status, 'active'), v_me
    )
    returning * into v_community;
  exception when unique_violation then
    raise exception 'slug_already_exists' using errcode = 'P0001';
  end;

  return v_community;
end;
$$;

revoke all on function public.admin_create_community(text, text, text, text, char(2), bigint, bigint, text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_create_community(text, text, text, text, char(2), bigint, bigint, text, text, text, text, text, text) to authenticated;
comment on function public.admin_create_community(text, text, text, text, char(2), bigint, bigint, text, text, text, text, text, text) is
  'SA-027 — Creation administrative d''une communaute (curatee, jamais par un membre : 0072). Reserve a communities.manage.';

-- ---------------------------------------------------------------------
-- admin_update_community — edition du contenu et des politiques
-- ---------------------------------------------------------------------
create or replace function public.admin_update_community(
  p_community_id uuid,
  p_name text,
  p_description text,
  p_purpose text default null,
  p_charter_text text default null,
  p_visibility text default null,
  p_join_policy text default null,
  p_post_moderation_mode text default null
)
returns public.communities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := btrim(coalesce(p_description, ''));
  v_community public.communities;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('communities.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_name = '' or v_description = '' then
    raise exception 'community_missing_required_field' using errcode = 'P0001';
  end if;
  if p_visibility is not null and p_visibility not in ('network', 'private') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if p_join_policy is not null and p_join_policy not in ('open', 'request', 'invitation') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if p_post_moderation_mode is not null and p_post_moderation_mode not in ('immediate', 'pre_approval') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  update public.communities
     set name = v_name,
         description = v_description,
         purpose = p_purpose,
         charter_text = p_charter_text,
         visibility = coalesce(p_visibility, visibility),
         join_policy = coalesce(p_join_policy, join_policy),
         post_moderation_mode = coalesce(p_post_moderation_mode, post_moderation_mode)
   where id = p_community_id and deleted_at is null
  returning * into v_community;

  if not found then
    raise exception 'community_not_found' using errcode = 'P0002';
  end if;

  return v_community;
end;
$$;

revoke all on function public.admin_update_community(uuid, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_update_community(uuid, text, text, text, text, text, text, text) to authenticated;
comment on function public.admin_update_community(uuid, text, text, text, text, text, text, text) is
  'SA-028 — Edition administrative d''une communaute (contenu, charte, politiques). Reserve a communities.manage.';

-- ---------------------------------------------------------------------
-- admin_set_community_status — cycle de vie (0011 : draft/active/
-- inactive/merged/archived)
-- ---------------------------------------------------------------------
create or replace function public.admin_set_community_status(
  p_community_id uuid,
  p_status text,
  p_merged_into_community_id uuid default null
)
returns public.communities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_community public.communities;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('communities.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('draft', 'active', 'inactive', 'archived', 'merged') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  select * into v_community from public.communities where id = p_community_id and deleted_at is null for update;
  if not found then
    raise exception 'community_not_found' using errcode = 'P0002';
  end if;

  if p_status = 'merged' then
    if p_merged_into_community_id is null or p_merged_into_community_id = p_community_id then
      raise exception 'community_merge_target_required' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.communities t where t.id = p_merged_into_community_id and t.deleted_at is null
    ) then
      raise exception 'community_not_found' using errcode = 'P0002';
    end if;
  end if;

  update public.communities
     set status = p_status,
         merged_into_community_id = case when p_status = 'merged' then p_merged_into_community_id else null end
   where id = p_community_id
  returning * into v_community;

  return v_community;
end;
$$;

revoke all on function public.admin_set_community_status(uuid, text, uuid) from public, anon;
grant execute on function public.admin_set_community_status(uuid, text, uuid) to authenticated;
comment on function public.admin_set_community_status(uuid, text, uuid) is
  'SA-028 — Cycle de vie d''une communaute (activation, mise en sommeil, archivage, fusion). Reserve a communities.manage.';

-- ---------------------------------------------------------------------
-- admin_list_community_posts — file de moderation, tous statuts
-- ---------------------------------------------------------------------
create or replace function public.admin_list_community_posts(
  p_community_id uuid,
  p_status text default null,
  p_post_type text default null,
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
  v_c_at timestamptz;
  v_c_id uuid;
  v_rows jsonb := '[]'::jsonb;
  v_next text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('communities.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.communities c where c.id = p_community_id and c.deleted_at is null) then
    raise exception 'community_not_found' using errcode = 'P0002';
  end if;
  if p_status is not null and p_status not in
     ('draft', 'pending_review', 'published', 'flagged', 'hidden', 'removed', 'archived') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  select c_at, c_id into v_c_at, v_c_id from private.decode_keyset_cursor(p_cursor);

  with base as (
    select p.id, coalesce(p.published_at, p.created_at) as at
      from public.community_posts p
     where p.community_id = p_community_id
       and p.deleted_at is null
       and (p_status is null or p.status = p_status)
       and (p_post_type is null or p.post_type = p_post_type)
       and (v_c_at is null or (coalesce(p.published_at, p.created_at), p.id) < (v_c_at, v_c_id))
     order by coalesce(p.published_at, p.created_at) desc, p.id desc
     limit v_limit
  )
  select coalesce(jsonb_agg(private.community_post_card(b.id, false) order by b.at desc, b.id desc), '[]'::jsonb),
         private.encode_keyset_cursor(min(b.at), (array_agg(b.id order by b.at, b.id))[1])
    into v_rows, v_next
    from base b;

  if jsonb_array_length(v_rows) < v_limit then
    v_next := null;
  end if;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end;
$$;

revoke all on function public.admin_list_community_posts(uuid, text, text, text, integer) from public, anon;
grant execute on function public.admin_list_community_posts(uuid, text, text, text, integer) to authenticated;
comment on function public.admin_list_community_posts(uuid, text, text, text, integer) is
  'SA-029 — File de moderation des publications d''une communaute, tous statuts (pending_review, flagged, hidden, removed...). Reserve a communities.manage.';

-- ---------------------------------------------------------------------
-- admin_moderate_community_post — masquer/restaurer/retirer/verrouiller
-- ---------------------------------------------------------------------
create or replace function public.admin_moderate_community_post(
  p_post_id uuid,
  p_action text,
  p_reason_text text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_post public.community_posts;
  v_new_status text;
  v_new_locked boolean;
  v_log_action text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('communities.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('hide', 'restore', 'remove', 'lock', 'unlock') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_reason_text, ''))) < 10 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select * into v_post from public.community_posts where id = p_post_id and deleted_at is null for update;
  if not found then
    raise exception 'community_post_not_found' using errcode = 'P0002';
  end if;

  v_new_status := v_post.status;
  v_new_locked := v_post.is_locked;

  if p_action = 'hide' then
    if v_post.status <> 'published' then
      raise exception 'invalid_moderation_action' using errcode = 'P0001';
    end if;
    v_new_status := 'hidden';
    v_log_action := 'hide';
  elsif p_action = 'restore' then
    if v_post.status not in ('hidden', 'removed', 'flagged') then
      raise exception 'invalid_moderation_action' using errcode = 'P0001';
    end if;
    v_log_action := case when v_post.status = 'removed' then 'restore' else 'unhide' end;
    v_new_status := 'published';
  elsif p_action = 'remove' then
    if v_post.status = 'removed' then
      raise exception 'invalid_moderation_action' using errcode = 'P0001';
    end if;
    v_new_status := 'removed';
    v_log_action := 'remove';
  elsif p_action = 'lock' then
    if v_post.is_locked then
      raise exception 'invalid_moderation_action' using errcode = 'P0001';
    end if;
    v_new_locked := true;
    v_log_action := 'lock';
  elsif p_action = 'unlock' then
    if not v_post.is_locked then
      raise exception 'invalid_moderation_action' using errcode = 'P0001';
    end if;
    v_new_locked := false;
    v_log_action := 'unlock';
  end if;

  update public.community_posts
     set status = v_new_status,
         is_locked = v_new_locked,
         locked_at = case when p_action = 'lock' then now()
                          when p_action = 'unlock' then null
                          else locked_at end,
         locked_by_profile_id = case when p_action = 'lock' then v_me
                                      when p_action = 'unlock' then null
                                      else locked_by_profile_id end,
         published_at = case when p_action = 'restore' and published_at is null then now() else published_at end
   where id = p_post_id;

  insert into public.community_moderation_actions (
    community_id, actor_profile_id, target_type, target_post_id, action, reason_text
  )
  values (
    v_post.community_id, v_me, 'post', p_post_id, v_log_action, btrim(p_reason_text)
  );

  return jsonb_build_object('post_id', p_post_id, 'status', v_new_status, 'is_locked', v_new_locked);
end;
$$;

revoke all on function public.admin_moderate_community_post(uuid, text, text) from public, anon;
grant execute on function public.admin_moderate_community_post(uuid, text, text) to authenticated;
comment on function public.admin_moderate_community_post(uuid, text, text) is
  'SA-029 — Moderation d''une publication (masquer/restaurer/retirer/verrouiller), motif obligatoire, journalisee dans community_moderation_actions. Reserve a communities.manage.';

-- ---------------------------------------------------------------------
-- admin_moderate_community_comment — masquer/restaurer/retirer
-- ---------------------------------------------------------------------
create or replace function public.admin_moderate_community_comment(
  p_comment_id uuid,
  p_action text,
  p_reason_text text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_comment public.community_comments;
  v_community uuid;
  v_new_status text;
  v_log_action text;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('communities.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('hide', 'restore', 'remove') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_reason_text, ''))) < 10 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select p.community_id into v_community
    from public.community_comments k
    join public.community_posts p on p.id = k.post_id
   where k.id = p_comment_id and k.deleted_at is null;
  if v_community is null then
    raise exception 'community_comment_not_found' using errcode = 'P0002';
  end if;

  select * into v_comment from public.community_comments where id = p_comment_id and deleted_at is null for update;
  if not found then
    raise exception 'community_comment_not_found' using errcode = 'P0002';
  end if;

  if p_action = 'hide' then
    if v_comment.status <> 'published' then
      raise exception 'invalid_moderation_action' using errcode = 'P0001';
    end if;
    v_new_status := 'hidden';
    v_log_action := 'hide';
  elsif p_action = 'restore' then
    if v_comment.status not in ('hidden', 'removed', 'flagged') then
      raise exception 'invalid_moderation_action' using errcode = 'P0001';
    end if;
    v_log_action := case when v_comment.status = 'removed' then 'restore' else 'unhide' end;
    v_new_status := 'published';
  elsif p_action = 'remove' then
    if v_comment.status = 'removed' then
      raise exception 'invalid_moderation_action' using errcode = 'P0001';
    end if;
    v_new_status := 'removed';
    v_log_action := 'remove';
  end if;

  update public.community_comments set status = v_new_status where id = p_comment_id;

  insert into public.community_moderation_actions (
    community_id, actor_profile_id, target_type, target_comment_id, action, reason_text
  )
  values (
    v_community, v_me, 'comment', p_comment_id, v_log_action, btrim(p_reason_text)
  );

  return jsonb_build_object('comment_id', p_comment_id, 'status', v_new_status);
end;
$$;

revoke all on function public.admin_moderate_community_comment(uuid, text, text) from public, anon;
grant execute on function public.admin_moderate_community_comment(uuid, text, text) to authenticated;
comment on function public.admin_moderate_community_comment(uuid, text, text) is
  'SA-029 — Moderation d''un commentaire (masquer/restaurer/retirer), motif obligatoire, journalisee dans community_moderation_actions. Reserve a communities.manage.';
