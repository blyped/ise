-- =====================================================================
-- 0080_admin_imports_api
-- API serveur du back-office « Imports & qualité des données »
-- (écrans SA-040 → SA-043).
--
-- Sources : MASTER PROMPT §6, §36, §37, §98 ; DIGEST B section 6
-- « Protocole d'import » ; migrations 0017 (modèle), 0018 (audit),
-- 0027 (bucket admin-imports) ; docs/decisions.md D-30, D-102, D-104, D-126.
--
-- RÈGLES STRUCTURANTES (répétées ici parce qu'elles sont non négociables)
--   * MASTER PROMPT §6 / §37 / D-104 : un import ne crée JAMAIS de compte
--     `auth.users`. AUCUNE fonction de ce fichier ne touche `auth.users`,
--     ni en INSERT, ni en UPDATE. Le résultat d'un import est un profil
--     RÉFÉRENCÉ : `ise_profiles.user_id = NULL`, `claim_status = 'unclaimed'`.
--   * MASTER PROMPT §37 : le workflow upload → staging → mapping →
--     validation → normalisation → détection doublons → revue humaine →
--     import → rapport est verrouillé par `private.transition_import_batch()`
--     — seule voie de changement d'étape, appelée ici et jamais contournée.
--   * AUCUNE fusion automatique : `admin_execute_import_batch()` refuse de
--     démarrer tant qu'un candidat doublon est `pending`/`deferred`, et une
--     fusion exige une décision humaine tracée (contrainte
--     `duplicate_candidates_human_review` + `import_rows_decision_traceable`).
--   * D-126 : chaque fonction est SECURITY DEFINER, `search_path = ''`,
--     vérifie sa permission en tête, et est REVOKE de PUBLIC et anon.
--   * §98 : tous les compteurs renvoyés sont des COUNT réels.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Helpers de transformation (étape mapping / normalisation).
--    Transformations sans perte uniquement : la donnée brute reste dans
--    `import_rows.raw_source_data`, jamais écrasée (0017).
-- ---------------------------------------------------------------------

-- Normalisation téléphonique prudente (doc 23 §22) : on ne produit un
-- E.164 que si la chaîne en est déjà un, aux séparateurs près. Sinon NULL :
-- le brut reste disponible, rien n'est inventé.
create or replace function private.import_phone_e164(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when candidate ~ '^\+[1-9][0-9]{6,14}$' then candidate
    else null
  end
  from (
    select regexp_replace(
             regexp_replace(btrim(coalesce(p_value, '')), '^00', '+'),
             '[\s.()\-]', '', 'g'
           ) as candidate
  ) c
$$;

revoke all on function private.import_phone_e164(text) from public, anon;

-- Date : formats ISO (YYYY-MM-DD) et français (DD/MM/YYYY) uniquement.
-- Tout le reste renvoie NULL plutôt qu'une interprétation hasardeuse.
create or replace function private.import_try_date(p_value text)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_value, ''));
begin
  if v ~ '^\d{4}-\d{2}-\d{2}$' then
    return v::date;
  elsif v ~ '^\d{2}/\d{2}/\d{4}$' then
    return to_date(v, 'DD/MM/YYYY');
  end if;
  return null;
exception when others then
  return null;
end
$$;

revoke all on function private.import_try_date(text) from public, anon;

-- Application d'une transformation déclarée dans le mapping (0017).
create or replace function private.import_transform(p_value text, p_transform text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case coalesce(p_transform, 'none')
    when 'trim'            then nullif(btrim(p_value), '')
    when 'lower'           then nullif(lower(btrim(p_value)), '')
    when 'upper'           then nullif(upper(btrim(p_value)), '')
    when 'collapse_spaces' then nullif(btrim(regexp_replace(coalesce(p_value, ''), '\s+', ' ', 'g')), '')
    when 'normalize_name'  then nullif(btrim(regexp_replace(coalesce(p_value, ''), '\s+', ' ', 'g')), '')
    when 'normalize_email' then nullif(lower(btrim(p_value)), '')
    when 'normalize_phone' then coalesce(private.import_phone_e164(p_value), nullif(btrim(p_value), ''))
    when 'parse_integer'   then case when btrim(coalesce(p_value, '')) ~ '^\d{1,9}$'
                                     then btrim(p_value) else null end
    when 'parse_date'      then private.import_try_date(p_value)::text
    else nullif(btrim(p_value), '')
  end
$$;

revoke all on function private.import_transform(text, text) from public, anon;

-- Record mappé d'une ligne : applique le mapping de colonnes du lot à la
-- donnée brute. Ne modifie rien.
create or replace function private.import_mapped_record(p_batch_id uuid, p_raw jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(
    jsonb_object_agg(
      m.target_field,
      private.import_transform(p_raw ->> m.source_column, m.transform)
    ) filter (where private.import_transform(p_raw ->> m.source_column, m.transform) is not null),
    '{}'::jsonb
  )
  from private.import_column_mappings m
  where m.batch_id = p_batch_id
    and m.is_ignored = false
    and m.target_field is not null
$$;

revoke all on function private.import_mapped_record(uuid, jsonb) from public, anon;


-- ---------------------------------------------------------------------
-- 1. Permissions du porteur — pour l'affichage du shell admin.
--    Même principe que get_my_cms_permissions (0067) : la source est
--    private.role_permissions, rien n'est recopié côté client.
-- ---------------------------------------------------------------------
create or replace function public.get_my_admin_data_permissions()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(code order by code), '[]'::jsonb)
  from (
    select distinct perm.code
    from private.user_roles ur
    join private.role_permissions rp on rp.role_id = ur.role_id
    join private.permissions perm on perm.id = rp.permission_id
    join public.ise_profiles p on p.id = ur.profile_id
    where p.user_id = (select auth.uid())
      and (ur.expires_at is null or ur.expires_at > now())
      and perm.code in ('imports.execute', 'imports.review', 'analytics.read',
                        'settings.manage', 'audit.read')
  ) codes
$$;

revoke all on function public.get_my_admin_data_permissions() from public, anon;
grant execute on function public.get_my_admin_data_permissions() to authenticated;

comment on function public.get_my_admin_data_permissions() is
  'Permissions back-office données/analytics/paramètres/audit du compte courant. Affichage seulement : chaque fonction revérifie.';


-- ---------------------------------------------------------------------
-- 2. Vue d'ensemble SA-040 — uniquement des COUNT réels (§98).
-- ---------------------------------------------------------------------
create or replace function public.admin_imports_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not (private.has_permission('imports.execute') or private.has_permission('imports.review')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'batches_30d',        (select count(*) from private.import_batches
                            where created_at >= now() - interval '30 days'),
    'batches_30d_reported', (select count(*) from private.import_batches
                            where created_at >= now() - interval '30 days' and status = 'reported'),
    'batches_in_review',  (select count(*) from private.import_batches
                            where status = 'human_review'),
    'pending_duplicates', (select count(*) from private.duplicate_candidates
                            where status in ('pending', 'deferred')),
    'pending_duplicates_probable', (select count(*) from private.duplicate_candidates
                            where status in ('pending', 'deferred') and match_class = 'probable_duplicate'),
    'open_issues',        (select count(*) from private.data_quality_issues where status = 'open'),
    'open_issues_errors', (select count(*) from private.data_quality_issues
                            where status = 'open' and severity = 'error'),
    'pending_value_reviews', (select count(*) from private.import_value_reviews where status = 'pending'),
    'quality', (
      select jsonb_build_object(
        'total_profiles',        count(*),
        'identity_complete',     count(*) filter (where p.promotion_id is not null),
        'with_position',         count(*) filter (where p.current_position is not null
                                                  or p.current_organization_id is not null
                                                  or p.current_organization_raw is not null),
        'with_country',          count(*) filter (where p.current_country_code is not null),
        'email_valid_or_absent', count(*) filter (where pc.primary_email is null
                                                  or pc.primary_email_norm ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
      )
      from public.ise_profiles p
      left join private.profile_contacts pc on pc.profile_id = p.id
      where p.deleted_at is null
    )
  ) into v_result;

  return v_result;
end
$$;

revoke all on function public.admin_imports_overview() from public, anon;
grant execute on function public.admin_imports_overview() to authenticated;


-- ---------------------------------------------------------------------
-- 3. Liste des lots (curseur created_at desc, id desc).
-- ---------------------------------------------------------------------
create or replace function public.admin_list_import_batches(
  p_limit          integer     default 20,
  p_before_created timestamptz default null,
  p_before_id      uuid        default null,
  p_status         text        default null
)
returns table (
  id               uuid,
  source_name      text,
  source_date      date,
  original_filename text,
  file_format      text,
  status           text,
  is_pilot         boolean,
  pilot_label      text,
  total_rows       integer,
  created_profiles integer,
  updated_profiles integer,
  ignored_rows     integer,
  error_rows       integer,
  review_rows      integer,
  staged_rows      bigint,
  valid_rows       bigint,
  invalid_rows     bigint,
  needs_review_rows bigint,
  imported_rows    bigint,
  open_issues      bigint,
  pending_duplicates bigint,
  uploaded_by      text,
  created_at       timestamptz,
  completed_at     timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not (private.has_permission('imports.execute') or private.has_permission('imports.review')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  select b.id, b.source_name, b.source_date, b.original_filename, b.file_format,
         b.status, b.is_pilot, b.pilot_label,
         b.total_rows, b.created_profiles, b.updated_profiles,
         b.ignored_rows, b.error_rows, b.review_rows,
         count(r.id)                                          as staged_rows,
         count(r.id) filter (where r.status in ('valid', 'normalized')) as valid_rows,
         count(r.id) filter (where r.status = 'invalid')      as invalid_rows,
         count(r.id) filter (where r.status = 'needs_review') as needs_review_rows,
         count(r.id) filter (where r.status = 'imported')     as imported_rows,
         (select count(*) from private.data_quality_issues i
           where i.batch_id = b.id and i.status = 'open')     as open_issues,
         (select count(*) from private.duplicate_candidates d
           where d.batch_id = b.id and d.status in ('pending', 'deferred')) as pending_duplicates,
         up.display_name                                      as uploaded_by,
         b.created_at, b.completed_at
  from private.import_batches b
  left join private.import_rows r on r.batch_id = b.id
  left join public.ise_profiles up on up.id = b.uploaded_by_profile_id
  where (p_status is null or b.status = p_status)
    and (p_before_created is null
         or (b.created_at, b.id) < (p_before_created, coalesce(p_before_id, b.id)))
  group by b.id, up.display_name
  order by b.created_at desc, b.id desc
  limit v_limit;
end
$$;

revoke all on function public.admin_list_import_batches(integer, timestamptz, uuid, text) from public, anon;
grant execute on function public.admin_list_import_batches(integer, timestamptz, uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- 4. Création d'un lot (étape « upload »).
-- ---------------------------------------------------------------------
create or replace function public.admin_create_import_batch(
  p_source_name       text,
  p_original_filename text,
  p_file_format       text,
  p_source_date       date    default null,
  p_file_checksum     text    default null,
  p_is_pilot          boolean default false,
  p_pilot_label       text    default null,
  p_notes             text    default null,
  p_correlation_id    text    default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('imports.execute') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if coalesce(btrim(p_source_name), '') = '' or coalesce(btrim(p_original_filename), '') = '' then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_file_format not in ('csv', 'xlsx') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  begin
    insert into private.import_batches
      (source_name, source_date, original_filename, file_format, file_checksum,
       uploaded_by_profile_id, is_pilot, pilot_label, notes)
    values
      (btrim(p_source_name), p_source_date, btrim(p_original_filename), p_file_format,
       nullif(btrim(coalesce(p_file_checksum, '')), ''), v_me,
       coalesce(p_is_pilot, false), nullif(btrim(coalesce(p_pilot_label, '')), ''),
       nullif(btrim(coalesce(p_notes, '')), ''))
    returning id into v_id;
  exception when unique_violation then
    -- Empreinte déjà connue : le même fichier a déjà été chargé.
    -- Idempotence exigée par le protocole (doc 23 §141-142).
    raise exception 'import_file_already_loaded' using errcode = 'P0001';
  end;

  perform private.log_audit(
    p_action => 'import.batch_created', p_object_type => 'import_batch',
    p_object_id => v_id::text,
    p_context => jsonb_build_object('source_name', btrim(p_source_name),
                                    'file_format', p_file_format,
                                    'is_pilot', coalesce(p_is_pilot, false)),
    p_correlation_id => p_correlation_id);

  return v_id;
end
$$;

revoke all on function public.admin_create_import_batch(text, text, text, date, text, boolean, text, text, text) from public, anon;
grant execute on function public.admin_create_import_batch(text, text, text, date, text, boolean, text, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 5. Staging des lignes parsées côté serveur applicatif.
--    `raw_source_data` conserve la ligne telle quelle (0017). Les lignes
--    strictement identiques dans le même fichier ne sont stockées qu'une
--    fois (row_hash) : compteur `duplicate_raw_rows` réel dans le retour.
-- ---------------------------------------------------------------------
create or replace function public.admin_stage_import_rows(
  p_batch_id       uuid,
  p_storage_path   text,
  p_rows           jsonb,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_batch    private.import_batches;
  v_total    integer;
  v_inserted integer;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('imports.execute') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_batch from private.import_batches where id = p_batch_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_batch.status <> 'uploaded' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  v_total := jsonb_array_length(p_rows);

  insert into private.import_rows (batch_id, row_number, source_id, raw_source_data, row_hash, status)
  select p_batch_id,
         (e.value ->> 'n')::integer,
         nullif(btrim(coalesce(e.value -> 'd' ->> 'source_id', e.value -> 'd' ->> 'SOURCE_ID', '')), ''),
         e.value -> 'd',
         md5((e.value -> 'd')::text),
         'staged'
  from jsonb_array_elements(p_rows) e
  on conflict do nothing;

  get diagnostics v_inserted = row_count;

  update private.import_batches
     set total_rows   = v_total,
         storage_path = coalesce(nullif(btrim(coalesce(p_storage_path, '')), ''), storage_path)
   where id = p_batch_id;

  perform private.transition_import_batch(p_batch_id, 'staged',
    format('%s ligne(s) reçue(s), %s stockée(s), %s doublon(s) bruts exclus',
           v_total, v_inserted, v_total - v_inserted));

  perform private.log_audit(
    p_action => 'import.rows_staged', p_object_type => 'import_batch',
    p_object_id => p_batch_id::text,
    p_context => jsonb_build_object('total_rows', v_total, 'staged_rows', v_inserted),
    p_correlation_id => p_correlation_id);

  return jsonb_build_object('total_rows', v_total, 'staged_rows', v_inserted,
                            'duplicate_raw_rows', v_total - v_inserted);
end
$$;

revoke all on function public.admin_stage_import_rows(uuid, text, jsonb, text) from public, anon;
grant execute on function public.admin_stage_import_rows(uuid, text, jsonb, text) to authenticated;


-- ---------------------------------------------------------------------
-- 6. Détail d'un lot : lot + avancement + mapping + jalons + rapports.
-- ---------------------------------------------------------------------
create or replace function public.admin_get_import_batch(p_batch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not (private.has_permission('imports.execute') or private.has_permission('imports.review')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'batch', jsonb_build_object(
      'id', b.id, 'source_name', b.source_name, 'source_date', b.source_date,
      'original_filename', b.original_filename, 'file_format', b.file_format,
      'storage_path', b.storage_path, 'status', b.status,
      'is_pilot', b.is_pilot, 'pilot_label', b.pilot_label,
      'total_rows', b.total_rows, 'created_profiles', b.created_profiles,
      'updated_profiles', b.updated_profiles, 'ignored_rows', b.ignored_rows,
      'error_rows', b.error_rows, 'review_rows', b.review_rows,
      'notes', b.notes, 'created_at', b.created_at,
      'started_at', b.started_at, 'completed_at', b.completed_at,
      'uploaded_by', up.display_name),
    'progress', (
      select to_jsonb(pr) from private.import_batch_progress pr where pr.batch_id = b.id),
    'sample_columns', (
      select coalesce(jsonb_agg(distinct k), '[]'::jsonb)
      from private.import_rows r, jsonb_object_keys(r.raw_source_data) k
      where r.batch_id = b.id and r.row_number <= 5),
    'sample_rows', (
      select coalesce(jsonb_agg(r.raw_source_data order by r.row_number), '[]'::jsonb)
      from (select raw_source_data, row_number from private.import_rows
             where batch_id = b.id order by row_number limit 3) r),
    'mappings', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'source_column', m.source_column, 'source_position', m.source_position,
        'target_field', m.target_field, 'transform', m.transform,
        'is_ignored', m.is_ignored) order by coalesce(m.source_position, 0), m.source_column), '[]'::jsonb)
      from private.import_column_mappings m where m.batch_id = b.id),
    'stage_events', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'from_status', e.from_status, 'to_status', e.to_status, 'note', e.note,
        'actor', ap.display_name, 'created_at', e.created_at) order by e.created_at), '[]'::jsonb)
      from private.import_stage_events e
      left join public.ise_profiles ap on ap.id = e.actor_profile_id
      where e.batch_id = b.id),
    'reports', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'report_kind', rp.report_kind, 'totals', rp.totals,
        'generated_at', rp.generated_at) order by rp.generated_at), '[]'::jsonb)
      from private.import_reports rp where rp.batch_id = b.id),
    'duplicates', jsonb_build_object(
      'pending',   (select count(*) from private.duplicate_candidates d
                     where d.batch_id = b.id and d.status = 'pending'),
      'deferred',  (select count(*) from private.duplicate_candidates d
                     where d.batch_id = b.id and d.status = 'deferred'),
      'confirmed', (select count(*) from private.duplicate_candidates d
                     where d.batch_id = b.id and d.status = 'confirmed_duplicate'),
      'dismissed', (select count(*) from private.duplicate_candidates d
                     where d.batch_id = b.id and d.status = 'not_duplicate')),
    'issue_counts', (
      select coalesce(jsonb_object_agg(t.severity, t.n), '{}'::jsonb)
      from (select i.severity, count(*) as n from private.data_quality_issues i
             where i.batch_id = b.id and i.status = 'open' group by i.severity) t)
  ) into v_result
  from private.import_batches b
  left join public.ise_profiles up on up.id = b.uploaded_by_profile_id
  where b.id = p_batch_id;

  if v_result is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return v_result;
end
$$;

revoke all on function public.admin_get_import_batch(uuid) from public, anon;
grant execute on function public.admin_get_import_batch(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 7. Mapping des colonnes (étape « mapping »).
--    p_mappings : [{source_column, source_position, target_field|null,
--                   transform, is_ignored}]
--    Toute colonne du fichier doit être soit mappée, soit explicitement
--    ignorée (contrainte de 0017) : la fonction vérifie l'exhaustivité.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_import_mapping(
  p_batch_id       uuid,
  p_mappings       jsonb,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_batch    private.import_batches;
  v_missing  text[];
  v_count    integer;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('imports.execute') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_batch from private.import_batches where id = p_batch_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_batch.status not in ('staged', 'mapping') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if p_mappings is null or jsonb_typeof(p_mappings) <> 'array' then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  if v_batch.status = 'staged' then
    perform private.transition_import_batch(p_batch_id, 'mapping', null);
  end if;

  delete from private.import_column_mappings where batch_id = p_batch_id;

  insert into private.import_column_mappings
    (batch_id, source_column, source_position, target_field, transform, is_ignored)
  select p_batch_id,
         e.value ->> 'source_column',
         nullif(e.value ->> 'source_position', '')::integer,
         nullif(e.value ->> 'target_field', ''),
         coalesce(nullif(e.value ->> 'transform', ''), 'none'),
         coalesce((e.value ->> 'is_ignored')::boolean, false)
  from jsonb_array_elements(p_mappings) e;

  get diagnostics v_count = row_count;

  -- Exhaustivité : aucune colonne du fichier ne reste sans décision.
  select array_agg(distinct k) into v_missing
  from private.import_rows r, jsonb_object_keys(r.raw_source_data) k
  where r.batch_id = p_batch_id
    and not exists (
      select 1 from private.import_column_mappings m
      where m.batch_id = p_batch_id and m.source_column = k
    );
  if v_missing is not null then
    raise exception 'import_mapping_incomplete' using errcode = 'P0001',
      detail = array_to_string(v_missing, ', ');
  end if;

  perform private.log_audit(
    p_action => 'import.mapping_saved', p_object_type => 'import_batch',
    p_object_id => p_batch_id::text,
    p_context => jsonb_build_object('columns', v_count),
    p_correlation_id => p_correlation_id);

  return jsonb_build_object('columns', v_count);
end
$$;

revoke all on function public.admin_set_import_mapping(uuid, jsonb, text) from public, anon;
grant execute on function public.admin_set_import_mapping(uuid, jsonb, text) to authenticated;


-- ---------------------------------------------------------------------
-- 8. Validation (contrôles doc 23 §26-30).
--    Chaque ligne devient `valid` ou `invalid` ; les anomalies sont
--    tracées dans data_quality_issues avec un code machine (D-102).
-- ---------------------------------------------------------------------
create or replace function public.admin_validate_import_batch(
  p_batch_id       uuid,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_batch   private.import_batches;
  r         record;
  v_mapped  jsonb;
  v_year    integer;
  v_valid   integer := 0;
  v_invalid integer := 0;
  v_warn    integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('imports.execute') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_batch from private.import_batches where id = p_batch_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_batch.status <> 'mapping' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  perform private.transition_import_batch(p_batch_id, 'validation', null);

  -- Repart de zéro : la validation est rejouable tant que le lot n'a pas
  -- dépassé cette étape (elle ne l'est plus ensuite, transitions §37).
  delete from private.data_quality_issues where batch_id = p_batch_id and import_row_id is not null;

  for r in
    select ir.id, ir.row_number, ir.raw_source_data
    from private.import_rows ir
    where ir.batch_id = p_batch_id and ir.status in ('staged', 'mapped', 'valid', 'invalid')
    order by ir.row_number
  loop
    v_mapped := private.import_mapped_record(p_batch_id, r.raw_source_data);
    v_year   := case when v_mapped ->> 'promotion_year' ~ '^\d{4}$'
                     then (v_mapped ->> 'promotion_year')::integer else null end;

    -- Contrôle 1 (doc 23 §26) : nom manquant => rejet.
    if coalesce(v_mapped ->> 'first_name', '') = '' or coalesce(v_mapped ->> 'last_name', '') = '' then
      update private.import_rows
         set status = 'invalid', normalized_data = v_mapped,
             error_code = 'missing_required', processed_at = now()
       where id = r.id;
      insert into private.data_quality_issues
        (batch_id, import_row_id, issue_code, severity, field_name, details, recommended_action)
      values (p_batch_id, r.id, 'missing_required', 'error',
              case when coalesce(v_mapped ->> 'first_name', '') = '' then 'first_name' else 'last_name' end,
              jsonb_build_object('row_number', r.row_number), 'complete_source_then_reload');
      v_invalid := v_invalid + 1;
      continue;
    end if;

    -- Contrôle 3 : année de promotion invalide (ex. 0200) => erreur.
    if coalesce(v_mapped ->> 'promotion_year', '') <> ''
       and (v_year is null or v_year not between 1960 and 2100) then
      update private.import_rows
         set status = 'invalid', normalized_data = v_mapped,
             error_code = 'invalid_promotion', processed_at = now()
       where id = r.id;
      insert into private.data_quality_issues
        (batch_id, import_row_id, issue_code, severity, field_name, details, recommended_action)
      values (p_batch_id, r.id, 'invalid_promotion', 'error', 'promotion_year',
              jsonb_build_object('row_number', r.row_number, 'value', v_mapped ->> 'promotion_year'),
              'fix_promotion_year');
      v_invalid := v_invalid + 1;
      continue;
    end if;

    -- Contrôle 2 : promotion manquante => importable mais traitement
    -- manuel signalé (jamais « ISE vérifiable » sans promotion).
    if coalesce(v_mapped ->> 'promotion_year', '') = '' then
      insert into private.data_quality_issues
        (batch_id, import_row_id, issue_code, severity, field_name, details, recommended_action)
      values (p_batch_id, r.id, 'missing_required', 'warning', 'promotion_year',
              jsonb_build_object('row_number', r.row_number), 'manual_review');
      v_warn := v_warn + 1;
    elsif v_year is not null and not exists (
      select 1 from public.promotions p where p.graduation_year = v_year
    ) then
      insert into private.data_quality_issues
        (batch_id, import_row_id, issue_code, severity, field_name, details, recommended_action)
      values (p_batch_id, r.id, 'invalid_promotion', 'warning', 'promotion_year',
              jsonb_build_object('row_number', r.row_number, 'value', v_year,
                                 'reason', 'unknown_promotion'),
              'manual_review');
      v_warn := v_warn + 1;
    end if;

    -- Contrôle 4 : email invalide => importable, email marqué invalide,
    -- jamais utilisé pour l'invitation.
    if coalesce(v_mapped ->> 'email', '') <> ''
       and lower(btrim(v_mapped ->> 'email')) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      insert into private.data_quality_issues
        (batch_id, import_row_id, issue_code, severity, field_name, details, recommended_action)
      values (p_batch_id, r.id, 'invalid_email', 'warning', 'email',
              jsonb_build_object('row_number', r.row_number), 'exclude_email_from_invitations');
      v_warn := v_warn + 1;
    end if;

    -- Contrôle 5 : téléphone non normalisable => conservé brut, non
    -- versé dans profile_contacts.
    if coalesce(v_mapped ->> 'phone', '') <> ''
       and private.import_phone_e164(v_mapped ->> 'phone') is null then
      insert into private.data_quality_issues
        (batch_id, import_row_id, issue_code, severity, field_name, details, recommended_action)
      values (p_batch_id, r.id, 'invalid_phone', 'warning', 'phone',
              jsonb_build_object('row_number', r.row_number), 'keep_raw_only');
      v_warn := v_warn + 1;
    end if;

    update private.import_rows
       set status = 'valid', normalized_data = v_mapped, error_code = null, processed_at = now()
     where id = r.id;
    v_valid := v_valid + 1;
  end loop;

  perform private.log_audit(
    p_action => 'import.batch_validated', p_object_type => 'import_batch',
    p_object_id => p_batch_id::text,
    p_context => jsonb_build_object('valid', v_valid, 'invalid', v_invalid, 'warnings', v_warn),
    p_correlation_id => p_correlation_id);

  return jsonb_build_object('valid', v_valid, 'invalid', v_invalid, 'warnings', v_warn);
end
$$;

revoke all on function public.admin_validate_import_batch(uuid, text) from public, anon;
grant execute on function public.admin_validate_import_batch(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- 9. Normalisation (doc 23 §20-25) — sans perte : le brut reste intact,
--    les formes normalisées vont dans normalized_data._norm. Les chaînes
--    libres non résolues (organisation, secteur, pays) partent en file de
--    revue : RIEN n'est créé automatiquement dans les référentiels.
-- ---------------------------------------------------------------------
create or replace function public.admin_normalize_import_batch(
  p_batch_id       uuid,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_batch     private.import_batches;
  r           record;
  v_norm      jsonb;
  v_org_id    uuid;
  v_country   char(2);
  v_year      integer;
  v_promo_id  bigint;
  v_reviews   integer := 0;
  v_rows      integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('imports.execute') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_batch from private.import_batches where id = p_batch_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_batch.status <> 'validation' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  perform private.transition_import_batch(p_batch_id, 'normalization', null);

  delete from private.import_value_reviews where batch_id = p_batch_id;

  for r in
    select ir.id, ir.row_number, ir.normalized_data as mapped
    from private.import_rows ir
    where ir.batch_id = p_batch_id and ir.status = 'valid'
    order by ir.row_number
  loop
    v_year := case when r.mapped ->> 'promotion_year' ~ '^\d{4}$'
                   then (r.mapped ->> 'promotion_year')::integer else null end;

    select p.id into v_promo_id from public.promotions p
     where p.graduation_year = v_year limit 1;

    -- Organisation : rapprochement canonique par nom normalisé puis alias.
    v_org_id := null;
    if coalesce(r.mapped ->> 'organization', '') <> '' then
      select o.id into v_org_id
      from public.organizations o
      where o.normalized_name = public.normalize_text(r.mapped ->> 'organization')
      limit 1;
      if v_org_id is null then
        select a.organization_id into v_org_id
        from public.organization_aliases a
        where a.normalized_alias = public.normalize_text(r.mapped ->> 'organization')
        limit 1;
      end if;
      if v_org_id is null then
        -- « En cas d'incertitude, laisser non mappé plutôt qu'inventer. »
        insert into private.import_value_reviews
          (batch_id, import_row_id, value_type, raw_value, normalized_value)
        values (p_batch_id, r.id, 'organization', r.mapped ->> 'organization',
                public.normalize_text(r.mapped ->> 'organization'));
        insert into private.data_quality_issues
          (batch_id, import_row_id, issue_code, severity, field_name, details, recommended_action)
        values (p_batch_id, r.id, 'organization_unresolved', 'info', 'organization',
                jsonb_build_object('row_number', r.row_number), 'map_in_review_queue');
        v_reviews := v_reviews + 1;
      end if;
    end if;

    -- Secteur : jamais créé automatiquement ; non reconnu => file de revue.
    if coalesce(r.mapped ->> 'sector', '') <> ''
       and not exists (
         select 1 from public.sectors s
         where public.normalize_text(s.name) = public.normalize_text(r.mapped ->> 'sector')
       ) then
      insert into private.import_value_reviews
        (batch_id, import_row_id, value_type, raw_value, normalized_value)
      values (p_batch_id, r.id, 'sector', r.mapped ->> 'sector',
              public.normalize_text(r.mapped ->> 'sector'));
      insert into private.data_quality_issues
        (batch_id, import_row_id, issue_code, severity, field_name, details, recommended_action)
      values (p_batch_id, r.id, 'sector_unresolved', 'info', 'sector',
              jsonb_build_object('row_number', r.row_number), 'map_in_review_queue');
      v_reviews := v_reviews + 1;
    end if;

    -- Pays : résolu vers le code ISO uniquement si le libellé correspond.
    v_country := null;
    if coalesce(r.mapped ->> 'country', '') <> '' then
      select c.code into v_country
      from public.countries c
      where public.normalize_text(c.name_fr) = public.normalize_text(r.mapped ->> 'country')
         or public.normalize_text(c.name_en) = public.normalize_text(r.mapped ->> 'country')
         or lower(c.code) = lower(btrim(r.mapped ->> 'country'))
      limit 1;
      if v_country is null then
        insert into private.import_value_reviews
          (batch_id, import_row_id, value_type, raw_value, normalized_value)
        values (p_batch_id, r.id, 'country', r.mapped ->> 'country',
                public.normalize_text(r.mapped ->> 'country'));
        insert into private.data_quality_issues
          (batch_id, import_row_id, issue_code, severity, field_name, details, recommended_action)
        values (p_batch_id, r.id, 'country_unresolved', 'info', 'country',
                jsonb_build_object('row_number', r.row_number), 'map_in_review_queue');
        v_reviews := v_reviews + 1;
      end if;
    end if;

    v_norm := jsonb_strip_nulls(jsonb_build_object(
      'name',            public.normalize_text(
                           coalesce(r.mapped ->> 'first_name', '') || ' ' ||
                           coalesce(r.mapped ->> 'middle_names', '') || ' ' ||
                           coalesce(r.mapped ->> 'last_name', '')),
      'email',           case when lower(btrim(coalesce(r.mapped ->> 'email', ''))) ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
                              then lower(btrim(r.mapped ->> 'email')) end,
      'phone_e164',      private.import_phone_e164(r.mapped ->> 'phone'),
      'secondary_phone_e164', private.import_phone_e164(r.mapped ->> 'secondary_phone'),
      'promotion_year',  v_year,
      'promotion_id',    v_promo_id,
      'organization',    public.normalize_text(r.mapped ->> 'organization'),
      'organization_id', v_org_id,
      'country_code',    v_country
    ));

    update private.import_rows
       set normalized_data = (r.mapped - '_norm') || jsonb_build_object('_norm', v_norm),
           status = 'normalized', processed_at = now()
     where id = r.id;
    v_rows := v_rows + 1;
  end loop;

  perform private.log_audit(
    p_action => 'import.batch_normalized', p_object_type => 'import_batch',
    p_object_id => p_batch_id::text,
    p_context => jsonb_build_object('rows', v_rows, 'value_reviews', v_reviews),
    p_correlation_id => p_correlation_id);

  return jsonb_build_object('rows', v_rows, 'value_reviews', v_reviews);
end
$$;

revoke all on function public.admin_normalize_import_batch(uuid, text) from public, anon;
grant execute on function public.admin_normalize_import_batch(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- 10. Détection de doublons (doc 23 §31-39) : barème lu dans
--     private.duplicate_match_rules, JAMAIS codé en dur. Détection contre
--     les profils existants ET à l'intérieur du lot. Aucune fusion ici :
--     uniquement des candidats soumis à revue humaine.
-- ---------------------------------------------------------------------
create or replace function public.admin_detect_import_duplicates(
  p_batch_id       uuid,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_batch      private.import_batches;
  v_candidates integer := 0;
  v_internal   integer := 0;
  v_review     integer := 0;
  w_email  numeric := 0; w_phone numeric := 0; w_name numeric := 0;
  w_promo  numeric := 0; w_org   numeric := 0; w_ctry numeric := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('imports.execute') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_batch from private.import_batches where id = p_batch_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_batch.status <> 'normalization' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  perform private.transition_import_batch(p_batch_id, 'duplicate_detection', null);

  select coalesce(max(weight) filter (where code = 'email_exact'), 0),
         coalesce(max(weight) filter (where code = 'phone_exact'), 0),
         coalesce(max(weight) filter (where code = 'name_close'), 0),
         coalesce(max(weight) filter (where code = 'promotion_exact'), 0),
         coalesce(max(weight) filter (where code = 'organization_same'), 0),
         coalesce(max(weight) filter (where code = 'country_same'), 0)
    into w_email, w_phone, w_name, w_promo, w_org, w_ctry
  from private.duplicate_match_rules where is_active;

  -- 10.a — candidats contre les profils existants.
  with rows_norm as (
    select ir.id as row_id,
           ir.normalized_data -> '_norm' as n
    from private.import_rows ir
    where ir.batch_id = p_batch_id and ir.status = 'normalized'
  ),
  signals as (
    select rn.row_id, p.id as profile_id,
           (rn.n ->> 'email' is not null and pc.primary_email_norm = rn.n ->> 'email')   as email_exact,
           (rn.n ->> 'phone_e164' is not null
             and (pc.phone_e164 = rn.n ->> 'phone_e164'
                  or pc.secondary_phone_e164 = rn.n ->> 'phone_e164'))                   as phone_exact,
           (rn.n ->> 'name' is not null and p.normalized_name is not null
             and (p.normalized_name = rn.n ->> 'name'
                  or extensions.similarity(p.normalized_name, rn.n ->> 'name') >= 0.55)) as name_close,
           (rn.n ->> 'promotion_year' is not null
             and pr.graduation_year = (rn.n ->> 'promotion_year')::integer)              as promotion_exact,
           (rn.n ->> 'organization' is not null
             and (o.normalized_name = rn.n ->> 'organization'
                  or public.normalize_text(p.current_organization_raw) = rn.n ->> 'organization')) as organization_same,
           (rn.n ->> 'country_code' is not null
             and p.current_country_code = rn.n ->> 'country_code')                       as country_same
    from rows_norm rn
    join public.ise_profiles p on p.deleted_at is null
    left join private.profile_contacts pc on pc.profile_id = p.id
    left join public.promotions pr on pr.id = p.promotion_id
    left join public.organizations o on o.id = p.current_organization_id
  ),
  scored as (
    select s.row_id, s.profile_id,
           (case when s.email_exact then w_email else 0 end
            + case when s.phone_exact then w_phone else 0 end
            + case when s.name_close then w_name else 0 end
            + case when s.promotion_exact then w_promo else 0 end
            + case when s.organization_same then w_org else 0 end
            + case when s.country_same then w_ctry else 0 end) as score,
           jsonb_strip_nulls(jsonb_build_object(
             'email_exact',       nullif(s.email_exact, false),
             'phone_exact',       nullif(s.phone_exact, false),
             'name_close',        nullif(s.name_close, false),
             'promotion_exact',   nullif(s.promotion_exact, false),
             'organization_same', nullif(s.organization_same, false),
             'country_same',      nullif(s.country_same, false))) as signals
    from signals s
    -- Un candidat n'existe que sur un indice fort : email, téléphone ou
    -- nom proche. Pays/organisation seuls ne désignent personne.
    where s.email_exact or s.phone_exact or s.name_close
  )
  insert into private.duplicate_candidates
    (batch_id, import_row_id, existing_profile_id, score, signals, match_class)
  select p_batch_id, sc.row_id, sc.profile_id, sc.score, sc.signals,
         case when sc.score >= 80 then 'probable_duplicate'
              when sc.score >= 60 then 'to_examine'
              else 'new' end
  from scored sc
  on conflict (import_row_id, existing_profile_id) do nothing;

  get diagnostics v_candidates = row_count;

  -- Meilleur rapprochement reporté sur la ligne ; les classes probable /
  -- à examiner passent en revue humaine obligatoire.
  update private.import_rows ir
     set matched_profile_id = best.existing_profile_id,
         match_score        = best.score,
         match_class        = best.match_class,
         status             = case when best.match_class in ('probable_duplicate', 'to_examine')
                                   then 'needs_review' else ir.status end
  from (
    select distinct on (dc.import_row_id)
           dc.import_row_id, dc.existing_profile_id, dc.score, dc.match_class
    from private.duplicate_candidates dc
    where dc.batch_id = p_batch_id
    order by dc.import_row_id, dc.score desc, dc.created_at
  ) best
  where ir.id = best.import_row_id;

  -- 10.b — doublons INTERNES au lot : même email, même téléphone, ou même
  -- (nom normalisé + promotion) qu'une ligne précédente => revue humaine.
  with rows_norm as (
    select ir.id, ir.row_number, ir.normalized_data -> '_norm' as n
    from private.import_rows ir
    where ir.batch_id = p_batch_id and ir.status in ('normalized', 'needs_review')
  ),
  dupes as (
    select b.id as row_id, min(a.row_number) as first_row
    from rows_norm a
    join rows_norm b on b.row_number > a.row_number
     and ((a.n ->> 'email' is not null and a.n ->> 'email' = b.n ->> 'email')
       or (a.n ->> 'phone_e164' is not null and a.n ->> 'phone_e164' = b.n ->> 'phone_e164')
       or (a.n ->> 'name' is not null and a.n ->> 'name' = b.n ->> 'name'
           and a.n ->> 'promotion_year' is not null
           and a.n ->> 'promotion_year' = b.n ->> 'promotion_year'))
    group by b.id
  ),
  marked as (
    update private.import_rows ir
       set status = 'needs_review',
           error_code = coalesce(ir.error_code, 'ambiguous_duplicate')
      from dupes d
     where ir.id = d.row_id
    returning ir.id, ir.row_number, d.first_row
  )
  insert into private.data_quality_issues
    (batch_id, import_row_id, issue_code, severity, field_name, details, recommended_action)
  select p_batch_id, m.id, 'ambiguous_duplicate', 'warning', null,
         jsonb_build_object('row_number', m.row_number, 'duplicate_of_row', m.first_row,
                            'scope', 'within_batch'),
         'human_review_required'
  from marked m;

  get diagnostics v_internal = row_count;

  select count(*) into v_review from private.import_rows
   where batch_id = p_batch_id and status = 'needs_review';

  perform private.transition_import_batch(p_batch_id, 'human_review',
    format('%s candidat(s) externes, %s doublon(s) internes, %s ligne(s) en revue',
           v_candidates, v_internal, v_review));

  perform private.log_audit(
    p_action => 'import.duplicates_detected', p_object_type => 'import_batch',
    p_object_id => p_batch_id::text,
    p_context => jsonb_build_object('candidates', v_candidates,
                                    'internal_duplicates', v_internal,
                                    'rows_in_review', v_review),
    p_correlation_id => p_correlation_id);

  return jsonb_build_object('candidates', v_candidates,
                            'internal_duplicates', v_internal,
                            'rows_in_review', v_review);
end
$$;

revoke all on function public.admin_detect_import_duplicates(uuid, text) from public, anon;
grant execute on function public.admin_detect_import_duplicates(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- 11. Lignes d'un lot (curseur row_number croissant).
-- ---------------------------------------------------------------------
create or replace function public.admin_list_import_rows(
  p_batch_id  uuid,
  p_status    text    default null,
  p_limit     integer default 50,
  p_after_row integer default null
)
returns table (
  id              bigint,
  row_number      integer,
  source_id       text,
  raw_source_data jsonb,
  normalized_data jsonb,
  status          text,
  decision        text,
  decided_by      text,
  decided_at      timestamptz,
  matched_profile_id uuid,
  match_score     numeric,
  match_class     text,
  resulting_profile_id uuid,
  error_code      text,
  issues          jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not (private.has_permission('imports.execute') or private.has_permission('imports.review')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  select ir.id, ir.row_number, ir.source_id, ir.raw_source_data, ir.normalized_data,
         ir.status, ir.decision, dp.display_name, ir.decided_at,
         ir.matched_profile_id, ir.match_score, ir.match_class,
         ir.resulting_profile_id, ir.error_code,
         (select coalesce(jsonb_agg(jsonb_build_object(
            'issue_code', i.issue_code, 'severity', i.severity,
            'field_name', i.field_name, 'details', i.details,
            'recommended_action', i.recommended_action) order by i.id), '[]'::jsonb)
          from private.data_quality_issues i
          where i.import_row_id = ir.id and i.status = 'open')
  from private.import_rows ir
  left join public.ise_profiles dp on dp.id = ir.decided_by_profile_id
  where ir.batch_id = p_batch_id
    and (p_status is null or ir.status = p_status)
    and (p_after_row is null or ir.row_number > p_after_row)
  order by ir.row_number
  limit v_limit;
end
$$;

revoke all on function public.admin_list_import_rows(uuid, text, integer, integer) from public, anon;
grant execute on function public.admin_list_import_rows(uuid, text, integer, integer) to authenticated;


-- ---------------------------------------------------------------------
-- 12. Candidats doublons — comparaison côte à côte (SA-042).
--     Les coordonnées historiques du profil existant sont montrées au
--     réviseur : c'est précisément leur usage documenté (rapprochement,
--     vérification — DIGEST B §6.4), sous permission imports.*.
-- ---------------------------------------------------------------------
create or replace function public.admin_list_duplicate_candidates(
  p_batch_id    uuid,
  p_status      text    default null,
  p_limit       integer default 20,
  p_after_score numeric default null,
  p_after_id    uuid    default null
)
returns table (
  id                 uuid,
  import_row_id      bigint,
  row_number         integer,
  score              numeric,
  signals            jsonb,
  match_class        text,
  status             text,
  review_note        text,
  reviewed_by        text,
  reviewed_at        timestamptz,
  row_data           jsonb,
  row_decision       text,
  existing_profile   jsonb,
  field_resolutions  jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not (private.has_permission('imports.execute') or private.has_permission('imports.review')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  select dc.id, dc.import_row_id, ir.row_number, dc.score, dc.signals, dc.match_class,
         dc.status, dc.review_note, rp.display_name, dc.reviewed_at,
         ir.normalized_data, ir.decision,
         jsonb_strip_nulls(jsonb_build_object(
           'id', p.id,
           'display_name', p.display_name,
           'promotion_year', pr.graduation_year,
           'organization', coalesce(o.canonical_name, p.current_organization_raw),
           'position', p.current_position,
           'city', p.current_city,
           'country_code', p.current_country_code,
           'claim_status', p.claim_status,
           'profile_status', p.profile_status,
           'email', pc.primary_email,
           'phone', pc.phone_e164,
           'linkedin_url', p.linkedin_url)),
         (select coalesce(jsonb_agg(jsonb_build_object(
            'field_name', fr.field_name, 'existing_value', fr.existing_value,
            'incoming_value', fr.incoming_value, 'retained_value', fr.retained_value,
            'retained_source', fr.retained_source) order by fr.field_name), '[]'::jsonb)
          from private.merge_field_resolutions fr
          where fr.duplicate_candidate_id = dc.id)
  from private.duplicate_candidates dc
  join private.import_rows ir on ir.id = dc.import_row_id
  join public.ise_profiles p on p.id = dc.existing_profile_id
  left join public.promotions pr on pr.id = p.promotion_id
  left join public.organizations o on o.id = p.current_organization_id
  left join private.profile_contacts pc on pc.profile_id = p.id
  left join public.ise_profiles rp on rp.id = dc.reviewed_by_profile_id
  where dc.batch_id = p_batch_id
    and (p_status is null or dc.status = p_status)
    and (p_after_score is null
         or (dc.score, dc.id) < (p_after_score, coalesce(p_after_id, dc.id)))
  order by dc.score desc, dc.id desc
  limit v_limit;
end
$$;

revoke all on function public.admin_list_duplicate_candidates(uuid, text, integer, numeric, uuid) from public, anon;
grant execute on function public.admin_list_duplicate_candidates(uuid, text, integer, numeric, uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 13. Revue humaine d'un candidat doublon. SEULE voie de bascule :
--     l'appelant est enregistré comme réviseur (contrainte 0017).
-- ---------------------------------------------------------------------
create or replace function public.admin_review_duplicate_candidate(
  p_candidate_id   uuid,
  p_status         text,
  p_note           text default null,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me        uuid := private.current_profile_id();
  v_candidate private.duplicate_candidates;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('imports.review') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_status not in ('confirmed_duplicate', 'not_duplicate', 'deferred') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select * into v_candidate from private.duplicate_candidates
   where id = p_candidate_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  update private.duplicate_candidates
     set status = p_status,
         reviewed_by_profile_id = case when p_status = 'deferred' then reviewed_by_profile_id else v_me end,
         reviewed_at            = case when p_status = 'deferred' then reviewed_at else now() end,
         review_note            = coalesce(nullif(btrim(coalesce(p_note, '')), ''), review_note)
   where id = p_candidate_id;

  perform private.log_audit(
    p_action => 'import.duplicate_reviewed', p_object_type => 'duplicate_candidate',
    p_object_id => p_candidate_id::text,
    p_context => jsonb_build_object('batch_id', v_candidate.batch_id,
                                    'import_row_id', v_candidate.import_row_id,
                                    'existing_profile_id', v_candidate.existing_profile_id,
                                    'decision', p_status),
    p_correlation_id => p_correlation_id);

  return jsonb_build_object('id', p_candidate_id, 'status', p_status);
end
$$;

revoke all on function public.admin_review_duplicate_candidate(uuid, text, text, text) from public, anon;
grant execute on function public.admin_review_duplicate_candidate(uuid, text, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 14. Arbitrage champ par champ d'une fusion (doc 23 §41).
--     p_resolutions : [{field_name, existing_value, incoming_value,
--                       retained_value, retained_source}]
-- ---------------------------------------------------------------------
create or replace function public.admin_resolve_merge_fields(
  p_candidate_id   uuid,
  p_resolutions    jsonb,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me        uuid := private.current_profile_id();
  v_candidate private.duplicate_candidates;
  v_count     integer;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('imports.review') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_resolutions is null or jsonb_typeof(p_resolutions) <> 'array' then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select * into v_candidate from private.duplicate_candidates
   where id = p_candidate_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_candidate.status <> 'confirmed_duplicate' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  insert into private.merge_field_resolutions
    (duplicate_candidate_id, field_name, existing_value, incoming_value,
     retained_value, retained_source, decided_by_profile_id)
  select p_candidate_id,
         e.value ->> 'field_name',
         e.value ->> 'existing_value',
         e.value ->> 'incoming_value',
         e.value ->> 'retained_value',
         e.value ->> 'retained_source',
         v_me
  from jsonb_array_elements(p_resolutions) e
  on conflict (duplicate_candidate_id, field_name) do update
    set existing_value = excluded.existing_value,
        incoming_value = excluded.incoming_value,
        retained_value = excluded.retained_value,
        retained_source = excluded.retained_source,
        decided_by_profile_id = excluded.decided_by_profile_id,
        decided_at = now();

  get diagnostics v_count = row_count;

  perform private.log_audit(
    p_action => 'import.merge_fields_resolved', p_object_type => 'duplicate_candidate',
    p_object_id => p_candidate_id::text,
    p_context => jsonb_build_object('fields', v_count),
    p_correlation_id => p_correlation_id);

  return jsonb_build_object('fields', v_count);
end
$$;

revoke all on function public.admin_resolve_merge_fields(uuid, jsonb, text) from public, anon;
grant execute on function public.admin_resolve_merge_fields(uuid, jsonb, text) to authenticated;


-- ---------------------------------------------------------------------
-- 15. Décision humaine sur une ligne (doc 23 §40) :
--     create_new / merge / ignore / review_later.
--     `merge` exige un candidat CONFIRMÉ par un humain pour ce couple :
--     aucune fusion de deux personnes ambiguës.
-- ---------------------------------------------------------------------
create or replace function public.admin_decide_import_row(
  p_row_id             bigint,
  p_decision           text,
  p_matched_profile_id uuid default null,
  p_correlation_id     text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me     uuid := private.current_profile_id();
  v_row    private.import_rows;
  v_target uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('imports.review') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if p_decision not in ('create_new', 'merge', 'ignore', 'review_later') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  select * into v_row from private.import_rows where id = p_row_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_row.status in ('imported', 'ignored') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  v_target := coalesce(p_matched_profile_id, v_row.matched_profile_id);

  if p_decision = 'merge' then
    if v_target is null then
      raise exception 'validation_failed' using errcode = 'P0001';
    end if;
    -- Fusion sans candidat confirmé par un réviseur humain : refusée.
    if not exists (
      select 1 from private.duplicate_candidates dc
      where dc.import_row_id = p_row_id
        and dc.existing_profile_id = v_target
        and dc.status = 'confirmed_duplicate'
        and dc.reviewed_by_profile_id is not null
    ) then
      raise exception 'import_merge_requires_confirmed_duplicate' using errcode = 'P0001';
    end if;
  end if;

  update private.import_rows
     set decision = p_decision,
         decided_by_profile_id = v_me,
         decided_at = now(),
         matched_profile_id = case when p_decision = 'merge' then v_target else matched_profile_id end
   where id = p_row_id;

  perform private.log_audit(
    p_action => 'import.row_decided', p_object_type => 'import_row',
    p_object_id => p_row_id::text,
    p_context => jsonb_build_object('batch_id', v_row.batch_id,
                                    'row_number', v_row.row_number,
                                    'decision', p_decision,
                                    'matched_profile_id', v_target),
    p_correlation_id => p_correlation_id);

  return jsonb_build_object('id', p_row_id, 'decision', p_decision);
end
$$;

revoke all on function public.admin_decide_import_row(bigint, text, uuid, text) from public, anon;
grant execute on function public.admin_decide_import_row(bigint, text, uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- 16. Exécution de l'import (étape « import » puis « rapport »).
--
--     CE QUE CETTE FONCTION NE FAIT JAMAIS (MASTER PROMPT §6, D-104) :
--     créer un compte `auth.users`, un mot de passe, ou publier une
--     coordonnée. Elle crée des PROFILS RÉFÉRENCÉS : user_id NULL,
--     claim_status 'unclaimed', profile_status 'referenced'. Les
--     coordonnées vont dans private.profile_contacts (jamais exposé).
-- ---------------------------------------------------------------------
create or replace function public.admin_execute_import_batch(
  p_batch_id       uuid,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me       uuid := private.current_profile_id();
  v_batch    private.import_batches;
  r          record;
  v_norm     jsonb;
  v_profile  uuid;
  v_created  integer := 0;
  v_updated  integer := 0;
  v_ignored  integer := 0;
  v_errors   integer := 0;
  v_deferred integer := 0;
  v_totals   jsonb;
  fr         record;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('imports.execute') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_batch from private.import_batches where id = p_batch_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_batch.status <> 'human_review' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  -- Une ligne en revue sans décision humaine bloque tout le lot — en plus
  -- du verrou sur les candidats posé par transition_import_batch().
  if exists (
    select 1 from private.import_rows ir
    where ir.batch_id = p_batch_id and ir.status = 'needs_review' and ir.decision = 'pending'
  ) then
    raise exception 'import_review_pending' using errcode = 'P0001';
  end if;

  -- Refuse de démarrer si un candidat doublon attend encore (et trace le
  -- franchissement d'étape).
  perform private.transition_import_batch(p_batch_id, 'importing', null);

  for r in
    select ir.* from private.import_rows ir
    where ir.batch_id = p_batch_id
      and ir.status in ('normalized', 'needs_review', 'valid', 'invalid')
    order by ir.row_number
    for update
  loop
    if r.status = 'invalid' then
      v_errors := v_errors + 1;
      continue;
    end if;

    if r.decision = 'ignore' then
      update private.import_rows set status = 'ignored', processed_at = now() where id = r.id;
      v_ignored := v_ignored + 1;
      continue;
    end if;

    if r.decision = 'review_later' then
      update private.import_rows set status = 'skipped', processed_at = now() where id = r.id;
      v_deferred := v_deferred + 1;
      continue;
    end if;

    v_norm := coalesce(r.normalized_data -> '_norm', '{}'::jsonb);

    if r.decision = 'merge' and r.matched_profile_id is not null then
      -- Fusion champ par champ : UNIQUEMENT les valeurs retenues par un
      -- humain (merge_field_resolutions). Par défaut, rien n'est écrasé.
      for fr in
        select mfr.field_name, mfr.retained_value, mfr.retained_source
        from private.merge_field_resolutions mfr
        join private.duplicate_candidates dc on dc.id = mfr.duplicate_candidate_id
        where dc.import_row_id = r.id
          and dc.existing_profile_id = r.matched_profile_id
          and dc.status = 'confirmed_duplicate'
          and mfr.retained_source in ('incoming', 'manual', 'both_kept')
      loop
        if fr.field_name = 'first_name' and fr.retained_value is not null then
          update public.ise_profiles set first_name = fr.retained_value where id = r.matched_profile_id;
        elsif fr.field_name = 'middle_names' then
          update public.ise_profiles set middle_names = fr.retained_value where id = r.matched_profile_id;
        elsif fr.field_name = 'last_name' and fr.retained_value is not null then
          update public.ise_profiles set last_name = fr.retained_value where id = r.matched_profile_id;
        elsif fr.field_name = 'current_position' then
          update public.ise_profiles set current_position = fr.retained_value where id = r.matched_profile_id;
        elsif fr.field_name = 'city' then
          update public.ise_profiles set current_city = fr.retained_value where id = r.matched_profile_id;
        elsif fr.field_name = 'linkedin_url' then
          update public.ise_profiles set linkedin_url = fr.retained_value where id = r.matched_profile_id;
        elsif fr.field_name = 'organization' then
          update public.ise_profiles
             set current_organization_raw = fr.retained_value,
                 current_organization_id  = (select o.id from public.organizations o
                                              where o.normalized_name = public.normalize_text(fr.retained_value) limit 1)
           where id = r.matched_profile_id;
        elsif fr.field_name = 'promotion_year' and fr.retained_value ~ '^\d{4}$' then
          update public.ise_profiles
             set promotion_id = (select p.id from public.promotions p
                                  where p.graduation_year = fr.retained_value::integer limit 1)
           where id = r.matched_profile_id;
        elsif fr.field_name = 'email' and fr.retained_value is not null then
          insert into private.profile_contacts (profile_id, primary_email)
          values (r.matched_profile_id, fr.retained_value)
          on conflict (profile_id) do update
            set secondary_email = case when fr.retained_source = 'both_kept'
                                       then excluded.primary_email
                                       else private.profile_contacts.secondary_email end,
                primary_email   = case when fr.retained_source = 'both_kept'
                                       then private.profile_contacts.primary_email
                                       else excluded.primary_email end;
        elsif fr.field_name = 'phone' and private.import_phone_e164(fr.retained_value) is not null then
          insert into private.profile_contacts (profile_id, phone_e164)
          values (r.matched_profile_id, private.import_phone_e164(fr.retained_value))
          on conflict (profile_id) do update
            set secondary_phone_e164 = case when fr.retained_source = 'both_kept'
                                            then excluded.phone_e164
                                            else private.profile_contacts.secondary_phone_e164 end,
                phone_e164           = case when fr.retained_source = 'both_kept'
                                            then private.profile_contacts.phone_e164
                                            else excluded.phone_e164 end;
        end if;
      end loop;

      update private.import_rows
         set status = 'imported', resulting_profile_id = r.matched_profile_id, processed_at = now()
       where id = r.id;
      v_updated := v_updated + 1;

      perform private.log_audit(
        p_action => 'import.profile_merged', p_object_type => 'ise_profile',
        p_object_id => r.matched_profile_id::text,
        p_context => jsonb_build_object('batch_id', p_batch_id, 'row_number', r.row_number),
        p_correlation_id => p_correlation_id);
      continue;
    end if;

    -- create_new (décision humaine) ou pending sans doublon détecté :
    -- création d'un PROFIL RÉFÉRENCÉ. user_id NULL — jamais de compte
    -- auth.users, en aucun cas (MASTER PROMPT §6, D-104).
    insert into public.ise_profiles
      (user_id, promotion_id, first_name, middle_names, last_name,
       current_position, current_organization_id, current_organization_raw,
       current_country_code, current_city, linkedin_url,
       profile_status, claim_status, verification_status)
    values
      (null,
       nullif(v_norm ->> 'promotion_id', '')::bigint,
       r.normalized_data ->> 'first_name',
       r.normalized_data ->> 'middle_names',
       r.normalized_data ->> 'last_name',
       r.normalized_data ->> 'current_position',
       nullif(v_norm ->> 'organization_id', '')::uuid,
       case when nullif(v_norm ->> 'organization_id', '') is null
            then r.normalized_data ->> 'organization' end,
       nullif(v_norm ->> 'country_code', ''),
       r.normalized_data ->> 'city',
       r.normalized_data ->> 'linkedin_url',
       'referenced', 'unclaimed', 'unverified')
    returning id into v_profile;

    -- Coordonnées historiques : privées, pour invitation / rapprochement /
    -- vérification uniquement. Un email invalide n'est PAS stocké.
    if v_norm ->> 'email' is not null
       or v_norm ->> 'phone_e164' is not null
       or v_norm ->> 'secondary_phone_e164' is not null then
      insert into private.profile_contacts
        (profile_id, primary_email, phone_e164, secondary_phone_e164)
      values (v_profile, v_norm ->> 'email', v_norm ->> 'phone_e164',
              v_norm ->> 'secondary_phone_e164')
      on conflict (profile_id) do nothing;
    end if;

    update private.import_rows
       set status = 'imported', resulting_profile_id = v_profile, processed_at = now()
     where id = r.id;
    v_created := v_created + 1;
  end loop;

  update private.import_batches
     set created_profiles = v_created,
         updated_profiles = v_updated,
         ignored_rows     = v_ignored,
         error_rows       = v_errors,
         review_rows      = v_deferred
   where id = p_batch_id;

  v_totals := jsonb_build_object(
    'total_rows', v_batch.total_rows,
    'created_profiles', v_created,
    'updated_profiles', v_updated,
    'ignored_rows', v_ignored,
    'error_rows', v_errors,
    'deferred_rows', v_deferred);

  insert into private.import_reports (batch_id, report_kind, totals, generated_by_profile_id)
  values (p_batch_id, 'summary', v_totals, v_me)
  on conflict (batch_id, report_kind) do update
    set totals = excluded.totals, generated_at = now();

  insert into private.import_reports (batch_id, report_kind, totals, generated_by_profile_id)
  select p_batch_id, 'errors',
         coalesce(jsonb_agg(jsonb_build_object(
           'row_number', ir.row_number, 'source_id', ir.source_id,
           'error_code', ir.error_code) order by ir.row_number), '[]'::jsonb),
         v_me
  from private.import_rows ir
  where ir.batch_id = p_batch_id and ir.status = 'invalid'
  on conflict (batch_id, report_kind) do update
    set totals = excluded.totals, generated_at = now();

  insert into private.import_reports (batch_id, report_kind, totals, generated_by_profile_id)
  select p_batch_id, 'duplicates',
         jsonb_build_object(
           'confirmed', count(*) filter (where dc.status = 'confirmed_duplicate'),
           'dismissed', count(*) filter (where dc.status = 'not_duplicate'),
           'deferred',  count(*) filter (where dc.status = 'deferred')),
         v_me
  from private.duplicate_candidates dc
  where dc.batch_id = p_batch_id
  on conflict (batch_id, report_kind) do update
    set totals = excluded.totals, generated_at = now();

  perform private.transition_import_batch(p_batch_id, 'reported',
    format('%s créé(s), %s fusionné(s), %s ignoré(s), %s erreur(s), %s reporté(s)',
           v_created, v_updated, v_ignored, v_errors, v_deferred));

  perform private.log_audit(
    p_action => 'import.batch_executed', p_object_type => 'import_batch',
    p_object_id => p_batch_id::text,
    p_context => v_totals,
    p_correlation_id => p_correlation_id);

  return v_totals;
end
$$;

revoke all on function public.admin_execute_import_batch(uuid, text) from public, anon;
grant execute on function public.admin_execute_import_batch(uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- 17. Abandon / échec manuel d'un lot (transitions terminales du §37).
-- ---------------------------------------------------------------------
create or replace function public.admin_transition_import_batch(
  p_batch_id       uuid,
  p_to_status      text,
  p_note           text default null,
  p_correlation_id text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_batch private.import_batches;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('imports.execute') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  -- Depuis l'interface, seuls l'abandon et le constat d'échec sont
  -- accessibles : les étapes de travail passent par les fonctions dédiées.
  if p_to_status not in ('cancelled', 'failed') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  v_batch := private.transition_import_batch(p_batch_id, p_to_status, p_note);

  perform private.log_audit(
    p_action => 'import.batch_' || p_to_status, p_object_type => 'import_batch',
    p_object_id => p_batch_id::text,
    p_context => jsonb_build_object('note', p_note),
    p_correlation_id => p_correlation_id);

  return jsonb_build_object('id', v_batch.id, 'status', v_batch.status);
end
$$;

revoke all on function public.admin_transition_import_batch(uuid, text, text, text) from public, anon;
grant execute on function public.admin_transition_import_batch(uuid, text, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 18. Anomalies de qualité (onglet « Anomalies » de SA-040).
-- ---------------------------------------------------------------------
create or replace function public.admin_list_data_quality_issues(
  p_batch_id uuid    default null,
  p_status   text    default 'open',
  p_severity text    default null,
  p_limit    integer default 50,
  p_after_id bigint  default null
)
returns table (
  id           bigint,
  batch_id     uuid,
  import_row_id bigint,
  row_number   integer,
  profile_id   uuid,
  profile_name text,
  issue_code   text,
  severity     text,
  field_name   text,
  details      jsonb,
  recommended_action text,
  status       text,
  created_at   timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not (private.has_permission('imports.execute') or private.has_permission('imports.review')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  select i.id, i.batch_id, i.import_row_id, ir.row_number, i.profile_id,
         p.display_name, i.issue_code, i.severity, i.field_name, i.details,
         i.recommended_action, i.status, i.created_at
  from private.data_quality_issues i
  left join private.import_rows ir on ir.id = i.import_row_id
  left join public.ise_profiles p on p.id = i.profile_id
  where (p_batch_id is null or i.batch_id = p_batch_id)
    and (p_status is null or i.status = p_status)
    and (p_severity is null or i.severity = p_severity)
    and (p_after_id is null or i.id > p_after_id)
  order by i.id
  limit v_limit;
end
$$;

revoke all on function public.admin_list_data_quality_issues(uuid, text, text, integer, bigint) from public, anon;
grant execute on function public.admin_list_data_quality_issues(uuid, text, text, integer, bigint) to authenticated;


-- ---------------------------------------------------------------------
-- 19. Profils incomplets (SA-043) — priorisation par NOMBRE de champs
--     critiques manquants. Le score de complétion (profile_completion)
--     n'est PAS exposé : il reste privé et hors classement (D-72). Ici,
--     on liste des manques factuels, outil de qualité de données.
-- ---------------------------------------------------------------------
create or replace function public.admin_list_incomplete_profiles(
  p_limit         integer default 50,
  p_after_missing integer default null,
  p_after_id      uuid    default null
)
returns table (
  id              uuid,
  display_name    text,
  promotion_year  integer,
  claim_status    text,
  profile_status  text,
  missing_fields  text[],
  missing_count   integer,
  has_contact_email boolean,
  created_at      timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not (private.has_permission('imports.execute') or private.has_permission('imports.review')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  with missing as (
    select p.id, p.display_name, pr.graduation_year, p.claim_status, p.profile_status,
           array_remove(array[
             case when p.promotion_id is null then 'promotion' end,
             case when p.current_position is null and p.current_organization_id is null
                   and p.current_organization_raw is null then 'situation_professionnelle' end,
             case when p.current_country_code is null then 'pays' end,
             case when pc.primary_email is null then 'email_contact' end,
             case when pc.phone_e164 is null then 'telephone' end
           ], null) as missing_fields,
           (pc.primary_email is not null) as has_contact_email,
           p.created_at
    from public.ise_profiles p
    left join public.promotions pr on pr.id = p.promotion_id
    left join private.profile_contacts pc on pc.profile_id = p.id
    where p.deleted_at is null
  )
  select m.id, m.display_name, m.graduation_year, m.claim_status, m.profile_status,
         m.missing_fields, coalesce(array_length(m.missing_fields, 1), 0),
         m.has_contact_email, m.created_at
  from missing m
  where coalesce(array_length(m.missing_fields, 1), 0) > 0
    and (p_after_missing is null
         or (coalesce(array_length(m.missing_fields, 1), 0), m.id)
            < (p_after_missing, coalesce(p_after_id, m.id)))
  order by coalesce(array_length(m.missing_fields, 1), 0) desc, m.id desc
  limit v_limit;
end
$$;

revoke all on function public.admin_list_incomplete_profiles(integer, integer, uuid) from public, anon;
grant execute on function public.admin_list_incomplete_profiles(integer, integer, uuid) to authenticated;
