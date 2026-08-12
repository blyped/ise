import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { frRelations } from '../../i18n/relations';
import { newCorrelationId } from '../../lib/correlation';
import { loadMemberProfile, type MemberProfileView } from '../../lib/queries/search';
import {
  CONNECTION_CONTEXTS,
  sendConnectionRequest,
  type ConnectionContext,
} from '../../lib/queries/relations';
import type { RelationsStackParamList } from '../../navigation/RelationsStack';
import { colors, rounded, space, textStyle } from '../../theme/tokens';

type Props = NativeStackScreenProps<RelationsStackParamList, 'Connect'>;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'ready'; profile: MemberProfileView };

/**
 * ISE-038 — Se connecter à un ISE, depuis son profil.
 *
 * Porte `send_connection_request` (migration 0039), exactement comme
 * `apps/web/src/app/profil/[profileId]/se-connecter/actions.ts`. La base
 * seule refuse le doublon, la relation existante, le blocage et la
 * limitation de débit (D-103) — cet écran ne rejoue aucune de ces
 * règles, il se contente d'un avertissement immédiat quand `relationship`
 * (déjà chargé via `loadMemberProfile`) indique un cas trivial (déjà en
 * relation, ou son propre profil).
 */
export function ConnectScreen({ route, navigation }: Props) {
  const { profileId } = route.params;
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [context, setContext] = useState<ConnectionContext | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    loadMemberProfile(profileId)
      .then((result) => {
        if (result.failed || result.profile === null) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }
        setState({ status: 'ready', profile: result.profile });
      })
      .catch(() => setState({ status: 'error', correlationId: newCorrelationId() }));
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = useCallback(() => {
    setSending(true);
    setSendFailed(false);
    sendConnectionRequest(profileId, message.trim().length > 0 ? message.trim() : null, context)
      .then((result) => {
        setSending(false);
        if (result.failed || result.data === null || result.data.length === 0) {
          setSendFailed(true);
          return;
        }
        navigation.navigate('ConnectionSent', { requestId: result.data });
      })
      .catch(() => {
        setSending(false);
        setSendFailed(true);
      });
  }, [profileId, message, context, navigation]);

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
        <ScreenHeader title={frRelations.connect.title} onBack={navigation.goBack} />
        <ErrorState
          title={frRelations.connect.notFoundTitle}
          correlationId={state.correlationId}
          onRetry={load}
        />
      </Screen>
    );
  }

  const { profile } = state;

  if (profile.isSelf) {
    return (
      <Screen>
        <ScreenHeader title={frRelations.connect.title} onBack={navigation.goBack} />
        <Text style={styles.noticeTitle}>{frRelations.connect.selfTitle}</Text>
        <Text style={styles.noticeBody}>{frRelations.connect.selfBody}</Text>
      </Screen>
    );
  }

  if (profile.relationship.isConnected) {
    return (
      <Screen>
        <ScreenHeader title={frRelations.connect.title} onBack={navigation.goBack} />
        <Text style={styles.noticeTitle}>{frRelations.connect.alreadyConnectedTitle}</Text>
        <Text style={styles.noticeBody}>{frRelations.connect.alreadyConnectedBody}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScreenHeader title={frRelations.connect.title} onBack={navigation.goBack} />

        <Text style={styles.subtitle}>{frRelations.connect.subtitle}</Text>

        <View style={styles.profileCard}>
          <Text style={styles.profileName}>{profile.displayName}</Text>
          {profile.promotion !== null ? (
            <Text style={styles.profileMeta}>{profile.promotion.label}</Text>
          ) : null}
          {profile.headline !== null ? <Text style={styles.profileHeadline}>{profile.headline}</Text> : null}
        </View>

        <Text style={styles.legend}>{frRelations.connect.contextLegend}</Text>
        <View style={styles.chipRow}>
          {CONNECTION_CONTEXTS.map((code) => (
            <Pressable
              key={code}
              onPress={() => setContext((current) => (current === code ? null : code))}
              style={[styles.chip, context === code ? styles.chipSelected : null]}
              accessibilityRole="button"
              accessibilityState={{ selected: context === code }}
            >
              <Text style={[styles.chipLabel, context === code ? styles.chipLabelSelected : null]}>
                {frRelations.context[code] ?? code}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.legend}>{frRelations.connect.messageLabel}</Text>
        <Text style={styles.hint}>{frRelations.connect.messageHint}</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder={frRelations.connect.messagePlaceholder}
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={4}
          style={[styles.textInput, styles.textArea]}
        />

        {sendFailed ? (
          <Text style={styles.errorText}>{frRelations.connect.errorTitle}</Text>
        ) : null}

        <Button
          label={sending ? frRelations.connect.submitPending : frRelations.connect.submit}
          onPress={submit}
          loading={sending}
        />

        <Pressable
          onPress={() => navigation.navigate('IntroductionPath', { profileId })}
          accessibilityRole="button"
          style={styles.introductionBox}
        >
          <Text style={styles.introductionTitle}>{frRelations.connect.introductionTitle}</Text>
          <Text style={styles.introductionBody}>{frRelations.connect.introductionBody}</Text>
          <Text style={styles.introductionAction}>{frRelations.connect.introductionAction}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subtitle: { ...textStyle.bodySm, color: colors.textSecondary, marginBottom: space[5] },
  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[5],
    marginBottom: space[5],
    gap: space[1],
  },
  profileName: { ...textStyle.body, fontWeight: '700', color: colors.textPrimary },
  profileMeta: { ...textStyle.caption, color: colors.textSecondary },
  profileHeadline: { ...textStyle.bodySm, color: colors.textSecondary },
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
  textArea: { minHeight: 96, textAlignVertical: 'top', paddingTop: space[3] },
  errorText: { ...textStyle.bodySm, color: colors.error, marginBottom: space[3] },
  introductionBox: {
    marginTop: space[6],
    marginBottom: space[8],
    backgroundColor: colors.surfaceMuted,
    borderRadius: rounded.lg,
    padding: space[5],
    gap: space[1],
  },
  introductionTitle: { ...textStyle.bodySm, fontWeight: '700', color: colors.textPrimary },
  introductionBody: { ...textStyle.caption, color: colors.textSecondary },
  introductionAction: { ...textStyle.bodySm, color: colors.actionBlue, fontWeight: '700', marginTop: space[2] },
  noticeTitle: { ...textStyle.h4, fontWeight: '700', color: colors.textPrimary, marginBottom: space[2] },
  noticeBody: { ...textStyle.bodySm, color: colors.textSecondary },
});
