import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../../../lib/auth/AuthProvider';
import { newCorrelationId } from '../../../lib/correlation';
import { loadOnboardingSession, type OnboardingSession } from '../../../lib/queries/onboarding';

export type OnboardingSessionState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string; message: string }
  | { status: 'no-profile' }
  | { status: 'ready'; session: OnboardingSession };

/**
 * Charge le profil courant et sa progression (D-112), commun aux 7 écrans
 * d'étape. `no-profile` signifie un compte non rattaché à un profil : les
 * écrans affichent alors un message invitant à la réclamation (ISE-005/006)
 * plutôt que d'inventer une session.
 */
export function useOnboardingSession(): [OnboardingSessionState, () => void] {
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingSessionState>({ status: 'loading' });

  const load = useCallback(() => {
    if (!user) return;
    setState({ status: 'loading' });
    const correlationId = newCorrelationId();
    loadOnboardingSession(user.id, correlationId)
      .then((result) => {
        if (!result.ok) {
          setState({ status: 'error', correlationId, message: result.error.userMessage });
          return;
        }
        if (result.data === null) {
          setState({ status: 'no-profile' });
          return;
        }
        setState({ status: 'ready', session: result.data });
      })
      .catch(() => setState({ status: 'error', correlationId, message: 'Une erreur est survenue.' }));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return [state, load];
}
