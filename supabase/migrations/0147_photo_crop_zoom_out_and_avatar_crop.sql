-- =====================================================================
-- 0147_photo_crop_zoom_out_and_avatar_crop
-- Corrige le cadrage vertical du portrait public, autorise un zoom
-- REDUCTEUR (< 1.0), et etend le meme cadrage a la photo de profil
-- (avatar). Reference : D-204 (diagnostic + borne de zoom), D-205
-- (extension a l'avatar) — docs/decisions.md.
-- =====================================================================
-- NOTE DE VERSION — cette migration a ete appliquee trois fois de suite
-- (meme nom) pendant la meme session de travail, uniquement pour faire
-- correspondre les numeros D-xxx cites dans les commentaires SQL aux
-- decisions reellement libres sur `main` (deux collisions successives
-- avec des decisions prises EN PARALLELE par d'autres lots de travail
-- sur le meme depot). AUCUN changement de comportement entre ces trois
-- applications : SQL entierement idempotent (create or replace, drop
-- if exists + add), seul le TEXTE des `comment on ...` a change. Le
-- contenu ci-dessous est la version finale.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Portrait public (0141) — zoom reducteur autorise.
-- ---------------------------------------------------------------------
alter table public.ise_profiles
  drop constraint if exists ise_profiles_public_photo_zoom_range;
alter table public.ise_profiles
  add constraint ise_profiles_public_photo_zoom_range
  check (public_photo_zoom >= 0.5 and public_photo_zoom <= 3.0);

comment on column public.ise_profiles.public_photo_zoom is
  'Zoom applique au portrait public au moment de l''affichage (0.5 = photo reduite dans le cadre, 1.0 = aucun zoom, 3.0 = maximum ; borne basse elargie de 1.0 a 0.5 par 0147/D-204). Traduit cote client par un conteneur de cadrage (photoCropWrapperStyle, @ise/ui-web). N''affecte jamais les octets de l''image.';

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
  -- 0147/D-204 : borne basse abaissee de 1.0 a 0.5 (zoom reducteur).
  if p_zoom is null or p_zoom < 0.5 or p_zoom > 3.0 then
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
  '0141, borne basse du zoom elargie a 0.5 par 0147/D-204. Enregistre le cadrage (position focale, zoom) du portrait PUBLIC deja publie par le membre appelant. Ne modifie jamais l''image elle-meme, refuse l''appel si aucun portrait n''existe. Audite.';

-- ---------------------------------------------------------------------
-- 2. Cadrage de la photo de profil (avatar, D-205).
-- ---------------------------------------------------------------------
alter table public.ise_profiles
  add column if not exists avatar_focal_x numeric(5,2) not null default 50.0,
  add column if not exists avatar_focal_y numeric(5,2) not null default 50.0,
  add column if not exists avatar_zoom    numeric(3,2) not null default 1.0;

alter table public.ise_profiles
  drop constraint if exists ise_profiles_avatar_focal_x_range;
alter table public.ise_profiles
  add constraint ise_profiles_avatar_focal_x_range
  check (avatar_focal_x >= 0 and avatar_focal_x <= 100);

alter table public.ise_profiles
  drop constraint if exists ise_profiles_avatar_focal_y_range;
alter table public.ise_profiles
  add constraint ise_profiles_avatar_focal_y_range
  check (avatar_focal_y >= 0 and avatar_focal_y <= 100);

alter table public.ise_profiles
  drop constraint if exists ise_profiles_avatar_zoom_range;
alter table public.ise_profiles
  add constraint ise_profiles_avatar_zoom_range
  check (avatar_zoom >= 0.5 and avatar_zoom <= 3.0);

comment on column public.ise_profiles.avatar_focal_x is
  'Position horizontale du cadrage de la photo de profil (avatar), en pourcentage (0-100, defaut 50 = centre). Meme forme que public_photo_focal_x (0141), etendue a l''avatar par 0147/D-205. Purement cosmetique, jamais applique aux octets stockes.';
comment on column public.ise_profiles.avatar_focal_y is
  'Position verticale du cadrage de la photo de profil (avatar). Meme role que avatar_focal_x (0147/D-205).';
comment on column public.ise_profiles.avatar_zoom is
  'Zoom applique a la photo de profil au moment de l''affichage (0.5 = reduite, 1.0 = aucun zoom, 3.0 = maximum). Meme forme que public_photo_zoom (0147/D-205).';

-- Ecriture directe, comme avatar_path lui-meme (0126) : la politique
-- ise_profiles_update_own (0021) borne deja l'UPDATE a la ligne du
-- membre connecte, une RPC n'ajouterait aucun pouvoir supplementaire.
grant select (avatar_focal_x, avatar_focal_y, avatar_zoom) on public.ise_profiles to authenticated;
grant update (avatar_focal_x, avatar_focal_y, avatar_zoom) on public.ise_profiles to authenticated;

-- Remise a zero automatique du cadrage a chaque remplacement/retrait de
-- l'avatar — meme motif que le declencheur du portrait public (0141,
-- private.tg_ise_profiles_public_photo_guard) : un cadrage pense pour
-- une image n'a aucun sens applique a une autre. L'application (actions
-- serveur) reinitialise deja ces colonnes explicitement au depot et au
-- retrait ; ce declencheur est un filet de securite en base, pas une
-- duplication inutile — il protege aussi tout futur chemin d'ecriture de
-- avatar_path qui oublierait de le faire.
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
  end if;
  return new;
end
$$;

comment on function private.tg_ise_profiles_avatar_crop_reset() is
  '0147/D-205. Remet le cadrage de l''avatar au centre (50/50, zoom 1.0) des que avatar_path change (remplacement ou retrait), meme motif que private.tg_ise_profiles_public_photo_guard (0141) pour le portrait public.';

drop trigger if exists trg_ise_profiles_avatar_crop_reset on public.ise_profiles;
create trigger trg_ise_profiles_avatar_crop_reset
  before update on public.ise_profiles
  for each row
  execute function private.tg_ise_profiles_avatar_crop_reset();
