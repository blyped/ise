-- 0142_organizations_seed_from_profiles.sql
--
-- Reconciliation catch-up. The referential `organizations` table and the
-- backfill of `ise_profiles.current_organization_id` were seeded directly
-- against this Supabase project (schema_migrations shows applied versions
-- named 0140_organizations_seed_from_profiles and
-- 0140_organizations_seed_from_profiles_grants), but the corresponding SQL
-- files were never committed to supabase/migrations/ in the repository —
-- 0140 is a visible gap between 0139 and 0141 in source control. This
-- migration reproduces that seeding from scratch and is idempotent (guarded
-- by NOT EXISTS / current_organization_id IS NULL), so re-running it against
-- an already-seeded database changes nothing further.
--
-- FREE-TEXT SHAPE. `current_organization_raw` mixes two conventions: a bare
-- employer name ("BNETD"), and an "Organisation — Direction — Service" chain
-- where only the first segment names the employer ("BCEAO — Direction des
-- Opérations de Marché"). Only the segment before the FIRST " — " is treated
-- as the organization name; anything after it is an internal subdivision,
-- not a different employer, and is discarded before deduplication.
--
-- DEDUPLICATION RULE
-- One organization per DISTINCT value of `public.normalize_text()` applied
-- to that first segment — the SAME function the generated column
-- `organizations.normalized_name` already uses, so a candidate matches an
-- existing row exactly when the generated column would match it.
-- `normalize_text()` trims, lower-cases, strips accents, and collapses every
-- run of non a-z0-9 characters to one space. Two segments are merged ONLY
-- when BYTE-IDENTICAL after this normalization (casing/accents/punctuation/
-- spacing only). An acronym and its spelled-out form ("AFD" vs. "Agence
-- Française de Développement (AFD)") are NOT merged, even though a human
-- reader knows they are the same institution: expanding acronyms or matching
-- on partial overlap is exactly the kind of guess that can wrongly weld two
-- different organizations together, which this task explicitly forbids.
-- Any such near-duplicate is left as two rows for an administrator to merge
-- deliberately via `organizations.merged_into_id`.
--
-- A short EXACT-MATCH exclusion list filters out free-text answers that are
-- not employers at all ("Aucune", "Sans emploi", "R.A.S", "Au chômage et
-- Open to work", "INDÉPENDANT", ...) so those profiles keep
-- current_organization_id = NULL instead of being linked to a fake
-- "organization". Matching is exact on the normalized segment, never a
-- substring test — "Assistant Technique Coopération Allemande/Consultant
-- indépendant" has no " — " separator, so its whole (long) text is the
-- segment, which normalizes to something other than "independant" and is
-- therefore kept as a real organization.

begin;

-- Integrity net for the future: two different seeding runs (or a manually
-- created row) must not silently produce two organizations for the same
-- normalized name. Partial so a deliberately merged duplicate
-- (merged_into_id set) does not block re-creating the canonical row's name.
create unique index if not exists organizations_normalized_name_unique_idx
  on public.organizations (normalized_name)
  where merged_into_id is null;

with normalized as (
  select
    p.id as profile_id,
    btrim(split_part(p.current_organization_raw, ' — ', 1)) as segment,
    public.normalize_text(split_part(p.current_organization_raw, ' — ', 1)) as norm_name
  from public.ise_profiles p
  where p.deleted_at is null
    and p.current_organization_raw is not null
    and btrim(p.current_organization_raw) <> ''
),
excluded (norm_name) as (
  values
    ('aucune'), ('aucun'), ('aucun actuellement'),
    ('sans emploi'), ('sans emploi actuellement'),
    ('r a s'), ('au chomage et open to work'), ('chomage'), ('au chomage'),
    ('independant'), ('neant'), ('n a'), ('na'), ('sans objet'), ('rien'),
    ('sans activite'), ('en recherche d emploi'), ('open to work')
),
candidates as (
  select n.norm_name, min(n.segment) as canonical_name
  from normalized n
  where n.norm_name is not null
    and n.norm_name not in (select norm_name from excluded)
  group by n.norm_name
),
new_orgs as (
  insert into public.organizations (canonical_name, slug)
  select
    c.canonical_name,
    regexp_replace(c.norm_name, ' ', '-', 'g')
  from candidates c
  where not exists (
    select 1 from public.organizations o where o.normalized_name = c.norm_name
  )
  on conflict (slug) do nothing
  returning id
)
select count(*) from new_orgs;

-- Backfill: link every profile whose free-text employer (first segment)
-- matches an organization by normalized name and that isn't linked yet.
-- Profiles whose segment was excluded above (non-employer answers) stay
-- unlinked, exactly as before this migration.
with normalized as (
  select
    p.id as profile_id,
    public.normalize_text(split_part(p.current_organization_raw, ' — ', 1)) as norm_name
  from public.ise_profiles p
  where p.deleted_at is null
    and p.current_organization_raw is not null
    and btrim(p.current_organization_raw) <> ''
    and p.current_organization_id is null
)
update public.ise_profiles p
set current_organization_id = o.id,
    updated_at = now()
from normalized n
join public.organizations o on o.normalized_name = n.norm_name and o.merged_into_id is null
where p.id = n.profile_id
  and p.current_organization_id is null;

commit;
