import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { frRelations } from '../../i18n/relations';
import { newCorrelationId } from '../../lib/correlation';
import {
  acceptConnectionRequest,
  loadConnectionRequests,
  respondToConnectionRequest,
  type ConnectionRequestRow,
  type ConnectionRequestStatus,
} from '../../lib/queries/relations';
import type { RelationsStackParamList } from '../../navigation/RelationsStack';
import { colors, rounded, space, textStyle } from '../../theme/tokens';

type Props = NativeStackScreenProps<RelationsStackParamList, 'Invitations'>;

type Tab = Extract<ConnectionRequestStatus, 'pending' | 'accepted' | 'declined'>;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'ready'; rows: ConnectionRequestRow[]; nextCursor: string | null; loadingMore: boolean };

/**
 * ISE-041 — Invitations reçues.
 *
 * Porte `list_connection_requests(p_direction: 'received', ...)`, exactement
 * comme `apps/web/src/app/reseau/invitations/page.tsx`. « Ignorer » n'écrit
 * RIEN (D-55) : c'est un simple retrait visuel de la ligne dans l'état
 * local du composant, jamais un appel réseau — voir `onIgnore` ci-dessous,
 * qui ne fait qu'un `setState` filtrant le tableau affiché.
 */
export function InvitationsScreen({ route: _route, navigation }: Props) {
  const [tab, setTab] = useState<Tab>('pending');
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = useCallback((currentTab: Tab) => {
    setState({ status: 'loading' });
    setIgnored(new Set());
    loadConnectionRequests('received', currentTab, null)
      .then((result) => {
        if (result.failed || result.data === null) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }
        setState({
          status: 'ready',
          rows: [...result.data.rows],
          nextCursor: result.data.nextCursor,
          loadingMore: false,
        });
      })
      .catch(() => setState({ status: 'error', correlationId: newCorrelationId() }));
  }, []);

  useEffect(() => {
    load(tab);
  }, [load, tab]);

  const loadMore = useCallback(() => {
    setState((prev) => {
      if (prev.status !== 'ready' || prev.nextCursor === null || prev.loadingMore) return prev;
      loadConnectionRequests('received', tab, prev.nextCursor).then((result) => {
        setState((current) => {
          if (current.status !== 'ready') return current;
          if (result.failed || result.data === null) return { ...current, loadingMore: false };
          return {
            status: 'ready',
            rows: [...current.rows, ...result.data.rows],
            nextCursor: result.data.nextCursor,
            loadingMore: false,
          };
        });
      });
      return { ...prev, loadingMore: true };
    });
  }, [tab]);

  const onIgnore = useCallback((requestId: string) => {
    // Ignorer n'appelle AUCUNE RPC : c'est un retrait local uniquement (D-55).
    setIgnored((prev) => new Set(prev).add(requestId));
  }, []);

  const onAccept = useCallback(
    (requestId: string) => {
      setActingOn(requestId);
      acceptConnectionRequest(requestId)
        .then((result) => {
          setActingOn(null);
          if (!result.failed) load(tab);
        })
        .catch(() => setActingOn(null));
    },
    [load, tab],
  );

  const onDecline = useCallback(
    (requestId: string) => {
      setActingOn(requestId);
      respondToConnectionRequest(requestId, 'declined')
        .then((result) => {
          setActingOn(null);
          if (!result.failed) load(tab);
        })
        .catch(() => setActingOn(null));
    },
    [load, tab],
  );

  const visibleRows =
    state.status === 'ready' ? state.rows.filter((row) => !ignored.has(row.requestId)) : [];

  return (
    <Screen>
      <ScreenHeader title={frRelations.invitations.title} onBack={navigation.goBack} />
      <Text style={styles.subtitle}>{frRelations.invitations.subtitle}</Text>

      <View style={styles.tabRow}>
        <TabButton label={frRelations.invitations.tabPending} active={tab === 'pending'} onPress={() => setTab('pending')} />
        <TabButton label={frRelations.invitations.tabAccepted} active={tab === 'accepted'} onPress={() => setTab('accepted')} />
        <TabButton label={frRelations.invitations.tabDeclined} active={tab === 'declined'} onPress={() => setTab('declined')} />
      </View>

      {state.status === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.actionBlue} />
        </View>
      ) : null}

      {state.status === 'error' ? (
        <ErrorState
          title={frRelations.invitations.errorTitle}
          correlationId={state.correlationId}
          onRetry={() => load(tab)}
        />
      ) : null}

      {state.status === 'ready' && visibleRows.length === 0 ? (
        tab === 'pending' ? (
          <EmptyState
            title={frRelations.invitations.emptyPendingTitle}
            description={frRelations.invitations.emptyPendingBody}
          />
        ) : (
          <EmptyState
            title={
              tab === 'accepted'
                ? frRelations.invitations.emptyAcceptedTitle
                : frRelations.invitations.emptyDeclinedTitle
            }
          />
        )
      ) : null}

      {state.status === 'ready' && visibleRows.length > 0 ? (
        <FlatList
          data={visibleRows}
          keyExtractor={(row) => row.requestId}
          renderItem={({ item }) => (
            <InvitationCard
              row={item}
              tab={tab}
              busy={actingOn === item.requestId}
              onAccept={() => onAccept(item.requestId)}
              onDecline={() => onDecline(item.requestId)}
              onIgnore={() => onIgnore(item.requestId)}
              onDetail={() => navigation.navigate('InvitationDetail', { requestId: item.requestId })}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            state.nextCursor !== null ? (
              <View style={styles.loadMore}>
                <Button label={frRelations.common.loadMore} onPress={loadMore} loading={state.loadingMore} />
              </View>
            ) : null
          }
        />
      ) : null}
    </Screen>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.tab, active ? styles.tabActive : null]}>
      <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>{label}</Text>
    </Pressable>
  );
}

function InvitationCard({
  row,
  tab,
  busy,
  onAccept,
  onDecline,
  onIgnore,
  onDetail,
}: {
  row: ConnectionRequestRow;
  tab: Tab;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onIgnore: () => void;
  onDetail: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardName}>{row.profile.displayName}</Text>
      {row.profile.promotionLabel !== null ? (
        <Text style={styles.cardMeta}>{row.profile.promotionLabel}</Text>
      ) : null}
      <Text style={styles.cardContext}>
        {frRelations.invitations.motiveLabel} :{' '}
        {row.context !== null ? (frRelations.context[row.context] ?? row.context) : frRelations.invitation.motiveNone}
      </Text>

      {tab === 'pending' ? (
        <View style={styles.actionsRow}>
          <Pressable onPress={onAccept} disabled={busy} style={styles.acceptButton} accessibilityRole="button">
            <Text style={styles.acceptLabel}>
              {busy ? frRelations.invitations.acceptPending : frRelations.invitations.accept}
            </Text>
          </Pressable>
          <Pressable onPress={onDecline} disabled={busy} style={styles.declineButton} accessibilityRole="button">
            <Text style={styles.declineLabel}>
              {busy ? frRelations.invitations.declinePending : frRelations.invitations.decline}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.linkRow}>
        <Pressable onPress={onDetail} accessibilityRole="button" style={styles.linkButton}>
          <Text style={styles.linkButtonLabel}>{frRelations.invitations.detail}</Text>
        </Pressable>
        {tab === 'pending' ? (
          <Pressable onPress={onIgnore} accessibilityRole="button" style={styles.linkButton}>
            <Text style={styles.ignoreLabel}>{frRelations.invitations.ignore}</Text>
          </Pressable>
        ) : null}
      </View>
      {tab === 'pending' ? <Text style={styles.ignoreHint}>{frRelations.invitations.ignoreHint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subtitle: { ...textStyle.bodySm, color: colors.textSecondary, marginBottom: space[5] },
  tabRow: { flexDirection: 'row', gap: space[2], marginBottom: space[5] },
  tab: {
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: rounded.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.actionBlue, borderColor: colors.actionBlue },
  tabLabel: { ...textStyle.caption, color: colors.textSecondary, fontWeight: '700' },
  tabLabelActive: { color: colors.textInverse },
  list: { paddingBottom: space[6] },
  separator: { height: space[4] },
  card: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[5],
    gap: space[2],
  },
  cardName: { ...textStyle.body, fontWeight: '700', color: colors.textPrimary },
  cardMeta: { ...textStyle.caption, color: colors.textSecondary },
  cardContext: { ...textStyle.bodySm, color: colors.textSecondary },
  actionsRow: { flexDirection: 'row', gap: space[3], marginTop: space[2] },
  acceptButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: rounded.base,
    backgroundColor: colors.actionBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptLabel: { ...textStyle.bodySm, color: colors.textInverse, fontWeight: '700' },
  declineButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: rounded.base,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineLabel: { ...textStyle.bodySm, color: colors.textPrimary, fontWeight: '700' },
  linkRow: { flexDirection: 'row', gap: space[4], marginTop: space[1] },
  linkButton: { paddingVertical: space[1] },
  linkButtonLabel: { ...textStyle.caption, color: colors.actionBlue, fontWeight: '700' },
  ignoreLabel: { ...textStyle.caption, color: colors.textSecondary, fontWeight: '600' },
  ignoreHint: { ...textStyle.caption, color: colors.textMuted },
  loadMore: { marginTop: space[5], alignItems: 'center' },
});
