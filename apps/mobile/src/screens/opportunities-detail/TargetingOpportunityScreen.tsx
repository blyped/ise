import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { frOpportunitiesDetail as t, toDetail } from '../../i18n/opportunities-detail';
import { newCorrelationId } from '../../lib/correlation';
import {
  getOpportunity,
  loadOpportunityMatches,
  previewOpportunityAudience,
  type AudiencePreview,
  type MatchedProfile,
  type OpportunityDetail,
} from '../../lib/queries/opportunities-detail';
import { colors, rounded, space, textStyle } from '../../theme/tokens';
import { Avatar, Badge, Card, CardTitle, SecondaryButton, initialsOf } from './shared';

/**
 * ISE-058 — Ciblage / matching, étape 2.
 *
 * `preview_opportunity_audience()` + `list_opportunity_matches()` —
 * mêmes RPC que `apps/web/src/app/opportunites/[id]/ciblage/page.tsx`.
 *
 * Contrairement au formulaire web (`TargetingForm`), cet écran ne permet
 * PAS de modifier les critères : le visuel ISE-058 est une VÉRIFICATION
 * en lecture seule (« Vérifiez le matching »), sans aucun champ de
 * saisie. Les « Critères de matching » affichés viennent des critères
 * déjà déclarés à l'étape 1 (compétences, niveau, lieu, mode de
 * travail) — aucune valeur inventée. Un futur écran de MODIFICATION du
 * ciblage (formulaire complet, façon web) resterait à construire dans
 * une tranche ultérieure si le produit le demande.
 */
export function TargetingOpportunityScreen({
  opportunityId,
  onBack,
  onContinue,
}: {
  opportunityId: string;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; correlationId: string }
    | {
        status: 'ready';
        opportunity: OpportunityDetail;
        audience: AudiencePreview;
        matches: readonly MatchedProfile[];
      }
  >({ status: 'loading' });

  const load = useCallback(() => {
    setState({ status: 'loading' });
    Promise.all([
      getOpportunity(opportunityId),
      previewOpportunityAudience(opportunityId),
      loadOpportunityMatches(opportunityId, null),
    ])
      .then(([opportunityResult, audienceResult, matchesResult]) => {
        if (
          opportunityResult.failed ||
          opportunityResult.data === null ||
          audienceResult.failed ||
          audienceResult.data === null ||
          matchesResult.failed ||
          matchesResult.data === null
        ) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }
        setState({
          status: 'ready',
          opportunity: opportunityResult.data,
          audience: audienceResult.data,
          matches: matchesResult.data.rows,
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
        <Text style={styles.headerTitle}>{t.wizard.audienceTitle}</Text>
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
        <>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.subtitle}>{state.opportunity.title}</Text>
            <Text style={styles.heading}>{t.wizard.audienceHeading}</Text>

            <Card tone="success">
              <Text style={styles.totalValue}>
                {toDetail('{count} profils pertinents', { count: state.audience.total })}
              </Text>
              <Text style={styles.totalBreakdown}>
                {toDetail('{very} très pertinents · {relevant} pertinents', {
                  very: state.audience.veryRelevant,
                  relevant: state.audience.relevant,
                })}
              </Text>
              <Text style={styles.totalBreakdown}>
                {toDetail('{count} profils proches', { count: state.audience.closeProfile })}
              </Text>
            </Card>

            <Text style={styles.sectionTitle}>{t.wizard.audienceCriteriaTitle}</Text>

            {state.opportunity.skills.length > 0 ? (
              <CriterionCard
                label="Compétences"
                value={state.opportunity.skills.map((skill) => skill.name).join(' · ')}
                tone={state.opportunity.skills.some((skill) => skill.importance === 'required') ? 'Fort' : 'Moyen'}
              />
            ) : null}

            {state.opportunity.experienceLevel !== null ? (
              <CriterionCard label="Expérience" value={state.opportunity.experienceLevel} tone="Fort" />
            ) : null}

            {state.opportunity.city !== null || state.opportunity.country !== null ? (
              <CriterionCard
                label="Géographie"
                value={[state.opportunity.city, state.opportunity.country].filter(Boolean).join(', ')}
                tone="Moyen"
              />
            ) : null}

            {state.opportunity.remoteMode !== null ? (
              <CriterionCard
                label="Préférences"
                value={t.remoteMode[state.opportunity.remoteMode] ?? state.opportunity.remoteMode}
                tone="Variable"
              />
            ) : null}

            {state.matches.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>{t.wizard.audienceProfilesTitle}</Text>
                {state.matches.slice(0, 5).map((match) => (
                  <MatchRow key={match.profile.profileId} match={match} />
                ))}
              </>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <SecondaryButton label={t.wizard.back} onPress={onBack} />
            <View style={styles.footerPrimary}>
              <Button label={t.wizard.continueToPreview} onPress={onContinue} />
            </View>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function CriterionCard({ label, value, tone }: { label: string; value: string; tone: 'Fort' | 'Moyen' | 'Variable' }) {
  const badgeTone = tone === 'Fort' ? 'success' : tone === 'Moyen' ? 'info' : 'warning';
  return (
    <Card>
      <View style={styles.criterionRow}>
        <View style={styles.criterionText}>
          <CardTitle>{label}</CardTitle>
          <Text style={styles.criterionValue}>{value}</Text>
        </View>
        <Badge label={tone} tone={badgeTone} />
      </View>
    </Card>
  );
}

function MatchRow({ match }: { match: MatchedProfile }) {
  const relevanceLabel =
    match.relevance?.label !== null && match.relevance?.label !== undefined
      ? (t.relevance[match.relevance.label] ?? match.relevance.label)
      : null;
  return (
    <View style={styles.matchRow}>
      <Avatar initials={initialsOf(match.profile.displayName)} />
      <View style={styles.matchText}>
        <Text style={styles.matchName}>{match.profile.displayName}</Text>
        <Text style={styles.matchMeta}>
          {[match.profile.headline, match.profile.currentOrganization].filter(Boolean).join(' · ')}
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
  subtitle: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
  heading: {
    ...textStyle.h2,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  totalValue: {
    ...textStyle.h3,
    fontWeight: '700',
    color: colors.success,
  },
  totalBreakdown: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
  sectionTitle: {
    ...textStyle.h4,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: space[2],
  },
  criterionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  criterionText: {
    flex: 1,
    gap: space[1],
  },
  criterionValue: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.lg,
    padding: space[4],
  },
  matchText: {
    flex: 1,
    gap: space[1],
  },
  matchName: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  matchMeta: {
    ...textStyle.caption,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    gap: space[3],
    paddingTop: space[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerPrimary: {
    flex: 1,
  },
});
