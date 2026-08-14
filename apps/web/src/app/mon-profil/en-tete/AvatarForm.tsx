'use client';

import { useActionState } from 'react';
import { Alert, Button, Card, CardHeader, CardTitle, ErrorState, Field } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { initialFormState } from '@/lib/form-state';
import { removeAvatarAction, uploadAvatarAction } from './actions';

/**
 * Dépôt et retrait de la photo de profil — révision de D-117 (14/08/2026).
 *
 * Calqué sur `PublicPhotoForm` (vitrine publique, 0120), mais vers le bucket
 * PRIVÉ `avatars` : la photo n'est jamais servie au web ouvert, elle est lue
 * par URL signée réservée aux membres actifs. Il n'y a donc ici NI
 * consentement de publication, NI texte alternatif public — ce sont deux
 * objets distincts, et les confondre serait le contraire de ce que 0120 a
 * pris soin de séparer.
 *
 * Deux formulaires frères, pas un seul : déposer et retirer sont deux gestes,
 * et un formulaire imbriqué n'existe pas en HTML.
 */

/** Miroir exact d'`allowed_mime_types` du bucket `avatars` (0027). */
const ACCEPTED = 'image/png,image/jpeg,image/webp';

export interface AvatarFormProps {
  /** URL signée de la photo actuelle, ou `null` si aucune photo. */
  avatarUrl: string | null;
  /** Repli affiché tant qu'aucune photo n'est déposée. */
  initials: string;
}

export function AvatarForm({ avatarUrl, initials }: AvatarFormProps) {
  const [uploadState, uploadAction, isUploading] = useActionState(
    uploadAvatarAction,
    initialFormState,
  );
  const [removeState, removeAction, isRemoving] = useActionState(
    removeAvatarAction,
    initialFormState,
  );

  const uploadFailed =
    uploadState.status === 'error' &&
    Object.keys(uploadState.fieldErrors).length === 0 &&
    uploadState.correlationId !== null;
  const removeFailed = removeState.status === 'error' && removeState.correlationId !== null;

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
             une URL signée n'a rien à faire dans un cache d'images. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={avatarUrl}
            alt={frProfile.header.photoCurrentAlt}
            width={96}
            height={96}
            className="border-border h-[96px] w-[96px] rounded-full border object-cover"
          />
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
