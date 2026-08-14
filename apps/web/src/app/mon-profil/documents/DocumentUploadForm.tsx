'use client';

import { useActionState } from 'react';
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
  Select,
} from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { frDocuments } from '@/i18n/profile-documents';
import { initialFormState } from '@/lib/form-state';
import { PROFILE_DOCUMENT_TYPES } from '@/lib/profile-documents-view';
import { uploadProfileDocumentAction } from './actions';

/**
 * Dépôt d'un document de profil (migration 0127).
 *
 * L'attribut `accept` liste les MÊMES types que le bucket
 * `profile-documents` et que la RPC : proposer au navigateur un format que
 * la base refuserait ensuite serait un champ décoratif (MASTER PROMPT §113).
 * Le contrôle réel reste côté serveur — `accept` n'est qu'un filtre de
 * confort dans le sélecteur de fichiers.
 */
const ACCEPTED_ATTRIBUTE = [
  'application/pdf',
  '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.pptx',
  'image/png',
  'image/jpeg',
  'image/webp',
].join(',');

export function DocumentUploadForm() {
  const [state, formAction, isPending] = useActionState(
    uploadProfileDocumentAction,
    initialFormState,
  );

  const typeOptions = PROFILE_DOCUMENT_TYPES.map((value) => ({
    value,
    label: frDocuments.types[value] ?? value,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{frDocuments.uploadTitle}</CardTitle>
      </CardHeader>

      <p className="text-body-sm text-text-secondary">{frDocuments.uploadIntro}</p>

      {state.status === 'success' && state.message !== null ? (
        <Alert variant="success" title={state.message} className="mt-5" />
      ) : null}

      <form action={formAction} noValidate className="mt-7 flex flex-col gap-5">
        <Field label={frDocuments.fileLabel} error={state.fieldErrors['document']} required>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              name="document"
              type="file"
              accept={ACCEPTED_ATTRIBUTE}
              required
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              className="text-body-sm text-text-primary file:border-border file:bg-surface-muted file:text-body-sm file:mr-4 file:rounded-md file:border file:px-4 file:py-2"
            />
          )}
        </Field>

        <Field label={frDocuments.typeLabel} error={state.fieldErrors['documentType']} required>
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              name="documentType"
              required
              defaultValue="cv"
              options={typeOptions}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
            />
          )}
        </Field>

        <Field
          label={frDocuments.titleLabel}
          hint={frDocuments.titleHint}
          error={state.fieldErrors['title']}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="title"
              type="text"
              maxLength={200}
              placeholder={frDocuments.titlePlaceholder}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
            />
          )}
        </Field>

        <Checkbox
          name="isPrimary"
          label={frDocuments.primaryLabel}
          description={frDocuments.primaryDescription}
        />

        {state.status === 'error' && state.correlationId !== null ? (
          <ErrorState
            title={frProfile.common.saveErrorTitle}
            correlationId={state.correlationId}
            {...(state.message ? { description: state.message } : {})}
          />
        ) : null}

        <div>
          <Button type="submit" loading={isPending} loadingLabel={frDocuments.submitPending}>
            {frDocuments.submit}
          </Button>
        </div>
      </form>
    </Card>
  );
}
