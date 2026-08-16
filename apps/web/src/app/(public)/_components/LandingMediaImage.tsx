import { photoCropWrapperStyle, type PhotoCrop } from '@ise/ui-web';
import type { LandingMedia } from '@/lib/public/landing-data';
import { landingMediaUrl } from '@/lib/public/landing-data';
import { StorageImage } from '@/components/media/StorageImage';

/**
 * Pont entre un `LandingMedia` de la projection et `StorageImage`.
 *
 * Pas de directive `'use client'` : le composant s'utilise indifferemment
 * dans une section serveur (actualites, partenaires) ou dans le carrousel,
 * qui est un Client Component. La decision « y a-t-il une image ? » est donc
 * prise au rendu, avant toute hydratation, et le HTML initial est deja juste
 * sans JavaScript. Seule la degradation en cas d'erreur reseau vit cote
 * client, dans `StorageImage`.
 *
 * `null` signifie exactement une chose : cette section n'a pas de visuel
 * affichable. Trois causes possibles — aucun media rattache, media dans un
 * bucket prive, media sans alternative textuelle — et une seule
 * consequence : le conteneur reste vide et la mise en page est intacte.
 *
 * CADRAGE (0141, revise D-205/D-206) — quand `media.focalX` / `focalY` /
 * `zoom` sont renseignes (seul le portrait public consenti d'un membre les
 * porte aujourd'hui, `private.landing_member_photo()`), un WRAPPER interne
 * porte le zoom et la position (`photoCropWrapperStyle`, `@ise/ui-web`) et
 * `StorageImage` (donc `next/image` en mode `fill`) se contente de remplir
 * ce wrapper avec `object-fit: cover` centre. C'est la MEME formule que
 * l'apercu de `PublicPhotoForm` : ce que le membre a regle est exactement
 * ce que la vignette affiche, partout ou `LandingMediaImage` sert ce media —
 * y compris l'encart « ISE du jour » de la page d'accueil (D-205 : c'est LA
 * « photo de l'accueil » que le porteur a signalee). L'ancienne formule
 * (`object-position` + `transform: scale()` directement sur l'image) ne
 * fonctionnait que sur l'axe ou la photo debordait naturellement du cadre
 * en `object-fit: cover` — jamais sur l'autre, quel que soit le zoom
 * (voir le commentaire de `photoCropWrapperStyle` pour le detail). Un media
 * sans cadrage garde le rendu d'avant cette migration, wrapper compris :
 * `photoCropWrapperStyle(null)` renvoie `undefined`.
 *
 * IMPORTANT — le CADRE appelant (le parent de `LandingMediaImage`, par
 * exemple `MediaFrame`) doit toujours porter `position: relative; overflow:
 * hidden` : c'est lui qui borne la fenetre visible, avec ou sans cadrage.
 *
 * FORME REELLE DE LA PHOTO (0152/D-212) — `photoCropWrapperStyle` sait
 * desormais dimensionner le wrapper au rapport largeur/hauteur REEL de la
 * photo plutot qu'a celui du cadre (voir le diagnostic dans
 * `photo-crop.ts`) : sans cela, MEME au cadrage neutre enregistre par le
 * membre, la vignette decoupait deja sa photo. `media.width`/`media.height`
 * sont deja projetes ici (0120/0141) — aucune mesure supplementaire. Le
 * rapport du CADRE, lui, est fixe a 16:9 : seul le portrait public d'un
 * membre porte un cadrage aujourd'hui (`private.landing_member_photo()`),
 * et il n'est jamais rendu ailleurs que dans `MediaFrame`
 * (`HighlightsSection.tsx`, encart « ISE du jour », rapport 16/9) — c'est
 * d'ailleurs exactement le rapport reproduit par le second bloc de cadrage
 * de `PhotoForm.tsx`, pour que ce que le membre y regle corresponde ici
 * au pixel pres (D-211 : « il voit exactement comment ca sera... »).
 */
const MEMBER_PHOTO_FRAME_ASPECT = 16 / 9;

export function LandingMediaImage({
  media,
  sizes,
  className,
  priority = false,
}: {
  media: LandingMedia | null;
  sizes: string;
  className?: string | undefined;
  priority?: boolean | undefined;
}) {
  const url = landingMediaUrl(media);
  if (media === null || url === null) return null;

  const crop: PhotoCrop | null =
    media.focalX !== null || media.focalY !== null || media.zoom !== null
      ? {
          focalX: media.focalX ?? 50,
          focalY: media.focalY ?? 50,
          zoom: media.zoom ?? 1,
        }
      : null;

  const shape =
    media.width !== null && media.height !== null && media.height > 0
      ? { imageAspect: media.width / media.height, frameAspect: MEMBER_PHOTO_FRAME_ASPECT }
      : null;

  const image = (
    <StorageImage src={url} alt={media.alt} sizes={sizes} className={className} priority={priority} />
  );

  const wrapperStyle = photoCropWrapperStyle(crop, shape);
  if (!wrapperStyle) return image;

  return <div style={wrapperStyle}>{image}</div>;
}
