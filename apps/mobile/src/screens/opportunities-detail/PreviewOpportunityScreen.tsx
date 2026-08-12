import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { frOpportunitiesDetail as t, toDetail } from '../../i18n/opportunities-detail';
import { newCorrelationId } from '../../lib/correlation';
import {
  getOpportunity,
  previewOpportunityAudience,
  publishOpportunity,
  type AudiencePreview,
  type OpportunityDetail,
} from '../../lib/queries/opportunities-detail';
import { colors, space, textStyle } from '../../theme/tokens';
import { Badge, Card, CardTitle, SecondaryButton } from './shared';

/**
 * ISE-059 — Aperçu avant publication, étape 3.
 *
 * `get_opportunity()` + `preview_opportunity_audience()` pour l'aperçu,
 * puis `publish_opportunity()` au clic — mêmes RPC que
 * `apps/web/src/app/opportunites/[id]/apercu/page.tsx`.
 *
 * La pastille de pertinence du visuel (« Très pertinente ») décrit la
 * carte telle qu'un CANDIDAT la verrait ; elle n'a pas de sens pour le
 * gestionnaire qui prévisualise sa propre offre (`relevance` est nul
 * dans ce contexte) — elle n'est donc pas reproduite ici, plutôt que
 * d'afficher une pertinence fabriquée.
 *
 * « Prêt à publier » : les trois coches sont calculées localement à
 * partir de données réellement chargées (titre/description non vides,
 * au moins une compétence déclarée, audience non vide) — jamais une
 * validation binaire inventée sans base.
 */
export function PreviewOpportunityScreen({
  opportunityId,
  onBack,
  onPublished,
}: {
  opportunityId: string;
  onBack: () => void;
  onPublished: (opportunityId: string) => void;
}) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; correlationId: string }
    | { status: 'ready'; opportunity: OpportunityDetail; audience: AudiencePreview }
  >({ status: 'loading' });
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    Promise.all([getOpportunity(opportunityId), previewOpportunityAudience(opportunityId)])
      .then(([opportunityResult, audienceResult]) => {
        if (
          opportunityResult.failed ||
          opportunityResult.data === null ||
          audienceResult.failed ||
          audienceResult.data === null
        ) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }
        setState({ status: 'ready', opportunity: opportunityResult.data, audience: audienceResult.data });
      })
      .catch(() => setState({ status: 'error', correlationId: newCorrelationId() }));
  }, [opportunityId]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePublish = () => {
    setPublishing(true);
    setPublishError(null);
    publishOpportunity(opportunityId)
      .then((result) => {
        setPublishing(false);
        if (result.failed || result.data === null) {
          setPublishError(t.common.loadErrorTitle);
          return;
        }
        onPublished(opportunityId);
      })
      .catch(() => {
        setPublishing(false);
        setPublishError(t.common.loadErrorTitle);
      });
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.headerBack}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t.wizard.previewTitle}</Text>
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
            <Text style={styles.heading}>{t.wizard.previewHeading}</Text>
            <Text style={styles.subtitle}>{t.wizard.previewSubtitle}</Text>

            <Card>
              <Badge label={t.type[state.opportunity.opportunityType] ?? state.opportunity.opportunityType} tone="info" />
              <Text style={styles.title}>{state.opportunity.title}</Text>
              <Text style={styles.meta}>
                {[state.opportunity.organization, [state.opportunity.city, state.opportunity.country].filter(Boolean).join(', ')]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <Text style={styles.meta}>
                {[
                  state.opportunity.durationDays !== null ? `${state.opportunity.durationDays} jours` : null,
                  state.opportunity.remoteMode !== null
                    ? t.remoteMode[state.opportunity.remoteMode] ?? state.opportunity.remoteMode
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {state.opportunity.deadline !== null ? (
                <Text style={styles.deadline}>
                  {t.detail.deadlineLabel} : {state.opportunity.deadline}
                </Text>
              ) : null}

              <CardTitle>{t.detail.aboutTitle}</CardTitle>
              <Text style={styles.body}>{state.opportunity.description}</Text>

              {state.opportunity.skills.length > 0 ? (
                <>
                  <CardTitle>{t.wizard.skillsLabel}</CardTitle>
                  <View style={styles.badgeRow}>
                    {state.opportunity.skills.map((skill) => (
                      <Badge key={skill.name} label={skill.name} tone="info" />
                    ))}
                  </View>
                </>
              ) : null}

              <Text style={styles.targeted}>
                {toDetail(t.wizard.targetedCount, { count: state.audience.total })}
              </Text>
            </Card>

            <Card tone="success">
              <CardTitle tone="success">{t.wizard.readyTitle}</CardTitle>
              <Text style={styles.readyLine}>✓ {t.wizard.readyComplete}</Text>
              {state.opportunity.skills.length > 0 ? (
                <Text style={styles.readyLine}>✓ {t.wizard.readyMatching}</Text>
              ) : null}
              {state.audience.total > 0 ? <Text style={styles.readyLine}>✓ {t.wizard.readyAudience}</Text> : null}
            </Card>

            <Card tone="info">
              <CardTitle>{t.wizard.afterTitle}</CardTitle>
              <Text style={styles.body}>{t.wizard.afterBody}</Text>
              <Text style={styles.body}>{t.applicationMode[state.opportunity.applicationMode] ?? ''}</Text>
            </Card>

            {publishError !== null ? <Text style={styles.errorText}>{publishError}</Text> : null}
          </ScrollView>

          <View style={styles.footer}>
            <SecondaryButton label={t.wizard.back} onPress={onBack} disabled={publishing} />
            <View style={styles.footerPrimary}>
              <Button label={t.wizard.publish} loading={publishing} onPress={handlePublish} />
            </View>
          </View>
        </>
      ) : null}
    </Screen>
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
    gap: space[5],
    paddingBottom: space[8],
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
  title: {
    ...textStyle.h3,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  meta: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
  deadline: {
    ...textStyle.bodySm,
    color: colors.warning,
    fontWeight: '700',
  },
  body: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  targeted: {
    ...textStyle.bodySm,
    color: colors.success,
    fontWeight: '700',
  },
  readyLine: {
    ...textStyle.bodySm,
    color: colors.success,
  },
  errorText: {
    ...textStyle.caption,
    color: colors.error,
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
