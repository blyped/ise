'use client';

import { useActionState } from 'react';
import { Alert, Button, ErrorState, Field } from '@ise/ui-web';
import { frContentProposals } from '@/i18n/content-proposals';
import { initialFormState, type FormState } from '@/lib/form-state';
import { FIELD, TEXTAREA } from '@/components/collab/styles';

/**
 * DÉCIDER D'UNE PROPOSITION (0132) — accepter ou refuser.
 *
 * Composant partagé par les deux files (actualités et événements) : c'est
 * la même décision, avec les mêmes conséquences. Les Server Actions, elles,
 * restent propres à chaque nature et sont passées en propriétés — un
 * composant client ne peut pas importer un fichier `'use server'` d'une
 * autre route sans lier les deux écrans entre eux.
 *
 * DEUX FORMULAIRES FRÈRES, PAS UN SEUL. Accepter et refuser sont deux
 * gestes, et un formulaire imbriqué n'existe pas en HTML. Cela évite aussi
 * qu'un motif de refus saisi puis abandonné parte avec une acceptation.
 */

export interface ProposalDecisionFormsProps {
  proposalId: string;
  /** `true` si l'auteur a joint un visuel encore en attente de décision. */
  hasCover: boolean;
  /** Texte alternatif proposé par l'auteur, repris tel quel par défaut. */
  coverAlt: string;
  approveAction: (state: FormState, formData: FormData) => Promise<FormState>;
  rejectAction: (state: FormState, formData: FormData) => Promise<FormState>;
}

export function ProposalDecisionForms({
  proposalId,
  hasCover,
  coverAlt,
  approveAction,
  rejectAction,
}: ProposalDecisionFormsProps) {
  const [approveState, approve, isApproving] = useActionState(approveAction, initialFormState);
  const [rejectState, reject, isRejecting] = useActionState(rejectAction, initialFormState);
  const labels = frContentProposals.admin;

  return (
    <div className="flex flex-col gap-7">
      {approveState.status === 'success' && approveState.message ? (
        <Alert variant="success" title={approveState.message} />
      ) : null}
      {rejectState.status === 'success' && rejectState.message ? (
        <Alert variant="success" title={rejectState.message} />
      ) : null}

      {/* -------------------------------------------------------- */}
      {/* Accepter                                                  */}
      {/* -------------------------------------------------------- */}
      <form action={approve} className="flex flex-col gap-5">
        <input type="hidden" name="id" value={proposalId} />

        {hasCover ? (
          <>
            <label className="text-body-sm text-text-primary flex items-start gap-3">
              <input
                type="checkbox"
                name="keepCover"
                defaultChecked
                className="mt-1 h-[18px] w-[18px] shrink-0"
              />
              <span>
                <span className="font-medium">{labels.coverKeep}</span>
                <span className="text-caption text-text-muted mt-1 block">
                  {labels.coverKeepHint}
                </span>
              </span>
            </label>

            <Field
              label={labels.coverAltLabel}
              hint={labels.coverAltHint}
              error={approveState.fieldErrors['coverAlt']}
            >
              {({ id, describedBy, invalid }) => (
                <input
                  id={id}
                  name="coverAlt"
                  type="text"
                  maxLength={200}
                  defaultValue={coverAlt}
                  aria-invalid={invalid}
                  {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                  className={FIELD}
                />
              )}
            </Field>
          </>
        ) : (
          <p className="text-body-sm text-text-secondary">{labels.coverNone}</p>
        )}

        {/* D-128 rappelée là où la décision se prend, pas dans une note
            de bas de page : publier n'est pas mettre en avant. */}
        <Alert variant="info" title={labels.landingNote} />

        {approveState.status === 'error' && approveState.correlationId !== null ? (
          <ErrorState
            title={frContentProposals.common.saveErrorTitle}
            correlationId={approveState.correlationId}
            {...(approveState.message ? { description: approveState.message } : {})}
          />
        ) : null}

        <div>
          <Button type="submit" loading={isApproving} loadingLabel={labels.approvePending}>
            {labels.approve}
          </Button>
        </div>
      </form>

      {/* -------------------------------------------------------- */}
      {/* Refuser                                                   */}
      {/* -------------------------------------------------------- */}
      <form action={reject} className="border-border flex flex-col gap-5 border-t pt-7">
        <input type="hidden" name="id" value={proposalId} />

        <Field
          label={labels.reasonLabel}
          hint={labels.reasonHint}
          error={rejectState.fieldErrors['reason']}
          required
        >
          {({ id, describedBy, invalid }) => (
            <textarea
              id={id}
              name="reason"
              rows={4}
              minLength={10}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              className={TEXTAREA}
            />
          )}
        </Field>

        {rejectState.status === 'error' && rejectState.correlationId !== null ? (
          <ErrorState
            title={frContentProposals.common.saveErrorTitle}
            correlationId={rejectState.correlationId}
            {...(rejectState.message ? { description: rejectState.message } : {})}
          />
        ) : null}

        <div>
          <Button
            type="submit"
            variant="secondary"
            loading={isRejecting}
            loadingLabel={labels.rejectPending}
          >
            {labels.reject}
          </Button>
        </div>
      </form>
    </div>
  );
}
