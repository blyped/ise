import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { frNetworkCalls, tcNetworkCalls } from '../../i18n/network-calls';
import { newCorrelationId } from '../../lib/correlation';
import {
  loadMyNetworkCalls,
  loadNetworkCalls,
  toggleSavedCall,
  type CallScope,
  type MyCallGroup,
  type NetworkCallCard,
} from '../../lib/queries/network-calls';
import type { NetworkCallsStackParamList } from '../../navigation/NetworkCallsStack';
import { colors, rounded, space, textStyle } from '../../theme/tokens';

type Props = NativeStackScreenProps<NetworkCallsStackParamList, 'AppelsListe'>;

type Mode = { kind: 'scope'; scope: CallScope } | { kind: 'mine'; group: MyCallGroup };

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'empty' }
  | { status: 'ready'; rows: NetworkCallCard[]; nextCursor: string | null; loadingMore: boolean };

const SCOPE_TABS: { id: CallScope; label: string }[] = [
  { id: 'for_me', label: frNetworkCalls.list.tabForMe },
  { id: 'all', label: frNetworkCalls.list.tabAll },
  { id: 'promotion', label: frNetworkCalls.list.tabPromotion },
  { id: 'saved', label: frNetworkCalls.list.tabSaved },
];

const MINE_TABS: { id: MyCallGroup; label: string }[] = [
  { id: 'active', label: frNetworkCalls.mine.tabActive },
  { id: 'resolved', label: frNetworkCalls.mine.tabResolved },
  { id: 'drafts', label: frNetworkCalls.mine.tabDrafts },
  { id: 'expired', label: frNetworkCalls.mine.tabExpired },
];

/**
 * ISE-047 — Appels au réseau (coquille mobile).
 *
 * Porte `list_network_calls` (onglets Pour moi / Tous / Ma promotion /
 * Enregistrés) et `list_my_network_calls` (« Mes appels », groupé par
 * état) — les deux RPC utilisées par `apps/web/src/app/appels/page.tsx`
 * et `apps/web/src/app/appels/mes-appels/page.tsx`. Ce sont deux
 * PAGES web distinctes ; ici elles partagent un seul écran mobile avec un
 * bandeau de bascule, pour rester dans les 5 destinations D-94 sans
 * ajouter une route de plus. Filtres avancés (type, secteur, pays,
 * urgence) volontairement absents de cette première tranche — seule la
 * recherche texte reste (même réduction de périmètre que ISE-040).
 */
export function NetworkCallsScreen({ navigation }: Props) {
  const [mode, setMode] = useState<Mode>({ kind: 'scope', scope: 'for_me' });
  const [query, setQuery] = useState('');
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback((currentMode: Mode, currentQuery: string) => {
    setState({ status: 'loading' });

    const request =
      currentMode.kind === 'scope'
        ? loadNetworkCalls(currentMode.scope, currentQuery.trim().length > 0 ? currentQuery.trim() : null, null)
        : loadMyNetworkCalls(currentMode.group, null);

    request
      .then((result) => {
        if (result.failed || result.data === null) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }
        const { rows, nextCursor } = result.data;
        if (rows.length === 0) {
          setState({ status: 'empty' });
        } else {
          setState({ status: 'ready', rows: [...rows], nextCursor, loadingMore: false });
        }
      })
      .catch(() => setState({ status: 'error', correlationId: newCorrelationId() }));
  }, []);

  useEffect(() => {
    load(mode, query);
    // La recherche se relance uniquement sur soumission (onSubmitEditing) ;
    // `query` n'entre donc pas dans les dépendances ici.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, load]);

  const loadMore = useCallback(() => {
    setState((prev) => {
      if (prev.status !== 'ready' || prev.nextCursor === null || prev.loadingMore) return prev;

      const request =
        mode.kind === 'scope'
          ? loadNetworkCalls(mode.scope, query.trim().length > 0 ? query.trim() : null, prev.nextCursor)
          : loadMyNetworkCalls(mode.group, prev.nextCursor);

      request.then((result) => {
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
  }, [mode, query]);

  const onToggleSaved = useCallback((callId: string, saved: boolean) => {
    setState((prev) => {
      if (prev.status !== 'ready') return prev;
      return {
        ...prev,
        rows: prev.rows.map((row) => (row.callId === callId ? { ...row, isSaved: saved } : row)),
      };
    });
    toggleSavedCall(callId, saved).catch(() => undefined);
  }, []);

  const emptyTitle =
    mode.kind === 'mine'
      ? mode.group === 'drafts'
        ? frNetworkCalls.mine.emptyDraftsTitle
        : frNetworkCalls.mine.emptyOtherTitle
      : mode.scope === 'for_me'
        ? frNetworkCalls.list.emptyForMeTitle
        : mode.scope === 'saved'
          ? frNetworkCalls.list.emptySavedTitle
          : frNetworkCalls.list.emptyAllTitle;

  const emptyBody =
    mode.kind === 'scope'
      ? mode.scope === 'for_me'
        ? frNetworkCalls.list.emptyForMeBody
        : mode.scope === 'saved'
          ? frNetworkCalls.list.emptySavedBody
          : frNetworkCalls.list.emptyAllBody
      : undefined;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>{frNetworkCalls.list.title}</Text>
          <Pressable
            onPress={() => navigation.navigate('AppelCreer', {})}
            accessibilityRole="button"
            style={styles.createButton}
          >
            <Text style={styles.createButtonLabel}>{frNetworkCalls.list.create}</Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>{frNetworkCalls.list.subtitle}</Text>
      </View>

      <View style={styles.modeRow}>
        <ModeChip
          label={frNetworkCalls.list.title}
          active={mode.kind === 'scope'}
          onPress={() => setMode({ kind: 'scope', scope: 'for_me' })}
        />
        <ModeChip
          label={frNetworkCalls.list.mine}
          active={mode.kind === 'mine'}
          onPress={() => setMode({ kind: 'mine', group: 'active' })}
        />
      </View>

      {mode.kind === 'scope' ? (
        <>
          <View style={styles.tabRow}>
            {SCOPE_TABS.map((tab) => (
              <TabChip
                key={tab.id}
                label={tab.label}
                active={mode.scope === tab.id}
                onPress={() => setMode({ kind: 'scope', scope: tab.id })}
              />
            ))}
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => load(mode, query)}
            placeholder={frNetworkCalls.list.searchPlaceholder}
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            style={styles.search}
          />
        </>
      ) : (
        <View style={styles.tabRow}>
          {MINE_TABS.map((tab) => (
            <TabChip
              key={tab.id}
              label={tab.label}
              active={mode.group === tab.id}
              onPress={() => setMode({ kind: 'mine', group: tab.id })}
            />
          ))}
        </View>
      )}

      {state.status === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.actionBlue} />
        </View>
      ) : null}

      {state.status === 'error' ? (
        <ErrorState
          title={frNetworkCalls.common.loadErrorTitle}
          correlationId={state.correlationId}
          onRetry={() => load(mode, query)}
        />
      ) : null}

      {state.status === 'empty' ? (
        <EmptyState title={emptyTitle} {...(emptyBody ? { description: emptyBody } : {})} />
      ) : null}

      {state.status === 'ready' ? (
        <FlatList
          data={state.rows}
          keyExtractor={(row) => row.callId}
          renderItem={({ item }) => (
            <CallCardItem
              call={item}
              onPress={() => navigation.navigate('AppelDetail', { callId: item.callId })}
              onToggleSaved={onToggleSaved}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            state.nextCursor !== null ? (
              <View style={styles.loadMore}>
                <Button label={frNetworkCalls.common.loadMore} onPress={loadMore} loading={state.loadingMore} />
              </View>
            ) : null
          }
        />
      ) : null}
    </Screen>
  );
}

function ModeChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.modeChip, active ? styles.modeChipActive : null]}>
      <Text style={[styles.modeChipLabel, active ? styles.modeChipLabelActive : null]}>{label}</Text>
    </Pressable>
  );
}

function TabChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tabChip, active ? styles.tabChipActive : null]}>
      <Text style={[styles.tabChipLabel, active ? styles.tabChipLabelActive : null]}>{label}</Text>
    </Pressable>
  );
}

function CallCardItem({
  call,
  onPress,
  onToggleSaved,
}: {
  call: NetworkCallCard;
  onPress: () => void;
  onToggleSaved: (callId: string, saved: boolean) => void;
}) {
  const isUrgent = call.urgency === 'deadline_soon';
  const authorLine = [call.author?.displayName, call.author?.promotionLabel]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' · ');

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.badgeRow}>
        {isUrgent ? (
          <View style={[styles.badge, styles.badgeUrgent]}>
            <Text style={styles.badgeUrgentLabel}>Urgent</Text>
          </View>
        ) : null}
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>{frNetworkCalls.type[call.callType] ?? call.callType}</Text>
        </View>
      </View>

      <Text style={styles.cardTitle}>{call.title}</Text>
      {authorLine.length > 0 ? <Text style={styles.cardAuthor}>{authorLine}</Text> : null}

      {call.relevance !== null ? (
        <View style={styles.relevanceBox}>
          <Text style={styles.relevanceTitle}>{frNetworkCalls.list.whyTitle}</Text>
          {call.relevance.reasons.slice(0, 2).map((reason, index) => (
            <Text key={`${call.callId}-${index}`} style={styles.relevanceReason}>
              ✓ {reason.label}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.cardResponses}>
          {call.responseCount > 0
            ? tcNetworkCalls(frNetworkCalls.list.responses, { count: call.responseCount })
            : frNetworkCalls.list.noResponse}
        </Text>
        <Pressable
          onPress={() => onToggleSaved(call.callId, !call.isSaved)}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={styles.saveLabel}>
            {call.isSaved ? frNetworkCalls.list.unsave : frNetworkCalls.list.save}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: space[4],
    gap: space[1],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {
    ...textStyle.h2,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
  createButton: {
    backgroundColor: colors.actionBlue,
    borderRadius: rounded.base,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  createButtonLabel: {
    ...textStyle.bodySm,
    color: colors.textInverse,
    fontWeight: '700',
  },
  modeRow: {
    flexDirection: 'row',
    gap: space[2],
    marginBottom: space[3],
  },
  modeChip: {
    paddingVertical: space[2],
    paddingHorizontal: space[4],
    borderRadius: rounded.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeChipActive: {
    backgroundColor: colors.actionBlue,
    borderColor: colors.actionBlue,
  },
  modeChipLabel: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modeChipLabelActive: {
    color: colors.textInverse,
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    marginBottom: space[4],
  },
  tabChip: {
    paddingVertical: space[1],
    paddingHorizontal: space[3],
    borderRadius: rounded.full,
    backgroundColor: colors.surfaceMuted,
  },
  tabChipActive: {
    backgroundColor: colors.actionBlue,
  },
  tabChipLabel: {
    ...textStyle.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tabChipLabelActive: {
    color: colors.textInverse,
  },
  search: {
    ...textStyle.bodySm,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    paddingHorizontal: space[4],
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    marginBottom: space[4],
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingBottom: space[6],
  },
  separator: {
    height: space[4],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[5],
    gap: space[2],
  },
  badgeRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  badge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: rounded.full,
    paddingHorizontal: space[3],
    paddingVertical: 2,
  },
  badgeLabel: {
    ...textStyle.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  badgeUrgent: {
    backgroundColor: '#FEF3C7',
  },
  badgeUrgentLabel: {
    ...textStyle.caption,
    color: '#92400E',
    fontWeight: '700',
  },
  cardTitle: {
    ...textStyle.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardAuthor: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
  relevanceBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: rounded.base,
    padding: space[3],
    gap: 2,
  },
  relevanceTitle: {
    ...textStyle.caption,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  relevanceReason: {
    ...textStyle.caption,
    color: colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space[1],
  },
  cardResponses: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
  saveLabel: {
    ...textStyle.caption,
    color: colors.actionBlue,
    fontWeight: '700',
  },
  loadMore: {
    marginTop: space[5],
    alignItems: 'center',
  },
});
