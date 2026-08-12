import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { frRelations } from '../../i18n/relations';
import { newCorrelationId } from '../../lib/correlation';
import {
  INTRODUCTION_OUTCOMES,
  declareIntroductionOutcome,
  loadIntroduction,
  type IntroductionDetail,
  type IntroductionOutcome,
} from '../../lib/queries/relations';
import type { RelationsStackParamList } from '../../navigation/RelationsStack';
import { colors, rounded, space, textStyle } from '../../theme/tokens';

type Props = NativeStackScreenProps<RelationsStackParamList, 'IntroductionOutcome'>;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'notFound' }
  | { status: 'ready'; detail: IntroductionDetail };

/**
 * ISE-046 — Bilan d'une introduction.
 *
 * Porte `declare_introduction_outcome` (migration 0039). La RÈGLE
 * CARDINALE (MASTER PROMPT §25, D-55) : ne jamais écrire « introduction
 * réussie » tant que `target_responded` n'a pas été constaté. C'est la
 * base qui l'impose (`invalid_transition` sinon) ; cet écran se contente
 * de ne PROPOSER le formulaire que lorsque `status === 'target_responded'`
 * et que le lecteur est le demandeur ou la personne présentée — les deux
 * seuls acteurs que `introductionMachine` autorise à déclarer un résultat
 * (`target_responded -> completed`).
 */
export function IntroductionOutcomeScreen({ route, navigation }: Props) {
  const { introductionId } = route.params;
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [outcome, setOutcome] = useState<IntroductionOutcome | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    loadIntroduction(introductionId)
      .then((result) => {
        if (result.failed) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }
        if (result.data === null) {
          setState({ status: 'notFound' });
          return;
        }
        setState({ status: 'ready', detail: result.data });
      })
      .catch(() => setState({ status: 'error', correlationId: newCorrelationId() }));
  }, [introductionId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = useCallback(() => {
    if (outcome === null) return;
    setSending(true);
    setSendFailed(false);
    declareIntroductionOutcome(introductionId, outcome, note.trim().length > 0 ? note.trim() : null)
      .then((result) => {
        setSending(false);
        if (result.failed) {
          setSendFailed(true);
          return;
        }
        load();
      })
      .catch(() => {
        setSending(false);
        setSendFailed(true);
      });
  }, [introductionId, outcome, note, load]);

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
        <ScreenHeader title={frRelations.outcome.title} onBack={navigation.goBack} />
        <ErrorState title={frRelations.outcome.errorTitle} correlationId={state.correlationId} onRetry={load} />
      </Screen>
    );
  }

  if (state.status === 'notFound') {
    return (
      <Screen>
        <ScreenHeader title={frRelations.outcome.title} onBack={navigation.goBack} />
        <Text style={styles.noticeTitle}>{frRelations.introductions.notFoundTitle}</Text>
      </Screen>
    );
  }

  const { detail } = state;
  const isParticipant = detail.myRole === 'requester' || detail.myRole === 'target';

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScreenHeader title={frRelations.outcome.title} onBack={navigation.goBack} />

        <Text style={styles.subtitle}>{frRelations.outcome.subtitle}</Text>

        <View style={styles.pathBox}>
          <Text style={styles.pathLine}>
            {detail.requester?.displayName ?? '—'} → {detail.intermediary?.displayName ?? '—'} →{' '}
            {detail.target?.displayName ?? '—'}
          </Text>
        </View>

        {detail.outcome !== null ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>{frRelations.outcome.doneTitle}</Text>
            <Text style={styles.paragraph}>
              {frRelations.outcome.labels[detail.outcome] ?? detail.outcome}
            </Text>
            {detail.outcomeNote !== null ? <Text style={styles.paragraph}>{detail.outcomeNote}</Text> : null}
          </View>
        ) : !isParticipant ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>{frRelations.outcome.notAllowedTitle}</Text>
            <Text style={styles.paragraph}>{frRelations.outcome.notAllowedBody}</Text>
          </View>
        ) : detail.status !== 'target_responded' ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>{frRelations.outcome.tooEarlyTitle}</Text>
            <Text style={styles.paragraph}>{frRelations.outcome.tooEarlyBody}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.legend}>{frRelations.outcome.legend}</Text>
            <View style={styles.optionList}>
              {INTRODUCTION_OUTCOMES.map((code) => (
                <Pressable
                  key={code}
                  onPress={() => setOutcome(code)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: outcome === code }}
                  style={[styles.option, outcome === code ? styles.optionSelected : null]}
                >
                  <Text style={styles.optionLabel}>{frRelations.outcome.labels[code] ?? code}</Text>
                  <Text style={styles.optionHint}>{frRelations.outcome.hints[code] ?? ''}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.legend}>{frRelations.outcome.noteLabel}</Text>
            <Text style={styles.hint}>{frRelations.outcome.noteHint}</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={frRelations.outcome.notePlaceholder}
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              style={[styles.textInput, styles.textArea]}
            />

            <View style={styles.honestyBox}>
              <Text style={styles.honestyTitle}>{frRelations.outcome.honestyTitle}</Text>
              <Text style={styles.paragraph}>{frRelations.outcome.honestyBody}</Text>
            </View>

            {sendFailed ? <Text style={styles.errorText}>{frRelations.outcome.errorTitle}</Text> : null}

            <Button
              label={sending ? frRelations.outcome.submitPending : frRelations.outcome.submit}
              onPress={submit}
              loading={sending}
              disabled={outcome === null}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subtitle: { ...textStyle.bodySm, color: colors.textSecondary, marginBottom: space[5] },
  pathBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: rounded.lg,
    padding: space[5],
    marginBottom: space[5],
  },
  pathLine: { ...textStyle.bodySm, color: colors.textPrimary, fontWeight: '600' },
  noticeBox: { gap: space[2], marginBottom: space[6] },
  noticeTitle: { ...textStyle.h4, fontWeight: '700', color: colors.textPrimary },
  paragraph: { ...textStyle.bodySm, color: colors.textSecondary },
  legend: { ...textStyle.bodySm, fontWeight: '700', color: colors.textPrimary, marginBottom: space[2] },
  hint: { ...textStyle.caption, color: colors.textMuted, marginBottom: space[3] },
  optionList: { gap: space[2], marginBottom: space[5] },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    padding: space[4],
    gap: 2,
  },
  optionSelected: { borderColor: colors.actionBlue, backgroundColor: colors.surfaceMuted },
  optionLabel: { ...textStyle.bodySm, fontWeight: '700', color: colors.textPrimary },
  optionHint: { ...textStyle.caption, color: colors.textSecondary },
  textInput: {
    ...textStyle.bodySm,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    paddingHorizontal: space[4],
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    marginBottom: space[5],
  },
  textArea: { minHeight: 80, textAlignVertical: 'top', paddingTop: space[3] },
  honestyBox: { marginBottom: space[6], gap: space[1] },
  honestyTitle: { ...textStyle.bodySm, fontWeight: '700', color: colors.textPrimary },
  errorText: { ...textStyle.bodySm, color: colors.error, marginBottom: space[3] },
});
