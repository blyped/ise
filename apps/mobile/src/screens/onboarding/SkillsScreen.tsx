import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ONBOARDING_MAX_SKILLS } from '@ise/validation';

import { frOnboarding, t } from '../../i18n/onboarding';
import { newCorrelationId } from '../../lib/correlation';
import {
  advanceOnboarding,
  loadSelectedSkills,
  saveSkills,
  searchSkills,
  type SkillSearchResult,
} from '../../lib/queries/onboarding';
import type { OnboardingStackParamList } from '../../navigation/onboarding-types';
import { colors, space, textStyle } from '../../theme/tokens';
import { InfoBanner } from './_components/InfoBanner';
import { StepActions } from './_components/StepActions';
import { StepScaffold } from './_components/StepScaffold';
import { TokenPicker, type TokenOption } from './_components/TokenPicker';
import { useOnboardingSession } from './_components/useOnboardingSession';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingCompetences'>;

/** Étape 3/7 — Compétences (ISE-010). Recherche EN BASE (`search_skills`, D-46). */
export function SkillsScreen({ navigation }: Props) {
  const [state, reload] = useOnboardingSession();
  const [selected, setSelected] = useState<readonly TokenOption[]>([]);
  const [browse, setBrowse] = useState<readonly SkillSearchResult[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (state.status !== 'ready') return;
    const correlationId = newCorrelationId();
    loadSelectedSkills(state.session.profile.id, correlationId).then((result) => {
      if (result.ok) {
        setSelected(result.data.map((skill) => ({ value: String(skill.skillId), label: skill.name })));
      }
    });
    searchSkills(null, 60, correlationId).then((result) => {
      if (result.ok) setBrowse(result.data);
    });
  }, [state]);

  async function handleSearch(query: string): Promise<readonly TokenOption[]> {
    const result = await searchSkills(query, 40, newCorrelationId());
    if (!result.ok) return [];
    return result.data.map((skill) => ({
      value: String(skill.skillId),
      label: skill.name,
      hint: skill.categoryName,
    }));
  }

  async function handleSubmit() {
    if (state.status !== 'ready' || selected.length === 0) return;
    setPending(true);
    setError(undefined);
    const correlationId = newCorrelationId();

    const skillIds = selected.map((option) => Number(option.value));
    const saved = await saveSkills(state.session.profile.id, skillIds, correlationId);
    if (!saved.ok) {
      setPending(false);
      setError(saved.error.userMessage);
      return;
    }

    const result = await advanceOnboarding(
      state.session.profile.id,
      3,
      state.session.progress.furthestStep,
      correlationId,
    );
    setPending(false);
    if (!result.ok) {
      setError(result.error.userMessage);
      return;
    }
    navigation.navigate('OnboardingSecteurs');
  }

  return (
    <StepScaffold
      step={3}
      state={state}
      onRetry={reload}
      emptyTitle="Aucun profil rattaché à ce compte."
      emptyBody="Réclamez votre profil référencé avant de poursuivre l’onboarding."
    >
      {() => (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>{frOnboarding.skills.title}</Text>
            <Text style={styles.subtitle}>
              {t(frOnboarding.skills.subtitle, { max: ONBOARDING_MAX_SKILLS })}
            </Text>
          </View>

          <InfoBanner
            title={frOnboarding.skills.declarativeTitle}
            body={frOnboarding.skills.declarativeBody}
          />

          <TokenPicker
            searchLabel={frOnboarding.skills.searchLabel}
            searchPlaceholder={frOnboarding.skills.searchPlaceholder}
            options={browse.map((skill) => ({ value: String(skill.skillId), label: skill.name, hint: skill.categoryName }))}
            selected={selected}
            onChange={setSelected}
            max={ONBOARDING_MAX_SKILLS}
            emptyLabel={frOnboarding.skills.emptyTitle}
            onSearch={handleSearch}
          />

          {error ? <Text style={styles.formError}>{error}</Text> : null}

          <StepActions
            submitLabel={frOnboarding.skills.submit}
            pendingLabel={frOnboarding.skills.submitPending}
            isPending={pending}
            onSubmit={handleSubmit}
            onBack={() => navigation.goBack()}
            disabled={selected.length === 0}
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
