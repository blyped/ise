import { fr, t } from '@/i18n/fr';
import { frPublic } from '@/i18n/public';
import { formatCount, formatLongDate } from '@/lib/public/landing-format';
import {
  LANDING_SECTION_KEYS,
  type LandingPillar,
  type LandingSection,
  type LandingStatsSection,
} from '@/lib/public/landing-data';
import { SEARCH_ROUTES } from '@/lib/routes/search';
import { CALL_ROUTES } from '@/lib/routes/calls';
import { PROJECT_ROUTES } from '@/lib/routes/projects';
import { OPPORTUNITY_ROUTES } from '@/lib/routes/opportunities';
import { LANDING_ANCHORS } from '../public-nav';
import { LandingMediaImage } from '../LandingMediaImage';
import { ProtectedLink } from '../ProtectedLink';
import { SectionShell } from './SectionShell';

/**
 * Resolution d'un `link_target` CMS (0114) en URL reelle.
 *
 * Liste blanche cote base (`cms_pillars.link_target`, migration 0114) :
 * cinq ecrans membres reels, jamais un chemin invente (ADDENDUM §10,
 * regle 6). Une cle absente de cette table — ancienne valeur retiree de la
 * liste blanche base, ou reponse malformee — rend le pilier en texte seul,
 * exactement comme un `link_target` `null`.
 */
const TARGET_ROUTES: Partial<Record<string, string>> = {
  search: SEARCH_ROUTES.find,
  calls: CALL_ROUTES.list,
  projects: PROJECT_ROUTES.list,
  opportunities: OPPORTUNITY_ROUTES.list,
  applications: OPPORTUNITY_ROUTES.applications,
};

/**
 * Boite a rapport d'aspect du visuel d'un pilier (D-138).
 *
 * `StorageImage` rend une image `fill` : elle se positionne par rapport au
 * premier ancetre positionne et n'occupe, seule, aucune place. Sans ce
 * conteneur `relative` a rapport d'aspect fige, l'image sortait de la carte
 * et la hauteur du bloc n'etait connue qu'une fois le fichier charge. La
 * place est donc reservee par le conteneur, jamais par les dimensions
 * intrinseques du fichier — meme boite que « A la une du reseau », meme
 * rapport 16/9 que le format recommande a l'administrateur CMS
 * (1600 x 900 px). Le conteneur n'existe que s'il y a un visuel : un pilier
 * sans image n'affiche aucun cadre vide.
 */
const PILLAR_MEDIA_FRAME =
  'bg-surface-muted rounded-base relative mb-4 aspect-[16/9] w-full overflow-hidden';

/**
 * Etat cliquable d'un pilier. Ici le lien EST la carte (contrairement aux
 * cartes de « A la une », ou un `::after` etend un lien interne) : le survol
 * et le focus clavier se posent donc directement sur lui. `focus-visible`
 * plutot que `focus` : pas d'anneau apres un clic souris. La cible de clic
 * est la carte entiere, tres au-dela des 44 px exiges.
 */
const PILLAR_INTERACTIVE =
  'block h-full min-h-[44px] cursor-pointer transition-shadow duration-150 ' +
  'hover:border-primary hover:shadow-md focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * « Un reseau concu pour etre utile » + « Le reseau en quelques chiffres ».
 *
 * 0129 — TOUT le contenu d'un pilier vient desormais du CMS : titre, corps,
 * image, legende et lien (`cms_pillars` / `/cms/piliers`). 0114 avait laisse
 * le titre et le corps en dur dans l'i18n en les qualifiant de « discours de
 * marque » ; a l'usage l'administrateur n'avait aucun moyen de les changer,
 * ce qui n'etait pas tenable.
 *
 * REPLI, ET POURQUOI CELUI-LA. La boucle parcourt
 * `fr.public.pillars.defaults` — quatre entrees fixes, dans l'ordre — et
 * remplace titre et corps par ceux de la base des qu'ils existent. Le repli
 * sur la valeur d'origine (plutot que le masquage) est retenu parce qu'un
 * pilier sans titre ni corps serait une carte vide : un contenu casse, pas
 * un choix editorial. Il couvre les deux memes cas :
 *   - la projection est en panne ou le pilier n'est pas encore configure
 *     (`pillars.items` vide) ;
 *   - l'administrateur a vide le champ, ce que le formulaire CMS annonce
 *     explicitement comme « revenir au texte d'origine ».
 * Le masquage reste, lui, la regle pour tout ce qui est optionnel par
 * nature — image, legende, lien : rien n'est invente a la place.
 *
 * Un pilier absent de `pillars.items` reste du texte seul — jamais un lien
 * ou une image inventes.
 *
 * 0122 — les quatre piliers ont desormais une cible reelle en base ; le
 * pilier cliquable est un lien qui couvre la carte entiere, annonce ou il
 * mene (texte visible + nom accessible), se signale au survol comme au
 * focus clavier, et reserve la place de son visuel avant meme que l'image
 * arrive. Un pilier dont l'administrateur retire le lien redevient du texte
 * seul, sans rien de tout cela.
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
  pillars,
  title,
}: {
  stats: LandingStatsSection;
  pillars: LandingSection<LandingPillar>;
  title?: string | undefined;
}) {
  // `allZero` couvre les deux cas ou il n'y a rien de mesure a montrer : la
  // projection en panne (aucun element) et l'annuaire vide (que des zeros).
  const showFigures = stats.status === 'ok' && stats.items.length > 0 && !stats.allZero;

  return (
    <SectionShell id={LANDING_ANCHORS.network} title={fr.public.pillars.title}>
      <ul className="grid grid-cols-4 gap-6 max-lg:grid-cols-2 max-md:grid-cols-1 max-md:gap-4">
        {fr.public.pillars.defaults.map((pillar, index) => {
          const cmsPillar = pillars.items.find((item) => item.pillarKey === pillar.key);
          // 0129 — la base d'abord, la valeur d'origine seulement si elle ne
          // dit rien. `??` suffit : la projection normalise deja la chaine
          // vide en `null` (`nullableText`, landing-data.ts). Nommes
          // `pillarTitle`/`pillarBody` pour ne pas masquer la prop `title`
          // de la section, qui est celle du bloc chiffres.
          const pillarTitle = cmsPillar?.title ?? pillar.title;
          const pillarBody = cmsPillar?.body ?? pillar.body;
          const image = cmsPillar?.image ?? null;
          const linkTarget = cmsPillar?.linkTarget ?? null;
          const target = linkTarget === null ? undefined : TARGET_ROUTES[linkTarget];
          // Ce que le visiteur ira faire sur l'ecran vise. Sert deux fois :
          // en texte visible (le pilier ne ressemblerait sinon a rien de
          // cliquable) et au debut du nom accessible du lien.
          const action = linkTarget === null ? undefined : frPublic.pillars.actions[linkTarget];
          const content = (
            <>
              {image === null ? null : (
                <div className={PILLAR_MEDIA_FRAME}>
                  <LandingMediaImage
                    media={image}
                    sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
              )}
              <p className="text-overline text-primary font-semibold uppercase tracking-[0.08em]">
                {pillarTitle}
              </p>
              <p className="text-body-sm text-text-secondary mt-4">{pillarBody}</p>
              {cmsPillar?.caption === null || cmsPillar?.caption === undefined ? null : (
                <p className="text-body-sm text-text-secondary mt-2">{cmsPillar.caption}</p>
              )}
              {target === undefined || action === undefined ? null : (
                <p className="text-body-sm text-primary mt-4 font-semibold">
                  {action} <span aria-hidden="true">→</span>
                </p>
              )}
            </>
          );
          const cardClassName =
            // La maquette alterne fond bleute et fond blanc. L'alternance est
            // decorative : elle ne porte aucune information (D-90).
            index % 2 === 0
              ? 'h-full rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-6 max-md:p-5'
              : 'border-border bg-surface h-full rounded-lg border p-6 max-md:p-5';

          return (
            <li key={pillar.key}>
              {target === undefined ? (
                <div className={cardClassName}>{content}</div>
              ) : (
                <ProtectedLink
                  target={target}
                  resourceType="espace-membre"
                  className={`${PILLAR_INTERACTIVE} ${cardClassName}`}
                  {...(action === undefined
                    ? {}
                    : { label: t(frPublic.pillars.linkLabel, { title: pillarTitle, action }) })}
                  event="public_content_click"
                  sectionKey={LANDING_SECTION_KEYS.pillars}
                  contentType="network_pillar"
                  position={index + 1}
                >
                  {content}
                </ProtectedLink>
              )}
            </li>
          );
        })}
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
