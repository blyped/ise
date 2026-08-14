-- =====================================================================
-- 0127_profile_documents_write_api
-- Ouverture du DEPOT de documents de profil (CV, lettre, diplome...).
--
-- CE QUI EXISTAIT DEJA, ET CE QUI MANQUAIT
--   La table `public.profile_documents` (0008), sa politique
--   `profile_documents_own` (0041), le bucket prive `profile-documents`
--   (0027, 10 Mo, liste MIME restrictive) et ses politiques Storage
--   `ise_profile_documents_read` / `ise_profile_documents_write` sont en
--   place depuis longtemps. La RPC de LECTURE `list_my_documents()` aussi.
--   Il manquait TOUTE ecriture : aucun moyen d'enregistrer un document
--   televerse, aucun moyen d'en supprimer un, aucun moyen de designer le
--   CV principal. Consequence visible en production : la table etait vide
--   (0 ligne, 0 objet dans le bucket) et l'ecran de candidature affichait
--   « le depot de document n'est pas encore ouvert ».
--
--   Cette migration comble exactement ce manque. Elle ne cree AUCUNE
--   colonne et AUCUNE contrainte : le modele de 0008 est respecte tel
--   quel, y compris `is_primary` et son index unique partiel
--   `profile_documents_primary_uidx (profile_id, document_type)` qui fait
--   qu'il y a au plus UN document principal par type — donc au plus un
--   « CV principal ». C'est cet acquis qui est expose, pas un concept neuf.
--
-- LE CHEMIN DE STOCKAGE, ET SON PIEGE
--   La contrainte `profile_documents_storage_path_scope` impose
--       storage_path LIKE 'profile-documents/<profile_id>/%'
--   c'est-a-dire un chemin PREFIXE PAR LE NOM DU BUCKET, alors que
--   `storage.objects.name` ne contient PAS ce prefixe (la politique
--   Storage lit `private.storage_segment_uuid(name, 1)`, donc le premier
--   segment de `name` est deja le profile_id). Les deux representations
--   coexistent volontairement ; `record_my_document()` fait la conversion
--   et verifie que l'objet EXISTE REELLEMENT avant d'ecrire la ligne.
--   Sans cette verification on enregistrerait des fiches pointant vers
--   rien — exactement le mensonge que D-133 interdit.
--
-- SUPPRESSION — SUPPRESSION REELLE, ET CE QU'ELLE EMPORTE
--   `delete_my_document()` fait un DELETE, pas un `deleted_at`. Deux
--   raisons : (1) le membre qui retire une piece attend qu'elle disparaisse ;
--   (2) un `deleted_at` couperait de toute facon l'acces du recruteur, car
--   `profile_documents_application_reader` exige `deleted_at is null` — la
--   ligne survivante n'aurait donc servi a personne.
--   CONSEQUENCE ASSUMEE, dite ici et redite a l'ecran : les cles etrangeres
--   de 0008 sont `applications.cv_document_id ON DELETE SET NULL` et
--   `application_documents.document_id ON DELETE CASCADE`. Supprimer un
--   document le DETACHE donc des candidatures deja envoyees. La fonction
--   renvoie le nombre de candidatures non-brouillon concernees pour que
--   l'interface puisse le dire, et l'audite.
--
--   Les OCTETS ne sont pas effaces ici : PostgreSQL n'a aucun acces aux
--   objets de Storage (memes limites qu'en 0120). C'est l'application qui
--   appelle l'API Storage juste apres, avec le chemin renvoye. Si cet
--   appel echoue, des octets orphelins subsistent dans un bucket PRIVE ;
--   un nettoyage Storage periodique reste NON BRANCHE, comme pour 0120.
--
-- ANALYSE ANTIVIRALE — NON REALISEE, ET NON SIMULEE
--   Ce depot accepte des fichiers bureautiques (PDF, DOCX, XLSX, PPTX) qui
--   peuvent porter des macros ou des charges actives. Aucun antivirus n'est
--   disponible dans ce deploiement : ni ici, ni cote application. Rien dans
--   cette migration ne « verifie » quoi que ce soit de tel, et aucun libelle
--   ne le laisse croire. Ce qui est fait : type MIME contraint (bucket ET
--   RPC), taille bornee, bucket PRIVE, acces limite au proprietaire et au
--   responsable d'une offre a laquelle le document est joint, telechargement
--   par URL signee de courte duree. Ce qui n'est PAS fait : l'analyse du
--   contenu. C'est un manque explicite, a couvrir par un service externe
--   (meme convention que D-133 sur les variantes d'images non generees).
--
-- Ne pas editer : toute correction passe par une nouvelle migration.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enregistrer un document televerse
--
--    Appelee APRES le televersement, jamais avant : le fichier doit deja
--    etre dans le bucket. La politique Storage a donc deja refuse tout
--    depot hors du prefixe du membre ; on le reverifie ici parce qu'une
--    RPC ne doit jamais dependre d'une garde qu'elle ne porte pas.
--
--    Les codes d'erreur reutilisent le vocabulaire de `BUSINESS_ERRORS`
--    (packages/domain) : le message leve EST la cle, l'interface affiche
--    la phrase francaise correspondante sans traduction ad hoc.
-- ---------------------------------------------------------------------
create or replace function public.record_my_document(
  p_storage_path      text,
  p_document_type     text,
  p_original_filename text,
  p_mime_type         text,
  p_size_bytes        bigint,
  p_title             text    default null,
  p_is_primary        boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- Miroir de `storage.buckets.file_size_limit` du bucket
  -- `profile-documents` (0027). Duplique volontairement : une RPC qui
  -- s'appuierait sur la table de configuration du service Storage
  -- deviendrait fausse le jour ou ce reglage change sans migration.
  c_max_bytes  constant bigint := 10485760;
  c_bucket     constant text   := 'profile-documents';
  c_mimes      constant text[] := array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'image/webp'
  ];
  c_types      constant text[] := array[
    'cv', 'cover_letter', 'certificate', 'diploma', 'portfolio',
    'publication', 'technical_proposal', 'financial_proposal', 'other'
  ];

  v_profile  uuid := private.current_profile_id();
  v_path     text := btrim(coalesce(p_storage_path, ''));
  v_type     text := lower(btrim(coalesce(p_document_type, '')));
  v_filename text := btrim(coalesce(p_original_filename, ''));
  v_mime     text := lower(btrim(coalesce(p_mime_type, '')));
  v_title    text := nullif(btrim(coalesce(p_title, '')), '');
  v_primary  boolean := coalesce(p_is_primary, false);
  v_object   text;
  v_id       uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_profile is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if not (v_type = any (c_types)) then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if v_filename = '' or char_length(v_filename) > 255 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if v_title is not null and char_length(v_title) > 200 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if not (v_mime = any (c_mimes)) then
    raise exception 'attachment_type_not_allowed' using errcode = 'P0001';
  end if;
  if p_size_bytes is null or p_size_bytes <= 0 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_size_bytes > c_max_bytes then
    raise exception 'attachment_too_large' using errcode = 'P0001';
  end if;

  -- Le chemin ne peut designer que le prefixe du membre lui-meme. Un
  -- profil ne peut pas revendiquer le fichier d'un autre, meme en
  -- appelant la RPC directement.
  if v_path not like c_bucket || '/' || v_profile::text || '/%' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  -- Conversion vers la representation de Storage : `storage.objects.name`
  -- ne porte pas le nom du bucket.
  v_object := substr(v_path, char_length(c_bucket) + 2);

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = c_bucket and o.name = v_object
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- Au plus un document principal par type : l'index unique partiel de
  -- 0008 l'impose, on libere donc la place avant d'inserer plutot que de
  -- laisser l'insertion echouer sur une violation d'unicite.
  if v_primary then
    update public.profile_documents
       set is_primary = false
     where profile_id = v_profile
       and document_type = v_type
       and is_primary
       and deleted_at is null;
  end if;

  insert into public.profile_documents (
    profile_id, document_type, title, storage_path,
    original_filename, mime_type, size_bytes, visibility, is_primary
  )
  values (
    v_profile, v_type, v_title, v_path,
    v_filename, v_mime, p_size_bytes, 'private', v_primary
  )
  returning id into v_id;

  perform private.log_audit(
    p_action      => 'profile.document_recorded',
    p_object_type => 'profile_document',
    p_object_id   => v_id::text,
    p_context     => jsonb_build_object(
                       'document_type', v_type,
                       'mime_type',     v_mime,
                       'size_bytes',    p_size_bytes,
                       'is_primary',    v_primary));

  return jsonb_build_object(
    'document_id',  v_id,
    'storage_path', v_path,
    'is_primary',   v_primary);
end
$$;

revoke all on function public.record_my_document(text, text, text, text, bigint, text, boolean)
  from public, anon;
grant execute on function public.record_my_document(text, text, text, text, bigint, text, boolean)
  to authenticated;

comment on function public.record_my_document(text, text, text, text, bigint, text, boolean) is
  'Enregistre un document deja televerse sous profile-documents/<profile_id>/. Verifie le proprietaire, le type de document, le type MIME, la taille (10 Mo) et l''existence reelle de l''objet. Aucune analyse antivirale (non disponible). Audite.';

-- ---------------------------------------------------------------------
-- 2. Supprimer un document
--
--    Renvoie le chemin de stockage : c'est la SEULE facon pour
--    l'application d'effacer ensuite les octets. Une fois la ligne
--    supprimee, plus personne ne saurait quel fichier retirer.
-- ---------------------------------------------------------------------
create or replace function public.delete_my_document(p_document_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile  uuid := private.current_profile_id();
  v_path     text;
  v_type     text;
  v_detached integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_profile is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select d.storage_path, d.document_type
    into v_path, v_type
  from public.profile_documents d
  where d.id = p_document_id
    and d.profile_id = v_profile
  for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- Compte AVANT le DELETE : apres, les cascades ont deja joue.
  select count(*)::integer into v_detached
  from (
    select a.id
      from public.applications a
     where a.cv_document_id = p_document_id
       and a.status <> 'draft'
    union
    select a.id
      from public.application_documents ad
      join public.applications a on a.id = ad.application_id
     where ad.document_id = p_document_id
       and a.status <> 'draft'
  ) as impacted;

  delete from public.profile_documents
   where id = p_document_id
     and profile_id = v_profile;

  perform private.log_audit(
    p_action      => 'profile.document_deleted',
    p_object_type => 'profile_document',
    p_object_id   => p_document_id::text,
    p_context     => jsonb_build_object(
                       'document_type',         v_type,
                       'detached_applications', v_detached));

  return jsonb_build_object(
    'document_id',           p_document_id,
    'storage_path',          v_path,
    'detached_applications', v_detached);
end
$$;

revoke all on function public.delete_my_document(uuid) from public, anon;
grant execute on function public.delete_my_document(uuid) to authenticated;

comment on function public.delete_my_document(uuid) is
  'Supprime un document du membre appelant et renvoie son storage_path pour que l''application efface les octets. Detache le document des candidatures deja envoyees (FK de 0008) et le signale. Audite.';

-- ---------------------------------------------------------------------
-- 3. Designer le document principal de son type (le « CV principal »)
--
--    Concept EXISTANT (`is_primary`, 0008), simplement rendu pilotable.
-- ---------------------------------------------------------------------
create or replace function public.set_my_primary_document(p_document_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile uuid := private.current_profile_id();
  v_type    text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_profile is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  select d.document_type into v_type
  from public.profile_documents d
  where d.id = p_document_id
    and d.profile_id = v_profile
    and d.deleted_at is null
  for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  update public.profile_documents
     set is_primary = false
   where profile_id = v_profile
     and document_type = v_type
     and is_primary
     and deleted_at is null
     and id <> p_document_id;

  update public.profile_documents
     set is_primary = true
   where id = p_document_id;

  perform private.log_audit(
    p_action      => 'profile.document_set_primary',
    p_object_type => 'profile_document',
    p_object_id   => p_document_id::text,
    p_context     => jsonb_build_object('document_type', v_type));

  return jsonb_build_object('document_id', p_document_id, 'document_type', v_type);
end
$$;

revoke all on function public.set_my_primary_document(uuid) from public, anon;
grant execute on function public.set_my_primary_document(uuid) to authenticated;

comment on function public.set_my_primary_document(uuid) is
  'Designe un document du membre appelant comme principal pour son type (au plus un par type, index unique de 0008). Audite.';

-- ---------------------------------------------------------------------
-- 4. Lecture enrichie — meme RPC, cles SUPPLEMENTAIRES
--
--    `list_my_documents()` ne renvoyait ni le chemin de stockage, ni le
--    type MIME, ni la taille : impossible d'afficher un ecran de gestion
--    ou de fabriquer une URL signee. On AJOUTE des cles, on n'en retire
--    ni n'en renomme aucune — le consommateur existant
--    (`toProfileDocuments`, ecran de candidature) ignore ce qu'il ne lit
--    pas et continue de fonctionner a l'identique.
--
--    `storage_path` n'est expose qu'au proprietaire : la fonction filtre
--    deja sur `d.profile_id = private.current_profile_id()`.
-- ---------------------------------------------------------------------
create or replace function public.list_my_documents(p_document_type text default null)
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

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'document_id',   d.id,
             'document_type', d.document_type,
             'title',         d.title,
             'filename',      d.original_filename,
             'is_primary',    d.is_primary,
             'created_at',    d.created_at,
             'storage_path',  d.storage_path,
             'mime_type',     d.mime_type,
             'size_bytes',    d.size_bytes,
             'updated_at',    d.updated_at)
           order by d.is_primary desc, d.created_at desc)
      from public.profile_documents d
     where d.profile_id = v_me
       and d.deleted_at is null
       and (p_document_type is null or d.document_type = p_document_type)), '[]'::jsonb);
end
$$;

revoke all on function public.list_my_documents(text) from public, anon;
grant execute on function public.list_my_documents(text) to authenticated;

comment on function public.list_my_documents(text) is
  'Documents du membre appelant. Depuis 0127 : ajoute storage_path, mime_type, size_bytes et updated_at aux cles existantes (ajout pur, aucune cle retiree).';
