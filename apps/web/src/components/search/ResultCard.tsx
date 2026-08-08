import Link from 'next/link';
import { Avatar, Badge, Card } from '@ise/ui-web';
import { frSearch } from '@/i18n/search';
import { memberProfileRoute } from '@/lib/routes/search';
import type { SearchResultRow } from '@/lib/queries/search';
import { RelevanceBadge } from './RelevanceBadge';
import { MatchReasons } from './MatchReasons';

/**
 * Carte de resultat ISE-035.
 *
 * RESPONSIVE REEL (MASTER PROMPT §57) — ce n'est pas une reduction :
 *   · a 375 px la carte est une COLONNE ordonnee par importance
 *     (identite -> motifs -> disponibilites -> action pleine largeur),
 *     l'organisation et le pays passent sur une ligne secondaire, et les
 *     compétences sont limitees a trois puces ;
 *   · a partir de 1024 px la carte devient une GRILLE a trois zones
 *     (identite | motifs | action) : le lecteur compare les motifs d'un
 *     profil a l'autre en balayant une seule colonne, ce qui est
 *     impossible en pile.
 *
 * CONFIDENTIALITE : ni e-mail ni telephone (D5 §23, CA-MATCH-07) — les
 * RPC ne les renvoient d'ailleurs pas. Aucun score, aucun pourcentage,
 * aucun rang : `SearchResultRow` ne comporte pas le champ.
 */
export function ResultCard({ row }: { row: SearchResultRow }) {
  const href = memberProfileRoute(row.profileId);
  const reasonsId = `motifs-${row.profileId}`;

  const secondaryLine = [row.promotionLabel, row.currentCity, row.currentCountryCode]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' · ');

  const positionLine = [row.currentPosition, row.currentOrganization]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' · ');

  const isSparse =
    positionLine.length === 0 && row.topSkills.length === 0 && (row.headline ?? '').length === 0;

  return (
    <Card as="li" padding="sm" interactive>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto] lg:items-start lg:gap-7">
        {/* ---- Zone 1 : identite ---- */}
        <div className="flex min-w-0 gap-4">
          <Avatar name={row.displayName} size={48} decorative />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Link
                href={href}
                className="text-body text-text-primary hover:text-primary focus-visible:outline-active-blue font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {row.displayName}
              </Link>
              {row.verificationStatus === 'verified' ? (
                <Badge tone="success">{frSearch.results.verified}</Badge>
              ) : null}
              {row.relevanceLabel !== null ? (
                <span className="lg:hidden">
                  <RelevanceBadge label={row.relevanceLabel} />
                </span>
              ) : null}
            </div>

            {secondaryLine.length > 0 ? (
              <p className="text-body-sm text-text-muted mt-1">{secondaryLine}</p>
            ) : null}

            {positionLine.length > 0 ? (
              <p className="text-body-sm text-text-primary mt-1 font-medium">{positionLine}</p>
            ) : null}

            {row.headline !== null && row.headline.length > 0 ? (
              <p className="text-body-sm text-text-secondary mt-1 line-clamp-2">{row.headline}</p>
            ) : null}

            {row.topSkills.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2" aria-label={frSearch.results.topSkills}>
                {row.topSkills.slice(0, 3).map((skill) => (
                  <li
                    key={skill}
                    className="border-border bg-surface-muted text-caption text-text-secondary rounded-full border px-3 py-1"
                  >
                    {skill}
                  </li>
                ))}
              </ul>
            ) : null}

            {isSparse ? (
              <p className="text-caption text-text-muted mt-3">{frSearch.results.partialProfile}</p>
            ) : null}
          </div>
        </div>

        {/* ---- Zone 2 : pourquoi ce profil ---- */}
        <div className="min-w-0">
          {row.relevanceLabel !== null ? (
            <p className="mb-3 hidden lg:block">
              <RelevanceBadge label={row.relevanceLabel} />
            </p>
          ) : null}

          <MatchReasons
            reasons={row.reasons}
            title={frSearch.results.whyThisProfile}
            headingId={reasonsId}
          />

          {row.openAvailabilityTypes.length > 0 ? (
            <p className="text-caption text-text-muted mt-3">
              <span className="text-text-secondary font-semibold">
                {frSearch.results.availableFor} :
              </span>{' '}
              {row.openAvailabilityTypes.join(' · ')}
            </p>
          ) : null}
        </div>

        {/* ---- Zone 3 : action ---- */}
        <div className="lg:w-[168px]">
          <Link
            href={href}
            className="rounded-base bg-surface text-body-sm text-text-primary hover:border-primary hover:bg-surface-muted focus-visible:outline-active-blue inline-flex h-[44px] w-full items-center justify-center border border-[#CBD5E1] px-5 font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span className="sr-only">{row.displayName} — </span>
            {frSearch.results.viewProfile}
          </Link>
        </div>
      </div>
    </Card>
  );
}
