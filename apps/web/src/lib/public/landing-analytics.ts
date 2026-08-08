'use server';

import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PUBLIC_LANDING_EVENTS, PUBLIC_LANDING_METADATA_KEYS } from './landing-events';

/**
 * ADDENDUM §50 et §51 — Emission reelle des evenements de PUB-001.
 *
 * Pourquoi une Server Action plutot qu'un appel direct depuis le navigateur :
 *  - `record_public_landing_event` rattache l'evenement a
 *    `private.current_profile_id()`, qui depend de la session. Seul le client
 *    serveur porte les cookies : un appel navigateur anonymiserait tous les
 *    clics des membres connectes ;
 *  - la cible d'une Server Action est la page courante (`/`), qui est
 *    publique : aucune route d'API supplementaire a exposer, donc rien a
 *    ajouter a la liste blanche du middleware ;
 *  - la cle publiable reste soumise a RLS ; la fonction est `security definer`
 *    et n'accepte que sept types d'evenement.
 *
 * Rien n'est jamais levé vers l'appelant : une metrique perdue ne casse pas
 * une landing (§47).
 */

const uuid = z.string().uuid();

const metadataValue = z.union([z.string().max(64), z.number().finite()]);

const inputSchema = z.object({
  eventType: z.enum(PUBLIC_LANDING_EVENTS),
  entityType: z.string().trim().min(1).max(40).nullish(),
  entityId: z.string().trim().nullish(),
  correlationId: z.string().trim().max(64).nullish(),
  metadata: z.record(z.string(), metadataValue).nullish(),
});

function sanitizeMetadata(
  raw: Record<string, string | number> | null | undefined,
): Record<string, string | number> {
  const output: Record<string, string | number> = {};
  if (!raw) return output;
  for (const key of PUBLIC_LANDING_METADATA_KEYS) {
    const value = raw[key];
    if (typeof value === 'string' && value.length > 0 && value.length <= 64) output[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) output[key] = value;
  }
  return output;
}

/**
 * Enregistre un evenement public. Retourne `true` uniquement si la base a
 * confirme l'ecriture — aucune metrique n'est supposee (§51).
 */
export async function recordPublicLandingEvent(input: unknown): Promise<boolean> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return false;

  // `p_entity_id` est un `uuid` cote base : un identifiant qui n'en est pas un
  // (une expertise, dont l'identifiant est un `bigint`) est simplement omis.
  const entityId = parsed.data.entityId ?? null;
  const entityUuid = entityId !== null && uuid.safeParse(entityId).success ? entityId : null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('record_public_landing_event', {
      p_event_type: parsed.data.eventType,
      p_entity_type: parsed.data.entityType ?? null,
      p_entity_id: entityUuid,
      p_correlation_id: parsed.data.correlationId ?? null,
      p_metadata: sanitizeMetadata(parsed.data.metadata),
    } as never);

    if (error) {
      console.warn('[ISE] evenement public non enregistre', {
        eventType: parsed.data.eventType,
        code: error.code,
      });
      return false;
    }
    return data === true;
  } catch (cause) {
    console.warn('[ISE] evenement public non enregistre', { cause });
    return false;
  }
}

/**
 * Variante groupee. Les impressions partenaires d'un meme ecran arrivent par
 * paquet : les envoyer une par une multiplierait les allers-retours (et, avec
 * eux, les re-rendus que Next.js attache a toute Server Action).
 */
export async function recordPublicLandingEvents(inputs: unknown): Promise<number> {
  if (!Array.isArray(inputs)) return 0;
  // Garde-fou : une salve anormale est tronquee plutot que relayee.
  const batch = inputs.slice(0, 20);
  const results = await Promise.all(batch.map((input) => recordPublicLandingEvent(input)));
  return results.filter(Boolean).length;
}
