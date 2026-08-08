import { revalidateLanding } from '@/lib/public/revalidate-landing';

/**
 * INVALIDATION CIBLEE DU CACHE DE PUB-001 APRES PUBLICATION (ADDENDUM §46).
 *
 * CONTRAT VERIFIE AVANT APPEL, comme demande.
 * `src/app/api/cms/revalidation-landing/route.ts` :
 *   * accepte `POST` uniquement — une invalidation est un effet de bord ;
 *   * exige l'en-tete `x-ise-revalidation-secret`, compare a temps
 *     constant a `process.env.CMS_REVALIDATION_SECRET` ;
 *   * repond `503` si le secret n'est pas configure — la route n'est
 *     jamais ouverte « par defaut » ;
 *   * son corps se reduit a un appel a `revalidateLanding()`, qui purge
 *     l'etiquette `LANDING_CACHE_TAG` et la route `/`.
 *
 * POURQUOI LE CMS N'EMET PAS LA REQUETE HTTP
 *   Le CMS vit dans la MEME application Next que la landing. Emettre une
 *   requete HTTP vers soi-meme imposerait de connaitre son URL publique,
 *   de partager un secret avec soi-meme et d'ajouter un aller-retour
 *   reseau — pour executer exactement la fonction que l'on peut appeler
 *   directement. La route HTTP reste la porte des appelants EXTERNES
 *   (Edge Function, cron), et son en-tete de fichier le dit deja.
 *
 * Ce module n'ecrit rien sous `src/lib/public/` : il en importe la
 * Server Action publique, sans la modifier.
 */

export interface RevalidationOutcome {
  /** `true` si l'invalidation a bien eu lieu. Jamais suppose. */
  revalidated: boolean;
  revalidatedAt: string | null;
}

export async function revalidateLandingCache(correlationId: string): Promise<RevalidationOutcome> {
  try {
    const { revalidatedAt } = await revalidateLanding();
    return { revalidated: true, revalidatedAt };
  } catch (error) {
    // Une publication reussie ne doit pas etre annoncee comme un echec
    // parce que le cache n'a pas pu etre purge — mais on ne pretend pas
    // non plus l'avoir purge. L'ecran affiche les deux faits separement.
    console.error('[ISE] invalidation du cache de la landing en echec', {
      correlationId,
      cause: error instanceof Error ? error.name : 'inconnue',
    });
    return { revalidated: false, revalidatedAt: null };
  }
}
