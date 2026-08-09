'use client';

import { useActionState, useMemo, useState } from 'react';
import { Alert, Button, Card, CardHeader, CardTitle, ErrorState, Select } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { initialFormState } from '@/lib/form-state';
import type { CountryOption } from '@/lib/queries/reference';
import type {
  LanguageOption,
  LanguageProficiencyLevel,
  ProfileGeographyRow,
  ProfileLanguageRow,
  ProfileToolRow,
  ToolOption,
  ToolProficiencyLevel,
} from '@/lib/queries/profile-extras';
import { saveLanguagesZonesAction } from '../actions-extras';

const t = frProfile.languagesZones;

const LANGUAGE_LEVELS: readonly LanguageProficiencyLevel[] = [
  'basic',
  'intermediate',
  'professional',
  'fluent',
  'native',
];

const TOOL_LEVELS: readonly ToolProficiencyLevel[] = [
  'notion',
  'intermediate',
  'advanced',
  'expert',
];

const REMOVE_BUTTON =
  'text-text-muted hover:text-text-primary focus-visible:outline-active-blue rounded-sm px-2 py-1 text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2';

export interface LanguagesZonesFormProps {
  languageOptions: readonly LanguageOption[];
  countryOptions: readonly CountryOption[];
  toolOptions: readonly ToolOption[];
  initialLanguages: readonly ProfileLanguageRow[];
  initialGeographies: readonly ProfileGeographyRow[];
  initialTools: readonly ProfileToolRow[];
}

/**
 * ISE-027 — un seul formulaire pour les trois listes. Les entrees sont
 * postees en champs caches `code:valeur`, decodes par
 * `form-input-extras.ts` cote client ET serveur (MASTER PROMPT §62).
 */
export function LanguagesZonesForm({
  languageOptions,
  countryOptions,
  toolOptions,
  initialLanguages,
  initialGeographies,
  initialTools,
}: LanguagesZonesFormProps) {
  const [state, formAction, isPending] = useActionState(saveLanguagesZonesAction, initialFormState);

  const [languages, setLanguages] = useState(
    initialLanguages.map((row) => ({ code: row.languageCode, proficiency: row.proficiency })),
  );
  const [countries, setCountries] = useState(initialGeographies.map((row) => row.countryCode));
  const [tools, setTools] = useState(
    initialTools.map((row) => ({ id: row.toolId, proficiency: row.proficiency })),
  );

  const languageNames = useMemo(
    () => new Map(languageOptions.map((option) => [option.code, option.name])),
    [languageOptions],
  );
  const countryNames = useMemo(
    () => new Map(countryOptions.map((option) => [option.code, option.name])),
    [countryOptions],
  );
  const toolNames = useMemo(
    () => new Map(toolOptions.map((option) => [option.id, option.name])),
    [toolOptions],
  );

  const remainingLanguages = languageOptions.filter(
    (option) => !languages.some((entry) => entry.code === option.code),
  );
  const remainingCountries = countryOptions.filter((option) => !countries.includes(option.code));
  const remainingTools = toolOptions.filter(
    (option) => !tools.some((entry) => entry.id === option.id),
  );

  return (
    <form action={formAction} className="flex flex-col gap-7">
      {state.status === 'error' && state.message ? (
        <ErrorState
          title={frProfile.common.saveErrorTitle}
          description={state.message}
          correlationId={state.correlationId ?? ''}
        />
      ) : null}
      {state.status === 'success' && state.message ? (
        <Alert variant="success" title={state.message} />
      ) : null}

      <div className="grid items-start gap-7 lg:grid-cols-2">
        {/* ---------------- Langues ---------------- */}
        <Card>
          <CardHeader>
            <CardTitle as="h2">{t.languagesTitle}</CardTitle>
            <p className="text-caption text-text-secondary">{t.languagesHint}</p>
          </CardHeader>

          <ul className="flex flex-col gap-3">
            {languages.map((entry) => (
              <li
                key={entry.code}
                className="border-border rounded-base flex flex-wrap items-center justify-between gap-3 border px-4 py-3"
              >
                <span className="text-body-sm text-text-primary min-w-0 font-medium">
                  {languageNames.get(entry.code) ?? entry.code}
                </span>
                <span className="flex items-center gap-3">
                  <label className="sr-only" htmlFor={`niveau-langue-${entry.code}`}>
                    {t.proficiencyLabel} — {languageNames.get(entry.code) ?? entry.code}
                  </label>
                  <Select
                    id={`niveau-langue-${entry.code}`}
                    className="h-[38px] w-[210px]"
                    value={entry.proficiency}
                    onChange={(event) => {
                      const proficiency = event.target.value as LanguageProficiencyLevel;
                      setLanguages((current) =>
                        current.map((item) =>
                          item.code === entry.code ? { ...item, proficiency } : item,
                        ),
                      );
                    }}
                    options={LANGUAGE_LEVELS.map((level) => ({
                      value: level,
                      label: t.proficiency[level],
                    }))}
                  />
                  <button
                    type="button"
                    className={REMOVE_BUTTON}
                    onClick={() =>
                      setLanguages((current) => current.filter((item) => item.code !== entry.code))
                    }
                  >
                    ×
                    <span className="sr-only">
                      {' '}
                      {t.removeLabel} — {languageNames.get(entry.code) ?? entry.code}
                    </span>
                  </button>
                </span>
                <input
                  type="hidden"
                  name="languageEntries"
                  value={`${entry.code}:${entry.proficiency}`}
                />
              </li>
            ))}
          </ul>

          {remainingLanguages.length > 0 ? (
            <div className="mt-4">
              <label className="sr-only" htmlFor="ajout-langue">
                {t.addLanguagePlaceholder}
              </label>
              <Select
                id="ajout-langue"
                value=""
                onChange={(event) => {
                  const code = event.target.value;
                  if (code.length > 0) {
                    setLanguages((current) => [
                      ...current,
                      { code, proficiency: 'professional' as LanguageProficiencyLevel },
                    ]);
                  }
                }}
                options={[
                  { value: '', label: `+ ${t.addLanguagePlaceholder}` },
                  ...remainingLanguages.map((option) => ({
                    value: option.code,
                    label: option.name,
                  })),
                ]}
              />
            </div>
          ) : null}

          <p className="text-caption text-text-muted mt-4">
            {t.languagesCount.replace('{count}', String(languages.length))}
          </p>
        </Card>

        {/* ---------------- Zones ---------------- */}
        <Card>
          <CardHeader>
            <CardTitle as="h2">{t.zonesTitle}</CardTitle>
            <p className="text-caption text-text-secondary">{t.zonesHint}</p>
          </CardHeader>

          <ul className="flex flex-col gap-3">
            {countries.map((code) => (
              <li
                key={code}
                className="border-border rounded-base flex items-center justify-between gap-3 border px-4 py-3"
              >
                <span className="text-body-sm text-text-primary min-w-0 font-medium">
                  {countryNames.get(code) ?? code}
                </span>
                <button
                  type="button"
                  className={REMOVE_BUTTON}
                  onClick={() => setCountries((current) => current.filter((item) => item !== code))}
                >
                  ×
                  <span className="sr-only">
                    {' '}
                    {t.removeLabel} — {countryNames.get(code) ?? code}
                  </span>
                </button>
                <input type="hidden" name="countryCodes" value={code} />
              </li>
            ))}
          </ul>

          {remainingCountries.length > 0 ? (
            <div className="mt-4">
              <label className="sr-only" htmlFor="ajout-zone">
                {t.addZonePlaceholder}
              </label>
              <Select
                id="ajout-zone"
                value=""
                onChange={(event) => {
                  const code = event.target.value;
                  if (code.length > 0) setCountries((current) => [...current, code]);
                }}
                options={[
                  { value: '', label: `+ ${t.addZonePlaceholder}` },
                  ...remainingCountries.map((option) => ({
                    value: option.code,
                    label: option.name,
                  })),
                ]}
              />
            </div>
          ) : null}

          <p className="text-caption text-text-muted mt-4">
            {t.zonesCount.replace('{count}', String(countries.length))}
          </p>
        </Card>
      </div>

      {/* ---------------- Outils ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">{t.toolsTitle}</CardTitle>
          <p className="text-caption text-text-secondary">{t.toolsHint}</p>
        </CardHeader>

        <ul className="grid gap-3 sm:grid-cols-2">
          {tools.map((entry) => (
            <li
              key={entry.id}
              className="border-border rounded-base flex flex-wrap items-center justify-between gap-3 border px-4 py-3"
            >
              <span className="text-body-sm text-text-primary min-w-0 font-medium">
                {toolNames.get(entry.id) ?? entry.id}
              </span>
              <span className="flex items-center gap-3">
                <label className="sr-only" htmlFor={`niveau-outil-${entry.id}`}>
                  {t.proficiencyLabel} — {toolNames.get(entry.id) ?? entry.id}
                </label>
                <Select
                  id={`niveau-outil-${entry.id}`}
                  className="h-[38px] w-[170px]"
                  value={entry.proficiency ?? ''}
                  onChange={(event) => {
                    const proficiency =
                      event.target.value === ''
                        ? null
                        : (event.target.value as ToolProficiencyLevel);
                    setTools((current) =>
                      current.map((item) =>
                        item.id === entry.id ? { ...item, proficiency } : item,
                      ),
                    );
                  }}
                  options={[
                    { value: '', label: t.toolLevel.none },
                    ...TOOL_LEVELS.map((level) => ({
                      value: level,
                      label: t.toolLevel[level],
                    })),
                  ]}
                />
                <button
                  type="button"
                  className={REMOVE_BUTTON}
                  onClick={() =>
                    setTools((current) => current.filter((item) => item.id !== entry.id))
                  }
                >
                  ×
                  <span className="sr-only">
                    {' '}
                    {t.removeLabel} — {toolNames.get(entry.id) ?? entry.id}
                  </span>
                </button>
              </span>
              <input
                type="hidden"
                name="toolEntries"
                value={`${entry.id}:${entry.proficiency ?? ''}`}
              />
            </li>
          ))}
        </ul>

        {remainingTools.length > 0 ? (
          <div className="mt-4 max-w-[420px]">
            <label className="sr-only" htmlFor="ajout-outil">
              {t.addToolPlaceholder}
            </label>
            <Select
              id="ajout-outil"
              value=""
              onChange={(event) => {
                const id = Number(event.target.value);
                if (Number.isFinite(id) && id > 0) {
                  setTools((current) => [...current, { id, proficiency: null }]);
                }
              }}
              options={[
                { value: '', label: `+ ${t.addToolPlaceholder}` },
                ...remainingTools.map((option) => ({
                  value: String(option.id),
                  label: option.category ? `${option.name} — ${option.category}` : option.name,
                })),
              ]}
            />
          </div>
        ) : null}

        <p className="text-caption text-text-muted mt-4">
          {t.toolsCount.replace('{count}', String(tools.length))}
        </p>
      </Card>

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Alert variant="warning" title={t.realityTitle}>
          {t.realityBody}
        </Alert>
        <Card>
          <CardHeader>
            <CardTitle as="h2">{t.usefulTitle}</CardTitle>
          </CardHeader>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {t.usefulItems.map((item) => (
              <li key={item} className="text-body-sm text-text-secondary">
                {item}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div>
        <Button type="submit" loading={isPending} loadingLabel={frProfile.common.savePending}>
          {frProfile.common.save}
        </Button>
      </div>
    </form>
  );
}
