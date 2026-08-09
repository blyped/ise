'use client';

import { useActionState, useCallback, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  EyeIcon,
  EyeOffIcon,
  Field,
  IconButton,
  Input,
} from '@ise/ui-web';
import { fr } from '@/i18n/fr';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import { signUpAction } from './actions';
import { signUpFormSchema, signUpInputFrom } from './schema';

export function SignUpForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState(signUpAction, initialFormState);
  const { clientErrors, clearField, onSubmit } = useZodForm(signUpFormSchema, signUpInputFrom);
  const [showPassword, setShowPassword] = useState(false);

  const errorFor = useCallback(
    (name: string): string | undefined => clientErrors[name] ?? state.fieldErrors[name],
    [clientErrors, state.fieldErrors],
  );

  if (state.status === 'success') {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="success" title={fr.auth.signUp.confirmationTitle}>
          {state.message}
        </Alert>
        <p className="text-body-sm text-text-secondary">{fr.auth.signUp.confirmationHint}</p>
      </div>
    );
  }

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="redirectTo" value={next} />

      {state.status === 'error' && state.message ? (
        <Alert variant="error" title={state.message}>
          {fr.common.correlationLabel} : {state.correlationId}
        </Alert>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={fr.auth.signUp.firstNameLabel} error={errorFor('firstName')} required>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="firstName"
              autoComplete="given-name"
              placeholder={fr.auth.signUp.firstNamePlaceholder}
              required
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('firstName')}
            />
          )}
        </Field>

        <Field label={fr.auth.signUp.lastNameLabel} error={errorFor('lastName')} required>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="lastName"
              autoComplete="family-name"
              placeholder={fr.auth.signUp.lastNamePlaceholder}
              required
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('lastName')}
            />
          )}
        </Field>
      </div>

      <Field label={fr.auth.signUp.emailLabel} error={errorFor('email')} required>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={fr.auth.signUp.emailPlaceholder}
            required
            aria-invalid={invalid}
            {...(describedBy ? { 'aria-describedby': describedBy } : {})}
            onChange={() => clearField('email')}
          />
        )}
      </Field>

      <Field
        label={fr.auth.signUp.passwordLabel}
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
        label={fr.auth.signUp.passwordConfirmationLabel}
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

      <Checkbox
        name="acceptsTerms"
        label={fr.auth.signUp.termsLabel}
        error={errorFor('acceptsTerms')}
        onChange={() => clearField('acceptsTerms')}
      />

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={isPending}
        loadingLabel={fr.auth.signUp.submitPending}
      >
        {fr.auth.signUp.submit}
      </Button>
    </form>
  );
}
