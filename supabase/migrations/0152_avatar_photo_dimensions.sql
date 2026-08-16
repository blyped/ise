-- =====================================================================
-- 0152_avatar_photo_dimensions
-- Dimensions naturelles de la photo de profil (avatar) — D-212.
--
-- CONTEXTE — un porteur a signale, capture d'ecran a l'appui, que les
-- deux cadrans de recadrage de /mon-profil/en-tete (medaillon + vignette
-- « ISE du jour ») decoupaient deja sa photo AVANT tout reglage manuel,
-- meme au zoom neutre. Diagnostic complet dans le commentaire d'en-tete
-- de `photoCropWrapperStyle` (packages/ui-web/src/utils/photo-crop.ts) :
-- le wrapper de cadrage etait TOUJOURS dimensionne au rapport
-- largeur/hauteur du CADRE, jamais a celui de la PHOTO source.
--
-- Le correctif cote client a besoin du rapport largeur/hauteur REEL de
-- la photo pour dimensionner le wrapper correctement. Pour le portrait
-- PUBLIC, ce rapport est deja disponible : `public_photo_width` et
-- `public_photo_height` existent depuis 0120, ecrits par
-- `set_my_public_photo()` a partir de `inspectImage()` (lu en JS au
-- depot, jamais mesure cote client). Pour l'AVATAR (medaillon prive),
-- rien de tel n'existait : seul `avatar_path` etait stocke.
--
-- CE QUE CETTE MIGRATION FAIT, ET CE QU'ELLE NE FAIT PAS
--   * elle AJOUTE deux colonnes, `avatar_width` / `avatar_height`, MEME
--     FORME que `public_photo_width`/`public_photo_height` (0120) ;
--   * elle NE TOUCHE JAMAIS AUX OCTETS de l'avatar : ces colonnes sont
--     un metadonnee de mise en page, ecrite par l'application a partir
--     de `inspectImage()` (deja calcule a l'upload, aucune mesure
--     supplementaire necessaire) — voir
--     `apps/web/src/app/mon-profil/en-tete/actions.ts` ;
--   * ecriture DIRECTE par le membre proprietaire, comme `avatar_path`
--     lui-meme (0126) et `avatar_focal_x/_y/_zoom` (0147) : la politique
--     `ise_profiles_update_own` (0021) borne deja l'UPDATE a la ligne du
--     membre connecte, une RPC n'ajouterait aucun pouvoir supplementaire ;
--   * remise a zero automatique des lors que `avatar_path` change
--     (remplacement ou retrait) — extension du declencheur existant
--     `private.tg_ise_profiles_avatar_crop_reset` (0147) : des dimensions
--     pensees pour une image n'ont aucun sens appliquees a une autre.
-- =====================================================================

alter table public.ise_profiles
  add column if not exists avatar_width  integer,
  add column if not exists avatar_height integer;

comment on column public.ise_profiles.avatar_width is
  'Largeur naturelle (px) de l''avatar deja depose, lue par inspectImage() a l''upload. Meme forme que public_photo_width (0120), etendue a l''avatar par 0152/D-212. Purement descriptif : sert a dimensionner le wrapper de cadrage (photoCropWrapperStyle) sans mesure cote client. NULL avant cette migration ou tant qu''aucun avatar n''a ete redepose.';
comment on column public.ise_profiles.avatar_height is
  'Hauteur naturelle (px) de l''avatar deja depose. Meme role que avatar_width (0152/D-212).';

grant select (avatar_width, avatar_height) on public.ise_profiles to authenticated;
grant update (avatar_width, avatar_height) on public.ise_profiles to authenticated;

-- ---------------------------------------------------------------------
-- Remise a zero automatique au remplacement/retrait de l'avatar — meme
-- filet de securite que le reste du cadrage (0147).
-- ---------------------------------------------------------------------
create or replace function private.tg_ise_profiles_avatar_crop_reset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.avatar_path is distinct from old.avatar_path then
    new.avatar_focal_x := 50.0;
    new.avatar_focal_y := 50.0;
    new.avatar_zoom    := 1.0;
    -- 0152/D-212 : des dimensions pensees pour l'ANCIENNE image n'ont
    -- aucun sens appliquees a la nouvelle (ou a l'absence d'avatar).
    new.avatar_width    := null;
    new.avatar_height   := null;
  end if;
  return new;
end
$$;

comment on function private.tg_ise_profiles_avatar_crop_reset() is
  '0147/D-206, etendue par 0152/D-212 (avatar_width/avatar_height). Remet le cadrage ET les dimensions de l''avatar a leur etat neutre des que avatar_path change (remplacement ou retrait), meme motif que private.tg_ise_profiles_public_photo_guard (0141) pour le portrait public.';
