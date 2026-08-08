/**
 * ADDENDUM §50 et §51 — Evenements d'analytique de PUB-001.
 *
 * Cette liste est la copie exacte de la liste blanche de
 * `public.record_public_landing_event(...)`. Un nom absent de la fonction en
 * base leverait `unknown_event_type` : il n'y a donc **aucun** evenement
 * inventable cote interface (§51).
 *
 * Ce module ne contient que des constantes et des types : il est importable
 * depuis un composant client sans embarquer la Server Action.
 */

export const PUBLIC_LANDING_EVENTS = [
  'public_landing_view',
  'public_content_click',
  'public_login_click',
  'public_claim_profile_click',
  'public_partner_impression',
  'public_partner_click',
  'public_to_login',
] as const;

export type PublicLandingEvent = (typeof PUBLIC_LANDING_EVENTS)[number];

export function isPublicLandingEvent(value: unknown): value is PublicLandingEvent {
  return typeof value === 'string' && (PUBLIC_LANDING_EVENTS as readonly string[]).includes(value);
}

/**
 * Cles de metadonnees conservees par la fonction en base. Toute autre cle est
 * silencieusement ecartee cote SQL ; on l'ecarte deja ici pour que le contrat
 * soit lisible depuis l'interface.
 */
export const PUBLIC_LANDING_METADATA_KEYS = [
  'section_key',
  'placement',
  'device',
  'position',
  'content_type',
] as const;

export type PublicLandingMetadataKey = (typeof PUBLIC_LANDING_METADATA_KEYS)[number];

export type PublicLandingMetadata = Partial<Record<PublicLandingMetadataKey, string | number>>;

export interface PublicLandingEventInput {
  readonly eventType: PublicLandingEvent;
  readonly entityType?: string | null;
  readonly entityId?: string | null;
  readonly correlationId?: string | null;
  readonly metadata?: PublicLandingMetadata;
}
