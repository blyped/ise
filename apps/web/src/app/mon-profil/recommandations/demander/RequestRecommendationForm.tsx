'use client';

import { useActionState, useCallback, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardHeader,
  CardTitle,
  ErrorState,
  Field,
  Input,
  Select,
  Textarea,
} from '@ise/ui-web';
import { recommendationRequestSchema, RECOMMENDATION_RELATIONSHIPS } from '@ise/validation';
import { frProfile } from '@/i18n/profile';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import type { ProfileSkillRow } from '@/lib/queries/profile-sections';
import { toRecommendationRequestInput } from '../../form-input-extras';
import { requestRecommendationAction } from '../../actions-extras';

const t = frProfile.recommendationRequest;

export interface ConnectionChoice {
  profileId: string;
  displayName: string;
  headline: string | null;
  promotionLabel: string | null;
}

export interface RequestRecommendationFormProps {
  connections: readonly ConnectionChoice[];
  skills: readonly ProfileSkillRow[];
  query: string | null;
}

/** ISE-029 — demande contextualisee, adressee a UNE personne. */
export function RequestRecommendationForm({
  connections,
  skills,
  query,
}: RequestRecommendationFormProps) {
  const [state, formAction, isPending] = useActionState(
    requestRecommendationAction,
    initialFormState,
  );
  const { clientErrors, clearField, onSubmit } = useZodForm(
    recommendationRequestSchema,
    toRecommendationRequestInput,
  );
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [messageLength, setMessageLength] = useState(0);

  const errorFor = useCallback(
    (name: string): string | undefined => clientErrors[name] ?? state.fieldErrors[name],
    [clientErrors, state.fieldErrors],
  );

  const hasFieldErrors = Object.keys(state.fieldErrors).length > 0;

  return (
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex flex-col gap-6">
        {/* Recherche dans MES relations : formulaire GET, sans etat cache. */}
        <form method="get" className="flex flex-wrap items-end gap-3" role="search">
          <div className="min-w-[240px] flex-1">
            <Field label={t.searchLabel}>
              {({ id }) => (
                <Input
                  id={id}
                  name="q"
                  type="search"
                  defaultValue={query ?? ''}
                  placeholder={t.searchPlaceholder}
                />
              )}
            </Field>
          </div>
          <Button type="submit" variant="secondary">
            {t.searchAction}
          </Button>
        </form>

        <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
          {state.status === 'error' && state.message && !hasFieldErrors ? (
            <ErrorState
              title={frProfile.common.saveErrorTitle}
              description={state.message}
              correlationId={state.correlationId ?? ''}
            />
          ) : state.status === 'error' && state.message ? (
            <Alert variant="error" title={state.message} />
          ) : null}

          <Card>
            <fieldset>
              <legend className="text-body text-text-primary font-semibold">
                {t.recipientLegend}
              </legend>
              <p className="text-caption text-text-secondary mt-1">{t.recipientHint}</p>
              {errorFor('recipientProfileId') ? (
                <p className="text-caption text-error mt-2" role="alert">
                  {errorFor('recipientProfileId')}
                </p>
              ) : null}

              {connections.length === 0 ? (
                <p className="text-body-sm text-text-secondary mt-4">{t.recipientEmpty}</p>
              ) : (
                <ul className="mt-4 flex flex-col gap-3">
                  {connections.map((connection) => (
                    <li key={connection.profileId}>
                      <label
                        className={
                          recipientId === connection.profileId
                            ? 'border-primary rounded-base flex cursor-pointer items-center gap-4 border-2 bg-[#EFF6FF] px-4 py-3'
                            : 'border-border hover:bg-surface-muted rounded-base flex cursor-pointer items-center gap-4 border px-4 py-3'
                        }
                      >
                        <input
                          type="radio"
                          name="recipientProfileId"
                          value={connection.profileId}
                          checked={recipientId === connection.profileId}
                          onChange={() => {
                            setRecipientId(connection.profileId);
                            clearField('recipientProfileId');
                          }}
                        />
                        <span className="min-w-0">
                          <span className="text-body-sm text-text-primary block font-semibold">
                            {connection.displayName}
                          </span>
                          <span className="text-caption text-text-secondary block">
                            {[connection.promotionLabel, connection.headline]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          </Card>

          <Card>
            <div className="flex flex-col gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t.contextLabel} error={errorFor('context')}>
                  {({ id, describedBy, invalid }) => (
                    <Input
                      id={id}
                      name="context"
                      type="text"
                      placeholder={t.contextPlaceholder}
                      aria-invalid={invalid}
                      {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                      onChange={() => clearField('context')}
                    />
                  )}
                </Field>

                <Field label={t.skillLabel} error={errorFor('skillId')}>
                  {({ id, describedBy, invalid }) => (
                    <Select
                      id={id}
                      name="skillId"
                      defaultValue=""
                      placeholder={t.skillPlaceholder}
                      options={skills.map((skill) => ({
                        value: String(skill.skillId),
                        label: skill.name,
                      }))}
                      aria-invalid={invalid}
                      {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                      onChange={() => clearField('skillId')}
                    />
                  )}
                </Field>
              </div>

              <fieldset>
                <legend className="text-body-sm text-text-primary font-medium">
                  {t.relationshipLegend}
                </legend>
                {errorFor('relationship') ? (
                  <p className="text-caption text-error mt-2" role="alert">
                    {errorFor('relationship')}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-3">
                  {RECOMMENDATION_RELATIONSHIPS.map((value) => (
                    <label
                      key={value}
                      className="border-border rounded-base has-[:checked]:border-primary has-[:checked]:text-primary text-body-sm text-text-secondary flex cursor-pointer items-center gap-2 border px-4 py-2 font-medium has-[:checked]:bg-[#EFF6FF]"
                    >
                      <input
                        type="radio"
                        name="relationship"
                        value={value}
                        className="sr-only"
                        onChange={() => clearField('relationship')}
                      />
                      {t.relationship[value]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <Field
                label={t.messageLabel}
                hint={frProfile.common.counter
                  .replace('{current}', String(messageLength))
                  .replace('{max}', '500')}
                error={errorFor('message')}
                required
              >
                {({ id, describedBy, invalid }) => (
                  <Textarea
                    id={id}
                    name="message"
                    rows={5}
                    required
                    maxLength={500}
                    placeholder={t.messagePlaceholder}
                    aria-invalid={invalid}
                    {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                    onChange={(event) => {
                      setMessageLength(event.currentTarget.value.length);
                      clearField('message');
                    }}
                  />
                )}
              </Field>
            </div>
          </Card>

          <Alert variant="success" title={t.targetedTitle}>
            {t.targetedBody}
          </Alert>

          <div className="flex flex-wrap gap-4">
            <Button type="submit" loading={isPending} loadingLabel={frProfile.common.savePending}>
              {t.submit}
            </Button>
          </div>
        </form>
      </div>

      <aside className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle as="h2">{t.goodRequestTitle}</CardTitle>
          </CardHeader>
          <ul className="flex list-disc flex-col gap-2 pl-5">
            {t.goodRequestItems.map((item) => (
              <li key={item} className="text-body-sm text-text-secondary">
                {item}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h2">{t.afterTitle}</CardTitle>
          </CardHeader>
          <ul className="flex list-disc flex-col gap-2 pl-5">
            {t.afterItems.map((item) => (
              <li key={item} className="text-body-sm text-text-secondary">
                {item}
              </li>
            ))}
          </ul>
          <p className="text-caption text-text-muted mt-3">{t.afterNote}</p>
        </Card>
      </aside>
    </div>
  );
}
