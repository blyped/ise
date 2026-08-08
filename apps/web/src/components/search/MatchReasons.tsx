import { CheckIcon } from '@ise/ui-web';
import type { MatchReasonView } from '@/lib/queries/search';

/**
 * Bloc « Pourquoi ce profil ? » (D-43, MASTER PROMPT §16).
 *
 * Les phrases viennent telles quelles de `public.match_profiles()` :
 * elles sont construites en base a partir de donnees structurees, jamais
 * generees ici. Un candidat sans raison n'est pas renvoye par le moteur,
 * donc ce composant n'a pas d'etat « aucune raison » a inventer — s'il
 * en recoit zero, il n'affiche rien plutot qu'une justification creuse.
 */
export function MatchReasons({
  reasons,
  title,
  headingId,
}: {
  reasons: readonly MatchReasonView[];
  title: string;
  headingId: string;
}) {
  if (reasons.length === 0) return null;

  return (
    <div className="min-w-0">
      <h4
        id={headingId}
        className="text-caption text-text-muted font-semibold uppercase tracking-wide"
      >
        {title}
      </h4>
      <ul aria-labelledby={headingId} className="mt-2 flex flex-col gap-[6px]">
        {reasons.map((reason) => (
          <li key={`${reason.criterion}-${reason.label}`} className="flex items-start gap-2">
            <CheckIcon
              width={14}
              height={14}
              aria-hidden="true"
              className="text-success mt-[3px] shrink-0"
            />
            <span className="text-body-sm text-text-secondary">{reason.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
