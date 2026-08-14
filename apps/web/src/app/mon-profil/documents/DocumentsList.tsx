'use client';

import { useActionState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
} from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { frDocuments, frenchFileSize } from '@/i18n/profile-documents';
import { initialFormState } from '@/lib/form-state';
import type { MyDocument } from '@/lib/profile-documents-view';
import { deleteProfileDocumentAction, setPrimaryProfileDocumentAction } from './actions';

const LINK_CLASS =
  'text-body-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

function frenchDate(iso: string | null): string {
  if (iso === null) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Liste des documents déposés, avec téléchargement, désignation du
 * document principal et suppression.
 *
 * UN SEUL état d'action pour toute la liste : le `documentId` voyage dans
 * un champ caché. Deux membres de la même liste ne sont jamais soumis en
 * même temps, et l'écran est rechargé après chaque action.
 *
 * L'avertissement de suppression n'est pas une politesse : supprimer une
 * pièce la retire aussi des candidatures déjà envoyées (clés étrangères de
 * la migration 0008). Le dire avant vaut mieux que le constater après.
 */
export function DocumentsList({ documents }: { documents: readonly MyDocument[] }) {
  const [deleteState, deleteAction, isDeleting] = useActionState(
    deleteProfileDocumentAction,
    initialFormState,
  );
  const [primaryState, primaryAction, isPromoting] = useActionState(
    setPrimaryProfileDocumentAction,
    initialFormState,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{frDocuments.listTitle}</CardTitle>
      </CardHeader>

      {deleteState.status === 'success' && deleteState.message !== null ? (
        <Alert variant="success" title={deleteState.message} className="mb-5" />
      ) : null}
      {primaryState.status === 'success' && primaryState.message !== null ? (
        <Alert variant="success" title={primaryState.message} className="mb-5" />
      ) : null}

      {deleteState.status === 'error' && deleteState.correlationId !== null ? (
        <ErrorState
          title={frProfile.common.saveErrorTitle}
          correlationId={deleteState.correlationId}
          {...(deleteState.message ? { description: deleteState.message } : {})}
        />
      ) : null}
      {primaryState.status === 'error' && primaryState.correlationId !== null ? (
        <ErrorState
          title={frProfile.common.saveErrorTitle}
          correlationId={primaryState.correlationId}
          {...(primaryState.message ? { description: primaryState.message } : {})}
        />
      ) : null}

      {documents.length === 0 ? (
        <EmptyState title={frDocuments.emptyTitle} description={frDocuments.emptyBody} />
      ) : (
        <>
          <ul className="flex flex-col gap-5">
            {documents.map((document) => (
              <li
                key={document.documentId}
                className="border-border flex flex-col gap-3 border-b pb-5 last:border-b-0 last:pb-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span className="text-body-sm text-text-primary min-w-0 font-semibold">
                    {document.title ?? document.filename}
                  </span>
                  {document.isPrimary ? (
                    <Badge tone="success">{frDocuments.primaryBadge}</Badge>
                  ) : null}
                </div>

                <p className="text-caption text-text-secondary">
                  {frDocuments.types[document.documentType] ?? document.documentType} ·{' '}
                  {frenchFileSize(document.sizeBytes)} · {frDocuments.colDate.toLowerCase()}{' '}
                  {frenchDate(document.createdAt)}
                </p>

                <div className="flex flex-wrap items-center gap-5">
                  {document.downloadUrl !== null ? (
                    <a
                      href={document.downloadUrl}
                      className={LINK_CLASS}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {frDocuments.download}
                    </a>
                  ) : (
                    <span className="text-caption text-text-muted">
                      {frDocuments.downloadUnavailable}
                    </span>
                  )}

                  {document.isPrimary ? null : (
                    <form action={primaryAction}>
                      <input type="hidden" name="documentId" value={document.documentId} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        loading={isPromoting}
                        loadingLabel={frDocuments.makePrimaryPending}
                      >
                        {frDocuments.makePrimary}
                      </Button>
                    </form>
                  )}

                  <form action={deleteAction}>
                    <input type="hidden" name="documentId" value={document.documentId} />
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      loading={isDeleting}
                      loadingLabel={frDocuments.deletePending}
                    >
                      {frDocuments.delete}
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>

          <p className="text-caption text-text-muted mt-6">{frDocuments.deleteWarning}</p>
        </>
      )}
    </Card>
  );
}
