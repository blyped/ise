import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env';
import { AUTH_ROUTE_PREFIXES, MEMBER_ROUTE_PREFIXES, ROUTES } from '@/lib/routes';

/**
 * ADDENDUM §53 — PUB-001 est indexable, le reste ne l'est pas.
 *
 * Le `robots.txt` est une **indication**, pas une protection : il indique aux
 * moteurs quoi ne pas explorer. La garantie, elle, vient de deux autres
 * mecanismes : l'en-tete `X-Robots-Tag: noindex` pose par `src/middleware.ts`
 * sur toute route non publique, et le `robots: { index: false }` du layout
 * racine, que seule PUB-001 surcharge.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = publicEnv().NEXT_PUBLIC_SITE_URL;
  /*
   * Les prefixes sont ecrits SANS barre finale : `Disallow: /tableau-de-bord/`
   * ne couvrirait pas `/tableau-de-bord` lui-meme, la correspondance etant un
   * simple prefixe de chaine.
   */
  const disallow = [...MEMBER_ROUTE_PREFIXES, ...AUTH_ROUTE_PREFIXES, '/api'];

  return {
    rules: [
      {
        userAgent: '*',
        allow: [ROUTES.home],
        disallow: [...new Set(disallow)].sort(),
      },
    ],
    sitemap: new URL('/sitemap.xml', siteUrl).toString(),
    host: siteUrl,
  };
}
