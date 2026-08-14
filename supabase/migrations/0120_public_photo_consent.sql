-- =====================================================================
-- 0120_public_photo_consent
-- Consentement EXPLICITE a la publication d'un portrait sur le web ouvert,
-- et projection de ce portrait dans le medaillon « ISE du jour ».
--
-- REVISION DE D-135
--   D-135 refusait la photographie dans le teaser public pour trois motifs :
--     1. `allow_public_feature` consent a un teaser TEXTUEL, pas a la
--        publication d'un portrait ;
--     2. une image publiee sur le web ouvert est irreversible (CDN, moteurs,
--        archiveurs) ;
--     3. la maquette PUB-001 ne montrait pas de portrait.
--   Le porteur demande le medaillon et accepte de reviser la decision. Le
--   motif 1 est le seul qui se traite techniquement : on cree donc un
--   consentement DISTINCT, `allow_public_photo`, qui ne dit qu'une chose et
--   la dit clairement. `allow_public_feature` n'est PAS reutilise : c'est
--   exactement le detournement de finalite que D-135 reprochait.
--   Le motif 2 reste vrai et n'est pas efface par un consentement : l'ecran
--   de profil doit le dire au membre sans le minimiser (c'est fait cote web).
--
--   NOTE IMPORTANTE : le fait que la fiche profil complete soit reservee aux
--   connectes ne protege PAS la photo. L'encart « ISE du jour » est servi a
--   des visiteurs ANONYMES ; l'image y est publique, indexable et copiable.
--   C'est precisement pourquoi un consentement propre est necessaire.
--
-- LE PROBLEME DU BUCKET PRIVE, ET LA VOIE RETENUE
--   `avatars` est prive (D-73) et le reste. `landing-media` est le seul
--   bucket public (D-134). Une image ne peut donc pas etre servie
--   publiquement depuis `avatars` telle quelle.
--
--   Voie (a) ECARTEE — « copier l'avatar de `avatars` vers `landing-media`
--   au moment du consentement ». NON REALISABLE EN SQL : PostgreSQL n'a
--   aucun acces aux octets des objets de Storage (ils vivent dans S3, la
--   base ne porte que les metadonnees `storage.objects`). Une migration ne
--   peut ni lire ni ecrire un fichier de bucket. Faire semblant en creant
--   une ligne `storage.objects` pointant un fichier inexistant produirait
--   une image 404 sur la vitrine — exactement le mensonge que D-133
--   interdit pour les variantes d'images.
--   Accessoirement, il n'y a AUJOURD'HUI aucun avatar a copier : aucun ecran
--   de depot d'avatar n'est livre (D-117), `ise_profiles.avatar_path` est
--   NULL sur les 260 profils et le bucket `avatars` est vide.
--
--   Voie (b) RETENUE — le portrait public est DEPOSE DIRECTEMENT dans le
--   bucket public, par le membre lui-meme, sous un prefixe qui lui est
--   propre : `landing-media/membres/<profile_id>/<fichier>`. Aucune copie,
--   aucun transfert inter-bucket, donc aucune capacite simulee. Le geste de
--   depot EST l'acte de publication : le membre choisit sciemment l'image
--   qui paraitra, et elle n'est jamais tiree de son avatar prive.
--   `avatars` n'est pas touche, ne devient pas public, et `avatar_path`
--   n'est toujours PAS projete par la vitrine.
--
--   Corollaire : « le changement d'avatar doit rafraichir la copie
--   publique » devient sans objet — il n'existe pas de copie. Le portrait
--   public est un objet distinct, dont le cycle de vie est entierement
--   porte par les colonnes ci-dessous.
--
-- RETRAIT — trois chemins, tous couverts par un declencheur en base
--   1. revocation du consentement (`allow_public_photo` -> false) ;
--   2. suppression du compte (D-19 : `user_id` -> NULL, ou `deleted_at`) ;
--   3. remplacement du portrait (l'ancien objet part avec l'ancien chemin).
--   Dans les trois cas : les colonnes de portrait sont remises a NULL et la
--   ligne `storage.objects` correspondante est SUPPRIMEE, ce qui rend
--   immediatement l'URL publique inaccessible (le service Storage resout
--   l'objet par cette ligne).
--
--   LIMITE ASSUMEE, DITE ICI PLUTOT QUE MASQUEE — trois niveaux :
--     a. Supabase interdit desormais le DELETE direct sur `storage.objects`
--        (declencheur `storage.protect_delete()`), sauf a poser le reglage
--        de session `storage.allow_delete_query = 'true'`. C'est ce que fait
--        `private.purge_member_public_photo()` ci-dessous, en LOCAL a la
--        transaction : c'est le seul moyen d'offrir une garantie en base,
--        y compris quand aucune session du membre n'existe plus.
--     b. Supprimer la ligne retire l'objet du SERVICE (le endpoint public le
--        resout par cette ligne : il repond alors 404), mais PostgreSQL ne
--        peut pas effacer les OCTETS dans S3 — il n'y a aucun acces. Les
--        octets deviennent orphelins. Le chemin nominal (retrait demande par
--        le membre depuis /mon-profil/vitrine-publique) appelle EN PLUS
--        l'API Storage cote application, qui, elle, efface reellement le
--        fichier. Reste NON COUVERT : l'effacement physique des octets
--        lorsque le retrait vient d'une suppression de compte cote base.
--        Un nettoyage Storage periodique reste a brancher.
--     c. Comme le rappelle le motif 2 de D-135, rien ne peut rappeler une
--        image deja moissonnee par un tiers.
--
-- Ne pas editer : toute correction passe par une nouvelle migration.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Le consentement, et le portrait qu'il autorise
--
--    Colonnes portees par le PROFIL (le consentement est une propriete de
--    la personne), a la difference du visuel editorial D-165 qui est porte
--    par l'INSTANCE de mise en avant.
--
--    `public_photo_alt` est obligatoire des qu'un chemin existe : la meme
--    exigence que `cms_media_assets.alt_text` (addendum §52). Une image
--    publiee sans alternative textuelle n'est pas publiable.
-- ---------------------------------------------------------------------
alter table public.ise_profiles
  add column if not exists allow_public_photo   boolean not null default false,
  add column if not exists public_photo_path    text,
  add column if not exists public_photo_alt     text,
  add column if not exists public_photo_width   integer,
  add column if not exists public_photo_height  integer,
  add column if not exists public_photo_set_at  timestamptz;

-- Le chemin est contraint A LA LIGNE : il ne peut designer que le prefixe
-- du profil lui-meme. Un profil ne peut donc pas revendiquer le portrait
-- d'un autre, meme par une ecriture directe.
alter table public.ise_profiles
  drop constraint if exists ise_profiles_public_photo_path_scope;
alter table public.ise_profiles
  add constraint ise_profiles_public_photo_path_scope
  check (
    public_photo_path is null
    or public_photo_path like 'membres/' || id::text || '/%'
  );

alter table public.ise_profiles
  drop constraint if exists ise_profiles_public_photo_alt_required;
alter table public.ise_profiles
  add constraint ise_profiles_public_photo_alt_required
  check (
    public_photo_path is null
    or char_length(btrim(coalesce(public_photo_alt, ''))) >= 3
  );

comment on column public.ise_profiles.allow_public_photo is
  'Consentement EXPLICITE et DISTINCT a la publication d''un portrait sur le site public (revision de D-135). FAUX par defaut. Ne se confond pas avec allow_public_feature, qui ne consent qu''a un teaser textuel.';
comment on column public.ise_profiles.public_photo_path is
  'Chemin du portrait PUBLIC dans le bucket public landing-media, sous membres/<profile_id>/. Jamais une copie de avatar_path : `avatars` reste prive (D-73, D-134).';
comment on column public.ise_profiles.public_photo_alt is
  'Alternative textuelle du portrait public. Obligatoire des qu''un portrait existe (addendum §52).';
comment on column public.ise_profiles.public_photo_width is
  'Largeur reelle du portrait public, lue dans le fichier. Sert a reserver la place avant chargement (CLS, MASTER PROMPT §58).';
comment on column public.ise_profiles.public_photo_height is
  'Hauteur reelle du portrait public, lue dans le fichier.';
comment on column public.ise_profiles.public_photo_set_at is
  'Horodatage du dernier depot de portrait public. Trace de l''acte de publication.';

-- Depuis 0028, `authenticated` n'a de privileges que colonne par colonne :
-- toute colonne ajoutee doit etre GRANT-ee, sinon elle est invisible.
-- Le CONSENTEMENT est modifiable par le membre ; les colonnes de PORTRAIT
-- sont en lecture seule pour lui : elles ne s'ecrivent que par les RPC
-- ci-dessous, qui verifient le consentement et l'existence du fichier.
grant select (allow_public_photo, public_photo_path, public_photo_alt,
              public_photo_width, public_photo_height, public_photo_set_at)
  on public.ise_profiles to authenticated;
grant update (allow_public_photo) on public.ise_profiles to authenticated;
grant insert (allow_public_photo) on public.ise_profiles to authenticated;

-- ---------------------------------------------------------------------
-- 2. Le prefixe `membres/` dans le bucket public
--
--    Cinquieme usage de `landing-media`, a cote de carousel/, partners/,
--    news/ et sections/. C'est le SEUL endroit du bucket ou un membre
--    ordinaire peut ecrire, et seulement sous son propre identifiant.
-- ---------------------------------------------------------------------
create or replace function private.is_landing_media_path(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select private.storage_segment(p_name, 1)
           in ('carousel', 'partners', 'news', 'sections', 'membres')
     and private.storage_segment(p_name, 2) is not null
$$;

-- D-126 : ne jamais compter sur un defaut d'ACL, poser le privilege.
revoke all on function private.is_landing_media_path(text) from public, anon;
grant execute on function private.is_landing_media_path(text) to authenticated;

comment on function private.is_landing_media_path(text) is
  'Vrai si le chemin d''objet est range sous l''un des cinq usages de la vitrine (carousel, partners, news, sections, membres). Un depot hors de ces prefixes est refuse par la politique d''ecriture.';

-- Le consentement, lu depuis les politiques Storage. STABLE et SECURITY
-- DEFINER : les politiques de `storage.objects` s'evaluent dans une session
-- `authenticated` qui n'a aucun privilege de lecture sur cette colonne.
create or replace function private.public_photo_consent_given(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ise_profiles p
    where p.id = p_profile_id
      and p.deleted_at is null
      and p.user_id is not null
      and p.allow_public_photo
  )
$$;

revoke all on function private.public_photo_consent_given(uuid) from public, anon;
grant execute on function private.public_photo_consent_given(uuid) to authenticated;

comment on function private.public_photo_consent_given(uuid) is
  'Vrai si ce profil a donne le consentement DISTINCT de publication de son portrait sur le site public (revision D-135). Lu par les politiques Storage : sans consentement, aucun depot n''est possible.';

-- 2.1 Depot du portrait : consentement donne ET chemin = son propre prefixe.
drop policy if exists ise_landing_media_member_photo_insert on storage.objects;
create policy ise_landing_media_member_photo_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'landing-media'
    and private.storage_segment(name, 1) = 'membres'
    and private.storage_segment_uuid(name, 2) = private.current_profile_id()
    and private.storage_segment(name, 3) is not null
    and private.public_photo_consent_given(private.current_profile_id())
  );

-- 2.2 Relecture de son propre depot (verification apres televersement).
--     `ise_landing_media_read` exige `cms.read` : un membre ordinaire ne
--     verrait pas son propre fichier sans cette politique.
drop policy if exists ise_landing_media_member_photo_read on storage.objects;
create policy ise_landing_media_member_photo_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'landing-media'
    and private.storage_segment(name, 1) = 'membres'
    and private.storage_segment_uuid(name, 2) = private.current_profile_id()
  );

-- 2.3 Retrait par le membre lui-meme. AUCUNE condition de consentement ici :
--     retirer doit rester possible meme apres revocation.
drop policy if exists ise_landing_media_member_photo_delete on storage.objects;
create policy ise_landing_media_member_photo_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'landing-media'
    and private.storage_segment(name, 1) = 'membres'
    and private.storage_segment_uuid(name, 2) = private.current_profile_id()
  );

-- Pas de politique UPDATE sur `membres/` : un remplacement se fait par un
-- nouveau chemin (UUID) suivi de la suppression de l'ancien. Ecraser un
-- objet en place laisserait les CDN servir l'ancienne image sous la meme
-- URL — precisement le probleme d'irreversibilite du motif 2 de D-135.

-- ---------------------------------------------------------------------
-- 3. Retrait effectif de l'objet public
--
--    SECURITY DEFINER : appartient a `postgres`, qui contourne la RLS de
--    `storage.objects`. C'est necessaire pour le chemin « suppression de
--    compte », ou plus aucune session du membre n'existe.
-- ---------------------------------------------------------------------
create or replace function private.purge_member_public_photo(p_path text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_path is null or btrim(p_path) = '' then
    return;
  end if;

  -- Supabase interdit le DELETE direct sur `storage.objects` par le
  -- declencheur `storage.protect_delete()`, qui n'autorise l'operation que
  -- si le reglage `storage.allow_delete_query` vaut 'true'. On le pose en
  -- LOCAL (troisieme argument `true`) : il retombe a la fin de la
  -- transaction et n'ouvre donc rien au-dela de ce retrait precis.
  --
  -- Ce que ce DELETE fait et ne fait pas : il retire l'objet du SERVICE —
  -- l'URL publique repond 404 immediatement, car le endpoint public resout
  -- l'objet par cette ligne. Il n'efface PAS les octets dans S3 :
  -- PostgreSQL n'y a aucun acces. Le retrait demande par le membre appelle
  -- en plus l'API Storage cote application, qui efface reellement le
  -- fichier ; le retrait declenche par une suppression de compte, lui,
  -- laisse des octets orphelins (cf. entete, limite b).
  perform set_config('storage.allow_delete_query', 'true', true);

  delete from storage.objects
   where bucket_id = 'landing-media'
     and name = p_path;

  perform set_config('storage.allow_delete_query', 'false', true);
end
$$;

revoke all on function private.purge_member_public_photo(text) from public, anon, authenticated;

comment on function private.purge_member_public_photo(text) is
  'Retire du service l''objet portrait d''un membre (suppression de la ligne storage.objects). Les octets S3 ne sont PAS effaces : la base n''y a pas acces. Appelee par le declencheur de retrait.';

-- ---------------------------------------------------------------------
-- 4. Le declencheur de retrait — le coeur de la garantie
--
--    Aucune photo orpheline ne survit au retrait du consentement, a la
--    suppression du compte ou au remplacement du portrait. La garantie est
--    posee en BASE, pas dans un ecran : une ecriture directe sur la table
--    la declenche aussi.
-- ---------------------------------------------------------------------
create or replace function private.tg_ise_profiles_public_photo_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revoked boolean;
begin
  if tg_op = 'DELETE' then
    perform private.purge_member_public_photo(old.public_photo_path);
    return old;
  end if;

  v_revoked := (new.allow_public_photo is not true)
            or (new.user_id is null)            -- D-19 : compte supprime
            or (new.deleted_at is not null);

  -- Remplacement OU revocation : l'ANCIEN objet part dans les deux cas.
  if v_revoked or new.public_photo_path is distinct from old.public_photo_path then
    perform private.purge_member_public_photo(old.public_photo_path);
  end if;

  if v_revoked then
    new.public_photo_path   := null;
    new.public_photo_alt    := null;
    new.public_photo_width  := null;
    new.public_photo_height := null;
    new.public_photo_set_at := null;
  end if;

  return new;
end
$$;

revoke all on function private.tg_ise_profiles_public_photo_guard() from public, anon, authenticated;

comment on function private.tg_ise_profiles_public_photo_guard() is
  'Revision D-135 : garantit qu''aucun portrait public ne survit a la revocation du consentement, a la suppression du compte (D-19) ou a son remplacement.';

drop trigger if exists ise_profiles_public_photo_guard on public.ise_profiles;
create trigger ise_profiles_public_photo_guard
  before update on public.ise_profiles
  for each row
  when (old.public_photo_path is not null)
  execute function private.tg_ise_profiles_public_photo_guard();

drop trigger if exists ise_profiles_public_photo_purge on public.ise_profiles;
create trigger ise_profiles_public_photo_purge
  before delete on public.ise_profiles
  for each row
  when (old.public_photo_path is not null)
  execute function private.tg_ise_profiles_public_photo_guard();

-- ---------------------------------------------------------------------
-- 5. Enregistrement du portrait par son proprietaire
--
--    L'ecran televerse d'abord le fichier (politique 2.1), puis appelle
--    cette fonction. Elle REFUSE d'enregistrer un chemin dont l'objet
--    n'existe pas : un enregistrement sans fichier produirait une image
--    cassee sur la vitrine.
-- ---------------------------------------------------------------------
create or replace function public.set_my_public_photo(
  p_storage_path text,
  p_alt_text     text,
  p_width        integer default null,
  p_height       integer default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile uuid := private.current_profile_id();
  v_path    text := btrim(coalesce(p_storage_path, ''));
  v_alt     text := nullif(btrim(coalesce(p_alt_text, '')), '');
  v_consent boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_profile is null then
    raise exception 'no_profile' using errcode = 'P0002';
  end if;

  select p.allow_public_photo into v_consent
  from public.ise_profiles p
  where p.id = v_profile and p.deleted_at is null
  for update;

  if not found then
    raise exception 'no_profile' using errcode = 'P0002';
  end if;
  if v_consent is not true then
    raise exception 'consent_required' using errcode = '42501';
  end if;

  if v_path = '' or v_path not like 'membres/' || v_profile::text || '/%' then
    raise exception 'invalid_path' using errcode = 'P0001';
  end if;
  if v_alt is null or char_length(v_alt) < 3 or char_length(v_alt) > 200 then
    raise exception 'invalid_alt_text' using errcode = 'P0001';
  end if;

  -- Le fichier doit REELLEMENT exister dans le bucket public.
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'landing-media' and o.name = v_path
  ) then
    raise exception 'object_not_found' using errcode = 'P0002';
  end if;

  -- Le declencheur du §4 retire l'ancien objet quand le chemin change.
  update public.ise_profiles
     set public_photo_path   = v_path,
         public_photo_alt    = v_alt,
         public_photo_width  = nullif(greatest(coalesce(p_width, 0), 0), 0),
         public_photo_height = nullif(greatest(coalesce(p_height, 0), 0), 0),
         public_photo_set_at = now()
   where id = v_profile;

  perform private.log_audit(
    p_action      => 'profile.public_photo_published',
    p_object_type => 'ise_profile',
    p_object_id   => v_profile::text,
    p_context     => jsonb_build_object('path', v_path));

  return jsonb_build_object('profile_id', v_profile, 'path', v_path);
end
$$;

revoke all on function public.set_my_public_photo(text, text, integer, integer) from public, anon;
grant execute on function public.set_my_public_photo(text, text, integer, integer) to authenticated;

comment on function public.set_my_public_photo(text, text, integer, integer) is
  'Revision D-135. Enregistre le portrait PUBLIC du membre appelant, apres televersement sous landing-media/membres/<profile_id>/. Exige le consentement allow_public_photo, un texte alternatif et un fichier reellement present. Audite.';

create or replace function public.clear_my_public_photo()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile uuid := private.current_profile_id();
  v_path    text;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_profile is null then
    raise exception 'no_profile' using errcode = 'P0002';
  end if;

  select p.public_photo_path into v_path
  from public.ise_profiles p
  where p.id = v_profile
  for update;

  -- Le declencheur du §4 retire l'objet : mettre le chemin a NULL suffit.
  update public.ise_profiles
     set public_photo_path   = null,
         public_photo_alt    = null,
         public_photo_width  = null,
         public_photo_height = null,
         public_photo_set_at = null
   where id = v_profile;

  perform private.log_audit(
    p_action      => 'profile.public_photo_withdrawn',
    p_object_type => 'ise_profile',
    p_object_id   => v_profile::text,
    p_context     => jsonb_build_object('path', v_path));

  return jsonb_build_object('profile_id', v_profile, 'removed', v_path is not null);
end
$$;

revoke all on function public.clear_my_public_photo() from public, anon;
grant execute on function public.clear_my_public_photo() to authenticated;

comment on function public.clear_my_public_photo() is
  'Revision D-135. Retire le portrait public du membre appelant : colonnes remises a NULL et objet Storage supprime par le declencheur. Audite.';

-- ---------------------------------------------------------------------
-- 6. Projection public-safe du portrait consenti
--
--    Meme forme que `private.landing_media()` (bucket, path, alt_text,
--    credit, width, height) pour que le client n'ait rien a apprendre. Le
--    garde-fou est INTRINSEQUE a la fonction : sans consentement, sans
--    prefixe `membres/`, sans texte alternatif ou sur un profil supprime,
--    elle renvoie NULL. Il n'y a pas de chemin par lequel un avatar prive
--    pourrait en sortir : elle ne lit jamais `avatar_path`.
-- ---------------------------------------------------------------------
create or replace function private.landing_member_photo(p_profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'bucket',   'landing-media',
           'path',     p.public_photo_path,
           'alt_text', p.public_photo_alt,
           'credit',   null::text,
           'width',    p.public_photo_width,
           'height',   p.public_photo_height)
  from public.ise_profiles p
  where p.id = p_profile_id
    and p.deleted_at is null
    and p.user_id is not null
    and p.allow_public_photo
    and p.public_photo_path is not null
    and p.public_photo_path like 'membres/' || p.id::text || '/%'
    and char_length(btrim(coalesce(p.public_photo_alt, ''))) >= 3
    and exists (
      select 1 from storage.objects o
      where o.bucket_id = 'landing-media' and o.name = p.public_photo_path)
$$;

revoke all on function private.landing_member_photo(uuid) from public, anon, authenticated;

comment on function private.landing_member_photo(uuid) is
  'PUB-001 : portrait PUBLIC consenti d''un membre, au meme format que private.landing_media(). Renvoie NULL sans consentement allow_public_photo, sans texte alternatif, hors prefixe membres/, ou si le fichier n''existe plus. Ne lit jamais avatar_path (bucket prive, D-73).';

-- ---------------------------------------------------------------------
-- 7. Le teaser « ISE du jour » projette enfin un portrait
--
--    ORDRE DE PRIORITE, inchangeable sans nouvelle migration :
--      1. visuel editorial choisi par l'admin pour cette mise en avant
--         (D-165) — l'admin garde la main ;
--      2. sinon, portrait public consenti du membre (cette migration) ;
--      3. sinon NULL — le composant retombe sur le monogramme (D-135).
--
--    Corps identique a la forme live (0112), seule la cle `photo` change.
-- ---------------------------------------------------------------------
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
  v_media_id   uuid;
  v_tagline    text;
  v_result     jsonb;
begin
  if private.landing_section_hidden('featured_profile') then
    return null;
  end if;

  select h.profile_id, h.featured_date, h.selection_mode, h.showcase_media_id, h.showcase_tagline
    into v_profile, v_date, v_mode, v_media_id, v_tagline
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
           -- Toujours AUCUN avatar prive, ni son chemin : `avatars` reste
           -- prive (D-73, D-134). Les deux sources possibles de `photo`
           -- vivent dans le bucket PUBLIC `landing-media` :
           --   * le visuel editorial de l'admin (D-165), prioritaire ;
           --   * le portrait deliberement publie par le membre, et
           --     seulement s'il a donne le consentement dedie
           --     `allow_public_photo` (revision D-135).
           'photo',            coalesce(
                                 case when v_media_id is null then null
                                      else private.landing_media(v_media_id) end,
                                 private.landing_member_photo(p.id)),
           'tagline',          v_tagline,
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
  'PUB-001 : teaser « ISE du jour », COMPOSE depuis ise_profiles (addendum §15). Aucune donnee privee. `avatar_path` toujours absent (D-135). `photo` vient du bucket PUBLIC : visuel editorial de l''admin (D-165) en priorite, sinon portrait du membre ayant donne le consentement dedie allow_public_photo (revision D-135), sinon NULL (monogramme).';

-- ---------------------------------------------------------------------
-- 8. Eligibilite : « toutes les zones necessaires sont remplies »
--
--    Le porteur veut que la selection automatique ne retienne qu'un profil
--    reellement pret a paraitre. On AJOUTE deux exigences aux conditions
--    existantes, sans en retirer aucune (l'exclusion des comptes de test
--    de D-130 en particulier) :
--      * la breve description doit exister ET ne pas etre vide apres
--        nettoyage — `public_summary is not null` laissait passer une
--        chaine d'espaces ;
--      * le nom d'affichage doit etre exploitable, sinon la carte parait
--        sans titre.
--    La PHOTO n'est PAS exigee : elle est facultative par construction (le
--    monogramme reste un rendu valide), et l'exiger reviendrait a faire
--    dependre la parution d'un consentement supplementaire.
-- ---------------------------------------------------------------------
create or replace function private.featured_profile_eligible(
  p_profile_id uuid,
  p_for_date   date default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with d as (select coalesce(p_for_date, (now() at time zone 'utc')::date) as day),
       rules as (select * from public.cms_featured_profile_rules where is_active limit 1)
  select exists (
    select 1
    from public.ise_profiles p, d, rules r
    where p.id = p_profile_id
      and p.deleted_at is null
      and p.profile_status = 'active'
      and p.allow_public_feature
      and p.public_summary is not null
      and char_length(btrim(p.public_summary)) > 0
      and char_length(btrim(coalesce(nullif(btrim(p.display_name), ''),
                                     p.first_name || ' ' || p.last_name))) > 0
      and not p.is_test_account
      and (not r.require_claimed_profile or p.claim_status = 'claimed')
      and (not r.require_promotion       or p.promotion_id is not null)
      and (not r.require_avatar          or p.avatar_path is not null)
      and (not r.require_expertise_or_position
           or p.current_position is not null
           or exists (select 1 from public.profile_expertise_areas pea where pea.profile_id = p.id))
      and not exists (
        select 1 from public.reports rep
        where rep.target_type = 'profile' and rep.target_id = p.id
          and rep.status in ('open', 'reviewing'))
      and not exists (
        select 1 from public.moderation_actions ma
        where ma.target_type = 'profile' and ma.target_id = p.id
          and ma.action_type in ('temporary_suspension', 'account_suspension')
          and (ma.suspension_until is null or ma.suspension_until > now()))
      and not exists (
        select 1 from public.cms_content_overrides o
        where o.section_key = 'featured_profile' and o.override_kind = 'exclude'
          and o.entity_type = 'profile' and o.entity_id = p.id
          and o.starts_at <= now() and (o.ends_at is null or o.ends_at > now()))
  )
$$;

revoke all on function private.featured_profile_eligible(uuid, date) from public, anon, authenticated;

comment on function private.featured_profile_eligible(uuid, date) is
  'Predicat d''eligibilite de « ISE du jour » (addendum §17). Ne lit aucun signal de popularite (addendum §19). Depuis 0120, exige une breve description NON VIDE et un nom d''affichage exploitable : le systeme ne choisit qu''un profil dont les zones necessaires sont remplies.';

-- L'index partiel `ise_profiles_public_feature_idx` (0057) reste valable :
-- ses predicats sont un sur-ensemble filtre par la nouvelle condition de
-- non-vacuite, qui se verifie sur les lignes deja restreintes. Rien a
-- reconstruire.

-- ---------------------------------------------------------------------
-- 9. Verifications (D-125, D-135 revisee) : aucune fuite introduite.
-- ---------------------------------------------------------------------
do $verify$
declare
  v_n   integer;
  v_def text := pg_get_functiondef('public.get_landing_featured_profile()'::regprocedure);
begin
  -- 9.1 L'interdit d'origine tient toujours : pas d'avatar prive projete.
  if v_def like '%''avatar_path''%' or v_def like '%p.avatar_path%' then
    raise exception '0120: get_landing_featured_profile() projette avatar_path (D-135)';
  end if;

  -- 9.2 Le garde-fou est REMPLACE, pas supprime : la photo projetee doit
  --     passer par une projection publique consentie.
  if v_def not like '%private.landing_member_photo(p.id)%' then
    raise exception '0120: la photo consentie n''est pas projetee par landing_member_photo()';
  end if;
  if v_def not like '%private.landing_media(v_media_id)%' then
    raise exception '0120: le visuel editorial D-165 a disparu de la projection';
  end if;

  -- 9.3 La projection consentie exige bien le consentement dedie.
  if pg_get_functiondef('private.landing_member_photo(uuid)'::regprocedure)
       not like '%allow_public_photo%' then
    raise exception '0120: landing_member_photo() ne verifie pas allow_public_photo';
  end if;

  -- 9.4 Aucun portrait enregistre hors du prefixe public `membres/`.
  select count(*) into v_n
  from public.ise_profiles p
  where p.public_photo_path is not null
    and p.public_photo_path not like 'membres/' || p.id::text || '/%';
  if v_n <> 0 then
    raise exception '0120: % portrait(s) hors du prefixe membres/<profile_id>/', v_n;
  end if;

  -- 9.5 Aucun portrait subsistant sans consentement.
  select count(*) into v_n
  from public.ise_profiles p
  where p.public_photo_path is not null
    and (p.allow_public_photo is not true or p.user_id is null or p.deleted_at is not null);
  if v_n <> 0 then
    raise exception '0120: % portrait(s) survivent sans consentement', v_n;
  end if;

  -- 9.6 Lignes de base du projet.
  select count(*) into v_n from private.security_baseline_violations();
  if v_n <> 0 then
    raise exception '0120: security_baseline_violations() renvoie % ligne(s)', v_n;
  end if;

  select count(*) into v_n from private.storage_baseline_violations();
  if v_n <> 0 then
    raise exception '0120: storage_baseline_violations() renvoie % ligne(s)', v_n;
  end if;
end
$verify$;
