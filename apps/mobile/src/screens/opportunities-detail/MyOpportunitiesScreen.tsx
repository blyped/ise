import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { frOpportunitiesDetail as t, toDetail } from '../../i18n/opportunities-detail';
import { newCorrelationId } from '../../lib/correlation';
import {
  loadMyOpportunities,
  type MyOpportunityGroup,
  type OpportunitySummary,
} from '../../lib/queries/opportunities-detail';
import { colors, rounded, space, textStyle } from '../../theme/tokens';
import { Badge, type BadgeTone } from './shared';

const TABS: { key: MyOpportunityGroup; label: () => string }[] = [
  { key: 'active', label: () => t.mine.tabActive },
  { key: 'drafts', label: () => t.mine.tabDrafts },
  { key: 'closed', label: () => t.mine.tabClosed },
  { key: 'expired', label: () => t.mine.tabExpired },
];

const STATUS_TONE: Record<string, BadgeTone> = {
  draft: 'warning',
  active: 'success',
  paused: 'info',
  closed: 'neutral',
  expired: 'neutral',
  cancelled: 'neutral',
  moderated: 'warning',
};

/**
 * Mes offres publiées — support de ISE-060/061.
 *
 * `list_my_opportunities()` — même RPC que
 * `apps/web/src/app/opportunites/mes-offres/page.tsx`. Aucun numéro ISE
 * dédié : c'est le point d'entrée qui mène au suivi (ISE-060) de chaque
 * offre, à la place de la liste globale ISE-055 quand on gère des offres.
 */
export function MyOpportunitiesScreen({
  onBack,
  onOpenTracking,
}: {
  onBack: () => void;
  onOpenTracking: (opportunityId: string) => void;
}) {
  const [tab, setTab] = useState<MyOpportunityGroup>('active');
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; correlationId: string }
    | { status: 'ready'; rows: OpportunitySummary[] }
  >({ status: 'loading' });

  const load = useCallback(() => {
    setState({ status: 'loading' });
    loadMyOpportunities(tab, null)
      .then((result) => {
        if (result.failed || result.data === null) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }
        setState({ status: 'ready', rows: [...result.data.rows] });
      })
      .catch(() => setState({ status: 'error', correlationId: newCorrelationId() }));
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = state.status === 'ready' ? state.rows : [];
  const emptyTitle =
    tab === 'active' ? t.mine.emptyActiveTitle : tab === 'drafts' ? t.mine.emptyDraftsTitle : t.mine.emptyOtherTitle;
  const emptyBody =
    tab === 'active' ? t.mine.emptyActiveBody : tab === 'drafts' ? t.mine.emptyDraftsBody : t.mine.emptyOtherBody;

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.headerBack}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t.mine.title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabs}>
        {TABS.map((item) => (
          <Pressable key={item.key} onPress={() => setTab(item.key)} accessibilityRole="button" style={styles.tabButton}>
            <Text style={[styles.tabLabel, tab === item.key ? styles.tabLabelActive : null]}>{item.label()}</Text>
            {tab === item.key ? <View style={styles.tabIndicator} /> : null}
          </Pressable>
        ))}
      </View>

      {state.status === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.actionBlue} />
        </View>
      ) : null}

      {state.status === 'error' ? (
        <ErrorState title={t.common.loadErrorTitle} correlationId={state.correlationId} onRetry={load} />
      ) : null}

      {state.status === 'ready' && rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyBody} />
      ) : null}

      {state.status === 'ready' && rows.length > 0 ? (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.opportunityId}
          renderItem={({ item }) => (
            <OpportunityRow opportunity={item} onPress={() => onOpenTracking(item.opportunityId)} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      ) : null}
    </Screen>
  );
}

function OpportunityRow({ opportunity, onPress }: { opportunity: OpportunitySummary; onPress: () => void }) {
  const location = [opportunity.organization, opportunity.city].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Badge label={t.type[opportunity.opportunityType] ?? opportunity.opportunityType} tone="purple" />
        <Badge label={t.status[opportunity.status] ?? opportunity.status} tone={STATUS_TONE[opportunity.status] ?? 'neutral'} />
      </View>
      <Text style={styles.cardTitle}>{opportunity.title}</Text>
      {location.length > 0 ? <Text style={styles.cardMeta}>{location}</Text> : null}
      <View style={styles.cardStatsRow}>
        {opportunity.applicationCount !== null ? (
          <Text style={styles.cardStat}>{toDetail(t.mine.applicationsCount, { count: opportunity.applicationCount })}</Text>
        ) : null}
        {opportunity.targetedCount !== null ? (
          <Text style={styles.cardStat}>{toDetail(t.mine.targetedCount, { count: opportunity.targetedCount })}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space[5],
  },
  headerBack: {
    fontSize: 28,
    color: colors.textPrimary,
    width: 32,
  },
  headerTitle: {
    ...textStyle.h4,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  tabs: {
    flexDirection: 'row',
    gap: space[5],
    marginBottom: space[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabButton: {
    paddingBottom: space[3],
  },
  tabLabel: {
    ...textStyle.bodySm,
    color: colors.textMuted,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: colors.actionBlue,
  },
  tabIndicator: {
    marginTop: space[2],
    height: 2,
    backgroundColor: colors.actionBlue,
    borderRadius: rounded.full,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingBottom: space[8],
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
  cardHeaderRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  cardTitle: {
    ...textStyle.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardMeta: {
    ...textStyle.caption,
    color: colors.textSecondary,
  },
  cardStatsRow: {
    flexDirection: 'row',
    gap: space[4],
  },
  cardStat: {
    ...textStyle.caption,
    color: colors.actionBlue,
    fontWeight: '600',
  },
});
