import type { ReactNode } from 'react';
import { EmptyState } from '@ise/ui-web';
import { fr, t } from '@/i18n/fr';
import { frPublic } from '@/i18n/public';
import { ROUTES } from '@/lib/routes';
import { entityResourceType, entityRoute } from '@/lib/public/entity-routes';
import { formatLongDate, joinMeta } from '@/lib/public/landing-format';
import {
  LANDING_SECTION_KEYS,
  type LandingEvent,
  type LandingFeaturedProfile,
  type LandingNews,
  type LandingOpportunity,
  type LandingSection,
} from '@/lib/public/landing-data';
import { LandingMediaImage } from '../LandingMediaImage';
import { ProtectedLink } from '../ProtectedLink';
import { LANDING_ANCHORS } from '../public-nav';
import { SectionShell } from './SectionShell';

/**
 * « A la une du reseau » (ADDENDUM §8, §11, §12, §13, §14).
 *
 * Les colonnes sont **fixes par type de contenu**, dans l'ordre des deux
 * maquettes : actualite, ISE du jour, evenement, opportunite. Deux raisons :
 *  - la maquette Desktop 1440 montre exactement une carte par type, et la
 *    maquette Mobile 375 les empile dans le meme ordre ;
 *  - chaque colonne porte l'ancre d'une entree de l'en-tete (§7). Une colonne
 *    presente meme vide garantit que « Actualites » ou « Evenements » ne
 *    pointent jamais dans le vide.
 *
 * Aucun titre, aucun nom, aucune date n'est ecrit ici : tout vient des
 * projections `get_landing_news / _events / _opportunities /
 * _featured_profile`.
 *
 * ECART ASSUME (ADDENDUM §10, regle 6). Les maquettes portent « Lire
 * l'actualite » et « Voir l'evenement ». Les ecrans membres correspondants
 * (ISE-092 a ISE-096) n'existent pas : `entityRoute()` renvoie donc `null`
 * pour `news` et `event`. La carte s'affiche **sans action**, avec la mention
 * honnete « Consultable depuis l'espace membre », plutot qu'avec un lien qui
 * conduirait a une 404 apres connexion.
 */

const CARD = 'flex h-full flex-col gap-3 rounded-lg border border-border bg-surface p-6 max-md:p-5';

const KICKER = 'text-overline font-semibold uppercase tracking-[0.08em]';

const CTA =
  'text-body-sm font-semibold text-primary transition-colors duration-150 ' +
  'hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-active-blue';

function Card({
  kicker,
  kickerClassName,
  title,
  titleClassName,
  highlight,
  meta,
  visual,
  children,
}: {
  kicker: string;
  kickerClassName?: string;
  title: string;
  /**
   * 0117 — permet de masquer visuellement le titre (`sr-only`) quand la
   * couverture le porte deja incruste, sans jamais le retirer du DOM.
   */
  titleClassName?: string;
  /** Accroche courte, mise en avant entre le titre et le meta (D-165). */
  highlight?: string | null;
  meta?: string | null;
  visual?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className={CARD}>
      {visual}
      <p className={`${KICKER} ${kickerClassName ?? 'text-primary'}`}>{kicker}</p>
      <h3 className={`text-body text-text-primary font-semibold ${titleClassName ?? ''}`}>
        {title}
      </h3>
      {highlight ? (
        <p className="text-body-sm text-ise-gold font-medium italic">{highlight}</p>
      ) : null}
      {meta ? <p className="text-body-sm text-text-secondary">{meta}</p> : null}
      <div className="mt-auto pt-4">{children}</div>
    </article>
  );
}

/**
 * Boite a rapport d'aspect fixe. La hauteur est connue du navigateur des la
 * premiere passe de mise en page, avant meme que l'URL de l'image soit
 * resolue : c'est ce qui garantit un CLS nul (MASTER PROMPT §58), y compris
 * quand l'image met du temps a arriver ou n'arrive jamais.
 */
function MediaFrame({ children }: { children: ReactNode }) {
  return (
    <div className="bg-surface-muted rounded-base relative aspect-[16/9] w-full overflow-hidden">
      {children}
    </div>
  );
}

/** Colonne sans contenu : la place est tenue, rien n'est invente. */
function PlaceholderCard({ kicker, message }: { kicker: string; message: string }) {
  return (
    <article
      className={`${CARD} border-dashed`}
      // Un etat vide n'est pas une carte de contenu : il ne doit pas etre
      // annonce comme telle par un lecteur d'ecran.
    >
      <p className={`${KICKER} text-text-muted`}>{kicker}</p>
      <p className="text-body-sm text-text-muted">{message}</p>
    </article>
  );
}

function NoAction() {
  return <p className="text-caption text-text-muted">{frPublic.cards.availableAfterSignIn}</p>;
}

/**
 * 0117 — quand la couverture porte deja un titre incruste (affiche), le
 * titre affiche normalement sous l'image serait un doublon visuel : il est
 * alors masque avec `sr-only` (jamais retire du DOM, pour l'accessibilite
 * et le SEO), le kicker et le meta restant visibles a l'identique.
 */
function NewsCard({ item }: { item: LandingNews }) {
  const meta = joinMeta([item.summary, formatLongDate(item.publishedAt)]);
  return (
    <Card
      kicker={frPublic.kickers.news}
      title={item.title}
      {...(item.coverHasText ? { titleClassName: 'sr-only' } : {})}
      meta={meta}
      visual={
        item.cover === null ? null : (
          <MediaFrame>
            <LandingMediaImage
              media={item.cover}
              sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 260px"
              className="object-cover"
            />
          </MediaFrame>
        )
      }
    >
      <NoAction />
    </Card>
  );
}

function EventCard({ item }: { item: LandingEvent }) {
  const meta = joinMeta([item.city, formatLongDate(item.startsAt, item.timezone)]);
  return (
    <Card
      kicker={frPublic.kickers.event}
      title={item.title}
      meta={meta}
      visual={
        item.image === null ? null : (
          <MediaFrame>
            <LandingMediaImage
              media={item.image}
              sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 260px"
              className="object-cover"
            />
          </MediaFrame>
        )
      }
    >
      <NoAction />
    </Card>
  );
}

function OpportunityCard({ item }: { item: LandingOpportunity }) {
  const meta = joinMeta([
    item.organization,
    item.city,
    item.remoteAllowed ? frPublic.cards.remote : null,
  ]);
  const route = entityRoute(item.target);

  return (
    <Card
      kicker={frPublic.kickers.opportunity}
      title={item.title}
      meta={meta}
      visual={
        item.image === null ? null : (
          <MediaFrame>
            <LandingMediaImage
              media={item.image}
              sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 260px"
              className="object-cover"
            />
          </MediaFrame>
        )
      }
    >
      {route === null ? (
        <NoAction />
      ) : (
        <ProtectedLink
          target={route}
          resourceType={entityResourceType('opportunity')}
          className={CTA}
          event="public_content_click"
          entityType="opportunity"
          entityId={item.id}
          sectionKey={LANDING_SECTION_KEYS.opportunities}
          contentType="opportunity"
        >
          {frPublic.cards.seeOpportunity} <span aria-hidden="true">→</span>
        </ProtectedLink>
      )}
    </Card>
  );
}

/**
 * Monogramme de l'« ISE du jour » — D-135.
 *
 * PAS DE PHOTOGRAPHIE, ET C'EST UN CHOIX, PAS UN MANQUE.
 * Les avatars vivent dans le bucket prive `avatars` et y restent. Publier une
 * copie d'une photographie dans le bucket public exigerait un consentement
 * portant precisement sur cet acte ; `allow_public_feature` consent a la
 * parution d'un teaser textuel, pas a cela (MASTER PROMPT §47). Depuis 0068,
 * la projection ne descend meme plus `avatar_path`.
 *
 * Les initiales sont calculees a partir du seul `display_name` deja public.
 * `aria-hidden` : le nom complet est affiche juste a cote, repeter « AM » au
 * lecteur d'ecran n'apporterait rien.
 */
function initials(displayName: string): string {
  const parts = displayName
    .split(/[\s'’-]+/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const letters = [parts[0], parts.length > 1 ? parts[parts.length - 1] : undefined]
    .filter((part): part is string => part !== undefined)
    .map((part) => [...part][0] ?? '')
    .join('');
  return letters.toLocaleUpperCase('fr-FR');
}

function ProfileMonogram({ displayName }: { displayName: string }) {
  return (
    <span
      aria-hidden="true"
      className="bg-deep-navy text-text-inverse text-body-sm flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full font-bold"
    >
      {initials(displayName)}
    </span>
  );
}

/**
 * ADDENDUM §11, §21, §45 ; D-165 — « ISE du jour ».
 *
 * Seuls les champs de la liste blanche de `LandingFeaturedProfile` sont
 * rendus : nom affichable, promotion, poste, organisation, resume public,
 * jusqu'a trois domaines d'expertise, et desormais un visuel editorial et
 * une accroche (D-165). Le courriel, le telephone, le score de completude et
 * le chemin d'avatar ne traversent meme pas le parseur.
 *
 * `item.photo` n'est JAMAIS l'avatar prive du membre (D-135, inchangee) :
 * c'est un media de la mediatheque PUBLIQUE choisi par l'admin pour cette
 * mise en avant. Quand l'admin n'en a choisi aucun, le monogramme habituel
 * reprend sa place — le composant n'a jamais besoin de deviner.
 */
function FeaturedProfileCard({ item }: { item: LandingFeaturedProfile }) {
  const promotion =
    item.promotionName ??
    (item.promotionYear === null
      ? null
      : t(frPublic.cards.promotion, { year: item.promotionYear }));
  const meta = joinMeta([
    promotion,
    item.currentPosition,
    item.organization,
    item.expertiseAreas.length > 0 ? item.expertiseAreas.join(', ') : null,
  ]);
  const route = entityRoute(item.target);

  return (
    <Card
      kicker={frPublic.kickers.featuredProfile}
      kickerClassName="text-ise-gold"
      title={item.displayName}
      highlight={item.tagline}
      meta={joinMeta([meta, item.summary], ' — ')}
      visual={
        item.photo === null ? (
          <ProfileMonogram displayName={item.displayName} />
        ) : (
          <MediaFrame>
            <LandingMediaImage
              media={item.photo}
              sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 260px"
              className="object-cover"
            />
          </MediaFrame>
        )
      }
    >
      {route === null ? (
        <NoAction />
      ) : (
        <ProtectedLink
          target={route}
          resourceType={entityResourceType('profile')}
          className={CTA}
          event="public_content_click"
          entityType="profile"
          entityId={item.profileId}
          sectionKey={LANDING_SECTION_KEYS.featuredProfile}
          contentType="profile"
        >
          {frPublic.cards.seeProfile} <span aria-hidden="true">→</span>
        </ProtectedLink>
      )}
    </Card>
  );
}

/**
 * ADDENDUM §21 — repli editorial de l'« ISE du jour ».
 *
 * Aucun profil eligible aujourd'hui : la colonne n'affiche ni identite
 * inventee, ni carte vide. Elle propose ce qui a du sens a cet endroit,
 * reclamer son profil, et rien d'autre.
 */
function FeaturedProfileFallback({ degraded }: { degraded: boolean }) {
  return (
    <article className={`${CARD} border-dashed`}>
      <p className={`${KICKER} text-ise-gold`}>{frPublic.kickers.featuredProfile}</p>
      <p className="text-body-sm text-text-secondary">
        {degraded ? frPublic.featuredProfile.unavailable : frPublic.featuredProfile.fallbackTitle}
      </p>
      {degraded ? null : (
        <>
          <p className="text-caption text-text-muted">{frPublic.featuredProfile.fallbackBody}</p>
          <div className="mt-auto pt-4">
            <ProtectedLink
              target={ROUTES.claimSearch}
              resourceType="profil"
              className={CTA}
              event="public_claim_profile_click"
              sectionKey={LANDING_SECTION_KEYS.featuredProfile}
            >
              {frPublic.featuredProfile.fallbackCta} <span aria-hidden="true">→</span>
            </ProtectedLink>
          </div>
        </>
      )}
    </article>
  );
}

export interface HighlightsSectionProps {
  news: LandingSection<LandingNews>;
  featuredProfile: LandingSection<LandingFeaturedProfile>;
  events: LandingSection<LandingEvent>;
  opportunities: LandingSection<LandingOpportunity>;
  title?: string | undefined;
}

export function HighlightsSection({
  news,
  featuredProfile,
  events,
  opportunities,
  title,
}: HighlightsSectionProps) {
  const newsItem = news.items[0];
  const eventItem = events.items[0];
  const opportunityItem = opportunities.items[0];
  const profileItem = featuredProfile.items[0];

  const nothingAtAll =
    newsItem === undefined &&
    eventItem === undefined &&
    opportunityItem === undefined &&
    profileItem === undefined;

  /** ADDENDUM §47 : une projection en panne se dit, elle ne se devine pas. */
  const emptyMessage = (section: LandingSection<unknown>, fallback: string): string =>
    section.status === 'indisponible' ? frPublic.degraded.sectionUnavailable : fallback;

  return (
    <SectionShell id={LANDING_ANCHORS.highlights} title={title ?? fr.public.highlights.title}>
      {nothingAtAll ? (
        <>
          <EmptyState
            title={fr.public.highlights.emptyTitle}
            description={fr.public.highlights.emptyBody}
          />
          {/*
            Les ancres de l'en-tete doivent exister meme sans contenu :
            sinon « Actualites » ne menerait nulle part.
          */}
          {[
            LANDING_ANCHORS.news,
            LANDING_ANCHORS.featuredProfile,
            LANDING_ANCHORS.events,
            LANDING_ANCHORS.opportunities,
          ].map((anchor) => (
            <span key={anchor} id={anchor} className="sr-only" />
          ))}
        </>
      ) : (
        <ul className="grid grid-cols-4 gap-6 max-lg:grid-cols-2 max-md:grid-cols-1 max-md:gap-5">
          <li id={LANDING_ANCHORS.news}>
            {newsItem ? (
              <NewsCard item={newsItem} />
            ) : (
              <PlaceholderCard
                kicker={frPublic.kickers.news}
                message={emptyMessage(news, frPublic.news.emptyTitle)}
              />
            )}
          </li>
          <li id={LANDING_ANCHORS.featuredProfile}>
            {profileItem ? (
              <FeaturedProfileCard item={profileItem} />
            ) : (
              <FeaturedProfileFallback degraded={featuredProfile.status === 'indisponible'} />
            )}
          </li>
          <li id={LANDING_ANCHORS.events}>
            {eventItem ? (
              <EventCard item={eventItem} />
            ) : (
              <PlaceholderCard
                kicker={frPublic.kickers.event}
                message={emptyMessage(events, frPublic.events.emptyTitle)}
              />
            )}
          </li>
          <li id={LANDING_ANCHORS.opportunities}>
            {opportunityItem ? (
              <OpportunityCard item={opportunityItem} />
            ) : (
              <PlaceholderCard
                kicker={frPublic.kickers.opportunity}
                message={emptyMessage(opportunities, frPublic.opportunities.emptyTitle)}
              />
            )}
          </li>
        </ul>
      )}
    </SectionShell>
  );
}
