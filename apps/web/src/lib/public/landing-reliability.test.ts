import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ADDENDUM §47 — comportement de PUB-001 quand la base ne repond pas comme
 * prevu : projection en erreur, reponse d'une autre forme, campagne hors
 * periode, aucun ISE du jour.
 *
 * Ce que ces tests verifient, et qui n'est pas negociable :
 *  - une projection en panne degrade **sa** section, pas la page ;
 *  - la derniere version valide reprend le relais plutot qu'un vide ;
 *  - une reponse vide reste une reponse : elle n'est jamais completee.
 */

const RESPONSES = new Map<string, { data: unknown; error: unknown }>();

function reply(name: string, data: unknown, error: unknown = null): void {
  RESPONSES.set(name, { data, error });
}

vi.mock('next/cache', () => ({
  unstable_cache: <T>(fn: T) => fn,
  revalidateTag: () => undefined,
  revalidatePath: () => undefined,
}));

vi.mock('@/lib/env', () => ({
  publicEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: 'https://exemple.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'cle-publique',
    NEXT_PUBLIC_SITE_URL: 'https://exemple.org',
    NEXT_PUBLIC_ENVIRONMENT: 'test',
  }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: (name: string) => {
      const outcome = RESPONSES.get(name) ?? { data: [], error: null };
      const pending = Promise.resolve(outcome) as Promise<typeof outcome> & {
        abortSignal: () => Promise<typeof outcome>;
      };
      pending.abortSignal = () => pending;
      return pending;
    },
  }),
}));

const { fetchLandingDataUncached, isLandingEmpty, resetLandingFallbackCache } =
  await import('./landing-data');

const EMPTY_STATS = {
  profiles: { value: 0, source: 's' },
  promotions: { value: 0, source: 's' },
  countries: { value: 0, source: 's' },
  organizations: { value: 0, source: 's' },
  computed_at: '2026-08-08T13:55:17.172922+00:00',
};

const A_NEWS = {
  id: '11111111-2222-4333-8444-555555555555',
  entity_type: 'news',
  title: 'Une actualité réelle',
  slug: 'une-actualite',
  summary: null,
  category_code: null,
  image_path: null,
  published_at: '2026-07-01T08:00:00+00:00',
  is_featured: false,
  is_pinned: false,
};

/** Etat reel de la base a ce jour : tout est vide, les chiffres sont a zero. */
function seedRealWorldEmptyDatabase(): void {
  RESPONSES.clear();
  reply('get_landing_sections', []);
  reply('get_landing_carousel', []);
  reply('get_landing_news', []);
  reply('get_landing_events', []);
  reply('get_landing_opportunities', []);
  reply('get_landing_featured_profile', null);
  reply('get_landing_expertises', []);
  reply('get_landing_partners', []);
  reply('get_landing_stats', EMPTY_STATS);
}

beforeEach(() => {
  resetLandingFallbackCache();
  seedRealWorldEmptyDatabase();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('état réel de la base : rien n’est publié', () => {
  it('sert une page complète et honnête, sans rien inventer', async () => {
    const data = await fetchLandingDataUncached();

    expect(data.carousel.status).toBe('ok');
    expect(data.carousel.items).toHaveLength(0);
    expect(data.featuredProfile.items).toHaveLength(0);
    expect(data.partners.items).toHaveLength(0);
    expect(data.stats.status).toBe('ok');
    expect(data.stats.allZero).toBe(true);
    expect(data.servedFromLastKnownGood).toBe(false);
    expect(isLandingEmpty(data)).toBe(true);
  });

  it('un ISE du jour absent n’est pas une panne', async () => {
    const data = await fetchLandingDataUncached();
    expect(data.featuredProfile.status).toBe('ok');
    expect(data.featuredProfile.reason).toBeUndefined();
  });
});

describe('une projection tombe', () => {
  it('dégrade la seule section concernée', async () => {
    reply('get_landing_partners', null, { code: '42883', message: 'erreur' });
    reply('get_landing_news', [A_NEWS]);

    const data = await fetchLandingDataUncached();

    expect(data.partners.status).toBe('indisponible');
    expect(data.partners.reason).toBe('erreur:42883');
    // Le reste de la page s'affiche.
    expect(data.news.status).toBe('ok');
    expect(data.news.items).toHaveLength(1);
    expect(data.expertises.status).toBe('ok');
    expect(data.stats.status).toBe('ok');
  });

  it('sert la dernière version valide plutôt qu’un vide', async () => {
    reply('get_landing_news', [A_NEWS]);
    const first = await fetchLandingDataUncached();
    expect(first.news.items).toHaveLength(1);

    reply('get_landing_news', null, { code: '57014', message: 'annulée' });
    const second = await fetchLandingDataUncached();

    expect(second.news.items).toHaveLength(1);
    expect(second.news.stale).toBe(true);
    expect(second.servedFromLastKnownGood).toBe(true);
  });

  it('reste vide, sans erreur, si aucune version valide n’a jamais été lue', async () => {
    reply('get_landing_events', null, { code: '08006', message: 'connexion perdue' });
    const data = await fetchLandingDataUncached();
    expect(data.events.status).toBe('indisponible');
    expect(data.events.items).toHaveLength(0);
    expect(data.events.stale).toBeUndefined();
  });

  it('traite une réponse de forme inattendue comme une panne, pas comme un vide', async () => {
    reply('get_landing_expertises', { inattendu: true });
    const data = await fetchLandingDataUncached();
    expect(data.expertises.status).toBe('indisponible');
    expect(data.expertises.reason).toBe('reponse-inattendue');
  });

  it('écarte une ligne invalide sans perdre les autres', async () => {
    reply('get_landing_news', [{ ...A_NEWS, title: '' }, A_NEWS]);
    const data = await fetchLandingDataUncached();
    expect(data.news.status).toBe('ok');
    expect(data.news.items).toHaveLength(1);
  });

  it('des chiffres injoignables ne font pas apparaître de faux chiffres', async () => {
    reply('get_landing_stats', null, { code: '57014', message: 'annulée' });
    const data = await fetchLandingDataUncached();
    expect(data.stats.status).toBe('indisponible');
    expect(data.stats.items).toHaveLength(0);
    expect(data.stats.allZero).toBe(true);
  });
});

describe('campagne partenaire hors période', () => {
  /**
   * `get_landing_partners()` filtre deja sur `start_at <= now() < end_at` :
   * une campagne expiree ne remonte pas. L'interface n'a donc rien a
   * re-filtrer — mais elle ne doit rien rattraper non plus.
   */
  it('ne s’affiche pas : la projection ne la descend pas', async () => {
    reply('get_landing_partners', []);
    const data = await fetchLandingDataUncached();
    expect(data.partners.status).toBe('ok');
    expect(data.partners.items).toHaveLength(0);
  });

  it('une campagne expirée ne survit pas via la dernière version valide', async () => {
    reply('get_landing_partners', [
      {
        id: '44444444-5555-4666-8777-888888888888',
        organization_id: '55555555-6666-4777-8888-999999999999',
        organization_name: 'Banque régionale',
        campaign_name: null,
        placement: 'partners_block',
        title: 'Campagne en cours',
        description: null,
        cta_label: 'Devenir partenaire',
        target_entity_type: null,
        target_entity_id: null,
        target_url: null,
        sponsored_label: 'Partenaire',
        media: null,
      },
    ]);
    const during = await fetchLandingDataUncached();
    expect(during.partners.items).toHaveLength(1);

    // Fin de periode : la projection cesse de la descendre. La lecture reussit,
    // elle renvoie zero element — ce n'est pas une panne, donc pas de repli.
    reply('get_landing_partners', []);
    const after = await fetchLandingDataUncached();
    expect(after.partners.status).toBe('ok');
    expect(after.partners.items).toHaveLength(0);
    expect(after.partners.stale).toBeUndefined();
  });
});

describe('réglages du CMS', () => {
  it('respecte max_items quand le CMS en publie un', async () => {
    reply('get_landing_sections', [
      {
        section_key: 'expertises',
        title: null,
        subtitle: null,
        display_order: 70,
        source_mode: 'automatic',
        max_items: 2,
        cta_label: null,
        cta_entity_type: null,
        cta_entity_id: null,
        configuration: null,
      },
    ]);
    reply(
      'get_landing_expertises',
      [1, 2, 3, 4].map((id) => ({
        id,
        entity_type: 'expertise_area',
        name: `Domaine ${id}`,
        slug: `domaine-${id}`,
        description: null,
        profile_count: 0,
      })),
    );

    const data = await fetchLandingDataUncached();
    expect(data.expertises.items).toHaveLength(2);
  });
});
