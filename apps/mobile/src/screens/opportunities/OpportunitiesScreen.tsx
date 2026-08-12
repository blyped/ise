import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { fr } from '../../i18n/fr';
import { newCorrelationId } from '../../lib/correlation';
import { loadOpportunities, type OpportunityCard } from '../../lib/queries/opportunities';
import { colors, rounded, space, textStyle } from '../../theme/tokens';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'empty' }
  | { status: 'ready'; rows: OpportunityCard[]; nextCursor: string | null; loadingMore: boolean };

/**
 * ISE-055 — Hub Opportunités (coquille mobile).
 *
 * `list_opportunities()` — meme RPC que `apps/web/src/app/opportunites/page.tsx`,
 * appelee ici avec `p_scope: 'all', p_status: 'open'` : une liste simple des
 * opportunites ouvertes, sans les onglets ni les filtres du web (D27 §1,
 * perimetre reduit pour cette premiere tranche mobile).
 */
export function OpportunitiesScreen() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(() => {
    setState({ status: 'loading' });

    loadOpportunities(null)
      .then((result) => {
        if (result.failed || result.page === null) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }

        const { rows, nextCursor } = result.page;
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

      loadOpportunities(prev.nextCursor).then((result) => {
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
      <Text style={styles.heading}>{fr.opportunities.title}</Text>

      {state.status === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.actionBlue} />
        </View>
      ) : null}

      {state.status === 'error' ? (
        <ErrorState
          title={fr.opportunities.errorTitle}
          correlationId={state.correlationId}
          onRetry={load}
        />
      ) : null}

      {state.status === 'empty' ? (
        <EmptyState title={fr.opportunities.emptyTitle} description={fr.opportunities.emptyBody} />
      ) : null}

      {state.status === 'ready' ? (
        <FlatList
          data={state.rows}
          keyExtractor={(row) => row.opportunityId}
          renderItem={({ item }) => <OpportunityCardView opportunity={item} />}
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

function OpportunityCardView({ opportunity }: { opportunity: OpportunityCard }) {
  const typeLabel = fr.opportunities.type[opportunity.opportunityType] ?? opportunity.opportunityType;
  const statusLabel = fr.opportunities.status[opportunity.status] ?? opportunity.status;
  const location = [opportunity.city, opportunity.country]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(', ');

  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        <Badge label={typeLabel} />
        <Badge label={statusLabel} />
      </View>
      <Text style={styles.title}>{opportunity.title}</Text>
      {opportunity.organization ? (
        <Text style={styles.organization}>{opportunity.organization}</Text>
      ) : null}
      {location.length > 0 ? <Text style={styles.location}>{location}</Text> : null}
      {opportunity.summary ? (
        <Text style={styles.summary} numberOfLines={2}>
          {opportunity.summary}
        </Text>
      ) : null}
    </View>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...textStyle.h2,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: space[6],
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
    marginBottom: space[1],
  },
  badge: {
    paddingHorizontal: space[4],
    paddingVertical: space[1],
    borderRadius: rounded.full,
    backgroundColor: colors.surfaceMuted,
  },
  badgeLabel: {
    ...textStyle.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  title: {
    ...textStyle.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  organization: {
    ...textStyle.caption,
    color: colors.textSecondary,
  },
  location: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
  summary: {
    ...textStyle.caption,
    color: colors.textMuted,
    marginTop: space[1],
  },
  loadMore: {
    marginTop: space[5],
    alignItems: 'center',
  },
});
