'use client';

import { useActionState, useCallback, useState } from 'react';
import Link from 'next/link';
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
import { signInSchema } from '@ise/validation';
import { fr } from '@/i18n/fr';
import { ROUTES } from '@/lib/routes';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import { signInAction } from './actions';

function toInput(formData: FormData) {
  return {
    email: formData.get('email'),
    password: formData.get('password'),
    rememberMe: formData.get('rememberMe') === 'on',
  };
}

export function SignInForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState(signInAction, initialFormState);
  const { clientErrors, clearField, onSubmit } = useZodForm(signInSchema, toInput);
  const [showPassword, setShowPassword] = useState(false);

  const errorFor = useCallback(
    (name: string): string | undefined => clientErrors[name] ?? state.fieldErrors[name],
    [clientErrors, state.fieldErrors],
  );

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {/* ADDENDUM §4 — nom canonique du parametre de retour. */}
      <input type="hidden" name="redirectTo" value={next} />

      {state.status === 'error' && state.message ? (
        <Alert variant="error" title={state.message}>
          {fr.common.correlationLabel} : {state.correlationId}
        </Alert>
      ) : null}

      <Field label={fr.auth.signIn.emailLabel} error={errorFor('email')} required>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={fr.auth.signIn.emailPlaceholder}
            required
            aria-invalid={invalid}
            {...(describedBy ? { 'aria-describedby': describedBy } : {})}
            onChange={() => clearField('email')}
          />
        )}
      </Field>

      <Field
        label={fr.auth.signIn.passwordLabel}
        error={errorFor('password')}
        required
        labelAction={
          <Link
            href={ROUTES.forgotPassword}
            className="text-caption text-primary hover:text-primary-hover focus-visible:outline-active-blue font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {fr.auth.signIn.forgotLink}
          </Link>
        }
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
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

      <Checkbox name="rememberMe" label={fr.auth.signIn.rememberMe} />

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={isPending}
        loadingLabel={fr.auth.signIn.submitPending}
      >
        {fr.auth.signIn.submit}
      </Button>
    </form>
  );
}
