import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { frOnboarding } from '../../i18n/onboarding';
import { newCorrelationId } from '../../lib/correlation';
import {
  advanceOnboarding,
  loadPromotions,
  savePromotion,
  type PromotionOption,
} from '../../lib/queries/onboarding';
import type { OnboardingStackParamList } from '../../navigation/onboarding-types';
import { colors, space, textStyle } from '../../theme/tokens';
import { InfoBanner } from './_components/InfoBanner';
import { SelectModal } from './_components/SelectModal';
import { StepActions } from './_components/StepActions';
import { StepScaffold } from './_components/StepScaffold';
import { useOnboardingSession } from './_components/useOnboardingSession';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingPromotion'>;

type ReferentialState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string; message: string }
  | { status: 'ready'; promotions: readonly PromotionOption[] };

/** Étape 2/7 — Promotion (ISE-008). Le référentiel vient de `public.promotions` (D-64). */
export function PromotionScreen({ navigation }: Props) {
  const [state, reload] = useOnboardingSession();
  const [ref, setRef] = useState<ReferentialState>({ status: 'loading' });
  const [promotionId, setPromotionId] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (state.status !== 'ready') return;
    setPromotionId(state.session.profile.promotionId);
    const correlationId = newCorrelationId();
    loadPromotions(correlationId)
      .then((result) => {
        if (!result.ok) {
          setRef({ status: 'error', correlationId, message: result.error.userMessage });
          return;
        }
        setRef({ status: 'ready', promotions: result.data });
      })
      .catch(() => setRef({ status: 'error', correlationId, message: frOnboarding.shell.loadErrorTitle }));
  }, [state]);

  async function handleSubmit() {
    if (state.status !== 'ready' || promotionId === null) return;
    setPending(true);
    setError(undefined);
    const correlationId = newCorrelationId();

    const saved = await savePromotion(state.session.profile.id, promotionId, correlationId);
    if (!saved.ok) {
      setPending(false);
      setError(saved.error.userMessage);
      return;
    }

    const result = await advanceOnboarding(
      state.session.profile.id,
      2,
      state.session.progress.furthestStep,
      correlationId,
    );
    setPending(false);
    if (!result.ok) {
      setError(result.error.userMessage);
      return;
    }
    navigation.navigate('OnboardingCompetences');
  }

  return (
    <StepScaffold
      step={2}
      state={state}
      onRetry={reload}
      emptyTitle="Aucun profil rattaché à ce compte."
      emptyBody="Réclamez votre profil référencé avant de poursuivre l’onboarding."
    >
      {() => (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>{frOnboarding.promotion.title}</Text>
            <Text style={styles.subtitle}>{frOnboarding.promotion.subtitle}</Text>
          </View>


          {ref.status === 'error' ? (
            <ErrorState title={ref.message} correlationId={ref.correlationId} />
          ) : null}

          {ref.status === 'ready' && ref.promotions.length === 0 ? (
            <EmptyState title={frOnboarding.promotion.emptyTitle} description={frOnboarding.promotion.emptyBody} />
          ) : null}

          {ref.status === 'ready' && ref.promotions.length > 0 ? (
            <>
              <SelectModal
                label={frOnboarding.promotion.label}
                placeholder={frOnboarding.promotion.placeholder}
                options={ref.promotions.map((promotion) => ({
                  value: String(promotion.id),
                  label: `${promotion.programCode} ${promotion.graduationYear} — ${promotion.name}`,
                }))}
                value={promotionId === null ? null : String(promotionId)}
                onChange={(value) => setPromotionId(Number(value))}
              />

              <Pressable
                onPress={() => navigation.navigate('OnboardingPromotionSignaler')}
                accessibilityRole="button"
              >
                <Text style={styles.missingLink}>
                  {frOnboarding.promotion.missingLead} {frOnboarding.promotion.missingLink}
                </Text>
              </Pressable>

              <InfoBanner
                variant="success"
                title={frOnboarding.promotion.confirmTitle}
                body={frOnboarding.promotion.confirmBody}
              />

              {error ? <Text style={styles.formError}>{error}</Text> : null}

              <StepActions
                submitLabel={frOnboarding.promotion.submit}
                pendingLabel={frOnboarding.promotion.submitPending}
                isPending={pending}
                onSubmit={handleSubmit}
                onBack={() => navigation.goBack()}
                disabled={promotionId === null}
              />
            </>
          ) : null}
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
  missingLink: {
    ...textStyle.bodySm,
    color: colors.actionBlue,
    fontWeight: '600',
  },
  formError: {
    ...textStyle.bodySm,
    color: colors.error,
  },
});
