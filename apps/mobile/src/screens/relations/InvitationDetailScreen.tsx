import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { frRelations } from '../../i18n/relations';
import { newCorrelationId } from '../../lib/correlation';
import {
  acceptConnectionRequest,
  loadConnectionRequest,
  respondToConnectionRequest,
  type ConnectionRequestDetail,
} from '../../lib/queries/relations';
import type { RelationsStackParamList } from '../../navigation/RelationsStack';
import { colors, rounded, space, textStyle } from '../../theme/tokens';

type Props = NativeStackScreenProps<RelationsStackParamList, 'InvitationDetail'>;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'notFound' }
  | { status: 'ready'; request: ConnectionRequestDetail };

/**
 * ISE-042 — Détail d'une invitation reçue.
 *
 * Porte `get_connection_request`, exactement comme
 * `apps/web/src/app/reseau/invitations/[requestId]/page.tsx`. Les
 * boutons Accepter/Décliner appellent `accept_connection_request` /
 * `respond_to_connection_request(..., 'declined')`, comme
 * `InvitationActions.tsx` côté web — jamais un `update` client sur
 * `connection_requests`.
 */
export function InvitationDetailScreen({ route, navigation }: Props) {
  const { requestId } = route.params;
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [acting, setActing] = useState<'accept' | 'decline' | null>(null);

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

  const onAccept = useCallback(() => {
    setActing('accept');
    acceptConnectionRequest(requestId)
      .then((result) => {
        setActing(null);
        if (!result.failed) load();
      })
      .catch(() => setActing(null));
  }, [requestId, load]);

  const onDecline = useCallback(() => {
    setActing('decline');
    respondToConnectionRequest(requestId, 'declined')
      .then((result) => {
        setActing(null);
        if (!result.failed) load();
      })
      .catch(() => setActing(null));
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
        <ScreenHeader title={frRelations.invitation.title} onBack={navigation.goBack} />
        <ErrorState
          title={frRelations.invitation.errorTitle}
          correlationId={state.correlationId}
          onRetry={load}
        />
      </Screen>
    );
  }

  if (state.status === 'notFound') {
    return (
      <Screen>
        <ScreenHeader title={frRelations.invitation.title} onBack={navigation.goBack} />
        <Text style={styles.noticeTitle}>{frRelations.invitation.notFoundTitle}</Text>
      </Screen>
    );
  }

  const { request } = state;
  const canDecide = request.status === 'pending' && request.myRole === 'addressee';

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScreenHeader title={frRelations.invitation.title} onBack={navigation.goBack} />

        <View style={styles.profileCard}>
          <Text style={styles.profileName}>{request.profile.displayName}</Text>
          {request.profile.promotionLabel !== null ? (
            <Text style={styles.profileMeta}>{request.profile.promotionLabel}</Text>
          ) : null}
          {request.profile.headline !== null ? (
            <Text style={styles.profileHeadline}>{request.profile.headline}</Text>
          ) : null}
        </View>

        <Section title={frRelations.invitation.motiveTitle}>
          <Text style={styles.paragraph}>
            {request.context !== null
              ? (frRelations.context[request.context] ?? request.context)
              : frRelations.invitation.motiveNone}
          </Text>
        </Section>

        <Section title={frRelations.invitation.messageTitle}>
          <Text style={styles.paragraph}>{request.message ?? frRelations.invitation.messageNone}</Text>
        </Section>

        <Section title={frRelations.invitation.commonTitle}>
          {request.commonGround.sharesPromotion ? (
            <Text style={styles.paragraph}>{frRelations.invitation.commonPromotionValue}</Text>
          ) : null}
          {request.commonGround.sharedOrganization !== null ? (
            <Text style={styles.paragraph}>
              {frRelations.invitation.commonOrganization} : {request.commonGround.sharedOrganization}
            </Text>
          ) : null}
          {request.commonGround.mutualConnections.length > 0 ? (
            <Text style={styles.paragraph}>
              {frRelations.invitation.commonMutual} :{' '}
              {request.commonGround.mutualConnections.map((m) => m.displayName).join(', ')}
            </Text>
          ) : null}
          {!request.commonGround.sharesPromotion &&
          request.commonGround.sharedOrganization === null &&
          request.commonGround.mutualConnections.length === 0 ? (
            <Text style={styles.paragraph}>{frRelations.invitation.commonNone}</Text>
          ) : null}
        </Section>

        {canDecide ? (
          <View style={styles.actionsBox}>
            <Button
              label={acting === 'accept' ? frRelations.invitations.acceptPending : frRelations.invitations.accept}
              onPress={onAccept}
              loading={acting === 'accept'}
              disabled={acting === 'decline'}
            />
            <Text style={styles.actionHint}>{frRelations.invitation.acceptBody}</Text>
            <Button
              label={acting === 'decline' ? frRelations.invitations.declinePending : frRelations.invitations.decline}
              onPress={onDecline}
              loading={acting === 'decline'}
              disabled={acting === 'accept'}
            />
            <Text style={styles.actionHint}>{frRelations.invitation.declineBody}</Text>
          </View>
        ) : (
          <Text style={styles.paragraph}>{frRelations.invitation.alreadyAnswered}</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  section: { marginBottom: space[5], gap: space[1] },
  sectionTitle: { ...textStyle.bodySm, fontWeight: '700', color: colors.textPrimary },
  paragraph: { ...textStyle.bodySm, color: colors.textSecondary },
  actionsBox: { gap: space[2], marginTop: space[3], marginBottom: space[8] },
  actionHint: { ...textStyle.caption, color: colors.textMuted, marginBottom: space[3] },
  noticeTitle: { ...textStyle.h4, fontWeight: '700', color: colors.textPrimary },
});
