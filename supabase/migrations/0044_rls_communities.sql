-- =====================================================================
-- 0044_rls_communities
-- Ouverture des politiques RLS du lot « Communautes » (0011).
--
-- Deux niveaux seulement (`communities.visibility`) :
--   * `network`  — l'existence et la fiche de la communaute sont visibles
--                  de tout membre actif ; le CONTENU reste reserve aux
--                  membres de la communaute, sauf billet explicitement
--                  publie en `network` ;
--   * `private`  — la communaute elle-meme n'existe que pour ses membres.
--
-- Le blocage s'applique au niveau du contenu : on ne lit pas le billet ni
-- le commentaire d'un membre qui nous a bloque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function private.is_community_member(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_community is not null
     and private.current_profile_id() is not null
     and (
       private.has_permission('communities.manage')
       or exists (
         select 1 from public.community_memberships m
         where m.community_id = p_community
           and m.profile_id = private.current_profile_id()
           and m.membership_status = 'active'
       )
     )
$$;
revoke all on function private.is_community_member(uuid) from public, anon;
grant execute on function private.is_community_member(uuid) to authenticated;
comment on function private.is_community_member(uuid) is
  'Membre actif d''une communaute, ou porteur de `communities.manage`. Booleen.';

create or replace function private.is_community_moderator(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_community is not null
     and private.current_profile_id() is not null
     and (
       private.has_permission('communities.manage')
       or exists (
         select 1 from public.community_memberships m
         where m.community_id = p_community
           and m.profile_id = private.current_profile_id()
           and m.membership_status = 'active'
           and m.role in ('moderator', 'manager')
       )
       or exists (
         select 1 from public.communities c
         where c.id = p_community
           and c.created_by_profile_id = private.current_profile_id()
       )
     )
$$;
revoke all on function private.is_community_moderator(uuid) from public, anon;
grant execute on function private.is_community_moderator(uuid) to authenticated;

create or replace function private.can_see_community(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_community is not null
     and private.current_profile_id() is not null
     and (
       private.is_community_member(p_community)
       or exists (
         select 1 from public.communities c
         where c.id = p_community
           and c.deleted_at is null
           and c.visibility = 'network'
           and c.status in ('active', 'inactive', 'merged')
           and private.is_active_member()
       )
     )
$$;
revoke all on function private.can_see_community(uuid) from public, anon;
grant execute on function private.can_see_community(uuid) to authenticated;

-- Un billet : membre de la communaute, ou billet ouvert au reseau depuis
-- une communaute elle-meme ouverte. Blocage evalue dans tous les cas.
create or replace function private.can_see_community_post(p_post uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_post is not null
     and private.current_profile_id() is not null
     and exists (
       select 1
       from public.community_posts p
       join public.communities c on c.id = p.community_id
       where p.id = p_post
         and (
           p.author_profile_id = private.current_profile_id()
           or private.has_permission('communities.manage')
           or (
             p.deleted_at is null
             and p.status = 'published'
             and not private.is_blocked_between(p.author_profile_id, private.current_profile_id())
             and (
               private.is_community_member(p.community_id)
               or (p.visibility = 'network'
                   and c.visibility = 'network'
                   and c.deleted_at is null
                   and private.is_active_member())
             )
           )
         )
     )
$$;
revoke all on function private.can_see_community_post(uuid) from public, anon;
grant execute on function private.can_see_community_post(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- communities
-- ---------------------------------------------------------------------
drop policy if exists communities_select on public.communities;
create policy communities_select on public.communities
  for select to authenticated
  using (private.can_see_community(id));

drop policy if exists communities_create on public.communities;
create policy communities_create on public.communities
  for insert to authenticated
  with check (created_by_profile_id = private.current_profile_id()
              and private.is_active_member()
              and status = 'draft');

drop policy if exists communities_update_moderator on public.communities;
create policy communities_update_moderator on public.communities
  for update to authenticated
  using (private.is_community_moderator(id))
  with check (private.is_community_moderator(id));

drop policy if exists communities_manage on public.communities;
create policy communities_manage on public.communities
  for all to authenticated
  using (private.has_permission('communities.manage'))
  with check (private.has_permission('communities.manage'));

-- ---------------------------------------------------------------------
-- Adhesions
-- ---------------------------------------------------------------------
drop policy if exists community_memberships_select on public.community_memberships;
create policy community_memberships_select on public.community_memberships
  for select to authenticated
  using (profile_id = private.current_profile_id()
         or private.is_community_member(community_id));

-- Rejoindre : `active` immediatement si la communaute est ouverte,
-- `pending` sinon. Le membre ne s'auto-promeut jamais moderateur.
drop policy if exists community_memberships_join on public.community_memberships;
create policy community_memberships_join on public.community_memberships
  for insert to authenticated
  with check (
    profile_id = private.current_profile_id()
    and private.is_active_member()
    and role = 'member'
    and private.can_see_community(community_id)
    and (
      (membership_status = 'active'
       and exists (select 1 from public.communities c
                   where c.id = community_id and c.join_policy = 'open'
                     and c.status = 'active'))
      or (membership_status = 'pending'
          and exists (select 1 from public.communities c
                      where c.id = community_id and c.join_policy = 'request'
                        and c.status = 'active'))
    )
  );

drop policy if exists community_memberships_leave on public.community_memberships;
create policy community_memberships_leave on public.community_memberships
  for update to authenticated
  using (profile_id = private.current_profile_id())
  with check (profile_id = private.current_profile_id()
              and role = 'member'
              and membership_status in ('left', 'active', 'pending'));

drop policy if exists community_memberships_moderate on public.community_memberships;
create policy community_memberships_moderate on public.community_memberships
  for all to authenticated
  using (private.is_community_moderator(community_id))
  with check (private.is_community_moderator(community_id));

-- ---------------------------------------------------------------------
-- Billets et commentaires
-- ---------------------------------------------------------------------
drop policy if exists community_posts_select on public.community_posts;
create policy community_posts_select on public.community_posts
  for select to authenticated
  using (private.can_see_community_post(id));

drop policy if exists community_posts_create on public.community_posts;
create policy community_posts_create on public.community_posts
  for insert to authenticated
  with check (author_profile_id = private.current_profile_id()
              and private.is_active_member()
              and private.is_community_member(community_id)
              and status in ('draft', 'pending_review', 'published'));

-- L'auteur corrige son billet tant qu'il n'est pas verrouille ni retire
-- par la moderation. Il ne peut pas se remettre en `published` un billet
-- que la moderation a masque : `status` reste dans le domaine de l'auteur.
drop policy if exists community_posts_update_own on public.community_posts;
create policy community_posts_update_own on public.community_posts
  for update to authenticated
  using (author_profile_id = private.current_profile_id()
         and not is_locked
         and status in ('draft', 'pending_review', 'published'))
  with check (author_profile_id = private.current_profile_id()
              and not is_locked
              and status in ('draft', 'pending_review', 'published', 'archived'));

drop policy if exists community_posts_delete_own on public.community_posts;
create policy community_posts_delete_own on public.community_posts
  for delete to authenticated
  using (author_profile_id = private.current_profile_id() and not is_locked);

drop policy if exists community_posts_moderate on public.community_posts;
create policy community_posts_moderate on public.community_posts
  for all to authenticated
  using (private.is_community_moderator(community_id))
  with check (private.is_community_moderator(community_id));

drop policy if exists community_post_skills_select on public.community_post_skills;
create policy community_post_skills_select on public.community_post_skills
  for select to authenticated
  using (private.can_see_community_post(post_id));

drop policy if exists community_post_skills_write_author on public.community_post_skills;
create policy community_post_skills_write_author on public.community_post_skills
  for all to authenticated
  using (exists (select 1 from public.community_posts p
                 where p.id = post_id
                   and p.author_profile_id = private.current_profile_id()))
  with check (exists (select 1 from public.community_posts p
                      where p.id = post_id
                        and p.author_profile_id = private.current_profile_id()));

drop policy if exists community_comments_select on public.community_comments;
create policy community_comments_select on public.community_comments
  for select to authenticated
  using (
    private.can_see_community_post(post_id)
    and (author_profile_id = private.current_profile_id()
         or (deleted_at is null
             and status = 'published'
             and not private.is_blocked_between(author_profile_id, private.current_profile_id())))
  );

drop policy if exists community_comments_create on public.community_comments;
create policy community_comments_create on public.community_comments
  for insert to authenticated
  with check (author_profile_id = private.current_profile_id()
              and private.is_active_member()
              and status = 'published'
              and private.can_see_community_post(post_id)
              and exists (select 1 from public.community_posts p
                          where p.id = post_id
                            and not p.is_locked
                            and private.is_community_member(p.community_id)));

drop policy if exists community_comments_update_own on public.community_comments;
create policy community_comments_update_own on public.community_comments
  for update to authenticated
  using (author_profile_id = private.current_profile_id() and status = 'published')
  with check (author_profile_id = private.current_profile_id() and status = 'published');

drop policy if exists community_comments_delete_own on public.community_comments;
create policy community_comments_delete_own on public.community_comments
  for delete to authenticated
  using (author_profile_id = private.current_profile_id());

drop policy if exists community_comments_moderate on public.community_comments;
create policy community_comments_moderate on public.community_comments
  for all to authenticated
  using (exists (select 1 from public.community_posts p
                 where p.id = post_id and private.is_community_moderator(p.community_id)))
  with check (exists (select 1 from public.community_posts p
                      where p.id = post_id and private.is_community_moderator(p.community_id)));

-- ---------------------------------------------------------------------
-- Invitations : aucune sollicitation ne franchit un blocage.
-- ---------------------------------------------------------------------
drop policy if exists community_invitations_involved on public.community_invitations;
create policy community_invitations_involved on public.community_invitations
  for select to authenticated
  using (inviter_profile_id = private.current_profile_id()
         or invited_profile_id = private.current_profile_id()
         or private.is_community_moderator(community_id));

drop policy if exists community_invitations_create on public.community_invitations;
create policy community_invitations_create on public.community_invitations
  for insert to authenticated
  with check (inviter_profile_id = private.current_profile_id()
              and private.is_active_member()
              and private.is_community_member(community_id)
              and status = 'sent'
              and (invited_profile_id is null
                   or not private.is_blocked_between(inviter_profile_id, invited_profile_id)));

drop policy if exists community_invitations_respond on public.community_invitations;
create policy community_invitations_respond on public.community_invitations
  for update to authenticated
  using (invited_profile_id = private.current_profile_id() and status = 'sent')
  with check (invited_profile_id = private.current_profile_id()
              and status in ('accepted', 'declined'));

drop policy if exists community_invitations_revoke on public.community_invitations;
create policy community_invitations_revoke on public.community_invitations
  for update to authenticated
  using (private.is_community_moderator(community_id))
  with check (private.is_community_moderator(community_id));

-- ---------------------------------------------------------------------
-- Journal de moderation : la moderation de la communaute, et elle seule.
-- Un membre sanctionne n'y lit pas les motifs internes.
-- ---------------------------------------------------------------------
drop policy if exists community_moderation_actions_moderators on public.community_moderation_actions;
create policy community_moderation_actions_moderators on public.community_moderation_actions
  for select to authenticated
  using (private.is_community_moderator(community_id));

drop policy if exists community_moderation_actions_create on public.community_moderation_actions;
create policy community_moderation_actions_create on public.community_moderation_actions
  for insert to authenticated
  with check (actor_profile_id = private.current_profile_id()
              and private.is_community_moderator(community_id));
