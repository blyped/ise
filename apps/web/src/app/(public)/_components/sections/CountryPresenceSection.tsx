import { t } from '@/i18n/fr';
import { frPublic } from '@/i18n/public';
import { formatCount, formatLongDate } from '@/lib/public/landing-format';
import type { LandingCountryCount, LandingCountryPresence } from '@/lib/public/country-presence';
import {
  WORLD_MAP_HEIGHT,
  WORLD_MAP_LAND_PATH,
  WORLD_MAP_WIDTH,
  worldMapPoint,
} from '@/lib/public/world-map';
import { LANDING_ANCHORS } from '../public-nav';
import { SectionShell } from './SectionShell';

/**
 * 0133 — « Ou sont les ISE actuellement ? », carte du monde et liste des pays.
 *
 * Demande du porteur, mot pour mot : « Ajouter une carte du monde (Ou sont les
 * ISE actuellement ?) avec des points par pays de presence + nombre d'ISE par
 * pays. » Elle complete « Le reseau en quelques chiffres », rendu juste
 * au-dessus par `NetworkSection` — les deux blocs comptent le meme perimetre de
 * profils, c'est la migration qui le garantit.
 *
 * QUATRE REGLES TENUES ICI.
 *
 *  1. AUCUN CHIFFRE INVENTE. Tout ce qui s'affiche vient de
 *     `get_landing_country_presence()` : les nombres par pays, le total, le
 *     nombre de profils localises, le seuil, ce que le seuil masque. Rien n'est
 *     arrondi, rien n'est complete, rien n'est estime. Sans pays au-dessus du
 *     seuil, la section ne rend RIEN — pas de carte vide, pas de zero.
 *
 *  2. LA CARTE N'EST PAS LA SOURCE. Un point colore ne porte jamais seul une
 *     information (D-90) : la liste des pays et de leur nombre d'ISE est
 *     rendue en clair, pour tout le monde, sous la carte. Le `<svg>` est donc
 *     `aria-hidden` — il redit graphiquement ce que la liste dit deja, et un
 *     lecteur d'ecran n'a rien a faire d'un chemin de 10 ko. Chaque point porte
 *     tout de meme un `<title>` : c'est l'infobulle de survol, pour la souris.
 *
 *  3. SUR TELEPHONE, LA LISTE PLUTOT QU'UNE CARTE ILLISIBLE. Douze pays dont
 *     neuf en Afrique de l'Ouest, sur 340 px de large, c'est une tache de
 *     points superposes. La carte disparait donc sous `md`, la liste passe en
 *     deux colonnes, et personne ne perd d'information.
 *
 *  4. LA PAGE DIT CE QU'ELLE NE MONTRE PAS. Trois mentions honnetes, chacune
 *     conditionnee a un fait reel : la couverture (combien de profils ont un
 *     pays renseigne), le seuil de confidentialite (combien de pays il masque,
 *     et combien d'ISE y exercent, sans les nommer) et, le cas echeant, les
 *     pays que le fond simplifie ne sait pas placer.
 *
 * PLACE RESERVEE (D-138). Le `<svg>` porte un `viewBox` et `h-auto` : le
 * navigateur en connait le rapport avant tout rendu, la hauteur du bloc est
 * donc figee des la premiere passe. Rien a telecharger, aucun decalage
 * possible — contrairement a une image de carte, qui en provoquerait un.
 */

/** Terres emergees. Assez claire pour porter les points, assez sourde pour ne pas les concurrencer. */
const LAND_FILL = '#1B3763';

/**
 * Or ISE (`colors.iseGold`), en accent — jamais en fond de bloc (D-92). C'est
 * la seule teinte de la palette qui se detache du bleu profond sans lutter
 * avec le bleu d'action, reserve aux elements cliquables : ces points-ci ne
 * sont pas cliquables.
 */
const DOT_FILL = '#D9A441';

/** Rayon d'un point, en unites du `viewBox`. */
function dotRadius(count: number, max: number): number {
  if (max <= 0) return 4;
  // Racine carree : c'est l'AIRE du disque qui doit suivre le nombre d'ISE.
  // Un rayon proportionnel exagererait le plus gros pays d'un facteur carre.
  return 4 + 10 * Math.sqrt(count / max);
}

export function CountryPresenceSection({ presence }: { presence: LandingCountryPresence }) {
  const countries = presence.countries;

  // Projection en panne, ou aucun pays au-dessus du seuil : pas de section.
  if (presence.status !== 'ok' || countries.length === 0) return null;

  const max = countries.reduce((best, country) => Math.max(best, country.count), 0);

  const plotted: { readonly country: LandingCountryCount; readonly point: readonly [number, number] }[] =
    [];
  for (const country of countries) {
    const point = worldMapPoint(country.code);
    if (point !== null) plotted.push({ country, point });
  }
  // Les plus gros disques d'abord : les petits restent visibles par-dessus.
  plotted.sort((a, b) => b.country.count - a.country.count);
  const unplotted = countries.length - plotted.length;

  const computedAt = presence.computedAt === null ? null : formatLongDate(presence.computedAt);

  return (
    <SectionShell id={LANDING_ANCHORS.countryPresence} title={frPublic.countryPresence.title}>
      <div className="bg-deep-navy rounded-xl px-9 py-8 max-md:px-5 max-md:py-6">
        <svg
          viewBox={`0 0 ${WORLD_MAP_WIDTH} ${WORLD_MAP_HEIGHT}`}
          className="block h-auto w-full max-md:hidden"
          aria-hidden="true"
          focusable="false"
        >
          <path d={WORLD_MAP_LAND_PATH} fill={LAND_FILL} />
          {plotted.map(({ country, point }) => (
            <circle
              key={country.code}
              cx={point[0]}
              cy={point[1]}
              r={dotRadius(country.count, max)}
              fill={DOT_FILL}
              fillOpacity={0.9}
              stroke={LAND_FILL}
              strokeWidth={1}
            >
              <title>
                {t(frPublic.countryPresence.dotTitle, {
                  country: country.name,
                  count: formatCount(country.count),
                })}
              </title>
            </circle>
          ))}
        </svg>

        <h3 className="sr-only">{frPublic.countryPresence.listLabel}</h3>
        <ol className="mt-8 grid grid-cols-4 gap-x-7 gap-y-1 max-lg:grid-cols-3 max-md:mt-0 max-md:grid-cols-2 max-md:gap-x-5">
          {countries.map((country) => (
            <li
              key={country.code}
              className="flex items-baseline justify-between gap-3 border-b border-[#1F3A66] py-2"
            >
              <span className="text-body-sm text-text-inverse">{country.name}</span>
              <span className="text-body-sm text-text-inverse font-semibold tabular-nums">
                {formatCount(country.count)}
              </span>
            </li>
          ))}
        </ol>

        <div className="text-caption mt-6 max-w-[80ch] space-y-1 text-[#8FA3C0]">
          <p>
            {t(frPublic.countryPresence.coverage, {
              located: formatCount(presence.locatedProfiles),
              total: formatCount(presence.totalProfiles),
            })}
          </p>
          {presence.hiddenCountries === 0 ? null : (
            <p>
              {t(
                presence.hiddenCountries === 1
                  ? frPublic.countryPresence.thresholdOne
                  : frPublic.countryPresence.threshold,
                {
                  threshold: formatCount(presence.threshold),
                  countries: formatCount(presence.hiddenCountries),
                  profiles: formatCount(presence.hiddenProfiles),
                },
              )}
            </p>
          )}
          {unplotted === 0 ? null : (
            // Masquee avec la carte : sans carte, la mention n'aurait pas de sens.
            <p className="max-md:hidden">
              {t(
                unplotted === 1
                  ? frPublic.countryPresence.unplottedOne
                  : frPublic.countryPresence.unplotted,
                { count: formatCount(unplotted) },
              )}
            </p>
          )}
          {computedAt === null ? null : (
            <p>{t(frPublic.countryPresence.computedAt, { date: computedAt })}</p>
          )}
        </div>
      </div>
    </SectionShell>
  );
}
