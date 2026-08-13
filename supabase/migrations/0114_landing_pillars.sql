-- =====================================================================
-- 0114_landing_pillars
--
-- Transforme les quatre piliers de « Un reseau concu pour etre utile »
-- (Connecter / Entraider / Collaborer / Impacter, NetworkSection.tsx) en
-- contenu pilote par le CMS : image, texte optionnel (legende) et lien,
-- par pilier. Chantier explicitement laisse en suivi par D-164 (§23) :
-- « transformation des quatre piliers en contenu pilote par le CMS
--   (image, texte optionnel, lien, par pilier) ».
--
-- CONTEXTE
--   Jusqu'ici PILLAR_TARGETS (NetworkSection.tsx) etait une table en dur,
--   cote frontend, avec une seule entree (Connecter -> SEARCH_ROUTES.find).
--   Le titre et le corps de chaque pilier restent un discours de marque
--   fixe (fr.public.pillars, i18n) : ce n'est pas remis en cause ici. Ce
--   qui devient pilotable par le CMS, ce sont les trois choses editoriales
--   qui varient dans le temps : l'image, une legende optionnelle, et
--   l'ecran reel vers lequel le pilier pointe.
--
-- CE QUI EST AJOUTE
--   * cms_pillars — une ligne fixe par pilier (4 lignes, jamais creees ni
--     supprimees par le CMS), avec media_id (mediatheque PUBLIQUE,
--     meme patron que 0113/D-166), caption (texte optionnel), et
--     link_target (cle d'une liste blanche d'ecrans REELS — jamais un
--     chemin libre, meme regle « jamais de lien mort » qu'avant, sauf que
--     desormais c'est l'administrateur CMS qui choisit parmi des cibles
--     valides, pas le developpeur qui code une table en dur) ;
--   * set_landing_pillar(p_pillar_key, p_media_id, p_caption,
--     p_link_target) — seule fonction qui les ecrit. Meme forme que
--     set_landing_cover_media (0113) : verifie cms.edit, valide le media
--     (bucket landing-media, alt_text >= 3 caracteres), valide
--     link_target contre la liste blanche, audite ;
--   * list_cms_pillars() — lecture pour l'ecran /cms/piliers (CMS-011),
--     memes 4 lignes toujours dans le meme ordre ;
--   * get_landing_pillars() — lecture publique (anon inclus, comme
--     get_landing_events/get_landing_news), projette 'image' via
--     private.landing_media() — memes garanties que le reste de la
--     landing (bucket public, alt_text obligatoire).
--
-- LISTE BLANCHE DES CIBLES (link_target)
--   Cinq ecrans membres reels, choisis parce qu'ils existent deja et
--   correspondent au theme de chaque pilier (jamais une cible inventee,
--   ADDENDUM §10 regle 6) :
--     'search'        -> /rechercher            (ISE-034, Connecter)
--     'calls'         -> /appels                (Entraider)
--     'projects'      -> /projets                (Collaborer — le fil
--                          d'Ariane des maquettes place deja ISE-088 sous
--                          « Collaborer », cf. commentaire projects.ts)
--     'opportunities' -> /opportunites            (Impacter ou Connecter,
--                          au choix de l'admin)
--     'applications'  -> /candidatures            (Impacter — suivi des
--                          resultats de candidature)
--   Un pilier sans link_target reste du texte seul, exactement le
--   comportement actuel de PILLAR_TARGETS quand une cle est absente.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS
--   * ne rend pas le titre ni le corps des piliers editables (discours de
--     marque assume, fr.public.pillars inchange) ;
--   * ne permet pas de creer ou supprimer un pilier (4 lignes fixes,
--     aucune politique RLS d'insertion ni de suppression) ;
--   * ne pre-remplit aucune cible sauf 'connecter' -> 'search', qui
--     reprend exactement le cablage deja fait par D-164 (aucune
--     regression sur le seul lien qui existait avant cette migration).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Table (4 lignes fixes).
-- ---------------------------------------------------------------------
create table if not exists public.cms_pillars (
  pillar_key   text primary key check (pillar_key in ('connecter', 'entraider', 'collaborer', 'impacter')),
  media_id     uuid references public.cms_media_assets(id) on delete set null,
  caption      text,
  link_target  text check (link_target is null or link_target in ('search', 'calls', 'projects', 'opportunities', 'applications')),
  updated_at   timestamptz not null default now()
);

comment on table public.cms_pillars is
  '0114. Contenu editorial des quatre piliers de « Un reseau concu pour etre utile » (image, legende optionnelle, lien). Titre et corps restent fixes (fr.public.pillars) : seule la partie editoriale variable est ici.';
comment on column public.cms_pillars.media_id is
  'Visuel optionnel du pilier, mediatheque publique (cms_media_assets, bucket landing-media) — jamais un chemin libre.';
comment on column public.cms_pillars.link_target is
  'Cle d''une liste blanche d''ecrans membres reels (search/calls/projects/opportunities/applications) ou null (pas de lien, texte seul). Jamais un chemin libre : la resolution en URL reelle se fait cote frontend.';

insert into public.cms_pillars (pillar_key, link_target)
values
  ('connecter', 'search'),
  ('entraider', null),
  ('collaborer', null),
  ('impacter', null)
on conflict (pillar_key) do nothing;

alter table public.cms_pillars enable row level security;

drop policy if exists cms_pillars_read on public.cms_pillars;
create policy cms_pillars_read on public.cms_pillars
  for select to authenticated
  using (private.has_permission('cms.read'));

drop policy if exists cms_pillars_update on public.cms_pillars;
create policy cms_pillars_update on public.cms_pillars
  for update to authenticated
  using (private.has_permission('cms.edit'))
  with check (private.has_permission('cms.edit'));

-- Pas de politique insert/delete : les 4 lignes sont fixes (seed ci-dessus
-- uniquement). Toute tentative d'insertion ou de suppression par un role
-- authenticated est refusee par defaut (RLS sans politique correspondante).

-- ---------------------------------------------------------------------
-- 2. Ecriture, reservee a cms.edit, auditee.
-- ---------------------------------------------------------------------
create or replace function public.set_landing_pillar(
  p_pillar_key  text,
  p_media_id    uuid default null,
  p_caption     text default null,
  p_link_target text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket  text;
  v_alt     text;
  v_deleted timestamptz;
  v_caption text := nullif(btrim(coalesce(p_caption, '')), '');
  v_link    text := nullif(btrim(coalesce(p_link_target, '')), '');
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.edit') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_pillar_key not in ('connecter', 'entraider', 'collaborer', 'impacter') then
    raise exception 'unknown_pillar' using errcode = 'P0002';
  end if;

  if v_link is not null and v_link not in ('search', 'calls', 'projects', 'opportunities', 'applications') then
    raise exception 'invalid_link_target' using errcode = 'P0001';
  end if;

  if p_media_id is not null then
    select m.bucket_id, m.alt_text, m.deleted_at
      into v_bucket, v_alt, v_deleted
      from public.cms_media_assets m
     where m.id = p_media_id;
    if v_bucket is null or v_deleted is not null then
      raise exception 'invalid_media' using errcode = 'P0001';
    end if;
    if v_bucket <> 'landing-media' or char_length(btrim(coalesce(v_alt, ''))) < 3 then
      raise exception 'invalid_media' using errcode = 'P0001';
    end if;
  end if;

  update public.cms_pillars
     set media_id    = p_media_id,
         caption     = v_caption,
         link_target = v_link,
         updated_at  = now()
   where pillar_key = p_pillar_key;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  perform private.log_audit(
    p_action      => 'cms.landing_pillar',
    p_object_type => 'pillar',
    p_object_id   => p_pillar_key,
    p_context     => jsonb_build_object('media_id', p_media_id, 'caption', v_caption, 'link_target', v_link));

  return jsonb_build_object(
    'pillar_key', p_pillar_key, 'media_id', p_media_id, 'caption', v_caption, 'link_target', v_link);
end
$$;

revoke all on function public.set_landing_pillar(text, uuid, text, text) from public, anon;
grant execute on function public.set_landing_pillar(text, uuid, text, text) to authenticated, service_role;

comment on function public.set_landing_pillar(text, uuid, text, text) is
  'CMS-011 (0114). Pose l''image, la legende optionnelle et le lien d''un pilier (Connecter/Entraider/Collaborer/Impacter). Exige cms.edit. link_target valide contre une liste blanche d''ecrans membres reels.';

-- ---------------------------------------------------------------------
-- 3. Lecture CMS (les 4 lignes, meme ordre a chaque fois).
-- ---------------------------------------------------------------------
create or replace function public.list_cms_pillars()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.read') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'pillar_key',  p.pillar_key,
             'media_id',    p.media_id,
             'caption',     p.caption,
             'link_target', p.link_target,
             'updated_at',  p.updated_at)
           order by array_position(array['connecter', 'entraider', 'collaborer', 'impacter'], p.pillar_key)),
         '[]'::jsonb)
    into v_rows
  from public.cms_pillars p;

  return v_rows;
end
$$;

revoke all on function public.list_cms_pillars() from public, anon;
grant execute on function public.list_cms_pillars() to authenticated, service_role;

comment on function public.list_cms_pillars() is
  'CMS-011 (0114). Les 4 piliers, toujours dans l''ordre Connecter/Entraider/Collaborer/Impacter. Exige cms.read.';

-- ---------------------------------------------------------------------
-- 4. Lecture publique (landing, anon inclus — memes garanties que
--    get_landing_events/get_landing_news : bucket public, alt_text
--    obligatoire, projete via private.landing_media()).
-- ---------------------------------------------------------------------
create or replace function public.get_landing_pillars()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'pillar_key',  p.pillar_key,
             'image',       private.landing_media(p.media_id),
             'caption',     p.caption,
             'link_target', p.link_target)
           order by array_position(array['connecter', 'entraider', 'collaborer', 'impacter'], p.pillar_key)),
         '[]'::jsonb)
  from public.cms_pillars p
$$;

revoke all on function public.get_landing_pillars() from public;
grant execute on function public.get_landing_pillars() to anon, authenticated, service_role;

comment on function public.get_landing_pillars() is
  'PUB-001 (0114). Image, legende optionnelle et lien de chaque pilier de « Un reseau concu pour etre utile ». Titre et corps restent en i18n (fr.public.pillars), non projetes ici.';

-- ---------------------------------------------------------------------
-- 5. Liste blanche anon de private.security_baseline_violations() :
--    get_landing_pillars() rejoint les autres projections landing
--    public-safe deja autorisees a anon (meme forme que 0061/0113).
-- ---------------------------------------------------------------------
create or replace function private.security_baseline_violations()
returns table(kind text, object_name text, detail text)
language sql
stable
security definer
set search_path = ''
as $$
  select 'rls_disabled', c.relname::text, 'table public sans RLS'
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  union all
  select 'anon_grant', g.table_schema || '.' || g.table_name, 'privilege ' || g.privilege_type || ' accorde a anon'
  from information_schema.role_table_grants g
  where g.grantee = 'anon' and g.table_schema in ('public', 'private', 'analytics')
  union all
  select 'secdef_no_search_path', n.nspname || '.' || p.proname, 'SECURITY DEFINER sans search_path fige'
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private') and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  union all
  select 'private_exposed', g.table_schema || '.' || g.table_name, 'schema prive accessible a authenticated'
  from information_schema.role_table_grants g
  where g.grantee = 'authenticated' and g.table_schema in ('private', 'analytics')
  union all
  select 'private_column_exposed',
         cp.table_schema || '.' || cp.table_name || '.' || cp.column_name,
         'privilege ' || cp.privilege_type || ' accorde a ' || cp.grantee
  from information_schema.column_privileges cp
  join (values
          ('public', 'ise_profiles',         'profile_completion', 'SELECT'),
          ('public', 'ise_profiles',         'profile_completion', 'UPDATE'),
          ('public', 'ise_profiles',         'profile_completion', 'INSERT'),
          ('public', 'network_call_matches', 'score',              'SELECT'),
          ('public', 'network_call_matches', 'component_scores',   'SELECT'),
          ('public', 'opportunity_matches',  'score',              'SELECT'),
          ('public', 'opportunity_matches',  'component_scores',   'SELECT'),
          ('public', 'mentorship_matches',   'score',              'SELECT'),
          ('public', 'events',               'online_url_private', 'SELECT')
       ) as masked(s, t, c, p)
    on masked.s = cp.table_schema
   and masked.t = cp.table_name
   and masked.c = cp.column_name
   and masked.p = cp.privilege_type
  where cp.grantee in ('authenticated', 'anon')
  union all
  select 'anon_function_grant', n.nspname || '.' || p.proname,
         'EXECUTE accorde a anon hors liste blanche des projections public-safe'
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'private')
    and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
    and p.proname not in (
      'get_landing_carousel', 'get_landing_sections', 'get_landing_news',
      'get_landing_events', 'get_landing_opportunities', 'get_landing_featured_profile',
      'get_landing_expertises', 'get_landing_partners', 'get_landing_stats',
      'record_public_landing_event', 'get_landing_carousel_settings',
      'get_landing_pillars')
  order by 1, 2
$$;

comment on function private.security_baseline_violations() is
  'Garde-fou CI (0058, etendu par 0114) : toute ligne renvoyee bloque une migration. Liste blanche anon des projections landing public-safe, get_landing_pillars ajoute par 0114.';

-- ---------------------------------------------------------------------
-- 6. Verification.
-- ---------------------------------------------------------------------
do $verify$
declare
  v_n       integer;
  v_seeded  integer;
begin
  select count(*) into v_seeded from public.cms_pillars;
  if v_seeded <> 4 then
    raise exception '0114: cms_pillars devrait contenir 4 lignes, en contient %', v_seeded;
  end if;

  select count(*) into v_n
  from public.cms_pillars
  where pillar_key = 'connecter' and link_target = 'search';
  if v_n <> 1 then
    raise exception '0114: le pilier Connecter devrait rester cable vers ''search'' (D-164, aucune regression)';
  end if;

  select count(*) into v_n from private.security_baseline_violations();
  if v_n <> 0 then
    raise exception '0114: security_baseline_violations() renvoie % ligne(s)', v_n;
  end if;

  select count(*) into v_n from private.storage_baseline_violations();
  if v_n <> 0 then
    raise exception '0114: storage_baseline_violations() renvoie % ligne(s)', v_n;
  end if;
end
$verify$;
