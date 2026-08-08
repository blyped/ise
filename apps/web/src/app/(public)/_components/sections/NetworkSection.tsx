import { fr, t } from '@/i18n/fr';
import { frPublic } from '@/i18n/public';
import { formatCount, formatLongDate } from '@/lib/public/landing-format';
import type { LandingStatsSection } from '@/lib/public/landing-data';
import { LANDING_ANCHORS } from '../public-nav';
import { SectionShell } from './SectionShell';

/**
 * « Un reseau concu pour etre utile » + « Le reseau en quelques chiffres ».
 *
 * Les quatre piliers sont du **discours de marque**, pas de la donnee metier :
 * ils vivent dans `fr.public.pillars` au meme titre que la promesse de marque.
 *
 * ADDENDUM §23 — les chiffres, eux, viennent exclusivement de
 * `get_landing_stats()`. Cette fonction renvoie aujourd'hui **zero partout**,
 * l'annuaire n'etant pas importe : c'est la reponse correcte de la base.
 *
 * Decision d'affichage, et sa raison : quand les quatre mesures valent zero,
 * le bloc est **masque** et remplace par une phrase qui dit ce qu'il en est.
 * Afficher « 0 profils referencés · 0 promotions · 0 pays · 0 organisations »
 * serait exact mais illisible, et laisserait croire a une panne. Des qu'une
 * seule mesure devient non nulle, les quatre valeurs reelles s'affichent,
 * zeros compris. Les valeurs 1842 / 37 / 29 / 126 des maquettes n'existent
 * nulle part dans ce fichier.
 */
export function NetworkSection({
  stats,
  title,
}: {
  stats: LandingStatsSection;
  title?: string | undefined;
}) {
  // `allZero` couvre les deux cas ou il n'y a rien de mesure a montrer : la
  // projection en panne (aucun element) et l'annuaire vide (que des zeros).
  const showFigures = stats.status === 'ok' && stats.items.length > 0 && !stats.allZero;

  return (
    <SectionShell id={LANDING_ANCHORS.network} title={fr.public.pillars.title}>
      <ul className="grid grid-cols-4 gap-6 max-lg:grid-cols-2 max-md:grid-cols-1 max-md:gap-4">
        {fr.public.pillars.items.map((pillar, index) => (
          <li
            key={pillar.key}
            className={
              // La maquette alterne fond bleute et fond blanc. L'alternance est
              // decorative : elle ne porte aucune information (D-90).
              index % 2 === 0
                ? 'rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-6 max-md:p-5'
                : 'border-border bg-surface rounded-lg border p-6 max-md:p-5'
            }
          >
            <p className="text-overline text-primary font-semibold uppercase tracking-[0.08em]">
              {pillar.title}
            </p>
            <p className="text-body-sm text-text-secondary mt-4">{pillar.body}</p>
          </li>
        ))}
      </ul>

      <div
        id={LANDING_ANCHORS.stats}
        className="bg-deep-navy mt-9 rounded-xl px-10 py-9 max-md:mt-7 max-md:px-6 max-md:py-7"
      >
        <h3 className="text-h4 text-text-inverse font-semibold">
          <span className="max-md:hidden">{title ?? fr.public.stats.title}</span>
          <span className="md:hidden">{fr.public.stats.shortTitle}</span>
        </h3>

        {showFigures ? (
          <>
            <dl className="mt-7 grid grid-cols-4 gap-7 max-md:gap-5">
              {stats.items.map((stat) => (
                <div key={stat.id}>
                  <dd className="text-h1 text-text-inverse max-md:text-h3 font-bold">
                    {formatCount(stat.value)}
                  </dd>
                  <dt
                    className="text-caption max-md:text-overline mt-1 text-[#C7D2E5]"
                    // La phrase de provenance vient de la base : elle documente
                    // ce que le chiffre compte exactement (§23).
                    title={stat.source.length > 0 ? stat.source : undefined}
                  >
                    <span className="max-md:hidden">
                      {frPublic.stats.labels[stat.id] ?? stat.id}
                    </span>
                    <span className="md:hidden">
                      {frPublic.stats.shortLabels[stat.id] ?? stat.id}
                    </span>
                  </dt>
                </div>
              ))}
            </dl>
            {stats.computedAt === null ? null : (
              <p className="text-caption mt-5 text-[#8FA3C0]">
                {t(frPublic.stats.computedAt, {
                  date: formatLongDate(stats.computedAt) ?? '',
                })}
              </p>
            )}
          </>
        ) : (
          <p className="text-body-sm mt-5 max-w-[60ch] text-[#C7D2E5]">
            {frPublic.stats.notYetMeasured}
          </p>
        )}
      </div>
    </SectionShell>
  );
}
