-- =====================================================================
-- 0001_foundation
-- Extensions, schemas, conventions transverses, helpers.
-- Reference : MASTER PROMPT §5, §9, §21, §67, §72 ; docs/decisions.md D-13..D-17, D-101.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------
create extension if not exists pg_trgm      with schema extensions;
create extension if not exists unaccent     with schema extensions;
create extension if not exists btree_gin    with schema extensions;
create extension if not exists btree_gist   with schema extensions;
create extension if not exists pgcrypto     with schema extensions;
create extension if not exists citext       with schema extensions;

-- ---------------------------------------------------------------------
-- 2. Schemas
--    public    : donnees metier exposees via la Data API, RLS active partout
--    private   : donnees sensibles + RBAC + imports bruts, JAMAIS exposees
--    analytics : agregats et vues materialisees, JAMAIS exposees directement
--    D-16
-- ---------------------------------------------------------------------
create schema if not exists private;
create schema if not exists analytics;

comment on schema private   is 'Donnees sensibles et RBAC. Non expose a la Data API. Aucun GRANT a anon/authenticated.';
comment on schema analytics is 'Agregats et vues materialisees. Non expose a la Data API.';

revoke all on schema private   from anon, authenticated;
revoke all on schema analytics from anon, authenticated;

alter default privileges in schema private
  revoke all on tables from anon, authenticated;
alter default privileges in schema analytics
  revoke all on tables from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Normalisation textuelle
--    unaccent() n'est pas IMMUTABLE : on l'enveloppe pour pouvoir
--    l'utiliser dans des index et des colonnes generees. MASTER PROMPT §21.
-- ---------------------------------------------------------------------
create or replace function public.f_unaccent(txt text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, txt)
$$;

comment on function public.f_unaccent(text) is
  'Wrapper IMMUTABLE de unaccent(), indispensable pour les index d''expression.';

-- Forme canonique utilisee pour la recherche, le dedoublonnage et les alias :
-- minuscules, sans accents, ponctuation reduite a des espaces, espaces normalises.
create or replace function public.normalize_text(txt text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select nullif(
    btrim(
      regexp_replace(
        lower(public.f_unaccent(coalesce(txt, ''))),
        '[^a-z0-9]+', ' ', 'g'
      )
    ),
    ''
  )
$$;

comment on function public.normalize_text(text) is
  'Forme canonique : minuscules, sans accents, sans ponctuation. Sert a la recherche, aux alias et au dedoublonnage.';

create or replace function public.slugify(txt text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select nullif(
    regexp_replace(
      btrim(coalesce(public.normalize_text(txt), '')),
      '\s+', '-', 'g'
    ),
    ''
  )
$$;

-- Configuration de recherche plein texte francaise sans accents. D-45.
do $$
begin
  if not exists (
    select 1 from pg_ts_config c
    join pg_namespace n on n.oid = c.cfgnamespace
    where c.cfgname = 'french_unaccent' and n.nspname = 'public'
  ) then
    create text search configuration public.french_unaccent ( copy = pg_catalog.french );
    alter text search configuration public.french_unaccent
      alter mapping for hword, hword_part, word
      with extensions.unaccent, french_stem;
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 4. Trigger transverse updated_at  (D-14)
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- Applique le trigger set_updated_at a une table donnee.
create or replace function private.attach_updated_at(p_schema text, p_table text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_trigger text := 'set_updated_at_' || p_table;
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = p_schema and c.relname = p_table and t.tgname = v_trigger
  ) then
    execute format(
      'create trigger %I before update on %I.%I for each row execute function public.set_updated_at()',
      v_trigger, p_schema, p_table
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 5. Domaines de valeurs transverses
--    D-13 : text + CHECK plutot que ENUM PostgreSQL.
--    Ces fonctions centralisent les listes reutilisees par plusieurs tables.
-- ---------------------------------------------------------------------

-- Echelle de visibilite unifiee a 4 niveaux. D-73.
create or replace function public.is_visibility_level(v text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select v in ('private', 'connections', 'promotion', 'members')
$$;

comment on function public.is_visibility_level(text) is
  'Echelle de visibilite unifiee (D-73) : private < connections < promotion < members. Aucun niveau public en V1.';

-- ---------------------------------------------------------------------
-- 6. Correlation ID pour la tracabilite des erreurs. MASTER PROMPT §43, D-102.
-- ---------------------------------------------------------------------
create or replace function public.new_correlation_id()
returns text
language sql
volatile
set search_path = ''
as $$
  select encode(extensions.gen_random_bytes(8), 'hex')
$$;
