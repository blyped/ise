'use client';

import { useActionState, useCallback } from 'react';
import Link from 'next/link';
import { Alert, Button, Checkbox, Radio, RadioGroup } from '@ise/ui-web';
import { claimSubmitSchema, type ClaimMethod } from '@ise/validation';
import { fr } from '@/i18n/fr';
import { ROUTES } from '@/lib/routes';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import { submitClaimAction } from './actions';

function toInput(formData: FormData) {
  return {
    profileId: formData.get('profileId'),
    claimMethod: formData.get('claimMethod'),
    confirmsIdentity: formData.get('confirmsIdentity') === 'on',
    declaredDetails: {},
  };
}

interface MethodOption {
  value: ClaimMethod;
  label: string;
  description: string;
}

export function ClaimConfirmForm({
  profileId,
  hasHistoricalEmail,
}: {
  profileId: string;
  hasHistoricalEmail: boolean;
}) {
  const [state, formAction, isPending] = useActionState(submitClaimAction, initialFormState);
  const { clientErrors, clearField, onSubmit } = useZodForm(claimSubmitSchema, toInput);

  const errorFor = useCallback(
    (name: string): string | undefined => clientErrors[name] ?? state.fieldErrors[name],
    [clientErrors, state.fieldErrors],
  );

  /*
    La methode « e-mail historique » n'est proposee que si le profil PORTE
    reellement une adresse historique : proposer une preuve inexistante
    ferait echouer la demande sans que l'utilisateur comprenne pourquoi
    (MASTER PROMPT §98).
  */
  const methods: MethodOption[] = [
    ...(hasHistoricalEmail
      ? [
          {
            value: 'historical_email' as const,
            label: fr.claim.confirm.methodEmail,
            description: fr.claim.confirm.methodEmailHint,
          },
        ]
      : []),
    {
      value: 'document',
      label: fr.claim.confirm.methodDocument,
      description: fr.claim.confirm.methodDocumentHint,
    },
    {
      value: 'promotion_manager',
      label: fr.claim.confirm.methodPromotionManager,
      description: fr.claim.confirm.methodPromotionManagerHint,
    },
  ];

  const defaultMethod = methods[0]?.value;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="profileId" value={profileId} />

      {state.status === 'error' && state.message ? (
        <Alert variant="error" title={state.message}>
          {fr.common.correlationLabel} : {state.correlationId}
        </Alert>
      ) : null}

      {!hasHistoricalEmail ? (
        <Alert variant="info" title={fr.claim.confirm.methodEmailUnavailable} />
      ) : null}

      <RadioGroup
        legend={fr.claim.confirm.methodLegend}
        hint={fr.claim.confirm.methodHint}
        error={errorFor('claimMethod')}
      >
        {methods.map((method) => (
          <Radio
            key={method.value}
            name="claimMethod"
            value={method.value}
            label={method.label}
            description={method.description}
            defaultChecked={method.value === defaultMethod}
            onChange={() => clearField('claimMethod')}
          />
        ))}
      </RadioGroup>

      <Checkbox
        name="confirmsIdentity"
        label={fr.claim.confirm.confirmLabel}
        error={errorFor('confirmsIdentity')}
        onChange={() => clearField('confirmsIdentity')}
      />

      {/*
        `loading` desactive le bouton : deux clics rapides ne peuvent pas
        produire deux reclamations. La base tient de toute facon la garantie
        finale (verrou + index unique), l'interface ne fait que l'accompagner.
      */}
      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={isPending}
        loadingLabel={fr.claim.confirm.submitPending}
      >
        {fr.claim.confirm.submit}
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={ROUTES.claimSearch}
          className="text-body-sm text-primary hover:text-primary-hover focus-visible:outline-active-blue font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {fr.claim.confirm.notMe}
        </Link>
        <Link
          href={ROUTES.claimSearch}
          className="text-body-sm text-text-muted hover:text-text-secondary focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {fr.claim.confirm.backToResults}
        </Link>
      </div>
    </form>
  );
}
