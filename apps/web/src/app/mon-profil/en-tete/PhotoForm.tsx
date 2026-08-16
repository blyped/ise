'use client';

import { useActionState, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardHeader,
  CardTitle,
  Checkbox,
  ErrorState,
  Field,
  Input,
  PHOTO_CROP_FOCAL_MAX,
  PHOTO_CROP_FOCAL_MIN,
  PHOTO_CROP_FRAME_STYLE,
  PHOTO_CROP_ZOOM_MAX,
  PHOTO_CROP_ZOOM_MIN,
  photoCropWrapperStyle,
} from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { initialFormState } from '@/lib/form-state';
import { removePhotoAction, updatePhotoCropAction, uploadPhotoAction } from './actions';

/**
 * Dépôt, retrait et cadrage de la photo de profil — révision de D-117,
 * cadrage étendu par D-206 (0147), FUSIONNÉE avec l'ancienne « photo
 * publique » par D-211 (16/08/2026) : un dépôt UNIQUE, demande explicite
 * du porteur. Voir `actions.ts` pour le détail du mécanisme d'orchestration
 * (copie vers le bucket public, RPC déjà existantes de 0120/0141).
 *
 * DEUX BLOCS DE CADRAGE, UN SEUL ENREGISTREMENT — demande explicite :
 * « tu mets deux blocs de cadrages (pour la photo de profil et pour celle
 * de l'accueil). comme ça, il voit exactement comment ça sera sur le deux
 * pages. et il enregistre. s'il enregistre c'est bon pour les deux. » Le
 * bloc « accueil » reprend la forme RÉELLE de la vignette « ISE du jour »
 * (rectangle 16/9, `MediaFrame` de `HighlightsSection.tsx`) — et non plus
 * un cercle comme l'ancien aperçu de la vitrine publique, qui ne
 * correspondait pas à ce que montre effectivement la page d'accueil.
 */

/** Miroir exact d'`allowed_mime_types` du bucket `avatars` (0027) — seul
 * bucket concerné désormais, puisqu'un unique fichier alimente les deux
 * usages (médaillon privé, copie publique). */
const ACCEPTED = 'image/png,image/jpeg,image/webp';

const RANGE_CLASS = 'accent-primary h-2 w-full cursor-pointer';

/** Même forme que `MediaFrame` (HighlightsSection.tsx) : c'est exactement
 * le cadre dans lequel la vignette « ISE du jour » est affichée sur la
 * landing. Reproduire cette forme ici, et pas un cercle, est tout l'objet
 * de ce second bloc de cadrage. */
const HOME_FRAME_CLASS =
  'bg-surface-muted rounded-base relative aspect-[16/9] w-full max-w-[280px] overflow-hidden border-border border';

export interface PhotoFormProps {
  /** URL signée de la photo actuelle (bucket privé), ou `null` si aucune. */
  avatarUrl: string | null;
  /** Repli affiché tant qu'aucune photo n'est déposée. */
  initials: string;
  /** Cadrage médaillon actuellement enregistré (0147/D-206). */
  avatarFocalX: number;
  avatarFocalY: number;
  avatarZoom: number;
  /**
   * Dimensions naturelles de l'avatar déjà déposé (0152/D-212). `null`
   * tant qu'aucune valeur n'est connue (avant tout dépôt postérieur à
   * cette migration) : l'aperçu retombe alors sur l'ancien comportement
   * (wrapper dimensionné au cadre, pas à la photo).
   */
  avatarWidth: number | null;
  avatarHeight: number | null;
  /** Case de publication sur l'accueil (ex-`allowPublicPhoto`, D-135/0120). */
  allowPublicPhoto: boolean;
  /** URL publique de la copie déjà déposée, ou `null` si aucune copie active. */
  publicPhotoUrl: string | null;
  publicPhotoAlt: string | null;
  /** Cadrage rectangle « ISE du jour » actuellement enregistré (0141/D-205). */
  photoFocalX: number;
  photoFocalY: number;
  photoZoom: number;
  /** Dimensions naturelles de la copie publique déjà déposée (0120), même rôle qu'`avatarWidth`/`avatarHeight` (0152/D-212). */
  photoWidth: number | null;
  photoHeight: number | null;
}

export function PhotoForm({
  avatarUrl,
  initials,
  avatarFocalX: initialAvatarFocalX,
  avatarFocalY: initialAvatarFocalY,
  avatarZoom: initialAvatarZoom,
  avatarWidth,
  avatarHeight,
  allowPublicPhoto: initialAllowPublicPhoto,
  publicPhotoUrl,
  publicPhotoAlt,
  photoFocalX: initialPhotoFocalX,
  photoFocalY: initialPhotoFocalY,
  photoZoom: initialPhotoZoom,
  photoWidth,
  photoHeight,
}: PhotoFormProps) {
  const [uploadState, uploadAction, isUploading] = useActionState(
    uploadPhotoAction,
    initialFormState,
  );
  const [removeState, removeAction, isRemoving] = useActionState(
    removePhotoAction,
    initialFormState,
  );
  const [cropState, cropAction, isSavingCrop] = useActionState(
    updatePhotoCropAction,
    initialFormState,
  );

  // Case de publication : pilote l'affichage du champ de description ET du
  // second bloc de cadrage, avant même tout enregistrement.
  const [allowPublicPhoto, setAllowPublicPhoto] = useState(initialAllowPublicPhoto);

  const [avatarFocalX, setAvatarFocalX] = useState(initialAvatarFocalX);
  const [avatarFocalY, setAvatarFocalY] = useState(initialAvatarFocalY);
  const [avatarZoom, setAvatarZoom] = useState(initialAvatarZoom);

  const [photoFocalX, setPhotoFocalX] = useState(initialPhotoFocalX);
  const [photoFocalY, setPhotoFocalY] = useState(initialPhotoFocalY);
  const [photoZoom, setPhotoZoom] = useState(initialPhotoZoom);

  const uploadFailed =
    uploadState.status === 'error' &&
    Object.keys(uploadState.fieldErrors).length === 0 &&
    uploadState.correlationId !== null;
  const removeFailed = removeState.status === 'error' && removeState.correlationId !== null;
  const cropFailed = cropState.status === 'error' && cropState.correlationId !== null;

  function resetCrop() {
    setAvatarFocalX(50);
    setAvatarFocalY(50);
    setAvatarZoom(1);
    setPhotoFocalX(50);
    setPhotoFocalY(50);
    setPhotoZoom(1);
  }

  // Le bloc « accueil » n'a de sens que si une copie publique existe déjà
  // (case cochée ET dépôt déjà effectué) — sinon il n'y a rien à cadrer.
  const homeBlockActive = allowPublicPhoto && publicPhotoUrl !== null;

  // 0152/D-212 — forme réelle des deux photos, pour que le wrapper de
  // cadrage montre l'image ENTIÈRE au zoom neutre au lieu de la découper
  // au rapport du cadre (voir le diagnostic dans photo-crop.ts). `null`
  // tant que la dimension n'est pas connue : l'aperçu retombe alors sans
  // régression sur l'ancien comportement (dimensionné au cadre).
  const avatarShape =
    avatarWidth !== null && avatarHeight !== null && avatarHeight > 0
      ? { imageAspect: avatarWidth / avatarHeight, frameAspect: 1 }
      : null;
  const photoShape =
    photoWidth !== null && photoHeight !== null && photoHeight > 0
      ? { imageAspect: photoWidth / photoHeight, frameAspect: 16 / 9 }
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{frProfile.header.photoTitle}</CardTitle>
      </CardHeader>

      <p className="text-body-sm text-text-secondary">{frProfile.header.photoIntro}</p>

      {uploadState.status === 'success' && uploadState.message ? (
        <Alert variant="success" title={uploadState.message} className="mt-5" />
      ) : null}
      {removeState.status === 'success' && removeState.message ? (
        <Alert variant="success" title={removeState.message} className="mt-5" />
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-5">
        {avatarUrl !== null ? (
          <div
            className="border-border bg-surface-muted h-[96px] w-[96px] rounded-full border"
            style={PHOTO_CROP_FRAME_STYLE}
          >
            <div style={photoCropWrapperStyle({ focalX: avatarFocalX, focalY: avatarFocalY, zoom: avatarZoom }, avatarShape)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt={frProfile.header.photoCurrentAlt}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        ) : (
          <div
            aria-hidden="true"
            className="bg-surface-muted text-text-secondary border-border flex h-[96px] w-[96px] items-center justify-center rounded-full border text-h4 font-bold"
          >
            {initials}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-body-sm text-text-primary font-semibold">
            {avatarUrl !== null
              ? frProfile.header.photoCurrentTitle
              : frProfile.header.photoNoneTitle}
          </p>
          <p className="text-body-sm text-text-muted">
            {avatarUrl !== null ? frProfile.header.photoCurrentHint : frProfile.header.photoNoneHint}
          </p>
        </div>
      </div>

      {/* Bloc de cadrage — deux aperçus, un seul enregistrement. */}
      {avatarUrl !== null ? (
        <form action={cropAction} className="mt-7 flex flex-col gap-6">
          <div>
            <h3 className="text-body-sm text-text-primary font-semibold">
              {frProfile.header.photoCropTitle}
            </h3>
            <p className="text-caption text-text-muted">{frProfile.header.photoCropIntro}</p>
          </div>

          <input type="hidden" name="avatarFocalX" value={avatarFocalX} />
          <input type="hidden" name="avatarFocalY" value={avatarFocalY} />
          <input type="hidden" name="avatarZoom" value={avatarZoom} />
          <input type="hidden" name="photoFocalX" value={photoFocalX} />
          <input type="hidden" name="photoFocalY" value={photoFocalY} />
          <input type="hidden" name="photoZoom" value={photoZoom} />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Bloc 1 — médaillon (espace membre). */}
            <div className="flex flex-col gap-4">
              <div>
                <h4 className="text-body-sm text-text-primary font-medium">
                  {frProfile.header.cropAvatarTitle}
                </h4>
                <p className="text-caption text-text-muted">{frProfile.header.cropAvatarHint}</p>
              </div>

              <div
                className="border-border bg-surface-muted mx-auto h-[128px] w-[128px] rounded-full border"
                style={PHOTO_CROP_FRAME_STYLE}
              >
                <div style={photoCropWrapperStyle({ focalX: avatarFocalX, focalY: avatarFocalY, zoom: avatarZoom }, avatarShape)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarUrl}
                    alt={frProfile.header.photoCurrentAlt}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-body-sm text-text-primary font-medium">
                  {frProfile.header.photoCropXLabel}
                </span>
                <input
                  type="range"
                  min={PHOTO_CROP_FOCAL_MIN}
                  max={PHOTO_CROP_FOCAL_MAX}
                  step={1}
                  value={avatarFocalX}
                  onChange={(event) => setAvatarFocalX(Number(event.target.value))}
                  aria-label={frProfile.header.photoCropXLabel}
                  className={RANGE_CLASS}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-body-sm text-text-primary font-medium">
                  {frProfile.header.photoCropYLabel}
                </span>
                <input
                  type="range"
                  min={PHOTO_CROP_FOCAL_MIN}
                  max={PHOTO_CROP_FOCAL_MAX}
                  step={1}
                  value={avatarFocalY}
                  onChange={(event) => setAvatarFocalY(Number(event.target.value))}
                  aria-label={frProfile.header.photoCropYLabel}
                  className={RANGE_CLASS}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-body-sm text-text-primary font-medium">
                  {frProfile.header.photoCropZoomLabel}
                </span>
                <input
                  type="range"
                  min={PHOTO_CROP_ZOOM_MIN}
                  max={PHOTO_CROP_ZOOM_MAX}
                  step={0.1}
                  value={avatarZoom}
                  onChange={(event) => setAvatarZoom(Number(event.target.value))}
                  aria-label={frProfile.header.photoCropZoomLabel}
                  className={RANGE_CLASS}
                />
              </label>
            </div>

            {/* Bloc 2 — rectangle « ISE du jour » (accueil public). Même
                forme que MediaFrame (HighlightsSection.tsx), pas un cercle :
                c'est exactement ainsi que la photo apparaît sur l'accueil. */}
            <div className="flex flex-col gap-4">
              <div>
                <h4 className="text-body-sm text-text-primary font-medium">
                  {frProfile.header.cropHomeTitle}
                </h4>
                <p className="text-caption text-text-muted">{frProfile.header.cropHomeHint}</p>
              </div>

              {homeBlockActive ? (
                <>
                  <div className={`${HOME_FRAME_CLASS} mx-auto`}>
                    <div style={photoCropWrapperStyle({ focalX: photoFocalX, focalY: photoFocalY, zoom: photoZoom }, photoShape)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={publicPhotoUrl ?? avatarUrl}
                        alt={publicPhotoAlt ?? ''}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>

                  <label className="flex flex-col gap-1">
                    <span className="text-body-sm text-text-primary font-medium">
                      {frProfile.header.photoCropXLabel}
                    </span>
                    <input
                      type="range"
                      min={PHOTO_CROP_FOCAL_MIN}
                      max={PHOTO_CROP_FOCAL_MAX}
                      step={1}
                      value={photoFocalX}
                      onChange={(event) => setPhotoFocalX(Number(event.target.value))}
                      aria-label={frProfile.header.photoCropXLabel}
                      className={RANGE_CLASS}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-body-sm text-text-primary font-medium">
                      {frProfile.header.photoCropYLabel}
                    </span>
                    <input
                      type="range"
                      min={PHOTO_CROP_FOCAL_MIN}
                      max={PHOTO_CROP_FOCAL_MAX}
                      step={1}
                      value={photoFocalY}
                      onChange={(event) => setPhotoFocalY(Number(event.target.value))}
                      aria-label={frProfile.header.photoCropYLabel}
                      className={RANGE_CLASS}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-body-sm text-text-primary font-medium">
                      {frProfile.header.photoCropZoomLabel}
                    </span>
                    <input
                      type="range"
                      min={PHOTO_CROP_ZOOM_MIN}
                      max={PHOTO_CROP_ZOOM_MAX}
                      step={0.1}
                      value={photoZoom}
                      onChange={(event) => setPhotoZoom(Number(event.target.value))}
                      aria-label={frProfile.header.photoCropZoomLabel}
                      className={RANGE_CLASS}
                    />
                  </label>
                </>
              ) : (
                <div className={`${HOME_FRAME_CLASS} mx-auto flex items-center justify-center`}>
                  <p className="text-caption text-text-muted px-4 text-center">
                    {frProfile.header.cropHomeDisabled}
                  </p>
                </div>
              )}
            </div>
          </div>

          {cropState.status === 'success' && cropState.message ? (
            <Alert variant="success" title={cropState.message} />
          ) : null}
          {cropFailed && cropState.correlationId !== null ? (
            <ErrorState
              title={frProfile.common.saveErrorTitle}
              correlationId={cropState.correlationId}
              {...(cropState.message ? { description: cropState.message } : {})}
            />
          ) : null}

          <div className="flex gap-3">
            <Button type="submit" loading={isSavingCrop} loadingLabel={frProfile.header.photoCropSubmitPending}>
              {frProfile.header.photoCropSubmit}
            </Button>
            <Button type="button" variant="secondary" onClick={resetCrop}>
              {frProfile.header.photoCropReset}
            </Button>
          </div>
        </form>
      ) : null}

      {/* Dépôt / remplacement et case de publication — un seul formulaire,
          fichier OPTIONNEL (D-211) : cocher/décocher la case sans changer
          de fichier resynchronise la copie publique depuis la photo déjà
          déposée. */}
      <form action={uploadAction} className="mt-7 flex flex-col gap-5 border-t border-border pt-7">
        <Field
          label={frProfile.header.photoFileLabel}
          hint={frProfile.header.photoFileHint}
          error={uploadState.fieldErrors['photo']}
        >
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              name="photo"
              type="file"
              accept={ACCEPTED}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              className="text-body-sm text-text-primary file:border-border file:bg-surface-muted file:text-body-sm file:mr-4 file:rounded-md file:border file:px-4 file:py-2"
            />
          )}
        </Field>

        <div>
          <h4 className="text-body-sm text-text-primary font-semibold">
            {frProfile.header.consentTitle}
          </h4>
          <div className="mt-3">
            <Checkbox
              name="allowPublicPhoto"
              checked={allowPublicPhoto}
              label={frProfile.header.consentLabel}
              description={
                <>
                  {frProfile.header.consentDescription}
                  <br />
                  {frProfile.header.consentRevokeNote}
                </>
              }
              onChange={(event) => setAllowPublicPhoto(event.target.checked)}
            />
          </div>
        </div>

        {allowPublicPhoto ? (
          <Field
            label={frProfile.header.photoAltLabel}
            hint={frProfile.header.photoAltHint}
            error={uploadState.fieldErrors['photoAlt']}
            required
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="photoAlt"
                type="text"
                required
                maxLength={200}
                defaultValue={publicPhotoAlt ?? ''}
                placeholder={frProfile.header.photoAltPlaceholder}
                aria-invalid={invalid}
                {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              />
            )}
          </Field>
        ) : null}

        {uploadFailed && uploadState.correlationId !== null ? (
          <ErrorState
            title={frProfile.common.saveErrorTitle}
            correlationId={uploadState.correlationId}
            {...(uploadState.message ? { description: uploadState.message } : {})}
          />
        ) : null}

        <div>
          <Button
            type="submit"
            loading={isUploading}
            loadingLabel={frProfile.header.photoSubmitPending}
          >
            {frProfile.header.photoFormSubmit}
          </Button>
        </div>
      </form>

      {avatarUrl !== null ? (
        <div className="mt-5 flex flex-col gap-4">
          <form action={removeAction}>
            <Button
              type="submit"
              variant="secondary"
              loading={isRemoving}
              loadingLabel={frProfile.header.photoRemovePending}
            >
              {frProfile.header.photoRemove}
            </Button>
          </form>
          {removeFailed && removeState.correlationId !== null ? (
            <ErrorState
              title={frProfile.common.saveErrorTitle}
              correlationId={removeState.correlationId}
              {...(removeState.message ? { description: removeState.message } : {})}
            />
          ) : null}
        </div>
      ) : null}

      <p className="text-body-sm text-text-muted mt-6">{frProfile.header.photoVisibilityNote}</p>
    </Card>
  );
}
