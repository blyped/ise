-- 0089_admin_profiles_dedup_creation.sql
--
-- SA-005 (fusion de doublons) et SA-007 (creation de profil reference),
-- dernieres pieces du coeur Superadmin (docs/implementation-status.md).
--
-- Perimetre volontairement borne (docs/decisions.md, decision C-08) :
-- la fusion ne deplace AUCUNE donnee relationnelle (candidatures, appels,
-- messages...). Elle n'est possible que si le profil ABSORBE est encore
-- 'unclaimed' -- donc, par construction, sans activite propre a deplacer.
-- Un doublon entre deux comptes RECLAMES est un cas d'usurpation/erreur
-- d'identite qui echappe a cet outil et doit etre traite au cas par cas.
--
-- Reutilise le bareme existant private.duplicate_match_rules (migration
-- 0017, doc 23 Section31-39), deja concu comme generique et recalibrable
-- sans migration -- ce module ne le duplique pas, il l'applique a des
-- paires de profils EXISTANTS plutot qu'a des lignes d'import.

-- ---------------------------------------------------------------------
-- 1. Tracabilite de la fusion + exclusions "pas un doublon"
-- ---------------------------------------------------------------------
alter table public.ise_profiles
  add column if not exists merged_into_profile_id uuid references public.ise_profiles(id) on delete set null;

comment on column public.ise_profiles.merged_into_profile_id is
  'SA-005. Renseigne quand ce profil a ete archive par fusion. Pointe vers le profil conserve.';

create table if not exists private.profile_duplicate_dismissals (
  profile_id_a  uuid not null references public.ise_profiles(id) on delete cascade,
  profile_id_b  uuid not null references public.ise_profiles(id) on delete cascade,
  dismissed_by  uuid references public.ise_profiles(id) on delete set null,
  dismissed_at  timestamptz not null default now(),
  reason        text not null check (length(btrim(reason)) >= 10),
  constraint profile_duplicate_dismissals_pk primary key (profile_id_a, profile_id_b),
  constraint profile_duplicate_dismissals_order check (profile_id_a < profile_id_b)
);

comment on table private.profile_duplicate_dismissals is
  'SA-005. Paires ecartees explicitement par un moderateur ("pas un doublon"). Empeche de les reproposer.';

-- ---------------------------------------------------------------------
-- 2. Detection : score d'une paire de profils existants
-- ---------------------------------------------------------------------
create or replace function private.score_profile_pair(p_a uuid, p_b uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'score', coalesce(sum(r.weight), 0),
    'signals', coalesce(jsonb_object_agg(r.code, true) filter (where r.code is not null), '{}'::jsonb)
  )
  from (select code, weight from private.duplicate_match_rules where is_active) r
  cross join lateral (
    select
      a.normalized_name as name_a, a.promotion_id as promo_a, a.current_country_code as country_a,
      public.normalize_text(a.current_organization_raw) as org_a,
      ca.primary_email_norm as email_a, ca.phone_e164 as phone_a
    from public.ise_profiles a
    left join private.profile_contacts ca on ca.profile_id = a.id
    where a.id = p_a
  ) pa
  cross join lateral (
    select
      b.normalized_name as name_b, b.promotion_id as promo_b, b.current_country_code as country_b,
      public.normalize_text(b.current_organization_raw) as org_b,
      cb.primary_email_norm as email_b, cb.phone_e164 as phone_b
    from public.ise_profiles b
    left join private.profile_contacts cb on cb.profile_id = b.id
    where b.id = p_b
  ) pb
  where
    (r.code = 'email_exact' and pa.email_a is not null and pa.email_a = pb.email_b)
    or (r.code = 'phone_exact' and pa.phone_a is not null and pa.phone_a = pb.phone_b)
    or (r.code = 'name_close' and pa.name_a is not null and pb.name_b is not null
        and extensions.similarity(pa.name_a, pb.name_b) >= 0.6)
    or (r.code = 'promotion_exact' and pa.promo_a is not null and pa.promo_a = pb.promo_b)
    or (r.code = 'organization_same' and pa.org_a is not null and pa.org_a = pb.org_b)
    or (r.code = 'country_same' and pa.country_a is not null and pa.country_a = pb.country_b)
$$;

comment on function private.score_profile_pair(uuid, uuid) is
  'SA-005. Score de similarite entre deux profils existants, meme bareme que private.duplicate_match_rules (0017).';

-- ---------------------------------------------------------------------
-- 3. SA-005 : liste des paires probablement en doublon
-- ---------------------------------------------------------------------
create or replace function public.admin_list_duplicate_candidates(
  p_cursor text default null,
  p_limit integer default 25
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  v_cur_score numeric; v_cur_a uuid; v_cur_b uuid;
  v_rows jsonb; v_next text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('profiles.moderate') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_cursor is not null then
    begin
      v_cur_score := split_part(p_cursor, '|', 1)::numeric;
      v_cur_a := split_part(p_cursor, '|', 2)::uuid;
      v_cur_b := split_part(p_cursor, '|', 3)::uuid;
    exception when others then
      raise exception 'validation_failed' using errcode = 'P0001';
    end;
  end if;

  with pairs as (
    select distinct least(a.id, b.id) as profile_id_a, greatest(a.id, b.id) as profile_id_b
    from public.ise_profiles a
    join public.ise_profiles b
      on a.id <> b.id
     and a.normalized_name operator(extensions.%) b.normalized_name
    where a.profile_status <> 'archived' and b.profile_status <> 'archived'
    union
    select distinct least(a.id, b.id), greatest(a.id, b.id)
    from private.profile_contacts ca
    join private.profile_contacts cb
      on ca.profile_id <> cb.profile_id
     and ca.primary_email_norm is not null
     and ca.primary_email_norm = cb.primary_email_norm
    join public.ise_profiles a on a.id = ca.profile_id and a.profile_status <> 'archived'
    join public.ise_profiles b on b.id = cb.profile_id and b.profile_status <> 'archived'
  ),
  scored as (
    select
      p.profile_id_a, p.profile_id_b,
      (private.score_profile_pair(p.profile_id_a, p.profile_id_b)->>'score')::numeric as score,
      private.score_profile_pair(p.profile_id_a, p.profile_id_b)->'signals' as signals
    from pairs p
    where not exists (
      select 1 from private.profile_duplicate_dismissals d
      where d.profile_id_a = p.profile_id_a and d.profile_id_b = p.profile_id_b
    )
  ),
  ranked as (
    select s.*, row_number() over (order by s.score desc, s.profile_id_a, s.profile_id_b) as rn
    from scored s
    where s.score >= 60
      and (v_cur_score is null or (s.score, s.profile_id_a, s.profile_id_b) < (v_cur_score, v_cur_a, v_cur_b))
  ),
  page as (
    select * from ranked order by score desc, profile_id_a, profile_id_b limit v_limit
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'profileIdA', pg.profile_id_a, 'profileIdB', pg.profile_id_b,
      'score', pg.score, 'signals', pg.signals,
      'profileA', jsonb_build_object(
        'profileId', pa.id, 'displayName', pa.display_name, 'profileStatus', pa.profile_status,
        'claimStatus', pa.claim_status, 'currentPosition', pa.current_position,
        'organization', pa.current_organization_raw, 'city', pa.current_city
      ),
      'profileB', jsonb_build_object(
        'profileId', pb.id, 'displayName', pb.display_name, 'profileStatus', pb.profile_status,
        'claimStatus', pb.claim_status, 'currentPosition', pb.current_position,
        'organization', pb.current_organization_raw, 'city', pb.current_city
      )
    ) order by pg.score desc, pg.profile_id_a, pg.profile_id_b), '[]'::jsonb),
    max(pg.score::text || '|' || pg.profile_id_a::text || '|' || pg.profile_id_b::text) filter (where pg.rn = v_limit)
  into v_rows, v_next
  from page pg
  join public.ise_profiles pa on pa.id = pg.profile_id_a
  join public.ise_profiles pb on pb.id = pg.profile_id_b;

  return jsonb_build_object('rows', v_rows, 'next_cursor', v_next);
end;
$$;

revoke all on function public.admin_list_duplicate_candidates(text, integer) from public, anon;
grant execute on function public.admin_list_duplicate_candidates(text, integer) to authenticated;

comment on function public.admin_list_duplicate_candidates(text, integer) is
  'SA-005. Paires de profils probablement en doublon (score >= 60, bareme private.duplicate_match_rules). Exige profiles.moderate.';

-- ---------------------------------------------------------------------
-- 4. SA-005 : ecarter une paire ("pas un doublon")
-- ---------------------------------------------------------------------
create or replace function public.admin_dismiss_duplicate_candidate(
  p_profile_id_a uuid,
  p_profile_id_b uuid,
  p_reason text
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_a uuid := least(p_profile_id_a, p_profile_id_b);
  v_b uuid := greatest(p_profile_id_a, p_profile_id_b);
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('profiles.moderate') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  if v_a = v_b then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  insert into private.profile_duplicate_dismissals (profile_id_a, profile_id_b, dismissed_by, reason)
  values (v_a, v_b, v_me, btrim(p_reason))
  on conflict (profile_id_a, profile_id_b)
  do update set reason = excluded.reason, dismissed_by = excluded.dismissed_by, dismissed_at = now();

  perform private.log_audit(p_action=>'admin.duplicate_dismissed', p_object_type=>'ise_profile',
    p_object_id=>v_a::text, p_result=>'success',
    p_context=>jsonb_build_object('profile_id_b', v_b, 'reason', btrim(p_reason)));

  return jsonb_build_object('profile_id_a', v_a, 'profile_id_b', v_b);
end;
$$;

revoke all on function public.admin_dismiss_duplicate_candidate(uuid, uuid, text) from public, anon;
grant execute on function public.admin_dismiss_duplicate_candidate(uuid, uuid, text) to authenticated;

comment on function public.admin_dismiss_duplicate_candidate(uuid, uuid, text) is
  'SA-005. Ecarte une paire proposee comme doublon ("pas un doublon"), motive. Exige profiles.moderate.';

-- ---------------------------------------------------------------------
-- 5. SA-005 : fusion effective (perimetre borne, cf. en-tete)
-- ---------------------------------------------------------------------
create or replace function public.admin_merge_profiles(
  p_keep_profile_id uuid,
  p_merge_profile_id uuid,
  p_reason text
) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_keep public.ise_profiles;
  v_merge public.ise_profiles;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('profiles.moderate') then
    perform private.log_audit(p_action=>'admin.profiles_merged', p_object_type=>'ise_profile',
      p_object_id=>p_merge_profile_id::text, p_result=>'denied', p_error_code=>'42501');
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_keep_profile_id = p_merge_profile_id then
    raise exception 'cannot_merge_self' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select * into v_keep from public.ise_profiles
    where id = p_keep_profile_id and profile_status <> 'archived' for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;

  select * into v_merge from public.ise_profiles
    where id = p_merge_profile_id and profile_status <> 'archived' for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;

  if v_merge.claim_status <> 'unclaimed' then
    raise exception 'cannot_merge_claimed_profile' using errcode = 'P0001';
  end if;

  -- Comble les trous du profil conserve avec les coordonnees du profil
  -- absorbe, sans jamais ecraser une valeur deja renseignee (doc 23 Section41).
  update private.profile_contacts k
  set
    primary_email = coalesce(k.primary_email, m.primary_email),
    secondary_email = coalesce(k.secondary_email, m.secondary_email),
    phone_e164 = coalesce(k.phone_e164, m.phone_e164),
    secondary_phone_e164 = coalesce(k.secondary_phone_e164, m.secondary_phone_e164),
    postal_address = coalesce(k.postal_address, m.postal_address),
    birth_date = coalesce(k.birth_date, m.birth_date)
  from private.profile_contacts m
  where k.profile_id = p_keep_profile_id and m.profile_id = p_merge_profile_id;

  -- Si le profil conserve n'avait aucune ligne de contact, reprend
  -- directement celle du profil absorbe plutot que de la perdre.
  update private.profile_contacts
  set profile_id = p_keep_profile_id
  where profile_id = p_merge_profile_id
    and not exists (select 1 from private.profile_contacts where profile_id = p_keep_profile_id);

  delete from private.profile_contacts where profile_id = p_merge_profile_id;

  update public.ise_profiles
  set profile_status = 'archived', merged_into_profile_id = p_keep_profile_id
  where id = p_merge_profile_id;

  insert into private.admin_profile_notes (profile_id, author_profile_id, body)
  values (
    p_keep_profile_id, v_me,
    format('Fusion : profil %s archive et fusionne ici. Motif : %s', p_merge_profile_id, btrim(p_reason))
  );

  perform private.log_audit(p_action=>'admin.profiles_merged', p_object_type=>'ise_profile',
    p_object_id=>p_merge_profile_id::text, p_result=>'success',
    p_context=>jsonb_build_object('kept_profile_id', p_keep_profile_id, 'reason', btrim(p_reason)));

  return jsonb_build_object('kept_profile_id', p_keep_profile_id, 'merged_profile_id', p_merge_profile_id);
end;
$$;

revoke all on function public.admin_merge_profiles(uuid, uuid, text) from public, anon;
grant execute on function public.admin_merge_profiles(uuid, uuid, text) to authenticated;

comment on function public.admin_merge_profiles(uuid, uuid, text) is
  'SA-005. Fusionne deux profils : archive le profil absorbe (doit etre unclaimed), transfere ses coordonnees manquantes, journalise. Exige profiles.moderate.';

-- ---------------------------------------------------------------------
-- 6. SA-007 : creation d'un profil reference (precedent : decision C-06)
-- ---------------------------------------------------------------------
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

  -- Avertissement non bloquant : jamais de blocage automatique de
  -- creation, seul un humain confirme un doublon (SA-005).
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

revoke all on function public.admin_create_referenced_profile(text, text, bigint, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_create_referenced_profile(text, text, bigint, text, text, text, text, text, text, text, text, text) to authenticated;

comment on function public.admin_create_referenced_profile(text, text, bigint, text, text, text, text, text, text, text, text, text) is
  'SA-007. Cree un profil individuel reference/unclaimed (precedent : decision C-06). Signale, sans bloquer, les doublons potentiels. Exige profiles.edit.';
