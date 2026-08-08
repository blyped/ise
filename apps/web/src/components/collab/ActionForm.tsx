'use client';

import { useActionState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert } from '@ise/ui-web';
import { initialFormState, type FormState } from '@/lib/form-state';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from './styles';

/**
 * Enveloppe commune des formulaires des tranches COMMUNAUTES, PROJETS et
 * ACTUALITES & EVENEMENTS.
 *
 * Elle porte les trois exigences transverses de D-93 et D-102 :
 *  - l'etat `pending` est visible sur le bouton, qui reste focalisable ;
 *  - l'erreur est annoncee (`role="alert"`) et rattachee au formulaire
 *    par `aria-describedby` ;
 *  - le `correlation_id` accompagne toujours le message d'erreur.
 *
 * Les champs sont fournis par le composant serveur appelant : cette
 * enveloppe ne connait aucune regle metier.
 */
export interface ActionFormProps {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  /** Champs caches, serialises tels quels. */
  hidden?: Record<string, string>;
  submitLabel: string;
  pendingLabel: string;
  variant?: 'primary' | 'secondary';
  /** Libelle accessible du formulaire lui-meme. */
  label: string;
  children?: ReactNode;
  className?: string;
}

function SubmitButton({
  label,
  pendingLabel,
  variant,
}: {
  label: string;
  pendingLabel: string;
  variant: 'primary' | 'secondary';
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${variant === 'primary' ? PRIMARY_BUTTON : SECONDARY_BUTTON} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function ActionForm({
  action,
  hidden,
  submitLabel,
  pendingLabel,
  variant = 'primary',
  label,
  children,
  className,
}: ActionFormProps) {
  const [state, formAction] = useActionState(action, initialFormState);
  const feedbackId = `retour-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <form
      action={formAction}
      aria-label={label}
      aria-describedby={state.status === 'idle' ? undefined : feedbackId}
      className={className ?? 'flex flex-col gap-4'}
    >
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {children}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton label={submitLabel} pendingLabel={pendingLabel} variant={variant} />
      </div>

      {state.status === 'error' ? (
        <div id={feedbackId}>
          <Alert variant="error" title={state.message ?? 'Action impossible.'}>
            {Object.keys(state.fieldErrors).length > 0 ? (
              <ul className="mt-1 list-disc pl-5">
                {Object.entries(state.fieldErrors).map(([field, message]) => (
                  <li key={field}>{message}</li>
                ))}
              </ul>
            ) : null}
            {state.correlationId === null ? null : (
              <span className="text-caption mt-2 block">
                Référence à communiquer à l’assistance : {state.correlationId}
              </span>
            )}
          </Alert>
        </div>
      ) : null}

      {state.status === 'success' ? (
        <div id={feedbackId}>
          <Alert variant="success" title={state.message ?? 'Action enregistrée.'} />
        </div>
      ) : null}
    </form>
  );
}
