'use client';

import { useActionState, useState } from 'react';
import { Alert, Button, Field, Input, Radio, RadioGroup, Switch } from '@ise/ui-web';
import { frSearch } from '@/i18n/search';
import { useZodForm } from '@/lib/use-zod-form';
import { saveSearchAction } from './actions';
import { initialSaveSearchState } from './states';
import { saveSearchFormSchema, saveSearchInputFrom } from './schema';

const FREQUENCIES = [
  { value: 'daily', label: frSearch.save.frequencyDaily },
  { value: 'weekly', label: frSearch.save.frequencyWeekly },
  { value: 'monthly', label: frSearch.save.frequencyMonthly },
];

const CHANNELS = [
  { value: 'in_app', label: frSearch.save.channelInApp },
  { value: 'email', label: frSearch.save.channelEmail },
  { value: 'both', label: frSearch.save.channelBoth },
];

/**
 * ISE-036 — formulaire d'enregistrement d'une recherche et de son alerte.
 *
 * Le meme `saveSearchFormSchema` est joue ici et dans la Server Action
 * (MASTER PROMPT §62). Les valeurs de frequence et de canal sont
 * exactement celles que la base accepte : rien n'est propose qui serait
 * ensuite refuse par une contrainte CHECK.
 *
 * ECART ASSUME PAR RAPPORT A LA MAQUETTE : elle propose « Immédiatement »
 * et « Push mobile ». La table `search_alerts` n'accepte que
 * `daily | weekly | monthly` et `in_app | email | both`, et aucune
 * application mobile n'est livree. Proposer ces deux options serait
 * proposer une promesse que rien ne tient (MASTER PROMPT §27, §113).
 */
export function SaveSearchForm({
  queryString,
  defaultName,
  savedSearchId,
  hasCriteria,
}: {
  queryString: string;
  defaultName: string;
  savedSearchId: string | null;
  hasCriteria: boolean;
}) {
  const [state, formAction, isPending] = useActionState(saveSearchAction, initialSaveSearchState);
  const { clientErrors, clearField, onSubmit } = useZodForm(
    saveSearchFormSchema,
    saveSearchInputFrom,
  );
  const [alertEnabled, setAlertEnabled] = useState(true);

  const errorFor = (name: string): string | undefined =>
    clientErrors[name] ?? state.fieldErrors[name];

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-7">
      <input type="hidden" name="criteres" value={queryString} />
      {savedSearchId !== null ? (
        <input type="hidden" name="savedSearchId" value={savedSearchId} />
      ) : null}

      {state.status === 'success' && state.message !== null ? (
        <Alert variant="success" title={frSearch.save.successTitle}>
          {state.message}
        </Alert>
      ) : null}

      {state.status === 'error' && state.message !== null ? (
        <Alert variant="error" title={state.message}>
          {state.correlationId !== null ? (
            <span className="text-caption text-text-muted">
              {frSearch.common.correlationLabel} :{' '}
              <code className="font-mono">{state.correlationId}</code>
            </span>
          ) : null}
        </Alert>
      ) : null}

      <Field
        label={frSearch.save.nameLabel}
        hint={frSearch.save.nameHint}
        error={errorFor('name')}
        required
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="name"
            type="text"
            defaultValue={defaultName}
            placeholder={frSearch.save.namePlaceholder}
            maxLength={120}
            required
            aria-invalid={invalid}
            {...(describedBy ? { 'aria-describedby': describedBy } : {})}
            onChange={() => clearField('name')}
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-5 border-0 p-0">
        <legend className="text-body text-text-primary font-semibold">
          {frSearch.save.alertLegend}
        </legend>

        <Switch
          name="alertEnabled"
          checked={alertEnabled}
          onCheckedChange={setAlertEnabled}
          label={frSearch.save.alertToggle}
          description={frSearch.save.alertToggleHint}
        />

        {/*
          Les preferences ne sont demandees que si l'alerte est activee :
          un reglage inerte serait un controle decoratif.
        */}
        {alertEnabled ? (
          <div className="grid gap-6 md:grid-cols-2">
            <RadioGroup legend={frSearch.save.frequencyLabel} error={errorFor('frequency')}>
              {FREQUENCIES.map((option) => (
                <Radio
                  key={option.value}
                  name="frequency"
                  value={option.value}
                  label={option.label}
                  defaultChecked={option.value === 'weekly'}
                />
              ))}
            </RadioGroup>
            <RadioGroup legend={frSearch.save.channelLabel} error={errorFor('channel')}>
              {CHANNELS.map((option) => (
                <Radio
                  key={option.value}
                  name="channel"
                  value={option.value}
                  label={option.label}
                  defaultChecked={option.value === 'in_app'}
                />
              ))}
            </RadioGroup>
          </div>
        ) : null}
      </fieldset>

      {/*
        Honnetete sur ce que fait reellement l'enregistrement aujourd'hui.
        Aucun delai d'envoi n'est annonce : le worker n'existe pas.
      */}
      <Alert variant="warning" title={frSearch.save.workerWarningTitle}>
        {frSearch.save.workerWarningBody}
      </Alert>

      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          size="lg"
          loading={isPending}
          loadingLabel={frSearch.save.submitPending}
          disabled={!hasCriteria}
        >
          {savedSearchId === null ? frSearch.save.submitCreate : frSearch.save.submitUpdate}
        </Button>
      </div>

      {!hasCriteria ? (
        <p className="text-caption text-error">{frSearch.save.criteriaEmpty}</p>
      ) : (
        <p className="text-caption text-text-muted">{frSearch.save.criteriaNote}</p>
      )}
    </form>
  );
}
