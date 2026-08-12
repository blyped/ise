import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { frOpportunitiesDetail as t, toDetail } from '../../i18n/opportunities-detail';
import { newCorrelationId } from '../../lib/correlation';
import { loadOpportunitiesByScope, type OpportunitySummary } from '../../lib/queries/opportunities-detail';
import { colors, rounded, space, textStyle } from '../../theme/tokens';
import { Badge, Card, daysUntil, formatDate } from './shared';

type Tab = 'saved' | 'applications' | 'history';

/**
 * ISE-062 — Opportunités enregistrées.
 *
 * `list_opportunities(p_scope: 'saved')` — même RPC que
 * `apps/web/src/app/opportunites/enregistrees/page.tsx`. L'onglet
 * « Candidatures » du visuel bascule vers `MyApplicationsScreen` (ISE-063,
 * écran séparé) plutôt que de dupliquer sa logique ici. L'onglet
 * « Historique » filtre localement les offres enregistrées dont le statut
 * n'est plus « active » — aucune RPC dédiée à un « historique » distinct
 * n'existe dans le périmètre confié à cette tranche.
 */
export function SavedOpportunitiesScreen({
  onBack,
  onOpenOpportunity,
  onOpenApplications,
}: {
  onBack: () => void;
  onOpenOpportunity: (opportunityId: string) => void;
  onOpenApplications: () => void;
}) {
  const [tab, setTab] = useState<Tab>('saved');
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; correlationId: string }
    | { status: 'ready'; rows: OpportunitySummary[] }
  >({ status: 'loading' });
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    setState({ status: 'loading' });
    loadOpportunitiesByScope('saved', null, null)
      .then((result) => {
        if (result.failed || result.data === null) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }
        setState({ status: 'ready', rows: [...result.data.rows] });
      })
      .catch(() => setState({ status: 'error', correlationId: newCorrelationId() }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const allRows = state.status === 'ready' ? state.rows : [];
  const visibleRows = allRows
    .filter((row) => (tab === 'history' ? row.status !== 'active' : row.status === 'active'))
    .filter((row) =>
      query.trim().length === 0 ? true : row.title.toLowerCase().includes(query.trim().toLowerCase()),
    );

  const upcomingDeadlines = allRows.filter((row) => {
    const days = daysUntil(row.deadline);
    return days !== null && days >= 0 && days <= 7;
  }).length;

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.headerBack}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t.saved.title}</Text>
        <Text style={styles.headerCount}>{allRows.length}</Text>
      </View>

      <View style={styles.tabs}>
        <TabButton label={t.saved.tabSaved} active={tab === 'saved'} onPress={() => setTab('saved')} />
        <TabButton label={t.saved.tabApplications} active={false} onPress={onOpenApplications} />
        <TabButton label={t.saved.tabHistory} active={tab === 'history'} onPress={() => setTab('history')} />
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder={t.saved.searchPlaceholder}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          accessibilityLabel={t.saved.searchPlaceholder}
        />
      </View>

      {upcomingDeadlines > 0 ? (
        <Card tone="warning">
          <Text style={styles.deadlineNoticeText}>
            {upcomingDeadlines === 1
              ? t.saved.deadlineNoticeOne
              : toDetail(t.saved.deadlineNotice, { count: upcomingDeadlines })}
          </Text>
        </Card>
      ) : null}

      {state.status === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.actionBlue} />
        </View>
      ) : null}

      {state.status === 'error' ? (
        <ErrorState title={t.common.loadErrorTitle} correlationId={state.correlationId} onRetry={load} />
      ) : null}

      {state.status === 'ready' && visibleRows.length === 0 ? (
        <EmptyState title={t.saved.emptyTitle} description={t.saved.emptyBody} />
      ) : null}

      {state.status === 'ready' && visibleRows.length > 0 ? (
        <FlatList
          data={visibleRows}
          keyExtractor={(row) => row.opportunityId}
          renderItem={({ item }) => (
            <SavedOpportunityCard opportunity={item} onPress={() => onOpenOpportunity(item.opportunityId)} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      ) : null}
    </Screen>
  );
}

function SavedOpportunityCard({
  opportunity,
  onPress,
}: {
  opportunity: OpportunitySummary;
  onPress: () => void;
}) {
  const typeLabel = t.type[opportunity.opportunityType] ?? opportunity.opportunityType;
  const relevanceLabel =
    opportunity.relevance?.label !== null && opportunity.relevance?.label !== undefined
      ? (t.relevance[opportunity.relevance.label] ?? opportunity.relevance.label)
      : null;
  const location = [opportunity.organization, opportunity.city].filter(Boolean).join(' · ');
  const days = daysUntil(opportunity.deadline);
  const deadlineText =
    days !== null && days >= 0
      ? toDetail(t.saved.expiresIn, { days })
      : opportunity.deadline !== null
        ? toDetail(t.saved.deadlineOn, { date: formatDate(opportunity.deadline) ?? opportunity.deadline })
        : null;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Badge label={typeLabel} tone="purple" />
        {relevanceLabel !== null ? <Badge label={relevanceLabel} tone="success" /> : null}
      </View>
      <Text style={styles.cardTitle}>{opportunity.title}</Text>
      {location.length > 0 ? <Text style={styles.cardMeta}>{location}</Text> : null}
      {deadlineText !== null ? <Text style={styles.cardDeadline}>{deadlineText}</Text> : null}
      <Text style={styles.cardLink}>{t.saved.see}</Text>
    </Pressable>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.tabButton}>
      <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>{label}</Text>
      {active ? <View style={styles.tabIndicator} /> : null}
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
  },
  headerCount: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.actionBlue,
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
  searchRow: {
    marginBottom: space[4],
  },
  searchInput: {
    ...textStyle.bodySm,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    paddingHorizontal: space[4],
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  deadlineNoticeText: {
    ...textStyle.bodySm,
    color: colors.warning,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingTop: space[4],
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
  cardDeadline: {
    ...textStyle.caption,
    color: colors.warning,
    fontWeight: '700',
  },
  cardLink: {
    ...textStyle.caption,
    color: colors.actionBlue,
    fontWeight: '700',
  },
});
