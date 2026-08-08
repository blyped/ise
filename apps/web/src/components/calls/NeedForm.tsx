'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
  Checkbox,
  ErrorState,
  Field,
  Input,
  OptionCardGroup,
  RadioGroup,
  Radio,
  Select,
  Textarea,
} from '@ise/ui-web';
import { frCalls } from '@/i18n/calls';
import { CALL_ROUTES } from '@/lib/routes/calls';
import { initialFormState } from '@/lib/form-state';
import { CALL_FAMILIES, CALL_TYPES, VISIBILITY_LEVELS, type CallDetail } from '@/lib/calls-view';
import { saveNeedAction } from '@/app/appels/actions';

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 5000;

/**
 * ISE-049 — étape 1 de l'assistant : le besoin.
 *
 * ECART ASSUME PAR RAPPORT A LA MAQUETTE : la maquette propose trois
 * boutons d'urgence (« Normale / Prioritaire / Urgente »). Ils ne sont
 * pas rendus. L'urgence est DEDUITE de la date d'échéance (D6 §38) et
 * la base ne connaît que deux valeurs. Laisser un membre se déclarer
 * urgent aurait rendu le badge insignifiant en quelques semaines ;
 * l'écran l'explique au lieu de le proposer.
 */
export function NeedForm({ call }: { call: CallDetail | null }) {
  const [state, formAction, isPending] = useActionState(saveNeedAction, initialFormState);
  const [titleLength, setTitleLength] = useState(call?.title.length ?? 0);
  const [descriptionLength, setDescriptionLength] = useState(call?.description.length ?? 0);

  const deadlineValue =
    call?.deadline !== null && call?.deadline !== undefined ? call.deadline.slice(0, 10) : '';

  return (
    <form action={formAction} noValidate className="flex flex-col gap-7">
      {call !== null ? <input type="hidden" name="callId" value={call.callId} /> : null}

      {state.status === 'error' && state.message !== null && state.correlationId === null ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <OptionCardGroup
        type="radio"
        name="callFamily"
        legend={frCalls.wizard.familyLegend}
        hint={frCalls.wizard.familyHint}
        columns={3}
        defaultValues={
          call?.callFamily !== null && call?.callFamily !== undefined ? [call.callFamily] : []
        }
        items={CALL_FAMILIES.map((family) => ({
          value: family,
          label: frCalls.family[family] ?? family,
          description: frCalls.familyHint[family] ?? '',
        }))}
      />

      <Field label={frCalls.wizard.typeLabel} hint={frCalls.wizard.typeHint} required>
        {({ id, describedBy, invalid }) => (
          <Select
            id={id}
            name="callType"
            defaultValue={call?.callType ?? 'expert'}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            options={CALL_TYPES.map((type) => ({
              value: type,
              label: frCalls.type[type] ?? type,
            }))}
          />
        )}
      </Field>

      <Field
        label={frCalls.wizard.titleLabel}
        hint={frCalls.wizard.titleHint}
        required
        error={state.fieldErrors['title']}
      >
        {({ id, describedBy, invalid }) => (
          <>
            <Input
              id={id}
              name="title"
              defaultValue={call?.title ?? ''}
              maxLength={TITLE_MAX}
              placeholder={frCalls.wizard.titlePlaceholder}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              onChange={(event) => setTitleLength(event.currentTarget.value.length)}
            />
            <p className="text-caption text-text-muted mt-1 text-right" aria-live="polite">
              {titleLength} / {TITLE_MAX}
            </p>
          </>
        )}
      </Field>

      <Field
        label={frCalls.wizard.descriptionLabel}
        hint={frCalls.wizard.descriptionHint}
        required
        error={state.fieldErrors['description']}
      >
        {({ id, describedBy, invalid }) => (
          <>
            <Textarea
              id={id}
              name="description"
              rows={8}
              defaultValue={call?.description ?? ''}
              maxLength={DESCRIPTION_MAX}
              placeholder={frCalls.wizard.descriptionPlaceholder}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              onChange={(event) => setDescriptionLength(event.currentTarget.value.length)}
            />
            <p className="text-caption text-text-muted mt-1 text-right" aria-live="polite">
              {descriptionLength} / {DESCRIPTION_MAX}
            </p>
          </>
        )}
      </Field>

      <Field label={frCalls.wizard.contextLabel} hint={frCalls.wizard.contextHint}>
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            name="context"
            rows={4}
            defaultValue={call?.context ?? ''}
            maxLength={2000}
            aria-describedby={describedBy}
          />
        )}
      </Field>

      <Field label={frCalls.wizard.deadlineLabel} hint={frCalls.wizard.deadlineHint}>
        {({ id, describedBy }) => (
          <Input
            id={id}
            name="deadline"
            type="date"
            defaultValue={deadlineValue}
            aria-describedby={describedBy}
          />
        )}
      </Field>

      <Alert variant="info" title={frCalls.wizard.urgencyNotice}>
        {frCalls.wizard.urgencyNoticeBody}
      </Alert>

      <RadioGroup legend={frCalls.wizard.visibilityLegend}>
        {VISIBILITY_LEVELS.map((level) => (
          <Radio
            key={level}
            name="visibility"
            value={level}
            defaultChecked={(call?.visibility ?? 'members') === level}
            label={frCalls.visibility[level] ?? level}
            description={frCalls.visibilityHint[level] ?? ''}
          />
        ))}
      </RadioGroup>

      <Checkbox name="hideOrganization" label={frCalls.wizard.hideOrganizationLabel} />

      {state.status === 'error' && state.correlationId !== null ? (
        <ErrorState
          title={frCalls.common.loadErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={CALL_ROUTES.list}
          className="rounded-base bg-surface text-body-sm text-text-primary hover:border-primary focus-visible:outline-active-blue inline-flex min-h-[44px] items-center border border-[#CBD5E1] px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {frCalls.common.cancel}
        </Link>
        <Button type="submit" loading={isPending} loadingLabel={frCalls.common.savePending}>
          {frCalls.common.save}
        </Button>
      </div>
    </form>
  );
}
