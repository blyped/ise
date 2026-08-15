'use client';

import { useEffect, useState } from 'react';
import { t } from '@/i18n/fr';
import { frPublic } from '@/i18n/public';
import { entityResourceType, entityRoute } from '@/lib/public/entity-routes';
import {
  LANDING_SECTION_KEYS,
  type LandingMedia,
  type LandingPartnerCampaign,
} from '@/lib/public/landing-data';
import { LandingMediaImage } from './LandingMediaImage';
import { ProtectedLink } from './ProtectedLink';
import { ImpressionTracker } from './analytics/ImpressionTracker';
import { useLandingTracker } from './analytics/LandingTracker';
import { LANDING_ANCHORS } from './public-nav';

/**
 * 0133 — BANDEAU SPONSORISE DU BAS DE PAGE.
 *
 * Demande du porteur, mot pour mot : « pas de bavardages hein (je ne veux
 * pas de texte). C'est une bonne image, qui passe en carrousel (sans les
 * boutons de navigation et pause). »
 *
 * Ce composant est donc `LandingCarousel` DEPOUILLE : pas de fleches, pas de
 * pastilles, pas de bouton lecture/pause, pas un mot a l'ecran. Ce qui reste,
 * et qui n'est pas negociable :
 *
 *  - **`prefers-reduced-motion: reduce` fige le defilement.** Un carrousel
 *    qui tourne tout seul sans aucun moyen d'arret est une barriere reelle :
 *    troubles vestibulaires, troubles de l'attention, lecture lente. WCAG
 *    2.2.2 exige un mecanisme d'arret pour tout mouvement automatique de plus
 *    de cinq secondes. Le porteur a retire le bouton ; le reglage systeme
 *    devient donc LE mecanisme d'arret, et il est respecte a la lettre.
 *
 *    Et quand il est actif, on ne se contente pas de figer la premiere image :
 *    **tous les bandeaux sont affiches, empiles** — les uns SOUS les autres,
 *    dans le flux normal. Le fondu (0137) ne s'applique pas dans ce mode :
 *    ce serait une animation, et il n'y a de toute facon plus de transition
 *    a habiller puisque plus rien ne defile. Sinon un partenaire serait
 *    invisible pour ces visiteurs-la, ce qui serait a la fois injuste pour lui
 *    et malhonnete vis-a-vis d'eux ;
 *
 *  - **le defilement s'interrompt au focus clavier.** Un lien de bandeau
 *    focalise ne doit pas se faire emporter sous l'utilisateur ;
 *
 *  - **chaque image porte une alternative textuelle**, composee de la mention
 *    de transparence (§26), du nom du partenaire et de la description saisie
 *    dans la mediatheque. « Pas de texte » vaut pour l'ECRAN. Une image sans
 *    alternative n'existe pas pour qui ne la voit pas — et la mention
 *    obligatoire disparaitrait avec elle ;
 *
 *  - **la place est reservee avant le chargement** (D-138) : boite a ratio
 *    fixe 4:1 (1920 x 480 px, le format annonce au porteur) et `next/image`
 *    en `fill`. Aucun decalage de mise en page possible.
 *
 * Sans JavaScript, le premier bandeau s'affiche : c'est l'etat du rendu
 * serveur. Le defilement n'existe qu'apres hydratation.
 */

/** Duree d'affichage d'un bandeau. Sept secondes, comme le carrousel haut. */
const BANNER_MS = 7000;

/**
 * 0137 — FONDU, exactement le meme reglage que le carrousel haut (demande du
 * porteur : « la forme des transitions des slides des carrousels de la page
 * d'accueil : tu peux utiliser le style Fade ? » — les deux carrousels, donc
 * le meme fondu, sinon la page bafouille).
 *
 *  - `col-start-1 row-start-1` : en mode defilement, la section est une
 *    grille d'une seule cellule et tous les bandeaux s'y superposent. Tous
 *    ont le meme ratio 4:1 (voir `FRAME`), la hauteur de la cellule est donc
 *    constante — aucun saut de mise en page pendant le fondu ;
 *  - 500 ms, soit un quatorzieme du temps d'affichage d'un bandeau : lisible
 *    comme un fondu, jamais comme une attente ;
 *  - `motion-reduce:transition-none` : filet de securite CSS, actif meme
 *    avant l'hydratation. Au-dela, le mode « mouvement refuse » n'empile plus
 *    rien du tout, il deroule les bandeaux (voir `showAll`).
 */
const FADE =
  'col-start-1 row-start-1 transition-opacity duration-500 motion-reduce:transition-none';

/**
 * Boite du bandeau. Ratio FIXE 4:1 — exactement le format annonce
 * (1920 x 480 px) et rappele dans le CMS. `object-contain` : une image d'un
 * autre rapport n'est jamais rognee, elle apparait avec des bandes laterales
 * (meme arbitrage que D-170 pour le hero).
 */
const FRAME = 'bg-surface relative aspect-[4/1] w-full overflow-hidden';

/**
 * Alternative textuelle du bandeau. Le media en porte deja une, ecrite par
 * l'administrateur dans la mediatheque ; on la prefixe de la mention de
 * transparence et du nom du partenaire, parce que le bandeau n'affiche aucun
 * des deux a l'ecran (ADDENDUM §26).
 */
function describedMedia(campaign: LandingPartnerCampaign, media: LandingMedia): LandingMedia {
  return {
    ...media,
    alt: t(frPublic.sponsorBand.imageAlt, {
      label: campaign.sponsoredLabel,
      partner: campaign.partnerName,
      description: media.alt,
    }),
  };
}

function Banner({ campaign }: { campaign: LandingPartnerCampaign }) {
  const desktop = campaign.media === null ? null : describedMedia(campaign, campaign.media);
  const mobile =
    campaign.mobileMedia === null ? null : describedMedia(campaign, campaign.mobileMedia);

  return (
    <div className={FRAME}>
      {desktop === null ? null : (
        <LandingMediaImage
          media={desktop}
          sizes="100vw"
          className={`object-contain ${mobile === null ? '' : 'max-md:hidden'}`}
        />
      )}
      {mobile === null ? null : (
        <LandingMediaImage
          media={mobile}
          sizes="100vw"
          className={`object-contain ${desktop === null ? '' : 'md:hidden'}`}
        />
      )}
    </div>
  );
}

/**
 * Sortie externe d'un bandeau. Meme regles que `PartnerExternalLink`, mais le
 * contenu est une image et non un libelle : le composant existant ne convient
 * pas, ses classes sont celles d'un bouton d'appel a l'action.
 */
function ExternalBanner({
  campaign,
  href,
  position,
}: {
  campaign: LandingPartnerCampaign;
  href: string;
  position: number;
}) {
  const track = useLandingTracker();

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="focus-visible:outline-active-blue block focus-visible:outline-2 focus-visible:outline-offset-2"
      onClick={() =>
        track('public_partner_click', {
          immediate: true,
          entityType: 'organization',
          entityId: campaign.organizationId,
          section_key: LANDING_SECTION_KEYS.sponsorBand,
          ...(campaign.placement === null ? {} : { placement: campaign.placement }),
          position,
        })
      }
    >
      <Banner campaign={campaign} />
      <span className="sr-only">{frPublic.sponsorBand.externalHint}</span>
    </a>
  );
}

export function SponsorBand({ campaigns }: { campaigns: readonly LandingPartnerCampaign[] }) {
  const total = campaigns.length;
  const [current, setCurrent] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [suspended, setSuspended] = useState(false);

  /*
   * L'etat de depart est « le mouvement est permis » : c'est aussi l'etat du
   * rendu serveur, ce qui evite un saut de mise en page a l'hydratation pour
   * la grande majorite des visiteurs. Le reglage systeme est lu des le premier
   * effet, et suivi s'il change en cours de session.
   */
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  const scrolling = total > 1 && !reducedMotion && !suspended;
  /** Mouvement refuse : tous les bandeaux sont montres, aucun n'est perdu. */
  const showAll = total > 1 && reducedMotion;

  useEffect(() => {
    if (!scrolling) return undefined;
    const id = window.setInterval(() => setCurrent((index) => (index + 1) % total), BANNER_MS);
    return () => window.clearInterval(id);
  }, [scrolling, total]);

  if (total === 0) return null;

  const isCarousel = total > 1 && !reducedMotion;
  const active = campaigns[current];

  return (
    <section
      id={LANDING_ANCHORS.sponsorBand}
      aria-label={showAll ? frPublic.sponsorBand.staticLabel : frPublic.sponsorBand.label}
      {...(isCarousel ? { 'aria-roledescription': frPublic.sponsorBand.roleDescription } : {})}
      // `grid` uniquement en mode defilement : une seule cellule, tous les
      // bandeaux dedans, pour le fondu. Quand le mouvement est refuse, la
      // section redevient un bloc ordinaire et les bandeaux se suivent
      // verticalement — c'est tout l'interet de ce mode.
      className={`bg-surface w-full ${showAll ? '' : 'grid'}`}
      onFocusCapture={() => setSuspended(true)}
      onBlurCapture={() => setSuspended(false)}
    >
      {/*
        Titre invisible a l'ecran, present dans le document : la section garde
        une place dans le plan de la page et un nom pour les lecteurs d'ecran,
        sans afficher le moindre mot — ce qui est exactement la demande.
      */}
      <h2 className="sr-only">{frPublic.sponsorBand.label}</h2>

      {campaigns.map((campaign, index) => {
        /**
         * « Visible » au sens propre : le bandeau du moment, ou n'importe
         * lequel quand ils sont tous deroules. Les autres restent dans le
         * DOM, transparents — il faut donc les neutraliser a la main.
         */
        const visible = showAll || index === current;
        const route = campaign.target === null ? null : entityRoute(campaign.target);
        const resourceType =
          campaign.target === null ? undefined : entityResourceType(campaign.target.entityType);

        return (
          <div
            key={campaign.id}
            className={
              showAll ? '' : `${FADE} ${visible ? 'opacity-100' : 'pointer-events-none opacity-0'}`
            }
            {...(visible ? {} : { inert: true, 'aria-hidden': true })}
            {...(isCarousel
              ? {
                  // `as const` : le type JSX de `role` est une union de
                  // litteraux (`AriaRole`), pas `string`.
                  role: 'group' as const,
                  'aria-roledescription': frPublic.sponsorBand.slideRoleDescription,
                  'aria-label': t(frPublic.sponsorBand.position, {
                    index: index + 1,
                    total,
                  }),
                }
              : {})}
          >
            <ImpressionTracker
              eventType="public_partner_impression"
              entityType="organization"
              entityId={campaign.organizationId}
              placement={campaign.placement ?? undefined}
              sectionKey={LANDING_SECTION_KEYS.sponsorBand}
              position={index + 1}
              // Un bandeau transparent reste « intersectant » pour
              // IntersectionObserver : sans ce garde-fou, chaque partenaire
              // serait credite d'une impression des l'arrivee en bas de page,
              // qu'il ait ete montre ou non (ADDENDUM §51).
              active={visible}
            >
              {route !== null ? (
                <ProtectedLink
                  target={route}
                  resourceType={resourceType}
                  className="focus-visible:outline-active-blue block focus-visible:outline-2 focus-visible:outline-offset-2"
                  event="public_partner_click"
                  entityType="organization"
                  entityId={campaign.organizationId}
                  sectionKey={LANDING_SECTION_KEYS.sponsorBand}
                  placement={campaign.placement ?? undefined}
                  position={index + 1}
                >
                  <Banner campaign={campaign} />
                </ProtectedLink>
              ) : campaign.externalUrl !== null ? (
                <ExternalBanner
                  campaign={campaign}
                  href={campaign.externalUrl}
                  position={index + 1}
                />
              ) : (
                /* Bandeau sans cible : c'est un cas nominal depuis 0133. */
                <Banner campaign={campaign} />
              )}
            </ImpressionTracker>
          </div>
        );
      })}

      {/*
        Annonce du changement, uniquement quand le defilement est arrete par le
        focus. Annoncer un changement automatique toutes les sept secondes
        rendrait la page inutilisable au lecteur d'ecran ; et quand tous les
        bandeaux sont affiches, il n'y a rien a annoncer.
      */}
      {showAll || active === undefined ? null : (
        <p className="sr-only" aria-live={scrolling ? 'off' : 'polite'} aria-atomic="true">
          {t(frPublic.sponsorBand.position, { index: current + 1, total })} : {active.partnerName}
        </p>
      )}
    </section>
  );
}
