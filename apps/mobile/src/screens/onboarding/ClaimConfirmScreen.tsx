import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { frOnboarding } from '../../i18n/onboarding';
import { newCorrelationId } from '../../lib/correlation';
import {
  getClaimableProfile,
  submitClaim,
  type ClaimableProfileDetail,
} from '../../lib/queries/onboarding';
import type { OnboardingStackParamList } from '../../navigation/onboarding-types';
import { colors, rounded, space, textStyle } from '../../theme/tokens';
import { Checkbox } from './_components/Checkbox';
import { InfoBanner } from './_components/InfoBanner';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ReclamerProfilConfirmer'>;

type ClaimMethodValue = 'historical_email' | 'document' | 'promotion_manager';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string; message: string }
  | { status: 'unavailable' }
  | { status: 'ready'; profile: ClaimableProfileDetail };

/**
 * ISE-006 — Confirmer l'association du profil.
 *
 * Porte `apps/web/src/app/reclamer-mon-profil/[profileId]` : mêmes RPC
 * (`get_claimable_profile`, `submit_profile_claim`, migration 0029),
 * aucun `select` direct sur `ise_profiles` (le compte n'est pas encore
 * rattaché). `profileId` arrive en paramètre de route — ISE-005
 * (recherche) reste hors de cette tranche (secondaire, non critique) ; ce
 * paramètre suppose un point d'entrée en amont (recherche ou lien) à
 * brancher plus tard.
 */
export function ClaimConfirmScreen({ route, navigation }: Props) {
  const { profileId } = route.params;
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [method, setMethod] = useState<ClaimMethodValue | null>(null);
  const [confirmsIdentity, setConfirmsIdentity] = useState(false);
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    const correlationId = newCorrelationId();
    getClaimableProfile(profileId, correlationId)
      .then((result) => {
        if (!result.ok) {
          setState({ status: 'error', correlationId, message: result.error.userMessage });
          return;
        }
        if (result.data === null) {
          setState({ status: 'unavailable' });
          return;
        }
        setState({ status: 'ready', profile: result.data });
        setMethod(result.data.hasHistoricalEmail ? 'historical_email' : 'document');
      })
      .catch(() => setState({ status: 'error', correlationId, message: frOnboarding.shell.loadErrorTitle }));
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit() {
    if (state.status !== 'ready' || method === null) return;
    setPending(true);
    setSubmitError(undefined);
    const correlationId = newCorrelationId();

    const result = await submitClaim(state.profile.profileId, method, confirmsIdentity, correlationId);
    setPending(false);

    if (!result.ok) {
      setSubmitError(result.error.userMessage);
      return;
    }
    setSubmitted(true);
  }

  if (state.status === 'loading') {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.actionBlue} />
        </View>
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen>
        <ErrorState title={state.message} correlationId={state.correlationId} onRetry={load} />
      </Screen>
    );
  }

  if (state.status === 'unavailable') {
    return (
      <Screen>
        <InfoBanner
          variant="warning"
          title={frOnboarding.claim.confirm.unavailableTitle}
          body={frOnboarding.claim.confirm.unavailableBody}
        />
      </Screen>
    );
  }

  if (submitted) {
    return (
      <Screen>
        <InfoBanner variant="success" title={frOnboarding.claim.confirm.submit} />
        <View style={styles.submittedAction}>
          <Button
            label={frOnboarding.verification.submit}
            onPress={() => navigation.navigate('OnboardingVerification')}
          />
        </View>
      </Screen>
    );
  }

  const { profile } = state;
  const promotion =
    profile.graduationYear === null ? '—' : `ISE ${profile.graduationYear}`;

  const methods: Array<{ value: ClaimMethodValue; label: string; hint: string }> = [
    ...(profile.hasHistoricalEmail
      ? [
          {
            value: 'historical_email' as const,
            label: frOnboarding.claim.confirm.methodEmail,
            hint: frOnboarding.claim.confirm.methodEmailHint,
          },
        ]
      : []),
    {
      value: 'document',
      label: frOnboarding.claim.confirm.methodDocument,
      hint: frOnboarding.claim.confirm.methodDocumentHint,
    },
    {
      value: 'promotion_manager',
      label: frOnboarding.claim.confirm.methodPromotionManager,
      hint: frOnboarding.claim.confirm.methodPromotionManagerHint,
    },
  ];

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{frOnboarding.claim.confirm.title}</Text>
          <Text style={styles.subtitle}>{frOnboarding.claim.confirm.subtitle}</Text>
        </View>

        <View style={styles.profileCard}>
          <Text style={styles.profileName}>{profile.displayName}</Text>
          <Text style={styles.profileMeta}>
            {promotion}
            {profile.currentCity ? ` · ${profile.currentCity}` : ''}
          </Text>
          {profile.headline ? <Text style={styles.profileHeadline}>{profile.headline}</Text> : null}
        </View>

        <View style={styles.matches}>
          <Text style={styles.matchesTitle}>{frOnboarding.claim.confirm.matchTitle}</Text>
          <MatchRow label={frOnboarding.claim.confirm.promotionLabel} value={promotion} />
          <MatchRow label={frOnboarding.claim.confirm.cityLabel} value={profile.currentCity} />
          <MatchRow label={frOnboarding.claim.confirm.organizationLabel} value={profile.currentOrganization} />
          <MatchRow label={frOnboarding.claim.confirm.positionLabel} value={profile.currentPosition} />
          <MatchRow label={frOnboarding.claim.confirm.emailLabel} value={profile.emailHint} />
        </View>

        {!profile.hasHistoricalEmail ? (
          <InfoBanner title={frOnboarding.claim.confirm.methodEmailUnavailable} />
        ) : null}

        <View style={styles.methods}>
          <Text style={styles.methodsLegend}>{frOnboarding.claim.confirm.methodLegend}</Text>
          {methods.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => setMethod(item.value)}
              style={[styles.methodCard, method === item.value ? styles.methodCardSelected : null]}
              accessibilityRole="radio"
              accessibilityState={{ selected: method === item.value }}
            >
              <Text style={method === item.value ? styles.methodLabelSelected : styles.methodLabel}>
                {item.label}
              </Text>
              <Text style={styles.methodHint}>{item.hint}</Text>
            </Pressable>
          ))}
        </View>

        <Checkbox
          label={frOnboarding.claim.confirm.confirmLabel}
          checked={confirmsIdentity}
          onChange={setConfirmsIdentity}
        />

        {submitError ? <Text style={styles.formError}>{submitError}</Text> : null}

        <View style={styles.actions}>
          <Button
            label={pending ? frOnboarding.claim.confirm.submitPending : frOnboarding.claim.confirm.submit}
            onPress={handleSubmit}
            loading={pending}
            disabled={method === null || !confirmsIdentity}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function MatchRow({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.matchRow}>
      <Text style={styles.matchLabel}>{label}</Text>
      <Text style={styles.matchValue}>{value ?? frOnboarding.claim.confirm.notProvided}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    gap: space[2],
    marginBottom: space[5],
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
  profileCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: rounded.lg,
    padding: space[5],
    gap: space[1],
    marginBottom: space[5],
  },
  profileName: {
    ...textStyle.h4,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  profileMeta: {
    ...textStyle.bodySm,
    color: colors.actionBlue,
    fontWeight: '600',
  },
  profileHeadline: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
  matches: {
    gap: space[3],
    marginBottom: space[5],
  },
  matchesTitle: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  matchRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    gap: 2,
  },
  matchLabel: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
  matchValue: {
    ...textStyle.bodySm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  methods: {
    gap: space[3],
    marginBottom: space[5],
  },
  methodsLegend: {
    ...textStyle.bodySm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  methodCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    padding: space[4],
    gap: 4,
  },
  methodCardSelected: {
    borderColor: colors.actionBlue,
    backgroundColor: colors.surfaceMuted,
  },
  methodLabel: {
    ...textStyle.bodySm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  methodLabelSelected: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.actionBlue,
  },
  methodHint: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
  formError: {
    ...textStyle.bodySm,
    color: colors.error,
    marginTop: space[3],
  },
  actions: {
    marginTop: space[6],
    marginBottom: space[9],
  },
  submittedAction: {
    marginTop: space[6],
  },
});
