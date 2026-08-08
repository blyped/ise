-- 0036_education_fields
-- Applique le 2026-08-08 (version 20260808053200)
-- Ne pas editer : creer une nouvelle migration.
-- =====================================================================
-- 0036_education_fields
--
-- ISE-021 « Ajouter / modifier une formation » demande trois donnees que
-- `public.educations` (0005) ne pouvait pas porter :
--   · le TYPE de formation (diplome academique / certification
--     professionnelle) — c'est le premier choix de la maquette ;
--   · la VILLE, a cote du pays ;
--   · le LIEN de verification du justificatif.
--
-- Sans elles, l'ecran aurait affiche des champs sans destination, ce que
-- le MASTER PROMPT §113 interdit. Les colonnes sont donc ajoutees ici,
-- toutes nullables sauf `education_type` qui recoit une valeur par
-- defaut : aucune ligne existante n'est invalidee.
--
-- Aucune politique RLS n'est creee ni modifiee : `educations_select` et
-- `educations_write_own` (0021) couvrent deja la table, colonnes
-- comprises — la RLS filtre des LIGNES.
-- =====================================================================

alter table public.educations
  add column if not exists education_type text not null default 'academic',
  add column if not exists city           text,
  add column if not exists credential_url text;

do $mig$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'educations_type_allowed'
      and conrelid = 'public.educations'::regclass
  ) then
    alter table public.educations
      add constraint educations_type_allowed
      check (education_type in ('academic', 'certification'));
  end if;
end
$mig$;

comment on column public.educations.education_type is
  'ISE-021 — diplome academique ou certification professionnelle.';
comment on column public.educations.credential_url is
  'Lien de verification fourni PAR LE MEMBRE. Aucune validation automatique n''en est deduite (MASTER PROMPT §18, D-75) : la formation reste declarative.';

-- `authenticated` a le privilege au niveau TABLE sur `educations` (et non
-- par colonne comme sur `ise_profiles`) : les colonnes ajoutees heritent
-- du privilege existant. Aucun GRANT supplementaire n'est necessaire, et
-- le controle ci-dessous le verifie plutot que de le supposer.
do $mig$
declare
  v_missing text;
begin
  select string_agg(c.column_name, ', ')
    into v_missing
    from information_schema.columns c
   where c.table_schema = 'public'
     and c.table_name   = 'educations'
     and c.column_name in ('education_type', 'city', 'credential_url')
     and not exists (
       select 1 from information_schema.column_privileges g
        where g.table_schema = 'public'
          and g.table_name   = 'educations'
          and g.column_name  = c.column_name
          and g.grantee      = 'authenticated'
          and g.privilege_type = 'UPDATE'
     );
  if v_missing is not null then
    raise exception 'colonnes non accordees a authenticated : %', v_missing;
  end if;
end
$mig$;

-- Ligne de base de securite : l'ajout de colonnes ne doit rien exposer.
do $mig$
declare
  v_n bigint;
begin
  select count(*) into v_n from private.security_baseline_violations();
  if v_n <> 0 then
    raise exception 'security_baseline_violations: % ligne(s)', v_n;
  end if;
end
$mig$;
