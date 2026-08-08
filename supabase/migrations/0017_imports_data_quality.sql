-- =====================================================================
-- 0017_imports_data_quality
-- Pipeline d'import des profils ISE et qualite des donnees.
--
-- Sources : DIGEST A partie Z ; DIGEST B section 6 « Protocole d'import » ;
--           MASTER PROMPT §6, §36, §37, §98 ; docs/decisions.md D-16, D-104.
--
-- REGLES STRUCTURANTES (non negociables)
--   * MASTER PROMPT §6 / §37 / D-104 : un import ne cree JAMAIS de compte
--     `auth.users`. Aucune table de ce fichier ne reference `auth.users`.
--     Le resultat d'un import est un profil REFERENCE (user_id NULL).
--   * MASTER PROMPT §37 : workflow obligatoire
--       upload -> staging -> mapping -> validation -> normalisation
--       -> detection doublons -> revue humaine -> import -> rapport
--     encode par `private.import_batches.status` et verrouille par
--     `private.transition_import_batch()`.
--   * AUCUNE fusion automatique de deux personnes ambigues : un candidat
--     doublon ne peut etre confirme sans reviseur humain (contrainte
--     `duplicate_candidates_human_review`).
--   * Le fichier d'origine est conserve tel quel : `import_rows.raw_source_data`.
--   * Schema `private` : donnees brutes sensibles, jamais exposees a la Data API
--     (D-16). Les revokes de schema sont poses en 0001.
--   * Aucune RLS ni policy ici : le schema `private` n'est pas expose.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Lots d'import
-- ---------------------------------------------------------------------
create table if not exists private.import_batches (
  id                      uuid primary key default extensions.gen_random_uuid(),

  -- Origine documentaire du lot.
  source_name             text not null,
  source_date             date,
  original_filename       text not null,
  file_format             text not null default 'xlsx'
                            check (file_format in ('xlsx', 'csv')),
  storage_path            text,
  -- Empreinte du fichier : detecte le rechargement du meme fichier (idempotence).
  file_checksum           text,

  uploaded_by_profile_id  uuid references public.ise_profiles(id) on delete set null,

  -- Etapes du MASTER PROMPT §37, dans l'ordre, plus deux etats terminaux.
  status                  text not null default 'uploaded'
                            check (status in (
                              'uploaded', 'staged', 'mapping', 'validation',
                              'normalization', 'duplicate_detection', 'human_review',
                              'importing', 'reported', 'failed', 'cancelled')),

  -- Import pilote progressif (20 puis 50 puis complet).
  is_pilot                boolean not null default false,
  pilot_label             text,

  -- Compteurs alimentes par le traitement reel, jamais estimes (MASTER PROMPT §98).
  total_rows              integer not null default 0 check (total_rows >= 0),
  created_profiles        integer not null default 0 check (created_profiles >= 0),
  updated_profiles        integer not null default 0 check (updated_profiles >= 0),
  ignored_rows            integer not null default 0 check (ignored_rows >= 0),
  error_rows              integer not null default 0 check (error_rows >= 0),
  review_rows             integer not null default 0 check (review_rows >= 0),

  notes                   text,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  started_at              timestamptz,
  completed_at            timestamptz,

  constraint import_batches_pilot_label check (is_pilot = false or pilot_label is not null),
  constraint import_batches_completed_coherence check (
    (status in ('reported', 'failed', 'cancelled')) = (completed_at is not null)
  )
);

create index if not exists import_batches_status_idx     on private.import_batches(status);
create index if not exists import_batches_uploader_idx   on private.import_batches(uploaded_by_profile_id)
  where uploaded_by_profile_id is not null;
create index if not exists import_batches_created_cursor_idx
  on private.import_batches(created_at desc, id desc);
create unique index if not exists import_batches_checksum_uidx
  on private.import_batches(file_checksum)
  where file_checksum is not null and status <> 'cancelled';

select private.attach_updated_at('private', 'import_batches');

comment on table private.import_batches is
  'Lot d''import. Un import ne cree jamais de compte auth.users (MASTER PROMPT §6).';
comment on column private.import_batches.status is
  'Etapes obligatoires du MASTER PROMPT §37. Transitions verrouillees par private.transition_import_batch().';


-- Journal des franchissements d'etape : preuve que le workflow a ete suivi.
create table if not exists private.import_stage_events (
  id                bigint generated always as identity primary key,
  batch_id          uuid not null references private.import_batches(id) on delete cascade,
  from_status       text,
  to_status         text not null,
  actor_profile_id  uuid references public.ise_profiles(id) on delete set null,
  note              text,
  created_at        timestamptz not null default now()
);

create index if not exists import_stage_events_batch_idx
  on private.import_stage_events(batch_id, created_at);


-- ---------------------------------------------------------------------
-- 2. Mapping de colonnes (etape « mapping » du §37)
--    Le fichier source n'impose pas ses noms de colonnes : chaque colonne
--    est explicitement rattachee a un champ cible ou explicitement ignoree.
-- ---------------------------------------------------------------------
create table if not exists private.import_column_mappings (
  id                uuid primary key default extensions.gen_random_uuid(),
  batch_id          uuid not null references private.import_batches(id) on delete cascade,

  source_column     text not null,
  source_position   integer,

  -- Champs cibles issus de la feuille ISE_IMPORT (doc 23 §8-16).
  target_field      text check (target_field is null or target_field in (
                      'source_id', 'first_name', 'middle_names', 'last_name', 'display_name',
                      'promotion_year', 'email', 'phone', 'secondary_phone',
                      'country', 'city', 'current_position', 'organization', 'sector',
                      'linkedin_url', 'notes_source', 'last_known_update',
                      'source_name', 'source_date', 'import_comment')),

  -- Normalisation autorisee uniquement si elle est sans perte (MASTER PROMPT §37).
  transform         text not null default 'none'
                      check (transform in (
                        'none', 'trim', 'lower', 'upper', 'collapse_spaces',
                        'normalize_name', 'normalize_email', 'normalize_phone',
                        'parse_integer', 'parse_date')),

  is_ignored        boolean not null default false,
  notes             text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint import_column_mappings_target_or_ignored check (
    is_ignored = true or target_field is not null
  ),
  constraint import_column_mappings_unique_source unique (batch_id, source_column)
);

-- Un champ cible n'est alimente que par une seule colonne source.
create unique index if not exists import_column_mappings_target_uidx
  on private.import_column_mappings(batch_id, target_field)
  where target_field is not null and is_ignored = false;

select private.attach_updated_at('private', 'import_column_mappings');

comment on table private.import_column_mappings is
  'Mapping colonne source -> champ cible pour un lot. Toute colonne non mappee doit etre explicitement ignoree.';


-- ---------------------------------------------------------------------
-- 3. Lignes d'import (staging)
--    `raw_source_data` conserve la ligne d'origine telle quelle : le fichier
--    peut etre audite sans polluer les tables metier [17 §150-151].
-- ---------------------------------------------------------------------
create table if not exists private.import_rows (
  id                    bigint generated always as identity primary key,
  batch_id              uuid not null references private.import_batches(id) on delete cascade,
  row_number            integer not null check (row_number > 0),

  -- Identifiant de rapprochement fourni par la source (ex. SRC0001).
  -- Ce n'est PAS l'identite finale de la personne (doc 23 §141-142).
  source_id             text,

  -- Donnee brute d'origine, jamais ecrasee.
  raw_source_data       jsonb not null,
  -- Resultat de l'etape de normalisation. NULL tant que non normalisee.
  normalized_data       jsonb,
  -- Empreinte de la ligne brute : rejouer le meme fichier ne recree rien.
  row_hash              text,

  status                text not null default 'staged'
                          check (status in (
                            'staged', 'mapped', 'valid', 'invalid', 'normalized',
                            'needs_review', 'imported', 'ignored', 'skipped')),

  -- Decision humaine (doc 23 §40) : creer / fusionner / ignorer / examiner plus tard.
  decision              text not null default 'pending'
                          check (decision in ('pending', 'create_new', 'merge', 'ignore', 'review_later')),
  decided_by_profile_id uuid references public.ise_profiles(id) on delete set null,
  decided_at            timestamptz,

  -- Meilleur rapprochement propose par la detection de doublons.
  matched_profile_id    uuid references public.ise_profiles(id) on delete set null,
  match_score           numeric(6,2) check (match_score is null or match_score >= 0),
  match_class           text check (match_class is null or match_class in
                          ('probable_duplicate', 'to_examine', 'new')),

  -- Profil reellement cree ou mis a jour a l'issue de l'import.
  resulting_profile_id  uuid references public.ise_profiles(id) on delete set null,

  -- Code machine (D-102), la phrase francaise est produite cote application.
  error_code            text,
  error_detail          jsonb,

  processed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint import_rows_row_unique unique (batch_id, row_number),
  constraint import_rows_decision_traceable check (
    decision = 'pending' or (decided_by_profile_id is not null and decided_at is not null)
  ),
  constraint import_rows_imported_needs_profile check (
    status <> 'imported' or resulting_profile_id is not null
  ),
  constraint import_rows_merge_needs_target check (
    decision <> 'merge' or matched_profile_id is not null
  )
);

create index if not exists import_rows_batch_status_idx on private.import_rows(batch_id, status);
create index if not exists import_rows_source_id_idx    on private.import_rows(source_id)
  where source_id is not null;
create index if not exists import_rows_matched_idx      on private.import_rows(matched_profile_id)
  where matched_profile_id is not null;
create index if not exists import_rows_resulting_idx    on private.import_rows(resulting_profile_id)
  where resulting_profile_id is not null;
create index if not exists import_rows_review_idx       on private.import_rows(batch_id)
  where status = 'needs_review';
create unique index if not exists import_rows_hash_uidx
  on private.import_rows(batch_id, row_hash)
  where row_hash is not null;

select private.attach_updated_at('private', 'import_rows');

comment on table private.import_rows is
  'Ligne de staging. raw_source_data conserve la donnee d''origine ; aucun compte auth.users n''est cree.';
comment on column private.import_rows.raw_source_data is
  'Ligne brute du fichier source, conservee integralement pour audit. Jamais ecrasee.';
comment on column private.import_rows.source_id is
  'Identifiant de la source (SRC0001). Aide au rapprochement, ne vaut pas identite (doc 23 §141-142).';


-- ---------------------------------------------------------------------
-- 4. Detection de doublons
-- ---------------------------------------------------------------------

-- Bareme explicable, stocke en base pour etre recalibre apres le pilote
-- sans nouvelle migration (doc 23 §31-39 ; meme principe que D-71).
create table if not exists private.duplicate_match_rules (
  code          text primary key,
  label         text not null,
  weight        numeric(6,2) not null check (weight >= 0),
  description   text,
  is_active     boolean not null default true
);

insert into private.duplicate_match_rules (code, label, weight, description) values
  ('email_exact',        'Email identique',        45, 'Indice tres fort.'),
  ('phone_exact',        'Telephone identique',    40, 'Indice tres fort.'),
  ('name_close',         'Nom tres proche',        25, 'Comparaison sur la forme normalisee.'),
  ('promotion_exact',    'Promotion identique',    20, 'Indice fort mais jamais suffisant seul.'),
  ('organization_same',  'Organisation identique',  8, 'Indice faible a moyen.'),
  ('country_same',       'Pays identique',          5, 'Indice faible.')
on conflict (code) do nothing;

comment on table private.duplicate_match_rules is
  'Bareme de dedoublonnage. Le total peut depasser 100 : ce sont des indices cumules (doc 23 §31).';


create table if not exists private.duplicate_candidates (
  id                      uuid primary key default extensions.gen_random_uuid(),
  batch_id                uuid not null references private.import_batches(id) on delete cascade,
  import_row_id           bigint not null references private.import_rows(id) on delete cascade,
  existing_profile_id     uuid not null references public.ise_profiles(id) on delete cascade,

  score                   numeric(6,2) not null check (score >= 0),
  -- Detail des indices declenches : { "email_exact": true, "name_close": true, ... }
  signals                 jsonb not null default '{}'::jsonb,

  -- Seuils doc 23 : >= 80 probable ; 60-79 a examiner ; < 60 nouveau.
  match_class             text not null
                            check (match_class in ('probable_duplicate', 'to_examine', 'new')),

  status                  text not null default 'pending'
                            check (status in ('pending', 'confirmed_duplicate', 'not_duplicate', 'deferred')),

  reviewed_by_profile_id  uuid references public.ise_profiles(id) on delete set null,
  reviewed_at             timestamptz,
  review_note             text,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint duplicate_candidates_pair_unique unique (import_row_id, existing_profile_id),

  -- REGLE ABSOLUE : aucune fusion automatique. Un candidat ne bascule en
  -- doublon confirme (ou ecarte) qu'avec un reviseur humain identifie.
  constraint duplicate_candidates_human_review check (
    status in ('pending', 'deferred')
    or (reviewed_by_profile_id is not null and reviewed_at is not null)
  )
);

create index if not exists duplicate_candidates_batch_idx   on private.duplicate_candidates(batch_id, status);
create index if not exists duplicate_candidates_row_idx     on private.duplicate_candidates(import_row_id);
create index if not exists duplicate_candidates_profile_idx on private.duplicate_candidates(existing_profile_id);
create index if not exists duplicate_candidates_pending_idx on private.duplicate_candidates(batch_id, score desc)
  where status = 'pending';

select private.attach_updated_at('private', 'duplicate_candidates');

comment on table private.duplicate_candidates is
  'Candidats doublons soumis a revue humaine. Nom + promotion seuls ne fusionnent JAMAIS (doc 23 §39).';


-- Fusion champ par champ : ancienne valeur / nouvelle valeur / valeur retenue.
-- « Ne jamais simplement ecraser » (doc 23 §41).
create table if not exists private.merge_field_resolutions (
  id                      uuid primary key default extensions.gen_random_uuid(),
  duplicate_candidate_id  uuid not null references private.duplicate_candidates(id) on delete cascade,
  field_name              text not null,
  existing_value          text,
  incoming_value          text,
  retained_value          text,
  retained_source         text not null
                            check (retained_source in ('existing', 'incoming', 'manual', 'both_kept')),
  decided_by_profile_id   uuid references public.ise_profiles(id) on delete set null,
  decided_at              timestamptz not null default now(),
  constraint merge_field_resolutions_unique unique (duplicate_candidate_id, field_name)
);

create index if not exists merge_field_resolutions_candidate_idx
  on private.merge_field_resolutions(duplicate_candidate_id);

comment on table private.merge_field_resolutions is
  'Arbitrage champ par champ d''une fusion. Deux telephones legitimes peuvent etre conserves (both_kept).';


-- ---------------------------------------------------------------------
-- 5. Qualite des donnees
-- ---------------------------------------------------------------------
create table if not exists private.data_quality_issues (
  id                      bigint generated always as identity primary key,

  -- Une anomalie nait d'un import ou d'un controle sur un profil existant.
  batch_id                uuid references private.import_batches(id) on delete cascade,
  import_row_id           bigint references private.import_rows(id) on delete cascade,
  profile_id              uuid references public.ise_profiles(id) on delete cascade,

  -- Types d'erreur documentes (doc 23 §121) + controles de qualite profil.
  issue_code              text not null check (issue_code in (
                            'missing_required', 'invalid_promotion', 'invalid_email',
                            'invalid_phone', 'ambiguous_duplicate', 'organization_unresolved',
                            'sector_unresolved', 'skill_unresolved', 'country_unresolved',
                            'unverified_free_text', 'stale_data', 'inconsistent_dates')),
  severity                text not null default 'error'
                            check (severity in ('error', 'warning', 'info')),
  field_name              text,
  -- Code machine ; la phrase francaise est produite cote application (D-102).
  details                 jsonb not null default '{}'::jsonb,
  -- Action recommandee, code machine egalement (export Import_Errors_*.xlsx).
  recommended_action      text,

  status                  text not null default 'open'
                            check (status in ('open', 'resolved', 'ignored')),
  resolved_by_profile_id  uuid references public.ise_profiles(id) on delete set null,
  resolved_at             timestamptz,

  created_at              timestamptz not null default now(),

  constraint data_quality_issues_scope_required check (
    batch_id is not null or import_row_id is not null or profile_id is not null
  ),
  constraint data_quality_issues_closed_coherence check (
    (status = 'open') = (resolved_at is null)
  )
);

create index if not exists data_quality_issues_batch_idx   on private.data_quality_issues(batch_id, status)
  where batch_id is not null;
create index if not exists data_quality_issues_row_idx     on private.data_quality_issues(import_row_id)
  where import_row_id is not null;
create index if not exists data_quality_issues_profile_idx on private.data_quality_issues(profile_id)
  where profile_id is not null;
create index if not exists data_quality_issues_code_idx    on private.data_quality_issues(issue_code, severity)
  where status = 'open';

comment on table private.data_quality_issues is
  'Anomalies de qualite constatees a l''import ou sur un profil. issue_code est un code machine (D-102).';


-- File de revue des valeurs libres non resolues : organisation, secteur,
-- competence... « En cas d'incertitude, laisser non mappe plutot qu'inventer »
-- (doc 23 §117-120). Aucune creation automatique de referentiel.
create table if not exists private.import_value_reviews (
  id                      bigint generated always as identity primary key,
  batch_id                uuid not null references private.import_batches(id) on delete cascade,
  import_row_id           bigint references private.import_rows(id) on delete cascade,

  value_type              text not null check (value_type in (
                            'organization', 'sector', 'skill', 'country',
                            'job_function', 'language', 'availability_type')),
  raw_value               text not null,
  normalized_value        text,
  suggested_target_key    text,

  status                  text not null default 'pending'
                            check (status in ('pending', 'mapped', 'rejected')),
  mapped_target_key       text,
  reviewed_by_profile_id  uuid references public.ise_profiles(id) on delete set null,
  reviewed_at             timestamptz,

  created_at              timestamptz not null default now(),

  constraint import_value_reviews_mapped_needs_target check (
    status <> 'mapped' or mapped_target_key is not null
  ),
  constraint import_value_reviews_review_traceable check (
    status = 'pending' or (reviewed_by_profile_id is not null and reviewed_at is not null)
  )
);

create index if not exists import_value_reviews_batch_idx
  on private.import_value_reviews(batch_id, value_type, status);
create index if not exists import_value_reviews_value_idx
  on private.import_value_reviews(value_type, normalized_value);

comment on table private.import_value_reviews is
  'File de revue des chaines libres non resolues. Aucune competence ni organisation n''est creee automatiquement.';


-- ---------------------------------------------------------------------
-- 6. Rapports d'import (derniere etape du §37)
-- ---------------------------------------------------------------------
create table if not exists private.import_reports (
  id                      uuid primary key default extensions.gen_random_uuid(),
  batch_id                uuid not null references private.import_batches(id) on delete cascade,
  report_kind             text not null
                            check (report_kind in ('summary', 'errors', 'duplicates')),
  -- Totaux constates, recopies depuis les lignes reellement traitees.
  totals                  jsonb not null default '{}'::jsonb,
  -- Export eventuel (ex. Import_Errors_2026-08-07.xlsx).
  storage_path            text,
  generated_by_profile_id uuid references public.ise_profiles(id) on delete set null,
  generated_at            timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  constraint import_reports_kind_unique unique (batch_id, report_kind)
);

create index if not exists import_reports_batch_idx on private.import_reports(batch_id);

comment on table private.import_reports is
  'Rapport d''import. Les totaux proviennent des lignes reellement traitees (MASTER PROMPT §98).';


-- Avancement reel d'un lot, recalcule depuis import_rows.
-- Aucune progression estimee ou inventee (MASTER PROMPT §98).
create or replace view private.import_batch_progress as
select
  b.id                                                              as batch_id,
  b.status,
  count(r.id)                                                          as staged_rows,
  count(r.id) filter (where r.status = 'valid')                        as valid_rows,
  count(r.id) filter (where r.status = 'invalid')                      as invalid_rows,
  count(r.id) filter (where r.status = 'needs_review')                 as review_rows,
  count(r.id) filter (where r.status = 'imported')                     as imported_rows,
  count(r.id) filter (where r.status = 'ignored')                      as ignored_rows,
  count(r.id) filter (where r.decision = 'pending' and r.status = 'needs_review') as pending_decisions,
  max(r.processed_at)                                               as last_processed_at
from private.import_batches b
left join private.import_rows r on r.batch_id = b.id
group by b.id, b.status;

comment on view private.import_batch_progress is
  'Avancement calcule depuis les lignes reellement traitees. Jamais une estimation.';


-- ---------------------------------------------------------------------
-- 7. Transition d'etape verrouillee (MASTER PROMPT §37)
-- ---------------------------------------------------------------------
create or replace function private.transition_import_batch(
  p_batch_id  uuid,
  p_to_status text,
  p_note      text default null
)
returns private.import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me      uuid := private.current_profile_id();
  v_batch   private.import_batches;
  v_from    text;
  v_allowed boolean := false;
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not private.has_permission('imports.execute') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select * into v_batch from private.import_batches where id = p_batch_id for update;
  if not found then
    raise exception 'import_batch_not_found' using errcode = 'P0002';
  end if;

  v_from := v_batch.status;

  -- Sequence obligatoire ; aucune etape ne peut etre sautee.
  -- Un retour en arriere n'est autorise que vers l'etape de revue humaine.
  v_allowed := case
    when p_to_status = 'staged'              then v_from = 'uploaded'
    when p_to_status = 'mapping'             then v_from = 'staged'
    when p_to_status = 'validation'          then v_from = 'mapping'
    when p_to_status = 'normalization'       then v_from = 'validation'
    when p_to_status = 'duplicate_detection' then v_from = 'normalization'
    when p_to_status = 'human_review'        then v_from in ('duplicate_detection', 'importing')
    when p_to_status = 'importing'           then v_from = 'human_review'
    when p_to_status = 'reported'            then v_from = 'importing'
    when p_to_status = 'failed'              then v_from not in ('reported', 'failed', 'cancelled')
    when p_to_status = 'cancelled'           then v_from not in ('reported', 'failed', 'cancelled', 'importing')
    else false
  end;

  if not v_allowed then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  -- L'import ne demarre pas tant qu'un doublon reste sans decision humaine.
  if p_to_status = 'importing' then
    if exists (
      select 1 from private.duplicate_candidates
       where batch_id = p_batch_id and status in ('pending', 'deferred')
    ) then
      raise exception 'duplicate_review_pending' using errcode = 'P0001';
    end if;
  end if;

  update private.import_batches
     set status       = p_to_status,
         started_at   = case when p_to_status = 'staged' then coalesce(started_at, now()) else started_at end,
         completed_at = case
                          when p_to_status in ('reported', 'failed', 'cancelled') then now()
                          else null
                        end
   where id = p_batch_id
  returning * into v_batch;

  insert into private.import_stage_events (batch_id, from_status, to_status, actor_profile_id, note)
  values (p_batch_id, v_from, p_to_status, v_me, p_note);

  return v_batch;
end
$$;

revoke all on function private.transition_import_batch(uuid, text, text) from public;

comment on function private.transition_import_batch(uuid, text, text) is
  'Fait avancer un lot d''import dans l''ordre impose par le MASTER PROMPT §37. Bloque tant qu''un doublon attend une decision humaine.';
