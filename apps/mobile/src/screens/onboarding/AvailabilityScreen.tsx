import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AVAILABILITY_INTENSITY_MAX_PER_MONTH, type AvailabilityIntensity } from '@ise/validation';

import { frOnboarding } from '../../i18n/onboarding';
import { newCorrelationId } from '../../lib/correlation';
import {
  advanceOnboarding,
  loadAvailabilityTypes,
  loadDeclaredAvailabilities,
  loadProfileVisibility,
  saveAvailability,
  type AvailabilityTypeOption,
  type DeclaredAvailability,
  type VisibilityLevel,
} from '../../lib/queries/onboarding';
import type { OnboardingStackParamList } from '../../navigation/onboarding-types';
import { colors, space, textStyle } from '../../theme/tokens';
import { InfoBanner } from './_components/InfoBanner';
import { OptionCardGroup } from './_components/OptionCardGroup';
import { SelectModal } from './_components/SelectModal';
import { StepActions } from './_components/StepActions';
import { StepScaffold } from './_components/StepScaffold';
import { useOnboardingSession } from './_components/useOnboardingSession';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingDisponibilite'>;

const VISIBILITY_OPTIONS: readonly { value: VisibilityLevel; label: string }[] = [
  { value: 'private', label: frOnboarding.visibility.private },
  { value: 'connections', label: frOnboarding.visibility.connections },
  { value: 'promotion', label: frOnboarding.visibility.promotion },
  { value: 'members', label: frOnboarding.visibility.members },
];

function intensityOf(declared: readonly DeclaredAvailability[]): AvailabilityIntensity {
  const max = declared.reduce((best, entry) => Math.max(best, entry.maxPerMonth ?? 0), 0);
  if (max >= AVAILABILITY_INTENSITY_MAX_PER_MONTH.high) return 'high';
  if (max >= AVAILABILITY_INTENSITY_MAX_PER_MONTH.moderate) return 'moderate';
  return 'low';
}

/** Étape 6/7 — Disponibilité (ISE-013). 14 types (D-65), plafond mensuel déclaré. */
export function AvailabilityScreen({ navigation }: Props) {
  const [state, reload] = useOnboardingSession();
  const [types, setTypes] = useState<readonly AvailabilityTypeOption[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<readonly string[]>([]);
  const [intensity, setIntensity] = useState<AvailabilityIntensity>('low');
  const [visibility, setVisibility] = useState<VisibilityLevel>('connections');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (state.status !== 'ready') return;
    const correlationId = newCorrelationId();
    Promise.all([
      loadAvailabilityTypes(correlationId),
      loadDeclaredAvailabilities(state.session.profile.id, correlationId),
      loadProfileVisibility(state.session.profile.id, correlationId),
    ]).then(([typesResult, declaredResult, visibilityResult]) => {
      if (typesResult.ok) setTypes(typesResult.data);
      if (declaredResult.ok) {
        setSelectedTypes(declaredResult.data.filter((entry) => entry.active).map((entry) => entry.availabilityType));
        setIntensity(intensityOf(declaredResult.data));
      }
      if (visibilityResult.ok) {
        const level = visibilityResult.data['availabilities'];
        if (level) setVisibility(level);
      }
    });
  }, [state]);

  async function submit(skip: boolean) {
    if (state.status !== 'ready') return;
    setPending(true);
    setError(undefined);
    const correlationId = newCorrelationId();

    if (!skip) {
      const saved = await saveAvailability(
        state.session.profile.id,
        { availabilityTypes: selectedTypes, intensity, visibility },
        correlationId,
      );
      if (!saved.ok) {
        setPending(false);
        setError(saved.error.userMessage);
        return;
      }
    }

    const result = await advanceOnboarding(
      state.session.profile.id,
      6,
      state.session.progress.furthestStep,
      correlationId,
      { skipped: skip },
    );
    setPending(false);
    if (!result.ok) {
      setError(result.error.userMessage);
      return;
    }
    navigation.navigate('OnboardingFinalisation');
  }

  return (
    <StepScaffold
      step={6}
      state={state}
      onRetry={reload}
      emptyTitle="Aucun profil rattaché à ce compte."
      emptyBody="Réclamez votre profil référencé avant de poursuivre l’onboarding."
    >
      {() => (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>{frOnboarding.availability.title}</Text>
            <Text style={styles.subtitle}>{frOnboarding.availability.subtitle}</Text>
          </View>

          <InfoBanner title={frOnboarding.availability.calloutTitle} body={frOnboarding.availability.calloutBody} />

          <OptionCardGroup
            legend={frOnboarding.availability.title}
            mode="checkbox"
            items={types.map((type) => ({ value: type.code, label: type.name, description: type.description ?? undefined }))}
            values={selectedTypes}
            onChange={setSelectedTypes}
          />

          <OptionCardGroup
            legend={frOnboarding.availability.intensityLabel}
            mode="radio"
            items={[
              { value: 'low', label: frOnboarding.availability.intensity.low },
              { value: 'moderate', label: frOnboarding.availability.intensity.moderate },
              { value: 'high', label: frOnboarding.availability.intensity.high },
            ]}
            values={[intensity]}
            onChange={(next) => setIntensity((next[0] as AvailabilityIntensity | undefined) ?? 'low')}
          />

          <SelectModal
            label={frOnboarding.availability.visibilityLabel}
            placeholder={frOnboarding.availability.visibilityLabel}
            options={VISIBILITY_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            value={visibility}
            onChange={(next) => setVisibility(next as VisibilityLevel)}
            searchable={false}
          />

          <InfoBanner variant="success" title={frOnboarding.availability.noObligationTitle} />

          {error ? <Text style={styles.formError}>{error}</Text> : null}

          <StepActions
            submitLabel={frOnboarding.availability.submit}
            pendingLabel={frOnboarding.availability.submitPending}
            isPending={pending}
            onSubmit={() => submit(false)}
            onBack={() => navigation.goBack()}
            onSkip={() => submit(true)}
          />
        </>
      )}
    </StepScaffold>
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
  formError: {
    ...textStyle.bodySm,
    color: colors.error,
  },
});
