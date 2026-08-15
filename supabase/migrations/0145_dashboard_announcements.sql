-- =====================================================================
-- 0145_dashboard_announcements
-- Bandeau de messages admin en tete du tableau de bord membre (tache #188).
--
-- CONTEXTE — aucun mecanisme de diffusion DESCENDANTE (admin -> tous les
-- membres) n'existait. Le "Module Communication" de 0131 est une
-- messagerie exclusivement ASCENDANTE (membre -> admin, tickets de
-- support et remontees d'information). Cette migration cree donc un
-- objet neuf, sans rapport avec 0131 : une annonce plate, sans fil de
-- discussion, affichee en lecture seule a tous les membres connectes.
--
-- SCHEMA — inspire de `public.news` (0013) pour les colonnes d'etat
-- (published_at nullable = brouillon, deleted_at = suppression douce)
-- mais deliberement plus simple : pas de titre separe (le message est
-- court, un bandeau n'a pas de place pour un titre + un corps), pas de
-- circuit editorial a plusieurs statuts (soumission/revue/rejet) —
-- l'auteur EST l'administrateur, il n'y a personne a qui soumettre.
-- Le cycle de vie se limite a : brouillon -> publiee -> (redevenue
-- brouillon) -> supprimee (douce). L'expiration n'est pas un statut
-- stocke : elle se CALCULE a la lecture depuis `ends_at`, exactement
-- comme la fenetre de queue de la landing (0121, 0124).
--
-- GRAVITE — deux niveaux seulement (`normal`, `urgent`), au lieu d'une
-- echelle a quatre paliers comme `support_tickets.urgency` (0016) :
-- l'usage demande est binaire ("differencier normal ou urgent"), une
-- echelle plus fine serait une declinaison non demandee (MASTER PROMPT
-- Section 113, rien de decoratif).
--
-- PERMISSION — `communication.announcements.manage`, nomenclature
-- <domaine>.<ressource>.<verbe> (D-30). Rattachee a `superadmin` et a
-- `content_manager` (0004) : ce role detient deja `content.publish` et
-- `events.manage`, soit exactement le profil "publie du contenu visible
-- de tous les membres" auquel appartient une annonce de tableau de bord.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLE
-- ---------------------------------------------------------------------
create table if not exists public.dashboard_announcements (
  id                  uuid primary key default extensions.gen_random_uuid(),
  body                text not null check (length(btrim(body)) between 1 and 2000),
  severity            text not null default 'normal' check (severity in ('normal', 'urgent')),
  -- NULL = diffusion immediate des la publication.
  starts_at           timestamptz,
  -- NULL = pas d'expiration.
  ends_at             timestamptz,
  -- NULL = brouillon, jamais montre aux membres.
  published_at        timestamptz,
  created_by_profile_id uuid references public.ise_profiles(id) on delete set null,
  updated_by_profile_id uuid references public.ise_profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  constraint dashboard_announcements_window_order
    check (starts_at is null or ends_at is null or ends_at > starts_at)
);

comment on table public.dashboard_announcements is
  'Messages de l''administration diffuses en tete du tableau de bord membre (tache #188). Diffusion descendante, sans rapport avec le module Communication ascendant de 0131.';
comment on column public.dashboard_announcements.severity is
  'Deux niveaux seulement : normal / urgent (differenciation visuelle demandee, pas une echelle de priorite).';
comment on column public.dashboard_announcements.starts_at is
  'NULL = diffusion immediate des la publication (published_at).';
comment on column public.dashboard_announcements.ends_at is
  'NULL = pas d''expiration. Le statut expiree est CALCULE a la lecture, jamais stocke.';
comment on column public.dashboard_announcements.published_at is
  'NULL = brouillon. Distinct de starts_at : publier ne diffuse pas forcement tout de suite si starts_at est dans le futur.';

create index if not exists dashboard_announcements_active_idx
  on public.dashboard_announcements (published_at)
  where deleted_at is null;

select private.attach_updated_at('public', 'dashboard_announcements');

alter table public.dashboard_announcements enable row level security;
alter table public.dashboard_announcements force row level security;

-- ---------------------------------------------------------------------
-- 2. PERMISSION (D-30) ET RATTACHEMENT AUX ROLES
-- ---------------------------------------------------------------------
insert into private.permissions (code, domain, action, description)
select 'communication.announcements.manage', 'communication', 'announcements.manage',
       'Rediger, publier, depublier et supprimer les annonces du tableau de bord membre.'
where not exists (
  select 1 from private.permissions where code = 'communication.announcements.manage'
);

insert into private.role_permissions (role_id, permission_id)
select r.id, p.id
from private.roles r
join private.permissions p on p.code = 'communication.announcements.manage'
where r.code in ('superadmin', 'content_manager')
  and not exists (
    select 1 from private.role_permissions rp
    where rp.role_id = r.id and rp.permission_id = p.id
  );

-- ---------------------------------------------------------------------
-- 3. RLS
--    Lecture ouverte a tout membre authentifie, mais UNIQUEMENT les
--    annonces publiees, non supprimees, et dans leur fenetre de
--    diffusion (meme construction que la fenetre de la queue landing,
--    0121). Ecriture (y compris la lecture des brouillons/annonces
--    expirees) reservee a la permission dediee.
-- ---------------------------------------------------------------------
drop policy if exists dashboard_announcements_read_active on public.dashboard_announcements;
create policy dashboard_announcements_read_active on public.dashboard_announcements
  for select to authenticated
  using (
    deleted_at is null
    and published_at is not null
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

drop policy if exists dashboard_announcements_manage on public.dashboard_announcements;
create policy dashboard_announcements_manage on public.dashboard_announcements
  for all to authenticated
  using (private.has_permission('communication.announcements.manage'))
  with check (private.has_permission('communication.announcements.manage'));

-- ---------------------------------------------------------------------
-- 4. LECTURE MEMBRE — get_active_dashboard_announcements()
--    Urgentes d'abord, puis les plus recemment publiees : une urgence
--    qui arriverait apres une annonce normale ne doit jamais passer en
--    second plan (c'est le sens meme de "urgent"). Voir docs/decisions.md.
-- ---------------------------------------------------------------------
create or replace function public.get_active_dashboard_announcements()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id',           a.id,
             'body',         a.body,
             'severity',     a.severity,
             'published_at', a.published_at
           )
           order by (a.severity = 'urgent') desc, a.published_at desc, a.id desc),
         '[]'::jsonb)
  from public.dashboard_announcements a
  where a.deleted_at is null
    and a.published_at is not null
    and (a.starts_at is null or a.starts_at <= now())
    and (a.ends_at is null or a.ends_at > now())
$$;

revoke all on function public.get_active_dashboard_announcements() from public, anon;
grant execute on function public.get_active_dashboard_announcements() to authenticated;
comment on function public.get_active_dashboard_announcements() is
  'Annonces actives du tableau de bord membre, urgentes d''abord (tache #188). Reserve a authenticated : aucune diffusion anonyme.';

-- ---------------------------------------------------------------------
-- 5. ADMINISTRATION — CRUD reserve a communication.announcements.manage
--    Conventions identiques a 0100/0110 : security definer, search_path
--    vide, has_permission(), erreurs 28000/42501/P0001/P0002, revoke
--    public/anon, grant authenticated. Pas de pagination par curseur :
--    le volume attendu (quelques annonces actives a la fois) ne le
--    justifie pas (contrainte de la tache : ne pas sur-ingenierier).
-- ---------------------------------------------------------------------
create or replace function public.admin_list_dashboard_announcements()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('communication.announcements.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return coalesce(jsonb_agg(
           jsonb_build_object(
             'id',           a.id,
             'body',         a.body,
             'severity',     a.severity,
             'starts_at',    a.starts_at,
             'ends_at',      a.ends_at,
             'published_at', a.published_at,
             'created_at',   a.created_at,
             'status',       case
                                when a.published_at is null then 'draft'
                                when a.ends_at is not null and a.ends_at <= now() then 'expired'
                                else 'published'
                              end
           )
           order by a.created_at desc, a.id desc),
         '[]'::jsonb)
    from public.dashboard_announcements a
   where a.deleted_at is null;
end;
$$;

revoke all on function public.admin_list_dashboard_announcements() from public, anon;
grant execute on function public.admin_list_dashboard_announcements() to authenticated;
comment on function public.admin_list_dashboard_announcements() is
  'Liste administrative complete des annonces (tous statuts). Reservee a communication.announcements.manage.';

create or replace function public.admin_get_dashboard_announcement(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_row public.dashboard_announcements;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('communication.announcements.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_row from public.dashboard_announcements where id = p_id and deleted_at is null;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id',           v_row.id,
    'body',         v_row.body,
    'severity',     v_row.severity,
    'starts_at',    v_row.starts_at,
    'ends_at',      v_row.ends_at,
    'published_at', v_row.published_at,
    'created_at',   v_row.created_at,
    'status',       case
                       when v_row.published_at is null then 'draft'
                       when v_row.ends_at is not null and v_row.ends_at <= now() then 'expired'
                       else 'published'
                     end
  );
end;
$$;

revoke all on function public.admin_get_dashboard_announcement(uuid) from public, anon;
grant execute on function public.admin_get_dashboard_announcement(uuid) to authenticated;
comment on function public.admin_get_dashboard_announcement(uuid) is
  'Fiche d''une annonce, tous statuts. Reservee a communication.announcements.manage.';

create or replace function public.admin_create_dashboard_announcement(
  p_body text,
  p_severity text default 'normal',
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_body text := btrim(coalesce(p_body, ''));
  v_severity text := coalesce(p_severity, 'normal');
  v_id uuid;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('communication.announcements.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_body = '' or length(v_body) > 2000 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if v_severity not in ('normal', 'urgent') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  insert into public.dashboard_announcements (
    body, severity, starts_at, ends_at, created_by_profile_id, updated_by_profile_id
  )
  values (v_body, v_severity, p_starts_at, p_ends_at, v_me, v_me)
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$$;

revoke all on function public.admin_create_dashboard_announcement(text, text, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.admin_create_dashboard_announcement(text, text, timestamptz, timestamptz)
  to authenticated;
comment on function public.admin_create_dashboard_announcement(text, text, timestamptz, timestamptz) is
  'Cree une annonce (toujours en brouillon). Reservee a communication.announcements.manage.';

create or replace function public.admin_update_dashboard_announcement(
  p_id uuid,
  p_body text,
  p_severity text,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_body text := btrim(coalesce(p_body, ''));
  v_severity text := coalesce(p_severity, 'normal');
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('communication.announcements.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if v_body = '' or length(v_body) > 2000 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if v_severity not in ('normal', 'urgent') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  update public.dashboard_announcements
     set body = v_body,
         severity = v_severity,
         starts_at = p_starts_at,
         ends_at = p_ends_at,
         updated_by_profile_id = v_me
   where id = p_id and deleted_at is null;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object('id', p_id);
end;
$$;

revoke all on function public.admin_update_dashboard_announcement(uuid, text, text, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.admin_update_dashboard_announcement(uuid, text, text, timestamptz, timestamptz)
  to authenticated;
comment on function public.admin_update_dashboard_announcement(uuid, text, text, timestamptz, timestamptz) is
  'Modifie le contenu d''une annonce existante. Reservee a communication.announcements.manage.';

create or replace function public.admin_set_dashboard_announcement_published(
  p_id uuid,
  p_published boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('communication.announcements.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update public.dashboard_announcements
     set published_at = case when p_published then coalesce(published_at, now()) else null end,
         updated_by_profile_id = v_me
   where id = p_id and deleted_at is null;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object('id', p_id, 'published', p_published);
end;
$$;

revoke all on function public.admin_set_dashboard_announcement_published(uuid, boolean) from public, anon;
grant execute on function public.admin_set_dashboard_announcement_published(uuid, boolean) to authenticated;
comment on function public.admin_set_dashboard_announcement_published(uuid, boolean) is
  'Publie ou depublie une annonce. Reservee a communication.announcements.manage.';

create or replace function public.admin_delete_dashboard_announcement(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('communication.announcements.manage') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update public.dashboard_announcements
     set deleted_at = now(),
         updated_by_profile_id = v_me
   where id = p_id and deleted_at is null;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object('id', p_id);
end;
$$;

revoke all on function public.admin_delete_dashboard_announcement(uuid) from public, anon;
grant execute on function public.admin_delete_dashboard_announcement(uuid) to authenticated;
comment on function public.admin_delete_dashboard_announcement(uuid) is
  'Suppression douce d''une annonce (deleted_at). Reservee a communication.announcements.manage.';

-- ---------------------------------------------------------------------
-- 6. get_my_admin_permissions() (0076) — ajoute la nouvelle permission a
--    la liste blanche projetee au layout /administration. Redefinition
--    complete de la fonction (meme corps que 0076). PROFITE AUSSI de
--    cette redefinition pour corriger un ecart constate en base : la
--    fonction n'a jamais ete mise a jour lors de l'ajout de la
--    permission `donations.read` (0134) — un titulaire de cette seule
--    permission ne la voyait donc jamais dans get_my_admin_permissions(),
--    ce qui aurait bloque l'acces a /administration/dons a quiconque ne
--    detient pas deja la liste complete via `superadmin`. Corrige ici en
--    meme temps, par prudence (aucune ligne de code applicative a
--    changer, cf. docs/decisions.md).
-- ---------------------------------------------------------------------
create or replace function public.get_my_admin_permissions()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select coalesce(jsonb_agg(c.code order by c.code), '[]'::jsonb)
    into v
  from (
    select unnest(array[
      'profiles.read', 'profiles.edit', 'profiles.moderate', 'profiles.verify',
      'promotions.manage', 'calls.moderate', 'opportunities.manage',
      'communities.manage', 'projects.manage', 'mentorship.manage',
      'events.manage', 'content.publish', 'imports.execute', 'imports.review',
      'support.manage', 'analytics.read', 'settings.manage', 'audit.read',
      'roles.manage', 'donations.read', 'communication.announcements.manage']) as code
  ) c
  where private.has_permission(c.code);

  return v;
end
$$;

revoke all on function public.get_my_admin_permissions() from public, anon;
grant execute on function public.get_my_admin_permissions() to authenticated;

comment on function public.get_my_admin_permissions() is
  'Permissions d''administration detenues par l''appelant. Alimente la garde du layout /administration (SYS-006) et le filtrage d''affichage de la navigation.';
