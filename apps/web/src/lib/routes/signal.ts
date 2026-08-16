/**
 * Chemin du GUICHET UNIQUE « Signaler » (D-222).
 *
 * Une seule route : le guichet ne porte aucun formulaire, il ORIENTE vers
 * les écrans existants (opportunités, appels au réseau, événements,
 * disponibilité, mentorat, introductions) en langage naturel. Fichier
 * séparé de `src/lib/routes.ts`, sur le modèle de `routes/calls.ts`.
 * Route protégée par `src/middleware.ts` (absente de PUBLIC_ROUTES).
 */
export const SIGNAL_ROUTES = {
  /** Guichet unique — « Que voulez-vous signaler au réseau ? » */
  home: '/signaler',
} as const;
