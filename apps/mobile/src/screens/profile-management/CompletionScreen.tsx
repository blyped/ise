import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '../../components/Screen';
import { profileManagement as pm } from '../../i18n/profile-management';
import {
  loadCompletionRules,
  loadMyCompletionScore,
  loadMyMissingItems,
  missingItemImpact,
  type CompletionRule,
  type MissingItem,
} from '../../lib/queries/profile-management';
import type { ProfileManagementStackParamList } from '../../navigation/ProfileManagementStack';
import { colors, rounded, space, textStyle } from '../../theme/tokens';
import { Badge, Card, ErrorBanner, Hint, LoadingView, PrimaryButton, routeForBlockKey } from './_shared';

type Props = NativeStackScreenProps<ProfileManagementStackParamList, 'Completion'>;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'ready'; score: number | null; rules: CompletionRule[]; missing: MissingItem[] };

const IMPACT_TONE: Record<'fort' | 'moyen' | 'utile', 'success' | 'warning' | 'neutral'> = {
  fort: 'success',
  moyen: 'warning',
  utile: 'neutral',
};

/**
 * ISE-030 — Complétion du profil.
 *
 * D-72 : le score n'est lu QUE via `my_profile_completion` et n'est jamais
 * transmis ni comparé à un tiers — cet écran est strictement personnel,
 * jamais atteignable depuis le profil d'un autre membre.
 */
export function CompletionScreen({ navigation }: Props) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(() => {
    setState({ status: 'loading' });
    Promise.all([loadMyCompletionScore(), loadCompletionRules(), loadMyMissingItems()]).then(
      ([score, rules, missing]) => {
        if (!score.ok) {
          setState({ status: 'error', correlationId: score.correlationId });
          return;
        }
        setState({
          status: 'ready',
          score: score.data,
          rules: rules.ok ? rules.data : [],
          missing: missing.ok ? missing.data : [],
        });
      },
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === 'loading') return <Screen><LoadingView /></Screen>;
  if (state.status === 'error') {
    return (
      <Screen>
        <ErrorBanner title={pm.completion.errorTitle} correlationId={state.correlationId} onRetry={load} />
      </Screen>
    );
  }

  const missingByBlock = new Map(state.missing.map((item) => [item.blockKey, item]));
  const priorities = [...state.missing].sort((a, b) => b.weight - a.weight).slice(0, 3);
  const score = state.score ?? 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>{pm.completion.heading}</Text>
        <Text style={styles.subtitle}>{pm.completion.subtitle}</Text>

        <View style={styles.scoreCard}>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreValue}>
              {state.score !== null ? `${state.score}%` : '—'}
              <Text style={styles.scoreCaption}> {pm.completion.completedLabel}</Text>
            </Text>
            <Text style={styles.privateLabel}>{pm.completion.privateLabel}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, score))}%` }]} />
          </View>
        </View>

        {priorities.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>{pm.completion.prioritiesTitle}</Text>
            {priorities.map((item, index) => (
              <Card key={item.blockKey}>
                <View style={styles.priorityRow}>
                  <View style={styles.priorityNumber}>
                    <Text style={styles.priorityNumberLabel}>{index + 1}</Text>
                  </View>
                  <View style={styles.priorityText}>
                    <Text style={styles.priorityLabel}>{item.label}</Text>
                    <Text style={styles.impactLabel}>{pm.missingItems.impact[missingItemImpact(item.weight)]}</Text>
                  </View>
                  <PrimaryButton label={pm.completion.doAction} onPress={() => navigation.navigate(routeForBlockKey(item.blockKey))} />
                </View>
              </Card>
            ))}
          </>
        ) : null}

        <Text style={styles.sectionLabel}>{pm.completion.sectionsTitle}</Text>
        {state.rules.map((rule) => {
          const missing = missingByBlock.get(rule.blockKey);
          return (
            <Card key={rule.blockKey}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionRowLabel}>{rule.label}</Text>
                {missing ? (
                  <Badge label={pm.missingItems.impact[missingItemImpact(missing.weight)]} tone={IMPACT_TONE[missingItemImpact(missing.weight)]} />
                ) : (
                  <Badge label="Complet" tone="success" />
                )}
              </View>
            </Card>
          );
        })}

        <Hint tone="success">{pm.completion.footerNote}</Hint>

        <Text style={styles.link} onPress={() => navigation.navigate('MissingItems')}>
          {pm.completion.missingLink}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: space[4],
    paddingBottom: space[8],
  },
  heading: {
    ...textStyle.h2,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    ...textStyle.body,
    color: colors.textSecondary,
    marginTop: -space[3],
  },
  scoreCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.lg,
    padding: space[5],
    gap: space[3],
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  scoreValue: {
    ...textStyle.h1,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  scoreCaption: {
    ...textStyle.bodySm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  privateLabel: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
  progressTrack: {
    height: 8,
    borderRadius: rounded.full,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.actionBlue,
    borderRadius: rounded.full,
  },
  sectionLabel: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: space[2],
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
  },
  priorityNumber: {
    width: 28,
    height: 28,
    borderRadius: rounded.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityNumberLabel: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  priorityText: {
    flex: 1,
    gap: space[1],
  },
  priorityLabel: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  impactLabel: {
    ...textStyle.caption,
    color: colors.success,
    fontWeight: '600',
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionRowLabel: {
    ...textStyle.bodySm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  link: {
    ...textStyle.bodySm,
    color: colors.actionBlue,
    fontWeight: '600',
    textAlign: 'center',
  },
});
