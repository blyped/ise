-- =====================================================================
-- 0154_photo_crop_zoom_bounds_d215
-- Aligne les bornes de zoom en base sur D-215 (16/08/2026) : le porteur
-- veut que le zoom minimum montre TOUJOURS l'image entiere (plus de
-- retrecissement en dessous), et que le zoom maximum soit calcule PAR
-- PHOTO ET PAR CADRE (medaillon 1:1, rectangle 16:9) plutot que d'etre un
-- plafond fixe unique. Voir `PHOTO_CROP_ZOOM_MIN` / `photoCropZoomMax()`
-- dans `packages/ui-web/src/utils/photo-crop.ts` pour le detail cote
-- application.
--
-- CE QUE CETTE MIGRATION FAIT
--   * remonte la borne basse des deux contraintes de zoom (portrait
--     public ET avatar) de 0.5 a 1.0 — le zoom REDUCTEUR introduit par
--     0147/D-205 devient sans objet une fois le letterboxing de D-212 en
--     place (l'image entiere est deja visible au zoom neutre, retrecir
--     davantage n'ajoutait qu'une marge decorative) ;
--   * remonte la borne haute de 3.0 a 8.0 — le zoom maximum REEL,
--     desormais calcule cote client par photo/cadre (le point ou le
--     cadre est rempli a 100 % sans marge), peut depasser 3.0 pour un
--     rapport largeur/hauteur tres eloigne de celui du cadre (ex. un
--     portrait tres etroit depose dans le rectangle 16:9). 8.0 est le
--     meme plafond de securite que cote client
--     (`PHOTO_CROP_ZOOM_HARD_CAP`) et cote serveur
--     (`CROP_ZOOM_MAX`, `en-tete/actions.ts`) ;
--   * meme changement applique aux TROIS gardes qui verifient
--     aujourd'hui cette plage : la contrainte de table du portrait
--     public, la contrainte de table de l'avatar, et la verification
--     inline de `set_my_public_photo_crop()` (le seul chemin d'ecriture
--     du zoom du portrait public — l'avatar, lui, s'ecrit par UPDATE
--     direct, deja borne par sa seule contrainte de table).
--
-- CE QU'ELLE NE FAIT PAS
--   * ne touche pas la colonne `numeric(3,2)` elle-meme (deja capable de
--     representer jusqu'a 9.99, largement suffisant pour le plafond 8.0) ;
--   * ne reecrit AUCUNE ligne existante : un zoom deja enregistre sous
--     1.0 (rare — seuls quelques comptes de test l'ont exerce avant ce
--     changement) reste tel quel en base, la contrainte ne s'applique
--     qu'aux futures ecritures ; le formulaire web clampe deja la valeur
--     affichee a l'ouverture (`Math.min(Math.max(...))`, `PhotoForm.tsx`) ;
--   * ne modifie aucune RLS ni aucun GRANT.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Portrait public (0141, borne elargie par 0147) — nouvelle plage.
-- ---------------------------------------------------------------------
alter table public.ise_profiles
  drop constraint if exists ise_profiles_public_photo_zoom_range;
alter table public.ise_profiles
  add constraint ise_profiles_public_photo_zoom_range
  check (public_photo_zoom >= 1.0 and public_photo_zoom <= 8.0);

comment on column public.ise_profiles.public_photo_zoom is
  'Zoom applique au portrait public au moment de l''affichage. D-215 (0154) : 1.0 = photo entiere visible (letterboxee si besoin), le maximum reel est calcule par photo/cadre cote client (photoCropZoomMax, @ise/ui-web) et borne ici a 8.0 par securite. Traduit cote client par un conteneur de cadrage (photoCropWrapperStyle, @ise/ui-web). N''affecte jamais les octets de l''image.';

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
  -- 0154/D-215 : borne remontee a 1.0-8.0 (voir l'en-tete de cette migration).
  if p_zoom is null or p_zoom < 1.0 or p_zoom > 8.0 then
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

comment on function public.set_my_public_photo_crop(numeric, numeric, numeric) is
  '0141, borne de zoom 1.0-8.0 par 0154/D-215 (calcul reel par photo/cadre cote client). Enregistre le cadrage (position focale, zoom) du portrait PUBLIC deja publie par le membre appelant. Ne modifie jamais l''image elle-meme, refuse l''appel si aucun portrait n''existe. Audite.';

-- ---------------------------------------------------------------------
-- 2. Avatar (0147/D-206) — nouvelle plage, meme raisonnement.
-- ---------------------------------------------------------------------
alter table public.ise_profiles
  drop constraint if exists ise_profiles_avatar_zoom_range;
alter table public.ise_profiles
  add constraint ise_profiles_avatar_zoom_range
  check (avatar_zoom >= 1.0 and avatar_zoom <= 8.0);

comment on column public.ise_profiles.avatar_zoom is
  'Zoom applique a la photo de profil au moment de l''affichage. D-215 (0154) : 1.0 = photo entiere visible, le maximum reel est calcule par photo/cadre cote client (photoCropZoomMax, @ise/ui-web) et borne ici a 8.0 par securite. Meme forme que public_photo_zoom.';
