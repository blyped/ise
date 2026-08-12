import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../lib/auth/AuthProvider';
import { frOnboarding } from '../../i18n/onboarding';
import { newCorrelationId } from '../../lib/correlation';
import { advanceOnboarding } from '../../lib/queries/onboarding';
import type { OnboardingStackParamList } from '../../navigation/onboarding-types';
import { colors, rounded, space, textStyle } from '../../theme/tokens';
import { Checkbox } from './_components/Checkbox';
import { InfoBanner } from './_components/InfoBanner';
import { StepActions } from './_components/StepActions';
import { StepScaffold } from './_components/StepScaffold';
import { useOnboardingSession } from './_components/useOnboardingSession';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingVerification'>;

/**
 * Étape 1/7 — Vérification (ISE-007).
 *
 * ÉCART ASSUMÉ, identique au web (D-03/D-111) : la maquette montre un code
 * à 6 chiffres. Aucun code n'est envoyé : l'adresse du compte est déjà
 * confirmée par Supabase Auth, et l'association du profil a déjà été
 * vérifiée à la réclamation (ISE-006). L'écran montre l'ÉTAT RÉEL, lu en
 * base, et demande une confirmation explicite.
 */
export function VerificationScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [state, reload] = useOnboardingSession();
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function handleSubmit() {
    if (state.status !== 'ready' || !acknowledged) return;
    setPending(true);
    setError(undefined);
    const correlationId = newCorrelationId();

    const result = await advanceOnboarding(
      state.session.profile.id,
      1,
      state.session.progress.furthestStep,
      correlationId,
    );

    setPending(false);
    if (!result.ok) {
      setError(result.error.userMessage);
      return;
    }
    navigation.navigate('OnboardingPromotion');
  }

  return (
    <StepScaffold
      step={1}
      state={state}
      onRetry={reload}
      emptyTitle="Aucun profil rattaché à ce compte."
      emptyBody="Réclamez votre profil référencé avant de poursuivre l’onboarding."
    >
      {(session) => (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>{frOnboarding.verification.title}</Text>
            <Text style={styles.subtitle}>{frOnboarding.verification.subtitle}</Text>
          </View>

          <View style={styles.card}>
            <Row
              label={frOnboarding.verification.accountEmailLabel}
              value={user?.email ?? '—'}
              badge={
                user?.email_confirmed_at
                  ? frOnboarding.verification.accountConfirmed
                  : frOnboarding.verification.accountNotConfirmed
              }
              tone={user?.email_confirmed_at ? 'success' : 'warning'}
            />
            <Row
              label={frOnboarding.verification.profileLabel}
              value={
                session.profile.displayName ??
                `${session.profile.firstName} ${session.profile.lastName}`.trim()
              }
            />
            <Row
              label={frOnboarding.verification.verificationLabel}
              value=""
              badge={
                session.profile.verificationStatus === 'verified'
                  ? frOnboarding.verification.accountConfirmed
                  : frOnboarding.verification.accountNotConfirmed
              }
              tone={session.profile.verificationStatus === 'verified' ? 'success' : 'warning'}
            />
          </View>

          <InfoBanner
            title={frOnboarding.verification.noCodeTitle}
            body={frOnboarding.verification.noCodeBody}
          />

          <Checkbox
            label={frOnboarding.verification.acknowledge}
            checked={acknowledged}
            onChange={setAcknowledged}
          />

          {error ? <Text style={styles.formError}>{error}</Text> : null}

          <StepActions
            submitLabel={frOnboarding.verification.submit}
            pendingLabel={frOnboarding.verification.submitPending}
            isPending={pending}
            onSubmit={handleSubmit}
            disabled={!acknowledged}
          />
        </>
      )}
    </StepScaffold>
  );
}

function Row({
  label,
  value,
  badge,
  tone,
}: {
  label: string;
  value: string;
  badge?: string | undefined;
  tone?: 'success' | 'warning' | undefined;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValueWrap}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {badge ? (
          <View style={[styles.badge, tone === 'success' ? styles.badgeSuccess : styles.badgeWarning]}>
            <Text style={[styles.badgeLabel, tone === 'success' ? styles.badgeLabelSuccess : styles.badgeLabelWarning]}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: space[2],
  },
  title: {
    ...textStyle.h2,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    ...textStyle.body,
    color: colors.textSecondary,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.lg,
    backgroundColor: colors.surface,
    padding: space[5],
    gap: space[4],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
  },
  rowLabel: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
  rowValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  rowValue: {
    ...textStyle.bodySm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  badge: {
    paddingHorizontal: space[3],
    paddingVertical: 2,
    borderRadius: rounded.full,
  },
  badgeSuccess: {
    backgroundColor: '#DCFCE7',
  },
  badgeWarning: {
    backgroundColor: '#FEF3C7',
  },
  badgeLabel: {
    ...textStyle.caption,
    fontWeight: '700',
  },
  badgeLabelSuccess: {
    color: colors.success,
  },
  badgeLabelWarning: {
    color: colors.warning,
  },
  formError: {
    ...textStyle.bodySm,
    color: colors.error,
  },
});
