'use client';

import { useActionState, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardHeader,
  CardTitle,
  ErrorState,
  Field,
  PHOTO_CROP_FOCAL_MAX,
  PHOTO_CROP_FOCAL_MIN,
  PHOTO_CROP_FRAME_STYLE,
  PHOTO_CROP_ZOOM_MAX,
  PHOTO_CROP_ZOOM_MIN,
  photoCropWrapperStyle,
} from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { initialFormState } from '@/lib/form-state';
import { removeAvatarAction, updateAvatarCropAction, uploadAvatarAction } from './actions';

/**
 * Dépôt, retrait et cadrage de la photo de profil — révision de D-117
 * (14/08/2026), cadrage étendu par D-205 (0147).
 *
 * Calqué sur `PublicPhotoForm` (vitrine publique, 0120/0141), mais vers le
 * bucket PRIVÉ `avatars` : la photo n'est jamais servie au web ouvert, elle
 * est lue par URL signée réservée aux membres actifs. Il n'y a donc ici NI
 * consentement de publication, NI texte alternatif public — ce sont deux
 * objets distincts, et les confondre serait le contraire de ce que 0120 a
 * pris soin de séparer.
 *
 * CADRAGE (D-205) — même mécanisme que le portrait public : un curseur
 * horizontal, un curseur vertical, un zoom (0.5-3.0, en dessous de 1.0 la
 * photo est réduite dans le cadre). `photoCropWrapperStyle` (`@ise/ui-web`)
 * porte le déplacement ET le zoom dans un conteneur interne — c'est le
 * correctif D-204 du bug d'axe vertical de la vitrine publique, appliqué
 * ici dès la première version pour ne pas reproduire le même défaut.
 *
 * Trois formulaires frères, pas un seul : déposer, retirer et cadrer sont
 * trois gestes, et un formulaire imbriqué n'existe pas en HTML.
 */

/** Miroir exact d'`allowed_mime_types` du bucket `avatars` (0027). */
const ACCEPTED = 'image/png,image/jpeg,image/webp';

const RANGE_CLASS = 'accent-primary h-2 w-full cursor-pointer';

export interface AvatarFormProps {
  /** URL signée de la photo actuelle, ou `null` si aucune photo. */
  avatarUrl: string | null;
  /** Repli affiché tant qu'aucune photo n'est déposée. */
  initials: string;
  /** Cadrage actuellement enregistré (0147/D-205). */
  focalX: number;
  focalY: number;
  zoom: number;
}

export function AvatarForm({ avatarUrl, initials, focalX: initialFocalX, focalY: initialFocalY, zoom: initialZoom }: AvatarFormProps) {
  const [uploadState, uploadAction, isUploading] = useActionState(
    uploadAvatarAction,
    initialFormState,
  );
  const [removeState, removeAction, isRemoving] = useActionState(
    removeAvatarAction,
    initialFormState,
  );
  const [cropState, cropAction, isSavingCrop] = useActionState(
    updateAvatarCropAction,
    initialFormState,
  );

  const [focalX, setFocalX] = useState(initialFocalX);
  const [focalY, setFocalY] = useState(initialFocalY);
  const [zoom, setZoom] = useState(initialZoom);

  const uploadFailed =
    uploadState.status === 'error' &&
    Object.keys(uploadState.fieldErrors).length === 0 &&
    uploadState.correlationId !== null;
  const removeFailed = removeState.status === 'error' && removeState.correlationId !== null;
  const cropFailed = cropState.status === 'error' && cropState.correlationId !== null;

  function resetCrop() {
    setFocalX(50);
    setFocalY(50);
    setZoom(1);
  }

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
          /* Bucket PRIVÉ : l'URL est signée et expire. Pas de `next/image` —
             le domaine Supabase n'est pas déclaré comme source distante, et
             une URL signée n'a rien à faire dans un cache d'images.
             Cadrage (D-205) : même conteneur interne que la vitrine
             publique, voir photoCropWrapperStyle. */
          <div
            className="border-border h-[96px] w-[96px] rounded-full border"
            style={PHOTO_CROP_FRAME_STYLE}
          >
            <div style={photoCropWrapperStyle({ focalX, focalY, zoom })}>
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

      {avatarUrl !== null ? (
        <form action={cropAction} className="mt-6 flex flex-col gap-4">
          <div>
            <h4 className="text-body-sm text-text-primary font-semibold">
              {frProfile.header.photoCropTitle}
            </h4>
            <p className="text-caption text-text-muted">{frProfile.header.photoCropHint}</p>
          </div>

          {/* Les curseurs pilotent l'état local (aperçu instantané) ; les
              champs cachés portent les mêmes valeurs vers la Server Action,
              qui les revérifie et les enregistre (D-205). */}
          <input type="hidden" name="focalX" value={focalX} />
          <input type="hidden" name="focalY" value={focalY} />
          <input type="hidden" name="zoom" value={zoom} />

          <label className="flex flex-col gap-1">
            <span className="text-body-sm text-text-primary font-medium">
              {frProfile.header.photoCropXLabel}
            </span>
            <input
              type="range"
              min={PHOTO_CROP_FOCAL_MIN}
              max={PHOTO_CROP_FOCAL_MAX}
              step={1}
              value={focalX}
              onChange={(event) => setFocalX(Number(event.target.value))}
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
              value={focalY}
              onChange={(event) => setFocalY(Number(event.target.value))}
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
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              aria-label={frProfile.header.photoCropZoomLabel}
              className={RANGE_CLASS}
            />
          </label>

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

      <form action={uploadAction} className="mt-7 flex flex-col gap-5">
        <Field
          label={frProfile.header.photoFileLabel}
          hint={frProfile.header.photoFileHint}
          error={uploadState.fieldErrors['avatar']}
          required
        >
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              name="avatar"
              type="file"
              accept={ACCEPTED}
              required
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              className="text-body-sm text-text-primary file:border-border file:bg-surface-muted file:text-body-sm file:mr-4 file:rounded-md file:border file:px-4 file:py-2"
            />
          )}
        </Field>

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
            {avatarUrl !== null
              ? frProfile.header.photoReplaceSubmit
              : frProfile.header.photoSubmit}
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
