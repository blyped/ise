import * as React from 'react';
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type {
  LandingEvent,
  LandingFeaturedProfile,
  LandingNews,
  LandingOpportunity,
  LandingSlide,
} from './landing-data';

/*
 * `apps/web/tsconfig.json` compile le JSX en `jsx: "preserve"` — Next s'en
 * charge en temps normal. Hors de Next, esbuild retombe sur la fabrique
 * classique `React.createElement`, qui suppose un `React` global. On le
 * fournit ici plutot que de modifier `vitest.config.ts`, un fichier partage
 * avec les autres lots en cours.
 */
(globalThis as typeof globalThis & { React?: typeof React }).React = React;

/**
 * Tests de rendu de PUB-001.
 *
 * Deux interdits y sont verifies **sur le HTML reellement produit**, pas sur
 * une intention :
 *
 *  - ADDENDUM §23 — les nombres des maquettes (1842, 37, 29, 126) sont
 *    illustratifs. Ils ne doivent apparaitre nulle part, y compris quand la
 *    base renvoie de vrais chiffres ;
 *
 *  - ADDENDUM §45 — le teaser « ISE du jour » est public. Aucun courriel,
 *    aucun telephone, aucun score, aucun chemin de stockage ne doit atteindre
 *    le client, meme si la projection venait a en descendre un jour.
 */

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) =>
    h('a', { href, ...rest }, children as never),
}));

/*
 * `next/image` a besoin de la configuration injectee par le build de Next.
 * Hors de Next, on le remplace par un `img` qui conserve exactement les trois
 * attributs que ces tests mesurent : la source, l'alternative textuelle et le
 * mode de chargement. Le reste (jeu de sources, optimisation) est le travail
 * de Next, pas celui de ce composant.
 */
vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    priority,
    loading,
  }: {
    src: string;
    alt: string;
    priority?: boolean;
    loading?: string;
  }) => h('img', { src, alt, loading: priority === true ? 'eager' : (loading ?? 'lazy') }),
}));

/* `landingMediaUrl()` lit l'environnement public, paresseusement. */
const TEST_SUPABASE_URL = 'https://projet-test.supabase.co';
process.env['NEXT_PUBLIC_SUPABASE_URL'] = TEST_SUPABASE_URL;
process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = 'cle-anonyme-de-test-suffisamment-longue';
process.env['NEXT_PUBLIC_SITE_URL'] = 'https://competences-ise.test';
process.env['NEXT_PUBLIC_ENVIRONMENT'] = 'local';

/** Media tel que `private.landing_media()` le projette (0068). */
const MEDIA = {
  bucket: 'landing-media',
  path: 'carousel/2026/08/rencontre.webp',
  alt_text: 'Salle plénière de la rencontre annuelle',
  credit: null,
  width: 1440,
  height: 810,
};

// `landing-analytics` est une Server Action : elle lit les cookies. Le rendu
// statique n'a pas de requete, et le test ne mesure pas l'analytique.
vi.mock('./landing-analytics', () => ({
  recordPublicLandingEvent: async () => false,
  recordPublicLandingEvents: async () => 0,
}));

const { CarouselSection } = await import('@/app/(public)/_components/sections/CarouselSection');
const { HighlightsSection } = await import('@/app/(public)/_components/sections/HighlightsSection');
const { NetworkSection } = await import('@/app/(public)/_components/sections/NetworkSection');
const { ExpertisesSection } = await import('@/app/(public)/_components/sections/ExpertisesSection');
const { PartnersSection } = await import('@/app/(public)/_components/sections/PartnersSection');
const { FinalCtaSection } = await import('@/app/(public)/_components/sections/FinalCtaSection');
const {
  featuredProfileSchema,
  parseStats,
  partnerSchema,
  slideSchema,
  expertiseSchema,
  newsSchema,
  eventSchema,
  opportunitySchema,
  pillarSchema,
} = await import('./landing-data');

/** Texte reellement lisible a l'ecran, balises et attributs retires. */
function visibleText(element: ReactElement): string {
  return renderToStaticMarkup(element)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#x27;|&quot;|&amp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Chiffres des maquettes. Ils ne sont mesures par rien : ils sont interdits. */
const MOCKUP_FIGURES = ['1842', '1 842', '1 842', '1 842', '37', '29', '126'];

function expectNoMockupFigure(text: string): void {
  const tokens = text.split(/[^0-9  ]+/).filter((token) => token.length > 0);
  for (const figure of MOCKUP_FIGURES) {
    expect(tokens, `le nombre « ${figure} » de la maquette apparaît dans le rendu`).not.toContain(
      figure,
    );
  }
}

const OK = <TItem>(items: readonly TItem[]) => ({ status: 'ok' as const, items });
/** D-163 — le carrousel porte en plus un reglage de duree ; 7s = repli par defaut. */
const CAROUSEL_OK = (items: readonly LandingSlide[]) => ({ ...OK(items), autoplaySeconds: 7 });
const DOWN = <TItem>() => ({
  status: 'indisponible' as const,
  items: [] as readonly TItem[],
  reason: 'erreur:57014',
});

const NEWS = newsSchema.parse({
  id: '11111111-2222-4333-8444-555555555555',
  title: 'Transformation économique africaine',
  slug: 'transformation',
  summary: 'Un résumé public.',
  category_code: 'analyse',
  published_at: '2026-07-01T08:00:00+00:00',
  is_featured: true,
  is_pinned: false,
});

const EVENT = eventSchema.parse({
  id: '22222222-3333-4444-8555-666666666666',
  title: 'Webinaire Data & politiques publiques',
  slug: 'webinaire',
  event_type_code: 'webinar',
  starts_at: '2026-09-24T14:00:00+00:00',
  ends_at: null,
  timezone: 'Africa/Abidjan',
  format: 'online',
  city: 'Abidjan',
  country_code: 'CI',
  is_pinned: false,
});

const OPPORTUNITY = opportunitySchema.parse({
  id: '33333333-4444-4555-8666-777777777777',
  title: 'Expert senior suivi-évaluation',
  opportunity_type: 'job',
  contract_type: 'cdi',
  sector: 'Santé',
  country_code: 'SN',
  city: 'Dakar',
  remote_allowed: false,
  deadline: null,
  organization: 'Institut régional',
  is_pinned: false,
});

/** Les 4 piliers tels que `get_landing_pillars()` (0114) les renvoie. */
const PILLARS = [
  { pillar_key: 'connecter', image: null, caption: null, link_target: 'search' },
  { pillar_key: 'entraider', image: null, caption: null, link_target: null },
  { pillar_key: 'collaborer', image: null, caption: null, link_target: null },
  { pillar_key: 'impacter', image: null, caption: null, link_target: null },
].map((row) => pillarSchema.parse(row));

/** Charge utile volontairement polluee de champs prives. */
const PRIVATE_PAYLOAD = {
  entity_type: 'profile',
  profile_id: '66666666-7777-4888-8999-aaaaaaaaaaaa',
  display_name: 'Aminata Mbaye',
  promotion: { id: 12, name: 'ISE 2008', graduation_year: 2008 },
  current_position: 'Économiste principale',
  organization: 'Institut régional',
  public_summary: 'Spécialiste des politiques publiques.',
  avatar_path: 'avatars/66666666-secret.png',
  expertise_areas: [{ id: 1, name: 'Statistique', slug: 'statistique' }],
  featured_date: '2026-08-08',
  selection_mode: 'automatic',
  email: 'aminata.mbaye@example.org',
  phone: '+221770000000',
  completeness_score: 87,
  internal_notes: 'note interne du moderateur',
};

const PROFILE = featuredProfileSchema.parse(PRIVATE_PAYLOAD);

const EXPERTISES = [1, 2, 3].map((id) =>
  expertiseSchema.parse({
    id,
    entity_type: 'expertise_area',
    name: `Domaine ${'ABC'[id - 1]}`,
    slug: `domaine-${id}`,
    description: null,
    profile_count: 0,
  }),
);

const CAMPAIGN = partnerSchema.parse({
  id: '44444444-5555-4666-8777-888888888888',
  organization_id: '55555555-6666-4777-8888-999999999999',
  organization_name: 'Banque régionale',
  campaign_name: null,
  placement: 'partners_block',
  title: 'Votre organisation souhaite toucher le réseau ISE ?',
  description: 'Visibilité clairement identifiée.',
  cta_label: 'Devenir partenaire',
  target_entity_type: null,
  target_entity_id: null,
  target_url: null,
  sponsored_label: null,
  media: null,
});

function fullPage(statsPayload: unknown): ReactElement {
  return h(
    'div',
    null,
    h(CarouselSection, {
      section: CAROUSEL_OK([
        slideSchema.parse({
          id: '2b0a4a1e-3f7a-4c39-9b5f-1d2e3f4a5b6c',
          title: 'Rencontre annuelle des ISE',
          subtitle: 'Abidjan',
          description: 'Une journée pour connecter les promotions.',
          content_type: 'event',
          entity_type: 'event',
          entity_id: '9f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f',
          cta_label: 'Découvrir l’événement',
          priority: 10,
          media: null,
          mobile_media: null,
          is_sponsored: false,
          sponsored_label: null,
        }),
      ]),
    }),
    h(HighlightsSection, {
      news: OK([NEWS]),
      featuredProfile: OK([PROFILE]),
      events: OK([EVENT]),
      opportunities: OK([OPPORTUNITY]),
    }),
    h(NetworkSection, { stats: parseStats(statsPayload), pillars: OK(PILLARS) }),
    h(ExpertisesSection, { section: OK(EXPERTISES) }),
    h(PartnersSection, { section: OK([CAMPAIGN]) }),
    h(FinalCtaSection, null),
  );
}

describe('ADDENDUM §23 — aucun nombre de maquette dans le rendu', () => {
  it('avec de vrais chiffres, différents de ceux des maquettes', () => {
    const text = visibleText(
      fullPage({
        profiles: { value: 5, source: 'profils' },
        promotions: { value: 2, source: 'promotions' },
        countries: { value: 3, source: 'pays' },
        organizations: { value: 4, source: 'organisations' },
        computed_at: '2026-08-08T13:55:17.172922+00:00',
      }),
    );
    expect(text).toContain('5');
    expectNoMockupFigure(text);
  });

  it('avec la réponse réelle de la base : zéro partout, donc aucun chiffre affiché', () => {
    const element = fullPage({
      profiles: { value: 0, source: 'profils' },
      promotions: { value: 0, source: 'promotions' },
      countries: { value: 0, source: 'pays' },
      organizations: { value: 0, source: 'organisations' },
      computed_at: '2026-08-08T13:55:17.172922+00:00',
    });
    const text = visibleText(element);
    expectNoMockupFigure(text);
    // Le bloc est remplace par une phrase, pas par quatre zeros.
    expect(text).toContain('Les chiffres du réseau seront publiés');
    expect(text).not.toMatch(/\b0\b/);
  });

  it('avec des chiffres indisponibles', () => {
    expectNoMockupFigure(visibleText(fullPage(null)));
  });
});

describe('ADDENDUM §45 — aucune donnée privée dans le teaser « ISE du jour »', () => {
  const markup = renderToStaticMarkup(
    h(HighlightsSection, {
      news: OK([NEWS]),
      featuredProfile: OK([PROFILE]),
      events: OK([EVENT]),
      opportunities: OK([OPPORTUNITY]),
    }),
  );

  it.each([
    ['un courriel', 'aminata.mbaye@example.org'],
    ['un fragment de courriel', '@example.org'],
    ['un téléphone', '+221770000000'],
    ['un chemin de stockage privé', 'avatars/'],
    ['une note interne', 'note interne'],
  ])('n’expose pas %s', (_label, forbidden) => {
    expect(markup).not.toContain(forbidden);
  });

  it('n’expose pas de score de complétude', () => {
    expect(markup).not.toContain('completeness');
    expect(visibleText(h('div', null, h('span', null, markup)))).not.toMatch(/\b87\b/);
  });

  it('affiche bien ce qui est public', () => {
    expect(markup).toContain('Aminata Mbaye');
    expect(markup).toContain('ISE 2008');
    expect(markup).toContain('Économiste principale');
  });
});

describe('ADDENDUM §26 — transparence des contenus commerciaux', () => {
  it('affiche la mention en texte, à côté du nom du partenaire', () => {
    const text = visibleText(h(PartnersSection, { section: OK([CAMPAIGN]) }));
    expect(text).toContain('Contenu partenaire');
    expect(text).toContain('Banque régionale');
  });

  it('affiche la mention même quand le CMS n’en publie aucune', () => {
    expect(CAMPAIGN.sponsoredLabel).toBe('Contenu partenaire');
  });

  it('porte la mention sur une diapositive commerciale du carrousel', () => {
    const sponsored = slideSchema.parse({
      id: '77777777-8888-4999-8aaa-bbbbbbbbbbbb',
      title: 'Offre partenaire',
      subtitle: null,
      description: null,
      content_type: 'news',
      entity_type: null,
      entity_id: null,
      cta_label: null,
      priority: 1,
      media: null,
      mobile_media: null,
      is_sponsored: true,
      sponsored_label: 'Sponsorisé',
    });
    expect(visibleText(h(CarouselSection, { section: CAROUSEL_OK([sponsored]) }))).toContain(
      'Sponsorisé',
    );
  });
});

describe('ADDENDUM §10 — jamais de lien mort', () => {
  it('une actualité s’affiche sans action, faute d’écran membre', () => {
    const markup = renderToStaticMarkup(
      h(HighlightsSection, {
        news: OK([NEWS]),
        featuredProfile: OK<LandingFeaturedProfile>([]),
        events: OK<LandingEvent>([]),
        opportunities: OK<LandingOpportunity>([]),
      }),
    );
    expect(markup).toContain('Transformation économique africaine');
    expect(markup).not.toContain('href="/actualites');
    expect(markup).toContain('Consultable depuis l');
  });

  it('une opportunité mène à son écran membre, via la connexion pour un visiteur', () => {
    const markup = renderToStaticMarkup(
      h(HighlightsSection, {
        news: OK<LandingNews>([]),
        featuredProfile: OK<LandingFeaturedProfile>([]),
        events: OK<LandingEvent>([]),
        opportunities: OK([OPPORTUNITY]),
      }),
    );
    expect(markup).toContain('redirectTo=%2Fopportunites%2F');
    expect(markup).toContain('resourceType=opportunite');
  });

  it('une pastille d’expertise mène à un critère de recherche réel', () => {
    const markup = renderToStaticMarkup(h(ExpertisesSection, { section: OK(EXPERTISES) }));
    expect(markup).toContain('redirectTo=%2Frechercher%2Fresultats%3Fq%3D');
    expect(markup).not.toContain('competences=');
  });
});

describe('ADDENDUM §47 — dégradation propre', () => {
  it('une section en panne le dit, sans casser les autres', () => {
    const text = visibleText(
      h(HighlightsSection, {
        news: DOWN<LandingNews>(),
        featuredProfile: OK([PROFILE]),
        events: OK([EVENT]),
        opportunities: OK([OPPORTUNITY]),
      }),
    );
    expect(text).toContain('momenténement indisponible');
    expect(text).toContain('Aminata Mbaye');
    expect(text).toContain('Webinaire Data');
  });

  it('§21 — sans ISE du jour, un repli éditorial, jamais une identité inventée', () => {
    const text = visibleText(
      h(HighlightsSection, {
        news: OK([NEWS]),
        featuredProfile: OK<LandingFeaturedProfile>([]),
        events: OK<LandingEvent>([]),
        opportunities: OK<LandingOpportunity>([]),
      }),
    );
    expect(text).toContain('ISE DU JOUR');
    expect(text).toContain('L’ISE du jour sera publié prochainement.');
    expect(text).toContain('Réclamer mon profil');
  });

  it('§21 — projection en panne : la colonne se tait au lieu de proposer une réclamation', () => {
    const text = visibleText(
      h(HighlightsSection, {
        news: OK([NEWS]),
        featuredProfile: DOWN<LandingFeaturedProfile>(),
        events: OK<LandingEvent>([]),
        opportunities: OK<LandingOpportunity>([]),
      }),
    );
    expect(text).toContain('La mise en avant du jour est momenténement indisponible.');
  });

  it('aucune campagne : un état vide honnête, pas un bloc fantôme', () => {
    const text = visibleText(h(PartnersSection, { section: OK([]) }));
    expect(text).toContain('Aucune campagne partenaire en cours.');
  });
});

/**
 * IMAGES DE LA VITRINE (migration 0068, ADDENDUM §52, MASTER PROMPT §58).
 *
 * Ce que ces tests mesurent sur le HTML REELLEMENT produit :
 *  - une balise `img` est emise des qu'un media publiable existe ;
 *  - son `alt` est celui de `cms_media_assets`, jamais un libelle fabrique ;
 *  - la premiere diapositive charge en `eager` (element LCP), les suivantes
 *    en `lazy` ;
 *  - un media sans alternative textuelle, ou dans un bucket prive, ne produit
 *    AUCUNE balise `img` — la mise en page reste entiere ;
 *  - l'« ISE du jour » n'affiche pas de photographie (D-135).
 */
describe('images — bucket public `landing-media`', () => {
  const slide = (overrides: Record<string, unknown>) =>
    slideSchema.parse({
      id: '2b0a4a1e-3f7a-4c39-9b5f-1d2e3f4a5b6c',
      title: 'Rencontre annuelle des ISE',
      subtitle: null,
      description: null,
      content_type: 'event',
      entity_type: null,
      entity_id: null,
      cta_label: null,
      priority: 10,
      media: null,
      mobile_media: null,
      is_sponsored: false,
      sponsored_label: null,
      ...overrides,
    });

  it('rend le visuel de la diapositive, avec l’alternative du CMS', () => {
    const markup = renderToStaticMarkup(
      h(CarouselSection, { section: CAROUSEL_OK([slide({ media: MEDIA })]) }),
    );
    expect(markup).toContain(
      `${TEST_SUPABASE_URL}/storage/v1/object/public/landing-media/carousel/2026/08/rencontre.webp`,
    );
    expect(markup).toContain('alt="Salle plénière de la rencontre annuelle"');
  });

  it('§58 — première diapositive en « eager », les suivantes en « lazy »', () => {
    const markup = renderToStaticMarkup(
      h(CarouselSection, {
        section: CAROUSEL_OK([
          slide({ id: 'aaaaaaaa-1111-4111-8111-111111111111', media: MEDIA }),
          slide({
            id: 'bbbbbbbb-2222-4222-8222-222222222222',
            media: { ...MEDIA, path: 'carousel/2026/08/seconde.webp' },
          }),
        ]),
      }),
    );
    expect(markup).toMatch(/rencontre\.webp[^>]*loading="eager"|loading="eager"[^>]*rencontre/);
    expect(markup).toContain('loading="lazy"');
  });

  it('§52 — un média sans alternative textuelle n’émet aucune balise img', () => {
    const markup = renderToStaticMarkup(
      h(CarouselSection, {
        section: CAROUSEL_OK([slide({ media: { ...MEDIA, alt_text: null } })]),
      }),
    );
    expect(markup).not.toContain('<img');
  });

  it('un média resté dans un bucket privé n’émet aucune balise img', () => {
    const markup = renderToStaticMarkup(
      h(CarouselSection, {
        section: CAROUSEL_OK([slide({ media: { ...MEDIA, bucket: 'public-assets' } })]),
      }),
    );
    expect(markup).not.toContain('<img');
    // La diapositive, elle, s'affiche normalement.
    expect(markup).toContain('Rencontre annuelle des ISE');
  });

  it('rend la couverture d’une actualité et le logo d’un partenaire', () => {
    const news = newsSchema.parse({
      id: '11111111-2222-4333-8444-555555555555',
      title: 'Transformation économique africaine',
      slug: 'transformation',
      summary: 'Un résumé public.',
      category_code: 'analyse',
      image: { ...MEDIA, path: 'news/2026/07/transformation.webp' },
      published_at: '2026-07-01T08:00:00+00:00',
      is_featured: true,
      is_pinned: false,
    });
    const newsMarkup = renderToStaticMarkup(
      h(HighlightsSection, {
        news: OK([news]),
        featuredProfile: OK<LandingFeaturedProfile>([]),
        events: OK<LandingEvent>([]),
        opportunities: OK<LandingOpportunity>([]),
      }),
    );
    expect(newsMarkup).toContain('/object/public/landing-media/news/2026/07/transformation.webp');
    expect(newsMarkup).toContain('loading="lazy"');

    const campaign = partnerSchema.parse({
      id: '44444444-5555-4666-8777-888888888888',
      organization_id: '55555555-6666-4777-8888-999999999999',
      organization_name: 'Banque régionale',
      organization_logo: { ...MEDIA, path: 'partners/2026/08/banque.png', alt_text: 'Logo Banque' },
      campaign_name: null,
      placement: 'partners_block',
      title: 'Votre organisation souhaite toucher le réseau ISE ?',
      description: null,
      cta_label: null,
      target_entity_type: null,
      target_entity_id: null,
      target_url: null,
      sponsored_label: null,
      media: null,
    });
    const partnerMarkup = renderToStaticMarkup(h(PartnersSection, { section: OK([campaign]) }));
    expect(partnerMarkup).toContain('/object/public/landing-media/partners/2026/08/banque.png');
    expect(partnerMarkup).toContain('alt="Logo Banque"');
  });

  it('une actualité sans couverture reste une carte entière', () => {
    const news = newsSchema.parse({
      id: '11111111-2222-4333-8444-555555555555',
      title: 'Transformation économique africaine',
      slug: 'transformation',
      summary: 'Un résumé public.',
      category_code: 'analyse',
      image: null,
      published_at: '2026-07-01T08:00:00+00:00',
      is_featured: true,
      is_pinned: false,
    });
    const markup = renderToStaticMarkup(
      h(HighlightsSection, {
        news: OK([news]),
        featuredProfile: OK<LandingFeaturedProfile>([]),
        events: OK<LandingEvent>([]),
        opportunities: OK<LandingOpportunity>([]),
      }),
    );
    expect(markup).not.toContain('<img');
    expect(markup).toContain('Transformation économique africaine');
  });

  /**
   * D-135. Le bucket `avatars` est prive et le reste : le teaser porte un
   * monogramme, pas une photographie, et aucune requete d'image n'est emise
   * pour l'« ISE du jour ».
   */
  it('D-135 — l’ISE du jour affiche un monogramme, jamais une photographie', () => {
    const markup = renderToStaticMarkup(
      h(HighlightsSection, {
        news: OK<LandingNews>([]),
        featuredProfile: OK([PROFILE]),
        events: OK<LandingEvent>([]),
        opportunities: OK<LandingOpportunity>([]),
      }),
    );
    expect(markup).not.toContain('<img');
    expect(markup).not.toContain('avatars/');
    expect(markup).toContain('>AM<');
    expect(markup).toContain('Aminata Mbaye');
  });

  /**
   * D-165 (migration 0112). Quand l'admin a choisi un visuel de la
   * mediatheque PUBLIQUE et redige une accroche, la carte les affiche tous
   * les deux — le monogramme s'efface alors devant la vraie image, mais
   * `avatar_path` (prive) n'a toujours aucun chemin pour atteindre le HTML.
   */
  it('D-165 — un visuel de médiathèque publique et son accroche s’affichent quand l’admin les a choisis', () => {
    const withShowcase = featuredProfileSchema.parse({
      ...PRIVATE_PAYLOAD,
      photo: MEDIA,
      tagline: 'Aminata Mbaye, l’ISE qui a réformé la statistique nationale.',
    });
    const markup = renderToStaticMarkup(
      h(HighlightsSection, {
        news: OK<LandingNews>([]),
        featuredProfile: OK([withShowcase]),
        events: OK<LandingEvent>([]),
        opportunities: OK<LandingOpportunity>([]),
      }),
    );
    expect(markup).toContain('<img');
    expect(markup).toContain(MEDIA.alt_text);
    expect(markup).not.toContain('avatars/');
    expect(markup).toContain('Aminata Mbaye, l’ISE qui a réformé la statistique nationale.');
  });

  /**
   * 0113. Même patron que le carrousel, les actualités et « ISE du jour » :
   * un visuel de la médiathèque publique, choisi par l'admin, s'affiche sur
   * la carte Événement et la carte Opportunité — absent par défaut, jamais
   * une image cassée.
   */
  it('0113 — un événement avec un visuel choisi affiche l’image, sans visuel il n’y a aucune balise img', () => {
    const withCover = eventSchema.parse({
      id: '22222222-3333-4444-8555-666666666666',
      title: 'Webinaire Data & politiques publiques',
      slug: 'webinaire',
      event_type_code: 'webinar',
      starts_at: '2026-09-24T14:00:00+00:00',
      ends_at: null,
      timezone: 'Africa/Abidjan',
      format: 'online',
      city: 'Abidjan',
      country_code: 'CI',
      image: MEDIA,
      is_pinned: false,
    });
    const markupWithCover = renderToStaticMarkup(
      h(HighlightsSection, {
        news: OK<LandingNews>([]),
        featuredProfile: OK<LandingFeaturedProfile>([]),
        events: OK([withCover]),
        opportunities: OK<LandingOpportunity>([]),
      }),
    );
    expect(markupWithCover).toContain('<img');
    expect(markupWithCover).toContain(MEDIA.alt_text);

    const markupWithoutCover = renderToStaticMarkup(
      h(HighlightsSection, {
        news: OK<LandingNews>([]),
        featuredProfile: OK<LandingFeaturedProfile>([]),
        events: OK([EVENT]),
        opportunities: OK<LandingOpportunity>([]),
      }),
    );
    expect(markupWithoutCover).not.toContain('<img');
    expect(markupWithoutCover).toContain('Webinaire Data');
  });

  it('0113 — une opportunité avec un visuel choisi affiche l’image, sans visuel il n’y a aucune balise img', () => {
    const withCover = opportunitySchema.parse({
      id: '33333333-4444-4555-8666-777777777777',
      title: 'Expert senior suivi-évaluation',
      opportunity_type: 'job',
      contract_type: 'cdi',
      sector: 'Santé',
      country_code: 'SN',
      city: 'Dakar',
      remote_allowed: false,
      deadline: null,
      organization: 'Institut régional',
      image: { ...MEDIA, path: 'opportunities/2026/08/poste.webp' },
      is_pinned: false,
    });
    const markupWithCover = renderToStaticMarkup(
      h(HighlightsSection, {
        news: OK<LandingNews>([]),
        featuredProfile: OK<LandingFeaturedProfile>([]),
        events: OK<LandingEvent>([]),
        opportunities: OK([withCover]),
      }),
    );
    expect(markupWithCover).toContain('<img');
    expect(markupWithCover).toContain('opportunities/2026/08/poste.webp');

    const markupWithoutCover = renderToStaticMarkup(
      h(HighlightsSection, {
        news: OK<LandingNews>([]),
        featuredProfile: OK<LandingFeaturedProfile>([]),
        events: OK<LandingEvent>([]),
        opportunities: OK([OPPORTUNITY]),
      }),
    );
    expect(markupWithoutCover).not.toContain('<img');
    expect(markupWithoutCover).toContain('Expert senior suivi-évaluation');
  });
});
