'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';
import { cx } from '../utils/cx';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { Input } from '../components/Input';
import { Skeleton } from '../components/Skeleton';

export interface TokenOption {
  /** Valeur envoyee au serveur. */
  value: string;
  label: string;
  /** Regroupement affiche (ex. domaine de competence). */
  group?: string;
  /** Precision affichee sous le libelle (ex. categorie, alias reconnu). */
  hint?: string;
}

export interface TokenPickerLabels {
  searchLabel: string;
  searchPlaceholder: string;
  searchHint?: string;
  selectedLabel: string;
  /** `{count}` et `{max}`. */
  counter: string;
  /** `{max}`. */
  limitReached: string;
  browseLabel: string;
  browseHint?: string;
  resultsLabel: string;
  add: string;
  remove: string;
  emptyTitle: string;
  emptyBody: string;
  loading: string;
  noSelection: string;
}

export interface TokenPickerProps {
  /** Nom des champs caches : un par valeur selectionnee. */
  name: string;
  /** Referentiel complet, deja lu en base. Filtre localement. */
  options: readonly TokenOption[];
  defaultSelected?: readonly TokenOption[];
  /** Nombre maximal de selections. `0` = illimite. */
  max?: number;
  labels: TokenPickerLabels;
  /**
   * Recherche serveur. Fournie lorsque le referentiel est trop grand pour
   * etre charge entierement (543 competences) : la fonction est une
   * Server Action, la liste n'est donc jamais codee cote client.
   */
  search?: (query: string) => Promise<TokenOption[]>;
  /** Nombre d'options du referentiel affichees sans recherche. */
  browseLimit?: number;
  error?: string | undefined;
  onSelectionChange?: (values: string[]) => void;
}

function group(options: readonly TokenOption[]): Array<[string, TokenOption[]]> {
  const map = new Map<string, TokenOption[]>();
  for (const option of options) {
    const key = option.group ?? '';
    const bucket = map.get(key);
    if (bucket) bucket.push(option);
    else map.set(key, [option]);
  }
  return [...map.entries()];
}

/**
 * Selection multiple avec recherche incrementale, regroupement et jetons
 * retirables. Utilise par ISE-010 (competences), ISE-011 (secteurs) et
 * ISE-012 (zones d'experience).
 *
 * Les valeurs retenues sont postees par des `input type="hidden"` : le
 * formulaire fonctionne avec une Server Action classique, sans etat
 * client persistant. Rien n'est conserve dans le navigateur.
 */
export function TokenPicker({
  name,
  options,
  defaultSelected = [],
  max = 0,
  labels,
  search,
  browseLimit = 60,
  error,
  onSelectionChange,
}: TokenPickerProps) {
  const base = useId();
  const listId = `${base}-list`;
  const selectedId = `${base}-selected`;
  const errorId = `${base}-error`;

  const [selected, setSelected] = useState<TokenOption[]>([...defaultSelected]);
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<TokenOption[] | null>(null);
  const [pending, startTransition] = useTransition();
  const requestRef = useRef(0);

  const atLimit = max > 0 && selected.length >= max;

  useEffect(() => {
    onSelectionChange?.(selected.map((option) => option.value));
  }, [selected, onSelectionChange]);

  // Recherche serveur, debouncee. Une reponse arrivee en retard est ignoree :
  // `requestRef` garde la trace de la derniere requete emise.
  useEffect(() => {
    if (!search) return undefined;
    const ticket = ++requestRef.current;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const found = await search(query);
        if (requestRef.current === ticket) setRemote(found);
      });
    }, 220);
    return () => clearTimeout(timer);
  }, [query, search]);

  const localMatches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('fr-FR');
    const pool =
      needle.length === 0
        ? options
        : options.filter(
            (option) =>
              option.label.toLocaleLowerCase('fr-FR').includes(needle) ||
              (option.group ?? '').toLocaleLowerCase('fr-FR').includes(needle) ||
              (option.hint ?? '').toLocaleLowerCase('fr-FR').includes(needle),
          );
    return pool.slice(0, browseLimit);
  }, [options, query, browseLimit]);

  const shown = search ? (remote ?? []) : localMatches;
  const selectedValues = new Set(selected.map((option) => option.value));
  const available = shown.filter((option) => !selectedValues.has(option.value));

  const add = useCallback(
    (option: TokenOption) => {
      setSelected((current) => {
        if (current.some((entry) => entry.value === option.value)) return current;
        if (max > 0 && current.length >= max) return current;
        return [...current, option];
      });
    },
    [max],
  );

  const remove = useCallback((value: string) => {
    setSelected((current) => current.filter((entry) => entry.value !== value));
  }, []);

  const counter = labels.counter
    .replace('{count}', String(selected.length))
    .replace('{max}', String(max));

  return (
    <div className="flex flex-col gap-5">
      {selected.map((option) => (
        <input key={option.value} type="hidden" name={name} value={option.value} />
      ))}

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-search`} className="text-body-sm text-text-primary font-medium">
          {labels.searchLabel}
        </label>
        {labels.searchHint ? (
          <p id={`${base}-search-hint`} className="text-caption text-text-muted">
            {labels.searchHint}
          </p>
        ) : null}
        <Input
          id={`${base}-search`}
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={labels.searchPlaceholder}
          aria-controls={listId}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [labels.searchHint ? `${base}-search-hint` : null, error ? errorId : null]
              .filter(Boolean)
              .join(' ') || undefined
          }
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p id={selectedId} className="text-body-sm text-text-primary font-medium">
            {labels.selectedLabel}
          </p>
          {max > 0 ? <p className="text-caption text-text-muted">{counter}</p> : null}
        </div>

        <ul aria-labelledby={selectedId} className="flex flex-wrap gap-3">
          {selected.length === 0 ? (
            <li className="text-caption text-text-muted">{labels.noSelection}</li>
          ) : (
            selected.map((option) => (
              <li key={option.value}>
                <Chip
                  selected
                  onRemove={() => remove(option.value)}
                  removeLabel={`${labels.remove} : ${option.label}`}
                >
                  {option.label}
                </Chip>
              </li>
            ))
          )}
        </ul>

        {atLimit ? (
          <p className="text-caption text-text-secondary" role="status">
            {labels.limitReached.replace('{max}', String(max))}
          </p>
        ) : null}

        {error ? (
          <p id={errorId} className="text-caption text-error">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-body-sm text-text-primary font-medium">
          {query.trim().length > 0 ? labels.resultsLabel : labels.browseLabel}
        </p>
        {labels.browseHint && query.trim().length === 0 ? (
          <p className="text-caption text-text-muted">{labels.browseHint}</p>
        ) : null}

        <div id={listId} aria-busy={pending} aria-live="polite" className="flex flex-col gap-5">
          {pending && available.length === 0 ? (
            <>
              <span className="sr-only">{labels.loading}</span>
              <Skeleton shape="line" className="w-[220px]" />
              <Skeleton shape="line" className="w-[180px]" />
            </>
          ) : null}

          {!pending && available.length === 0 ? (
            <EmptyState title={labels.emptyTitle} description={labels.emptyBody} />
          ) : null}

          {group(available).map(([groupName, entries]) => (
            <div key={groupName || '—'} className="flex flex-col gap-3">
              {groupName ? (
                <h3 className="text-caption text-text-muted font-semibold uppercase tracking-[0.04em]">
                  {groupName}
                </h3>
              ) : null}
              <ul className="flex flex-wrap gap-3">
                {entries.map((option) => (
                  <li key={option.value}>
                    <button
                      type="button"
                      disabled={atLimit}
                      onClick={() => add(option)}
                      className={cx(
                        'rounded-base border-border bg-surface text-body-sm text-text-primary inline-flex min-h-[44px] items-center gap-3 border px-4 py-2 text-left',
                        'hover:border-primary hover:bg-surface-muted transition-colors duration-150',
                        'focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2',
                        'disabled:cursor-not-allowed disabled:opacity-60',
                      )}
                    >
                      <span aria-hidden="true" className="text-primary">
                        +
                      </span>
                      <span className="flex flex-col leading-tight">
                        <span>
                          <span className="sr-only">{labels.add} : </span>
                          {option.label}
                        </span>
                        {option.hint ? (
                          <span className="text-caption text-text-muted">{option.hint}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
