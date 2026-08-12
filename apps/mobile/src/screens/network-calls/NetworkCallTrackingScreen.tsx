import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { frNetworkCalls } from '../../i18n/network-calls';
import { newCorrelationId } from '../../lib/correlation';
import {
  loadCallResponses,
  loadCallTracking,
  setResponseStatus,
  transitionCall,
  type NetworkCallResponse,
  type NetworkCallTracking,
} from '../../lib/queries/network-calls';
import type { NetworkCallsStackParamList } from '../../navigation/NetworkCallsStack';
import { colors, rounded, space, textStyle } from '../../theme/tokens';

type Props = NativeStackScreenProps<NetworkCallsStackParamList, 'AppelSuivi'>;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'ready'; call: NetworkCallTracking; responses: NetworkCallResponse[] };

const STATUS_ACTIONS: { value: string; label: string }[] = [
  { value: 'reviewed', label: 'Vue' },
  { value: 'useful', label: 'Utile' },
  { value: 'contacted', label: 'Contactée' },
  { value: 'selected', label: 'Retenue' },
  { value: 'archived', label: 'Archivée' },
];

/**
 * ISE-053 — Suivi de l'appel (coquille mobile).
 *
 * Porte `get_network_call_tracking` et `list_network_call_responses`,
 * comme `apps/web/src/app/appels/[callId]/suivi/page.tsx`. Les
 * indicateurs sont les MEMES cinq compteurs que le web (profils ciblés,
 * réponses, utiles, recommandations, introductions) — aucune "vue"
 * n'est affichée : la plateforme n'en compte aucune (ECART ASSUME
 * identique au web, voir le commentaire de la page web équivalente).
 */
export function NetworkCallTrackingScreen({ route, navigation }: Props) {
  const { callId } = route.params;
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(() => {
    setState({ status: 'loading' });
    Promise.all([loadCallTracking(callId), loadCallResponses(callId, null, null)])
      .then(([trackingResult, responsesResult]) => {
        if (trackingResult.failed || trackingResult.data === null) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }
        setState({
          status: 'ready',
          call: trackingResult.data,
          responses: responsesResult.failed || responsesResult.data === null ? [] : [...responsesResult.data.rows],
        });
      })
      .catch(() => setState({ status: 'error', correlationId: newCorrelationId() }));
  }, [callId]);

  useEffect(() => {
    load();
  }, [load]);

  const onSetStatus = useCallback(
    (responseId: string, status: string) => {
      setResponseStatus(responseId, status)
        .then((result) => {
          if (!result.failed) load();
        })
        .catch(() => undefined);
    },
    [load],
  );

  const onTransition = useCallback(
    (toStatus: 'paused' | 'active' | 'cancelled') => {
      transitionCall(callId, toStatus)
        .then((result) => {
          if (!result.failed) load();
        })
        .catch(() => undefined);
    },
    [callId, load],
  );

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
        <ErrorState
          title={frNetworkCalls.common.loadErrorTitle}
          correlationId={state.correlationId}
          onRetry={load}
        />
      </Screen>
    );
  }

  const { call, responses } = state;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Pressable onPress={navigation.goBack} accessibilityRole="button" style={styles.backBar}>
          <Text style={styles.backLabel}>{frNetworkCalls.common.back}</Text>
        </Pressable>

        <Text style={styles.heading}>{frNetworkCalls.tracking.title}</Text>
        <Text style={styles.callTitle}>{call.title}</Text>

        <View style={styles.metricsGrid}>
          <MetricTile value={call.targeted} label={frNetworkCalls.tracking.targeted} />
          <MetricTile value={call.responses} label={frNetworkCalls.tracking.responses} />
          <MetricTile value={call.useful} label={frNetworkCalls.tracking.useful} />
          <MetricTile value={call.recommendations} label={frNetworkCalls.tracking.recommendations} />
          <MetricTile value={call.introductions} label={frNetworkCalls.tracking.introductions} />
        </View>
        <Text style={styles.hint}>{frNetworkCalls.tracking.metricsNotice}</Text>

        <View style={styles.manageRow}>
          {call.status === 'active' || call.status === 'paused' || call.status === 'expired' ? (
            <Pressable
              onPress={() => navigation.navigate('AppelCloture', { callId })}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonLabel}>{frNetworkCalls.tracking.closeCta}</Text>
            </Pressable>
          ) : null}
          {call.status === 'active' ? (
            <Pressable onPress={() => onTransition('paused')} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>{frNetworkCalls.tracking.pause}</Text>
            </Pressable>
          ) : null}
          {call.status === 'paused' ? (
            <Pressable onPress={() => onTransition('active')} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>{frNetworkCalls.tracking.resume}</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>{frNetworkCalls.tracking.responsesTitle}</Text>

        {responses.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>{frNetworkCalls.tracking.emptyTitle}</Text>
            <Text style={styles.hint}>{frNetworkCalls.tracking.emptyBody}</Text>
          </View>
        ) : (
          <View style={{ gap: space[4] }}>
            {responses.map((response) => (
              <ResponseCard key={response.responseId} response={response} onSetStatus={onSetStatus} />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function MetricTile({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.metricTile}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function ResponseCard({
  response,
  onSetStatus,
}: {
  response: NetworkCallResponse;
  onSetStatus: (responseId: string, status: string) => void;
}) {
  return (
    <View style={styles.responseCard}>
      <View style={styles.responseHeader}>
        <Text style={styles.responseAuthor}>{response.author?.displayName ?? '—'}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>{frNetworkCalls.responseType[response.responseType] ?? response.responseType}</Text>
        </View>
      </View>
      <Text style={styles.hint}>{frNetworkCalls.responseStatus[response.status] ?? response.status}</Text>

      {response.message !== null ? <Text style={styles.paragraph}>{response.message}</Text> : null}

      {response.recommendations.map((recommendation) => (
        <View key={recommendation.recommendationId} style={styles.recommendationBox}>
          <Text style={styles.recommendationTitle}>
            {recommendation.profile !== null
              ? `${frNetworkCalls.tracking.recommendationOf} : ${recommendation.profile.displayName}`
              : `${frNetworkCalls.tracking.externalPerson} : ${recommendation.externalPersonName ?? '—'}`}
          </Text>
          {recommendation.rationale !== null ? <Text style={styles.hint}>{recommendation.rationale}</Text> : null}
          {recommendation.offersIntroduction ? (
            <Text style={styles.successText}>{frNetworkCalls.tracking.offersIntroduction}</Text>
          ) : null}
        </View>
      ))}

      <View style={styles.chipWrap}>
        {STATUS_ACTIONS.map((action) => (
          <Pressable
            key={action.value}
            onPress={() => onSetStatus(response.responseId, action.value)}
            style={[styles.statusChip, response.status === action.value ? styles.statusChipActive : null]}
          >
            <Text
              style={[styles.statusChipLabel, response.status === action.value ? styles.statusChipLabelActive : null]}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backBar: { marginBottom: space[3] },
  backLabel: { ...textStyle.bodySm, color: colors.actionBlue, fontWeight: '600' },
  heading: { ...textStyle.h2, fontWeight: '700', color: colors.textPrimary },
  callTitle: { ...textStyle.bodySm, color: colors.textSecondary, marginBottom: space[4] },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3], marginBottom: space[2] },
  metricTile: {
    minWidth: '30%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
  },
  metricValue: { ...textStyle.h3, fontWeight: '700', color: colors.textPrimary },
  metricLabel: { ...textStyle.caption, color: colors.textMuted },
  hint: { ...textStyle.caption, color: colors.textMuted },
  manageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3], marginVertical: space[5] },
  secondaryButton: {
    minHeight: 44,
    paddingHorizontal: space[4],
    borderRadius: rounded.base,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonLabel: { ...textStyle.bodySm, color: colors.textPrimary, fontWeight: '600' },
  sectionTitle: { ...textStyle.h4, fontWeight: '700', color: colors.textPrimary, marginBottom: space[4] },
  emptyBox: { gap: space[1], paddingVertical: space[6] },
  emptyTitle: { ...textStyle.bodySm, fontWeight: '700', color: colors.textPrimary },
  responseCard: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[5],
    gap: space[2],
  },
  responseHeader: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  responseAuthor: { ...textStyle.bodySm, fontWeight: '700', color: colors.textPrimary },
  badge: { backgroundColor: colors.surfaceMuted, borderRadius: rounded.full, paddingHorizontal: space[3], paddingVertical: 2 },
  badgeLabel: { ...textStyle.caption, color: colors.textSecondary, fontWeight: '700' },
  paragraph: { ...textStyle.bodySm, color: colors.textSecondary },
  recommendationBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: rounded.base,
    padding: space[3],
    gap: 2,
  },
  recommendationTitle: { ...textStyle.bodySm, fontWeight: '700', color: colors.textPrimary },
  successText: { ...textStyle.caption, color: colors.success },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[2] },
  statusChip: {
    paddingVertical: space[1],
    paddingHorizontal: space[3],
    borderRadius: rounded.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusChipActive: { backgroundColor: colors.actionBlue, borderColor: colors.actionBlue },
  statusChipLabel: { ...textStyle.caption, color: colors.textSecondary, fontWeight: '600' },
  statusChipLabelActive: { color: colors.textInverse },
});
