import { RELEVANCE_LABELS, type RelevanceLabel } from '@ise/domain';
import { Badge } from '@ise/ui-web';
import { CheckIcon } from '@ise/ui-web';

/**
 * Libelle QUALITATIF de pertinence (D-42).
 *
 * MASTER PROMPT §15 : aucun pourcentage, aucun score. Ce composant ne
 * peut d'ailleurs pas en afficher : sa seule entree est l'un des trois
 * libelles `very_relevant` / `relevant` / `close` renvoyes par
 * `public.match_profiles()`. Le score numerique n'existe qu'en base et
 * dans le curseur, lui-meme scelle avant de sortir du serveur.
 *
 * D-90 : la couleur ne porte jamais seule l'information — le texte et
 * l'icone la portent aussi.
 */
export function RelevanceBadge({ label }: { label: RelevanceLabel }) {
  const tone = label === 'very_relevant' ? 'success' : label === 'relevant' ? 'info' : 'neutral';

  return (
    <Badge tone={tone} icon={<CheckIcon width={13} height={13} aria-hidden="true" />}>
      {RELEVANCE_LABELS[label]}
    </Badge>
  );
}
