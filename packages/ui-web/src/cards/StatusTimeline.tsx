import { cx } from '../utils/cx';

export interface TimelineEntry {
  /** Clé stable : identifiant ou horodatage. */
  id: string;
  label: string;
  /** Qui a produit ce fait. Distingue un constat d'une déclaration. */
  attribution?: string | undefined;
  date?: string | undefined;
  note?: string | null | undefined;
}

export interface StatusTimelineProps {
  entries: readonly TimelineEntry[];
  emptyLabel: string;
  className?: string;
}

/**
 * Chronologie d'un dossier (candidature, appel).
 *
 * `attribution` est rendu à côté de chaque étape : sur une candidature
 * externe, la plateforme n'a rien constaté, elle a enregistré une
 * DÉCLARATION du membre (D-55). Cacher cette nuance reviendrait à faire
 * passer une déclaration pour un fait.
 */
export function StatusTimeline({ entries, emptyLabel, className }: StatusTimelineProps) {
  if (entries.length === 0) {
    return <p className={cx('text-body-sm text-text-muted', className)}>{emptyLabel}</p>;
  }

  return (
    <ol className={cx('flex flex-col', className)}>
      {entries.map((entry, index) => (
        <li key={entry.id} className="flex gap-4">
          <div className="flex flex-col items-center" aria-hidden="true">
            <span className="bg-primary mt-[6px] size-[10px] shrink-0 rounded-full" />
            {index < entries.length - 1 ? <span className="bg-border w-px flex-1" /> : null}
          </div>
          <div className="flex flex-1 flex-col gap-1 pb-6 last:pb-0">
            <span className="text-body-sm text-text-primary font-medium">{entry.label}</span>
            {entry.date ? <span className="text-caption text-text-muted">{entry.date}</span> : null}
            {entry.attribution ? (
              <span className="text-caption text-text-secondary">{entry.attribution}</span>
            ) : null}
            {entry.note ? (
              <span className="text-body-sm text-text-secondary">{entry.note}</span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
