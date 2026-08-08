'use client';

import { useId, useMemo, useState, type ReactNode } from 'react';
import { cx } from '../utils/cx';
import { CloseIcon } from '../components/icons';

export interface FilterOption {
  value: string;
  label: string;
  /** Precision affichee sous le libelle (categorie, zone, code…). */
  hint?: string;
}

export interface FilterMultiSelectProps {
  /** Nom du parametre de formulaire : un champ cache par valeur retenue. */
  name: string;
  legend: string;
  hint?: string;
  options: readonly FilterOption[];
  selected: readonly string[];
  onChange: (next: string[]) => void;

  searchPlaceholder: string;
  noMatchLabel: string;
  /** `{shown}` et `{total}` sont remplaces. */
  showingTemplate: string;
  selectedLegend: string;
  removeLabel: string;
  /** Nombre d'options non selectionnees affichees a la fois. */
  visibleLimit?: number;
  /** Rendu lorsqu'aucune option n'existe en base : le critere disparait. */
  emptyReferential?: ReactNode;
}

/** Comparaison insensible aux accents : « senegal » trouve « Sénégal ». */
const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Selection multiple dans un referentiel, utilisable entierement au clavier.
 *
 * Choix d'implementation : des cases a cocher NATIVES plutot qu'un
 * `role="listbox"` maison. Une case a cocher est deja focusable, annoncee,
 * cochable a la barre d'espace et comprise par toutes les technologies
 * d'assistance ; un composant sur mesure ne ferait que reimplementer —
 * moins bien — ce que le navigateur fournit.
 *
 * Les entrees SELECTIONNEES restent toujours affichees, meme quand le
 * filtre de saisie les exclut : une selection ne doit jamais disparaitre
 * de l'ecran sans que l'utilisateur l'ait retiree.
 *
 * La valeur transmise au formulaire passe par des champs caches, ce qui
 * garantit que la selection est envoyee meme si la liste visible est
 * filtree, et que le formulaire fonctionne sans JavaScript une fois la
 * page hydratee.
 */
export function FilterMultiSelect({
  name,
  legend,
  hint,
  options,
  selected,
  onChange,
  searchPlaceholder,
  noMatchLabel,
  showingTemplate,
  selectedLegend,
  removeLabel,
  visibleLimit = 40,
  emptyReferential,
}: FilterMultiSelectProps) {
  const baseId = useId();
  const [needle, setNeedle] = useState('');

  const byValue = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options],
  );

  const selectedOptions = useMemo(
    () => selected.flatMap((value) => (byValue.has(value) ? [byValue.get(value)!] : [])),
    [selected, byValue],
  );

  const matches = useMemo(() => {
    const needleNormalized = normalize(needle.trim());
    const pool = options.filter((option) => !selected.includes(option.value));
    if (needleNormalized.length === 0) return pool;
    return pool.filter(
      (option) =>
        normalize(option.label).includes(needleNormalized) ||
        (option.hint ? normalize(option.hint).includes(needleNormalized) : false),
    );
  }, [options, selected, needle]);

  if (options.length === 0) {
    return emptyReferential ? <>{emptyReferential}</> : null;
  }

  const shown = matches.slice(0, visibleLimit);
  const toggle = (value: string) => {
    onChange(
      selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value],
    );
  };

  return (
    <fieldset className="flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend className="text-body-sm text-text-primary mb-1 font-medium">{legend}</legend>
      {hint ? <p className="text-caption text-text-muted">{hint}</p> : null}

      {selected.map((value) => (
        <input key={`hidden-${value}`} type="hidden" name={name} value={value} />
      ))}

      {selectedOptions.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={selectedLegend}>
          {selectedOptions.map((option) => (
            <li key={`chip-${option.value}`}>
              <button
                type="button"
                onClick={() => toggle(option.value)}
                className={cx(
                  'border-primary inline-flex min-h-[36px] items-center gap-2 rounded-full border',
                  'text-body-sm text-primary-hover bg-[#EFF6FF] px-4 py-1 font-medium',
                  'transition-colors duration-150 hover:bg-[#DBEAFE]',
                  'focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2',
                  'max-md:min-h-[44px]',
                )}
              >
                <span>{option.label}</span>
                <CloseIcon width={14} height={14} aria-hidden="true" />
                <span className="sr-only">
                  {' '}
                  — {removeLabel} {option.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <label className="sr-only" htmlFor={`${baseId}-needle`}>
        {searchPlaceholder}
      </label>
      <input
        id={`${baseId}-needle`}
        type="search"
        value={needle}
        onChange={(event) => setNeedle(event.target.value)}
        placeholder={searchPlaceholder}
        autoComplete="off"
        className={cx(
          'rounded-base border-border bg-surface text-body-sm h-[44px] w-full border px-4',
          'text-text-primary placeholder:text-text-muted transition-colors duration-150',
          'focus:border-primary hover:border-[#CBD5E1]',
          'focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2',
        )}
      />

      <div
        className="rounded-base border-border bg-surface max-h-[248px] overflow-y-auto border"
        role="group"
        aria-label={legend}
      >
        {shown.length === 0 ? (
          <p className="text-caption text-text-muted px-4 py-4">{noMatchLabel}</p>
        ) : (
          <ul className="flex flex-col">
            {shown.map((option) => {
              const id = `${baseId}-${option.value}`;
              return (
                <li key={option.value} className="border-border border-b last:border-b-0">
                  <label
                    htmlFor={id}
                    className={cx(
                      'flex min-h-[44px] cursor-pointer items-start gap-3 px-4 py-3',
                      'text-body-sm text-text-primary transition-colors duration-150',
                      'hover:bg-surface-muted focus-within:bg-surface-muted',
                      'focus-within:outline-2 focus-within:outline-offset-[-2px]',
                      'focus-within:outline-active-blue',
                    )}
                  >
                    <input
                      id={id}
                      type="checkbox"
                      checked={false}
                      onChange={() => toggle(option.value)}
                      className="mt-[3px] h-[18px] w-[18px] shrink-0 accent-[#2563EB]"
                    />
                    <span className="min-w-0">
                      <span className="block">{option.label}</span>
                      {option.hint ? (
                        <span className="text-caption text-text-muted block">{option.hint}</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {matches.length > shown.length ? (
        <p className="text-caption text-text-muted">
          {showingTemplate
            .replace('{shown}', String(shown.length))
            .replace('{total}', String(matches.length))}
        </p>
      ) : null}
    </fieldset>
  );
}
