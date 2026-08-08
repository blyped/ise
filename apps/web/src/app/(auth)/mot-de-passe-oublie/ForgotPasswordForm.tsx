'use client';

import { useActionState, useCallback } from 'react';
import { Alert, Button, Field, Input } from '@ise/ui-web';
import { forgotPasswordSchema } from '@ise/validation';
import { fr } from '@/i18n/fr';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import { forgotPasswordAction } from './actions';

function toInput(formData: FormData) {
  return { email: formData.get('email') };
}

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(forgotPasswordAction, initialFormState);
  const { clientErrors, clearField, onSubmit } = useZodForm(forgotPasswordSchema, toInput);

  const errorFor = useCallback(
    (name: string): string | undefined => clientErrors[name] ?? state.fieldErrors[name],
    [clientErrors, state.fieldErrors],
  );

  if (state.status === 'success') {
    return (
      <Alert variant="success" title={fr.auth.forgotPassword.sentTitle}>
        {state.message}
      </Alert>
    );
  }

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {state.status === 'error' && state.message ? (
        <Alert variant="error" title={state.message}>
          {fr.common.correlationLabel} : {state.correlationId}
        </Alert>
      ) : null}

      <Field label={fr.auth.forgotPassword.emailLabel} error={errorFor('email')} required>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={fr.auth.forgotPassword.emailPlaceholder}
            required
            aria-invalid={invalid}
            {...(describedBy ? { 'aria-describedby': describedBy } : {})}
            onChange={() => clearField('email')}
          />
        )}
      </Field>

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={isPending}
        loadingLabel={fr.auth.forgotPassword.submitPending}
      >
        {fr.auth.forgotPassword.submit}
      </Button>
    </form>
  );
}
