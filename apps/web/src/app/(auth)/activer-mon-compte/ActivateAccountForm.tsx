'use client';

import { useActionState, useCallback, useState } from 'react';
import { Alert, Button, EyeIcon, EyeOffIcon, Field, IconButton, Input } from '@ise/ui-web';
import { resetPasswordSchema } from '@ise/validation';
import { fr } from '@/i18n/fr';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import { activateAccountAction } from './actions';

function toInput(formData: FormData) {
  return {
    password: formData.get('password'),
    passwordConfirmation: formData.get('passwordConfirmation'),
  };
}

/** D-161 — choix du premier mot de passe d'un compte pre-cree. */
export function ActivateAccountForm() {
  const [state, formAction, isPending] = useActionState(activateAccountAction, initialFormState);
  const { clientErrors, clearField, onSubmit } = useZodForm(resetPasswordSchema, toInput);
  const [showPassword, setShowPassword] = useState(false);

  const errorFor = useCallback(
    (name: string): string | undefined => clientErrors[name] ?? state.fieldErrors[name],
    [clientErrors, state.fieldErrors],
  );

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {state.status === 'error' && state.message ? (
        <Alert variant="error" title={state.message}>
          {fr.common.correlationLabel} : {state.correlationId}
        </Alert>
      ) : null}

      <Field
        label={fr.auth.resetPassword.passwordLabel}
        hint={fr.auth.signUp.passwordHint}
        error={errorFor('password')}
        required
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            aria-invalid={invalid}
            {...(describedBy ? { 'aria-describedby': describedBy } : {})}
            onChange={() => clearField('password')}
            trailing={
              <IconButton
                label={showPassword ? fr.common.hidePassword : fr.common.showPassword}
                icon={
                  showPassword ? (
                    <EyeOffIcon width={18} height={18} />
                  ) : (
                    <EyeIcon width={18} height={18} />
                  )
                }
                size="sm"
                onClick={() => setShowPassword((value) => !value)}
              />
            }
          />
        )}
      </Field>

      <Field
        label={fr.auth.resetPassword.passwordConfirmationLabel}
        error={errorFor('passwordConfirmation')}
        required
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="passwordConfirmation"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            aria-invalid={invalid}
            {...(describedBy ? { 'aria-describedby': describedBy } : {})}
            onChange={() => clearField('passwordConfirmation')}
          />
        )}
      </Field>

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={isPending}
        loadingLabel={fr.auth.activateAccount.submitPending}
      >
        {fr.auth.activateAccount.submit}
      </Button>
    </form>
  );
}
