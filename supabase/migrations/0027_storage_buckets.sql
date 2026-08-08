-- 0027_storage_buckets
-- Applique le 2026-08-08 (version 20260808040952)
-- Ne pas editer : toute correction passe par une nouvelle migration.
-- =====================================================================
-- 0027_storage_buckets
-- Buckets Storage et politiques d'acces sur storage.objects.
--
-- MASTER PROMPT §12, §49, §80 ; docs/decisions.md D-11, D-73, D-84, D-101.
--
-- Principes appliques :
--   1. AUCUN bucket public. D-73 : rien n'est servi au web ouvert en V1.
--      Tout telechargement passe par une URL signee emise cote serveur
--      apres controle RLS.
--   2. Un bucket par niveau de sensibilite. Un fichier de preuve de
--      reclamation ne partage pas la meme surface qu'un logo d'organisation.
--   3. Chemins organises par identifiant metier, jamais par `user_id`
--      (D-11) : `avatars/{profile_id}/...`, `project-assets/{project_id}/...`.
--   4. Taille et types MIME imposes par storage.buckets (file_size_limit,
--      allowed_mime_types) : la contrainte est appliquee par le service
--      Storage avant meme d'atteindre la politique RLS.
--   5. Les helpers `private.*` existants sont reutilises tels quels.
--      Les helpers ajoutes ici sont propres au Storage.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Helpers de decoupage de chemin
-- ---------------------------------------------------------------------

-- Nieme segment du chemin d'objet, NULL si absent.
create or replace function private.storage_segment(p_name text, p_index integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(split_part(coalesce(p_name, ''), '/', p_index), '')
$$;

-- Nieme segment interprete comme uuid. NULL si le segment n'est pas un uuid :
-- evite qu'un chemin malforme fasse echouer la politique par une erreur de cast.
create or replace function private.storage_segment_uuid(p_name text, p_index integer)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when private.storage_segment(p_name, p_index)
         ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then private.storage_segment(p_name, p_index)::uuid
  end
$$;

grant execute on function private.storage_segment(text, integer)      to authenticated;
grant execute on function private.storage_segment_uuid(text, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Predicats d'acces aux pieces jointes
--    SECURITY DEFINER : ces fonctions lisent des tables `public` dont la
--    RLS est volontairement fermee au client (projects, conversations).
--    Elles ne renvoient qu'un booleen, jamais une ligne (D-101).
-- ---------------------------------------------------------------------

-- Porteur d'un projet (le seul a pouvoir deposer une piece de projet).
create or replace function private.is_project_owner(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_project is not null
     and private.current_profile_id() is not null
     and exists (
       select 1 from public.projects pr
       where pr.id = p_project
         and pr.owner_profile_id = private.current_profile_id()
         and pr.deleted_at is null
     )
$$;

-- Membre actif d'un projet, ou porteur, ou administrateur des projets.
create or replace function private.is_project_member(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_project is not null
     and private.current_profile_id() is not null
     and (
       private.is_project_owner(p_project)
       or private.has_permission('projects.manage')
       or exists (
         select 1 from public.project_members m
         where m.project_id = p_project
           and m.profile_id = private.current_profile_id()
           and m.membership_status = 'active'
           and m.left_at is null
       )
     )
$$;

-- Participant non sorti d'une conversation.
create or replace function private.is_conversation_participant(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_conversation is not null
     and private.current_profile_id() is not null
     and exists (
       select 1 from public.conversation_participants cp
       where cp.conversation_id = p_conversation
         and cp.profile_id = private.current_profile_id()
         and cp.left_at is null
     )
$$;

-- Auteur d'un ticket de support, ou agent habilite.
create or replace function private.can_access_support_ticket(p_ticket uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_ticket is not null
     and (
       private.has_permission('support.manage')
       or exists (
         select 1 from public.support_tickets t
         where t.id = p_ticket
           and t.requester_profile_id = private.current_profile_id()
       )
     )
$$;

-- Depot d'une preuve de reclamation : le demandeur n'a pas encore de profil,
-- l'autorisation se resout donc sur `auth.uid()` via profile_claims (D-10,
-- seule exception documentee avec ise_profiles.user_id).
create or replace function private.can_upload_verification_document(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_profile is not null
     and (
       private.has_permission('profiles.verify')
       or exists (
         select 1 from public.profile_claims c
         where c.profile_id = p_profile
           and c.claimant_user_id = (select auth.uid())
           and c.status in ('submitted', 'under_review')
       )
     )
$$;

grant execute on function private.is_project_owner(uuid)                to authenticated;
grant execute on function private.is_project_member(uuid)               to authenticated;
grant execute on function private.is_conversation_participant(uuid)     to authenticated;
grant execute on function private.can_access_support_ticket(uuid)       to authenticated;
grant execute on function private.can_upload_verification_document(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Buckets
--    `public = false` partout, sans exception (D-73).
--    D-84 : 10 Mo par piece jointe ; avatars 2 Mo ; imports 50 Mo.
-- ---------------------------------------------------------------------
do $$
declare
  v_images      text[] := array['image/png', 'image/jpeg', 'image/webp'];
  v_documents   text[] := array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png', 'image/jpeg', 'image/webp'
  ];
  v_tabular     text[] := array[
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  r record;
begin
  for r in
    select * from (values
      ('avatars',                2097152::bigint,  v_images),
      ('profile-documents',     10485760::bigint,  v_documents),
      ('project-assets',        10485760::bigint,  v_documents),
      ('message-attachments',   10485760::bigint,  v_documents),
      ('support-attachments',   10485760::bigint,  v_documents),
      ('verification-documents',10485760::bigint,  v_documents),
      ('admin-imports',         52428800::bigint,  v_tabular),
      ('public-assets',          5242880::bigint,  v_images)
    ) as b(id, size_limit, mimes)
  loop
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (r.id, r.id, false, r.size_limit, r.mimes)
    on conflict (id) do update
      set public             = false,
          file_size_limit    = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- 4. Politiques sur storage.objects
--    Refus par defaut : storage.objects a la RLS active et aucune
--    politique n'est ouverte a `anon`.
-- ---------------------------------------------------------------------

-- 4.1 avatars/{profile_id}/...
--     Lecture : tout membre actif. Ecriture : le proprietaire du profil.
drop policy if exists ise_avatars_read on storage.objects;
create policy ise_avatars_read on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and private.is_active_member());

drop policy if exists ise_avatars_write on storage.objects;
create policy ise_avatars_write on storage.objects
  for all to authenticated
  using (
    bucket_id = 'avatars'
    and private.storage_segment_uuid(name, 1) = private.current_profile_id()
  )
  with check (
    bucket_id = 'avatars'
    and private.storage_segment_uuid(name, 1) = private.current_profile_id()
  );

-- 4.2 profile-documents/{profile_id}/...  (CV et pieces de profil)
--     Lecture : le proprietaire, ou la permission `profiles.read`.
--     Ecriture : le proprietaire uniquement.
drop policy if exists ise_profile_documents_read on storage.objects;
create policy ise_profile_documents_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'profile-documents'
    and (
      private.storage_segment_uuid(name, 1) = private.current_profile_id()
      or private.has_permission('profiles.read')
    )
  );

drop policy if exists ise_profile_documents_write on storage.objects;
create policy ise_profile_documents_write on storage.objects
  for all to authenticated
  using (
    bucket_id = 'profile-documents'
    and private.storage_segment_uuid(name, 1) = private.current_profile_id()
  )
  with check (
    bucket_id = 'profile-documents'
    and private.storage_segment_uuid(name, 1) = private.current_profile_id()
  );

-- 4.3 project-assets/{project_id}/...
--     Lecture : membres du projet. Ecriture : porteur.
drop policy if exists ise_project_assets_read on storage.objects;
create policy ise_project_assets_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-assets'
    and private.is_project_member(private.storage_segment_uuid(name, 1))
  );

drop policy if exists ise_project_assets_write on storage.objects;
create policy ise_project_assets_write on storage.objects
  for all to authenticated
  using (
    bucket_id = 'project-assets'
    and private.is_project_owner(private.storage_segment_uuid(name, 1))
  )
  with check (
    bucket_id = 'project-assets'
    and private.is_project_owner(private.storage_segment_uuid(name, 1))
  );

-- 4.4 message-attachments/{conversation_id}/...
--     Lecture ET ecriture : participants de la conversation uniquement.
--     Aucune permission administrative n'ouvre ce bucket : le contenu des
--     messages prives n'est jamais consultable par l'exploitation
--     (MASTER PROMPT §24).
drop policy if exists ise_message_attachments_read on storage.objects;
create policy ise_message_attachments_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and private.is_conversation_participant(private.storage_segment_uuid(name, 1))
  );

drop policy if exists ise_message_attachments_write on storage.objects;
create policy ise_message_attachments_write on storage.objects
  for all to authenticated
  using (
    bucket_id = 'message-attachments'
    and private.is_conversation_participant(private.storage_segment_uuid(name, 1))
  )
  with check (
    bucket_id = 'message-attachments'
    and private.is_conversation_participant(private.storage_segment_uuid(name, 1))
  );

-- 4.5 support-attachments/{ticket_id}/...
--     Lecture et ecriture : auteur du ticket + permission `support.manage`.
drop policy if exists ise_support_attachments_read on storage.objects;
create policy ise_support_attachments_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'support-attachments'
    and private.can_access_support_ticket(private.storage_segment_uuid(name, 1))
  );

drop policy if exists ise_support_attachments_write on storage.objects;
create policy ise_support_attachments_write on storage.objects
  for all to authenticated
  using (
    bucket_id = 'support-attachments'
    and private.can_access_support_ticket(private.storage_segment_uuid(name, 1))
  )
  with check (
    bucket_id = 'support-attachments'
    and private.can_access_support_ticket(private.storage_segment_uuid(name, 1))
  );

-- 4.6 verification-documents/{profile_id}/...
--     Lecture : permission `profiles.verify` UNIQUEMENT. Le demandeur
--     lui-meme ne relit pas sa preuve : elle est deposee, pas consultee.
--     Ecriture : demandeur d'une reclamation en cours, ou `profiles.verify`.
drop policy if exists ise_verification_documents_read on storage.objects;
create policy ise_verification_documents_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'verification-documents'
    and private.has_permission('profiles.verify')
  );

drop policy if exists ise_verification_documents_insert on storage.objects;
create policy ise_verification_documents_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verification-documents'
    and private.can_upload_verification_document(private.storage_segment_uuid(name, 1))
  );

drop policy if exists ise_verification_documents_manage on storage.objects;
create policy ise_verification_documents_manage on storage.objects
  for all to authenticated
  using (
    bucket_id = 'verification-documents'
    and private.has_permission('profiles.verify')
  )
  with check (
    bucket_id = 'verification-documents'
    and private.has_permission('profiles.verify')
  );

-- 4.7 admin-imports/{batch_id}/...
--     Lecture ET ecriture : permission `imports.execute` UNIQUEMENT.
--     Un fichier d'annuaire brut contient les coordonnees de tiers.
drop policy if exists ise_admin_imports_all on storage.objects;
create policy ise_admin_imports_all on storage.objects
  for all to authenticated
  using (bucket_id = 'admin-imports' and private.has_permission('imports.execute'))
  with check (bucket_id = 'admin-imports' and private.has_permission('imports.execute'));

-- 4.8 public-assets/...  (logos d'organisations, visuels d'evenements)
--     « public » designe le caractere non personnel du contenu, PAS une
--     exposition au web ouvert : le bucket reste prive (D-73).
--     Lecture : membres actifs. Ecriture : permission `content.publish`.
drop policy if exists ise_public_assets_read on storage.objects;
create policy ise_public_assets_read on storage.objects
  for select to authenticated
  using (bucket_id = 'public-assets' and private.is_active_member());

drop policy if exists ise_public_assets_write on storage.objects;
create policy ise_public_assets_write on storage.objects
  for all to authenticated
  using (bucket_id = 'public-assets' and private.has_permission('content.publish'))
  with check (bucket_id = 'public-assets' and private.has_permission('content.publish'));

-- ---------------------------------------------------------------------
-- 5. Garde-fou : signale tout bucket public ou tout bucket sans politique.
--    Utilise par la suite de tests (MASTER PROMPT §80).
-- ---------------------------------------------------------------------
create or replace function private.storage_baseline_violations()
returns table (kind text, object_name text, detail text)
language sql
stable
security definer
set search_path = ''
as $$
  select 'public_bucket', b.id::text, 'bucket expose au web public (D-73)'
  from storage.buckets b
  where b.public
  union all
  select 'bucket_without_policy', b.id::text, 'aucune politique storage.objects ne cite ce bucket'
  from storage.buckets b
  where not exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage' and c.relname = 'objects'
      and (coalesce(pg_get_expr(p.polqual, p.polrelid), '')
           || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''))
          like '%''' || b.id || '''%'
  )
  union all
  select 'bucket_no_size_limit', b.id::text, 'file_size_limit non defini'
  from storage.buckets b
  where b.file_size_limit is null
  union all
  select 'bucket_no_mime_allowlist', b.id::text, 'allowed_mime_types non defini'
  from storage.buckets b
  where b.allowed_mime_types is null
  union all
  select 'storage_anon_policy', p.polname::text, 'politique storage.objects ouverte a anon'
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'storage' and c.relname = 'objects'
    and exists (
      select 1 from unnest(p.polroles) r
      where r::regrole::text in ('anon', 'public')
    )
  order by 1, 2
$$;

comment on function private.storage_baseline_violations() is
  'Controle Storage execute par la CI et la suite de tests. Doit renvoyer 0 ligne.';
