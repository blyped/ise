'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { cx } from '@ise/ui-web';
import { fr, t } from '@/i18n/fr';
import { frPublic } from '@/i18n/public';
import { entityResourceType, entityRoute } from '@/lib/public/entity-routes';
import { LANDING_SECTION_KEYS, type LandingSlide } from '@/lib/public/landing-data';
import { LandingMediaImage } from './LandingMediaImage';
import { ProtectedLink } from './ProtectedLink';
import { ImpressionTracker } from './analytics/ImpressionTracker';
import { LANDING_ANCHORS } from './public-nav';

const AUTOPLAY_MS = 7000;

const CONTROL =
  'inline-flex h-[36px] w-[36px] items-center justify-center rounded-full border ' +
  'border-white/30 bg-white/10 text-text-inverse transition-colors duration-150 ' +
  'hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-white';

function Arrow({ direction }: { direction: 'previous' | 'next' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d={direction === 'previous' ? 'M10 3 5 8l5 5' : 'M6 3l5 5-5 5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PlayPauseIcon({ playing }: { playing: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      {playing ? (
        <path d="M4 2h2v10H4zM8 2h2v10H8z" fill="currentColor" />
      ) : (
        <path d="M4 2l8 5-8 5z" fill="currentColor" />
      )}
    </svg>
  );
}

/**
 * ADDENDUM §9 et §52 — Carrousel de PUB-001.
 *
 * Choix d'accessibilite :
 *  - `aria-roledescription="carousel"` sur la region, `"diapositive"` sur
 *    chaque groupe, comme le demande le motif APG ;
 *  - les diapositives non affichees portent `hidden` : elles sortent de
 *    l'ordre de tabulation, leurs liens ne sont donc jamais atteignables au
 *    clavier « dans le vide » ;
 *  - **sans JavaScript, la premiere diapositive s'affiche** : l'etat initial
 *    du rendu serveur est deja l'etat « diapositive 1 visible ». Le defilement
 *    automatique, lui, n'existe qu'apres hydratation ;
 *  - `prefers-reduced-motion: reduce` empeche le demarrage du defilement et
 *    l'arrete s'il est change en cours de session ;
 *  - le defilement s'interrompt au survol et au focus clavier ;
 *  - la region d'annonce passe en `aria-live="polite"` uniquement quand le
 *    defilement est arrete : annoncer un changement automatique toutes les
 *    sept secondes rendrait la page inutilisable au lecteur d'ecran.
 */
export function LandingCarousel({ slides }: { slides: readonly LandingSlide[] }) {
  const total = slides.length;
  const [current, setCurrent] = useState(0);
  const [autoplayAllowed, setAutoplayAllowed] = useState(false);
  const [playRequested, setPlayRequested] = useState(true);
  const [suspended, setSuspended] = useState(false);

  const playing = autoplayAllowed && playRequested && !suspended && total > 1;

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setAutoplayAllowed(!query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!playing) return undefined;
    const id = window.setInterval(() => setCurrent((index) => (index + 1) % total), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [playing, total]);

  const goTo = useCallback(
    (index: number) => setCurrent(((index % total) + total) % total),
    [total],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(current - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(current + 1);
      }
    },
    [current, goTo],
  );

  const activeSlide = slides[current];
  const announcement = useMemo(() => {
    if (!activeSlide) return '';
    const position = t(fr.public.carousel.position, { index: current + 1, total });
    return `${position} : ${activeSlide.title}`;
  }, [activeSlide, current, total]);

  if (total === 0) return null;

  return (
    <section
      id={LANDING_ANCHORS.carousel}
      aria-roledescription={fr.public.carousel.roleDescription}
      aria-label={fr.public.carousel.label}
      // Hero pleine largeur, pleine hauteur d'ecran sous le menu (2026-08-12) :
      // plus d'arrondi ni de gouttiere, la hauteur vise le viewport moins la
      // barre superieure collante.
      className="bg-deep-navy relative w-full overflow-hidden"
      onKeyDown={onKeyDown}
      onMouseEnter={() => setSuspended(true)}
      onMouseLeave={() => setSuspended(false)}
      onFocusCapture={() => setSuspended(true)}
      onBlurCapture={() => setSuspended(false)}
    >
      {slides.map((slide, index) => {
        const route = slide.target === null ? null : entityRoute(slide.target);
        const resourceType =
          slide.target === null ? undefined : entityResourceType(slide.target.entityType);
        // Le sur-titre est un libelle, pas une donnee : la base descend un code
        // (`event`, `news`...), l'i18n en donne la forme affichable.
        const kicker =
          slide.contentType === null ? null : (frPublic.contentTypes[slide.contentType] ?? null);
        // La direction artistique mobile n'existe que si le CMS a publie un
        // second visuel. Sans lui, une seule image est demandee au reseau.
        const hasMobileVariant = slide.mobileMedia !== null;
        // 0109 — options d'affichage par slide. Le voile est un choix
        // editorial independant ; les textes sont sur l'image, dessous, ou
        // absents. Une slide sponsorisee montre TOUJOURS sa mention (§26),
        // meme quand les autres textes sont masques.
        const dimClass = slide.dimMedia ? 'opacity-40' : '';
        const showTexts = slide.textPosition !== 'hidden';
        const overlayTexts = slide.textPosition === 'overlay';

        const textBlock = (
          <div
            className={`relative flex max-w-[640px] flex-col gap-5 px-10 max-md:px-6 ${
              overlayTexts ? 'py-11 max-md:py-8' : 'py-8 max-md:py-6'
            }`}
          >
            {showTexts && kicker !== null ? (
              <p className="text-overline text-text-inverse w-fit rounded-full bg-white/10 px-5 py-1 font-semibold uppercase tracking-[0.08em]">
                {kicker}
              </p>
            ) : null}

            {showTexts ? (
              <h2 className="text-display text-text-inverse max-md:text-h1 font-bold">
                {slide.title}
              </h2>
            ) : null}

            {showTexts && slide.subtitle ? (
              <p className="text-body-sm text-[#C7D2E5]">{slide.subtitle}</p>
            ) : null}
            {showTexts && slide.description ? (
              <p className="text-body-sm max-w-[46ch] text-[#C7D2E5]">{slide.description}</p>
            ) : null}

            {slide.sponsored && slide.sponsoredLabel !== null ? (
              <ImpressionTracker
                eventType="public_partner_impression"
                entityType={slide.target?.entityType ?? null}
                entityId={slide.target?.entityId ?? null}
                sectionKey={LANDING_SECTION_KEYS.carousel}
                position={index + 1}
              >
                <p className="text-caption text-ise-gold font-semibold">{slide.sponsoredLabel}</p>
              </ImpressionTracker>
            ) : null}

            {showTexts && route !== null && slide.ctaLabel !== null ? (
              <ProtectedLink
                target={route}
                resourceType={resourceType}
                className="rounded-base bg-ise-gold text-body-sm text-deep-navy mt-4 inline-flex min-h-[44px] w-fit items-center justify-center px-7 font-semibold transition-colors duration-150 hover:bg-[#C79232] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                event={slide.sponsored ? 'public_partner_click' : 'public_content_click'}
                entityType={slide.target?.entityType ?? null}
                entityId={slide.target?.entityId ?? null}
                sectionKey={LANDING_SECTION_KEYS.carousel}
                contentType={slide.contentType ?? undefined}
                position={index + 1}
              >
                {slide.ctaLabel}
              </ProtectedLink>
            ) : null}
          </div>
        );

        return (
          <div
            key={slide.id}
            role="group"
            aria-roledescription={fr.public.carousel.slideRoleDescription}
            aria-label={t(fr.public.carousel.position, { index: index + 1, total })}
            hidden={index !== current}
            className={`bg-deep-navy relative flex min-h-[calc(100dvh-var(--layout-topbar))] flex-col max-md:min-h-[calc(100dvh-var(--layout-topbar))] ${
              overlayTexts ? 'justify-center' : 'justify-end'
            }`}
          >
            {/*
              ADDENDUM §52 — image de fond.

              Le bucket `landing-media` est public depuis 0068 : la
              diapositive porte donc son visuel reel quand le CMS en a
              publie un. Trois precautions :

               - le conteneur a une hauteur minimale FIXE et l'image est en
                 `fill` : la place est reservee avant le chargement, aucun
                 decalage n'est possible (§58) ;
               - la premiere diapositive est en `priority` (elle est
                 au-dessus de la ligne de flottaison, c'est l'element LCP) ;
                 les suivantes sont en `loading="lazy"` ;
               - direction artistique : quand le CMS publie un visuel mobile
                 distinct, les deux images sont rendues et l'affichage est
                 arbitre par les points de rupture, comme le recommande la
                 documentation de `next/image`. Sans visuel mobile, une
                 seule image est demandee.

              `alt` vient de `cms_media_assets.alt_text`. L'image etant
              purement decorative ici (le titre porte l'information), le
              texte est neanmoins fourni : c'est le CMS qui decide, et il
              impose une alternative.
            */}
            <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
              <LandingMediaImage
                media={slide.media}
                sizes="100vw"
                priority={index === 0}
                className={`object-cover ${dimClass} ${hasMobileVariant ? 'max-md:hidden' : ''}`}
              />
              {hasMobileVariant ? (
                <LandingMediaImage
                  media={slide.mobileMedia}
                  sizes="100vw"
                  priority={index === 0}
                  className={`object-cover ${dimClass} md:hidden`}
                />
              ) : null}
            </div>

            {showTexts || (slide.sponsored && slide.sponsoredLabel !== null)
              ? overlayTexts
                ? textBlock
                : // « Sous l'image » : bande bleu nuit opaque, ancree en bas du hero.
                  <div className="bg-deep-navy/95 relative w-full">{textBlock}</div>
              : null}
          </div>
        );
      })}

      {/* Hero plein ecran : les commandes flottent en bas a droite, pour ne
          pas chevaucher les textes ancres a gauche. */}
      <div className="absolute bottom-6 right-10 z-10 flex items-center gap-5 max-md:right-6">
        <button type="button" className={CONTROL} onClick={() => goTo(current - 1)}>
          <Arrow direction="previous" />
          <span className="sr-only">{fr.public.carousel.previous}</span>
        </button>
        <button type="button" className={CONTROL} onClick={() => goTo(current + 1)}>
          <Arrow direction="next" />
          <span className="sr-only">{fr.public.carousel.next}</span>
        </button>
        <button
          type="button"
          className={CONTROL}
          aria-pressed={!playRequested}
          onClick={() => setPlayRequested((value) => !value)}
        >
          <PlayPauseIcon playing={playing} />
          <span className="sr-only">
            {playing ? fr.public.carousel.pause : fr.public.carousel.play}
          </span>
        </button>

        <ul className="flex items-center gap-3">
          {slides.map((slide, index) => (
            <li key={slide.id}>
              <button
                type="button"
                aria-current={index === current}
                onClick={() => goTo(index)}
                className={cx(
                  'block h-[10px] w-[10px] rounded-full border border-white/50 transition-colors duration-150',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
                  index === current ? 'bg-text-inverse' : 'bg-transparent hover:bg-white/40',
                )}
              >
                <span className="sr-only">{t(fr.public.carousel.goTo, { index: index + 1 })}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <p className="sr-only" aria-live={playing ? 'off' : 'polite'} aria-atomic="true">
        {announcement}
      </p>
    </section>
  );
}
