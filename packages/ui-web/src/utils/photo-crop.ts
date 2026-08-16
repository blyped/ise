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
   * Zoom applique a la photo — bornes D-215, voir plus bas
   * (`PHOTO_CROP_ZOOM_MIN`, `photoCropZoomMax`). 1.0 = photo entiere
   * visible dans le cadre (letterboxee si le rapport largeur/hauteur ne
   * correspond pas exactement a celui du cadre).
   */
  readonly zoom: number;
}

/** Cadrage neutre : centre, photo entiere visible — identique au rendu d'avant 0141. */
export const PHOTO_CROP_DEFAULT: PhotoCrop = { focalX: 50, focalY: 50, zoom: 1 };

export const PHOTO_CROP_FOCAL_MIN = 0;
export const PHOTO_CROP_FOCAL_MAX = 100;

/**
 * BORNES DU ZOOM — revisees par D-215 (16/08/2026), a la demande du
 * porteur : « le zoom minimum integre tout l'image dans le medaillon et
 * le rectangle et le zoom maximum agrandit a 100 % ». Deux consequences :
 *
 *   1. Le zoom ne descend plus sous 1.0 : le zoom MINIMUM correspond
 *      TOUJOURS a la photo entiere visible (letterboxee si necessaire),
 *      quelle que soit l'image — c'est exactement l'etat garanti par le
 *      wrapper `shape`-aware de D-212 au zoom neutre. L'ancienne borne
 *      basse (0.5, D-205) permettait de RETRECIR encore la photo dans le
 *      cadre ; ce cran est retire, il n'ajoutait qu'une marge decorative
 *      supplementaire une fois le letterboxing de D-212 en place, et
 *      contredisait la demande explicite d'un minimum qui montre
 *      « tout » (ni plus, ni moins) de l'image.
 *
 *   2. Le zoom MAXIMUM n'est plus une constante globale (3.0) : il est
 *      calcule PAR PHOTO et PAR CADRE, via `photoCropZoomMax()` plus bas
 *      — c'est le zoom exact auquel le wrapper `shape`-aware couvre
 *      integralement le cadre, SANS marge de letterboxing (equivalent a
 *      l'ancien `object-fit: cover` par defaut, avant D-205), ni au-dela.
 *      Une image dont le rapport largeur/hauteur est deja identique a
 *      celui du cadre (ex. portrait deja carre dans un medaillon) a donc
 *      un zoom maximum de 1.0 : rien a agrandir, la photo couvre deja le
 *      cadre des le minimum.
 *
 * CONSEQUENCE GEOMETRIQUE ATTENDUE — a l'interieur de cette plage
 * [1, zoomMax], SEUL l'axe dont le rapport de la photo deborde celui du
 * cadre passe par un etat de decoupage reel ; l'autre reste, par
 * construction, toujours integralement visible (il atteint tout juste
 * 100 % au zoom maximum, jamais plus). C'est le comportement standard de
 * tout outil de recadrage grand public (Instagram, Canva…) : le
 * panoramique sur un axe n'a de sens que si cet axe deborde reellement
 * du cadre au zoom courant.
 */
export const PHOTO_CROP_ZOOM_MIN = 1.0;
/** Repli quand `shape` est inconnue (ancien avatar sans dimensions enregistrees) — ancien plafond fixe, inchange. */
export const PHOTO_CROP_ZOOM_MAX = 3.0;
/** Plafond de securite du zoom calcule (`photoCropZoomMax`) : evite une plage de curseur demesuree pour un panorama extreme. */
const PHOTO_CROP_ZOOM_HARD_CAP = 8.0;

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
 * Zoom maximum, PAR PHOTO ET PAR CADRE — D-215. C'est le zoom exact
 * auquel le wrapper `shape`-aware (D-212) couvre integralement le cadre,
 * sans aucune marge de letterboxing : `ratio = imageAspect / frameAspect`,
 * puis `max(ratio, 1/ratio)` — l'un des deux vaut exactement l'inverse de
 * l'autre selon que la photo deborde en largeur ou en hauteur, et ce
 * maximum est TOUJOURS >= 1 (egal a 1 seulement quand la photo a deja
 * exactement le rapport du cadre). Clampe entre `PHOTO_CROP_ZOOM_MIN` et
 * un plafond de securite pour rester lisible sur un curseur, meme pour un
 * panorama extreme.
 *
 * `shape` absente ou invalide (dimensions inconnues, avatar depose avant
 * 0152) : repli sur `PHOTO_CROP_ZOOM_MAX`, l'ancien plafond fixe — aucune
 * regression pour les photos dont on ne connait pas encore la taille
 * reelle.
 */
export function photoCropZoomMax(shape?: PhotoCropShape | null): number {
  if (
    shape &&
    Number.isFinite(shape.imageAspect) &&
    Number.isFinite(shape.frameAspect) &&
    shape.imageAspect > 0 &&
    shape.frameAspect > 0
  ) {
    const ratio = shape.imageAspect / shape.frameAspect;
    const coverZoom = ratio >= 1 ? ratio : 1 / ratio;
    return Math.min(Math.max(coverZoom, PHOTO_CROP_ZOOM_MIN), PHOTO_CROP_ZOOM_HARD_CAP);
  }
  return PHOTO_CROP_ZOOM_MAX;
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
