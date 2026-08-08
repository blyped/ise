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
  Select,
  Textarea,
  TokenPicker,
  type TokenOption,
} from '@ise/ui-web';
import { FilterMultiSelect } from '@ise/ui-web/search';
import { frCalls } from '@/i18n/calls';
import { callRoute } from '@/lib/routes/calls';
import { initialFormState } from '@/lib/form-state';
import { HELP_TYPES, type CallDetail } from '@/lib/calls-view';
import type { CountryOption, SectorOption, SkillSearchResult } from '@/lib/queries/reference';
import type { LanguageOption, ToolOption } from '@/lib/queries/tranche-reference';
import { saveWantedProfileAction } from '@/app/appels/actions';
import { searchCallSkillsAction } from '@/app/appels/skills-action';

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
 * ISE-050 — étape 2 : profil recherché et critères.
 *
 * DEUX sélecteurs de compétences plutôt qu'un seul avec des cases
 * « obligatoire » : le marqueur `required` est un FILTRE DUR
 * (CA-MATCH-02, migration 0007). Un profil qui ne déclare pas une
 * compétence obligatoire disparaît du ciblage, quel que soit son
 * parcours. Cacher cette conséquence derrière une case discrète aurait
 * conduit des auteurs à vider leur propre audience sans le savoir.
 */
export function WantedProfileForm({
  call,
  skills,
  sectors,
  countries,
  tools,
  languages,
}: {
  call: CallDetail;
  skills: readonly SkillSearchResult[];
  sectors: readonly SectorOption[];
  countries: readonly CountryOption[];
  tools: readonly ToolOption[];
  languages: readonly LanguageOption[];
}) {
  const [state, formAction, isPending] = useActionState(saveWantedProfileAction, initialFormState);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  // La carte d'appel renvoie des LIBELLES de pays, pas des codes ISO :
  // les pre-cocher supposerait une correspondance inverse fragile. La
  // selection repart donc vide a chaque passage, et l'enregistrement
  // remplace integralement la liste cote base.
  const [experienceCountries, setExperienceCountries] = useState<string[]>([]);

  const options: TokenOption[] = skills.map((skill) => ({
    value: String(skill.skillId),
    label: skill.name,
    group: skill.domainName,
    hint: skill.categoryName,
  }));

  return (
    <form action={formAction} noValidate className="flex flex-col gap-7">
      <input type="hidden" name="callId" value={call.callId} />

      {state.status === 'error' && state.message !== null && state.correlationId === null ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <Field label={frCalls.wizard.wantedProfileLabel} hint={frCalls.common.optional}>
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            name="wantedProfile"
            rows={5}
            maxLength={2000}
            defaultValue={call.wantedProfile ?? ''}
            placeholder={frCalls.wizard.wantedProfilePlaceholder}
            aria-describedby={describedBy}
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-body-sm text-text-primary font-semibold">
          {frCalls.wizard.skillsRequiredLabel}
        </legend>
        <p className="text-caption text-text-muted">{frCalls.wizard.skillsRequiredHint}</p>
        <TokenPicker
          name="requiredSkillIds"
          options={options}
          max={5}
          search={searchCallSkillsAction}
          labels={{ ...PICKER_LABELS, searchLabel: frCalls.wizard.skillsRequiredLabel }}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-body-sm text-text-primary font-semibold">
          {frCalls.wizard.skillsLabel}
        </legend>
        <TokenPicker
          name="preferredSkillIds"
          options={options}
          max={8}
          search={searchCallSkillsAction}
          labels={{ ...PICKER_LABELS, searchLabel: frCalls.wizard.skillsLabel }}
        />
      </fieldset>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label={frCalls.wizard.sectorLabel}>
          {({ id }) => (
            <Select
              id={id}
              name="sectorId"
              defaultValue=""
              placeholder={frCalls.common.optional}
              options={sectors.map((sector) => ({
                value: String(sector.id),
                label: sector.name,
              }))}
            />
          )}
        </Field>

        <Field label={frCalls.wizard.countryLabel}>
          {({ id }) => (
            <Select
              id={id}
              name="countryCode"
              defaultValue=""
              placeholder={frCalls.common.optional}
              options={countries.map((country) => ({
                value: country.code,
                label: country.name,
              }))}
            />
          )}
        </Field>
      </div>

      <Checkbox name="sectorRequired" label={frCalls.wizard.sectorRequiredLabel} />

      <div className="grid gap-5 md:grid-cols-3">
        <Field label={frCalls.wizard.minExperienceLabel}>
          {({ id }) => (
            <Input
              id={id}
              name="minExperienceYears"
              type="number"
              min={0}
              max={60}
              defaultValue={call.minExperienceYears ?? ''}
            />
          )}
        </Field>
        <Field label={frCalls.wizard.promotionFromLabel}>
          {({ id }) => (
            <Input
              id={id}
              name="promotionYearFrom"
              type="number"
              min={1960}
              max={2035}
              defaultValue={call.promotionYearFrom ?? ''}
            />
          )}
        </Field>
        <Field label={frCalls.wizard.promotionToLabel}>
          {({ id }) => (
            <Input
              id={id}
              name="promotionYearTo"
              type="number"
              min={1960}
              max={2035}
              defaultValue={call.promotionYearTo ?? ''}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label={frCalls.wizard.languageLabel}>
          {({ id }) => (
            <Select
              id={id}
              name="languageCode"
              defaultValue=""
              placeholder={frCalls.common.optional}
              options={languages.map((language) => ({
                value: language.code,
                label: language.name,
              }))}
            />
          )}
        </Field>
        <Field label={frCalls.wizard.languageLevelLabel}>
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

      <Checkbox
        name="languageRequired"
        label={`${frCalls.wizard.languageLabel} — ${frCalls.common.required}`}
      />

      <FilterMultiSelect
        name="toolIds"
        legend={frCalls.wizard.toolsLabel}
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
        legend={frCalls.wizard.experienceCountriesLabel}
        options={countries.map((country) => ({ value: country.code, label: country.name }))}
        selected={experienceCountries}
        onChange={setExperienceCountries}
        searchPlaceholder="Rechercher un pays…"
        noMatchLabel="Aucun pays ne correspond."
        showingTemplate="{shown} pays sur {total}"
        selectedLegend="Pays retenus"
        removeLabel="Retirer"
      />

      <OptionCardGroup
        type="checkbox"
        name="helpTypes"
        legend={frCalls.wizard.helpTypesLegend}
        hint={frCalls.wizard.helpTypesHint}
        columns={2}
        defaultValues={call.helpTypes}
        items={HELP_TYPES.map((helpType) => ({
          value: helpType,
          label: frCalls.helpType[helpType] ?? helpType,
        }))}
      />

      {state.status === 'error' && state.correlationId !== null ? (
        <ErrorState
          title={frCalls.common.loadErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={`${callRoute(call.callId)}/besoin`}
          className="rounded-base bg-surface text-body-sm text-text-primary hover:border-primary focus-visible:outline-active-blue inline-flex min-h-[44px] items-center border border-[#CBD5E1] px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {frCalls.common.back}
        </Link>
        <Button type="submit" loading={isPending} loadingLabel={frCalls.common.savePending}>
          {frCalls.common.save}
        </Button>
      </div>
    </form>
  );
}
