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
 * CADRAGE (0141) — quand `media.focalX` / `focalY` / `zoom` sont renseignes
 * (seul le portrait public consenti d'un membre les porte aujourd'hui,
 * `private.landing_member_photo()`), ils sont traduits en `object-position`
 * / `transform: scale()` et passes a `StorageImage`. C'est la MEME formule
 * que l'apercu de `PublicPhotoForm` : ce que le membre a regle est
 * exactement ce que la vignette affiche, partout ou `LandingMediaImage` sert
 * ce media. Un media sans cadrage garde le rendu d'avant cette migration.
 */
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

  const hasCrop = media.focalX !== null || media.focalY !== null || media.zoom !== null;
  const style = hasCrop
    ? {
        objectPosition: `${media.focalX ?? 50}% ${media.focalY ?? 50}%`,
        transform: `scale(${media.zoom ?? 1})`,
      }
    : undefined;

  return (
    <StorageImage
      src={url}
      alt={media.alt}
      sizes={sizes}
      className={className}
      priority={priority}
      {...(style ? { style } : {})}
    />
  );
}
