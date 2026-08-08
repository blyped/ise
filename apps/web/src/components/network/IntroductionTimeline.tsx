import {
  INTRODUCTION_STATUS_LABELS,
  INTRODUCTION_TIMELINE,
  type IntroductionStatus,
} from '@ise/domain';
import { frNetwork } from '@/i18n/network';
import { formatDate, type IntroductionEventRow } from '@/lib/network-view';

/**
 * Frise d'etapes d'une introduction (ISE-045).
 *
 * REGLE STRUCTURANTE — MASTER PROMPT §25 et D-55 : une etape n'est
 * marquee « constatée » QUE si un evenement correspondant existe dans
 * `introduction_events`. Rien n'est deduit de la position dans la liste,
 * rien n'est extrapole d'une etape voisine. Une etape non encore
 * atteinte porte « À venir » et sa date reste vide : l'ecran n'invente
 * pas de calendrier.
 *
 * Les etapes proviennent de `INTRODUCTION_TIMELINE` (@ise/domain), qui
 * est le miroir de la machine d'etats SQL. Ajouter une etape ici sans
 * l'ajouter a la machine serait afficher une etape qui n'existe pas.
 */
export function IntroductionTimeline({
  status,
  events,
}: {
  status: IntroductionStatus;
  events: readonly IntroductionEventRow[];
}) {
  /** Date du PREMIER evenement ayant produit ce statut, s'il existe. */
  const reachedAt = new Map<string, string | null>();
  for (const event of events) {
    const key = event.toStatus ?? event.eventType;
    if (!reachedAt.has(key)) reachedAt.set(key, event.createdAt);
  }

  const currentIndex = INTRODUCTION_TIMELINE.indexOf(status);
  /** Statuts terminaux hors frise : la demande s'est arretee en chemin. */
  const closedOffPath: readonly IntroductionStatus[] = [
    'intermediary_declined',
    'withdrawn',
    'expired',
    'no_outcome',
  ];
  const isClosedOffPath = closedOffPath.includes(status);

  return (
    <ol className="flex flex-col">
      {INTRODUCTION_TIMELINE.map((step, index) => {
        const done = reachedAt.has(step);
        // « Étape actuelle » = la premiere etape non constatée, et
        // seulement si la demande est encore ouverte.
        const isCurrent =
          !done && !isClosedOffPath && currentIndex >= 0 && index === currentIndex + 1;

        const stateLabel = done
          ? frNetwork.follow.stepDone
          : isCurrent
            ? frNetwork.follow.stepCurrent
            : frNetwork.follow.stepPending;

        const dotClass = done
          ? 'border-success bg-success'
          : isCurrent
            ? 'border-warning bg-surface'
            : 'border-border bg-surface';

        return (
          <li key={step} className="flex gap-4 pb-6 last:pb-0">
            {/* Colonne de la frise. `aria-hidden` : l'etat est deja
                donne en texte a droite (D-90 — la couleur ne porte
                jamais seule une information). */}
            <span aria-hidden="true" className="flex flex-col items-center">
              <span className={`mt-1 h-3 w-3 shrink-0 rounded-full border-2 ${dotClass}`} />
              {index < INTRODUCTION_TIMELINE.length - 1 ? (
                <span className={`mt-1 w-px flex-1 ${done ? 'bg-success' : 'bg-border'}`} />
              ) : null}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <p
                  className={
                    done || isCurrent
                      ? 'text-body-sm text-text-primary font-semibold'
                      : 'text-body-sm text-text-muted'
                  }
                >
                  {INTRODUCTION_STATUS_LABELS[step]}
                </p>
                <p className="text-caption text-text-muted sm:text-right">
                  {done ? formatDate(reachedAt.get(step) ?? null) || stateLabel : stateLabel}
                </p>
              </div>
            </div>
          </li>
        );
      })}

      {isClosedOffPath ? (
        <li className="flex gap-4">
          <span aria-hidden="true" className="flex flex-col items-center">
            <span className="border-text-muted bg-surface mt-1 h-3 w-3 shrink-0 rounded-full border-2" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <p className="text-body-sm text-text-primary font-semibold">
                {INTRODUCTION_STATUS_LABELS[status]}
              </p>
              <p className="text-caption text-text-muted sm:text-right">
                {formatDate(reachedAt.get(status) ?? null)}
              </p>
            </div>
          </div>
        </li>
      ) : null}
    </ol>
  );
}
