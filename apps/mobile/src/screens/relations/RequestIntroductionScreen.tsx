import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { frRelations, tRelations } from '../../i18n/relations';
import { newCorrelationId } from '../../lib/correlation';
import {
  INTRODUCTION_PURPOSES,
  loadIntroductionPaths,
  requestIntroduction,
  type IntroductionPath,
  type IntroductionPathsView,
  type IntroductionPurpose,
} from '../../lib/queries/relations';
import type { RelationsStackParamList } from '../../navigation/RelationsStack';
import { colors, rounded, space, textStyle } from '../../theme/tokens';

type Props = NativeStackScreenProps<RelationsStackParamList, 'RequestIntroduction'>;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'notFound' }
  | { status: 'invalidPath'; view: IntroductionPathsView }
  | { status: 'ready'; view: IntroductionPathsView; path: IntroductionPath };

const MIN_MESSAGE_LENGTH = 20;

/**
 * ISE-044 — Demander une introduction via un intermédiaire donné.
 *
 * L'intermédiaire n'est pas choisi librement : il arrive par les
 * paramètres de navigation depuis ISE-043, et cet écran REVÉRIFIE qu'il
 * figure bien parmi les chemins que `suggest_introduction_paths` accepte
 * (D-51) — exactement comme
 * `apps/web/src/app/profil/[profileId]/introduction/demander/page.tsx`.
 * Un intermédiaire fabriqué à la main dans les paramètres ne donne donc
 * pas de formulaire, et de toute façon `request_introduction()` le
 * refuserait côté base.
 */
export function RequestIntroductionScreen({ route, navigation }: Props) {
  const { profileId, intermediaryId } = route.params;
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [purpose, setPurpose] = useState<IntroductionPurpose | null>(null);
  const [messageToIntermediary, setMessageToIntermediary] = useState('');
  const [messageToTarget, setMessageToTarget] = useState('');
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    loadIntroductionPaths(profileId)
      .then((result) => {
        if (result.failed) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }
        if (result.data === null) {
          setState({ status: 'notFound' });
          return;
        }
        const path = result.data.paths.find((p) => p.intermediary.profileId === intermediaryId);
        if (path === undefined) {
          setState({ status: 'invalidPath', view: result.data });
          return;
        }
        setState({ status: 'ready', view: result.data, path });
      })
      .catch(() => setState({ status: 'error', correlationId: newCorrelationId() }));
  }, [profileId, intermediaryId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = useCallback(() => {
    if (purpose === null || messageToIntermediary.trim().length < MIN_MESSAGE_LENGTH) return;
    setSending(true);
    setSendFailed(false);
    requestIntroduction({
      intermediaryProfileId: intermediaryId,
      targetProfileId: profileId,
      purpose,
      messageToIntermediary: messageToIntermediary.trim(),
      messageToTarget: messageToTarget.trim().length > 0 ? messageToTarget.trim() : null,
    })
      .then((result) => {
        setSending(false);
        if (result.failed || result.data === null || result.data.length === 0) {
          setSendFailed(true);
          return;
        }
        navigation.navigate('Introductions', { introductionId: result.data });
      })
      .catch(() => {
        setSending(false);
        setSendFailed(true);
      });
  }, [purpose, messageToIntermediary, messageToTarget, intermediaryId, profileId, navigation]);

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
        <ScreenHeader title={frRelations.ask.title} onBack={navigation.goBack} />
        <ErrorState title={frRelations.ask.errorTitle} correlationId={state.correlationId} onRetry={load} />
      </Screen>
    );
  }

  if (state.status === 'notFound') {
    return (
      <Screen>
        <ScreenHeader title={frRelations.ask.title} onBack={navigation.goBack} />
        <Text style={styles.noticeTitle}>{frRelations.connect.notFoundTitle}</Text>
      </Screen>
    );
  }

  if (state.status === 'invalidPath') {
    return (
      <Screen>
        <ScreenHeader title={frRelations.ask.title} onBack={navigation.goBack} />
        <Text style={styles.noticeTitle}>{frRelations.ask.invalidPathTitle}</Text>
        <Text style={styles.paragraph}>{frRelations.ask.invalidPathBody}</Text>
      </Screen>
    );
  }

  const { view, path } = state;
  const intermediaryName = path.intermediary.displayName;

  if (path.pendingRequestId !== null) {
    const pendingRequestId = path.pendingRequestId;
    return (
      <Screen>
        <ScreenHeader title={frRelations.ask.title} onBack={navigation.goBack} />
        <Text style={styles.noticeTitle}>
          {tRelations(frRelations.paths.pendingVia, { name: intermediaryName })}
        </Text>
        <Button
          label={frRelations.paths.seeRequest}
          onPress={() => navigation.navigate('Introductions', { introductionId: pendingRequestId })}
        />
      </Screen>
    );
  }

  const canSubmit = purpose !== null && messageToIntermediary.trim().length >= MIN_MESSAGE_LENGTH;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScreenHeader title={frRelations.ask.title} onBack={navigation.goBack} />

        <Text style={styles.subtitle}>
          {tRelations(frRelations.ask.subtitle, { name: intermediaryName, target: view.target.displayName })}
        </Text>

        <View style={styles.pathBox}>
          <Text style={styles.pathLine}>Vous → {intermediaryName} → {view.target.displayName}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>{frRelations.pathLabel[path.label] ?? path.label}</Text>
          </View>
        </View>

        <Text style={styles.legend}>{frRelations.ask.purposeLegend}</Text>
        <View style={styles.chipRow}>
          {INTRODUCTION_PURPOSES.map((code) => (
            <Pressable
              key={code}
              onPress={() => setPurpose(code)}
              style={[styles.chip, purpose === code ? styles.chipSelected : null]}
              accessibilityRole="button"
              accessibilityState={{ selected: purpose === code }}
            >
              <Text style={[styles.chipLabel, purpose === code ? styles.chipLabelSelected : null]}>
                {frRelations.purpose[code] ?? code}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.legend}>
          {tRelations(frRelations.ask.messageLabel, { name: intermediaryName })}
        </Text>
        <Text style={styles.hint}>{frRelations.ask.messageHint}</Text>
        <TextInput
          value={messageToIntermediary}
          onChangeText={setMessageToIntermediary}
          placeholder={frRelations.ask.messagePlaceholder}
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={4}
          style={[styles.textInput, styles.textArea]}
        />

        <Text style={styles.legend}>
          {tRelations(frRelations.ask.messageToTargetLabel, { target: view.target.displayName })}
        </Text>
        <Text style={styles.hint}>{frRelations.ask.messageToTargetHint}</Text>
        <TextInput
          value={messageToTarget}
          onChangeText={setMessageToTarget}
          placeholder=""
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
          style={[styles.textInput, styles.textArea]}
        />

        <View style={styles.notAutomaticBox}>
          <Text style={styles.notAutomaticTitle}>{frRelations.ask.notAutomaticTitle}</Text>
          {frRelations.ask.notAutomaticItems.map((item) => (
            <Text key={item} style={styles.notAutomaticItem}>
              • {item}
            </Text>
          ))}
        </View>

        {sendFailed ? <Text style={styles.errorText}>{frRelations.ask.errorTitle}</Text> : null}

        <Button
          label={sending ? frRelations.ask.submitPending : frRelations.ask.submit}
          onPress={submit}
          loading={sending}
          disabled={!canSubmit}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subtitle: { ...textStyle.bodySm, color: colors.textSecondary, marginBottom: space[5] },
  paragraph: { ...textStyle.bodySm, color: colors.textSecondary },
  pathBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: rounded.lg,
    padding: space[5],
    gap: space[2],
    marginBottom: space[5],
  },
  pathLine: { ...textStyle.bodySm, color: colors.textPrimary, fontWeight: '600' },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: rounded.full,
    paddingHorizontal: space[3],
    paddingVertical: 2,
  },
  badgeLabel: { ...textStyle.caption, color: colors.textSecondary, fontWeight: '700' },
  legend: { ...textStyle.bodySm, fontWeight: '700', color: colors.textPrimary, marginBottom: space[2] },
  hint: { ...textStyle.caption, color: colors.textMuted, marginBottom: space[3] },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginBottom: space[5] },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.full,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.actionBlue, borderColor: colors.actionBlue },
  chipLabel: { ...textStyle.caption, color: colors.textSecondary, fontWeight: '600' },
  chipLabelSelected: { color: colors.textInverse },
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
  textArea: { minHeight: 88, textAlignVertical: 'top', paddingTop: space[3] },
  notAutomaticBox: { marginBottom: space[5], gap: space[1] },
  notAutomaticTitle: { ...textStyle.bodySm, fontWeight: '700', color: colors.textPrimary },
  notAutomaticItem: { ...textStyle.caption, color: colors.textSecondary },
  errorText: { ...textStyle.bodySm, color: colors.error, marginBottom: space[3] },
  noticeTitle: { ...textStyle.h4, fontWeight: '700', color: colors.textPrimary, marginBottom: space[2] },
});
