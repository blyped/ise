-- =====================================================================
-- 0036_get_member_profile_field_list_fix
--
-- CORRECTIF issu de la suite supabase/tests/search/0002 : la suite a ete
-- ecrite AVANT d'etre jouee et a revele un defaut reel de 0035.
-- Conformement a la convention du depot (cf. 0028_rls_fixes.sql), la
-- migration 0035 n'est PAS modifiee : elle est deja appliquee, et une
-- migration appliquee ne se reecrit pas. Le correctif vit ici.
--
-- DEFAUT
--   Dans public.get_member_profile(), l'accumulation de la liste des
--   champs autorises etait ecrite :
--       v_fields := v_fields || 'headline';
--   PostgreSQL resout `anyarray || unknown` en `anyarray || anyarray` :
--   le litteral est interprete comme un LITTERAL DE TABLEAU, pas comme
--   un element. D'ou, au premier champ visible :
--       ERROR 22P02 malformed array literal: "headline"
--   La fonction echouait donc systematiquement des qu'un champ etait
--   autorise -- c'est-a-dire sur tout profil reellement consultable.
--   Le cas V02 de la suite l'a fait tomber au premier passage.
--
-- CORRECTIF
--   `array_append(v_fields, 'headline')`, qui n'est pas ambigu.
--   Aucune autre ligne n'est modifiee : meme controle d'acces, memes
--   champs, meme charge utile. Les assertions de la suite ne sont pas
--   assouplies.
-- =====================================================================

create or replace function public.get_member_profile(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_me      uuid;
  v_out     jsonb;
  v_fields  text[] := array[]::text[];
  v_row     record;
  v_n       integer;
begin
  if not private.is_active_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_profile_id is null then
    return null;
  end if;

  v_me := private.current_profile_id();

  -- Blocage, suppression, statut : une seule porte, celle de 0021.
  if not private.can_see_profile(p_profile_id) then
    return null;
  end if;

  select p.id,
         p.display_name,
         p.headline,
         p.bio,
         p.avatar_path,
         p.linkedin_url,
         p.website_url,
         p.current_position,
         p.current_organization_id,
         p.current_organization_raw,
         p.current_country_code,
         p.current_city,
         p.promotion_id,
         p.verification_status,
         p.profile_status,
         p.claim_status
    into v_row
  from public.ise_profiles p
  where p.id = p_profile_id
    and p.deleted_at is null
    and p.profile_status in ('referenced', 'active');

  if not found then
    return null;
  end if;

  -- ---- Socle : identite minimale d'un membre de l'annuaire ----------
  -- `full_name` n'admet pas le niveau `private` (referentiel 0025) :
  -- un profil visible porte toujours un nom.
  v_out := jsonb_build_object(
    'profile_id',          v_row.id,
    'display_name',        v_row.display_name,
    'verification_status', v_row.verification_status,
    'profile_status',      v_row.profile_status,
    'claim_status',        v_row.claim_status,
    'is_self',             (v_row.id = v_me)
  );

  -- ---- Champs scalaires, un par un ----------------------------------
  if private.field_is_visible(p_profile_id, 'headline') and v_row.headline is not null then
    v_out := v_out || jsonb_build_object('headline', v_row.headline);
    v_fields := array_append(v_fields, 'headline');
  end if;

  if private.field_is_visible(p_profile_id, 'bio') and v_row.bio is not null then
    v_out := v_out || jsonb_build_object('bio', v_row.bio);
    v_fields := array_append(v_fields, 'bio');
  end if;

  if private.field_is_visible(p_profile_id, 'photo') and v_row.avatar_path is not null then
    -- Chemin Storage uniquement : le bucket `avatars` est prive (0027),
    -- l'URL signee est emise cote serveur apres controle.
    v_out := v_out || jsonb_build_object('avatar_path', v_row.avatar_path);
    v_fields := array_append(v_fields, 'photo');
  end if;

  if private.field_is_visible(p_profile_id, 'current_position')
     and v_row.current_position is not null then
    v_out := v_out || jsonb_build_object('current_position', v_row.current_position);
    v_fields := array_append(v_fields, 'current_position');
  end if;

  if private.field_is_visible(p_profile_id, 'current_organization') then
    v_out := v_out || jsonb_build_object(
      'current_organization',
      coalesce(
        (select o.canonical_name from public.organizations o
          where o.id = v_row.current_organization_id),
        v_row.current_organization_raw));
    if v_out ->> 'current_organization' is null then
      v_out := v_out - 'current_organization';
    else
      v_fields := array_append(v_fields, 'current_organization');
    end if;
  end if;

  if private.field_is_visible(p_profile_id, 'country') and v_row.current_country_code is not null then
    v_out := v_out || jsonb_build_object(
      'current_country_code', v_row.current_country_code,
      'current_country',      (select c.name_fr from public.countries c
                                where c.code = v_row.current_country_code));
    v_fields := array_append(v_fields, 'country');
  end if;

  if private.field_is_visible(p_profile_id, 'city') and v_row.current_city is not null then
    v_out := v_out || jsonb_build_object('current_city', v_row.current_city);
    v_fields := array_append(v_fields, 'city');
  end if;

  if private.field_is_visible(p_profile_id, 'promotion') and v_row.promotion_id is not null then
    v_out := v_out || jsonb_build_object(
      'promotion',
      (select jsonb_build_object(
                'id',    pr.id,
                'name',  pr.name,
                'label', concat_ws(' ', pr.program_code, pr.graduation_year::text),
                'graduation_year', pr.graduation_year)
         from public.promotions pr where pr.id = v_row.promotion_id));
    v_fields := array_append(v_fields, 'promotion');
  end if;

  if private.field_is_visible(p_profile_id, 'linkedin_url') and v_row.linkedin_url is not null then
    v_out := v_out || jsonb_build_object('linkedin_url', v_row.linkedin_url);
    v_fields := array_append(v_fields, 'linkedin_url');
  end if;

  if private.field_is_visible(p_profile_id, 'website_url') and v_row.website_url is not null then
    v_out := v_out || jsonb_build_object('website_url', v_row.website_url);
    v_fields := array_append(v_fields, 'website_url');
  end if;

  -- ---- Collections --------------------------------------------------
  if private.field_is_visible(p_profile_id, 'skills') then
    v_out := v_out || jsonb_build_object('skills', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'name', s.name,
               -- Niveau DECLARATIF (D-75) : l'interface l'etiquette comme tel.
               'level', ps.level,
               'years_experience', ps.years_experience,
               'is_primary', ps.is_primary)
             order by ps.is_primary desc, s.name)
        from public.profile_skills ps
        join public.skills s on s.id = ps.skill_id
       where ps.profile_id = p_profile_id), '[]'::jsonb));
    v_fields := array_append(v_fields, 'skills');
  end if;

  -- Secteurs, fonctions et domaines d'expertise forment un seul bloc
  -- edite ensemble (ISE-024). Le referentiel de visibilite ne porte
  -- qu'une cle, `sectors` : elle les gouverne tous les trois.
  if private.field_is_visible(p_profile_id, 'sectors') then
    v_out := v_out || jsonb_build_object(
      'sectors', coalesce((
        select jsonb_agg(jsonb_build_object('id', sec.id, 'name', sec.name,
                                            'is_primary', x.is_primary)
               order by x.is_primary desc, sec.name)
          from public.profile_sectors x
          join public.sectors sec on sec.id = x.sector_id
         where x.profile_id = p_profile_id), '[]'::jsonb),
      'job_functions', coalesce((
        select jsonb_agg(jsonb_build_object('id', jf.id, 'name', jf.name) order by jf.name)
          from public.profile_functions x
          join public.job_functions jf on jf.id = x.job_function_id
         where x.profile_id = p_profile_id), '[]'::jsonb),
      'expertise_areas', coalesce((
        select jsonb_agg(jsonb_build_object('id', ea.id, 'name', ea.name) order by ea.name)
          from public.profile_expertise_areas x
          join public.expertise_areas ea on ea.id = x.expertise_area_id
         where x.profile_id = p_profile_id), '[]'::jsonb));
    v_fields := array_append(v_fields, 'sectors');
  end if;

  if private.field_is_visible(p_profile_id, 'languages') then
    v_out := v_out || jsonb_build_object('languages', coalesce((
      select jsonb_agg(jsonb_build_object(
               'code', l.code, 'name', l.name_fr, 'proficiency', pl.proficiency)
             order by l.sort_order, l.name_fr)
        from public.profile_languages pl
        join public.languages l on l.code = pl.language_code
       where pl.profile_id = p_profile_id), '[]'::jsonb));
    v_fields := array_append(v_fields, 'languages');
  end if;

  if private.field_is_visible(p_profile_id, 'tools') then
    v_out := v_out || jsonb_build_object('tools', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name,
                                          'proficiency', pt.proficiency)
             order by t.name)
        from public.profile_tools pt
        join public.tools t on t.id = pt.tool_id
       where pt.profile_id = p_profile_id), '[]'::jsonb));
    v_fields := array_append(v_fields, 'tools');
  end if;

  if private.field_is_visible(p_profile_id, 'experience_countries') then
    v_out := v_out || jsonb_build_object('experience_countries', coalesce((
      select jsonb_agg(jsonb_build_object('code', c.code, 'name', c.name_fr) order by c.name_fr)
        from public.profile_geographies g
        join public.countries c on c.code = g.country_code
       where g.profile_id = p_profile_id), '[]'::jsonb));
    v_fields := array_append(v_fields, 'experience_countries');
  end if;

  -- Experiences : DEUX niveaux de controle. Le bloc entier
  -- (`experiences`), puis la visibilite propre a chaque ligne -- c'est
  -- la colonne que porte la politique `experiences_select` de 0021.
  if private.field_is_visible(p_profile_id, 'experiences') then
    v_out := v_out || jsonb_build_object('experiences', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id,
               'position_title', e.position_title,
               'organization', coalesce(o.canonical_name, e.organization_name_raw),
               'sector', (select sec.name from public.sectors sec where sec.id = e.sector_id),
               'job_function', (select jf.name from public.job_functions jf
                                 where jf.id = e.job_function_id),
               'country', (select c.name_fr from public.countries c where c.code = e.country_code),
               'city', e.city,
               'start_date', e.start_date,
               'end_date', e.end_date,
               'is_current', e.is_current)
             order by e.is_current desc, e.start_date desc)
        from public.experiences e
        left join public.organizations o on o.id = e.organization_id
       where e.profile_id = p_profile_id
         and private.can_see_field(p_profile_id, e.visibility)), '[]'::jsonb));
    v_fields := array_append(v_fields, 'experiences');
  end if;

  if private.field_is_visible(p_profile_id, 'educations') then
    v_out := v_out || jsonb_build_object('educations', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', ed.id, 'institution', ed.institution, 'degree', ed.degree,
               'field_of_study', ed.field_of_study,
               'start_year', ed.start_year, 'end_year', ed.end_year)
             order by coalesce(ed.end_year, ed.start_year) desc nulls last)
        from public.educations ed
       where ed.profile_id = p_profile_id
         and private.can_see_field(p_profile_id, ed.visibility)), '[]'::jsonb));
    v_fields := array_append(v_fields, 'educations');
  end if;

  -- Disponibilites : seules les lignes ACTIVES et non expirees sont
  -- renvoyees (D22 §46 : une disponibilite expiree vaut indisponible).
  if private.field_is_visible(p_profile_id, 'availabilities') then
    v_out := v_out || jsonb_build_object('availabilities', coalesce((
      select jsonb_agg(jsonb_build_object(
               'code', avt.code, 'name', avt.name, 'description', avt.description,
               'preferred_channel', pa.preferred_channel)
             order by avt.sort_order, avt.name)
        from public.profile_availabilities pa
        join public.availability_types avt on avt.code = pa.availability_type
       where pa.profile_id = p_profile_id
         and pa.active
         and (pa.available_until is null or pa.available_until >= current_date)
         and private.can_see_field(p_profile_id, pa.visibility)), '[]'::jsonb));
    v_fields := array_append(v_fields, 'availabilities');
  end if;

  -- ---- Contexte relationnel (donnees reelles uniquement) ------------
  -- Aucun chemin d'introduction n'est calcule ici : ISE-044 n'est pas
  -- livre, et D-51 limite de toute facon l'exploration au degre 1.
  select count(*) into v_n
  from (
    select case when c.profile_a_id = v_me then c.profile_b_id else c.profile_a_id end as id
      from public.connections c
     where v_me in (c.profile_a_id, c.profile_b_id)
  ) mine
  join (
    select case when c.profile_a_id = p_profile_id then c.profile_b_id else c.profile_a_id end as id
      from public.connections c
     where p_profile_id in (c.profile_a_id, c.profile_b_id)
  ) theirs using (id)
  where mine.id <> v_me and mine.id <> p_profile_id;

  v_out := v_out || jsonb_build_object('relationship', jsonb_build_object(
    'is_connected',        (v_row.id <> v_me and private.is_connected_to(p_profile_id)),
    'shares_promotion',    (v_row.id <> v_me and private.shares_promotion_with(p_profile_id)),
    'shares_organization', (
       v_row.id <> v_me
       and v_row.current_organization_id is not null
       and v_row.current_organization_id = (
         select me.current_organization_id from public.ise_profiles me where me.id = v_me)),
    'shared_organization_name', (
       select o.canonical_name from public.organizations o
        where v_row.id <> v_me
          and o.id = v_row.current_organization_id
          and o.id = (select me.current_organization_id
                        from public.ise_profiles me where me.id = v_me)),
    'mutual_connection_count', coalesce(v_n, 0)
  ));

  return v_out || jsonb_build_object('visible_fields', to_jsonb(v_fields));
end
$fn$;

comment on function public.get_member_profile(uuid) is
  'ISE-037. Compose le profil d''un autre ISE EN BASE, champ par champ, selon la '
  'visibilite effective (profile_visibility puis profile_visibility_defaults). Un champ '
  'non autorise n''est pas recupere, donc jamais masque cote interface (MASTER PROMPT §47). '
  'Renvoie NULL si le profil est bloque, supprime, suspendu ou inexistant. '
  'N''expose jamais e-mail, telephone, adresse, date de naissance, CV ni score de completion. '
  'Corrige par 0036 : accumulation de `visible_fields` par array_append().';

revoke all on function public.get_member_profile(uuid) from public, anon;
grant execute on function public.get_member_profile(uuid) to authenticated;
