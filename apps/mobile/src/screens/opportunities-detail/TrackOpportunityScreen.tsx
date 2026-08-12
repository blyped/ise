import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { frOpportunitiesDetail as t, toDetail } from '../../i18n/opportunities-detail';
import { newCorrelationId } from '../../lib/correlation';
import {
  getOpportunity,
  loadOpportunityApplications,
  type OpportunityDetail,
  type ReceivedApplication,
} from '../../lib/queries/opportunities-detail';
import { colors, rounded, space, textStyle } from '../../theme/tokens';
import { Avatar, Badge, Card, daysUntil, initialsOf } from './shared';

/**
 * ISE-060 — Suivi de l'opportunité.
 *
 * `get_opportunity()` + `list_opportunity_applications()` — mêmes RPC
 * que `apps/web/src/app/opportunites/[id]/suivi/page.tsx`.
 *
 * Le visuel ISE-060 affiche 4 vignettes (« Vues utiles », « Enregistré »,
 * « Clics », « Intéressés »). Le web (`frOpportunities.tracking`) est
 * explicite sur ce point : « Aucune mesure de vanité — ni vues, ni
 * clics : seules les candidatures réelles et le ciblage effectif sont
 * comptés. » Aucune RPC de cette tranche ne fournit de « vues utiles »
 * ni de compteur de clics agrégé par offre. Plutôt que d'inventer ces
 * deux chiffres, cet écran affiche les 3 mesures RÉELLES que la base
 * calcule : candidatures reçues, profils ciblés, profils fortement
 * correspondants (mêmes champs que `OpportunitySummary`).
 *
 * La carte « Opportunité pourvue ? Pensez à la fermer » est pressable et
 * ouvre ISE-061 : c'est le seul chemin de fermeture proposé ici, plutôt
 * que d'ajouter un bouton « Fermer » redondant sans le libellé du visuel.
 */
export function TrackOpportunityScreen({
  opportunityId,
  onBack,
  onClose,
}: {
  opportunityId: string;
  onBack: () => void;
  onClose: (opportunityId: string) => void;
}) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; correlationId: string }
    | { status: 'ready'; opportunity: OpportunityDetail; applications: readonly ReceivedApplication[] }
  >({ status: 'loading' });

  const load = useCallback(() => {
    setState({ status: 'loading' });
    Promise.all([getOpportunity(opportunityId), loadOpportunityApplications(opportunityId, null, null)])
      .then(([opportunityResult, applicationsResult]) => {
        if (
          opportunityResult.failed ||
          opportunityResult.data === null ||
          applicationsResult.failed ||
          applicationsResult.data === null
        ) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }
        setState({
          status: 'ready',
          opportunity: opportunityResult.data,
          applications: applicationsResult.data.rows,
        });
      })
      .catch(() => setState({ status: 'error', correlationId: newCorrelationId() }));
  }, [opportunityId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.headerBack}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t.tracking.title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {state.status === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.actionBlue} />
        </View>
      ) : null}

      {state.status === 'error' ? (
        <ErrorState title={t.common.loadErrorTitle} correlationId={state.correlationId} onRetry={load} />
      ) : null}

      {state.status === 'ready' ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{state.opportunity.title}</Text>
            <Text style={styles.subtitle}>
              {[state.opportunity.organization, state.opportunity.city].filter(Boolean).join(' · ')}
            </Text>
            <View style={styles.statusRow}>
              <Badge
                label={
                  state.opportunity.status === 'active'
                    ? t.tracking.open
                    : state.opportunity.status === 'paused'
                      ? t.tracking.paused
                      : t.tracking.closed
                }
                tone={state.opportunity.status === 'active' ? 'success' : 'neutral'}
              />
              {state.opportunity.publishedAt !== null ? (
                <Text style={styles.publishedInfo}>
                  {toDetail(t.tracking.publishedInfo, {
                    days: Math.max(0, -(daysUntil(state.opportunity.publishedAt) ?? 0)),
                    count: state.opportunity.targetedCount ?? 0,
                  })}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.statsGrid}>
            <StatTile value={state.opportunity.applicationCount ?? 0} label={t.tracking.applications} />
            <StatTile value={state.opportunity.targetedCount ?? 0} label={t.tracking.targeted} />
            <StatTile value={state.opportunity.strongMatchCount ?? 0} label={t.tracking.strongMatches} />
          </View>

          {state.opportunity.status === 'active' ? (
            <Pressable onPress={() => onClose(opportunityId)} accessibilityRole="button">
              <Card tone="warning">
                <Text style={styles.fulfilledNotice}>{t.tracking.fulfilledNotice}</Text>
              </Card>
            </Pressable>
          ) : null}

          <Text style={styles.sectionTitle}>{t.tracking.interestedTitle}</Text>

          {state.applications.length === 0 ? (
            <Card>
              <Text style={styles.emptyText}>{t.tracking.emptyTitle}</Text>
            </Card>
          ) : (
            state.applications.map((application) => (
              <ApplicationRow key={application.applicationId} application={application} />
            ))
          )}
        </ScrollView>
      ) : null}
    </Screen>
  );
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ApplicationRow({ application }: { application: ReceivedApplication }) {
  const relevanceLabel =
    application.relevance?.label !== null && application.relevance?.label !== undefined
      ? (t.relevance[application.relevance.label] ?? application.relevance.label)
      : null;
  const displayName = application.applicant?.displayName ?? '—';
  return (
    <View style={styles.applicationRow}>
      <Avatar initials={initialsOf(displayName)} />
      <View style={styles.applicationText}>
        <Text style={styles.applicationName}>{displayName}</Text>
        <Text style={styles.applicationMeta}>
          {[application.applicant?.headline, application.applicant?.currentOrganization].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {relevanceLabel !== null ? <Badge label={relevanceLabel} tone="success" /> : null}
    </View>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    gap: space[4],
    paddingBottom: space[8],
  },
  titleBlock: {
    gap: space[1],
  },
  title: {
    ...textStyle.h2,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    marginTop: space[2],
  },
  publishedInfo: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: space[3],
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.lg,
    padding: space[4],
    gap: space[1],
  },
  statValue: {
    ...textStyle.h3,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statLabel: {
    ...textStyle.caption,
    color: colors.textSecondary,
  },
  fulfilledNotice: {
    ...textStyle.bodySm,
    color: colors.warning,
    fontWeight: '700',
  },
  sectionTitle: {
    ...textStyle.h4,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyText: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
  applicationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.lg,
    padding: space[4],
  },
  applicationText: {
    flex: 1,
    gap: space[1],
  },
  applicationName: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  applicationMeta: {
    ...textStyle.caption,
    color: colors.textSecondary,
  },
});
