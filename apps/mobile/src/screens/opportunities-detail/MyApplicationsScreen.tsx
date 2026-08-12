import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { frOpportunitiesDetail as t, toDetail } from '../../i18n/opportunities-detail';
import { newCorrelationId } from '../../lib/correlation';
import {
  loadMyApplications,
  type ApplicationRow,
  type ApplicationStatus,
  type MyApplicationGroup,
} from '../../lib/queries/opportunities-detail';
import { colors, rounded, space, textStyle } from '../../theme/tokens';
import { Badge, type BadgeTone, formatDate } from './shared';

const TABS: { key: MyApplicationGroup; label: () => string }[] = [
  { key: 'in_progress', label: () => t.applications.tabInProgress },
  { key: 'drafts', label: () => t.applications.tabDrafts },
  { key: 'finished', label: () => t.applications.tabFinished },
];

const STATUS_TONE: Record<ApplicationStatus, BadgeTone> = {
  draft: 'warning',
  submitted: 'info',
  viewed: 'info',
  under_review: 'info',
  interview: 'purple',
  selected: 'success',
  not_selected: 'neutral',
  withdrawn: 'neutral',
  closed: 'neutral',
};

/**
 * ISE-063 — Mes candidatures.
 *
 * `list_my_applications()` — même RPC que
 * `apps/web/src/app/candidatures/page.tsx`. Les compteurs affichés dans
 * les onglets viennent d'un chargement séparé et léger de chaque groupe
 * (comme le visuel « En cours 4 · À préparer 2 · Terminées »), plutôt que
 * d'un total global qu'aucune RPC ne renvoie directement.
 */
export function MyApplicationsScreen({
  onBack,
  onOpenApplication,
}: {
  onBack: () => void;
  onOpenApplication: (applicationId: string) => void;
}) {
  const [tab, setTab] = useState<MyApplicationGroup>('in_progress');
  const [counts, setCounts] = useState<Record<MyApplicationGroup, number>>({
    in_progress: 0,
    drafts: 0,
    finished: 0,
    withdrawn: 0,
  });
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; correlationId: string }
    | { status: 'ready'; rows: ApplicationRow[] }
  >({ status: 'loading' });

  const loadCounts = useCallback(() => {
    (['in_progress', 'drafts', 'finished'] as const).forEach((group) => {
      loadMyApplications(group, null)
        .then((result) => {
          if (result.failed || result.data === null) return;
          const rowCount = result.data.rows.length;
          setCounts((prev) => ({ ...prev, [group]: rowCount }));
        })
        .catch(() => undefined);
    });
  }, []);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    loadMyApplications(tab, null)
      .then((result) => {
        if (result.failed || result.data === null) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }
        const rows = [...result.data.rows];
        setState({ status: 'ready', rows });
        setCounts((prev) => ({ ...prev, [tab]: rows.length }));
      })
      .catch(() => setState({ status: 'error', correlationId: newCorrelationId() }));
  }, [tab]);

  useEffect(() => {
    loadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = state.status === 'ready' ? state.rows : [];
  const inProgressCount = counts.in_progress;
  const statusCounts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.headerBack}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t.applications.title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabs}>
        {TABS.map((item) => (
          <Pressable key={item.key} onPress={() => setTab(item.key)} accessibilityRole="button" style={styles.tabButton}>
            <Text style={[styles.tabLabel, tab === item.key ? styles.tabLabelActive : null]}>
              {item.label()} {counts[item.key]}
            </Text>
            {tab === item.key ? <View style={styles.tabIndicator} /> : null}
          </Pressable>
        ))}
      </View>

      {inProgressCount > 0 ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeText}>{toDetail(t.applications.actionsThisWeek, { count: inProgressCount })}</Text>
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <StatCard value={statusCounts['draft'] ?? 0} label={t.applications.statToPrepare} />
        <StatCard value={statusCounts['submitted'] ?? 0} label={t.applications.statSent} />
        <StatCard value={statusCounts['interview'] ?? 0} label={t.applications.statInterview} />
        <StatCard value={statusCounts['selected'] ?? 0} label={t.applications.statSelected} />
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
        <EmptyState title={t.applications.emptyTitle} description={t.applications.emptyBody} />
      ) : null}

      {state.status === 'ready' && rows.length > 0 ? (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.applicationId}
          renderItem={({ item }) => (
            <ApplicationCard application={item} onPress={() => onOpenApplication(item.applicationId)} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      ) : null}
    </Screen>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ApplicationCard({ application, onPress }: { application: ApplicationRow; onPress: () => void }) {
  const statusLabel = t.applicationStatus[application.status] ?? application.status;
  const opportunity = application.opportunity;
  const location = [opportunity?.organization, opportunity?.city].filter(Boolean).join(' · ');
  const dateLine =
    application.channel === 'external' && application.declaredAt !== null
      ? toDetail(t.applications.declaredOn, { date: formatDate(application.declaredAt) ?? application.declaredAt })
      : application.submittedAt !== null
        ? toDetail(t.applications.sentOn, { date: formatDate(application.submittedAt) ?? application.submittedAt })
        : null;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.card}>
      <Text style={styles.cardTitle}>{opportunity?.title ?? '—'}</Text>
      {location.length > 0 ? <Text style={styles.cardMeta}>{location}</Text> : null}
      <View style={styles.cardBadgeRow}>
        <Badge label={statusLabel} tone={STATUS_TONE[application.status]} />
        {application.channel === 'external' ? <Badge label={t.applications.channelExternal} tone="neutral" /> : null}
      </View>
      {dateLine !== null ? <Text style={styles.cardDate}>{dateLine}</Text> : null}
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
  noticeCard: {
    backgroundColor: '#FDF3DC',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: rounded.lg,
    padding: space[4],
    marginBottom: space[4],
  },
  noticeText: {
    ...textStyle.bodySm,
    color: colors.warning,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: space[3],
    marginBottom: space[5],
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    padding: space[3],
    alignItems: 'center',
    gap: space[1],
  },
  statValue: {
    ...textStyle.h3,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    ...textStyle.caption,
    color: colors.actionBlue,
    fontWeight: '600',
    textAlign: 'center',
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
  cardTitle: {
    ...textStyle.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardMeta: {
    ...textStyle.caption,
    color: colors.textSecondary,
  },
  cardBadgeRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  cardDate: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
});
