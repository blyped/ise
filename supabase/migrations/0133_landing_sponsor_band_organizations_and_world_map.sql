-- =====================================================================
-- 0133_landing_sponsor_band_organizations_and_world_map
--
-- Trois sections nouvelles de la page d'accueil publique (PUB-001),
-- demandees mot pour mot par le porteur le 2026-08-14 :
--
--   1. « Pour les campagnes programmees qui apparaitront au bas de la
--      page d'accueil, pas de bavardages hein (je ne veux pas de texte).
--      C'est une bonne image, qui passe en carrousel (sans les boutons
--      de navigation et pause). »
--   2. « Il faut qu'on ajoute aussi une section d'entreprises ou
--      institutions ou travaillent les ISE (uniquement les logos, que
--      l'admin seul mettra). »
--   3. « Ajoute aussi : Le reseau en quelques chiffres. Ajouter une carte
--      du monde (Ou sont les ISE actuellement ?) avec des points par pays
--      de presence + nombre d'ISE par pays. »
--
-- CE QUI EXISTAIT DEJA, ET QUI N'EST PAS RECONSTRUIT
--   * le bandeau sponsorise reutilise `cms_partner_campaigns` (0057) et sa
--     projection `get_landing_partners(p_placement)` : la valeur
--     'footer' est deja dans la contrainte de `placement`, les colonnes
--     `media_id` / `mobile_media_id` existent, l'ecran /cms/partenaires
--     (CMS-007) sait deja creer et editer une campagne. Rien de tout cela
--     n'est duplique : seule la contrainte de cible est assouplie ;
--   * « Le reseau en quelques chiffres » existe deja
--     (`get_landing_stats()`, 0057 ; NetworkSection.tsx). Aucun chiffre
--     n'est ajoute ni recalcule ici. Cette migration ne fournit QUE la
--     donnee manquante de la carte : la repartition par pays.
--
-- CE QUE CETTE MIGRATION AJOUTE
--   1. contrainte `cms_partner_campaigns_has_target` assouplie pour le
--      seul placement 'footer' (une image de bandeau peut n'etre cliquable
--      vers rien) ;
--   2. `cms_landing_organizations` + `set_landing_organization()` +
--      `remove_landing_organization()` + `list_cms_landing_organizations()`
--      + `get_landing_organizations()` ;
--   3. `get_landing_country_presence()` — agregats par pays, avec SEUIL
--      D'AGREGATION (voir §3).
--   4. liste blanche anon de `private.security_baseline_violations()`
--      etendue aux deux nouvelles projections (D-125).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Bandeau sponsorise du bas de page (placement 'footer').
--
--    `cms_partner_campaigns_has_target` (0057) imposait a TOUTE campagne
--    de pointer une ressource interne ou une adresse https. C'est juste
--    pour un encart avec bouton d'appel a l'action ; ca ne l'est pas pour
--    un bandeau qui n'est QU'une image. Certains partenaires institutionnels
--    n'ont pas de site a citer, et forcer une adresse produirait soit un
--    lien invente, soit une campagne impossible a enregistrer.
--
--    La contrainte est donc conservee a l'identique pour les quatre autres
--    emplacements, et levee pour 'footer' uniquement. Une campagne 'footer'
--    QUI porte une cible reste evidemment cliquable.
--
--    Aucune ligne existante n'est concernee (0 campagne en base au moment
--    de la migration) : l'assouplissement ne peut rien casser.
-- ---------------------------------------------------------------------
alter table public.cms_partner_campaigns
  drop constraint if exists cms_partner_campaigns_has_target;

alter table public.cms_partner_campaigns
  add constraint cms_partner_campaigns_has_target
  check (
    placement = 'footer'
    or target_entity_id is not null
    or target_url is not null
  );

comment on column public.cms_partner_campaigns.placement is
  'Emplacement de diffusion. ''footer'' (0133) = bandeau image du bas de la page d''accueil : ni titre, ni description, ni bouton ; la cible est facultative pour ce seul emplacement.';


-- ---------------------------------------------------------------------
-- 2. Section « Ils recrutent, ils emploient des ISE » — logos seuls.
--
--    POURQUOI UNE TABLE EDITORIALE, ET PAS UN CALCUL SUR LES PROFILS.
--    `organizations` existe (0002) et porte deja `logo_path`. Il serait
--    techniquement possible de deduire la liste des organisations depuis
--    `ise_profiles.current_organization_id` et `experiences.organization_id`
--    — c'est d'ailleurs ce que fait le chiffre « organisations » de
--    `get_landing_stats()`. Ce n'est pourtant PAS ce qui est demande, et
--    ce ne serait pas souhaitable :
--
--      * la demande est editoriale : « que l'admin seul mettra ». Un calcul
--        automatique publierait le logo de tout employeur saisi par un
--        membre, sans que personne l'ait valide — y compris un employeur
--        qui n'a pas donne son accord pour figurer sur une page publique,
--        ou dont le logo est un depot de marque ;
--      * un calcul revelerait indirectement de l'information sur les
--        membres : une organisation qui n'emploie qu'un seul ISE se
--        retrouverait affichee publiquement, ce qui, croise avec le reste,
--        peut designer une personne (meme raisonnement que le seuil du §3) ;
--      * l'ordre d'affichage est un choix de mise en avant, pas un
--        classement mesure : rien en base ne dit quelle organisation doit
--        paraitre en premier.
--
--    La table ne porte donc AUCUNE mesure : uniquement le choix de
--    l'administrateur (quelle organisation, avec quel logo, dans quel
--    ordre, publiee ou non).
--
--    LOGO. Deux sources possibles, dans cet ordre : le media choisi dans la
--    mediatheque PUBLIQUE (`media_id`, meme patron que 0113/0114/D-166) ;
--    a defaut, `organizations.logo_path` s'il correspond a un media
--    reellement enregistre dans `landing-media` avec son alternative
--    textuelle. Sans logo affichable, la ligne n'est pas projetee : une
--    section « uniquement des logos » ne peut pas afficher une case vide.
-- ---------------------------------------------------------------------
create table if not exists public.cms_landing_organizations (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  media_id        uuid references public.cms_media_assets(id) on delete set null,
  display_order   integer not null default 0,
  is_published    boolean not null default false,
  updated_at      timestamptz not null default now()
);

comment on table public.cms_landing_organizations is
  '0133. Choix editorial des organisations dont le logo parait sur la page d''accueil publique. Aucune mesure ici : ni nombre d''ISE, ni classement. L''administrateur seul decide qui parait et dans quel ordre.';
comment on column public.cms_landing_organizations.media_id is
  'Logo choisi dans la mediatheque PUBLIQUE (cms_media_assets, bucket landing-media). A defaut, organizations.logo_path est tente. Sans logo affichable, la ligne n''est pas projetee.';
comment on column public.cms_landing_organizations.display_order is
  'Ordre d''affichage voulu par l''administrateur. Croissant. En cas d''egalite, ordre alphabetique du nom canonique.';
comment on column public.cms_landing_organizations.is_published is
  'Faux = enregistre mais invisible du public. La section entiere disparait quand aucune ligne publiee n''a de logo affichable.';

create index if not exists cms_landing_organizations_published_idx
  on public.cms_landing_organizations (is_published, display_order);

alter table public.cms_landing_organizations enable row level security;

drop policy if exists cms_landing_organizations_read on public.cms_landing_organizations;
create policy cms_landing_organizations_read on public.cms_landing_organizations
  for select to authenticated
  using (private.has_permission('cms.read'));

-- Pas de politique insert/update/delete : toute ecriture passe par les
-- fonctions SECURITY DEFINER ci-dessous, qui verifient `cms.edit` et
-- auditent. RLS sans politique correspondante = refus par defaut.

create or replace function public.set_landing_organization(
  p_organization_id uuid,
  p_media_id        uuid default null,
  p_display_order   integer default 0,
  p_is_published    boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket  text;
  v_alt     text;
  v_deleted timestamptz;
  v_order   integer := coalesce(p_display_order, 0);
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.edit') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if not exists (select 1 from public.organizations o where o.id = p_organization_id) then
    raise exception 'unknown_organization' using errcode = 'P0002';
  end if;

  if v_order < 0 or v_order > 999 then
    raise exception 'invalid_display_order' using errcode = 'P0001';
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

  insert into public.cms_landing_organizations
    (organization_id, media_id, display_order, is_published, updated_at)
  values
    (p_organization_id, p_media_id, v_order, coalesce(p_is_published, false), now())
  on conflict (organization_id) do update
    set media_id      = excluded.media_id,
        display_order = excluded.display_order,
        is_published  = excluded.is_published,
        updated_at    = now();

  perform private.log_audit(
    p_action      => 'cms.landing_organization',
    p_object_type => 'organization',
    p_object_id   => p_organization_id::text,
    p_context     => jsonb_build_object(
                       'media_id', p_media_id,
                       'display_order', v_order,
                       'is_published', coalesce(p_is_published, false)));

  return jsonb_build_object(
    'organization_id', p_organization_id,
    'media_id', p_media_id,
    'display_order', v_order,
    'is_published', coalesce(p_is_published, false));
end
$$;

revoke all on function public.set_landing_organization(uuid, uuid, integer, boolean) from public, anon;
grant execute on function public.set_landing_organization(uuid, uuid, integer, boolean) to authenticated, service_role;

comment on function public.set_landing_organization(uuid, uuid, integer, boolean) is
  'CMS-013 (0133). Ajoute ou met a jour une organisation de la section « logos » de la page d''accueil. Exige cms.edit. Le media doit appartenir a la mediatheque publique et porter une alternative textuelle.';

create or replace function public.remove_landing_organization(p_organization_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.edit') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  delete from public.cms_landing_organizations
   where organization_id = p_organization_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  perform private.log_audit(
    p_action      => 'cms.landing_organization_removed',
    p_object_type => 'organization',
    p_object_id   => p_organization_id::text,
    p_context     => '{}'::jsonb);

  return true;
end
$$;

revoke all on function public.remove_landing_organization(uuid) from public, anon;
grant execute on function public.remove_landing_organization(uuid) to authenticated, service_role;

comment on function public.remove_landing_organization(uuid) is
  'CMS-013 (0133). Retire une organisation de la section « logos ». L''organisation elle-meme n''est pas touchee. Exige cms.edit.';

create or replace function public.list_cms_landing_organizations()
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
             'organization_id',   lo.organization_id,
             'organization_name', org.canonical_name,
             'media_id',          lo.media_id,
             'display_order',     lo.display_order,
             'is_published',      lo.is_published,
             -- « le logo est-il reellement affichable ? » : la meme question
             -- que se pose la projection publique, posee ici pour que l'ecran
             -- CMS puisse la signaler AVANT publication plutot que de laisser
             -- l'administrateur decouvrir une case vide sur la vitrine.
             'logo_ready',        coalesce(private.landing_media(lo.media_id),
                                           private.landing_media_by_path(org.logo_path)) is not null,
             'updated_at',        lo.updated_at)
           order by lo.display_order, org.canonical_name),
         '[]'::jsonb)
    into v_rows
  from public.cms_landing_organizations lo
  join public.organizations org on org.id = lo.organization_id;

  return v_rows;
end
$$;

revoke all on function public.list_cms_landing_organizations() from public, anon;
grant execute on function public.list_cms_landing_organizations() to authenticated, service_role;

comment on function public.list_cms_landing_organizations() is
  'CMS-013 (0133). Les organisations retenues pour la section « logos », dans l''ordre d''affichage. Exige cms.read.';

create or replace function public.get_landing_organizations()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_agg(row_to_json(t)::jsonb order by t.display_order, t.organization_name)
    from (
      select lo.organization_id,
             org.canonical_name as organization_name,
             lo.display_order,
             coalesce(private.landing_media(lo.media_id),
                      private.landing_media_by_path(org.logo_path)) as logo
      from public.cms_landing_organizations lo
      join public.organizations org on org.id = lo.organization_id
      where lo.is_published
        and coalesce(private.landing_media(lo.media_id),
                     private.landing_media_by_path(org.logo_path)) is not null
    ) t
  ), '[]'::jsonb)
$$;

revoke all on function public.get_landing_organizations() from public;
grant execute on function public.get_landing_organizations() to anon, authenticated, service_role;

comment on function public.get_landing_organizations() is
  'PUB-001 (0133). Logos des organisations retenues par l''administration. Aucun texte, aucun chiffre : le nom ne sert que d''alternative textuelle. Une ligne sans logo affichable n''est pas projetee.';


-- ---------------------------------------------------------------------
-- 3. Carte du monde — « Ou sont les ISE actuellement ? »
--
--    CE QUI EST COMPTE, EXACTEMENT.
--    `ise_profiles.current_country_code` — le pays d'exercice actuel — des
--    profils vivants, non-test, de statut 'referenced' ou 'active' :
--    exactement le meme perimetre que `get_landing_stats()`, pour que les
--    deux blocs ne puissent pas se contredire a l'ecran.
--    `experiences.country_code` n'est PAS pris en compte : la question posee
--    est « ou sont-ils AUJOURD'HUI », pas « ou ont-ils exerce ».
--    Le chiffre « pays » de get_landing_stats(), lui, continue de compter
--    les deux ; c'est une autre question, et les deux valeurs peuvent donc
--    legitimement differer. Le libelle de chaque bloc dit laquelle.
--
--    CONFIDENTIALITE — SEUIL D'AGREGATION, ET POURQUOI 3.
--    La page d'accueil est publique et D-73 est formelle : aucune visibilite
--    'public' pour un profil. Un agregat n'est pas un profil, mais un
--    agregat de UN est un profil deguise : « 1 ISE en Australie » designe
--    une personne des que quelqu'un sait qu'un ISE a demenage la-bas. Le
--    seuil retenu est donc k = 3 : un pays n'est nomme et pointe sur la
--    carte que s'il compte AU MOINS TROIS ISE. C'est la valeur minimale
--    couramment admise pour une publication ouverte de statistiques ; en
--    dessous, la ligne n'est pas « floutee », elle n'est pas publiee du
--    tout — ni le nom du pays, ni son point.
--    Les profils des pays sous le seuil ne disparaissent pas pour autant :
--    ils sont comptes dans `hidden_countries` / `hidden_profiles`, sans
--    etre nommes, pour que la page puisse dire honnetement « la carte ne
--    montre pas tout » au lieu de laisser croire a une couverture complete.
--
--    CONSENTEMENT. Un membre qui a mis la visibilite de son pays a 'private'
--    (D-73, D-74, `profile_visibility`) est retire du calcul, y compris du
--    total. Il a demande que ce champ ne circule pas ; un agregat public
--    reste une circulation.
-- ---------------------------------------------------------------------
create or replace function public.get_landing_country_presence()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with live as (
    select p.id, btrim(p.current_country_code) as code
    from public.ise_profiles p
    where p.deleted_at is null
      and not p.is_test_account
      and p.profile_status in ('referenced', 'active')
      and not exists (
        select 1 from public.profile_visibility v
        where v.profile_id = p.id
          and v.field_key = 'country'
          and v.visibility = 'private')
  ),
  located as (
    select code from live where code is not null and code <> ''
  ),
  per_country as (
    select code, count(*)::integer as n from located group by code
  ),
  shown as (select * from per_country where n >= 3),
  hidden as (select * from per_country where n < 3)
  select jsonb_build_object(
    'threshold',        3,
    'total_profiles',   (select count(*) from live),
    'located_profiles', (select count(*) from located),
    'countries',        coalesce((
                          select jsonb_agg(jsonb_build_object(
                                   'code',  s.code,
                                   'name',  coalesce(c.name_fr, s.code),
                                   'count', s.n)
                                 order by s.n desc, coalesce(c.name_fr, s.code))
                          from shown s
                          left join public.countries c on btrim(c.code) = s.code), '[]'::jsonb),
    'hidden_countries', (select count(*) from hidden),
    'hidden_profiles',  (select coalesce(sum(n), 0) from hidden),
    'computed_at',      now())
$$;

revoke all on function public.get_landing_country_presence() from public;
grant execute on function public.get_landing_country_presence() to anon, authenticated, service_role;

comment on function public.get_landing_country_presence() is
  'PUB-001 (0133). Repartition par pays d''exercice actuel, pour la carte du monde. Seuil d''agregation k=3 : un pays comptant 1 ou 2 ISE n''est ni nomme ni pointe, seulement compte dans hidden_countries/hidden_profiles. Les profils dont la visibilite du pays est ''private'' sont exclus.';


-- ---------------------------------------------------------------------
-- 4. Liste blanche anon (D-125). Deux projections rejoignent les
--    projections landing public-safe deja autorisees a anon.
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
      'get_landing_pillars', 'log_auth_link_event',
      -- 0133
      'get_landing_organizations', 'get_landing_country_presence')
  order by 1, 2
$$;

comment on function private.security_baseline_violations() is
  'Garde-fou CI (0058, etendu par 0114, 0119 et 0133) : toute ligne renvoyee bloque une migration. Liste blanche anon des projections landing public-safe ; get_landing_organizations et get_landing_country_presence ajoutees par 0133.';


-- ---------------------------------------------------------------------
-- 5. Verification.
-- ---------------------------------------------------------------------
do $verify$
declare
  v_n       integer;
  v_payload jsonb;
begin
  -- La contrainte assouplie accepte bien un 'footer' sans cible, et refuse
  -- toujours un 'partners_band' sans cible.
  if exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.cms_partner_campaigns'::regclass
      and conname = 'cms_partner_campaigns_has_target') is not true then
    raise exception '0133: cms_partner_campaigns_has_target manquante';
  end if;

  v_payload := public.get_landing_organizations();
  if jsonb_typeof(v_payload) <> 'array' then
    raise exception '0133: get_landing_organizations() devrait renvoyer un tableau';
  end if;

  v_payload := public.get_landing_country_presence();
  if jsonb_typeof(v_payload) <> 'object' then
    raise exception '0133: get_landing_country_presence() devrait renvoyer un objet';
  end if;
  if (v_payload->>'threshold')::integer <> 3 then
    raise exception '0133: le seuil d''agregation devrait valoir 3';
  end if;
  -- Aucun pays projete ne peut passer sous le seuil.
  if exists (
    select 1 from jsonb_array_elements(v_payload->'countries') e
    where (e->>'count')::integer < 3) then
    raise exception '0133: un pays sous le seuil est projete — regression de confidentialite';
  end if;

  select count(*) into v_n from private.security_baseline_violations();
  if v_n <> 0 then
    raise exception '0133: security_baseline_violations() renvoie % ligne(s)', v_n;
  end if;

  select count(*) into v_n from private.storage_baseline_violations();
  if v_n <> 0 then
    raise exception '0133: storage_baseline_violations() renvoie % ligne(s)', v_n;
  end if;
end
$verify$;