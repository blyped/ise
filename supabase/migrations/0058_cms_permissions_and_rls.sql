-- =====================================================================
-- 0058_cms_permissions_and_rls
-- Applique le 2026-08-08. Export fidele de la migration appliquee.
-- Ne pas editer : toute correction passe par une nouvelle migration.
--
-- Permissions CMS, roles editoriaux, garde-fous de transition d'etat et
-- politiques RLS des huit tables creees en 0057.
-- Sources : ADDENDUM §28, §29, §30, §59 ; CDC additionnel §23, §24, §25.
--
-- AUCUN SECOND SYSTEME D'AUTHENTIFICATION (addendum §28, CDC §23).
-- On etend private.permissions / private.roles / private.role_permissions
-- de 0004. L'autorisation se resout par private.has_permission(), jamais
-- par un test de role en dur (D-31).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PERMISSIONS (addendum §29). Nomenclature <domaine>.<action> (D-30).
-- ---------------------------------------------------------------------
insert into private.permissions (code, domain, action, description)
select v.code, v.domain, v.action, v.description
from (values
  ('cms.read',                    'cms', 'read',                    'Consulter le CMS et la configuration de la landing.'),
  ('cms.edit',                    'cms', 'edit',                    'Creer et modifier des brouillons CMS, sans publier.'),
  ('cms.publish',                 'cms', 'publish',                 'Publier, depublier, archiver et restaurer un contenu CMS.'),
  ('cms.schedule',                'cms', 'schedule',                'Programmer la publication et la depublication d''un contenu.'),
  ('cms.media.manage',            'cms', 'media.manage',            'Administrer la mediatheque : depot, metadonnees, suppression.'),
  ('cms.partners.manage',         'cms', 'partners.manage',         'Administrer les campagnes partenaires et leur transparence.'),
  ('cms.featured_profile.manage', 'cms', 'featured_profile.manage', 'Administrer « ISE du jour » : regles, override, exclusion.')
) as v(code, domain, action, description)
where not exists (select 1 from private.permissions p where p.code = v.code);

-- ---------------------------------------------------------------------
-- 2. ROLES EDITORIAUX (addendum §29, CDC §24).
--    Un redacteur cree un brouillon sans pouvoir publier ; un publisher
--    publie. Les deux sont des roles d'administration.
-- ---------------------------------------------------------------------
insert into private.roles (code, name, description, is_admin_role, sort_order)
select v.code, v.name, v.description, v.is_admin_role, v.sort_order
from (values
  ('cms_editor',    'Redacteur CMS', 'Cree et modifie les contenus de la landing. Ne publie pas.', true, 55),
  ('cms_publisher', 'Editeur CMS',   'Publie, programme et administre la landing publique.',       true, 56)
) as v(code, name, description, is_admin_role, sort_order)
where not exists (select 1 from private.roles r where r.code = v.code);

-- ---------------------------------------------------------------------
-- 3. RATTACHEMENT DES PERMISSIONS AUX ROLES.
--    superadmin  : les sept.
--    cms_editor  : lire, editer, mediatheque. NI publish NI schedule :
--                  c'est exactement la separation testee en §59.
--    cms_publisher : les sept.
-- ---------------------------------------------------------------------
insert into private.role_permissions (role_id, permission_id)
select r.id, p.id
from private.roles r
join private.permissions p on p.code = any (
  case r.code
    when 'superadmin'   then array['cms.read','cms.edit','cms.publish','cms.schedule',
                                   'cms.media.manage','cms.partners.manage','cms.featured_profile.manage']
    when 'cms_publisher' then array['cms.read','cms.edit','cms.publish','cms.schedule',
                                   'cms.media.manage','cms.partners.manage','cms.featured_profile.manage']
    when 'cms_editor'   then array['cms.read','cms.edit','cms.media.manage']
    else array[]::text[]
  end
)
where r.code in ('superadmin', 'cms_publisher', 'cms_editor')
  and not exists (
    select 1 from private.role_permissions rp
    where rp.role_id = r.id and rp.permission_id = p.id
  );

-- ---------------------------------------------------------------------
-- 4. GARDE-FOU DE TRANSITION D'ETAT (addendum §30).
--
--    La RLS autorise un porteur de `cms.edit` a mettre a jour une ligne.
--    Elle ne sait pas comparer OLD et NEW : rien ne l'empecherait donc
--    d'ecrire `status = 'published'` a la main, ce qui contournerait la
--    verification de `cms.publish`. Le trigger le fait, sur le modele de
--    private.guard_status_transition() (0049) : les colonnes de
--    publication ne changent que sous l'identite du proprietaire des
--    tables, c'est-a-dire depuis une fonction SECURITY DEFINER (0059).
-- ---------------------------------------------------------------------
create or replace function private.cms_guard_publication_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'scheduled') then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    if new.published_snapshot is not null or new.published_at is not null then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.status                      is distinct from old.status
     or new.published_snapshot          is distinct from old.published_snapshot
     or new.previous_published_snapshot is distinct from old.previous_published_snapshot
     or new.published_at                is distinct from old.published_at
     or new.published_by_profile_id     is distinct from old.published_by_profile_id then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  return new;
end
$$;

comment on function private.cms_guard_publication_state() is
  'Interdit toute ecriture directe des colonnes de publication d''un contenu CMS. Seules les fonctions atomiques de 0059, detenues par postgres, y touchent (addendum §30, conventions §7).';

create or replace function private.cms_guard_schedule_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'pending' or new.applied_at is not null or new.run_count <> 0 then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- Un editeur peut annuler un ordre de programmation ou en deplacer les
  -- dates ; il ne peut pas declarer qu'il a ete applique.
  if new.status is distinct from old.status and new.status <> 'cancelled' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if new.applied_at is distinct from old.applied_at
     or new.run_count  is distinct from old.run_count
     or new.last_run_at is distinct from old.last_run_at then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  return new;
end
$$;

comment on function private.cms_guard_schedule_state() is
  'Un ordre de programmation ne se declare pas « applique » a la main : seul le traitement planifie de 0059 le fait (addendum §40, §57).';

do $$
declare r record;
begin
  for r in select unnest(array['cms_sections', 'cms_carousel_items', 'cms_partner_campaigns']) as t loop
    execute format('drop trigger if exists cms_guard_publication_state_%s on public.%I', r.t, r.t);
    execute format(
      'create trigger cms_guard_publication_state_%s before insert or update on public.%I for each row execute function private.cms_guard_publication_state()',
      r.t, r.t);
  end loop;
end $$;

drop trigger if exists cms_guard_schedule_state_cms_publication_schedule on public.cms_publication_schedule;
create trigger cms_guard_schedule_state_cms_publication_schedule
  before insert or update on public.cms_publication_schedule
  for each row execute function private.cms_guard_schedule_state();

-- ---------------------------------------------------------------------
-- 5. POLITIQUES RLS (modele de 0021 et 0050).
--    Toutes ciblent explicitement `to authenticated`. `anon` n'a aucun
--    privilege sur `public` (0026) : la landing publique passe uniquement
--    par les fonctions public-safe de 0060, jamais par une table.
-- ---------------------------------------------------------------------

-- 5.1 Mediatheque : lecture avec cms.read, ecriture avec cms.media.manage.
drop policy if exists cms_media_assets_read on public.cms_media_assets;
create policy cms_media_assets_read on public.cms_media_assets
  for select to authenticated
  using (private.has_permission('cms.read'));

drop policy if exists cms_media_assets_write on public.cms_media_assets;
create policy cms_media_assets_write on public.cms_media_assets
  for all to authenticated
  using (private.has_permission('cms.media.manage'))
  with check (private.has_permission('cms.media.manage'));

-- 5.2 Sections. La suppression exige cms.publish ET une section non
--     structurelle : le squelette de la landing ne se supprime pas par
--     accident (CDC §28).
drop policy if exists cms_sections_read on public.cms_sections;
create policy cms_sections_read on public.cms_sections
  for select to authenticated
  using (private.has_permission('cms.read'));

drop policy if exists cms_sections_create on public.cms_sections;
create policy cms_sections_create on public.cms_sections
  for insert to authenticated
  with check (private.has_permission('cms.edit'));

drop policy if exists cms_sections_update on public.cms_sections;
create policy cms_sections_update on public.cms_sections
  for update to authenticated
  using (private.has_permission('cms.edit'))
  with check (private.has_permission('cms.edit'));

drop policy if exists cms_sections_delete on public.cms_sections;
create policy cms_sections_delete on public.cms_sections
  for delete to authenticated
  using (private.has_permission('cms.publish') and not is_structural);

-- 5.3 Carrousel.
drop policy if exists cms_carousel_items_read on public.cms_carousel_items;
create policy cms_carousel_items_read on public.cms_carousel_items
  for select to authenticated
  using (private.has_permission('cms.read'));

drop policy if exists cms_carousel_items_create on public.cms_carousel_items;
create policy cms_carousel_items_create on public.cms_carousel_items
  for insert to authenticated
  with check (private.has_permission('cms.edit'));

drop policy if exists cms_carousel_items_update on public.cms_carousel_items;
create policy cms_carousel_items_update on public.cms_carousel_items
  for update to authenticated
  using (private.has_permission('cms.edit'))
  with check (private.has_permission('cms.edit'));

drop policy if exists cms_carousel_items_delete on public.cms_carousel_items;
create policy cms_carousel_items_delete on public.cms_carousel_items
  for delete to authenticated
  using (private.has_permission('cms.publish'));

-- 5.4 Campagnes partenaires : ecriture reservee a cms.partners.manage.
drop policy if exists cms_partner_campaigns_read on public.cms_partner_campaigns;
create policy cms_partner_campaigns_read on public.cms_partner_campaigns
  for select to authenticated
  using (private.has_permission('cms.read'));

drop policy if exists cms_partner_campaigns_write on public.cms_partner_campaigns;
create policy cms_partner_campaigns_write on public.cms_partner_campaigns
  for all to authenticated
  using (private.has_permission('cms.partners.manage'))
  with check (private.has_permission('cms.partners.manage'));

-- 5.5 Programmation : ecriture reservee a cms.schedule.
drop policy if exists cms_publication_schedule_read on public.cms_publication_schedule;
create policy cms_publication_schedule_read on public.cms_publication_schedule
  for select to authenticated
  using (private.has_permission('cms.read'));

drop policy if exists cms_publication_schedule_write on public.cms_publication_schedule;
create policy cms_publication_schedule_write on public.cms_publication_schedule
  for all to authenticated
  using (private.has_permission('cms.schedule'))
  with check (private.has_permission('cms.schedule'));

-- 5.6 Overrides editoriaux. L'exclusion d'un profil de « ISE du jour »
--     exige la permission dediee ; les autres overrides, cms.edit.
drop policy if exists cms_content_overrides_read on public.cms_content_overrides;
create policy cms_content_overrides_read on public.cms_content_overrides
  for select to authenticated
  using (private.has_permission('cms.read'));

drop policy if exists cms_content_overrides_write on public.cms_content_overrides;
create policy cms_content_overrides_write on public.cms_content_overrides
  for all to authenticated
  using (
    case when section_key = 'featured_profile'
         then private.has_permission('cms.featured_profile.manage')
         else private.has_permission('cms.edit') end
  )
  with check (
    case when section_key = 'featured_profile'
         then private.has_permission('cms.featured_profile.manage')
         else private.has_permission('cms.edit') end
  );

-- 5.7 Regles « ISE du jour ».
drop policy if exists cms_featured_profile_rules_read on public.cms_featured_profile_rules;
create policy cms_featured_profile_rules_read on public.cms_featured_profile_rules
  for select to authenticated
  using (private.has_permission('cms.read'));

drop policy if exists cms_featured_profile_rules_write on public.cms_featured_profile_rules;
create policy cms_featured_profile_rules_write on public.cms_featured_profile_rules
  for all to authenticated
  using (private.has_permission('cms.featured_profile.manage'))
  with check (private.has_permission('cms.featured_profile.manage'));

-- 5.8 Historique « ISE du jour » : LECTURE SEULE pour tout client.
--     Aucune politique INSERT / UPDATE / DELETE : l'historique n'est ecrit
--     que par les fonctions de 0059, qui journalisent chaque override
--     (addendum §22). Une ecriture directe casserait la piste d'audit.
drop policy if exists cms_featured_profile_history_read on public.cms_featured_profile_history;
create policy cms_featured_profile_history_read on public.cms_featured_profile_history
  for select to authenticated
  using (private.has_permission('cms.read'));

comment on table public.cms_featured_profile_history is
  'Historique des mises en avant « ISE du jour ». Ne stocke AUCUNE donnee de profil. LECTURE SEULE pour tout client : les ecritures passent par les fonctions atomiques de 0059, qui journalisent (addendum §22).';
