import type { ReactNode } from 'react';
import { Avatar, Badge, type AvatarSize } from '@ise/ui-web';
// `network-view` et non `queries/network` : ce composant est rendu aussi
// bien cote serveur que dans un composant client (ISE-040). Importer le
// module de requetes ferait entrer `next/headers` dans le bundle
// navigateur.
import { identityLine, locationLine, type NetworkProfileCard } from '@/lib/network-view';

/**
 * Bloc d'identite reutilise par tous les ecrans de la tranche Reseau.
 *
 * Il n'affiche que ce que la base a bien voulu composer : un champ mis en
 * `private` par son proprietaire est ABSENT de la carte, il n'est donc
 * ni recu ni masque (MASTER PROMPT §47). D'ou l'absence totale de
 * valeurs de repli du type « Non renseigné » sur les champs sensibles :
 * l'ecran ne peut pas distinguer « non renseigné » de « non communiqué »
 * et ne fait donc aucune supposition.
 *
 * RESPONSIVE (375 -> 1440) : sous `md`, l'avatar et le nom se centrent,
 * les competences et disponibilites tombent sous l'identite ; a partir de
 * `md`, l'ensemble se met en ligne et le contenu d'action passe a droite.
 */
export function ProfileSummary({
  card,
  avatarUrl,
  size = 64,
  showSkills = true,
  showAvailabilities = true,
  trailing,
  compact = false,
}: {
  card: NetworkProfileCard;
  avatarUrl?: string | undefined;
  size?: AvatarSize;
  showSkills?: boolean;
  showAvailabilities?: boolean;
  trailing?: ReactNode;
  compact?: boolean;
}) {
  const identity = identityLine(card);
  const location = locationLine(card);

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
      <div className="flex min-w-0 gap-4">
        <Avatar name={card.displayName} src={avatarUrl} size={size} decorative />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-body text-text-primary font-semibold">{card.displayName}</span>
            {card.verificationStatus === 'verified' ? (
              <Badge tone="success">Identité vérifiée</Badge>
            ) : null}
          </p>

          {identity.length > 0 ? (
            <p className="text-body-sm text-text-secondary mt-1">{identity}</p>
          ) : null}

          {location.length > 0 ? (
            <p className="text-caption text-text-muted mt-1">{location}</p>
          ) : null}

          {!compact && card.currentOrganization !== null ? (
            <p className="text-caption text-text-muted mt-1">{card.currentOrganization}</p>
          ) : null}

          {!compact && card.headline !== null ? (
            <p className="text-body-sm text-text-secondary mt-2">{card.headline}</p>
          ) : null}

          {/* 375 px : une seule competence, pour ne pas casser la carte.
              768 px et plus : les trois competences renvoyees par la base. */}
          {showSkills && card.skills.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {card.skills.map((skill, index) => (
                <li
                  key={skill}
                  className={
                    index === 0
                      ? 'border-border bg-surface-muted text-caption text-text-secondary rounded-full border px-3 py-1'
                      : 'border-border bg-surface-muted text-caption text-text-secondary hidden rounded-full border px-3 py-1 md:inline-block'
                  }
                >
                  {skill}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
        {showAvailabilities && card.availabilities.length > 0 ? (
          <ul className="flex flex-wrap gap-2 md:justify-end">
            {card.availabilities.slice(0, 2).map((availability) => (
              <li key={availability.code}>
                <Badge tone="success">{availability.name}</Badge>
              </li>
            ))}
          </ul>
        ) : null}
        {trailing}
      </div>
    </div>
  );
}
