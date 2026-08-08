'use client';

import { useActionState, useCallback } from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
  Card,
  CardHeader,
  CardTitle,
  Checkbox,
  ErrorState,
  Field,
  Input,
  OptionCardGroup,
  Textarea,
  TokenPicker,
  type TokenOption,
} from '@ise/ui-web';
import { profileSkillSchema } from '@ise/validation';
import { frProfile } from '@/i18n/profile';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import type { ProfileSkillRow } from '@/lib/queries/profile-sections';
import type { SkillSearchResult } from '@/lib/queries/reference';
import { searchSkillsAction } from '@/app/bienvenue/actions';
import { toProfileSkillInput } from '../form-input';
import { saveProfileSkillAction } from '../actions';

const LINK_CLASS =
  'inline-flex min-h-[44px] items-center text-body-sm font-medium text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

export interface ProfileSkillFormProps {
  /** `null` en creation : le membre choisit d'abord la competence. */
  skill: ProfileSkillRow | null;
  referential: readonly SkillSearchResult[];
  /** Nombre d'experiences dont l'intitule ou la description cite la competence. */
  evidenceCount: number;
}

const LEVEL_ITEMS = [
  { value: 'notion', label: frProfile.skillForm.level.notion },
  { value: 'intermediate', label: frProfile.skillForm.level.intermediate },
  { value: 'advanced', label: frProfile.skillForm.level.advanced },
  { value: 'expert', label: frProfile.skillForm.level.expert },
];

/**
 * ISE-023 — Gerer une competence.
 *
 * ECART ASSUME : la maquette montre « Derniere pratique » et un decompte
 * de projets et de recommandations. Aucune colonne ne porte la derniere
 * pratique, et les projets/recommandations ne sont pas encore relies a
 * une competence : ces champs auraient affiche des valeurs inventees. Le
 * seul decompte rendu est celui des experiences, calcule sur des donnees
 * reelles, et son mode de calcul est ecrit a l'ecran.
 */
export function ProfileSkillForm({ skill, referential, evidenceCount }: ProfileSkillFormProps) {
  const [state, formAction, isPending] = useActionState(saveProfileSkillAction, initialFormState);
  const { clientErrors, clearField, onSubmit } = useZodForm(
    profileSkillSchema,
    toProfileSkillInput,
  );

  const errorFor = useCallback(
    (name: string): string | undefined => clientErrors[name] ?? state.fieldErrors[name],
    [clientErrors, state.fieldErrors],
  );

  const hasFieldErrors = Object.keys(state.fieldErrors).length > 0;
  const saveFailed = state.status === 'error' && !hasFieldErrors && state.correlationId !== null;

  const options: TokenOption[] = referential.map((entry) => ({
    value: String(entry.skillId),
    label: entry.name,
    group: entry.domainName,
    hint: entry.categoryName,
  }));

  return (
    <form
      id="formulaire-profil-competence"
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-6"
    >
      {state.status === 'error' && hasFieldErrors && state.message ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      {skill ? (
        <>
          <input type="hidden" name="skillId" value={skill.skillId} />
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frProfile.skillForm.skillLabel}</CardTitle>
            </CardHeader>
            <p className="text-h4 text-text-primary font-semibold">{skill.name}</p>
            <p className="text-caption text-text-secondary mt-1">
              {[skill.domainName, skill.categoryName].filter(Boolean).join(' · ')}
            </p>
          </Card>
        </>
      ) : (
        <TokenPicker
          name="skillId"
          options={options}
          max={1}
          search={searchSkillsAction}
          error={errorFor('skillId')}
          labels={{
            searchLabel: frProfile.skillForm.searchLabel,
            searchPlaceholder: frProfile.skillForm.searchPlaceholder,
            selectedLabel: frProfile.skillForm.skillLabel,
            counter: '{count} / {max}',
            limitReached: 'Retirez la compétence sélectionnée pour en choisir une autre.',
            browseLabel: 'Le référentiel, par domaine',
            resultsLabel: 'Résultats',
            add: 'Ajouter',
            remove: 'Retirer',
            emptyTitle: 'Aucune compétence ne correspond à cette recherche.',
            emptyBody: 'Essayez un terme plus court, ou parcourez le référentiel par domaine.',
            loading: 'Chargement en cours…',
            noSelection: 'Aucune compétence sélectionnée.',
          }}
        />
      )}

      <OptionCardGroup
        type="radio"
        name="level"
        columns={2}
        legend={frProfile.skillForm.levelLegend}
        hint={frProfile.skillForm.levelHint}
        items={LEVEL_ITEMS}
        defaultValues={skill?.level ? [skill.level] : []}
        error={errorFor('level')}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={frProfile.skillForm.yearsLabel} error={errorFor('yearsExperience')}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="yearsExperience"
              type="number"
              inputMode="numeric"
              min={0}
              max={60}
              step={1}
              defaultValue={skill?.yearsExperience ?? ''}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('yearsExperience')}
            />
          )}
        </Field>

        <div className="flex items-end">
          <Checkbox
            name="isPrimary"
            value="on"
            label={frProfile.skillForm.primaryLabel}
            description={frProfile.skillForm.primaryHint}
            defaultChecked={skill?.isPrimary ?? false}
          />
        </div>
      </div>

      <Field label={frProfile.skillForm.contextLabel} error={errorFor('context')}>
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="context"
            rows={5}
            maxLength={500}
            defaultValue={skill?.context ?? ''}
            placeholder={frProfile.skillForm.contextPlaceholder}
            aria-invalid={invalid}
            {...(describedBy ? { 'aria-describedby': describedBy } : {})}
            onChange={() => clearField('context')}
          />
        )}
      </Field>

      <Alert variant="warning" title={frProfile.skillForm.declarativeTitle}>
        {frProfile.skillForm.declarativeBody}
      </Alert>

      {skill ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">{frProfile.skillForm.evidenceTitle}</CardTitle>
          </CardHeader>
          <p className="text-body-sm text-text-primary">
            {frProfile.skillForm.evidenceExperiences} :{' '}
            {frProfile.skillForm.evidenceLinked.replace('{count}', String(evidenceCount))}
          </p>
          <p className="text-caption text-text-muted mt-2">{frProfile.skillForm.evidenceNote}</p>
        </Card>
      ) : null}

      {saveFailed && state.correlationId !== null ? (
        <ErrorState
          title={frProfile.common.saveErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      <div className="border-border flex flex-wrap items-center gap-5 border-t pt-6">
        <Button
          type="submit"
          size="lg"
          loading={isPending}
          loadingLabel={frProfile.common.savePending}
        >
          {frProfile.common.save}
        </Button>
        <Link href={PROFILE_ROUTES.skills} className={LINK_CLASS}>
          {frProfile.common.cancel}
        </Link>
      </div>
    </form>
  );
}
