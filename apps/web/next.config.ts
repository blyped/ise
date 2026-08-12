import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

/**
 * Politique de securite du contenu (MASTER PROMPT §71).
 * Volontairement lisible : chaque directive est justifiee.
 *  - `script-src 'unsafe-inline'` reste necessaire au bootstrap de Next ;
 *    un passage aux nonces est prevu (Q ouverte, voir docs/decisions.md).
 *  - `connect-src` autorise l'API et le temps reel Supabase.
 */
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://*.supabase.co';
const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Le SEUL bucket Storage public du projet (migration 0068, D-134). Il porte
 * les medias editoriaux de PUB-001. Les huit autres buckets sont prives et
 * `private.storage_baseline_violations()` fait echouer la CI si l'un d'eux
 * cesse de l'etre : rien d'autre ne doit apparaitre dans `remotePatterns`.
 */
const LANDING_MEDIA_BUCKET = 'landing-media';

/**
 * Hote autorise pour l'optimiseur d'images. `remotePatterns` est une liste
 * blanche : sans elle, `next/image` refuse la source et la vitrine reste
 * vide. Le motif est volontairement etroit — protocole, hote ET chemin —
 * pour que l'optimiseur ne puisse pas etre transforme en proxy d'images
 * arbitraires (une classe de faille reelle des deploiements Next).
 */
function supabaseImageHost(): string {
  try {
    return new URL(supabaseOrigin).hostname;
  } catch {
    return '*.supabase.co';
  }
}

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // Les images de PUB-001 sont servies depuis le bucket public
  // `landing-media`, sur le domaine Supabase : sans cette source, la CSP
  // bloquerait chaque visuel de la vitrine. `blob:` couvre les apercus
  // locaux du back-office avant televersement.
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  // Les evenements Sentry transitent par /monitoring (voir
  // instrumentation-client.ts, tunnelRoute) : aucun domaine *.sentry.io a
  // ajouter ici, 'self' suffit deja.
  `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace('https://', 'wss://')}`,
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=()',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // La mediatheque du CMS accepte des images jusqu'a 5 Mo
      // (mediatheque/actions.ts) mais la limite par defaut des Server
      // Actions est de 1 Mo : tout televersement au-dela repondait 413/500
      // (constate en production le 2026-08-12, digest 2284581426@E394).
      // 6 Mo = 5 Mo de fichier + l'enveloppe multipart du formulaire.
      bodySizeLimit: '6mb',
    },
  },
  transpilePackages: [
    '@ise/config',
    '@ise/db-types',
    '@ise/design-tokens',
    '@ise/domain',
    '@ise/ui-web',
    '@ise/validation',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: supabaseImageHost(),
        pathname: `/storage/v1/object/public/${LANDING_MEDIA_BUCKET}/**`,
      },
    ],
    // AVIF puis WebP : l'optimiseur sert le format le plus leger accepte par
    // le navigateur, quel que soit le format depose par la redaction.
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Coupe le bruit Sentry pendant les builds locaux ; le laisse parler en CI
  // pour diagnostiquer un echec d'upload de source maps.
  silent: !process.env.CI,

  // Necessaire pour que les traces d'erreur des paquets @ise/* (transpiles
  // via transpilePackages) restent lisibles cote Sentry.
  widenClientFileUpload: true,

  // Annote automatiquement les composants React dans les eventuels replays.
  reactComponentAnnotation: { enabled: true },

  // Les source maps sont uploadees a Sentry mais jamais servies au navigateur.
  hideSourceMaps: true,

  // Retire le logging de debug Sentry du bundle de production.
  disableLogger: true,

  // Route du proxy correspondant a tunnelRoute dans instrumentation-client.ts.
  tunnelRoute: '/monitoring',
});
