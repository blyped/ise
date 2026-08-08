'use client';

import { useActionState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardHeader,
  CardTitle,
  ErrorState,
  VisibilitySelect,
  type VisibilityLevelValue,
} from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { initialFormState } from '@/lib/form-state';
import type { VisibilityFieldRule } from '@/lib/queries/reference';
import { saveSkillsVisibilityAction } from '../actions';

/**
 * ISE-022 — visibilite du bloc « competences » (D-73).
 * Le choix est enregistre dans `profile_visibility` et applique par la
 * base : ce n'est pas un reglage d'affichage.
 */
export function SkillsVisibilityForm({
  rule,
  defaultValue,
}: {
  rule: VisibilityFieldRule;
  defaultValue: VisibilityLevelValue;
}) {
  const [state, formAction, isPending] = useActionState(
    saveSkillsVisibilityAction,
    initialFormState,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{frProfile.skills.visibilityTitle}</CardTitle>
      </CardHeader>

      <form action={formAction} className="flex flex-col gap-5">
        {state.status === 'success' && state.message ? (
          <Alert variant="success" title={state.message} />
        ) : null}

        <VisibilitySelect
          name="visibility.skills"
          label={rule.label}
          hint={frProfile.common.visibilityHint}
          labels={frProfile.visibility}
          allowedLevels={rule.allowedLevels}
          defaultValue={defaultValue}
        />

        {state.status === 'error' && state.correlationId !== null ? (
          <ErrorState
            title={frProfile.common.saveErrorTitle}
            correlationId={state.correlationId}
            {...(state.message ? { description: state.message } : {})}
          />
        ) : null}

        <div>
          <Button type="submit" loading={isPending} loadingLabel={frProfile.common.savePending}>
            {frProfile.common.save}
          </Button>
        </div>
      </form>
    </Card>
  );
}
