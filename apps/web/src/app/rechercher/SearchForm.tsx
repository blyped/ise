'use client';

import { useCallback, useMemo, useState } from 'react';
import { Alert, Button, Card, Field, Input, Select } from '@ise/ui-web';
import { FilterMultiSelect } from '@ise/ui-web/search';
import { frSearch } from '@/i18n/search';
import { SEARCH_ROUTES } from '@/lib/routes/search';
import {
  PARAM,
  parseCriteria,
  rawCriteriaFromFormData,
  type SearchCriteria,
} from '@/lib/search-criteria';
import type { SearchReferentials } from '@/lib/queries/search';

/**
 * ISE-034 — formulaire « Trouver un ISE ».
 *
 * Le formulaire est un `<form method="get">` qui NAVIGUE vers ISE-035 :
 * les criteres vivent dans l'URL, la page de resultats est rendue par le
 * serveur, et aucun annuaire n'est charge cote navigateur
 * (MASTER PROMPT §21). Sans JavaScript, la soumission fonctionne aussi.
 *
 * Le MEME `searchCriteriaSchema` est applique ici a la soumission et de
 * nouveau cote serveur : le client donne un retour immediat, le serveur
 * reste seul juge (MASTER PROMPT §62).
 *
 * Toutes les listes proviennent de `props.referentials`, lu en base.
 * Aucune valeur n'est ecrite en dur : si un referentiel est vide, le
 * critere correspondant disparait au lieu d'etre propose sans contenu.
 */
export function SearchForm({
  referentials,
  initial,
}: {
  referentials: SearchReferentials;
  initial: SearchCriteria;
}) {
  const [query, setQuery] = useState(initial.query ?? '');
  const [skills, setSkills] = useState<string[]>(initial.skillIds.map(String));
  const [sectors, setSectors] = useState<string[]>(initial.sectorIds.map(String));
  const [functions, setFunctions] = useState<string[]>(initial.jobFunctionIds.map(String));
  const [countries, setCountries] = useState<string[]>([...initial.countryCodes]);
  const [subregions, setSubregions] = useState<string[]>([...initial.subregionCodes]);
  const [promotions, setPromotions] = useState<string[]>(initial.promotionIds.map(String));
  const [languages, setLanguages] = useState<string[]>([...initial.languageCodes]);
  const [availability, setAvailability] = useState<string[]>([...initial.availabilityTypes]);
  const [experience, setExperience] = useState(
    typeof initial.minYearsOfExperience === 'number' ? String(initial.minYearsOfExperience) : '',
  );

  const [error, setError] = useState<string | null>(null);

  const selectionCount =
    skills.length +
    sectors.length +
    functions.length +
    countries.length +
    subregions.length +
    promotions.length +
    languages.length +
    availability.length +
    (experience === '' ? 0 : 1);

  const somethingToSearch = query.trim().length > 0 || selectionCount > 0;

  const reset = useCallback(() => {
    setQuery('');
    setSkills([]);
    setSectors([]);
    setFunctions([]);
    setCountries([]);
    setSubregions([]);
    setPromotions([]);
    setLanguages([]);
    setAvailability([]);
    setExperience('');
    setError(null);
  }, []);

  /**
   * Validation client par le schema partage. En cas d'echec l'envoi est
   * annule : inutile d'aller chercher au serveur une reponse qu'on sait
   * deja invalide — sans rien retirer a sa propre validation.
   */
  const onSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    const formData = new FormData(event.currentTarget);
    const parsed = parseCriteria(rawCriteriaFromFormData(formData));

    if (!parsed.ok) {
      event.preventDefault();
      setError(frSearch.find.validationFailed);
      return;
    }
    if (
      (parsed.criteria.query ?? '').length === 0 &&
      parsed.criteria.skillIds.length === 0 &&
      parsed.criteria.sectorIds.length === 0 &&
      parsed.criteria.jobFunctionIds.length === 0 &&
      parsed.criteria.countryCodes.length === 0 &&
      parsed.criteria.subregionCodes.length === 0 &&
      parsed.criteria.promotionIds.length === 0 &&
      parsed.criteria.languageCodes.length === 0 &&
      parsed.criteria.availabilityTypes.length === 0 &&
      typeof parsed.criteria.minYearsOfExperience !== 'number'
    ) {
      event.preventDefault();
      setError(frSearch.find.noCriteria);
      return;
    }
    setError(null);
  }, []);

  const experienceOptions = useMemo(
    () =>
      [1, 3, 5, 10, 15, 20].map((years) => ({
        value: String(years),
        label: `${years} ans et plus`,
      })),
    [],
  );

  const multi = {
    searchPlaceholder: frSearch.find.filterSearchPlaceholder,
    noMatchLabel: frSearch.find.filterNoMatch,
    showingTemplate: frSearch.find.filterShowing,
    selectedLegend: frSearch.find.filterSelectedLegend,
    removeLabel: frSearch.common.remove,
  } as const;

  return (
    <form method="get" action={SEARCH_ROUTES.results} onSubmit={onSubmit} noValidate>
      {error !== null ? (
        <div className="mb-6" role="alert">
          <Alert variant="error" title={error} />
        </div>
      ) : null}

      {/* ---- Texte libre : premier bloc a 375 comme a 1440 ---- */}
      <Card>
        <h2 className="text-h4 text-text-primary font-semibold">{frSearch.find.queryLegend}</h2>
        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <Field label={frSearch.find.queryLabel} hint={frSearch.find.queryHint}>
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  name={PARAM.query}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={frSearch.find.queryPlaceholder}
                  maxLength={200}
                  autoComplete="off"
                  {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                />
              )}
            </Field>
          </div>
          <Button type="submit" size="lg" className="max-lg:w-full">
            {frSearch.find.submit}
          </Button>
        </div>
      </Card>

      {/* ---- Criteres structures ----
          A 375 px le bloc est REPLIE : la recherche par texte suffit dans
          la grande majorite des cas et l'ecran resterait sinon un mur de
          listes. A partir de 1024 px il est deplie et dispose en deux
          colonnes : la comparaison entre dimensions devient possible d'un
          coup d'oeil (MASTER PROMPT §57). */}
      <details className="group mt-7" open>
        <summary className="rounded-base border-border bg-surface text-body text-text-primary focus-visible:outline-active-blue flex min-h-[44px] cursor-pointer list-none items-center justify-between border px-5 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 lg:hidden">
          <span>{frSearch.find.criteriaLegend}</span>
          <span className="text-body-sm text-text-muted font-normal">
            {selectionCount > 0
              ? frSearch.find[selectionCount > 1 ? 'filterCountPlural' : 'filterCount'].replace(
                  '{count}',
                  String(selectionCount),
                )
              : ''}
          </span>
        </summary>

        <div className="rounded-base border-border bg-surface mt-5 border p-6 max-md:p-5">
          <h2 className="text-h4 text-text-primary font-semibold max-lg:sr-only">
            {frSearch.find.criteriaLegend}
          </h2>
          <p className="text-body-sm text-text-secondary mt-2">{frSearch.find.criteriaHint}</p>

          <div className="mt-6 grid gap-7 lg:grid-cols-2">
            <FilterMultiSelect
              {...multi}
              name={PARAM.skills}
              legend={frSearch.find.skillsLabel}
              options={referentials.skills}
              selected={skills}
              onChange={setSkills}
            />
            <FilterMultiSelect
              {...multi}
              name={PARAM.sectors}
              legend={frSearch.find.sectorsLabel}
              options={referentials.sectors}
              selected={sectors}
              onChange={setSectors}
            />
            <FilterMultiSelect
              {...multi}
              name={PARAM.functions}
              legend={frSearch.find.functionsLabel}
              options={referentials.jobFunctions}
              selected={functions}
              onChange={setFunctions}
            />
            <FilterMultiSelect
              {...multi}
              name={PARAM.countries}
              legend={frSearch.find.countriesLabel}
              options={referentials.countries}
              selected={countries}
              onChange={setCountries}
            />
            <FilterMultiSelect
              {...multi}
              name={PARAM.subregions}
              legend={frSearch.find.subregionsLabel}
              options={referentials.subregions}
              selected={subregions}
              onChange={setSubregions}
            />
            <FilterMultiSelect
              {...multi}
              name={PARAM.promotions}
              legend={frSearch.find.promotionsLabel}
              options={referentials.promotions}
              selected={promotions}
              onChange={setPromotions}
            />
            <FilterMultiSelect
              {...multi}
              name={PARAM.languages}
              legend={frSearch.find.languagesLabel}
              options={referentials.languages}
              selected={languages}
              onChange={setLanguages}
            />
            <FilterMultiSelect
              {...multi}
              name={PARAM.availability}
              legend={frSearch.find.availabilityLabel}
              options={referentials.availabilityTypes}
              selected={availability}
              onChange={setAvailability}
            />

            <Field label={frSearch.find.experienceLabel} hint={frSearch.find.experienceHint}>
              {({ id, describedBy }) => (
                <Select
                  id={id}
                  name={PARAM.experience}
                  options={experienceOptions}
                  placeholder={frSearch.find.experienceAny}
                  value={experience}
                  onChange={(event) => setExperience(event.target.value)}
                  {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                />
              )}
            </Field>
          </div>
        </div>
      </details>

      <div className="mt-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-caption text-text-muted">{frSearch.find.submitHint}</p>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="ghost" onClick={reset} disabled={!somethingToSearch}>
            {frSearch.find.reset}
          </Button>
          <Button type="submit" size="lg">
            {frSearch.find.submit}
          </Button>
        </div>
      </div>
    </form>
  );
}
