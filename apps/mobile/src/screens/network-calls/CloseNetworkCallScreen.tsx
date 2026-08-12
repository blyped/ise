import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { frNetworkCalls } from '../../i18n/network-calls';
import { newCorrelationId } from '../../lib/correlation';
import {
  CLOSURE_MISSING_REASONS,
  CLOSURE_RESULT_TYPES,
  RESOLUTIONS,
  closeCall,
  loadCallTracking,
  loadRespondents,
  type NetworkCallTracking,
  type Resolution,
  type Respondent,
} from '../../lib/queries/network-calls';
import type { NetworkCallsStackParamList } from '../../navigation/NetworkCallsStack';
import { colors, rounded, space, textStyle } from '../../theme/tokens';

type Props = NativeStackScreenProps<NetworkCallsStackParamList, 'AppelCloture'>;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'ready'; call: NetworkCallTracking; respondents: Respondent[] };

/**
 * ISE-054 — Clôture d'un appel et mesure d'impact (coquille mobile).
 *
 * D-52 : la résolution est TERNAIRE — `resolved` / `partially_resolved` /
 * `not_resolved`, jamais un booléen. Comme
 * `apps/web/src/components/calls/ClosureForm.tsx` :
 *   - « résultat obtenu » ne s'affiche que si résolu ou partiellement ;
 *   - « ce qui a manqué » ne s'affiche que si partiellement ou non résolu ;
 *   - une clôture non résolue n'envoie jamais `resultType`, et une
 *     clôture pleinement résolue n'envoie jamais `missingReason` — la
 *     base rejetterait la combinaison inverse (0052).
 */
export function CloseNetworkCallScreen({ route, navigation }: Props) {
  const { callId } = route.params;
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [resolution, setResolution] = useState<Resolution | null>(null);
  const [resultType, setResultType] = useState<string | null>(null);
  const [missingReason, setMissingReason] = useState<string | null>(null);
  const [contributorIds, setContributorIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [testimonial, setTestimonial] = useState('');
  const [testimonialConsent, setTestimonialConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadCallTracking(callId), loadRespondents(callId)])
      .then(([trackingResult, respondentsResult]) => {
        if (trackingResult.failed || trackingResult.data === null) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }
        setState({
          status: 'ready',
          call: trackingResult.data,
          respondents: respondentsResult.failed || respondentsResult.data === null ? [] : respondentsResult.data,
        });
      })
      .catch(() => setState({ status: 'error', correlationId: newCorrelationId() }));
  }, [callId]);

  const submit = useCallback(() => {
    if (resolution === null) {
      setError(frNetworkCalls.closure.questionResolution);
      return;
    }
    setSubmitting(true);
    setError(null);
    closeCall({
      callId,
      resolution,
      resultType,
      missingReason,
      notes: notes.trim().length > 0 ? notes.trim() : null,
      testimonial: testimonial.trim().length > 0 ? testimonial.trim() : null,
      testimonialConsent,
      contributorIds,
    })
      .then((result) => {
        setSubmitting(false);
        if (result.failed) {
          setError(frNetworkCalls.common.loadErrorTitle);
          return;
        }
        navigation.replace('AppelSuivi', { callId });
      })
      .catch(() => setSubmitting(false));
  }, [callId, resolution, resultType, missingReason, notes, testimonial, testimonialConsent, contributorIds, navigation]);

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
        <ErrorState title={frNetworkCalls.common.loadErrorTitle} correlationId={state.correlationId} />
      </Screen>
    );
  }

  const { call, respondents } = state;
  const showResult = resolution === 'resolved' || resolution === 'partially_resolved';
  const showMissing = resolution === 'partially_resolved' || resolution === 'not_resolved';

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Pressable onPress={navigation.goBack} accessibilityRole="button" style={styles.backBar}>
          <Text style={styles.backLabel}>{frNetworkCalls.common.back}</Text>
        </Pressable>

        <Text style={styles.heading}>{frNetworkCalls.closure.title}</Text>
        <Text style={styles.subtitle}>{frNetworkCalls.closure.subtitle}</Text>
        <Text style={styles.callTitle}>{call.title}</Text>

        {error !== null ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.fieldLabel}>{frNetworkCalls.closure.questionResolution}</Text>
        <Text style={styles.hint}>{frNetworkCalls.closure.resolutionHint}</Text>
        <View style={styles.optionColumn}>
          {RESOLUTIONS.map((value) => (
            <OptionRow
              key={value}
              label={frNetworkCalls.closure[value]}
              description={
                value === 'resolved'
                  ? frNetworkCalls.closure.resolvedHint
                  : value === 'partially_resolved'
                    ? frNetworkCalls.closure.partiallyHint
                    : frNetworkCalls.closure.notResolvedHint
              }
              selected={resolution === value}
              onPress={() => setResolution(value)}
            />
          ))}
        </View>

        {showResult ? (
          <>
            <Text style={styles.fieldLabel}>{frNetworkCalls.closure.questionResult}</Text>
            <View style={styles.chipWrap}>
              {CLOSURE_RESULT_TYPES.map((value) => (
                <Chip
                  key={value}
                  label={frNetworkCalls.closure.resultType[value] ?? value}
                  active={resultType === value}
                  onPress={() => setResultType(value)}
                />
              ))}
            </View>
          </>
        ) : null}

        {showMissing ? (
          <>
            <Text style={styles.fieldLabel}>{frNetworkCalls.closure.questionMissing}</Text>
            <View style={styles.chipWrap}>
              {CLOSURE_MISSING_REASONS.map((value) => (
                <Chip
                  key={value}
                  label={frNetworkCalls.closure.missingReason[value] ?? value}
                  active={missingReason === value}
                  onPress={() => setMissingReason(value)}
                />
              ))}
            </View>
          </>
        ) : null}

        {respondents.length > 0 ? (
          <>
            <Text style={styles.fieldLabel}>{frNetworkCalls.closure.questionContributors}</Text>
            <Text style={styles.hint}>{frNetworkCalls.closure.contributorsHint}</Text>
            <View style={styles.chipWrap}>
              {respondents.map((respondent) => (
                <Chip
                  key={respondent.profileId}
                  label={respondent.profile?.displayName ?? respondent.profileId}
                  active={contributorIds.includes(respondent.profileId)}
                  onPress={() =>
                    setContributorIds((prev) =>
                      prev.includes(respondent.profileId)
                        ? prev.filter((id) => id !== respondent.profileId)
                        : [...prev, respondent.profileId],
                    )
                  }
                />
              ))}
            </View>
          </>
        ) : null}

        <TextField
          label={frNetworkCalls.closure.notesLabel}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />
        <TextField
          label={frNetworkCalls.closure.testimonialLabel}
          value={testimonial}
          onChangeText={setTestimonial}
          multiline
          numberOfLines={3}
        />
        <Pressable
          onPress={() => setTestimonialConsent((v) => !v)}
          style={styles.checkboxRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: testimonialConsent }}
        >
          <View style={[styles.checkboxBox, testimonialConsent ? styles.checkboxBoxChecked : null]}>
            {testimonialConsent ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </View>
          <Text style={styles.checkboxLabel}>{frNetworkCalls.closure.consentLabel}</Text>
        </Pressable>

        {resolution === 'not_resolved' ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>{frNetworkCalls.closure.noImpactTitle}</Text>
            <Text style={styles.hint}>{frNetworkCalls.closure.noImpactBody}</Text>
          </View>
        ) : null}

        <View style={styles.submitRow}>
          <Button
            label={submitting ? frNetworkCalls.closure.submitPending : frNetworkCalls.closure.submit}
            onPress={submit}
            loading={submitting}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function OptionRow({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.optionRow, selected ? styles.optionRowSelected : null]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.optionLabel, selected ? styles.optionLabelSelected : null]}>{label}</Text>
      <Text style={styles.optionDescription}>{description}</Text>
    </Pressable>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active ? styles.chipActive : null]}>
      <Text style={[styles.chipLabel, active ? styles.chipActiveLabel : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backBar: { marginBottom: space[3] },
  backLabel: { ...textStyle.bodySm, color: colors.actionBlue, fontWeight: '600' },
  heading: { ...textStyle.h2, fontWeight: '700', color: colors.textPrimary },
  subtitle: { ...textStyle.bodySm, color: colors.textSecondary, marginBottom: space[2] },
  callTitle: { ...textStyle.caption, color: colors.textMuted, marginBottom: space[5] },
  errorText: { ...textStyle.bodySm, color: colors.error, marginBottom: space[4] },
  fieldLabel: { ...textStyle.bodySm, fontWeight: '700', color: colors.textPrimary, marginBottom: space[1] },
  hint: { ...textStyle.caption, color: colors.textMuted, marginBottom: space[3] },
  optionColumn: { gap: space[3], marginBottom: space[5] },
  optionRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    padding: space[4],
  },
  optionRowSelected: { borderColor: colors.actionBlue, backgroundColor: colors.surfaceMuted },
  optionLabel: { ...textStyle.bodySm, fontWeight: '700', color: colors.textPrimary },
  optionLabelSelected: { color: colors.actionBlue },
  optionDescription: { ...textStyle.caption, color: colors.textMuted, marginTop: 2 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginBottom: space[5] },
  chip: {
    paddingVertical: space[2],
    paddingHorizontal: space[4],
    borderRadius: rounded.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.actionBlue, borderColor: colors.actionBlue },
  chipLabel: { ...textStyle.caption, color: colors.textSecondary, fontWeight: '600' },
  chipActiveLabel: { ...textStyle.caption, color: colors.textInverse, fontWeight: '700' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginTop: space[4] },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: rounded.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: { backgroundColor: colors.actionBlue, borderColor: colors.actionBlue },
  checkboxMark: { color: colors.textInverse, fontSize: 14, fontWeight: '700' },
  checkboxLabel: { ...textStyle.bodySm, color: colors.textPrimary, flexShrink: 1 },
  noticeBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: rounded.base,
    padding: space[4],
    marginTop: space[5],
    gap: space[1],
  },
  noticeTitle: { ...textStyle.bodySm, fontWeight: '700', color: colors.textPrimary },
  submitRow: { marginTop: space[6], marginBottom: space[10] },
});
