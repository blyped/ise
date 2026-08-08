'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Alert, Button } from '@ise/ui-web';
import { introductionMachine, type IntroductionActor, type IntroductionStatus } from '@ise/domain';
import { frNetwork } from '@/i18n/network';
import { initialFormState } from '@/lib/form-state';
import { introductionOutcomeRoute } from '@/lib/routes/network';
import { transitionIntroductionAction } from '@/app/reseau/introductions/actions';

/**
 * ISE-045 — CTA d'une introduction.
 *
 * Les boutons ne sont pas ecrits en dur : ils viennent de
 * `introductionMachine.available(statut, acteur)`, miroir TypeScript de
 * la matrice SQL de `public.transition_introduction()` (D-50). Une
 * transition retiree de la machine disparait donc de l'interface, et une
 * transition affichee est necessairement acceptee par la base.
 *
 * Deux transitions sont traitees a part : `completed` et `no_outcome`
 * exigent un RESULTAT DECLARE. Elles ne sont pas des boutons d'action
 * mais des liens vers ISE-046, ou la personne declare ce qui s'est
 * reellement produit (MASTER PROMPT §25).
 */
const OUTCOME_STATUSES: readonly IntroductionStatus[] = ['completed', 'no_outcome'];

export function IntroductionActions({
  introductionId,
  status,
  actor,
}: {
  introductionId: string;
  status: IntroductionStatus;
  actor: IntroductionActor;
}) {
  const [state, formAction, isPending] = useActionState(
    transitionIntroductionAction,
    initialFormState,
  );

  const transitions = introductionMachine.available(status, actor);
  const direct = transitions.filter((transition) => !OUTCOME_STATUSES.includes(transition.to));
  const needsOutcome = transitions.some((transition) => OUTCOME_STATUSES.includes(transition.to));

  if (transitions.length === 0) {
    return <p className="text-body-sm text-text-muted">{frNetwork.follow.actionsNone}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {isPending ? frNetwork.follow.actionPending : (state.message ?? '')}
      </p>

      {state.status === 'error' && state.message !== null ? (
        <Alert variant="error" title={state.message}>
          {frNetwork.common.correlationLabel} : {state.correlationId}
        </Alert>
      ) : null}

      {state.status === 'success' ? <Alert variant="success" title={state.message ?? ''} /> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {direct.map((transition, index) => (
          <form key={`${transition.from}-${transition.to}`} action={formAction}>
            <input type="hidden" name="introductionId" value={introductionId} />
            <input type="hidden" name="toStatus" value={transition.to} />
            <Button
              type="submit"
              variant={index === 0 ? 'primary' : 'secondary'}
              size="md"
              loading={isPending}
              loadingLabel={frNetwork.follow.actionPending}
            >
              {transition.label}
            </Button>
          </form>
        ))}

        {needsOutcome ? (
          <Link
            href={introductionOutcomeRoute(introductionId)}
            className="rounded-base border-primary bg-surface text-body-sm text-primary focus-visible:outline-active-blue inline-flex min-h-[44px] items-center justify-center border px-5 font-semibold transition-colors duration-150 hover:bg-[#EFF6FF] focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {frNetwork.follow.outcomeLink}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
