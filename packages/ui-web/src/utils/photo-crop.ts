import type { CSSProperties } from 'react';

/**
 * Cadrage d'une photo (position + zoom), partage par tout composant qui
 * affiche une image « recadrable » (portrait public « ISE du jour »,
 * photo de profil). Voir D-205 (docs/decisions.md) pour le diagnostic
 * complet du bug corrige ici.
 *
 * DIAGNOSTIC — pourquoi l'ancienne formule (`object-position` +
 * `transform: scale()`) ne pouvait PAS fonctionner sur les deux axes :
 *   `object-fit: cover` decide, AU STADE DE LA MISE EN PAGE, quelle
 *   fenetre de la photo source est conservee dans la boite — l'axe dont
 *   le rapport largeur/hauteur de la PHOTO deborde celui du CADRE recoit
 *   une marge de positionnement (« slack »), l'autre axe n'en recoit
 *   AUCUNE, quelle que soit la valeur d'`object-position` choisie : il n'y
 *   a rien a deplacer, la fenetre touche deja les deux bords. Un
 *   `transform: scale()` applique ensuite ne change rien a ce constat : la
 *   transformation agit en PEINTURE, apres que cette fenetre a deja ete
 *   figee — elle agrandit ce qui est deja visible, elle ne peut jamais
 *   « recuperer » des pixels deja exclus par `object-fit`. Resultat
 *   observe : le decalage horizontal fonctionnait (la photo en cause
 *   deborde en largeur) et le decalage vertical ne faisait rigoureusement
 *   rien, aucun zoom ne changeait cela.
 *
 * CORRECTIF — un CONTENEUR interne (« wrapper ») porte le zoom et la
 * position, PAS l'image elle-meme :
 *   - il est redimensionne a `zoom * 100 %` du cadre, DANS LES DEUX
 *     DIMENSIONS A LA FOIS, independamment du rapport largeur/hauteur de
 *     la photo — la marge de panoramique existe donc TOUJOURS sur les
 *     deux axes des que `zoom !== 1`, quelle que soit l'orientation de la
 *     photo source ;
 *   - il est positionne par un simple pourcentage (`left`/`top`), calcule
 *     a partir du point focal choisi, sans avoir besoin de connaitre les
 *     dimensions intrinseques de l'image (aucune mesure JavaScript,
 *     aucun risque de decalage de mise en page) ;
 *   - un zoom INFERIEUR a 1 retrecit ce wrapper sous la taille du cadre :
 *     le fond du cadre apparait alors autour de la photo, ce qui est
 *     exactement l'effet de « reduction » demande — impossible avec
 *     `object-fit: cover` seul, qui ne sait que remplir integralement.
 *   - L'image A L'INTERIEUR de ce wrapper garde `object-fit: cover` avec
 *     un `object-position` FIXE a `50% 50%` : le panoramique est
 *     entierement porte par le wrapper, plus par `object-position`.
 *
 * Le CADRE appelant DOIT poser `position: relative; overflow: hidden`
 * (`photoCropFrameStyle` le fournit) ; ce wrapper est toujours
 * `position: absolute`.
 */
export interface PhotoCrop {
  /** Position horizontale du point focal, 0-100 (pourcentage du cadre). */
  readonly focalX: number;
  /** Position verticale du point focal, 0-100 (pourcentage du cadre). */
  readonly focalY: number;
  /**
   * Zoom applique a la photo, 0.5-3.0. 1.0 = comportement `object-fit:
   * cover` standard (aucun agrandissement). En dessous de 1.0, la photo
   * est reduite a l'interieur du cadre (D-205).
   */
  readonly zoom: number;
}

/** Cadrage neutre : centre, sans zoom — identique au rendu d'avant 0141. */
export const PHOTO_CROP_DEFAULT: PhotoCrop = { focalX: 50, focalY: 50, zoom: 1 };

export const PHOTO_CROP_FOCAL_MIN = 0;
export const PHOTO_CROP_FOCAL_MAX = 100;
/**
 * Borne basse du zoom — D-205. 0.5 laisse une reduction perceptible et
 * utile (la photo occupe la moitie de la surface du cadre dans chaque
 * dimension) sans devenir un point illisible ; c'est le miroir de la
 * borne haute existante (3.0), choisie a l'origine (0141) pour la meme
 * raison de lisibilite.
 */
export const PHOTO_CROP_ZOOM_MIN = 0.5;
export const PHOTO_CROP_ZOOM_MAX = 3.0;

/** Le cadre appelant doit toujours porter ce style : socle du recadrage. */
export const PHOTO_CROP_FRAME_STYLE: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
};

/**
 * Style du wrapper interne qui porte le zoom et la position — voir le
 * diagnostic ci-dessus. `undefined` si `crop` est `null` : l'appelant
 * revient alors au rendu simple (`object-fit: cover`, sans wrapper), pour
 * les images qui ne portent aucun cadrage (immense majorite des medias).
 */
export function photoCropWrapperStyle(crop: PhotoCrop | null): CSSProperties | undefined {
  if (crop === null) return undefined;
  const sizePercent = crop.zoom * 100;
  const left = (crop.focalX / 100) * (100 - sizePercent);
  const top = (crop.focalY / 100) * (100 - sizePercent);
  return {
    position: 'absolute',
    left: `${left}%`,
    top: `${top}%`,
    width: `${sizePercent}%`,
    height: `${sizePercent}%`,
  };
}

/** `true` des qu'au moins une des trois valeurs s'ecarte du centre neutre. */
export function isCustomPhotoCrop(crop: PhotoCrop): boolean {
  return crop.focalX !== 50 || crop.focalY !== 50 || crop.zoom !== 1;
}
