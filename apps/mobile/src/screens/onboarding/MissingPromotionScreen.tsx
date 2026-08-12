import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { frOnboarding } from '../../i18n/onboarding';
import { newCorrelationId } from '../../lib/correlation';
import {
  loadCountries,
  loadMyPromotionSuggestions,
  reportMissingPromotion,
  type CountryOption,
  type PromotionSuggestion,
} from '../../lib/queries/onboarding';
import type { OnboardingStackParamList } from '../../navigation/onboarding-types';
import { useOnboardingSession } from './_components/useOnboardingSession';
import { colors, rounded, space, textStyle } from '../../theme/tokens';
import { InfoBanner } from './_components/InfoBanner';
import { SelectModal } from './_components/SelectModal';
import { StepHeader } from './_components/StepHeader';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingPromotionSignaler'>;

/**
 * ISE-009 — Signaler une promotion absente (sous-écran de l'étape 2).
 * Alimente `public.promotion_suggestions` : aucune promotion n'est créée
 * automatiquement, exactement comme la maquette et le web.
 */
export function MissingPromotionScreen({ navigation }: Props) {
  const [state] = useOnboardingSession();
  const [countries, setCountries] = useState<readonly CountryOption[]>([]);
  const [mine, setMine] = useState<readonly PromotionSuggestion[]>([]);

  const [promotionLabel, setPromotionLabel] = useState('');
  const [institution, setInstitution] = useState('');
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [approximateYear, setApproximateYear] = useState('');
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [sent, setSent] = useState<'none' | 'sent' | 'duplicate'>('none');

  useEffect(() => {
    if (state.status !== 'ready') return;
    const correlationId = newCorrelationId();
    loadCountries(correlationId).then((result) => {
      if (result.ok) setCountries(result.data);
    });
    loadMyPromotionSuggestions(state.session.profile.id, correlationId).then((result) => {
      if (result.ok) setMine(result.data);
    });
  }, [state]);

  async function handleSubmit() {
    if (state.status !== 'ready' || promotionLabel.trim().length < 2) return;
    setPending(true);
    setError(undefined);
    const correlationId = newCorrelationId();

    const result = await reportMissingPromotion(
      state.session.profile.id,
      {
        promotionLabel: promotionLabel.trim(),
        institution: institution.trim() || undefined,
        countryCode: countryCode ?? undefined,
        approximateYear: approximateYear ? Number(approximateYear) : undefined,
        comment: comment.trim() || undefined,
      },
      correlationId,
    );

    setPending(false);
    if (!result.ok) {
      setError(result.error.userMessage);
      return;
    }
    setSent(result.data.duplicate ? 'duplicate' : 'sent');
  }

  return (
    <Screen>
      <StepHeader step={2} />
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>{frOnboarding.missingPromotion.title}</Text>
          <Text style={styles.subtitle}>{frOnboarding.missingPromotion.subtitle}</Text>
        </View>

        <InfoBanner
          title={frOnboarding.missingPromotion.noBlockTitle}
          body={frOnboarding.missingPromotion.noBlockBody}
        />

        {sent !== 'none' ? (
          <View style={styles.form}>
            <InfoBanner
              variant="success"
              title={sent === 'duplicate' ? frOnboarding.missingPromotion.duplicateTitle : frOnboarding.missingPromotion.sentTitle}
              body={frOnboarding.missingPromotion.sentBody}
            />
            <Pressable onPress={() => navigation.goBack()} accessibilityRole="button">
              <Text style={styles.backLink}>{frOnboarding.missingPromotion.backLink}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <TextField
              label={frOnboarding.missingPromotion.labelField}
              placeholder={frOnboarding.missingPromotion.labelPlaceholder}
              value={promotionLabel}
              onChangeText={setPromotionLabel}
            />
            <TextField
              label={frOnboarding.missingPromotion.institutionField}
              placeholder={frOnboarding.missingPromotion.institutionPlaceholder}
              value={institution}
              onChangeText={setInstitution}
            />
            <SelectModal
              label={frOnboarding.missingPromotion.countryField}
              placeholder={frOnboarding.missingPromotion.countryPlaceholder}
              options={countries.map((country) => ({ value: country.code, label: country.name }))}
              value={countryCode}
              onChange={setCountryCode}
            />
            <TextField
              label={frOnboarding.missingPromotion.yearField}
              placeholder={frOnboarding.missingPromotion.yearPlaceholder}
              value={approximateYear}
              onChangeText={setApproximateYear}
              keyboardType="number-pad"
            />
            <TextField
              label={frOnboarding.missingPromotion.commentField}
              placeholder={frOnboarding.missingPromotion.commentPlaceholder}
              value={comment}
              onChangeText={setComment}
              multiline
            />

            <InfoBanner variant="success" title={frOnboarding.missingPromotion.qualifyTitle} />

            {error ? <Text style={styles.formError}>{error}</Text> : null}

            <Button
              label={pending ? frOnboarding.missingPromotion.submitPending : frOnboarding.missingPromotion.submit}
              onPress={handleSubmit}
              loading={pending}
              disabled={promotionLabel.trim().length < 2}
            />

            <Pressable onPress={() => navigation.goBack()} accessibilityRole="button">
              <Text style={styles.backLink}>{frOnboarding.missingPromotion.backLink}</Text>
            </Pressable>
          </View>
        )}

        {mine.length > 0 ? (
          <View style={styles.mineCard}>
            <Text style={styles.mineTitle}>{frOnboarding.missingPromotion.mineTitle}</Text>
            {mine.map((item) => (
              <View key={item.id} style={styles.mineRow}>
                <Text style={styles.mineLabel}>{item.promotionLabel}</Text>
                <Text style={styles.mineStatus}>
                  {frOnboarding.missingPromotion.status[item.status] ?? item.status}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: space[2],
    marginVertical: space[5],
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
  form: {
    gap: space[5],
    marginTop: space[5],
  },
  formError: {
    ...textStyle.bodySm,
    color: colors.error,
  },
  backLink: {
    ...textStyle.bodySm,
    color: colors.actionBlue,
    fontWeight: '600',
    textAlign: 'center',
  },
  mineCard: {
    marginTop: space[7],
    marginBottom: space[9],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.lg,
    padding: space[5],
    gap: space[3],
  },
  mineTitle: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  mineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mineLabel: {
    ...textStyle.bodySm,
    color: colors.textPrimary,
  },
  mineStatus: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
});
