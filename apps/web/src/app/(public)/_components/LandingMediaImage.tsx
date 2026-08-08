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

  return (
    <StorageImage
      src={url}
      alt={media.alt}
      sizes={sizes}
      className={className}
      priority={priority}
    />
  );
}
