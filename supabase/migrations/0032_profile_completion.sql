-- =====================================================================
-- 0032_profile_completion
-- Calcul du score de completion de profil (D-71, D-72, ISE-031).
--
-- D-71 : AUCUNE ponderation codee en dur. Les 13 poids vivent dans
--        public.profile_completion_rules (seedes en 0025, total = 100).
--        Les CIBLES de complétude (« combien de competences pour que le
--        bloc soit plein ? ») etaient le dernier chiffre encore dans le
--        code : elles rejoignent la table via `target_count`, pour que le
--        back-office puisse recalibrer sans migration, exactement comme
--        les poids.
-- D-72 : le score et la liste des manques sont PRIVES. Le score ne se lit
--        que par public.my_profile_completion() (0028) ; la liste que par
--        public.my_profile_missing_items(), sans parametre : aucun tiers
--        n'est atteignable.
--
-- Aucune politique RLS n'est creee ni modifiee ici.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cibles de complétude, en base (prolongement de D-71)
-- ---------------------------------------------------------------------
alter table public.profile_completion_rules
  add column if not exists target_count smallint not null default 1;

do $mig$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profile_completion_rules_target_range'
      and conrelid = 'public.profile_completion_rules'::regclass
  ) then
    alter table public.profile_completion_rules
      add constraint profile_completion_rules_target_range
      check (target_count between 1 and 20);
  end if;
end
$mig$;

comment on column public.profile_completion_rules.target_count is
  'Nombre d''elements a fournir pour que le bloc compte pour 100 %. '
  'Recalibrable par le back-office sans migration (D-71).';

update public.profile_completion_rules r
set target_count = v.n
from (values
  ('identity', 4),              -- prenom, nom, promotion, pays de residence
  ('photo', 1),
  ('current_situation', 4),     -- poste, organisation, ville, secteur declare
  ('bio', 1),
  ('skills', 5),
  ('experiences', 3),
  ('education', 1),
  ('sectors', 2),
  ('experience_countries', 2),
  ('tools', 3),
  ('languages', 2),
  ('availability', 2),
  ('network_contribution', 1)
) as v(k, n)
where r.block_key = v.k and r.target_count is distinct from v.n::smallint;

-- ---------------------------------------------------------------------
-- 2. Etat brut des 13 blocs
--
-- Renvoie, pour chaque bloc, le NOMBRE d'elements fournis. La conversion
-- en taux se fait contre `target_count`, jamais contre une constante.
-- Fonction non SECURITY DEFINER : inlinable, et soumise a la RLS quand
-- elle est appelee hors d'un contexte definer.
-- ---------------------------------------------------------------------
create or replace function private.profile_completion_blocks(p_profile_id uuid)
returns table (block_key text, done numeric)
language sql
stable
set search_path = ''
as $fn$
  select 'identity'::text,
         ( (case when coalesce(btrim(p.first_name), '') <> '' then 1 else 0 end)
         + (case when coalesce(btrim(p.last_name), '')  <> '' then 1 else 0 end)
         + (case when p.promotion_id is not null then 1 else 0 end)
         + (case when p.current_country_code is not null then 1 else 0 end)
         )::numeric
  from public.ise_profiles p where p.id = p_profile_id
  union all
  select 'photo'::text,
         (case when coalesce(btrim(p.avatar_path), '') <> '' then 1 else 0 end)::numeric
  from public.ise_profiles p where p.id = p_profile_id
  union all
  select 'current_situation'::text,
         ( (case when coalesce(btrim(p.current_position), '') <> '' then 1 else 0 end)
         + (case when p.current_organization_id is not null
                   or coalesce(btrim(p.current_organization_raw), '') <> '' then 1 else 0 end)
         + (case when coalesce(btrim(p.current_city), '') <> '' then 1 else 0 end)
         + (case when exists (select 1 from public.profile_sectors x where x.profile_id = p.id)
                   or exists (select 1 from public.experiences e
                               where e.profile_id = p.id and e.is_current and e.sector_id is not null)
                 then 1 else 0 end)
         )::numeric
  from public.ise_profiles p where p.id = p_profile_id
  union all
  select 'bio'::text,
         (case when coalesce(btrim(p.bio), '') <> '' then 1 else 0 end)::numeric
  from public.ise_profiles p where p.id = p_profile_id
  union all
  select 'skills'::text,
         (select count(*) from public.profile_skills x where x.profile_id = p_profile_id)::numeric
  union all
  select 'experiences'::text,
         (select count(*) from public.experiences x where x.profile_id = p_profile_id)::numeric
  union all
  select 'education'::text,
         (select count(*) from public.educations x where x.profile_id = p_profile_id)::numeric
  union all
  select 'sectors'::text,
         (select count(*) from public.profile_sectors x where x.profile_id = p_profile_id)::numeric
  union all
  select 'experience_countries'::text,
         (select count(*) from (
            select g.country_code from public.profile_geographies g where g.profile_id = p_profile_id
            union
            select e.country_code from public.experiences e
             where e.profile_id = p_profile_id and e.country_code is not null
          ) t)::numeric
  union all
  select 'tools'::text,
         (select count(*) from public.profile_tools x where x.profile_id = p_profile_id)::numeric
  union all
  select 'languages'::text,
         (select count(*) from public.profile_languages x where x.profile_id = p_profile_id)::numeric
  union all
  select 'availability'::text,
         (select count(*) from public.profile_availabilities x
           where x.profile_id = p_profile_id and x.active)::numeric
  union all
  select 'network_contribution'::text,
         (select case when exists (
            select 1 from public.profile_availabilities a
             where a.profile_id = p_profile_id and a.active
               and coalesce(btrim(a.notes), '') <> ''
          ) then 1 else 0 end)::numeric;
$fn$;

comment on function private.profile_completion_blocks(uuid) is
  'Nombre d''elements fournis par bloc de profil. Base commune de '
  'public.calculate_profile_completion() et public.my_profile_missing_items().';

revoke all on function private.profile_completion_blocks(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Score de completion
--
-- score = 100 * somme(poids x taux) / somme(poids actifs).
-- La normalisation par la somme des poids ACTIFS evite qu'une regle
-- desactivee par le back-office ne plafonne mecaniquement le score.
-- ---------------------------------------------------------------------
create or replace function public.calculate_profile_completion(p_profile_id uuid)
returns smallint
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(
    round(
      sum(r.weight * least(1::numeric, b.done / greatest(r.target_count, 1)))
      / nullif(sum(r.weight), 0) * 100
    ), 0)::smallint
  from public.profile_completion_rules r
  join private.profile_completion_blocks(p_profile_id) b on b.block_key = r.block_key
  where r.is_active;
$fn$;

comment on function public.calculate_profile_completion(uuid) is
  'Score de completion 0-100. Ponderations lues dans public.profile_completion_rules (D-71). '
  'NON exposee a authenticated : elle prend un profil en parametre, ce qui violerait D-72. '
  'Le membre lit son propre score par public.my_profile_completion().';

revoke all on function public.calculate_profile_completion(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Trigger de mise a jour
--
-- SECURITY DEFINER obligatoire : 0028 a retire a `authenticated` le
-- privilege de colonne UPDATE sur ise_profiles.profile_completion.
-- La recursion s'arrete d'elle-meme : le trigger sur ise_profiles est
-- declare `after update of <colonnes de contenu>`, et l'UPDATE interne
-- ne touche que `profile_completion`, absente de cette liste.
-- ---------------------------------------------------------------------
create or replace function private.recalc_profile_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_col   text := coalesce(tg_argv[0], 'profile_id');
  v_rec   jsonb;
  v_id    uuid;
  v_score smallint;
begin
  if tg_op = 'DELETE' then v_rec := to_jsonb(old); else v_rec := to_jsonb(new); end if;
  v_id := nullif(v_rec ->> v_col, '')::uuid;
  if v_id is null then
    return null;
  end if;
  if not exists (select 1 from public.ise_profiles p where p.id = v_id) then
    return null;
  end if;

  v_score := public.calculate_profile_completion(v_id);
  update public.ise_profiles p
     set profile_completion = v_score
   where p.id = v_id
     and p.profile_completion is distinct from v_score;
  return null;
end
$fn$;

comment on function private.recalc_profile_completion() is
  'Recalcule ise_profiles.profile_completion apres modification d''une section de profil.';

revoke all on function private.recalc_profile_completion() from public, anon, authenticated;

do $mig$
declare
  v_tables text[] := array[
    'profile_skills', 'experiences', 'educations', 'profile_sectors',
    'profile_geographies', 'profile_tools', 'profile_languages',
    'profile_availabilities'
  ];
  v_t text;
begin
  foreach v_t in array v_tables loop
    execute format('drop trigger if exists %I on public.%I', 'trg_completion_' || v_t, v_t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I '
      'for each row execute function private.recalc_profile_completion(%L)',
      'trg_completion_' || v_t, v_t, 'profile_id');
  end loop;
end
$mig$;

drop trigger if exists trg_completion_ise_profiles on public.ise_profiles;
create trigger trg_completion_ise_profiles
after insert or update of
  first_name, last_name, promotion_id, current_country_code,
  current_position, current_organization_id, current_organization_raw,
  current_city, avatar_path, bio
on public.ise_profiles
for each row execute function private.recalc_profile_completion('id');

-- ---------------------------------------------------------------------
-- 5. ISE-031 « Elements manquants »
--
-- Aucun parametre : la fonction ne peut renvoyer que les manques du
-- membre courant (D-72). Elle ne renvoie pas le score global : celui-ci
-- reste accessible par public.my_profile_completion().
-- ---------------------------------------------------------------------
create or replace function public.my_profile_missing_items()
returns table (
  block_key        text,
  label            text,
  hint             text,
  weight           smallint,
  sort_order       integer,
  completion_ratio numeric
)
language sql
stable
security definer
set search_path = ''
as $fn$
  select
    r.block_key,
    r.label,
    r.hint,
    r.weight,
    r.sort_order,
    round(least(1::numeric, b.done / greatest(r.target_count, 1)), 2)
  from public.profile_completion_rules r
  join private.profile_completion_blocks(private.current_profile_id()) b
    on b.block_key = r.block_key
  where r.is_active
    and private.current_profile_id() is not null
    and least(1::numeric, b.done / greatest(r.target_count, 1)) < 1
  order by r.sort_order, r.block_key;
$fn$;

comment on function public.my_profile_missing_items() is
  'Blocs de profil incomplets du membre courant (ISE-031). Sans parametre : aucun tiers '
  'atteignable (D-72). Ne renvoie jamais de score global.';

revoke all on function public.my_profile_missing_items() from public, anon;
grant execute on function public.my_profile_missing_items() to authenticated;

-- ---------------------------------------------------------------------
-- 6. Recalcul initial de l'existant
-- ---------------------------------------------------------------------
update public.ise_profiles p
   set profile_completion = public.calculate_profile_completion(p.id)
 where p.deleted_at is null
   and p.profile_completion is distinct from public.calculate_profile_completion(p.id);
