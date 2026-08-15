-- =====================================================================
-- 0141_public_photo_crop
-- Cadrage ajustable du portrait public (« ISE du jour »).
--
-- CONTEXTE — le porteur veut pouvoir « ajuster un peu la photo pour
-- qu'elle match bien dans le cadre ». Le medaillon est un cercle de taille
-- fixe (128px, `object-fit: cover`) : une photo dont le sujet n'est pas
-- centre peut y etre mal cadree (front coupe, sujet decale...).
--
-- CE QUE CETTE MIGRATION FAIT, ET CE QU'ELLE NE FAIT PAS
--   * elle AJOUTE trois coordonnees de cadrage — position horizontale,
--     position verticale, zoom — a cote de `public_photo_path` ;
--   * elle NE TOUCHE JAMAIS AUX OCTETS de l'image deposee par
--     `set_my_public_photo()` (migration 0120) : aucun recadrage serveur,
--     aucune nouvelle variante generee. Le cadrage est purement un contrat
--     d'AFFICHAGE, traduit cote client en `object-position` / `transform`
--     CSS, partout ou la vignette est rendue (`LandingMediaImage`).
--   * meme philosophie que le reste de 0120 : les colonnes de PORTRAIT
--     restent en lecture seule pour le membre (GRANT SELECT uniquement) ;
--     leur ecriture passe par une nouvelle RPC dediee,
--     `set_my_public_photo_crop()`, jamais par un GRANT UPDATE direct.
--
-- BORNES — alignees sur ce qu'un curseur peut raisonnablement produire :
--   * position horizontale/verticale : 0 a 100 (pourcentage du cadre) ;
--   * zoom : 1.0 (aucun agrandissement) a 3.0 (zoom fort). En dessous de
--     1.0 l'image se retrecirait dans son cadre et laisserait un vide ;
--     au-dela de 3.0 le sujet devient illisible.
--
-- REMISE A ZERO AUTOMATIQUE — le declencheur existant de 0120
-- (`tg_ise_profiles_public_photo_guard`) est etendu : le cadrage revient au
-- centre (50/50, zoom 1.0) des que le portrait est retire (revocation,
-- suppression de compte) OU remplace par un nouveau fichier. Un cadrage
-- pense pour une image n'a aucun sens applique a une autre.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Colonnes de cadrage, portees par le PROFIL comme le reste du
--    portrait public.
-- ---------------------------------------------------------------------
alter table public.ise_profiles
  add column if not exists public_photo_focal_x numeric(5,2) not null default 50.0,
  add column if not exists public_photo_focal_y numeric(5,2) not null default 50.0,
  add column if not exists public_photo_zoom    numeric(3,2) not null default 1.0;

alter table public.ise_profiles
  drop constraint if exists ise_profiles_public_photo_focal_x_range;
alter table public.ise_profiles
  add constraint ise_profiles_public_photo_focal_x_range
  check (public_photo_focal_x >= 0 and public_photo_focal_x <= 100);

alter table public.ise_profiles
  drop constraint if exists ise_profiles_public_photo_focal_y_range;
alter table public.ise_profiles
  add constraint ise_profiles_public_photo_focal_y_range
  check (public_photo_focal_y >= 0 and public_photo_focal_y <= 100);

alter table public.ise_profiles
  drop constraint if exists ise_profiles_public_photo_zoom_range;
alter table public.ise_profiles
  add constraint ise_profiles_public_photo_zoom_range
  check (public_photo_zoom >= 1.0 and public_photo_zoom <= 3.0);

comment on column public.ise_profiles.public_photo_focal_x is
  'Position horizontale du cadrage du portrait public, en pourcentage (0-100, defaut 50 = centre). Purement cosmetique : traduite en CSS object-position cote client (0141). N''affecte jamais les octets de l''image.';
comment on column public.ise_profiles.public_photo_focal_y is
  'Position verticale du cadrage du portrait public, en pourcentage (0-100, defaut 50 = centre). Meme role que public_photo_focal_x (0141).';
comment on column public.ise_profiles.public_photo_zoom is
  'Zoom applique au portrait public au moment de l''affichage (1.0 = aucun zoom, 3.0 = maximum). Traduit en CSS transform: scale() cote client (0141). N''affecte jamais les octets de l''image.';

-- Les colonnes de cadrage sont en lecture pour le membre, exactement comme
-- les autres colonnes de portrait (0120) : leur ecriture passe par la RPC
-- ci-dessous, jamais par un GRANT UPDATE direct sur la table.
grant select (public_photo_focal_x, public_photo_focal_y, public_photo_zoom)
  on public.ise_profiles to authenticated;

-- ---------------------------------------------------------------------
-- 2. Remise a zero du cadrage a la revocation ou au remplacement du
--    portrait — extension du declencheur de 0120.
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
    new.public_photo_path    := null;
    new.public_photo_alt     := null;
    new.public_photo_width   := null;
    new.public_photo_height  := null;
    new.public_photo_set_at  := null;
    -- 0141 : un cadrage sans portrait n'a aucun sens, retour au centre.
    new.public_photo_focal_x := 50.0;
    new.public_photo_focal_y := 50.0;
    new.public_photo_zoom    := 1.0;
  elsif new.public_photo_path is distinct from old.public_photo_path then
    -- 0141 : remplacement du fichier — le cadrage precedent visait une
    -- autre image, il ne doit pas lui survivre.
    new.public_photo_focal_x := 50.0;
    new.public_photo_focal_y := 50.0;
    new.public_photo_zoom    := 1.0;
  end if;

  return new;
end
$$;

comment on function private.tg_ise_profiles_public_photo_guard() is
  'Revision D-135, etendue par 0141. Garantit qu''aucun portrait public ne survit a la revocation du consentement, a la suppression du compte (D-19) ou a son remplacement, et remet le cadrage au centre (50/50, zoom 1.0) dans les memes cas.';

-- ---------------------------------------------------------------------
-- 3. Enregistrement du cadrage par son proprietaire.
--
--    Refuse explicitement s'il n'existe aucun portrait a cadrer : un
--    cadrage sans image serait une donnee orpheline, jamais affichee.
-- ---------------------------------------------------------------------
create or replace function public.set_my_public_photo_crop(
  p_focal_x numeric,
  p_focal_y numeric,
  p_zoom    numeric
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile   uuid := private.current_profile_id();
  v_has_photo boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_profile is null then
    raise exception 'no_profile' using errcode = 'P0002';
  end if;

  if p_focal_x is null or p_focal_x < 0 or p_focal_x > 100 then
    raise exception 'invalid_focal_x' using errcode = 'P0001';
  end if;
  if p_focal_y is null or p_focal_y < 0 or p_focal_y > 100 then
    raise exception 'invalid_focal_y' using errcode = 'P0001';
  end if;
  if p_zoom is null or p_zoom < 1.0 or p_zoom > 3.0 then
    raise exception 'invalid_zoom' using errcode = 'P0001';
  end if;

  select p.public_photo_path is not null into v_has_photo
  from public.ise_profiles p
  where p.id = v_profile and p.deleted_at is null
  for update;

  if not found then
    raise exception 'no_profile' using errcode = 'P0002';
  end if;
  if not v_has_photo then
    raise exception 'no_photo' using errcode = 'P0002';
  end if;

  update public.ise_profiles
     set public_photo_focal_x = round(p_focal_x, 2),
         public_photo_focal_y = round(p_focal_y, 2),
         public_photo_zoom    = round(p_zoom, 2)
   where id = v_profile;

  perform private.log_audit(
    p_action      => 'profile.public_photo_recadre',
    p_object_type => 'ise_profile',
    p_object_id   => v_profile::text,
    p_context     => jsonb_build_object('focal_x', p_focal_x, 'focal_y', p_focal_y, 'zoom', p_zoom));

  return jsonb_build_object(
    'profile_id', v_profile,
    'focal_x', round(p_focal_x, 2),
    'focal_y', round(p_focal_y, 2),
    'zoom', round(p_zoom, 2));
end
$$;

revoke all on function public.set_my_public_photo_crop(numeric, numeric, numeric) from public, anon;
grant execute on function public.set_my_public_photo_crop(numeric, numeric, numeric) to authenticated;

comment on function public.set_my_public_photo_crop(numeric, numeric, numeric) is
  '0141. Enregistre le cadrage (position focale, zoom) du portrait PUBLIC deja publie par le membre appelant. Ne modifie jamais l''image elle-meme, refuse l''appel si aucun portrait n''existe. Audite.';

-- ---------------------------------------------------------------------
-- 4. Projection publique : le cadrage voyage avec le portrait.
--
--    Meme forme que 0120, etendue de trois cles. `coalesce(...)` protege
--    les lignes anterieures a cette migration (deja a leur valeur par
--    defaut par la colonne, mais une valeur explicite reste plus sure
--    pour un appelant qui lirait cette fonction avant le backfill).
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
           'height',   p.public_photo_height,
           'focal_x',  coalesce(p.public_photo_focal_x, 50.0),
           'focal_y',  coalesce(p.public_photo_focal_y, 50.0),
           'zoom',     coalesce(p.public_photo_zoom, 1.0))
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

comment on function private.landing_member_photo(uuid) is
  'PUB-001 : portrait PUBLIC consenti d''un membre, au meme format que private.landing_media(), etendu du cadrage focal_x/focal_y/zoom (0141). Renvoie NULL sans consentement allow_public_photo, sans texte alternatif, hors prefixe membres/, ou si le fichier n''existe plus. Ne lit jamais avatar_path (bucket prive, D-73).';
