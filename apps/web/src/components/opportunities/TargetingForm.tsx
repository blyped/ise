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
  Radio,
  RadioGroup,
  Select,
  TokenPicker,
  type TokenOption,
} from '@ise/ui-web';
import { FilterMultiSelect } from '@ise/ui-web/search';
import { frOpportunities } from '@/i18n/opportunities';
import { opportunityRoute } from '@/lib/routes/opportunities';
import { initialFormState } from '@/lib/form-state';
import { VISIBILITY_LEVELS } from '@/lib/calls-view';
import type { OpportunityDetail } from '@/lib/opportunities-view';
import type {
  CountryOption,
  JobFunctionOption,
  PromotionOption,
  SectorOption,
  SkillSearchResult,
} from '@/lib/queries/reference';
import type { LanguageOption, ToolOption } from '@/lib/queries/tranche-reference';
import { saveTargetingAction } from '@/app/opportunites/actions';
import { searchOpportunitySkillsAction } from '@/app/opportunites/skills-action';

const PROFICIENCIES = [
  { value: 'basic', label: 'Notions' },
  { value: 'intermediate', label: 'Intermédiaire' },
  { value: 'professional', label: 'Professionnel' },
  { value: 'fluent', label: 'Courant' },
  { value: 'native', label: 'Langue maternelle' },
];

const PICKER_LABELS = {
  searchPlaceholder: 'Rechercher une compétence…',
  selectedLabel: 'Sélection',
  counter: '{count} sur {max}',
  limitReached: 'Limite atteinte.',
  browseLabel: 'Parcourir le référentiel',
  resultsLabel: 'Résultats',
  add: 'Ajouter',
  remove: 'Retirer',
  emptyTitle: 'Aucune compétence trouvée.',
  emptyBody: 'Essayez un autre terme : le référentiel gère les synonymes.',
  loading: 'Chargement en cours…',
  noSelection: 'Aucune compétence sélectionnée.',
};

/**
 * ISE-058 — étape 2 : ciblage et matching.
 *
 * Les compétences obligatoires sont séparées des compétences souhaitées
 * pour la même raison qu'en ISE-050 : `required` est un FILTRE DUR
 * (CA-MATCH-02). Le rail rappelle qu'un critère obligatoire retire des
 * profils du ciblage — il ne les classe pas plus bas.
 *
 * Les questions complémentaires sont limitées à trois (D7 §57) ; la base
 * tronque de toute façon au plafond de l'offre.
 */
export function TargetingForm({
  opportunity,
  skills,
  sectors,
  countries,
  tools,
  languages,
  functions,
  promotions,
}: {
  opportunity: OpportunityDetail;
  skills: readonly SkillSearchResult[];
  sectors: readonly SectorOption[];
  countries: readonly CountryOption[];
  tools: readonly ToolOption[];
  languages: readonly LanguageOption[];
  functions: readonly JobFunctionOption[];
  promotions: readonly PromotionOption[];
}) {
  const [state, formAction, isPending] = useActionState(saveTargetingAction, initialFormState);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [experienceCountries, setExperienceCountries] = useState<string[]>([]);
  const [selectedPromotions, setSelectedPromotions] = useState<string[]>([]);

  const options: TokenOption[] = skills.map((skill) => ({
    value: String(skill.skillId),
    label: skill.name,
    group: skill.domainName,
    hint: skill.categoryName,
  }));

  return (
    <form action={formAction} noValidate className="flex flex-col gap-7">
      <input type="hidden" name="opportunityId" value={opportunity.opportunityId} />

      {state.status === 'error' && state.message !== null && state.correlationId === null ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-body-sm text-text-primary font-semibold">
          {frOpportunities.wizard.skillsRequiredLabel}
        </legend>
        <TokenPicker
          name="requiredSkillIds"
          options={options}
          max={5}
          search={searchOpportunitySkillsAction}
          labels={{ ...PICKER_LABELS, searchLabel: frOpportunities.wizard.skillsRequiredLabel }}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-body-sm text-text-primary font-semibold">
          {frOpportunities.wizard.skillsLabel}
        </legend>
        <TokenPicker
          name="preferredSkillIds"
          options={options}
          max={8}
          search={searchOpportunitySkillsAction}
          labels={{ ...PICKER_LABELS, searchLabel: frOpportunities.wizard.skillsLabel }}
        />
      </fieldset>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label={frOpportunities.wizard.sectorLabel}>
          {({ id }) => (
            <Select
              id={id}
              name="sectorId"
              defaultValue=""
              placeholder={frOpportunities.common.optional}
              options={sectors.map((sector) => ({ value: String(sector.id), label: sector.name }))}
            />
          )}
        </Field>

        <Field label={frOpportunities.wizard.functionLabel}>
          {({ id }) => (
            <Select
              id={id}
              name="jobFunctionId"
              defaultValue=""
              placeholder={frOpportunities.common.optional}
              options={functions.map((fn) => ({ value: String(fn.id), label: fn.name }))}
            />
          )}
        </Field>

        <Field label={frOpportunities.wizard.levelLabel}>
          {({ id }) => (
            <Select
              id={id}
              name="experienceLevel"
              defaultValue={opportunity.experienceLevel ?? ''}
              placeholder={frOpportunities.common.optional}
              options={(['junior', 'intermediate', 'senior', 'executive'] as const).map(
                (value) => ({
                  value,
                  label: frOpportunities.experienceLevel[value] ?? value,
                }),
              )}
            />
          )}
        </Field>

        <Field label={frOpportunities.wizard.minExperienceLabel}>
          {({ id }) => (
            <Input
              id={id}
              name="minExperienceYears"
              type="number"
              min={0}
              max={60}
              defaultValue={opportunity.minExperienceYears ?? ''}
            />
          )}
        </Field>

        <Field label={frOpportunities.wizard.idealExperienceLabel}>
          {({ id }) => <Input id={id} name="idealExperienceYears" type="number" min={0} max={60} />}
        </Field>

        <Field label={frOpportunities.wizard.languageLabel}>
          {({ id }) => (
            <Select
              id={id}
              name="languageCode"
              defaultValue=""
              placeholder={frOpportunities.common.optional}
              options={languages.map((language) => ({
                value: language.code,
                label: language.name,
              }))}
            />
          )}
        </Field>

        <Field label={frOpportunities.wizard.languageLevelLabel}>
          {({ id }) => (
            <Select
              id={id}
              name="languageLevel"
              defaultValue="professional"
              options={PROFICIENCIES}
            />
          )}
        </Field>
      </div>

      <Checkbox name="sectorRequired" label={frOpportunities.wizard.sectorRequiredLabel} />
      <Checkbox
        name="languageRequired"
        label={`${frOpportunities.wizard.languageLabel} — ${frOpportunities.common.required}`}
      />

      <FilterMultiSelect
        name="toolIds"
        legend={frOpportunities.wizard.toolsLabel}
        options={tools.map((tool) => ({ value: String(tool.id), label: tool.name }))}
        selected={selectedTools}
        onChange={setSelectedTools}
        searchPlaceholder="Rechercher un outil…"
        noMatchLabel="Aucun outil ne correspond."
        showingTemplate="{shown} outils sur {total}"
        selectedLegend="Outils retenus"
        removeLabel="Retirer"
      />

      <FilterMultiSelect
        name="experienceCountries"
        legend={frOpportunities.wizard.experienceCountriesLabel}
        options={countries.map((country) => ({ value: country.code, label: country.name }))}
        selected={experienceCountries}
        onChange={setExperienceCountries}
        searchPlaceholder="Rechercher un pays…"
        noMatchLabel="Aucun pays ne correspond."
        showingTemplate="{shown} pays sur {total}"
        selectedLegend="Pays retenus"
        removeLabel="Retirer"
      />

      <FilterMultiSelect
        name="audiencePromotionIds"
        legend={frOpportunities.wizard.audiencePromotionsLabel}
        options={promotions.map((promotion) => ({
          value: String(promotion.id),
          label: `${promotion.programCode} ${promotion.graduationYear}`,
        }))}
        selected={selectedPromotions}
        onChange={setSelectedPromotions}
        searchPlaceholder="Rechercher une promotion…"
        noMatchLabel="Aucune promotion ne correspond."
        showingTemplate="{shown} promotions sur {total}"
        selectedLegend="Promotions ciblées"
        removeLabel="Retirer"
      />

      <RadioGroup legend={frOpportunities.wizard.visibilityLegend}>
        {VISIBILITY_LEVELS.map((level) => (
          <Radio
            key={level}
            name="visibility"
            value={level}
            defaultChecked={opportunity.visibility === level}
            label={frOpportunities.visibility[level] ?? level}
          />
        ))}
      </RadioGroup>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-body-sm text-text-primary font-semibold">
          {frOpportunities.wizard.questionsLabel}
        </legend>
        <p className="text-caption text-text-muted">{frOpportunities.wizard.questionsHint}</p>
        {[0, 1, 2].map((index) => (
          <Field key={index} label={`${frOpportunities.wizard.questionsLabel} ${index + 1}`}>
            {({ id }) => (
              <Input
                id={id}
                name="questions"
                maxLength={300}
                defaultValue={opportunity.questions[index]?.question ?? ''}
              />
            )}
          </Field>
        ))}
      </fieldset>

      {state.status === 'error' && state.correlationId !== null ? (
        <ErrorState
          title={frOpportunities.common.loadErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={`${opportunityRoute(opportunity.opportunityId)}/offre`}
          className="rounded-base bg-surface text-body-sm text-text-primary hover:border-primary focus-visible:outline-active-blue inline-flex min-h-[44px] items-center border border-[#CBD5E1] px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {frOpportunities.common.back}
        </Link>
        <Button type="submit" loading={isPending} loadingLabel={frOpportunities.common.savePending}>
          {frOpportunities.common.save}
        </Button>
      </div>
    </form>
  );
}
