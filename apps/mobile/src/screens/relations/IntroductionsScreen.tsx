import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  INTRODUCTION_STATUS_LABELS,
  INTRODUCTION_TIMELINE,
  introductionMachine,
  type IntroductionActor,
  type IntroductionStatus,
} from '@ise/domain';

import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { frRelations } from '../../i18n/relations';
import { newCorrelationId } from '../../lib/correlation';
import {
  loadIntroduction,
  loadIntroductions,
  transitionIntroduction,
  type IntroductionDetail,
  type IntroductionEventRow,
  type IntroductionRow,
} from '../../lib/queries/relations';
import type { RelationsStackParamList } from '../../navigation/RelationsStack';
import { colors, rounded, space, textStyle } from '../../theme/tokens';

type Props = NativeStackScreenProps<RelationsStackParamList, 'Introductions'>;

/**
 * ISE-045 — Mes demandes d'introduction : liste ET suivi d'une demande,
 * DANS LE MÊME ÉCRAN, exactement comme le documente `RelationsStack.tsx` :
 * sans `route.params?.introductionId`, `list_my_introductions` alimente
 * une liste ; avec, `get_introduction_request` alimente le suivi
 * détaillé. C'est la même distinction que la pile web fait entre
 * `/reseau/introductions` et `/reseau/introductions/[id]`.
 *
 * Le suivi dérive ses boutons d'action UNIQUEMENT de
 * `introductionMachine.available(statut, acteur)` (`@ise/domain`) —
 * miroir TypeScript de `public.transition_introduction()` (D-50) —
 * exactement comme `apps/web/src/components/network/IntroductionActions.tsx`.
 * `completed` et `no_outcome` ne sont JAMAIS des boutons directs : ce
 * sont des liens vers ISE-046 (`IntroductionOutcome`), qui exige un
 * résultat déclaré (MASTER PROMPT §25).
 */
export function IntroductionsScreen({ route, navigation }: Props) {
  const introductionId = route.params?.introductionId ?? null;

  if (introductionId === null) {
    return <IntroductionsList navigation={navigation} />;
  }
  return <IntroductionFollow introductionId={introductionId} navigation={navigation} />;
}

/* ------------------------------------------------------------------ */
/* Mode liste                                                          */
/* ------------------------------------------------------------------ */

type Scope = 'all' | 'requester' | 'intermediary' | 'target';

type ListState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'ready'; rows: IntroductionRow[]; nextCursor: string | null; loadingMore: boolean };

function IntroductionsList({ navigation }: { navigation: Props['navigation'] }) {
  const [scope, setScope] = useState<Scope>('all');
  const [state, setState] = useState<ListState>({ status: 'loading' });

  const load = useCallback((currentScope: Scope) => {
    setState({ status: 'loading' });
    loadIntroductions(currentScope, null)
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
    load(scope);
  }, [load, scope]);

  const loadMore = useCallback(() => {
    setState((prev) => {
      if (prev.status !== 'ready' || prev.nextCursor === null || prev.loadingMore) return prev;
      loadIntroductions(scope, prev.nextCursor).then((result) => {
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
  }, [scope]);

  return (
    <Screen>
      <ScreenHeader title={frRelations.introductions.listTitle} onBack={navigation.goBack} />
      <Text style={styles.subtitle}>{frRelations.introductions.listSubtitle}</Text>

      <View style={styles.tabRow}>
        <TabButton label={frRelations.introductions.tabAll} active={scope === 'all'} onPress={() => setScope('all')} />
        <TabButton
          label={frRelations.introductions.tabRequester}
          active={scope === 'requester'}
          onPress={() => setScope('requester')}
        />
        <TabButton
          label={frRelations.introductions.tabIntermediary}
          active={scope === 'intermediary'}
          onPress={() => setScope('intermediary')}
        />
        <TabButton
          label={frRelations.introductions.tabTarget}
          active={scope === 'target'}
          onPress={() => setScope('target')}
        />
      </View>

      {state.status === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.actionBlue} />
        </View>
      ) : null}

      {state.status === 'error' ? (
        <ErrorState
          title={frRelations.introductions.listErrorTitle}
          correlationId={state.correlationId}
          onRetry={() => load(scope)}
        />
      ) : null}

      {state.status === 'ready' && state.rows.length === 0 ? (
        <EmptyState
          title={frRelations.introductions.listEmptyTitle}
          description={frRelations.introductions.listEmptyBody}
        />
      ) : null}

      {state.status === 'ready' && state.rows.length > 0 ? (
        <FlatList
          data={state.rows}
          keyExtractor={(row) => row.introductionId}
          renderItem={({ item }) => (
            <IntroductionRowCard row={item} onPress={() => navigation.push('Introductions', { introductionId: item.introductionId })} />
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

function IntroductionRowCard({ row, onPress }: { row: IntroductionRow; onPress: () => void }) {
  const roleLabel =
    row.myRole === 'requester'
      ? frRelations.introductions.roleRequester
      : row.myRole === 'intermediary'
        ? frRelations.introductions.roleIntermediary
        : frRelations.introductions.roleTarget;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.card}>
      <Text style={styles.cardRole}>{roleLabel}</Text>
      <Text style={styles.cardPath}>
        {row.requester?.displayName ?? '—'} → {row.intermediary?.displayName ?? '—'} → {row.target?.displayName ?? '—'}
      </Text>
      <Text style={styles.cardPurpose}>{frRelations.purpose[row.purpose] ?? row.purpose}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeLabel}>{INTRODUCTION_STATUS_LABELS[row.status]}</Text>
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Mode suivi                                                          */
/* ------------------------------------------------------------------ */

type FollowState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'notFound' }
  | { status: 'ready'; detail: IntroductionDetail };

const OUTCOME_STATUSES: readonly IntroductionStatus[] = ['completed', 'no_outcome'];

const TRANSITIONABLE_STATUSES: readonly IntroductionStatus[] = [
  'intermediary_accepted',
  'intermediary_declined',
  'withdrawn',
  'introduced',
  'target_responded',
];

function IntroductionFollow({
  introductionId,
  navigation,
}: {
  introductionId: string;
  navigation: Props['navigation'];
}) {
  const [state, setState] = useState<FollowState>({ status: 'loading' });
  const [transitioning, setTransitioning] = useState(false);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    loadIntroduction(introductionId)
      .then((result) => {
        if (result.failed) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }
        if (result.data === null) {
          setState({ status: 'notFound' });
          return;
        }
        setState({ status: 'ready', detail: result.data });
      })
      .catch(() => setState({ status: 'error', correlationId: newCorrelationId() }));
  }, [introductionId]);

  useEffect(() => {
    load();
  }, [load]);

  const onTransition = useCallback(
    (toStatus: IntroductionStatus) => {
      if (!TRANSITIONABLE_STATUSES.includes(toStatus)) return;
      setTransitioning(true);
      transitionIntroduction(
        introductionId,
        toStatus as Exclude<IntroductionStatus, 'requested' | 'expired' | 'completed' | 'no_outcome'>,
        null,
      )
        .then((result) => {
          setTransitioning(false);
          if (!result.failed) load();
        })
        .catch(() => setTransitioning(false));
    },
    [introductionId, load],
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
        <ScreenHeader title={frRelations.introductions.title} onBack={navigation.goBack} />
        <ErrorState title={frRelations.introductions.errorTitle} correlationId={state.correlationId} onRetry={load} />
      </Screen>
    );
  }

  if (state.status === 'notFound') {
    return (
      <Screen>
        <ScreenHeader title={frRelations.introductions.title} onBack={navigation.goBack} />
        <Text style={styles.noticeTitle}>{frRelations.introductions.notFoundTitle}</Text>
      </Screen>
    );
  }

  const { detail } = state;
  const actor = detail.myRole as IntroductionActor;
  const transitions = introductionMachine.available(detail.status, actor);
  const direct = transitions.filter((t) => !OUTCOME_STATUSES.includes(t.to));
  const needsOutcome = transitions.some((t) => OUTCOME_STATUSES.includes(t.to));
  const roleLabel =
    detail.myRole === 'requester'
      ? frRelations.introductions.roleRequester
      : detail.myRole === 'intermediary'
        ? frRelations.introductions.roleIntermediary
        : frRelations.introductions.roleTarget;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScreenHeader title={frRelations.introductions.title} onBack={navigation.goBack} />

        <Text style={styles.roleLine}>{roleLabel}</Text>
        <Text style={styles.pathLine}>
          {detail.requester?.displayName ?? '—'} → {detail.intermediary?.displayName ?? '—'} →{' '}
          {detail.target?.displayName ?? '—'}
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>{INTRODUCTION_STATUS_LABELS[detail.status]}</Text>
        </View>

        <Section title={frRelations.introductions.purposeLabel}>
          <Text style={styles.paragraph}>{frRelations.purpose[detail.purpose] ?? detail.purpose}</Text>
        </Section>

        <Section title={frRelations.introductions.historyTitle}>
          <Timeline status={detail.status} events={detail.events} />
        </Section>

        <View style={styles.confusionBox}>
          <Text style={styles.confusionTitle}>{frRelations.introductions.confusionTitle}</Text>
          <Text style={styles.confusionBody}>{frRelations.introductions.confusionBody}</Text>
        </View>

        {detail.messageToIntermediary !== null ? (
          <Section title={frRelations.introductions.messageToIntermediaryTitle}>
            <Text style={styles.paragraph}>{detail.messageToIntermediary}</Text>
          </Section>
        ) : null}

        {detail.messageToTarget !== null ? (
          <Section title={frRelations.introductions.messageToTargetTitle}>
            <Text style={styles.paragraph}>{detail.messageToTarget}</Text>
          </Section>
        ) : null}

        {detail.declineReason !== null ? (
          <Section title={frRelations.introductions.declineReasonTitle}>
            <Text style={styles.paragraph}>{detail.declineReason}</Text>
          </Section>
        ) : null}

        <Section title={frRelations.introductions.actionsTitle}>
          {transitions.length === 0 ? (
            <Text style={styles.paragraph}>{frRelations.introductions.actionsNone}</Text>
          ) : (
            <View style={styles.actionsBox}>
              {direct.map((transition) => (
                <Button
                  key={`${transition.from}-${transition.to}`}
                  label={transitioning ? frRelations.introductions.actionPending : transition.label}
                  onPress={() => onTransition(transition.to)}
                  loading={transitioning}
                />
              ))}
              {needsOutcome ? (
                <Pressable
                  onPress={() => navigation.navigate('IntroductionOutcome', { introductionId })}
                  accessibilityRole="button"
                  style={styles.outcomeLinkButton}
                >
                  <Text style={styles.outcomeLinkLabel}>{frRelations.introductions.outcomeLink}</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </Section>
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

/**
 * Frise d'étapes — version mobile simplifiée de
 * `apps/web/src/components/network/IntroductionTimeline.tsx`. Une étape
 * n'est marquée « constatée » QUE si un événement correspondant existe
 * dans `events` (MASTER PROMPT §25, D-55) : rien n'est déduit de la
 * position dans la liste.
 */
function Timeline({ status, events }: { status: IntroductionStatus; events: readonly IntroductionEventRow[] }) {
  const reachedAt = new Map<string, string | null>();
  for (const event of events) {
    const key = event.toStatus ?? event.eventType;
    if (!reachedAt.has(key)) reachedAt.set(key, event.createdAt);
  }

  const currentIndex = INTRODUCTION_TIMELINE.indexOf(status);
  const closedOffPath: readonly IntroductionStatus[] = ['intermediary_declined', 'withdrawn', 'expired', 'no_outcome'];
  const isClosedOffPath = closedOffPath.includes(status);

  return (
    <View style={styles.timeline}>
      {INTRODUCTION_TIMELINE.map((step, index) => {
        const done = reachedAt.has(step);
        const isCurrent = !done && !isClosedOffPath && currentIndex >= 0 && index === currentIndex + 1;
        const stateLabel = done
          ? frRelations.introductions.stepDone
          : isCurrent
            ? frRelations.introductions.stepCurrent
            : frRelations.introductions.stepPending;

        return (
          <View key={step} style={styles.timelineRow}>
            <View style={[styles.timelineDot, done ? styles.timelineDotDone : isCurrent ? styles.timelineDotCurrent : null]} />
            <View style={styles.timelineBody}>
              <Text style={done || isCurrent ? styles.timelineStepDone : styles.timelineStepPending}>
                {INTRODUCTION_STATUS_LABELS[step]}
              </Text>
              <Text style={styles.timelineState}>{stateLabel}</Text>
            </View>
          </View>
        );
      })}
      {isClosedOffPath ? (
        <View style={styles.timelineRow}>
          <View style={styles.timelineDot} />
          <View style={styles.timelineBody}>
            <Text style={styles.timelineStepDone}>{INTRODUCTION_STATUS_LABELS[status]}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subtitle: { ...textStyle.bodySm, color: colors.textSecondary, marginBottom: space[5] },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginBottom: space[5] },
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
    gap: space[1],
  },
  cardRole: { ...textStyle.caption, color: colors.actionBlue, fontWeight: '700' },
  cardPath: { ...textStyle.bodySm, color: colors.textPrimary, fontWeight: '600' },
  cardPurpose: { ...textStyle.caption, color: colors.textSecondary },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceMuted,
    borderRadius: rounded.full,
    paddingHorizontal: space[3],
    paddingVertical: 2,
    marginTop: space[1],
    marginBottom: space[4],
  },
  badgeLabel: { ...textStyle.caption, color: colors.textSecondary, fontWeight: '700' },
  loadMore: { marginTop: space[5], alignItems: 'center' },
  roleLine: { ...textStyle.caption, color: colors.actionBlue, fontWeight: '700', marginBottom: space[1] },
  pathLine: { ...textStyle.body, fontWeight: '700', color: colors.textPrimary, marginBottom: space[2] },
  section: { marginBottom: space[5], gap: space[2] },
  sectionTitle: { ...textStyle.bodySm, fontWeight: '700', color: colors.textPrimary },
  paragraph: { ...textStyle.bodySm, color: colors.textSecondary },
  confusionBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: rounded.lg,
    padding: space[5],
    gap: space[1],
    marginBottom: space[5],
  },
  confusionTitle: { ...textStyle.bodySm, fontWeight: '700', color: colors.textPrimary },
  confusionBody: { ...textStyle.caption, color: colors.textSecondary },
  actionsBox: { gap: space[3] },
  outcomeLinkButton: {
    minHeight: 44,
    borderRadius: rounded.base,
    borderWidth: 1,
    borderColor: colors.actionBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outcomeLinkLabel: { ...textStyle.bodySm, color: colors.actionBlue, fontWeight: '700' },
  noticeTitle: { ...textStyle.h4, fontWeight: '700', color: colors.textPrimary },
  timeline: { gap: space[3] },
  timelineRow: { flexDirection: 'row', gap: space[3], alignItems: 'flex-start' },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: rounded.full,
    borderWidth: 2,
    borderColor: colors.border,
    marginTop: 3,
  },
  timelineDotDone: { backgroundColor: colors.success, borderColor: colors.success },
  timelineDotCurrent: { borderColor: colors.warning },
  timelineBody: { flex: 1, gap: 2 },
  timelineStepDone: { ...textStyle.bodySm, fontWeight: '700', color: colors.textPrimary },
  timelineStepPending: { ...textStyle.bodySm, color: colors.textMuted },
});
