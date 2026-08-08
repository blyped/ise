'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { ROUTES } from '@/lib/routes';
import { LANDING_CACHE_TAG } from './landing-data';

/**
 * ADDENDUM §46 — Invalidation ciblee de PUB-001 apres une publication CMS.
 *
 * Server Action, appelable directement depuis le futur CMS (CMS-002 a
 * CMS-009) une fois qu'il vivra dans la meme application. Le Route Handler
 * `/api/cms/revalidation-landing` en est la porte HTTP, pour un appel
 * machine venu d'ailleurs (Edge Function, cron).
 *
 * L'invalidation est **ciblee** : elle ne purge que l'etiquette de la landing
 * et sa route, jamais le cache complet.
 */
export async function revalidateLanding(): Promise<{ revalidatedAt: string }> {
  // Next 16 impose un profil de duree de vie : `{ expire: 0 }` demande une
  // expiration immediate de l'etiquette, ce que veut dire « publier ».
  revalidateTag(LANDING_CACHE_TAG, { expire: 0 });
  revalidatePath(ROUTES.home, 'page');
  return { revalidatedAt: new Date().toISOString() };
}
