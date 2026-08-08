import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env';
import { ROUTES } from '@/lib/routes';

/**
 * ADDENDUM §53 — Plan du site.
 *
 * Seules les routes reellement publiques y figurent. Aucune ressource membre
 * n'est listee : le plan du site ne doit pas devenir un annuaire des URL
 * protegees, meme si elles renvoient un 302 vers la connexion.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = publicEnv().NEXT_PUBLIC_SITE_URL;

  return [
    {
      url: new URL(ROUTES.home, siteUrl).toString(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ];
}
