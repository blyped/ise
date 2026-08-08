-- =====================================================================
-- 0035_member_profile_and_saved_searches
--
-- Couche base de donnees de la tranche RECHERCHE & DECOUVERTE, partie
-- ISE-036 (enregistrer une recherche / alerte) et ISE-037 (profil d'un
-- autre ISE).
--
-- Le moteur de recherche (0030) et le moteur de matching (0031, 0033,
-- 0034) ne sont PAS retouches : `public.search_profiles()` et
-- `public.match_profiles()` sont utilisees telles quelles.
--
-- Ce que cette migration ajoute, et pourquoi :
--
--   1. private.field_is_visible(uuid, text)
--      Resout la visibilite EFFECTIVE d'un champ de profil :
--      `profile_visibility` (choix du proprietaire) sinon
--      `profile_visibility_defaults` (defaut du referentiel), sinon
--      `private` (le moins expose). Puis delegue a
--      private.can_see_field() dont l'ordre d'evaluation est la regle
--      (docs/rls.md 2.1).
--
--   2. public.get_member_profile(uuid)   -- ISE-037
--      La politique `ise_profiles_select` filtre des LIGNES : elle ne
--      sait pas qu'un membre a mis sa ville en `connections` et son
--      LinkedIn en `promotion`. Et `profile_visibility` porte la
--      politique `profile_visibility_own` : le visiteur ne peut donc
--      meme pas LIRE les reglages de la personne consultee pour savoir
--      quoi masquer.
--      Consequence directe du MASTER PROMPT section 47 (« ne jamais
--      renvoyer puis masquer ») : la composition du profil doit se faire
--      EN BASE. Un champ non autorise n'entre jamais dans le jsonb de
--      sortie -- il n'est ni lu par le client, ni present dans la
--      reponse reseau, ni masque par du CSS.
--
--   3. public.save_search_with_alert(...)  -- ISE-036
--      public.set_search_alert_status(...)
--      public.delete_saved_search(uuid)
--      public.list_saved_searches()
--      `saved_searches` et `search_alerts` sont deja ouvertes en RLS
--      (`..._own`, migration 0021). Mais une recherche et son alerte
--      forment un tout : les creer en deux appels PostgREST laisserait
--      une recherche sans alerte si le second echoue. Ces fonctions sont
--      le chemin d'ecriture unique, atomique (motif B de docs/rls.md 4).
--
-- Aucune politique RLS existante n'est modifiee. Aucune table n'est
-- creee : celles d'ISE-036 existent depuis 0005 et sont deja ouvertes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Visibilite effective d'un champ
--
-- SECURITY DEFINER, motif A (docs/rls.md 4) : lit `profile_visibility`
-- d'un TIERS, table dont la politique est « proprietaire seulement ».
-- Ne renvoie qu'un booleen, jamais une ligne.
-- ---------------------------------------------------------------------
create or replace function private.field_is_visible(p_owner uuid, p_field text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_see_field(
    p_owner,
    coalesce(
      (select v.visibility
         from public.profile_visibility v
        where v.profile_id = p_owner and v.field_key = p_field),
      (select d.default_visibility
         from public.profile_visibility_defaults d
        where d.field_key = p_field),
      -- Champ inconnu du referentiel : le moins expose (MASTER PROMPT §47).
      'private'
    )
  )
$$;

comment on function private.field_is_visible(uuid, text) is
  'Visibilite EFFECTIVE d''un champ de profil : reglage du proprietaire, '
  'sinon defaut du referentiel, sinon `private`. Booleen uniquement.';

revoke all on function private.field_is_visible(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. ISE-037 -- profil d'un autre ISE
--
-- SECURITY DEFINER, motif A. Le controle d'acces est fait en trois temps :
--   a. membre actif                      -> sinon 42501 ;
--   b. private.can_see_profile()         -> couvre le BLOCAGE dans les
--      deux sens, la suppression logique et le statut du profil. Un
--      profil bloque renvoie NULL : il n'existe pas pour l'appelant ;
--   c. private.field_is_visible() champ par champ.
--
-- Ne sortent JAMAIS de cette fonction, quelle que soit la visibilite :
-- e-mail, telephone, adresse postale, date de naissance, CV
-- (`private.profile_contacts` n'est meme pas lue) et
-- `profile_completion` (prive, D-72 ; le privilege de colonne de 0028
-- ne s'applique pas au proprietaire de la fonction, la colonne est donc
-- volontairement absente de la projection).
--
-- `visible_fields` liste ce qui a ete AUTORISE : l'interface sait ainsi
-- distinguer « champ non autorise » de « champ vide », sans deviner.
-- ---------------------------------------------------------------------
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
    v_fields := v_fields || 'headline';
  end if;

  if private.field_is_visible(p_profile_id, 'bio') and v_row.bio is not null then
    v_out := v_out || jsonb_build_object('bio', v_row.bio);
    v_fields := v_fields || 'bio';
  end if;

  if private.field_is_visible(p_profile_id, 'photo') and v_row.avatar_path is not null then
    -- Chemin Storage uniquement : le bucket `avatars` est prive (0027),
    -- l'URL signee est emise cote serveur apres controle.
    v_out := v_out || jsonb_build_object('avatar_path', v_row.avatar_path);
    v_fields := v_fields || 'photo';
  end if;

  if private.field_is_visible(p_profile_id, 'current_position')
     and v_row.current_position is not null then
    v_out := v_out || jsonb_build_object('current_position', v_row.current_position);
    v_fields := v_fields || 'current_position';
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
      v_fields := v_fields || 'current_organization';
    end if;
  end if;

  if private.field_is_visible(p_profile_id, 'country') and v_row.current_country_code is not null then
    v_out := v_out || jsonb_build_object(
      'current_country_code', v_row.current_country_code,
      'current_country',      (select c.name_fr from public.countries c
                                where c.code = v_row.current_country_code));
    v_fields := v_fields || 'country';
  end if;

  if private.field_is_visible(p_profile_id, 'city') and v_row.current_city is not null then
    v_out := v_out || jsonb_build_object('current_city', v_row.current_city);
    v_fields := v_fields || 'city';
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
    v_fields := v_fields || 'promotion';
  end if;

  if private.field_is_visible(p_profile_id, 'linkedin_url') and v_row.linkedin_url is not null then
    v_out := v_out || jsonb_build_object('linkedin_url', v_row.linkedin_url);
    v_fields := v_fields || 'linkedin_url';
  end if;

  if private.field_is_visible(p_profile_id, 'website_url') and v_row.website_url is not null then
    v_out := v_out || jsonb_build_object('website_url', v_row.website_url);
    v_fields := v_fields || 'website_url';
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
    v_fields := v_fields || 'skills';
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
    v_fields := v_fields || 'sectors';
  end if;

  if private.field_is_visible(p_profile_id, 'languages') then
    v_out := v_out || jsonb_build_object('languages', coalesce((
      select jsonb_agg(jsonb_build_object(
               'code', l.code, 'name', l.name_fr, 'proficiency', pl.proficiency)
             order by l.sort_order, l.name_fr)
        from public.profile_languages pl
        join public.languages l on l.code = pl.language_code
       where pl.profile_id = p_profile_id), '[]'::jsonb));
    v_fields := v_fields || 'languages';
  end if;

  if private.field_is_visible(p_profile_id, 'tools') then
    v_out := v_out || jsonb_build_object('tools', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name,
                                          'proficiency', pt.proficiency)
             order by t.name)
        from public.profile_tools pt
        join public.tools t on t.id = pt.tool_id
       where pt.profile_id = p_profile_id), '[]'::jsonb));
    v_fields := v_fields || 'tools';
  end if;

  if private.field_is_visible(p_profile_id, 'experience_countries') then
    v_out := v_out || jsonb_build_object('experience_countries', coalesce((
      select jsonb_agg(jsonb_build_object('code', c.code, 'name', c.name_fr) order by c.name_fr)
        from public.profile_geographies g
        join public.countries c on c.code = g.country_code
       where g.profile_id = p_profile_id), '[]'::jsonb));
    v_fields := v_fields || 'experience_countries';
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
    v_fields := v_fields || 'experiences';
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
    v_fields := v_fields || 'educations';
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
    v_fields := v_fields || 'availabilities';
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
  'N''expose jamais e-mail, telephone, adresse, date de naissance, CV ni score de completion.';

revoke all on function public.get_member_profile(uuid) from public, anon;
grant execute on function public.get_member_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. ISE-036 -- recherches enregistrees et alertes
--
-- SECURITY DEFINER, motif B : chemin d'ecriture unique et atomique.
-- Aucune de ces fonctions n'accepte de `profile_id` en parametre : le
-- proprietaire est TOUJOURS private.current_profile_id(). Un appelant
-- ne peut donc ni lire ni ecrire la recherche d'un tiers, quelle que
-- soit la valeur qu'il envoie (MASTER PROMPT §10).
-- ---------------------------------------------------------------------
create or replace function public.save_search_with_alert(
  p_name            text,
  p_criteria        jsonb,
  p_alert_enabled   boolean default false,
  p_frequency       text    default 'weekly',
  p_channel         text    default 'in_app',
  p_saved_search_id uuid    default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_me   uuid;
  v_id   uuid;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if not private.is_active_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  v_me := private.current_profile_id();

  if v_name = '' or length(v_name) > 120 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_criteria is null or jsonb_typeof(p_criteria) <> 'object' then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_frequency not in ('daily', 'weekly', 'monthly') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_channel not in ('in_app', 'email', 'both') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  if p_saved_search_id is not null then
    -- Modification : verrouiller la ligne et refuser celle d'un tiers.
    select s.id into v_id
      from public.saved_searches s
     where s.id = p_saved_search_id and s.profile_id = v_me
     for update;
    if v_id is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    update public.saved_searches
       set name = v_name, criteria = p_criteria, updated_at = now()
     where id = v_id;
  else
    insert into public.saved_searches (profile_id, name, criteria)
    values (v_me, v_name, p_criteria)
    on conflict (profile_id, name) do update
      set criteria = excluded.criteria, updated_at = now()
    returning id into v_id;
  end if;

  if p_alert_enabled then
    insert into public.search_alerts (saved_search_id, profile_id, frequency, channel, status)
    values (v_id, v_me, p_frequency, p_channel, 'active')
    on conflict (saved_search_id) do update
      set frequency  = excluded.frequency,
          channel    = excluded.channel,
          status     = 'active',
          updated_at = now();
  else
    -- L'alerte est retiree, pas « suspendue » : l'utilisateur a decoche.
    delete from public.search_alerts a where a.saved_search_id = v_id and a.profile_id = v_me;
  end if;

  return v_id;
end
$fn$;

comment on function public.save_search_with_alert(text, jsonb, boolean, text, text, uuid) is
  'ISE-036. Cree ou met a jour une recherche enregistree ET son alerte en une seule '
  'transaction. Le proprietaire est toujours private.current_profile_id() : aucun '
  'profile_id n''est accepte en parametre.';

revoke all on function public.save_search_with_alert(text, jsonb, boolean, text, text, uuid) from public, anon;
grant execute on function public.save_search_with_alert(text, jsonb, boolean, text, text, uuid) to authenticated;

create or replace function public.set_search_alert_status(
  p_saved_search_id uuid,
  p_status          text
)
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_me uuid;
  v_id uuid;
begin
  if not private.is_active_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  v_me := private.current_profile_id();

  if p_status not in ('active', 'paused') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  select a.id into v_id
    from public.search_alerts a
   where a.saved_search_id = p_saved_search_id and a.profile_id = v_me
   for update;

  if v_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  update public.search_alerts
     set status = p_status, updated_at = now()
   where id = v_id;

  return p_status;
end
$fn$;

comment on function public.set_search_alert_status(uuid, text) is
  'ISE-036. Suspend (`paused`) ou reactive (`active`) l''alerte d''une recherche du membre courant.';

revoke all on function public.set_search_alert_status(uuid, text) from public, anon;
grant execute on function public.set_search_alert_status(uuid, text) to authenticated;

create or replace function public.delete_saved_search(p_saved_search_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_me uuid;
  v_n  integer;
begin
  if not private.is_active_member() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  v_me := private.current_profile_id();

  -- `search_alerts` et `search_alert_seen_results` partent en cascade.
  delete from public.saved_searches s
   where s.id = p_saved_search_id and s.profile_id = v_me;
  get diagnostics v_n = row_count;

  if v_n = 0 then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return true;
end
$fn$;

comment on function public.delete_saved_search(uuid) is
  'ISE-036. Supprime une recherche enregistree du membre courant, alerte comprise (cascade).';

revoke all on function public.delete_saved_search(uuid) from public, anon;
grant execute on function public.delete_saved_search(uuid) to authenticated;

create or replace function public.list_saved_searches()
returns table (
  saved_search_id  uuid,
  name             text,
  criteria         jsonb,
  created_at       timestamptz,
  updated_at       timestamptz,
  alert_enabled    boolean,
  alert_frequency  text,
  alert_channel    text,
  alert_status     text,
  last_notified_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name, s.criteria, s.created_at, s.updated_at,
         (a.id is not null), a.frequency, a.channel, a.status, a.last_notified_at
  from public.saved_searches s
  left join public.search_alerts a
         on a.saved_search_id = s.id and a.profile_id = s.profile_id
  where private.current_profile_id() is not null
    and s.profile_id = private.current_profile_id()
  order by s.updated_at desc, s.id desc
$$;

comment on function public.list_saved_searches() is
  'ISE-036. Recherches enregistrees du membre courant. SANS PARAMETRE : aucun tiers atteignable (D-72).';

revoke all on function public.list_saved_searches() from public, anon;
grant execute on function public.list_saved_searches() to authenticated;

-- ---------------------------------------------------------------------
-- 4. Index reclame par le contexte relationnel d'ISE-037
--
-- `connections` a pour PK (profile_a_id, profile_b_id) : le comptage des
-- relations communes sonde aussi par profile_b_id, non indexe.
-- ---------------------------------------------------------------------
create index if not exists connections_profile_b_idx
  on public.connections (profile_b_id);
