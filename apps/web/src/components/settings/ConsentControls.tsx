'use client';

import { useActionState } from 'react';
import { Alert, Badge, Button } from '@ise/ui-web';
import { frSettings, ts } from '@/i18n/settings';
import { initialFormState } from '@/lib/form-state';
import { formatDate, type ConsentRow } from '@/lib/messaging-view';
import { recordConsentAction } from '@/app/parametres/actions';

/**
 * SYS-009 — accorder ou revoquer un consentement.
 *
 * `consent_records` est APPEND-ONLY (0048) : revoquer n'efface pas la
 * trace precedente, cela en pose une nouvelle. Le libelle du bouton le
 * dit, et le texte de retour aussi.
 *
 * La version transmise est celle deja enregistree lorsqu'elle existe.
 * A defaut, `fallbackVersion` : aucun registre de documents contractuels
 * n'existe encore en base, on ne fabrique donc pas de numero de version
 * plus precis que celui qui est reellement publie.
 */
export function ConsentControls({
  consentType,
  current,
  fallbackVersion,
  optional,
}: {
  consentType: string;
  current: ConsentRow | null;
  fallbackVersion: string;
  /** Un consentement NON optionnel ne se revoque pas depuis cet ecran. */
  optional: boolean;
}) {
  const [state, formAction, isPending] = useActionState(recordConsentAction, initialFormState);

  const granted = current?.granted === true;
  const version =
    current?.version !== undefined && current.version.length > 0
      ? current.version
      : fallbackVersion;

  return (
    <div className="border-border flex flex-col gap-3 border-b py-4 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-body-sm text-text-primary font-medium">
            {frSettings.data.consentType[consentType] ?? consentType}
          </p>
          <p className="text-caption text-text-muted">
            {current === null
              ? frSettings.data.consentNever
              : granted
                ? ts(frSettings.data.consentGranted, { date: formatDate(current.grantedAt) })
                : ts(frSettings.data.consentRevoked, { date: formatDate(current.revokedAt) })}
          </p>
        </div>
        <Badge tone={granted ? 'success' : 'neutral'}>{granted ? 'Accordé' : 'Non accordé'}</Badge>
      </div>

      {state.status === 'error' && state.message !== null ? (
        <Alert variant="error" title={state.message}>
          {frSettings.correlationLabel} : {state.correlationId}
        </Alert>
      ) : null}
      {state.status === 'success' && state.message !== null ? (
        <Alert variant="success" title={state.message} />
      ) : null}

      {optional ? (
        <form action={formAction} className="self-start">
          <input type="hidden" name="consentType" value={consentType} />
          <input type="hidden" name="version" value={version} />
          <input type="hidden" name="granted" value={granted ? 'false' : 'true'} />
          <Button type="submit" variant="secondary" size="sm" loading={isPending}>
            {granted ? frSettings.data.revoke : frSettings.data.grant}
          </Button>
        </form>
      ) : (
        <p className="text-caption text-text-muted">
          Ce consentement conditionne l’usage du service : il se retire en supprimant le compte.
        </p>
      )}
    </div>
  );
}
