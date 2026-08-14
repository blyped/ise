'use client';

import { useActionState } from 'react';
import { Alert, Button, Card, CardHeader, CardTitle, ErrorState, Field, Input } from '@ise/ui-web';
import { PUBLIC_PHOTO_ALT_MAX } from '@ise/validation';
import { frProfile } from '@/i18n/profile';
import { frShowcase } from '@/i18n/profile-showcase';
import { initialFormState } from '@/lib/form-state';
import type { PublicShowcase } from '@/lib/queries/public-showcase';
import { publishPublicPhotoAction, withdrawPublicPhotoAction } from './actions';

const ACCEPTED = 'image/png,image/jpeg,image/webp,image/avif';

/**
 * Dépôt et retrait du portrait PUBLIC (révision de D-135, migration 0120).
 *
 * Le formulaire n'est proposé que lorsque le consentement dédié est déjà
 * enregistré. Ce n'est pas une politesse d'interface : la politique Storage
 * `ise_landing_media_member_photo_insert` refuse le dépôt sans consentement.
 * Afficher un champ qui échouerait serait un bouton décoratif
 * (MASTER PROMPT §113) — l'écran explique donc l'ordre des gestes.
 */
export function PublicPhotoForm({
  showcase,
  photoUrl,
}: {
  showcase: PublicShowcase;
  photoUrl: string | null;
}) {
  const [publishState, publishAction, isPublishing] = useActionState(
    publishPublicPhotoAction,
    initialFormState,
  );
  const [withdrawState, withdrawAction, isWithdrawing] = useActionState(
    withdrawPublicPhotoAction,
    initialFormState,
  );

  const publishFailed = publishState.status === 'error' && publishState.correlationId !== null;
  const withdrawFailed = withdrawState.status === 'error' && withdrawState.correlationId !== null;

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
          {/* Image publique servie par le bucket `landing-media` : pas de
              composant next/image, le domaine Supabase n'est pas configuré
              comme source distante ici. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt={showcase.photoAlt ?? ''}
            width={128}
            height={128}
            className="border-border h-[128px] w-[128px] rounded-full border object-cover"
          />
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
