import { useCallback, useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { profileManagement as pm } from '../../i18n/profile-management';
import {
  acceptRecommendationRequest,
  declineRecommendationRequest,
  loadReceivedRecommendations,
  loadRecommendationRequests,
  moderateRecommendation,
  withdrawRecommendationRequest,
  type RecommendationRequestRow,
  type RecommendationRow,
} from '../../lib/queries/profile-management';
import { useProfileId } from '../../navigation/ProfileManagementStack';
import type { ProfileManagementStackParamList } from '../../navigation/ProfileManagementStack';
import { colors, rounded, space, textStyle } from '../../theme/tokens';
import { Badge, Card, ErrorBanner, Hint, LoadingView, Pill, PrimaryButton, SecondaryButton } from './_shared';

type Props = NativeStackScreenProps<ProfileManagementStackParamList, 'Recommendations'>;

type Tab = 'all' | 'received' | 'requests';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | {
      status: 'ready';
      received: RecommendationRow[];
      requestsReceived: RecommendationRequestRow[];
      requestsSent: RecommendationRequestRow[];
    };

/** ISE-028 — Mes recommandations (D-72 : aucun score public n'est calculé). */
export function RecommendationsScreen({ navigation }: Props) {
  const profileId = useProfileId();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [tab, setTab] = useState<Tab>('all');
  const [acceptTarget, setAcceptTarget] = useState<RecommendationRequestRow | null>(null);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    Promise.all([
      loadReceivedRecommendations(profileId),
      loadRecommendationRequests(profileId, 'received'),
      loadRecommendationRequests(profileId, 'sent'),
    ]).then(([received, requestsReceived, requestsSent]) => {
      if (!received.ok) {
        setState({ status: 'error', correlationId: received.correlationId });
        return;
      }
      setState({
        status: 'ready',
        received: received.data,
        requestsReceived: requestsReceived.ok ? requestsReceived.data : [],
        requestsSent: requestsSent.ok ? requestsSent.data : [],
      });
    });
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === 'loading') return <Screen><LoadingView /></Screen>;
  if (state.status === 'error') {
    return (
      <Screen>
        <ErrorBanner title={pm.recommendations.errorTitle} correlationId={state.correlationId} onRetry={load} />
      </Screen>
    );
  }

  const pendingToValidate = state.requestsReceived.filter((r) => r.status === 'pending');

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headingRow}>
          <Text style={styles.heading}>{pm.recommendations.heading}</Text>
        </View>
        <Text style={styles.count}>
          {state.received.length} reçue(s) · {pendingToValidate.length} à valider
        </Text>

        <View style={styles.tabsRow}>
          <Pill label={pm.recommendations.tabAll} selected={tab === 'all'} onPress={() => setTab('all')} />
          <Pill label={pm.recommendations.tabReceived} selected={tab === 'received'} onPress={() => setTab('received')} />
          <Pill label={pm.recommendations.tabRequests} selected={tab === 'requests'} onPress={() => setTab('requests')} />
        </View>

        {tab !== 'requests' ? (
          state.received.length === 0 ? (
            <EmptyState title={pm.recommendations.emptyTitle} description={pm.recommendations.emptyBody} />
          ) : (
            state.received.map((row) => (
              <Card key={row.id}>
                <View style={styles.rowHeader}>
                  <Text style={styles.name}>{row.authorName}</Text>
                  <Badge
                    label={row.status === 'published' ? pm.recommendations.visibleBadge : pm.recommendations.hiddenBadge}
                    tone={row.status === 'published' ? 'success' : 'neutral'}
                  />
                </View>
                <Text style={styles.meta}>{row.relationshipContext}</Text>
                {row.skillName ? <Badge label={row.skillName} tone="info" /> : null}
                <Text style={styles.body}>{row.body}</Text>
                <View style={styles.actionsRow}>
                  {row.status !== 'published' ? (
                    <Text style={styles.link} onPress={() => moderateRecommendation(profileId, row.id, 'publish').then(load)}>
                      {pm.recommendations.publish}
                    </Text>
                  ) : (
                    <Text style={styles.link} onPress={() => moderateRecommendation(profileId, row.id, 'hide').then(load)}>
                      {pm.recommendations.hide}
                    </Text>
                  )}
                </View>
              </Card>
            ))
          )
        ) : null}

        {tab === 'requests' ? (
          <>
            <Text style={styles.sectionLabel}>{pm.recommendations.tabRequests} · reçues</Text>
            {state.requestsReceived.length === 0 ? <Text style={styles.meta}>—</Text> : null}
            {state.requestsReceived.map((row) => (
              <Card key={row.id}>
                <View style={styles.rowHeader}>
                  <Text style={styles.name}>{row.otherName}</Text>
                  <Badge
                    label={row.status === 'pending' ? pm.recommendations.toValidateBadge : row.status}
                    tone={row.status === 'pending' ? 'warning' : 'neutral'}
                  />
                </View>
                {row.context ? <Text style={styles.meta}>{row.context}</Text> : null}
                {row.status === 'pending' ? (
                  <View style={styles.actionsRow}>
                    <View style={styles.actionButton}>
                      <SecondaryButton label={pm.recommendations.decline} onPress={() => declineRecommendationRequest(row.id).then(load)} />
                    </View>
                    <View style={styles.actionButton}>
                      <PrimaryButton label={pm.recommendations.accept} onPress={() => setAcceptTarget(row)} />
                    </View>
                  </View>
                ) : null}
              </Card>
            ))}

            <Text style={styles.sectionLabel}>{pm.recommendations.tabRequests} · envoyées</Text>
            {state.requestsSent.length === 0 ? <Text style={styles.meta}>—</Text> : null}
            {state.requestsSent.map((row) => (
              <Card key={row.id}>
                <View style={styles.rowHeader}>
                  <Text style={styles.name}>{row.otherName}</Text>
                  <Badge
                    label={row.status === 'pending' ? pm.recommendations.pendingBadge : row.status}
                    tone={row.status === 'pending' ? 'warning' : 'neutral'}
                  />
                </View>
                {row.status === 'pending' ? (
                  <Text style={styles.linkDanger} onPress={() => withdrawRecommendationRequest(row.id).then(load)}>
                    {pm.recommendations.withdraw}
                  </Text>
                ) : null}
              </Card>
            ))}
          </>
        ) : null}

        <Hint>{pm.recommendations.hint} {pm.recommendations.hintSecondary}</Hint>

        <PrimaryButton label={pm.recommendations.requestAction} onPress={() => navigation.navigate('RequestRecommendation')} />
      </ScrollView>

      <AcceptRecommendationModal
        request={acceptTarget}
        onClose={() => setAcceptTarget(null)}
        onDone={() => {
          setAcceptTarget(null);
          load();
        }}
      />
    </Screen>
  );
}

function AcceptRecommendationModal({
  request,
  onClose,
  onDone,
}: {
  request: RecommendationRequestRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [body, setBody] = useState('');
  const [relationshipContext, setRelationshipContext] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (request) {
      setBody('');
      setRelationshipContext(request.context ?? '');
      setError(null);
    }
  }, [request]);

  if (!request) return null;

  async function submit() {
    if (!request) return;
    setSaving(true);
    setError(null);
    const result = await acceptRecommendationRequest({
      requestId: request.id,
      relationshipContext,
      body,
      visibility: 'members',
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onDone();
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>{pm.recommendations.accept}</Text>
          <Text style={styles.modalSubtitle}>{request.otherName}</Text>
          <TextInput
            value={relationshipContext}
            onChangeText={setRelationshipContext}
            placeholder={pm.experienceForm.organizationLabel}
            placeholderTextColor={colors.textMuted}
            style={styles.modalInput}
          />
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={pm.requestRecommendation.messageLabel}
            placeholderTextColor={colors.textMuted}
            style={[styles.modalInput, styles.modalTextarea]}
            multiline
            numberOfLines={4}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actionsRow}>
            <View style={styles.actionButton}>
              <SecondaryButton label={pm.common.cancel} onPress={onClose} disabled={saving} />
            </View>
            <View style={styles.actionButton}>
              <PrimaryButton label={pm.common.save} onPress={submit} loading={saving} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: space[4],
    paddingBottom: space[8],
  },
  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heading: {
    ...textStyle.h2,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  count: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
    marginTop: -space[2],
  },
  tabsRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space[3],
  },
  name: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  meta: {
    ...textStyle.caption,
    color: colors.textSecondary,
  },
  body: {
    ...textStyle.bodySm,
    color: colors.textPrimary,
  },
  sectionLabel: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: space[2],
  },
  actionsRow: {
    flexDirection: 'row',
    gap: space[3],
    marginTop: space[2],
  },
  actionButton: {
    flex: 1,
  },
  link: {
    ...textStyle.bodySm,
    color: colors.actionBlue,
    fontWeight: '600',
  },
  linkDanger: {
    ...textStyle.bodySm,
    color: colors.error,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: rounded.xl,
    borderTopRightRadius: rounded.xl,
    padding: space[5],
    gap: space[4],
  },
  modalTitle: {
    ...textStyle.h4,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
  modalInput: {
    ...textStyle.body,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    paddingHorizontal: space[5],
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  modalTextarea: {
    minHeight: 100,
    paddingTop: space[3],
    textAlignVertical: 'top',
  },
  error: {
    ...textStyle.bodySm,
    color: colors.error,
  },
});
