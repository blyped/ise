-- =====================================================================
-- 0068_landing_media_public_bucket
--
-- LE BUCKET PUBLIC DE LA VITRINE — ET LUI SEUL.
--
-- DEFAUT CORRIGE
--   Les huit buckets de 0027 sont prives (`public = false`, D-73). PUB-001
--   est une page servie a des visiteurs ANONYMES : il n'existait donc
--   aucune URL d'image qu'un anonyme puisse charger. `landingMediaUrl()`
--   renvoyait `null`, aucune balise `img` n'etait emise, et le carrousel,
--   les couvertures d'actualites, les logos de partenaires et l'avatar de
--   l'« ISE du jour » restaient vides. Le CMS savait stocker un visuel ; la
--   vitrine ne savait pas l'afficher. C'etait le dernier maillon manquant.
--
-- CE QUE CETTE MIGRATION FAIT, ET SES LIMITES
--   1. Cree UN bucket public, `landing-media`. C'est le SEUL bucket public
--      de la plateforme. Il ne contient que des medias editoriaux
--      deliberement publies sur la vitrine.
--   2. NE TOUCHE A AUCUN AUTRE BUCKET. `avatars`, `profile-documents`,
--      `message-attachments`, `verification-documents`, `admin-imports`,
--      `project-assets`, `support-attachments` et `public-assets` restent
--      prives (MASTER PROMPT §12, §47 ; D-73).
--   3. Etend `private.storage_baseline_violations()` : la CI ECHOUE si un
--      autre bucket devient public, ET si `landing-media` cesse de l'etre.
--
-- POURQUOI UN BUCKET PUBLIC PLUTOT QUE DES URL SIGNEES
--   Une URL signee est nominative et expire. Sur une page anonyme mise en
--   cache 300 s (ADDENDUM §46), il faudrait re-signer chaque visuel a
--   chaque rendu — donc rendre la page non cacheable — et l'URL signee
--   fuirait de toute facon vers n'importe qui, sans expiration utile a
--   l'echelle d'un CDN. Un bucket public dont le contenu est, par
--   construction, du materiel editorial publie, dit la verite sur ce qu'il
--   contient. Decision D-134.
--
-- LE CAS DE L'AVATAR DE L'« ISE DU JOUR » — D-135
--   Les avatars vivent dans `avatars`, prive, et Y RESTENT. Le teaser
--   n'affiche PAS de photographie : il affiche un monogramme (les initiales
--   dans une pastille). `get_landing_featured_profile()` CESSE meme de
--   projeter `avatar_path` : un chemin de bucket prive n'a rien a faire
--   dans une reponse anonyme. Justification complete dans docs/decisions.md
--   (D-135). En resume : `allow_public_feature` consent a la PARUTION d'un
--   teaser textuel dont les champs sont enumeres ; il ne consent pas a la
--   copie d'une photographie de la personne dans un espace mondialement
--   lisible et indexable. Reutiliser ce consentement pour cela serait un
--   detournement de finalite (MASTER PROMPT §47).
--
-- Ne pas editer : toute correction passe par une nouvelle migration.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Helper de chemin
--    Les chemins sont organises PAR USAGE, pas par identifiant metier
--    (contrairement a D-11, qui vise les donnees personnelles) : un media
--    editorial n'appartient a personne, il appartient a un emplacement de
--    la vitrine.
--      landing-media/carousel/...   diapositives
--      landing-media/partners/...   logos et visuels de campagne
--      landing-media/news/...       couvertures d'actualites
--      landing-media/sections/...   illustrations de section
-- ---------------------------------------------------------------------
create or replace function private.is_landing_media_path(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select private.storage_segment(p_name, 1)
           in ('carousel', 'partners', 'news', 'sections')
     and private.storage_segment(p_name, 2) is not null
$$;

-- D-126, TROISIEME OCCURRENCE. Le bloc de verification du §7 a fait ECHOUER
-- cette migration au premier essai : `is_landing_media_path()` naissait avec
-- `proacl = NULL`, c'est-a-dire `EXECUTE` pour `PUBLIC` — donc pour `anon`.
-- Le garde-fou `pg_default_acl` de 0066 ne s'applique qu'au rolE createur de
-- l'entree, et la connexion de migration n'est pas celui-la. Meme lecon qu'en
-- 0062 et 0067 : ne jamais compter sur un defaut, poser le privilege.
revoke all on function private.is_landing_media_path(text) from public, anon;
grant execute on function private.is_landing_media_path(text) to authenticated;

comment on function private.is_landing_media_path(text) is
  'Vrai si le chemin d''objet est range sous l''un des quatre usages de la vitrine. Un depot hors de ces prefixes est refuse par la politique d''ecriture.';

-- ---------------------------------------------------------------------
-- 2. Le bucket
--    5 Mo, comme `public-assets` (D-84) et comme la contrainte
--    `cms_media_assets_size_bytes_check`. Images uniquement.
--
--    PAS DE SVG. Un SVG est un document XML qui peut porter du script :
--    servi depuis un bucket public sur le domaine Supabase, il s'executerait
--    dans le contexte de ce domaine. AVIF est admis en revanche : c'est un
--    format matriciel, sans surface d'execution.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'landing-media', 'landing-media', true, 5242880::bigint,
  array['image/png', 'image/jpeg', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public             = true,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Ceinture et bretelles : reaffirme que les huit buckets de 0027 sont prives.
-- Si l'un d'eux a ete ouvert a la main dans la console, cette migration le
-- referme, et le controle du §6 fera echouer la CI la prochaine fois.
update storage.buckets set public = false
where id <> 'landing-media' and public;

-- ---------------------------------------------------------------------
-- 3. Politiques sur storage.objects
--
--    AUCUNE POLITIQUE N'EST OUVERTE A `anon`, ici comme ailleurs.
--    La lecture anonyme d'un bucket public ne passe pas par la RLS : elle
--    passe par l'endpoint `/storage/v1/object/public/<bucket>/<chemin>`,
--    que le service Storage sert sans consulter `storage.objects`. Ajouter
--    une politique `to anon` n'ouvrirait donc rien de plus, et ferait
--    echouer le controle `storage_anon_policy` pose en 0027 — un controle
--    qui doit rester utile pour les sept autres buckets.
-- ---------------------------------------------------------------------

-- 3.1 Lecture par le back-office (listing, verification d'un depot).
drop policy if exists ise_landing_media_read on storage.objects;
create policy ise_landing_media_read on storage.objects
  for select to authenticated
  using (bucket_id = 'landing-media' and private.has_permission('cms.read'));

-- 3.2 Depot : `cms.media.manage`, et seulement sous un prefixe d'usage connu.
drop policy if exists ise_landing_media_insert on storage.objects;
create policy ise_landing_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'landing-media'
    and private.has_permission('cms.media.manage')
    and private.is_landing_media_path(name)
  );

-- 3.3 Remplacement d'un objet : meme exigence.
drop policy if exists ise_landing_media_update on storage.objects;
create policy ise_landing_media_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'landing-media'
    and private.has_permission('cms.media.manage')
  )
  with check (
    bucket_id = 'landing-media'
    and private.has_permission('cms.media.manage')
    and private.is_landing_media_path(name)
  );

-- 3.4 Suppression : `cms.media.manage`. Le prefixe n'est pas exige pour
--     supprimer : un objet mal range doit pouvoir etre retire.
drop policy if exists ise_landing_media_delete on storage.objects;
create policy ise_landing_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'landing-media'
    and private.has_permission('cms.media.manage')
  );

-- ---------------------------------------------------------------------
-- 4. `cms_media_assets` porte le bucket de destination
--
--    LA COLONNE EXISTE DEJA : `bucket_id`, posee en 0057 avec le defaut
--    `public-assets` et un CHECK a une seule valeur. Ajouter une SECONDE
--    colonne de bucket creerait deux verites pour une meme information —
--    exactement ce que docs/cms.md §1 interdit. On elargit donc la
--    colonne existante :
--      * defaut  -> 'landing-media' ;
--      * CHECK   -> 'landing-media' ou 'public-assets' (legs de 0057, pour
--                   qu'aucune ligne existante ne devienne invalide).
--
--    `public-assets` reste ACCEPTE en base mais n'est plus SERVI : le §5
--    ne projette que les medias du bucket public. Un visuel oublie dans
--    l'ancien bucket disparait proprement de la vitrine plutot que d'y
--    produire une image cassee.
-- ---------------------------------------------------------------------
alter table public.cms_media_assets
  alter column bucket_id set default 'landing-media';

alter table public.cms_media_assets
  drop constraint if exists cms_media_assets_bucket_id_check;

alter table public.cms_media_assets
  add constraint cms_media_assets_bucket_id_check
  check (bucket_id in ('landing-media', 'public-assets'));

-- AVIF est admis par le bucket : la table doit l'admettre aussi, sinon un
-- depot valide cote Storage serait refuse cote metadonnees.
alter table public.cms_media_assets
  drop constraint if exists cms_media_assets_mime_type_check;

alter table public.cms_media_assets
  add constraint cms_media_assets_mime_type_check
  check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/avif'));

comment on column public.cms_media_assets.bucket_id is
  'Bucket de destination. Defaut `landing-media` (public, 0068) : c''est le seul bucket dont un visiteur anonyme peut charger un objet. `public-assets` reste tolere pour les lignes anterieures, mais n''est plus projete sur la vitrine.';

comment on table public.cms_media_assets is
  'Mediatheque CMS-008 : metadonnees des visuels editoriaux stockes dans le bucket public `landing-media` (0068). Le fichier vit dans Storage, jamais dans la base. `alt_text` est NOT NULL : un media sans alternative textuelle n''est pas publiable (addendum §52).';

-- ---------------------------------------------------------------------
-- 5. Projections : un chemin REELLEMENT exploitable cote client
--
--    Trois exigences, tenues par les deux fonctions ci-dessous :
--      a. ne projeter que ce qu'un anonyme peut effectivement charger,
--         c'est-a-dire le bucket public — sinon la vitrine fabriquerait
--         une URL 400 ;
--      b. ne projeter aucun media sans texte alternatif — la colonne est
--         NOT NULL, mais la projection le reverifie : c'est elle qui est
--         le contrat du client ;
--      c. projeter les DIMENSIONS reelles, pour que le rendu reserve la
--         place avant le chargement (CLS < 0,1, MASTER PROMPT §58).
-- ---------------------------------------------------------------------
create or replace function private.landing_media(p_media_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'bucket', m.bucket_id, 'path', m.storage_path, 'alt_text', m.alt_text,
           'credit', m.credit, 'width', m.width, 'height', m.height)
  from public.cms_media_assets m
  where m.id = p_media_id
    and m.deleted_at is null
    and m.bucket_id = 'landing-media'
    and char_length(btrim(coalesce(m.alt_text, ''))) >= 3
$$;

revoke all on function private.landing_media(uuid) from public, anon, authenticated;

comment on function private.landing_media(uuid) is
  'PUB-001 : media public-safe, par identifiant. Ne projette QUE le bucket public `landing-media` et QUE les medias pourvus d''une alternative textuelle : un client ne recoit jamais un chemin qu''il ne peut pas charger, ni une image qu''il ne pourrait pas decrire.';

-- Meme contrat, resolu par le CHEMIN. `news.image_path` et
-- `organizations.logo_path` sont du texte libre, poses par des modules
-- anterieurs au CMS : ils ne portent ni bucket, ni alternative textuelle,
-- ni dimensions. Les servir tels quels donnerait une image sans `alt` et
-- sans place reservee. On les resout donc dans la mediatheque : une
-- couverture d'actualite ne parait sur la vitrine que si son fichier y est
-- enregistre, decrit et mesure. Sinon, pas d'image — et la carte reste
-- entiere.
create or replace function private.landing_media_by_path(p_path text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'bucket', m.bucket_id, 'path', m.storage_path, 'alt_text', m.alt_text,
           'credit', m.credit, 'width', m.width, 'height', m.height)
  from public.cms_media_assets m
  where m.storage_path = btrim(coalesce(p_path, ''))
    and btrim(coalesce(p_path, '')) <> ''
    and m.deleted_at is null
    and m.bucket_id = 'landing-media'
    and char_length(btrim(coalesce(m.alt_text, ''))) >= 3
  order by m.created_at desc, m.id desc
  limit 1
$$;

revoke all on function private.landing_media_by_path(text) from public, anon, authenticated;

comment on function private.landing_media_by_path(text) is
  'PUB-001 : resout un chemin de fichier libre (news.image_path, organizations.logo_path) vers un media de la mediatheque. NULL si le fichier n''est pas enregistre dans `landing-media` avec une alternative textuelle.';

-- 5.1 Actualites — `image_path` (texte nu) devient `image` (media complet).
--     Le reste de la projection est INCHANGE, a la lettre.
create or replace function public.get_landing_news(p_limit integer default 3)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.landing_section_hidden('news') then '[]'::jsonb
         else coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id',            n.id,
                    'entity_type',   'news',
                    'title',         n.title,
                    'slug',          n.slug,
                    'summary',       n.summary,
                    'category_code', n.category_code,
                    'image',         private.landing_media_by_path(n.image_path),
                    'published_at',  n.published_at,
                    'is_featured',   n.is_featured,
                    'is_pinned',     private.landing_override_position('news', 'news', n.id) is not null)
                  order by private.landing_override_position('news', 'news', n.id) asc nulls last,
                           n.landing_priority desc, n.published_at desc, n.id desc)
           from public.news n
           where n.deleted_at is null
             and n.editorial_status = 'published'
             and n.visibility = 'members'
             and n.landing_visibility = 'visible'
             and n.published_at is not null
             and n.published_at <= now()
             and n.duplicate_of_news_id is null
             and not private.landing_is_excluded('news', 'news', n.id)
             and n.id in (
               select n2.id from public.news n2
               where n2.deleted_at is null
                 and n2.editorial_status = 'published'
                 and n2.visibility = 'members'
                 and n2.landing_visibility = 'visible'
                 and n2.published_at is not null
                 and n2.published_at <= now()
                 and n2.duplicate_of_news_id is null
                 and not private.landing_is_excluded('news', 'news', n2.id)
               order by private.landing_override_position('news', 'news', n2.id) asc nulls last,
                        n2.landing_priority desc, n2.published_at desc, n2.id desc
               limit least(greatest(coalesce(p_limit, 3), 1), 24))
         ), '[]'::jsonb) end
$$;

revoke all on function public.get_landing_news(integer) from public;
grant execute on function public.get_landing_news(integer) to anon, authenticated, service_role;

comment on function public.get_landing_news(integer) is
  'PUB-001 : dernieres actualites reellement publiees, issues du module Actualites (addendum §11). Le corps de l''article n''est jamais projete. Depuis 0068 : `image` porte un media complet (bucket public, alternative textuelle, dimensions) au lieu du chemin nu `image_path`.';

-- 5.2 Partenaires — le logo d'organisation devient un media complet.
create or replace function public.get_landing_partners(p_placement text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.landing_section_hidden('partners') then '[]'::jsonb
         else coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id',               pc.id,
                    'entity_type',      'organization',
                    'organization_id',  org.id,
                    'organization_name', org.canonical_name,
                    'organization_logo', private.landing_media_by_path(org.logo_path),
                    'campaign_name',    pc.published_snapshot->>'campaign_name',
                    'placement',        pc.placement,
                    'title',            pc.published_snapshot->>'title',
                    'description',      pc.published_snapshot->>'description',
                    'cta_label',        pc.published_snapshot->>'cta_label',
                    'target_entity_type', pc.published_snapshot->>'target_entity_type',
                    'target_entity_id',   pc.published_snapshot->>'target_entity_id',
                    'target_url',       pc.published_snapshot->>'target_url',
                    'sponsored_label',  pc.sponsored_label,
                    'media',            private.landing_media((pc.published_snapshot->>'media_id')::uuid),
                    'mobile_media',     private.landing_media((pc.published_snapshot->>'mobile_media_id')::uuid))
                  order by pc.placement, pc.start_at desc, pc.id)
           from public.cms_partner_campaigns pc
           join public.organizations org on org.id = pc.organization_id
           where pc.status = 'published'
             and pc.published_snapshot is not null
             and pc.start_at <= now()
             and pc.end_at   >  now()
             and (p_placement is null or pc.placement = p_placement)
         ), '[]'::jsonb) end
$$;

revoke all on function public.get_landing_partners(text) from public;
grant execute on function public.get_landing_partners(text) to anon, authenticated, service_role;

comment on function public.get_landing_partners(text) is
  'PUB-001 : campagnes partenaires actives. sponsored_label accompagne SYSTEMATIQUEMENT la campagne (addendum §26). Depuis 0068 : `organization_logo` porte un media complet issu de la mediatheque, ou NULL.';

-- 5.3 « ISE du jour » — `avatar_path` N'EST PLUS PROJETE (D-135).
--     Le reste est identique a 0061, a la lettre.
create or replace function public.get_landing_featured_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_day        date := (now() at time zone 'utc')::date;
  v_profile    uuid;
  v_date       date;
  v_mode       text;
  v_result     jsonb;
begin
  if private.landing_section_hidden('featured_profile') then
    return null;
  end if;

  select h.profile_id, h.featured_date, h.selection_mode
    into v_profile, v_date, v_mode
  from public.cms_featured_profile_history h
  where h.status = 'published'
    and h.featured_date <= v_day
    and private.featured_profile_eligible(h.profile_id, v_day)
  order by h.featured_date desc
  limit 1;

  if v_profile is null then
    return null;
  end if;

  select jsonb_build_object(
           'entity_type',      'profile',
           'profile_id',       p.id,
           'display_name',     coalesce(nullif(btrim(p.display_name), ''),
                                        btrim(p.first_name || ' ' || p.last_name)),
           'promotion',        case when pr.id is not null
                                    then jsonb_build_object('id', pr.id, 'name', pr.name,
                                                            'graduation_year', pr.graduation_year) end,
           'current_position', p.current_position,
           'organization',     org.canonical_name,
           'public_summary',   p.public_summary,
           -- D-135 : aucune photographie, et pas meme son chemin. Le bucket
           -- `avatars` est prive ; projeter `p.avatar_path` divulguerait la
           -- structure d'un espace prive a un visiteur anonyme, pour une
           -- valeur nulle puisque l'objet n'est pas chargeable. Le teaser
           -- affiche un monogramme construit depuis `display_name`.
           'expertise_areas',  coalesce((
                                 select jsonb_agg(jsonb_build_object('id', ea.id, 'name', ea.name,
                                                                     'slug', ea.slug)
                                                  order by ea.sort_order, ea.name)
                                 from public.profile_expertise_areas pea
                                 join public.expertise_areas ea on ea.id = pea.expertise_area_id
                                 where pea.profile_id = p.id and ea.is_active), '[]'::jsonb),
           'featured_date',    v_date,
           'selection_mode',   v_mode)
    into v_result
  from public.ise_profiles p
  left join public.promotions    pr  on pr.id  = p.promotion_id
  left join public.organizations org on org.id = p.current_organization_id
  where p.id = v_profile;

  return v_result;
end
$$;

revoke all on function public.get_landing_featured_profile() from public;
grant execute on function public.get_landing_featured_profile() to anon, authenticated, service_role;

comment on function public.get_landing_featured_profile() is
  'PUB-001 : teaser « ISE du jour », COMPOSE depuis ise_profiles (addendum §15). Aucune donnee privee. Depuis 0068 : `avatar_path` n''est plus projete (D-135) — le bucket `avatars` est prive et le teaser affiche un monogramme.';

-- ---------------------------------------------------------------------
-- 6. Garde-fou etendu
--
--    Trois controles nouveaux :
--      * `public_bucket` ne tolere QUE `landing-media`. Rendre `avatars`
--        public fait echouer la CI ;
--      * `landing_media_not_public` : si quelqu'un referme `landing-media`,
--        la vitrine perd toutes ses images SANS erreur visible cote base.
--        Un manque silencieux est pire qu'une panne bruyante (§98) ;
--      * `bucket_mime_allows_svg` : aucun bucket n'accepte de SVG.
-- ---------------------------------------------------------------------
create or replace function private.storage_baseline_violations()
returns table (kind text, object_name text, detail text)
language sql
stable
security definer
set search_path = ''
as $$
  select 'public_bucket', b.id::text,
         'bucket expose au web public alors que seul landing-media peut l''etre (D-73, D-134)'
  from storage.buckets b
  where b.public and b.id <> 'landing-media'
  union all
  select 'landing_media_missing', 'landing-media',
         'le bucket editorial public n''existe pas (0068)'
  where not exists (select 1 from storage.buckets b where b.id = 'landing-media')
  union all
  select 'landing_media_not_public', 'landing-media',
         'landing-media n''est plus public : PUB-001 n''affiche plus aucune image (D-134)'
  where exists (select 1 from storage.buckets b where b.id = 'landing-media' and not b.public)
  union all
  select 'bucket_without_policy', b.id::text, 'aucune politique storage.objects ne cite ce bucket'
  from storage.buckets b
  where not exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage' and c.relname = 'objects'
      and (coalesce(pg_get_expr(p.polqual, p.polrelid), '')
           || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''))
          like '%''' || b.id || '''%'
  )
  union all
  select 'bucket_no_size_limit', b.id::text, 'file_size_limit non defini'
  from storage.buckets b
  where b.file_size_limit is null
  union all
  select 'bucket_no_mime_allowlist', b.id::text, 'allowed_mime_types non defini'
  from storage.buckets b
  where b.allowed_mime_types is null
  union all
  select 'bucket_mime_allows_svg', b.id::text,
         'allowed_mime_types accepte du SVG : un SVG public peut porter du script'
  from storage.buckets b
  where b.allowed_mime_types && array['image/svg+xml', 'text/xml', 'application/xml']
  union all
  select 'storage_anon_policy', p.polname::text, 'politique storage.objects ouverte a anon'
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'storage' and c.relname = 'objects'
    and exists (
      select 1 from unnest(p.polroles) r
      where r::regrole::text in ('anon', 'public')
    )
  order by 1, 2
$$;

comment on function private.storage_baseline_violations() is
  'Controle Storage execute par la CI et la suite de tests. Doit renvoyer 0 ligne. Depuis 0068 : `landing-media` est le seul bucket public tolere, et il DOIT rester public.';

-- ---------------------------------------------------------------------
-- 7. Verification — la migration echoue plutot que de mentir (§98)
-- ---------------------------------------------------------------------
do $verify$
declare
  v_n    bigint;
  v_txt  text;
begin
  -- 7.1 Le bucket existe, il est public, borne et restreint aux images.
  if not exists (
    select 1 from storage.buckets
    where id = 'landing-media' and public
      and file_size_limit = 5242880
      and allowed_mime_types @> array['image/png', 'image/jpeg', 'image/webp', 'image/avif']
      and not (allowed_mime_types && array['image/svg+xml'])
  ) then
    raise exception '0068: le bucket landing-media n''est pas dans l''etat attendu';
  end if;

  -- 7.2 Il est le SEUL public.
  select count(*) into v_n from storage.buckets where public and id <> 'landing-media';
  if v_n <> 0 then
    raise exception '0068: % bucket(s) autre(s) que landing-media sont publics', v_n;
  end if;

  -- 7.3 Les huit buckets de 0027 sont toujours prives et toujours la.
  select count(*) into v_n
  from storage.buckets
  where id in ('avatars', 'profile-documents', 'project-assets', 'message-attachments',
               'support-attachments', 'verification-documents', 'admin-imports', 'public-assets')
    and not public;
  if v_n <> 8 then
    raise exception '0068: seuls %/8 buckets historiques sont prives', v_n;
  end if;

  -- 7.4 Les quatre politiques du bucket existent.
  select count(*) into v_n
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'storage' and c.relname = 'objects'
    and p.polname in ('ise_landing_media_read', 'ise_landing_media_insert',
                      'ise_landing_media_update', 'ise_landing_media_delete');
  if v_n <> 4 then
    raise exception '0068: %/4 politiques landing-media posees', v_n;
  end if;

  -- 7.5 Aucune politique storage.objects n'est ouverte a anon.
  select count(*) into v_n
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'storage' and c.relname = 'objects'
    and exists (select 1 from unnest(p.polroles) r where r::regrole::text in ('anon', 'public'));
  if v_n <> 0 then
    raise exception '0068: % politique(s) storage.objects ouvertes a anon', v_n;
  end if;

  -- 7.6 Le defaut de bucket_id a bien bascule.
  select column_default into v_txt
  from information_schema.columns
  where table_schema = 'public' and table_name = 'cms_media_assets' and column_name = 'bucket_id';
  if v_txt is null or v_txt not like '%landing-media%' then
    raise exception '0068: cms_media_assets.bucket_id ne defaut pas a landing-media (%)', v_txt;
  end if;

  -- 7.7 `avatar_path` a bien quitte la projection publique.
  if pg_get_functiondef('public.get_landing_featured_profile()'::regprocedure) like '%''avatar_path''%' then
    raise exception '0068: get_landing_featured_profile() projette encore avatar_path (D-135)';
  end if;

  -- 7.8 Les trois helpers restent fermes a anon.
  select count(*) into v_n
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'private'
    and p.proname in ('landing_media', 'landing_media_by_path', 'is_landing_media_path')
    and pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE');
  if v_n <> 0 then
    raise exception '0068: % helper(s) media exposes a anon', v_n;
  end if;

  -- 7.9 Les deux lignes de base restent a zero.
  select count(*) into v_n from private.storage_baseline_violations();
  if v_n <> 0 then
    select string_agg(kind || ':' || object_name, ', ') into v_txt
    from private.storage_baseline_violations();
    raise exception '0068: storage_baseline_violations() renvoie % ligne(s) : %', v_n, v_txt;
  end if;

  select count(*) into v_n from private.security_baseline_violations();
  if v_n <> 0 then
    select string_agg(kind || ':' || object_name, ', ') into v_txt
    from private.security_baseline_violations();
    raise exception '0068: security_baseline_violations() renvoie % ligne(s) : %', v_n, v_txt;
  end if;
end
$verify$;
