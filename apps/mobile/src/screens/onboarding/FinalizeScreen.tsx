import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { frOnboarding, t } from '../../i18n/onboarding';
import { newCorrelationId } from '../../lib/correlation';
import {
  completeOnboarding,
  loadCountries,
  loadDeclaredAvailabilities,
  loadExperienceCountryCodes,
  loadMissingItems,
  loadMyCompletion,
  loadPromotionById,
  loadSectors,
  loadSelectedSectorIds,
  loadSelectedSkills,
  type MissingItem,
} from '../../lib/queries/onboarding';
import type { OnboardingStackParamList } from '../../navigation/onboarding-types';
import { colors, rounded, space, textStyle } from '../../theme/tokens';
import { Checkbox } from './_components/Checkbox';
import { InfoBanner } from './_components/InfoBanner';
import { StepActions } from './_components/StepActions';
import { StepScaffold } from './_components/StepScaffold';
import { useOnboardingSession } from './_components/useOnboardingSession';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingFinalisation'>;

interface Summary {
  promotionLabel: string;
  skillsCount: number;
  sectorsCount: number;
  locationLabel: string;
  availabilityCount: number;
  completion: number | null;
  missing: readonly MissingItem[];
}

/**
 * Étape 7/7 — Finalisation (ISE-014). Le récapitulatif et le score sont
 * LUS EN BASE (`my_profile_completion`, `my_profile_missing_items`, D-72) :
 * rien n'est estimé côté client. `complete_onboarding()` pose seule
 * `onboarding_completed_at`.
 */
export function FinalizeScreen({ navigation }: Props) {
  const [state, reload] = useOnboardingSession();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (state.status !== 'ready') return;
    const profile = state.session.profile;
    const correlationId = newCorrelationId();

    Promise.all([
      loadSelectedSkills(profile.id, correlationId),
      loadSelectedSectorIds(profile.id, correlationId),
      loadSectors(correlationId),
      loadExperienceCountryCodes(profile.id, correlationId),
      loadCountries(correlationId),
      loadDeclaredAvailabilities(profile.id, correlationId),
      loadMissingItems(correlationId),
      loadMyCompletion(),
      profile.promotionId !== null
        ? loadPromotionById(profile.promotionId, correlationId)
        : Promise.resolve({ ok: true as const, data: null }),
    ]).then(([skills, sectorIds, sectors, zones, countries, availabilities, missing, completion, promotion]) => {
      const countryNames =
        countries.ok && zones.ok
          ? countries.data.filter((c) => zones.data.includes(c.code)).map((c) => c.name)
          : [];
      const locationLabel = [profile.currentCity, ...countryNames].filter(Boolean).join(' · ');

      setSummary({
        promotionLabel:
          promotion.ok && promotion.data
            ? `${promotion.data.programCode} ${promotion.data.graduationYear}`
            : frOnboarding.finalize.nothingYet,
        skillsCount: skills.ok ? skills.data.length : 0,
        sectorsCount: sectors.ok && sectorIds.ok ? sectorIds.data.length : 0,
        locationLabel: locationLabel.length > 0 ? locationLabel : frOnboarding.finalize.nothingYet,
        availabilityCount: availabilities.ok ? availabilities.data.filter((a) => a.active).length : 0,
        completion,
        missing: missing.ok ? missing.data : [],
      });
    });
  }, [state]);

  async function handleSubmit() {
    if (state.status !== 'ready' || !confirmed) return;
    setPending(true);
    setError(undefined);
    const correlationId = newCorrelationId();

    const result = await completeOnboarding(correlationId);
    setPending(false);
    if (!result.ok) {
      setError(result.error.userMessage);
      return;
    }
    // RootNavigator/AppTabs reprend la main : le profil est actif, la
    // pile d'onboarding n'a plus de raison d'être affichée (intégration
    // décrite dans le rapport de livraison).
  }

  const promotionMissing = state.status === 'ready' && state.session.profile.promotionId === null;

  return (
    <StepScaffold
      step={7}
      state={state}
      onRetry={reload}
      emptyTitle="Aucun profil rattaché à ce compte."
      emptyBody="Réclamez votre profil référencé avant de poursuivre l’onboarding."
    >
      {() => (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>{frOnboarding.finalize.title}</Text>
            <Text style={styles.subtitle}>{frOnboarding.finalize.subtitle}</Text>
          </View>

          {promotionMissing ? (
            <InfoBanner
              variant="warning"
              title={frOnboarding.finalize.promotionRequiredTitle}
              body={frOnboarding.finalize.promotionRequiredBody}
            />
          ) : null}

          {summary ? (
            <>
              <View style={styles.summary}>
                <Text style={styles.summaryTitle}>{frOnboarding.finalize.summaryTitle}</Text>
                <SummaryRow
                  label={frOnboarding.finalize.promotionLabel}
                  value={summary.promotionLabel}
                  onPress={() => navigation.navigate('OnboardingPromotion')}
                />
                <SummaryRow
                  label={frOnboarding.finalize.skillsLabel}
                  value={t(frOnboarding.finalize.countLabel, { count: summary.skillsCount })}
                  onPress={() => navigation.navigate('OnboardingCompetences')}
                />
                <SummaryRow
                  label={frOnboarding.finalize.sectorsLabel}
                  value={t(frOnboarding.finalize.countLabel, { count: summary.sectorsCount })}
                  onPress={() => navigation.navigate('OnboardingSecteurs')}
                />
                <SummaryRow
                  label={frOnboarding.finalize.locationLabel}
                  value={summary.locationLabel}
                  onPress={() => navigation.navigate('OnboardingLocalisation')}
                />
                <SummaryRow
                  label={frOnboarding.finalize.availabilityLabel}
                  value={t(frOnboarding.finalize.countLabel, { count: summary.availabilityCount })}
                  onPress={() => navigation.navigate('OnboardingDisponibilite')}
                />
              </View>

              <View style={styles.completionCard}>
                <Text style={styles.completionLabel}>{frOnboarding.finalize.completionLabel}</Text>
                {summary.completion === null ? (
                  <Text style={styles.completionUnknown}>{frOnboarding.finalize.completionUnknown}</Text>
                ) : (
                  <>
                    <Text style={styles.completionValue}>{summary.completion} %</Text>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${summary.completion}%` }]} />
                    </View>
                  </>
                )}

                {summary.missing.length > 0 ? (
                  <View style={styles.missingList}>
                    {summary.missing.map((item) => (
                      <View key={item.blockKey} style={styles.missingBadge}>
                        <Text style={styles.missingLabel}>
                          {item.label} · {Math.round(item.completionRatio * 100)} %
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </>
          ) : null}

          <Checkbox label={frOnboarding.finalize.confirm} checked={confirmed} onChange={setConfirmed} />

          {error ? <Text style={styles.formError}>{error}</Text> : null}

          <StepActions
            submitLabel={frOnboarding.finalize.submit}
            pendingLabel={frOnboarding.finalize.submitPending}
            isPending={pending}
            onSubmit={handleSubmit}
            onBack={() => navigation.goBack()}
            disabled={!confirmed}
          />
        </>
      )}
    </StepScaffold>
  );
}

function SummaryRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <View style={styles.summaryRow}>
      <View style={styles.summaryRowText}>
        <Text style={styles.summaryRowLabel}>{label}</Text>
        <Text style={styles.summaryRowValue}>{value}</Text>
      </View>
      <Pressable onPress={onPress} accessibilityRole="button">
        <Text style={styles.summaryEdit}>{frOnboarding.finalize.edit}</Text>
      </Pressable>
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
  summary: {
    gap: space[3],
  },
  summaryTitle: {
    ...textStyle.h4,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    paddingHorizontal: space[5],
    paddingVertical: space[4],
    gap: space[3],
  },
  summaryRowText: {
    flex: 1,
    gap: 2,
  },
  summaryRowLabel: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
  summaryRowValue: {
    ...textStyle.bodySm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  summaryEdit: {
    ...textStyle.bodySm,
    color: colors.actionBlue,
    fontWeight: '600',
  },
  completionCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.lg,
    padding: space[5],
    gap: space[3],
  },
  completionLabel: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  completionUnknown: {
    ...textStyle.body,
    color: colors.textSecondary,
  },
  completionValue: {
    ...textStyle.h2,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  progressTrack: {
    height: 6,
    borderRadius: rounded.full,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.actionBlue,
    borderRadius: rounded.full,
  },
  missingList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  missingBadge: {
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: rounded.full,
    backgroundColor: colors.surfaceMuted,
  },
  missingLabel: {
    ...textStyle.caption,
    color: colors.textSecondary,
  },
  formError: {
    ...textStyle.bodySm,
    color: colors.error,
  },
});
