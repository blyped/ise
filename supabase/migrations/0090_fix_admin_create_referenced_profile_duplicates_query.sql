-- 0090 : corrige admin_create_referenced_profile (0089) -- ORDER BY/LIMIT
-- utilises directement a cote d'un jsonb_agg() sans sous-requete, ce qui
-- provoquait une erreur 42803 ("must appear in the GROUP BY clause").
create or replace function public.admin_create_referenced_profile(
  p_first_name text,
  p_last_name text,
  p_promotion_id bigint default null,
  p_middle_names text default null,
  p_current_position text default null,
  p_current_organization_raw text default null,
  p_current_country_code text default null,
  p_current_city text default null,
  p_primary_email text default null,
  p_secondary_email text default null,
  p_phone_e164 text default null,
  p_secondary_phone_e164 text default null
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_candidates jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('profiles.edit') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if btrim(coalesce(p_first_name, '')) = '' or btrim(coalesce(p_last_name, '')) = '' then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_promotion_id is not null and not exists (select 1 from public.promotions where id = p_promotion_id) then
    raise exception 'promotion_not_found' using errcode = 'P0002';
  end if;

  insert into public.ise_profiles
    (promotion_id, first_name, middle_names, last_name,
     current_position, current_organization_raw, current_country_code, current_city,
     profile_type, profile_status, claim_status, verification_status, is_test_account)
  values
    (p_promotion_id, btrim(p_first_name), nullif(btrim(coalesce(p_middle_names,'')),''), btrim(p_last_name),
     nullif(btrim(coalesce(p_current_position,'')),''), nullif(btrim(coalesce(p_current_organization_raw,'')),''),
     p_current_country_code, nullif(btrim(coalesce(p_current_city,'')),''),
     'graduate', 'referenced', 'unclaimed', 'unverified', false)
  returning id into v_id;

  if coalesce(btrim(p_primary_email), '') <> '' or coalesce(btrim(p_secondary_email), '') <> ''
     or coalesce(btrim(p_phone_e164), '') <> '' or coalesce(btrim(p_secondary_phone_e164), '') <> '' then
    insert into private.profile_contacts (profile_id, primary_email, secondary_email, phone_e164, secondary_phone_e164)
    values (v_id, nullif(btrim(coalesce(p_primary_email,'')),''), nullif(btrim(coalesce(p_secondary_email,'')),''),
            nullif(btrim(coalesce(p_phone_e164,'')),''), nullif(btrim(coalesce(p_secondary_phone_e164,'')),''));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'profileId', c.id, 'displayName', c.display_name, 'score', c.score
    ) order by c.score desc), '[]'::jsonb)
  into v_candidates
  from (
    select p.id, p.display_name, s.score
    from public.ise_profiles p
    cross join lateral (select (private.score_profile_pair(v_id, p.id)->>'score')::numeric as score) s
    where p.id <> v_id and p.profile_status <> 'archived' and s.score >= 60
    order by s.score desc
    limit 5
  ) c;

  perform private.log_audit(p_action=>'admin.profile_created', p_object_type=>'ise_profile',
    p_object_id=>v_id::text, p_result=>'success',
    p_context=>jsonb_build_object('promotion_id', p_promotion_id));

  return jsonb_build_object('profile_id', v_id, 'potential_duplicates', v_candidates);
end;
$$;
