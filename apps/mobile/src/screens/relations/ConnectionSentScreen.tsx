import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { frRelations } from '../../i18n/relations';
import { newCorrelationId } from '../../lib/correlation';
import {
  loadConnectionRequest,
  respondToConnectionRequest,
  type ConnectionRequestDetail,
} from '../../lib/queries/relations';
import type { RelationsStackParamList } from '../../navigation/RelationsStack';
import { colors, rounded, space, textStyle } from '../../theme/tokens';

type Props = NativeStackScreenProps<RelationsStackParamList, 'ConnectionSent'>;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'notFound' }
  | { status: 'ready'; request: ConnectionRequestDetail };

/**
 * ISE-039 — Confirmation d'envoi d'une demande de connexion.
 *
 * Relit l'état RÉEL de la demande via `get_connection_request` plutôt
 * que de supposer qu'elle est en attente parce qu'elle vient d'être
 * envoyée — même principe que
 * `apps/web/src/app/profil/[profileId]/se-connecter/actions.ts`
 * (« ISE-039 lit l'état réel »).
 */
export function ConnectionSentScreen({ route, navigation }: Props) {
  const { requestId } = route.params;
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [withdrawing, setWithdrawing] = useState(false);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    loadConnectionRequest(requestId)
      .then((result) => {
        if (result.failed) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }
        if (result.data === null) {
          setState({ status: 'notFound' });
          return;
        }
        setState({ status: 'ready', request: result.data });
      })
      .catch(() => setState({ status: 'error', correlationId: newCorrelationId() }));
  }, [requestId]);

  useEffect(() => {
    load();
  }, [load]);

  const withdraw = useCallback(() => {
    setWithdrawing(true);
    respondToConnectionRequest(requestId, 'withdrawn')
      .then((result) => {
        setWithdrawing(false);
        if (!result.failed) load();
      })
      .catch(() => setWithdrawing(false));
  }, [requestId, load]);

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
        <ScreenHeader title={frRelations.sent.title} onBack={navigation.goBack} />
        <ErrorState
          title={frRelations.sent.errorTitle}
          correlationId={state.correlationId}
          onRetry={load}
        />
      </Screen>
    );
  }

  if (state.status === 'notFound') {
    return (
      <Screen>
        <ScreenHeader title={frRelations.sent.title} onBack={navigation.goBack} />
        <Text style={styles.noticeTitle}>{frRelations.sent.notFoundTitle}</Text>
      </Screen>
    );
  }

  const { request } = state;
  const canWithdraw = request.status === 'pending' && request.myRole === 'requester';

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScreenHeader title={frRelations.sent.title} onBack={navigation.goBack} />

        <View style={styles.banner}>
          <Text style={styles.bannerText}>{frRelations.sent.banner}</Text>
        </View>

        <View style={styles.profileCard}>
          <Text style={styles.profileName}>{request.profile.displayName}</Text>
          {request.profile.promotionLabel !== null ? (
            <Text style={styles.profileMeta}>{request.profile.promotionLabel}</Text>
          ) : null}
        </View>

        <Text style={styles.legend}>{frRelations.sent.motiveLabel}</Text>
        <Text style={styles.paragraph}>
          {request.context !== null
            ? (frRelations.context[request.context] ?? request.context)
            : frRelations.sent.motiveNone}
        </Text>

        <Text style={styles.legend}>{frRelations.sent.messageLabel}</Text>
        <Text style={styles.paragraph}>{request.message ?? frRelations.sent.messageNone}</Text>

        <Text style={styles.waitBody}>{frRelations.sent.waitBody}</Text>

        {canWithdraw ? (
          <Button
            label={withdrawing ? frRelations.sent.withdrawPending : frRelations.sent.withdraw}
            onPress={withdraw}
            loading={withdrawing}
          />
        ) : request.status === 'withdrawn' ? (
          <Text style={styles.paragraph}>{frRelations.sent.withdrawDone}</Text>
        ) : null}

        <Pressable onPress={navigation.goBack} accessibilityRole="button" style={styles.linkButton}>
          <Text style={styles.linkButtonLabel}>{frRelations.common.back}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  banner: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: rounded.lg,
    padding: space[5],
    marginBottom: space[5],
  },
  bannerText: { ...textStyle.bodySm, color: colors.textPrimary, fontWeight: '600' },
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
  legend: { ...textStyle.bodySm, fontWeight: '700', color: colors.textPrimary, marginBottom: space[1] },
  paragraph: { ...textStyle.bodySm, color: colors.textSecondary, marginBottom: space[4] },
  waitBody: { ...textStyle.caption, color: colors.textMuted, marginBottom: space[5] },
  linkButton: { marginTop: space[4], paddingVertical: space[2], alignItems: 'center' },
  linkButtonLabel: { ...textStyle.bodySm, color: colors.actionBlue, fontWeight: '700' },
  noticeTitle: { ...textStyle.h4, fontWeight: '700', color: colors.textPrimary },
});
