import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { fr } from '../../i18n/fr';
import { frNetworkCalls } from '../../i18n/network-calls';
import { newCorrelationId } from '../../lib/correlation';
import {
  loadConnections,
  loadNetworkSummary,
  type ConnectionRow,
  type NetworkSummary,
} from '../../lib/queries/network';
import { colors, rounded, space, textStyle } from '../../theme/tokens';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'empty' }
  | { status: 'ready'; rows: ConnectionRow[]; nextCursor: string | null; loadingMore: boolean };

/**
 * ISE-040 — Mes relations (coquille mobile).
 *
 * `my_network_summary()` alimente le bandeau de compteurs, `list_my_connections()`
 * la liste elle-meme — exactement les deux RPC utilisees par
 * `apps/web/src/app/reseau/relations/page.tsx`. Pas de recherche ni de rail
 * lateral pour cette premiere tranche mobile : une liste et un « charger la
 * suite » (D-44 simplifie, la pagination par curseur keyset reste la meme
 * en base).
 */
export function NetworkScreen() {
  const navigation = useNavigation();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [summary, setSummary] = useState<NetworkSummary | null>(null);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    setSummary(null);

    Promise.all([loadConnections(null), loadNetworkSummary()])
      .then(([connectionsResult, summaryResult]) => {
        if (connectionsResult.failed || connectionsResult.page === null) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }

        if (!summaryResult.failed) {
          setSummary(summaryResult.summary);
        }

        const { rows, nextCursor } = connectionsResult.page;
        if (rows.length === 0) {
          setState({ status: 'empty' });
        } else {
          setState({ status: 'ready', rows: [...rows], nextCursor, loadingMore: false });
        }
      })
      .catch(() => {
        setState({ status: 'error', correlationId: newCorrelationId() });
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(() => {
    setState((prev) => {
      if (prev.status !== 'ready' || prev.nextCursor === null || prev.loadingMore) return prev;

      loadConnections(prev.nextCursor).then((result) => {
        setState((current) => {
          if (current.status !== 'ready') return current;
          if (result.failed || result.page === null) {
            return { ...current, loadingMore: false };
          }
          return {
            status: 'ready',
            rows: [...current.rows, ...result.page.rows],
            nextCursor: result.page.nextCursor,
            loadingMore: false,
          };
        });
      });

      return { ...prev, loadingMore: true };
    });
  }, []);

  return (
    <Screen>
      <Text style={styles.heading}>{fr.network.title}</Text>

      {/*
       * ISE-047 -> ISE-054 — point d'entree vers « Appels au reseau »
       * (tranche verticale distincte, `screens/network-calls/`). Cette
       * pile (`navigation/NetworkCallsStack.tsx`) n'est pas encore montee
       * dans `AppTabs.tsx` (fichier partage, hors perimetre de ce lot) :
       * tant qu'un lot autorise a toucher `AppTabs.tsx` ne l'a pas
       * enregistree (ex. en remplacant le composant de l'onglet
       * « Reseau » par `NetworkCallsStack`, avec cet ecran comme premier
       * ecran de la pile), cette carte ne navigue nulle part — React
       * Navigation avertit en developpement plutot que de planter.
       */}
      <Pressable
        onPress={() => navigation.navigate('AppelsReseau' as never)}
        accessibilityRole="button"
        style={styles.callsEntry}
      >
        <Text style={styles.callsEntryLabel}>{frNetworkCalls.list.title}</Text>
        <Text style={styles.callsEntryHint}>{frNetworkCalls.list.subtitle}</Text>
      </Pressable>

      {summary !== null ? (
        <View style={styles.summaryRow}>
          <SummaryStat value={summary.connections} label={fr.network.statConnections} />
          <SummaryStat value={summary.promotions} label={fr.network.statPromotions} />
          <SummaryStat value={summary.countries} label={fr.network.statCountries} />
        </View>
      ) : null}

      {state.status === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.actionBlue} />
        </View>
      ) : null}

      {state.status === 'error' ? (
        <ErrorState
          title={fr.network.errorTitle}
          correlationId={state.correlationId}
          onRetry={load}
        />
      ) : null}

      {state.status === 'empty' ? (
        <EmptyState title={fr.network.emptyTitle} description={fr.network.emptyBody} />
      ) : null}

      {state.status === 'ready' ? (
        <FlatList
          data={state.rows}
          keyExtractor={(row) => row.profile.profileId}
          renderItem={({ item }) => <ConnectionCard row={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            state.nextCursor !== null ? (
              <View style={styles.loadMore}>
                <Button label={fr.common.loadMore} onPress={loadMore} loading={state.loadingMore} />
              </View>
            ) : null
          }
        />
      ) : null}
    </Screen>
  );
}

function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  return (first + last).toUpperCase();
}

function ConnectionCard({ row }: { row: ConnectionRow }) {
  const { profile } = row;
  const subtitle = [profile.promotionLabel, profile.currentPosition]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' · ');

  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarLabel}>{initials(profile.displayName)}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.name}>{profile.displayName}</Text>
        {subtitle.length > 0 ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {profile.headline ? (
          <Text style={styles.headline} numberOfLines={2}>
            {profile.headline}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function SummaryStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  callsEntry: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[5],
    marginBottom: space[5],
    gap: space[1],
  },
  callsEntryLabel: {
    ...textStyle.body,
    fontWeight: '700',
    color: colors.actionBlue,
  },
  callsEntryHint: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
  heading: {
    ...textStyle.h2,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: space[5],
  },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[5],
    marginBottom: space[6],
  },
  stat: {
    flex: 1,
    gap: space[1],
  },
  statValue: {
    ...textStyle.h3,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    ...textStyle.caption,
    color: colors.textMuted,
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
    flexDirection: 'row',
    gap: space[4],
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[5],
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: rounded.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    ...textStyle.body,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  cardBody: {
    flex: 1,
    gap: space[1],
  },
  name: {
    ...textStyle.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    ...textStyle.caption,
    color: colors.textSecondary,
  },
  headline: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
  loadMore: {
    marginTop: space[5],
    alignItems: 'center',
  },
});
