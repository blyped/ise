-- =====================================================================
-- 0129_landing_pillars_editable_text
--
-- Rend le TITRE et le CORPS de chaque pilier de « Un reseau concu pour
-- etre utile » modifiables depuis /cms/piliers, au meme titre que le
-- visuel, la legende et le lien.
--
-- POURQUOI CE REVIREMENT
--   0114 (D-168) a pose cms_pillars en ecrivant noir sur blanc que « le
--   titre et le corps de chaque pilier restent un discours de marque fixe
--   (fr.public.pillars) ». A l'usage, ce n'etait pas une frontiere tenable :
--   l'administrateur voit dans /cms/piliers une carte qui affiche son titre
--   et son texte, et trois champs qui ne les touchent pas. Le porteur du
--   projet l'a signale mot pour mot — « je ne sais meme plus comment on
--   ajoute une image et modifie ou ajoute du texte sur les encarts ». Un
--   ecran d'administration qui montre un texte sans permettre de le changer
--   est un ecran qui ment sur son perimetre. Le titre et le corps d'un
--   pilier rejoignent donc la partie editoriale pilotee par le CMS.
--
-- CE QUI EST AJOUTE
--   * cms_pillars.title — sur-titre du pilier (« Connecter »…), 2 a 60
--     caracteres, ou NULL ;
--   * cms_pillars.body  — corps du pilier, 2 a 280 caracteres, ou NULL.
--     280 est la limite deja appliquee a `caption` par le formulaire CMS
--     (PillarForm.tsx, maxLength=280) : le corps ne joue pas dans une autre
--     categorie que la legende, il garde donc la meme borne. Note au
--     passage : `caption` n'avait AUCUNE contrainte cote base, la limite
--     n'existait que dans le navigateur. Les deux nouvelles colonnes sont,
--     elles, bornees des deux cotes.
--
-- NULL VEUT DIRE « VALEUR D'ORIGINE », PAS « VIDE »
--   Les deux colonnes sont nullables et le frontend retombe alors sur le
--   texte d'usine (`fr.public.pillars.defaults`, i18n). Raison : un pilier
--   sans titre serait une carte vide sur la page d'accueil — un contenu
--   casse, pas un choix editorial. Vider le champ dans le CMS est donc
--   l'action « revenir au texte d'origine », et c'est ce que dit l'aide du
--   champ. Il n'y a pas deux sources de verite concurrentes : la base est
--   la seule source du texte affiche, l'i18n n'est plus qu'un jeu de
--   valeurs par defaut, explicitement nomme comme tel.
--
-- AUCUN TEXTE NE DISPARAIT AU DEPLOIEMENT
--   Les quatre lignes existantes sont initialisees avec exactement les
--   textes aujourd'hui en dur dans fr.public.pillars. Une migration qui
--   laisserait les colonnes a NULL serait invisible ici (le repli i18n
--   couvrirait), mais l'administrateur ouvrirait /cms/piliers sur quatre
--   champs vides sans savoir quoi y remettre. Le seed rend l'ecran
--   immediatement lisible : il montre le texte reellement publie.
--   Le `where title is null` garantit qu'un rejeu ne reecrit jamais un
--   texte saisi par un administrateur (meme garde-fou que 0122).
--
-- CE QUE CETTE MIGRATION NE FAIT PAS
--   * elle ne cree ni ne supprime de pilier (4 lignes fixes, 0114) ;
--   * elle n'elargit pas la liste blanche des liens ;
--   * elle ne touche pas a `caption`, qui reste un complement optionnel
--     AU corps, distinct de lui.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Colonnes.
-- ---------------------------------------------------------------------
alter table public.cms_pillars
  add column if not exists title text,
  add column if not exists body  text;

alter table public.cms_pillars
  drop constraint if exists cms_pillars_title_check;
alter table public.cms_pillars
  add constraint cms_pillars_title_check
  check (title is null or char_length(btrim(title)) between 2 and 60);

alter table public.cms_pillars
  drop constraint if exists cms_pillars_body_check;
alter table public.cms_pillars
  add constraint cms_pillars_body_check
  check (body is null or char_length(btrim(body)) between 2 and 280);

comment on column public.cms_pillars.title is
  '0129. Sur-titre du pilier (2-60 car.). NULL = valeur d''origine (fr.public.pillars.defaults) : jamais une carte sans titre.';
comment on column public.cms_pillars.body is
  '0129. Corps du pilier (2-280 car., meme borne que la legende cote formulaire). NULL = valeur d''origine (fr.public.pillars.defaults).';

comment on table public.cms_pillars is
  '0114, etendu par 0129. Contenu editorial des quatre piliers de « Un reseau concu pour etre utile » : titre, corps, image, legende optionnelle et lien. Titre et corps a NULL = repli sur les valeurs d''origine i18n.';

-- ---------------------------------------------------------------------
-- 2. Reprise a l'identique des textes aujourd'hui en dur dans l'i18n.
--    Ces quatre couples sont copies mot pour mot de fr.public.pillars
--    (apps/web/src/i18n/fr.ts), apostrophes typographiques comprises.
-- ---------------------------------------------------------------------
update public.cms_pillars
   set title = 'Connecter',
       body  = 'Trouvez l’expertise et la bonne personne.',
       updated_at = now()
 where pillar_key = 'connecter' and title is null and body is null;

update public.cms_pillars
   set title = 'Entraider',
       body  = 'Demandez ou apportez une aide ciblée.',
       updated_at = now()
 where pillar_key = 'entraider' and title is null and body is null;

update public.cms_pillars
   set title = 'Collaborer',
       body  = 'Montez missions, projets et consortiums.',
       updated_at = now()
 where pillar_key = 'collaborer' and title is null and body is null;

update public.cms_pillars
   set title = 'Impacter',
       body  = 'Mesurez les résultats professionnels facilités.',
       updated_at = now()
 where pillar_key = 'impacter' and title is null and body is null;

-- ---------------------------------------------------------------------
-- 3. Ecriture — la signature gagne deux parametres.
--    `create or replace` creerait une SURCHARGE (argument list differente)
--    et rendrait l'appel ambigu : l'ancienne signature est donc retiree.
-- ---------------------------------------------------------------------
drop function if exists public.set_landing_pillar(text, uuid, text, text);

create or replace function public.set_landing_pillar(
  p_pillar_key  text,
  p_media_id    uuid default null,
  p_caption     text default null,
  p_link_target text default null,
  p_title       text default null,
  p_body        text default null)
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
  v_title   text := nullif(btrim(coalesce(p_title, '')), '');
  v_body    text := nullif(btrim(coalesce(p_body, '')), '');
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

  -- Bornes verifiees ici pour renvoyer une erreur nommee plutot que de
  -- laisser remonter une violation de CHECK illisible pour l'appelant.
  if v_title is not null and char_length(v_title) not between 2 and 60 then
    raise exception 'invalid_title' using errcode = 'P0001';
  end if;
  if v_body is not null and char_length(v_body) not between 2 and 280 then
    raise exception 'invalid_body' using errcode = 'P0001';
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
         title       = v_title,
         body        = v_body,
         updated_at  = now()
   where pillar_key = p_pillar_key;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  perform private.log_audit(
    p_action      => 'cms.landing_pillar',
    p_object_type => 'pillar',
    p_object_id   => p_pillar_key,
    p_context     => jsonb_build_object(
                       'media_id', p_media_id, 'caption', v_caption,
                       'link_target', v_link, 'title', v_title, 'body', v_body));

  return jsonb_build_object(
    'pillar_key', p_pillar_key, 'media_id', p_media_id, 'caption', v_caption,
    'link_target', v_link, 'title', v_title, 'body', v_body);
end
$$;

revoke all on function public.set_landing_pillar(text, uuid, text, text, text, text) from public, anon;
grant execute on function public.set_landing_pillar(text, uuid, text, text, text, text) to authenticated, service_role;

comment on function public.set_landing_pillar(text, uuid, text, text, text, text) is
  'CMS-011 (0114, etendu par 0129). Pose le titre, le corps, l''image, la legende optionnelle et le lien d''un pilier. Exige cms.edit. Titre/corps vides = retour aux valeurs d''origine i18n.';

-- ---------------------------------------------------------------------
-- 4. Lecture CMS.
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
             'title',       p.title,
             'body',        p.body,
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
  'CMS-011 (0114, etendu par 0129). Les 4 piliers (titre, corps, image, legende, lien), toujours dans l''ordre Connecter/Entraider/Collaborer/Impacter. Exige cms.read.';

-- ---------------------------------------------------------------------
-- 5. Lecture publique (anon inclus, deja en liste blanche depuis 0114).
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
             'title',       p.title,
             'body',        p.body,
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
  'PUB-001 (0114, etendu par 0129). Titre, corps, image, legende optionnelle et lien de chaque pilier de « Un reseau concu pour etre utile ». Un titre ou un corps NULL signale au frontend de reprendre la valeur d''origine i18n.';

-- ---------------------------------------------------------------------
-- 6. Verification.
-- ---------------------------------------------------------------------
do $verify$
declare
  v_n integer;
begin
  select count(*) into v_n from public.cms_pillars;
  if v_n <> 4 then
    raise exception '0129: cms_pillars devrait contenir 4 lignes, en contient %', v_n;
  end if;

  -- Le point critique : aucun texte n'a disparu de la page d'accueil.
  select count(*) into v_n
  from public.cms_pillars
  where coalesce(btrim(title), '') = '' or coalesce(btrim(body), '') = '';
  if v_n <> 0 then
    raise exception '0129: % pilier(s) sans titre ou sans corps en base', v_n;
  end if;

  select count(*) into v_n
  from public.cms_pillars
  where (pillar_key = 'connecter'  and title = 'Connecter')
     or (pillar_key = 'entraider'  and title = 'Entraider')
     or (pillar_key = 'collaborer' and title = 'Collaborer')
     or (pillar_key = 'impacter'   and title = 'Impacter');
  if v_n <> 4 then
    raise exception '0129: les 4 titres d''origine ne sont pas tous repris (% trouve(s))', v_n;
  end if;

  if exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_landing_pillar'
    group by p.proname having count(*) <> 1) then
    raise exception '0129: set_landing_pillar ne doit exister qu''en une seule signature';
  end if;

  select count(*) into v_n from private.security_baseline_violations();
  if v_n <> 0 then
    raise exception '0129: security_baseline_violations() renvoie % ligne(s)', v_n;
  end if;

  select count(*) into v_n from private.storage_baseline_violations();
  if v_n <> 0 then
    raise exception '0129: storage_baseline_violations() renvoie % ligne(s)', v_n;
  end if;
end
$verify$;
