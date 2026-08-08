'use client';

import { useActionState, useCallback, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Field, Radio, RadioGroup, Textarea } from '@ise/ui-web';
import { limits } from '@ise/config';
import { connectionRequestSchema } from '@ise/validation';
import { frNetwork, tn } from '@/i18n/network';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import { memberProfileRoute } from '@/lib/routes/search';
import { sendConnectionRequestAction } from './actions';

/**
 * Les quatre motifs d'ISE-038. Chaque valeur est un code REEL de
 * `connection_requests.context` : aucun motif affiche n'est sans
 * destination en base (MASTER PROMPT §113).
 */
const CONTEXTS = [
  { value: 'introduction', hint: 'Discussion professionnelle ciblée.' },
  { value: 'project', hint: 'Projet, mission ou consortium.' },
  { value: 'other', hint: 'Retour d’expérience ou orientation.' },
  { value: 'promotion', hint: 'Lien professionnel général.' },
] as const;

function toInput(formData: FormData) {
  const message = formData.get('message');
  const context = formData.get('context');
  return {
    addresseeProfileId: formData.get('addresseeProfileId'),
    ...(typeof message === 'string' && message.trim().length > 0 ? { message } : {}),
    ...(typeof context === 'string' && context.length > 0 ? { context } : {}),
  };
}

export function ConnectionRequestForm({ profileId }: { profileId: string }) {
  const [state, formAction, isPending] = useActionState(
    sendConnectionRequestAction,
    initialFormState,
  );
  const { clientErrors, clearField, onSubmit } = useZodForm(connectionRequestSchema, toInput);
  const [messageLength, setMessageLength] = useState(0);

  const errorFor = useCallback(
    (name: string): string | undefined => clientErrors[name] ?? state.fieldErrors[name],
    [clientErrors, state.fieldErrors],
  );

  const max = limits.text.connectionMessageMax;
  const remaining = max - messageLength;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-7">
      <input type="hidden" name="addresseeProfileId" value={profileId} />

      {state.status === 'error' && state.message !== null ? (
        <Alert variant="error" title={frNetwork.connect.errorTitle}>
          {state.message}
          {state.correlationId !== null ? (
            <>
              <br />
              {frNetwork.common.correlationLabel} : {state.correlationId}
            </>
          ) : null}
        </Alert>
      ) : null}

      <RadioGroup
        legend={frNetwork.connect.contextLegend}
        hint={frNetwork.connect.contextHint}
        error={errorFor('context')}
      >
        {CONTEXTS.map((option, index) => (
          <Radio
            key={option.value}
            name="context"
            value={option.value}
            label={frNetwork.context[option.value] ?? option.value}
            description={option.hint}
            defaultChecked={index === 0}
            onChange={() => clearField('context')}
          />
        ))}
      </RadioGroup>

      <Field
        label={frNetwork.connect.messageLabel}
        hint={frNetwork.connect.messageHint}
        error={errorFor('message')}
      >
        {({ id, describedBy, invalid }) => (
          <div className="flex flex-col gap-2">
            <Textarea
              id={id}
              name="message"
              rows={6}
              maxLength={max}
              placeholder={frNetwork.connect.messagePlaceholder}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              onChange={(event) => {
                setMessageLength(event.currentTarget.value.length);
                clearField('message');
              }}
            />
            {/* Compteur annonce aux lecteurs d'ecran seulement quand il
                approche de la limite : une annonce a chaque frappe serait
                inutilisable. */}
            <p
              className="text-caption text-text-muted self-end"
              aria-live={remaining <= 40 ? 'polite' : 'off'}
            >
              {tn(frNetwork.common.charactersLeft, { count: remaining })}
            </p>
          </div>
        )}
      </Field>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href={memberProfileRoute(profileId)}
          className="rounded-base bg-surface text-body text-text-primary hover:border-primary hover:bg-surface-muted focus-visible:outline-active-blue inline-flex h-[48px] items-center justify-center border border-[#CBD5E1] px-7 font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {frNetwork.common.cancel}
        </Link>
        {/* `loading` desactive le bouton : deux clics rapides ne peuvent
            pas produire deux demandes. La base tient de toute facon la
            garantie finale (verrou + index unique partiel). */}
        <Button
          type="submit"
          size="lg"
          loading={isPending}
          loadingLabel={frNetwork.connect.submitPending}
        >
          {frNetwork.connect.submit}
        </Button>
      </div>
    </form>
  );
}
