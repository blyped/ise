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
 *
 * BUG SUIVANT, CORRIGE PAR D-212 -- le correctif ci-dessus dimensionne
 * TOUJOURS le wrapper aux dimensions du CADRE (`zoom * 100 %` applique a
 * largeur ET hauteur), jamais a celles de la PHOTO source. Consequence :
 * le wrapper adopte systematiquement le rapport largeur/hauteur DU CADRE
 * (1:1 pour un medaillon, 16:9 pour la vignette accueil), jamais celui de
 * la photo deposee -- et comme l'image a l'interieur garde `object-fit:
 * cover`, elle remplit integralement ce wrapper en decoupant tout ce qui
 * deborde de sa forme. Resultat signale par un porteur, capture d'ecran a
 * l'appui : ses cadrans de recadrage coupaient deja sa photo AVANT tout
 * reglage manuel, meme au zoom neutre (1.0) et au centrage par defaut
 * (50/50) -- impossible, avec l'ancienne formule, de voir la photo source
 * dans son integralite pour la recadrer en connaissance de cause.
 *
 * CORRECTIF D-212 -- `photoCropWrapperStyle()` accepte desormais un
 * second parametre optionnel, `shape` (`imageAspect`/`frameAspect`).
 * Quand il est fourni, le wrapper n'est plus dimensionne au rapport du
 * CADRE mais a celui, RELATIF, de la PHOTO :
 *   - `ratio = imageAspect / frameAspect` ;
 *   - si `ratio > 1` (photo plus "large" que le cadre) : largeur de base
 *     100 %, hauteur de base `100 / ratio` % -- la photo tient toute sa
 *     largeur, une marge (letterboxing) apparait en haut/bas ;
 *   - sinon : hauteur de base 100 %, largeur de base `ratio * 100 %` --
 *     marge a gauche/droite ;
 *   - le zoom demande par le membre multiplie ensuite cette base, comme
 *     avant.
 *   Preuve (algebre) : le rapport largeur/hauteur REEL du wrapper obtenu
 *   (rapporte au cadre, pas au pourcentage) vaut exactement `imageAspect`
 *   quelle que soit la valeur du zoom -- `object-fit: cover` sur l'image
 *   interne devient alors un NO-OP (le wrapper a deja la forme exacte de
 *   l'image), donc plus aucun decoupage involontaire au zoom neutre.
 *   Quand `imageAspect === frameAspect` (photo carree dans un medaillon,
 *   p. ex.), la formule se reduit EXACTEMENT a l'ancienne : aucune
 *   regression pour les appelants qui ne fournissent pas encore `shape`,
 *   ni pour les photos dont le rapport correspond deja au cadre.
 *   `shape` reste optionnel : un appelant qui ne connait pas encore les
 *   dimensions naturelles de l'image continue d'obtenir le rendu d'avant
 *   D-212, inchange.
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
 * Forme relative photo/cadre — D-212. Permet a `photoCropWrapperStyle` de
 * dimensionner le wrapper au rapport largeur/hauteur REEL de la photo
 * plutot qu'a celui du cadre. Voir le diagnostic ci-dessus pour la preuve.
 */
export interface PhotoCropShape {
  /** Rapport largeur/hauteur de l'image source (naturalWidth / naturalHeight). */
  readonly imageAspect: number;
  /** Rapport largeur/hauteur du cadre d'affichage (1 = medaillon, 16/9 = vignette accueil). */
  readonly frameAspect: number;
}

/**
 * Style du wrapper interne qui porte le zoom et la position — voir le
 * diagnostic ci-dessus. `undefined` si `crop` est `null` : l'appelant
 * revient alors au rendu simple (`object-fit: cover`, sans wrapper), pour
 * les images qui ne portent aucun cadrage (immense majorite des medias).
 *
 * `shape` (D-212) — optionnel, ignore si absent ou invalide (dimensions
 * inconnues) : le wrapper garde alors exactement l'ancien comportement
 * (dimensionne au cadre). Fourni, il dimensionne le wrapper au rapport de
 * la PHOTO : au zoom neutre, la photo entiere est visible (letterboxee),
 * sans aucun decoupage avant reglage manuel du membre.
 */
export function photoCropWrapperStyle(
  crop: PhotoCrop | null,
  shape?: PhotoCropShape | null,
): CSSProperties | undefined {
  if (crop === null) return undefined;

  const sizePercent = crop.zoom * 100;
  let widthPercent = sizePercent;
  let heightPercent = sizePercent;

  if (
    shape &&
    Number.isFinite(shape.imageAspect) &&
    Number.isFinite(shape.frameAspect) &&
    shape.imageAspect > 0 &&
    shape.frameAspect > 0
  ) {
    const ratio = shape.imageAspect / shape.frameAspect;
    const baseWidthPercent = ratio > 1 ? 100 : ratio * 100;
    const baseHeightPercent = ratio > 1 ? 100 / ratio : 100;
    widthPercent = baseWidthPercent * crop.zoom;
    heightPercent = baseHeightPercent * crop.zoom;
  }

  const left = (crop.focalX / 100) * (100 - widthPercent);
  const top = (crop.focalY / 100) * (100 - heightPercent);
  return {
    position: 'absolute',
    left: `${left}%`,
    top: `${top}%`,
    width: `${widthPercent}%`,
    height: `${heightPercent}%`,
  };
}

/** `true` des qu'au moins une des trois valeurs s'ecarte du centre neutre. */
export function isCustomPhotoCrop(crop: PhotoCrop): boolean {
  return crop.focalX !== 50 || crop.focalY !== 50 || crop.zoom !== 1;
}
