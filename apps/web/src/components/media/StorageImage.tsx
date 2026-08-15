'use client';

import Image from 'next/image';
import { useState } from 'react';

/**
 * Image servie depuis le bucket public `landing-media` (migration 0068).
 *
 * QUATRE GARANTIES, ET C'EST LA RAISON D'ETRE DE CE COMPOSANT
 *
 *  1. **`alt` obligatoire.** Le type l'impose : il n'existe aucun chemin de
 *     rendu sans alternative textuelle. Elle vient de
 *     `cms_media_assets.alt_text`, jamais du nom de fichier (ADDENDUM §52).
 *
 *  2. **Aucun decalage de mise en page.** Le composant s'appuie sur
 *     `fill` : la place est reservee par le conteneur — qui porte un rapport
 *     d'aspect ou une hauteur fixe — et non par l'image. La hauteur du bloc
 *     est donc connue avant le premier octet, que le media soit mesure ou
 *     non. C'est la seule facon d'etre certain de rester sous 0,1 de CLS
 *     (MASTER PROMPT §58) meme quand `width` / `height` manquent en base.
 *
 *  3. **`loading="lazy"` par defaut.** Seul l'appelant qui sait qu'une image
 *     est au-dessus de la ligne de flottaison — la premiere diapositive du
 *     carrousel — passe `priority`.
 *
 *  4. **Jamais d'image cassee.** Si le fichier a disparu du bucket, si le
 *     CDN repond 404 ou si l'optimiseur echoue, `onError` retire l'image et
 *     le conteneur reste tel quel : un aplat, pas une icone brisee
 *     (ADDENDUM §47). C'est aussi pour cela que le composant est un
 *     Client Component : `onError` n'existe pas au rendu serveur, et la
 *     degradation doit se produire chez le visiteur, la ou l'erreur a lieu.
 */
export interface StorageImageProps {
  /** URL publique complete, produite par `landingMediaUrl()`. */
  readonly src: string;
  /** Alternative textuelle. Non optionnelle : c'est le contrat. */
  readonly alt: string;
  /** Indication de largeur pour le jeu de sources responsive. */
  readonly sizes: string;
  readonly className?: string | undefined;
  /** `true` uniquement au-dessus de la ligne de flottaison. */
  readonly priority?: boolean | undefined;
}

export function StorageImage({
  src,
  alt,
  sizes,
  className,
  priority = false,
}: StorageImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      {...(priority ? { priority: true } : { loading: 'lazy' as const })}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
