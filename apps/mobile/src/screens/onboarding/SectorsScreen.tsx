import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ONBOARDING_MAX_SECTORS } from '@ise/validation';

import { frOnboarding, t } from '../../i18n/onboarding';
import { newCorrelationId } from '../../lib/correlation';
import {
  advanceOnboarding,
  loadSectors,
  loadSelectedSectorIds,
  saveSectors,
  type SectorOption,
} from '../../lib/queries/onboarding';
import type { OnboardingStackParamList } from '../../navigation/onboarding-types';
import { colors, space, textStyle } from '../../theme/tokens';
import { InfoBanner } from './_components/InfoBanner';
import { StepActions } from './_components/StepActions';
import { StepScaffold } from './_components/StepScaffold';
import { TokenPicker, type TokenOption } from './_components/TokenPicker';
import { useOnboardingSession } from './_components/useOnboardingSession';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingSecteurs'>;

/** Étape 4/7 — Secteurs (ISE-011). 35 secteurs, `public.sectors` (D-64). Étape passable. */
export function SectorsScreen({ navigation }: Props) {
  const [state, reload] = useOnboardingSession();
  const [sectors, setSectors] = useState<readonly SectorOption[]>([]);
  const [selected, setSelected] = useState<readonly TokenOption[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (state.status !== 'ready') return;
    const correlationId = newCorrelationId();
    Promise.all([
      loadSectors(correlationId),
      loadSelectedSectorIds(state.session.profile.id, correlationId),
    ]).then(([sectorsResult, selectedResult]) => {
      if (sectorsResult.ok) setSectors(sectorsResult.data);
      if (sectorsResult.ok && selectedResult.ok) {
        setSelected(
          sectorsResult.data
            .filter((sector) => selectedResult.data.includes(sector.id))
            .map((sector) => ({ value: String(sector.id), label: sector.name })),
        );
      }
    });
  }, [state]);

  async function submit(skip: boolean) {
    if (state.status !== 'ready') return;
    setPending(true);
    setError(undefined);
    const correlationId = newCorrelationId();

    const sectorIds = skip ? [] : selected.map((option) => Number(option.value));
    const saved = await saveSectors(state.session.profile.id, sectorIds, correlationId);
    if (!saved.ok) {
      setPending(false);
      setError(saved.error.userMessage);
      return;
    }

    const result = await advanceOnboarding(
      state.session.profile.id,
      4,
      state.session.progress.furthestStep,
      correlationId,
      { skipped: skip },
    );
    setPending(false);
    if (!result.ok) {
      setError(result.error.userMessage);
      return;
    }
    navigation.navigate('OnboardingLocalisation');
  }

  return (
    <StepScaffold
      step={4}
      state={state}
      onRetry={reload}
      emptyTitle="Aucun profil rattaché à ce compte."
      emptyBody="Réclamez votre profil référencé avant de poursuivre l’onboarding."
    >
      {() => (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>{frOnboarding.sectors.title}</Text>
            <Text style={styles.subtitle}>
              {t(frOnboarding.sectors.subtitle, { max: ONBOARDING_MAX_SECTORS })}
            </Text>
          </View>

          <InfoBanner title={frOnboarding.sectors.adviceTitle} body={frOnboarding.sectors.adviceBody} />

          <TokenPicker
            searchLabel={frOnboarding.sectors.searchLabel}
            searchPlaceholder={frOnboarding.sectors.searchPlaceholder}
            options={sectors.map((sector) => ({ value: String(sector.id), label: sector.name }))}
            selected={selected}
            onChange={setSelected}
            max={ONBOARDING_MAX_SECTORS}
            emptyLabel="Aucun secteur ne correspond à cette recherche."
          />

          <InfoBanner variant="success" title={frOnboarding.sectors.noAutoTitle} />

          {error ? <Text style={styles.formError}>{error}</Text> : null}

          <StepActions
            submitLabel={frOnboarding.sectors.submit}
            pendingLabel={frOnboarding.sectors.submitPending}
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
