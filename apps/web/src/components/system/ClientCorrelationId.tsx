'use client';

import { useState } from 'react';
import { newCorrelationId } from '@/lib/correlation';
import { SystemScreen, type SystemScreenProps } from './SystemScreen';

/**
 * `SystemScreen` dont l'identifiant de correlation est genere cote client,
 * une fois par visite.
 *
 * Necessaire pour les ecrans rendus statiquement (404) : un identifiant
 * calcule a la construction serait identique pour tout le monde et ne
 * permettrait de retrouver aucun incident.
 */
export function ClientCorrelationId(props: Omit<SystemScreenProps, 'correlationId'>) {
  const [correlationId] = useState(() => newCorrelationId());
  return <SystemScreen {...props} correlationId={correlationId} />;
}
