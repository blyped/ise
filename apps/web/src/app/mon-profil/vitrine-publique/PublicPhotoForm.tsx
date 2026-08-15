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
  Input,
  PHOTO_CROP_FOCAL_MAX,
  PHOTO_CROP_FOCAL_MIN,
  PHOTO_CROP_FRAME_STYLE,
  PHOTO_CROP_ZOOM_MAX,
  PHOTO_CROP_ZOOM_MIN,
  photoCropWrapperStyle,
} from '@ise/ui-web';
import { PUBLIC_PHOTO_ALT_MAX } from '@ise/validation';
import { frProfile } from '@/i18n/profile';
import { frShowcase } from '@/i18n/profile-showcase';
import { initialFormState } from '@/lib/form-state';
import type { PublicShowcase } from '@/lib/queries/public-showcase';
import {
  publishPublicPhotoAction,
  updatePublicPhotoCropAction,
  withdrawPublicPhotoAction,
} from './actions';

const ACCEPTED = 'image/png,image/jpeg,image/webp,image/avif';

/**
 * 0141, bornes revisees D-205 — alignees sur les CHECK de la migration
 * (`@ise/ui-web` porte les memes constantes, reexportees ici pour ne pas
 * dupliquer les nombres).
 */
const FOCAL_MIN = PHOTO_CROP_FOCAL_MIN;
const FOCAL_MAX = PHOTO_CROP_FOCAL_MAX;
const ZOOM_MIN = PHOTO_CROP_ZOOM_MIN;
const ZOOM_MAX = PHOTO_CROP_ZOOM_MAX;
const ZOOM_STEP = 0.1;
const CROP_DEFAULT = { focalX: 50, focalY: 50, zoom: 1 } as const;

const RANGE_CLASS = 'accent-primary h-2 w-full cursor-pointer';

/**
 * Dépôt et retrait du portrait PUBLIC (révision de D-135, migration 0120),
 * cadrage ajustable (migration 0141).
 *
 * Le formulaire n'est proposé que lorsque le consentement dédié est déjà
 * enregistré. Ce n'est pas une politesse d'interface : la politique Storage
 * `ise_landing_media_member_photo_insert` refuse le dépôt sans consentement.
 * Afficher un champ qui échouerait serait un bouton décoratif
 * (MASTER PROMPT §113) — l'écran explique donc l'ordre des gestes.
 *
 * CADRAGE (0141, corrige et etendu D-205) — trois curseurs, aucun recadrage
 * serveur. Le membre choisit une position (horizontale, verticale) et un
 * zoom, traduits par `photoCropWrapperStyle` (`@ise/ui-web`) en un
 * conteneur interne qui porte le deplacement et le zoom — exactement comme
 * le fera la vignette « ISE du jour » (`LandingMediaImage`). L'aperçu
 * ci-dessous utilise la même formule que la landing : ce que le membre voit
 * ici est ce qui paraît sur le site public. Le fichier déposé n'est jamais
 * modifié.
 *
 * D-205 — DEUX CORRECTIFS SUR CE QUI EXISTAIT :
 *   1. l'ancienne formule (`object-position` + `transform: scale()`
 *      directement sur l'image) ne laissait de marge de déplacement que sur
 *      l'axe où la photo débordait déjà du cercle en `object-fit: cover` —
 *      jamais sur l'autre, quel que soit le zoom choisi. Le nouveau
 *      conteneur porte le zoom lui-même : la marge existe désormais
 *      toujours sur les deux axes dès que le zoom s'écarte de 1 ;
 *   2. le zoom peut désormais descendre à 0,5 (au lieu de 1,0 plancher) :
 *      une valeur inférieure à 1 réduit la photo à l'intérieur du cercle,
 *      ce qui n'avait aucun sens tant que `object-fit: cover` imposait un
 *      remplissage intégral.
 */
export function PublicPhotoForm({
  showcase,
  photoUrl,
  photoFocalX,
  photoFocalY,
  photoZoom,
}: {
  showcase: PublicShowcase;
  photoUrl: string | null;
  photoFocalX: number;
  photoFocalY: number;
  photoZoom: number;
}) {
  const [publishState, publishAction, isPublishing] = useActionState(
    publishPublicPhotoAction,
    initialFormState,
  );
  const [withdrawState, withdrawAction, isWithdrawing] = useActionState(
    withdrawPublicPhotoAction,
    initialFormState,
  );
  const [cropState, cropAction, isSavingCrop] = useActionState(
    updatePublicPhotoCropAction,
    initialFormState,
  );

  const [focalX, setFocalX] = useState(photoFocalX);
  const [focalY, setFocalY] = useState(photoFocalY);
  const [zoom, setZoom] = useState(photoZoom);

  const publishFailed = publishState.status === 'error' && publishState.correlationId !== null;
  const withdrawFailed = withdrawState.status === 'error' && withdrawState.correlationId !== null;
  const cropFailed = cropState.status === 'error' && cropState.correlationId !== null;

  function resetCrop() {
    setFocalX(CROP_DEFAULT.focalX);
    setFocalY(CROP_DEFAULT.focalY);
    setZoom(CROP_DEFAULT.zoom);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{frShowcase.photoTitle}</CardTitle>
      </CardHeader>

      <p className="text-body-sm text-text-secondary">{frShowcase.photoIntro}</p>

      {publishState.status === 'success' && publishState.message ? (
        <Alert variant="success" title={publishState.message} className="mt-5" />
      ) : null}
      {withdrawState.status === 'success' && withdrawState.message ? (
        <Alert variant="success" title={withdrawState.message} className="mt-5" />
      ) : null}

      {!showcase.allowPublicPhoto ? (
        <Alert variant="info" title={frShowcase.photoConsentRequired} className="mt-5" />
      ) : null}

      {photoUrl !== null ? (
        <div className="mt-6 flex flex-col gap-4">
          <h3 className="text-body-sm text-text-primary font-semibold">
            {frShowcase.photoCurrentTitle}
          </h3>

          {/* Aperçu du cadrage : ce cercle applique exactement le même
              mécanisme que la vignette « ISE du jour » sur la landing
              (`LandingMediaImage`, `photoCropWrapperStyle` de `@ise/ui-web`)
              — un conteneur interne porte le zoom et la position, l'image
              elle-même reste en `object-fit: cover` centré (D-205 : c'est
              cette formule, et non `object-position` + `transform` sur
              l'image directement, qui garantit une marge de déplacement
              réelle sur les DEUX axes). Image publique servie par le bucket
              `landing-media` : pas de composant next/image, le domaine
              Supabase n'est pas configuré comme source distante ici. */}
          <div
            className="border-border h-[128px] w-[128px] rounded-full border"
            style={PHOTO_CROP_FRAME_STYLE}
          >
            <div style={photoCropWrapperStyle({ focalX, focalY, zoom })}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt={showcase.photoAlt ?? ''}
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          {showcase.allowPublicPhoto ? (
            <form action={cropAction} className="flex flex-col gap-4">
              <div>
                <h4 className="text-body-sm text-text-primary font-semibold">
                  {frShowcase.photoCropTitle}
                </h4>
                <p className="text-caption text-text-muted">{frShowcase.photoCropHint}</p>
              </div>

              {/* Les curseurs pilotent l'état local (aperçu instantané) ;
                  les champs cachés portent les mêmes valeurs vers la Server
                  Action, qui les revérifie et les enregistre (0141). */}
              <input type="hidden" name="focalX" value={focalX} />
              <input type="hidden" name="focalY" value={focalY} />
              <input type="hidden" name="zoom" value={zoom} />

              <label className="flex flex-col gap-1">
                <span className="text-body-sm text-text-primary font-medium">
                  {frShowcase.photoCropXLabel}
                </span>
                <input
                  type="range"
                  min={FOCAL_MIN}
                  max={FOCAL_MAX}
                  step={1}
                  value={focalX}
                  onChange={(event) => setFocalX(Number(event.target.value))}
                  aria-label={frShowcase.photoCropXLabel}
                  className={RANGE_CLASS}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-body-sm text-text-primary font-medium">
                  {frShowcase.photoCropYLabel}
                </span>
                <input
                  type="range"
                  min={FOCAL_MIN}
                  max={FOCAL_MAX}
                  step={1}
                  value={focalY}
                  onChange={(event) => setFocalY(Number(event.target.value))}
                  aria-label={frShowcase.photoCropYLabel}
                  className={RANGE_CLASS}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-body-sm text-text-primary font-medium">
                  {frShowcase.photoCropZoomLabel}
                </span>
                <input
                  type="range"
                  min={ZOOM_MIN}
                  max={ZOOM_MAX}
                  step={ZOOM_STEP}
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  aria-label={frShowcase.photoCropZoomLabel}
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
                <Button
                  type="submit"
                  loading={isSavingCrop}
                  loadingLabel={frShowcase.photoCropSubmitPending}
                >
                  {frShowcase.photoCropSubmit}
                </Button>
                <Button type="button" variant="secondary" onClick={resetCrop}>
                  {frShowcase.photoCropReset}
                </Button>
              </div>
            </form>
          ) : null}

          <form action={withdrawAction}>
            <Button
              type="submit"
              variant="secondary"
              loading={isWithdrawing}
              loadingLabel={frShowcase.photoRemovePending}
            >
              {frShowcase.photoRemove}
            </Button>
          </form>
          {withdrawFailed && withdrawState.correlationId !== null ? (
            <ErrorState
              title={frProfile.common.saveErrorTitle}
              correlationId={withdrawState.correlationId}
              {...(withdrawState.message ? { description: withdrawState.message } : {})}
            />
          ) : null}
        </div>
      ) : (
        <p className="text-body-sm text-text-muted mt-6">{frShowcase.photoNone}</p>
      )}

      {showcase.allowPublicPhoto ? (
        <form action={publishAction} className="mt-7 flex flex-col gap-5">
          <Field
            label={frShowcase.photoFileLabel}
            error={publishState.fieldErrors['photo']}
            required
          >
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                name="photo"
                type="file"
                accept={ACCEPTED}
                required
                aria-invalid={invalid}
                {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                className="text-body-sm text-text-primary file:border-border file:bg-surface-muted file:text-body-sm file:mr-4 file:rounded-md file:border file:px-4 file:py-2"
              />
            )}
          </Field>

          <Field
            label={frShowcase.photoAltLabel}
            hint={frShowcase.photoAltHint}
            error={publishState.fieldErrors['photoAlt']}
            required
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="photoAlt"
                type="text"
                required
                maxLength={PUBLIC_PHOTO_ALT_MAX}
                defaultValue={showcase.photoAlt ?? ''}
                placeholder={frShowcase.photoAltPlaceholder}
                aria-invalid={invalid}
                {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              />
            )}
          </Field>

          {publishFailed && publishState.correlationId !== null ? (
            <ErrorState
              title={frProfile.common.saveErrorTitle}
              correlationId={publishState.correlationId}
              {...(publishState.message ? { description: publishState.message } : {})}
            />
          ) : null}

          <div>
            <Button
              type="submit"
              loading={isPublishing}
              loadingLabel={frShowcase.photoSubmitPending}
            >
              {frShowcase.photoSubmit}
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
