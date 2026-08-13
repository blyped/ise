import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SPONSORED_LABEL,
  eventSchema,
  expertiseSchema,
  featuredProfileSchema,
  newsSchema,
  normalizeSponsoredLabel,
  opportunitySchema,
  parseMedia,
  parseStats,
  partnerSchema,
  safeExternalUrl,
  sectionConfigSchema,
  sectionLimit,
  sectionTitle,
  slideSchema,
  toEntityRef,
  truncate,
  landingMediaUrl,
  type LandingSectionConfig,
} from './landing-data';

/**
 * Tests des parseurs de PUB-001.
 *
 * Les charges utiles sont des **copies conformes** de ce que les projections
 * renvoient reellement : formes relevees par appel direct des neuf fonctions
 * `get_landing_*` sur la base du projet. Un test ecrit sur une forme supposee
 * ne prouverait rien.
 */

/*
 * `landingMediaUrl()` lit l'environnement public — mais paresseusement, a
 * l'appel, pas au chargement du module. Renseigner les quatre variables ici
 * suffit donc, et evite d'avoir a mettre en place un fichier d'environnement
 * de test pour quatre chaines.
 */
const TEST_SUPABASE_URL = 'https://projet-test.supabase.co';
process.env['NEXT_PUBLIC_SUPABASE_URL'] = TEST_SUPABASE_URL;
process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] = 'cle-anonyme-de-test-suffisamment-longue';
process.env['NEXT_PUBLIC_SITE_URL'] = 'https://competences-ise.test';
process.env['NEXT_PUBLIC_ENVIRONMENT'] = 'local';

/** Forme exacte d'un media projete par `private.landing_media()` (0068). */
const MEDIA_ROW = {
  bucket: 'landing-media',
  path: 'carousel/2026/08/rencontre-annuelle.webp',
  alt_text: 'Vue de la salle plénière de la rencontre annuelle',
  credit: 'Photo ISE',
  width: 1440,
  height: 810,
};

const CAROUSEL_ROW = {
  id: '2b0a4a1e-3f7a-4c39-9b5f-1d2e3f4a5b6c',
  title: 'Rencontre annuelle',
  subtitle: 'Abidjan',
  description: 'Une journée pour connecter les promotions.',
  content_type: 'event',
  entity_type: 'event',
  entity_id: '9f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f',
  cta_label: 'Découvrir',
  priority: 10,
  media: null,
  mobile_media: null,
  is_sponsored: false,
  sponsored_label: null,
};

const NEWS_ROW = {
  id: '11111111-2222-4333-8444-555555555555',
  entity_type: 'news',
  title: 'Transformation économique',
  slug: 'transformation-economique',
  summary: 'Un résumé public.',
  category_code: 'analyse',
  image: { ...MEDIA_ROW, path: 'news/2026/07/transformation.webp' },
  published_at: '2026-07-01T08:00:00+00:00',
  is_featured: true,
  is_pinned: false,
};

const EVENT_ROW = {
  id: '22222222-3333-4444-8555-666666666666',
  entity_type: 'event',
  title: 'Webinaire Data',
  slug: 'webinaire-data',
  event_type_code: 'webinar',
  starts_at: '2026-09-24T14:00:00+00:00',
  ends_at: '2026-09-24T16:00:00+00:00',
  timezone: 'Africa/Abidjan',
  format: 'online',
  city: null,
  country_code: 'CI',
  is_pinned: false,
};

const OPPORTUNITY_ROW = {
  id: '33333333-4444-4555-8666-777777777777',
  entity_type: 'opportunity',
  title: 'Expert suivi-évaluation',
  opportunity_type: 'job',
  contract_type: 'cdi',
  sector: 'Santé',
  country_code: 'SN',
  city: 'Dakar',
  remote_allowed: true,
  deadline: '2026-10-01T00:00:00+00:00',
  organization: 'Organisation vérifiée',
  is_pinned: false,
};

/** Forme exacte de `get_landing_expertises()` : `id` est un **nombre**. */
const EXPERTISE_ROW = {
  id: 6,
  entity_type: 'expertise_area',
  name: 'Suivi-évaluation',
  slug: 'suivi-evaluation',
  description: null,
  profile_count: 0,
};

const PARTNER_ROW = {
  id: '44444444-5555-4666-8777-888888888888',
  entity_type: 'organization',
  organization_id: '55555555-6666-4777-8888-999999999999',
  organization_name: 'Banque régionale',
  organization_logo: { ...MEDIA_ROW, path: 'partners/2026/08/banque.png', width: 320, height: 80 },
  campaign_name: 'Campagne 2026',
  placement: 'partners_block',
  title: 'Votre organisation souhaite toucher le réseau ISE ?',
  description: 'Visibilité clairement identifiée comme partenaire.',
  cta_label: 'Devenir partenaire',
  target_entity_type: null,
  target_entity_id: null,
  target_url: 'https://partenaire.example/offre',
  sponsored_label: 'Partenaire',
  media: null,
  mobile_media: null,
};

/** Forme exacte de `get_landing_stats()` : un objet, et zéro partout. */
const STATS_PAYLOAD = {
  profiles: { value: 0, source: 'ise_profiles hors test' },
  promotions: { value: 0, source: 'promotions représentées' },
  countries: { value: 0, source: 'pays distincts' },
  organizations: { value: 0, source: 'organisations résolues' },
  computed_at: '2026-08-08T13:55:17.172922+00:00',
};

describe('carrousel — get_landing_carousel()', () => {
  it('reconstruit la cible depuis entity_type + entity_id', () => {
    const slide = slideSchema.parse(CAROUSEL_ROW);
    expect(slide.target).toEqual({
      entityType: 'event',
      entityId: '9f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f',
    });
    expect(slide.contentType).toBe('event');
    expect(slide.sponsored).toBe(false);
    expect(slide.sponsoredLabel).toBeNull();
  });

  it('n’invente pas de cible quand le type d’entité est inconnu de l’application', () => {
    const slide = slideSchema.parse({
      ...CAROUSEL_ROW,
      entity_type: 'expertise_area',
      entity_id: '7',
    });
    expect(slide.target).toBeNull();
  });

  it('§26 — une diapositive commerciale porte toujours une mention', () => {
    const withoutLabel = slideSchema.parse({
      ...CAROUSEL_ROW,
      is_sponsored: true,
      sponsored_label: null,
    });
    expect(withoutLabel.sponsoredLabel).toBe(DEFAULT_SPONSORED_LABEL);

    const withJunk = slideSchema.parse({
      ...CAROUSEL_ROW,
      is_sponsored: true,
      sponsored_label: 'Offre exclusive !!',
    });
    expect(withJunk.sponsoredLabel).toBe(DEFAULT_SPONSORED_LABEL);
  });

  it('refuse une diapositive sans titre plutôt que d’afficher un vide', () => {
    expect(slideSchema.safeParse({ ...CAROUSEL_ROW, title: '   ' }).success).toBe(false);
  });
});

describe('actualités, événements, opportunités', () => {
  it('construit une référence d’entité pour chaque teaser', () => {
    expect(newsSchema.parse(NEWS_ROW).target).toEqual({
      entityType: 'news',
      entityId: NEWS_ROW.id,
    });
    expect(eventSchema.parse(EVENT_ROW).target.entityType).toBe('event');
    expect(opportunitySchema.parse(OPPORTUNITY_ROW).target.entityType).toBe('opportunity');
  });

  it('conserve le fuseau porté par l’événement', () => {
    expect(eventSchema.parse(EVENT_ROW).timezone).toBe('Africa/Abidjan');
  });

  it('ne garde du teaser d’opportunité que ce que la projection descend', () => {
    const item = opportunitySchema.parse({ ...OPPORTUNITY_ROW, salary_min: 900000 });
    expect(Object.keys(item).sort()).toEqual(
      [
        'city',
        'contractType',
        'countryCode',
        'deadline',
        'id',
        'opportunityType',
        'organization',
        'pinned',
        'remoteAllowed',
        'sector',
        'target',
        'title',
      ].sort(),
    );
  });

  it('écarte un horodatage inexploitable au lieu d’afficher « Invalid Date »', () => {
    expect(newsSchema.parse({ ...NEWS_ROW, published_at: 'pas-une-date' }).publishedAt).toBeNull();
  });
});

describe('ISE du jour — get_landing_featured_profile()', () => {
  const PROFILE_PAYLOAD = {
    entity_type: 'profile',
    profile_id: '66666666-7777-4888-8999-aaaaaaaaaaaa',
    display_name: 'Aminata Mbaye',
    promotion: { id: 12, name: 'ISE 2008', graduation_year: 2008 },
    current_position: 'Économiste principale',
    organization: 'Institut régional',
    public_summary: 'Spécialiste des politiques publiques.',
    avatar_path: 'avatars/66666666.png',
    expertise_areas: [
      { id: 1, name: 'Statistique', slug: 'statistique' },
      { id: 3, name: 'Économie', slug: 'economie' },
    ],
    featured_date: '2026-08-08',
    selection_mode: 'automatic',
  };

  it('ne retient que la liste blanche du teaser', () => {
    const profile = featuredProfileSchema.parse(PROFILE_PAYLOAD);
    expect(Object.keys(profile).sort()).toEqual(
      [
        'currentPosition',
        'displayName',
        'expertiseAreas',
        'organization',
        'photo',
        'profileId',
        'promotionName',
        'promotionYear',
        'summary',
        'tagline',
        'target',
      ].sort(),
    );
  });

  /**
   * D-165 (migration 0112) — `photo` reste distinct de l'avatar prive
   * (`avatar_path`, jamais projete depuis D-135) : c'est un media de la
   * mediatheque PUBLIQUE, soumis aux memes controles que tout autre visuel
   * editorial (bucket public, alt_text non vide).
   */
  it('D-165 — un visuel de médiathèque publique est retenu, avatar_path reste ignoré', () => {
    const profile = featuredProfileSchema.parse({
      ...PROFILE_PAYLOAD,
      photo: {
        bucket: 'landing-media',
        path: 'featured/aminata.jpg',
        alt_text: 'Aminata Mbaye lors de la conférence annuelle du réseau ISE.',
        credit: null,
        width: 800,
        height: 600,
      },
      tagline: 'Aminata Mbaye, l’ISE qui a réformé la statistique nationale.',
    });
    expect(profile.photo).not.toBeNull();
    expect(profile.photo?.bucket).toBe('landing-media');
    expect(profile.tagline).toBe(
      'Aminata Mbaye, l’ISE qui a réformé la statistique nationale.',
    );
  });

  it('D-165 — un visuel dans un bucket privé (ou absent) ne produit aucune photo', () => {
    const withoutPhoto = featuredProfileSchema.parse(PROFILE_PAYLOAD);
    expect(withoutPhoto.photo).toBeNull();

    const withPrivateBucket = featuredProfileSchema.parse({
      ...PROFILE_PAYLOAD,
      photo: {
        bucket: 'avatars',
        path: '66666666.png',
        alt_text: 'Photo de profil',
        credit: null,
        width: null,
        height: null,
      },
    });
    expect(withPrivateBucket.photo).toBeNull();
  });

  it('§45 — aucune donnée privée ne traverse le parseur', () => {
    const profile = featuredProfileSchema.parse({
      ...PROFILE_PAYLOAD,
      email: 'aminata@example.org',
      phone: '+221770000000',
      completeness_score: 87,
      claim_status: 'claimed',
    });
    const serialized = JSON.stringify(profile);
    expect(serialized).not.toContain('aminata@example.org');
    expect(serialized).not.toContain('+221770000000');
    expect(serialized).not.toContain('87');
    expect(serialized).not.toContain('avatars/');
  });

  it('tronque le résumé public sans le couper au milieu d’un mot', () => {
    const long = 'mot '.repeat(120).trim();
    const profile = featuredProfileSchema.parse({ ...PROFILE_PAYLOAD, public_summary: long });
    expect(profile.summary).not.toBeNull();
    expect((profile.summary ?? '').length).toBeLessThanOrEqual(181);
    expect(profile.summary?.endsWith('…')).toBe(true);
  });

  it('supporte une promotion absente', () => {
    const profile = featuredProfileSchema.parse({ ...PROFILE_PAYLOAD, promotion: null });
    expect(profile.promotionName).toBeNull();
    expect(profile.promotionYear).toBeNull();
  });

  it('refuse un profil sans nom affichable', () => {
    expect(featuredProfileSchema.safeParse({ ...PROFILE_PAYLOAD, display_name: '' }).success).toBe(
      false,
    );
  });
});

describe('expertises — get_landing_expertises()', () => {
  it('accepte l’identifiant numérique renvoyé par la base', () => {
    const expertise = expertiseSchema.parse(EXPERTISE_ROW);
    expect(expertise.id).toBe('6');
    expect(expertise.name).toBe('Suivi-évaluation');
    expect(expertise.profileCount).toBe(0);
  });

  it('ramène un compte manquant à zéro plutôt qu’à NaN', () => {
    expect(expertiseSchema.parse({ ...EXPERTISE_ROW, profile_count: null }).profileCount).toBe(0);
  });
});

describe('partenaires — get_landing_partners()', () => {
  it('accepte une mention de transparence reconnue', () => {
    expect(partnerSchema.parse(PARTNER_ROW).sponsoredLabel).toBe('Partenaire');
    expect(
      partnerSchema.parse({ ...PARTNER_ROW, sponsored_label: 'Sponsorisé' }).sponsoredLabel,
    ).toBe('Sponsorisé');
  });

  it('§26 — impose la mention par défaut quand le CMS n’en fournit pas', () => {
    expect(partnerSchema.parse({ ...PARTNER_ROW, sponsored_label: null }).sponsoredLabel).toBe(
      DEFAULT_SPONSORED_LABEL,
    );
    expect(partnerSchema.parse({ ...PARTNER_ROW, sponsored_label: '  ' }).sponsoredLabel).toBe(
      DEFAULT_SPONSORED_LABEL,
    );
  });

  it('n’accepte une cible externe qu’en https', () => {
    expect(partnerSchema.parse(PARTNER_ROW).externalUrl).toBe('https://partenaire.example/offre');
    expect(
      partnerSchema.parse({ ...PARTNER_ROW, target_url: 'javascript:alert(1)' }).externalUrl,
    ).toBeNull();
    expect(
      partnerSchema.parse({ ...PARTNER_ROW, target_url: 'http://partenaire.example' }).externalUrl,
    ).toBeNull();
  });

  it('préfère une cible interne quand le CMS en publie une', () => {
    const campaign = partnerSchema.parse({
      ...PARTNER_ROW,
      target_entity_type: 'opportunity',
      target_entity_id: OPPORTUNITY_ROW.id,
    });
    expect(campaign.target).toEqual({
      entityType: 'opportunity',
      entityId: OPPORTUNITY_ROW.id,
    });
  });
});

describe('chiffres du réseau — get_landing_stats()', () => {
  it('lit un objet, pas un tableau, et signale les quatre zéros', () => {
    const stats = parseStats(STATS_PAYLOAD);
    expect(stats.status).toBe('ok');
    expect(stats.items.map((stat) => stat.id)).toEqual([
      'profiles',
      'promotions',
      'countries',
      'organizations',
    ]);
    expect(stats.items.every((stat) => stat.value === 0)).toBe(true);
    expect(stats.allZero).toBe(true);
    expect(stats.computedAt).toBe(STATS_PAYLOAD.computed_at);
  });

  it('cesse de signaler « tout à zéro » dès qu’une mesure est non nulle', () => {
    const stats = parseStats({ ...STATS_PAYLOAD, promotions: { value: 4, source: 's' } });
    expect(stats.allZero).toBe(false);
    expect(stats.items.find((stat) => stat.id === 'promotions')?.value).toBe(4);
  });

  it('déclare la section indisponible si la réponse n’est pas un objet', () => {
    for (const payload of [null, [], 'zéro', 42]) {
      const stats = parseStats(payload);
      expect(stats.status).toBe('indisponible');
      expect(stats.items).toHaveLength(0);
      expect(stats.allZero).toBe(true);
    }
  });

  it('ne fabrique aucun chiffre absent de la réponse', () => {
    const stats = parseStats({ profiles: { value: 3, source: 's' }, computed_at: null });
    expect(stats.items).toHaveLength(1);
    expect(stats.items[0]?.id).toBe('profiles');
  });
});

describe('réglages de section — get_landing_sections()', () => {
  const SECTION_ROW = {
    section_key: 'news',
    title: 'Actualités du réseau',
    subtitle: null,
    display_order: 30,
    source_mode: 'automatic',
    max_items: 2,
    cta_label: null,
    cta_entity_type: null,
    cta_entity_id: null,
    configuration: null,
  };

  it('applique la limite publiée par le CMS', () => {
    const sections: LandingSectionConfig[] = [sectionConfigSchema.parse(SECTION_ROW)];
    expect(sectionLimit(sections, 'news')).toBe(2);
    expect(sectionTitle(sections, 'news')).toBe('Actualités du réseau');
  });

  it('retombe sur les valeurs par défaut quand la projection est vide', () => {
    // C'est l'etat reel de la base : les neuf lignes de `cms_sections` sont en
    // brouillon, `get_landing_sections()` renvoie donc `[]`.
    expect(sectionLimit([], 'news')).toBe(1);
    expect(sectionLimit([], 'expertises')).toBe(8);
    expect(sectionTitle([], 'news')).toBeNull();
  });

  it('ignore une limite absurde', () => {
    const sections = [sectionConfigSchema.parse({ ...SECTION_ROW, max_items: 0 })];
    expect(sectionLimit(sections, 'news')).toBe(1);
  });
});

describe('utilitaires de sûreté', () => {
  it('normalise les mentions de transparence', () => {
    expect(normalizeSponsoredLabel('partenaire')).toBe('Partenaire');
    expect(normalizeSponsoredLabel(undefined)).toBe(DEFAULT_SPONSORED_LABEL);
  });

  it('refuse toute URL qui n’est pas en https', () => {
    expect(safeExternalUrl('https://exemple.org')).toBe('https://exemple.org/');
    expect(safeExternalUrl('data:text/html,<script>')).toBeNull();
    expect(safeExternalUrl('/interne')).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
  });

  it('tronque sans couper un mot', () => {
    expect(truncate('abc', 10)).toBe('abc');
    expect(truncate('  ', 10)).toBeNull();
    expect(truncate(null, 10)).toBeNull();
  });

  it('ne fabrique pas de référence d’entité invalide', () => {
    expect(toEntityRef('profile', '')).toBeNull();
    expect(toEntityRef('organization', 'x')).toBeNull();
    expect(toEntityRef('profile', null)).toBeNull();
    expect(toEntityRef('expertise', 4)).toEqual({ entityType: 'expertise', entityId: '4' });
  });
});

/**
 * MEDIAS DE LA VITRINE (migration 0068).
 *
 * Trois exigences y sont verifiees, et ce sont exactement les trois qui
 * decident si une image s'affiche ou non :
 *   1. l'URL publique est construite CORRECTEMENT ;
 *   2. un media sans alternative textuelle est REFUSE ;
 *   3. un media absent, ou dans un bucket prive, produit un repli propre —
 *      `null` — et jamais une URL cassee.
 */
describe('médias — bucket public `landing-media`', () => {
  it('construit l’URL publique réelle du bucket', () => {
    expect(landingMediaUrl(parseMedia(MEDIA_ROW))).toBe(
      `${TEST_SUPABASE_URL}/storage/v1/object/public/landing-media/carousel/2026/08/rencontre-annuelle.webp`,
    );
  });

  it('encode chaque segment séparément, sans transformer les « / » en « %2F »', () => {
    const url = landingMediaUrl(
      parseMedia({ ...MEDIA_ROW, path: 'news/2026/08/rentrée & co.png' }),
    );
    expect(url).toBe(
      `${TEST_SUPABASE_URL}/storage/v1/object/public/landing-media/news/2026/08/rentr%C3%A9e%20%26%20co.png`,
    );
    expect(url).not.toContain('%2F');
  });

  it('supporte une URL de projet terminée par un « / »', () => {
    process.env['NEXT_PUBLIC_SUPABASE_URL'] = `${TEST_SUPABASE_URL}/`;
    expect(landingMediaUrl(parseMedia(MEDIA_ROW))).toBe(
      `${TEST_SUPABASE_URL}/storage/v1/object/public/landing-media/carousel/2026/08/rencontre-annuelle.webp`,
    );
    process.env['NEXT_PUBLIC_SUPABASE_URL'] = TEST_SUPABASE_URL;
  });

  it('§52 — refuse un média sans texte alternatif', () => {
    expect(parseMedia({ ...MEDIA_ROW, alt_text: null })).toBeNull();
    expect(parseMedia({ ...MEDIA_ROW, alt_text: '   ' })).toBeNull();
    expect(parseMedia({ ...MEDIA_ROW, alt_text: 'ab' })).toBeNull();
  });

  it('refuse un média logé dans un bucket qui n’est pas public', () => {
    for (const bucket of ['avatars', 'public-assets', 'profile-documents']) {
      expect(parseMedia({ ...MEDIA_ROW, bucket })).toBeNull();
    }
  });

  it('conserve les dimensions réelles, qui servent au dimensionnement', () => {
    const media = parseMedia(MEDIA_ROW);
    expect(media?.width).toBe(1440);
    expect(media?.height).toBe(810);
    expect(media?.alt).toBe(MEDIA_ROW.alt_text);
  });

  it('accepte un média non mesuré : la place est réservée par le conteneur', () => {
    const media = parseMedia({ ...MEDIA_ROW, width: null, height: null });
    expect(media).not.toBeNull();
    expect(media?.width).toBeNull();
  });

  it('replie sur `null` quand la projection ne descend aucun média', () => {
    expect(parseMedia(null)).toBeNull();
    expect(parseMedia(undefined)).toBeNull();
    expect(parseMedia({})).toBeNull();
    expect(parseMedia({ bucket: 'landing-media' })).toBeNull();
    expect(landingMediaUrl(null)).toBeNull();
  });

  it('rattache la couverture à l’actualité, et le logo au partenaire', () => {
    const news = newsSchema.parse(NEWS_ROW);
    expect(news.image?.path).toBe('news/2026/07/transformation.webp');
    expect(landingMediaUrl(news.image)).toContain('/object/public/landing-media/news/');

    const partner = partnerSchema.parse(PARTNER_ROW);
    expect(partner.logo?.path).toBe('partners/2026/08/banque.png');
  });

  it('une actualité sans couverture publiable reste une actualité entière', () => {
    const news = newsSchema.parse({ ...NEWS_ROW, image: null });
    expect(news.image).toBeNull();
    expect(news.title).toBe(NEWS_ROW.title);

    const withoutAlt = newsSchema.parse({
      ...NEWS_ROW,
      image: { ...MEDIA_ROW, alt_text: null },
    });
    expect(withoutAlt.image).toBeNull();
  });

  it('une diapositive porte son visuel et sa variante mobile', () => {
    const slide = slideSchema.parse({
      ...CAROUSEL_ROW,
      media: MEDIA_ROW,
      mobile_media: { ...MEDIA_ROW, path: 'carousel/2026/08/rencontre-mobile.webp' },
    });
    expect(landingMediaUrl(slide.media)).toContain('rencontre-annuelle.webp');
    expect(landingMediaUrl(slide.mobileMedia)).toContain('rencontre-mobile.webp');
  });
});
