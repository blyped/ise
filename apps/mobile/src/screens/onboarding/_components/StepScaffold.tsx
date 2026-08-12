import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState } from '../../../components/EmptyState';
import { ErrorState } from '../../../components/ErrorState';
import { Screen } from '../../../components/Screen';
import { colors, space } from '../../../theme/tokens';
import { StepHeader } from './StepHeader';
import type { OnboardingSessionState } from './useOnboardingSession';

/**
 * Coquille commune aux 7 étapes : en-tête de progression (D-70/D-110),
 * puis état de chargement / erreur / compte non rattaché / contenu réel.
 * Équivalent mobile de `OnboardingShell` (`apps/web`).
 */
export function StepScaffold({
  step,
  state,
  onRetry,
  emptyTitle,
  emptyBody,
  children,
}: {
  step: number;
  state: OnboardingSessionState;
  onRetry: () => void;
  emptyTitle: string;
  emptyBody: string;
  children: (session: Extract<OnboardingSessionState, { status: 'ready' }>['session']) => ReactNode;
}) {
  return (
    <Screen>
      <StepHeader step={step} />

      {state.status === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.actionBlue} />
        </View>
      ) : null}

      {state.status === 'error' ? (
        <ErrorState title={state.message} correlationId={state.correlationId} onRetry={onRetry} />
      ) : null}

      {state.status === 'no-profile' ? <EmptyState title={emptyTitle} description={emptyBody} /> : null}

      {state.status === 'ready' ? (
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>{children(state.session)}</View>
        </ScrollView>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: space[6],
    paddingBottom: space[9],
  },
});
