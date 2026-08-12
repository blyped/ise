import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { frOpportunitiesDetail as t } from '../../i18n/opportunities-detail';
import { newCorrelationId } from '../../lib/correlation';
import {
  closeOpportunity,
  getOpportunity,
  loadOpportunityCandidates,
  type CandidateOption,
  type OpportunityDetail,
} from '../../lib/queries/opportunities-detail';
import { colors, rounded, space, textStyle } from '../../theme/tokens';
import { SelectablePill } from './shared';

type Reason = 'fulfilled' | 'expired' | 'cancelled' | 'other';
type Contribution = 'yes' | 'partial' | 'no';
type FacilitatedResult = 'candidate' | 'introduction' | 'recommendation';

const FACILITATED_RESULT_LABELS: Record<FacilitatedResult, string> = {
  candidate: t.closure.resultCandidate,
  introduction: t.closure.resultIntroduction,
  recommendation: t.closure.resultRecommendation,
};

/**
 * ISE-061 — Fermer l'opportunité et enregistrer l'impact.
 *
 * `list_opportunity_candidates()` puis `close_opportunity()` — mêmes RPC
 * que `apps/web/src/components/opportunities/OpportunityClosureForm.tsx`
 * (`closeOpportunityAction`). Comme sur le web, les bénéficiaires ne sont
 * proposables QUE parmi les candidats réels (SA-022) : `facilitated` et
 * `attributionLevel` ne sont envoyés significatifs que pour un résultat
 * de type recrutement, sinon `hiresCount: 0` et
 * `attributionLevel: 'unknown'` — jamais de faux impact hors recrutement
 * (contrainte base `opportunity_outcomes_no_false_impact`, 0008).
 *
 * Le radio « Résultat facilité » du visuel (Candidat identifié /
 * Introduction / Recommandation) n'a pas de colonne dédiée dans
 * `close_opportunity()` : il est replié dans `notes`, en tête du
 * commentaire libre, plutôt qu'inventé comme un champ structuré que la
 * base ne connaît pas.
 */
export function CloseOpportunityScreen({
  opportunityId,
  onBack,
  onDone,
}: {
  opportunityId: string;
  onBack: () => void;
  onDone: (opportunityId: string) => void;
}) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; correlationId: string }
    | { status: 'ready'; opportunity: OpportunityDetail; candidates: readonly CandidateOption[] }
  >({ status: 'loading' });

  const [reason, setReason] = useState<Reason>('fulfilled');
  const [contribution, setContribution] = useState<Contribution>('yes');
  const [facilitatedResult, setFacilitatedResult] = useState<FacilitatedResult>('candidate');
  const [selectedBeneficiaries, setSelectedBeneficiaries] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    Promise.all([getOpportunity(opportunityId), loadOpportunityCandidates(opportunityId)])
      .then(([opportunityResult, candidatesResult]) => {
        if (opportunityResult.failed || opportunityResult.data === null || candidatesResult.failed || candidatesResult.data === null) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }
        setState({ status: 'ready', opportunity: opportunityResult.data, candidates: candidatesResult.data });
      })
      .catch(() => setState({ status: 'error', correlationId: newCorrelationId() }));
  }, [opportunityId]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === 'loading') {
    return (
      <Screen>
        <Header onBack={onBack} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.actionBlue} />
        </View>
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen>
        <Header onBack={onBack} />
        <ErrorState title={t.common.loadErrorTitle} correlationId={state.correlationId} onRetry={load} />
      </Screen>
    );
  }

  const hiring = reason === 'fulfilled';

  const toggleBeneficiary = (profileId: string) => {
    setSelectedBeneficiaries((prev) =>
      prev.includes(profileId) ? prev.filter((id) => id !== profileId) : [...prev, profileId],
    );
  };

  const submit = () => {
    setSubmitting(true);
    setError(null);
    const outcomeType = !hiring
      ? reason === 'expired'
        ? 'no_selection'
        : reason === 'cancelled'
          ? 'cancelled'
          : 'other'
      : selectedBeneficiaries.length > 1
        ? 'multiple_selected'
        : state.opportunity.opportunityType === 'mission'
          ? 'mission_awarded'
          : state.opportunity.opportunityType === 'internship'
            ? 'intern_selected'
            : 'ise_hired';
    const facilitated = hiring && contribution !== 'no';
    const attributionLevel = facilitated ? (contribution === 'yes' ? 'direct' : 'partial') : 'unknown';
    const notesParts = [
      hiring ? `${t.closure.resultTitle} : ${FACILITATED_RESULT_LABELS[facilitatedResult]}` : null,
      comment.trim().length > 0 ? comment.trim() : null,
    ].filter((part): part is string => part !== null);

    closeOpportunity({
      opportunityId,
      outcomeType,
      hiresCount: hiring ? Math.max(selectedBeneficiaries.length, 1) : 0,
      facilitated,
      attributionLevel,
      notes: notesParts.length > 0 ? notesParts.join(' — ') : null,
      beneficiaryIds: hiring ? selectedBeneficiaries : [],
    })
      .then((result) => {
        setSubmitting(false);
        if (result.failed) {
          setError(t.common.loadErrorTitle);
          return;
        }
        onDone(opportunityId);
      })
      .catch(() => {
        setSubmitting(false);
        setError(t.common.loadErrorTitle);
      });
  };

  return (
    <Screen>
      <Header onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{t.closure.reasonLegend}</Text>
          <Text style={styles.subtitle}>
            {[state.opportunity.title, state.opportunity.organization].filter(Boolean).join(' · ')}
          </Text>
        </View>

        <View style={styles.pillGrid}>
          <SelectablePill label={t.closure.reasonFulfilled} selected={reason === 'fulfilled'} onPress={() => setReason('fulfilled')} fullWidth />
          <SelectablePill label={t.closure.reasonExpired} selected={reason === 'expired'} onPress={() => setReason('expired')} fullWidth />
        </View>
        <View style={styles.pillGrid}>
          <SelectablePill label={t.closure.reasonCancelled} selected={reason === 'cancelled'} onPress={() => setReason('cancelled')} fullWidth />
          <SelectablePill label={t.closure.reasonOther} selected={reason === 'other'} onPress={() => setReason('other')} fullWidth />
        </View>

        <View style={styles.field}>
          <Text style={styles.legend}>{t.closure.facilitatedLabel}</Text>
          <View style={styles.pillRow}>
            <SelectablePill label={t.closure.yes} selected={contribution === 'yes'} onPress={() => setContribution('yes')} fullWidth />
            <SelectablePill label={t.closure.partial} selected={contribution === 'partial'} onPress={() => setContribution('partial')} fullWidth />
            <SelectablePill label={t.closure.no} selected={contribution === 'no'} onPress={() => setContribution('no')} fullWidth />
          </View>
        </View>

        {hiring ? (
          <>
            <View style={styles.field}>
              <Text style={styles.legend}>{t.closure.resultTitle}</Text>
              {(Object.keys(FACILITATED_RESULT_LABELS) as FacilitatedResult[]).map((key) => (
                <Pressable
                  key={key}
                  onPress={() => setFacilitatedResult(key)}
                  accessibilityRole="button"
                  style={[styles.resultOption, facilitatedResult === key ? styles.resultOptionSelected : null]}
                >
                  <Text style={styles.resultOptionMark}>{facilitatedResult === key ? '✓' : '○'}</Text>
                  <Text style={styles.resultOptionLabel}>{FACILITATED_RESULT_LABELS[key]}</Text>
                </Pressable>
              ))}
            </View>

            {state.candidates.length > 0 ? (
              <View style={styles.field}>
                <Text style={styles.legend}>{t.closure.beneficiaryLabel}</Text>
                {state.candidates.map((candidate) => {
                  const selected = selectedBeneficiaries.includes(candidate.profileId);
                  return (
                    <Pressable
                      key={candidate.profileId}
                      onPress={() => toggleBeneficiary(candidate.profileId)}
                      accessibilityRole="button"
                      style={[styles.beneficiaryRow, selected ? styles.beneficiaryRowSelected : null]}
                    >
                      <Text style={styles.beneficiaryName}>
                        {candidate.profile?.displayName ?? candidate.profileId}
                      </Text>
                      {selected ? <Text style={styles.beneficiaryRemove}>×</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.legend}>{t.closure.commentLabel}</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={3}
            placeholder={t.closure.commentPlaceholder}
            placeholderTextColor={colors.textMuted}
            value={comment}
            onChangeText={setComment}
            accessibilityLabel={t.closure.commentLabel}
          />
        </View>

        {error !== null ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label={t.closure.submit} loading={submitting} onPress={submit} />
      </View>
    </Screen>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8}>
        <Text style={styles.headerBack}>‹</Text>
      </Pressable>
      <Text style={styles.headerTitle}>{t.closure.title}</Text>
      <View style={styles.headerSpacer} />
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
    gap: space[5],
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
  pillGrid: {
    flexDirection: 'row',
    gap: space[3],
  },
  field: {
    gap: space[2],
  },
  legend: {
    ...textStyle.bodySm,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  pillRow: {
    flexDirection: 'row',
    gap: space[3],
  },
  resultOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    padding: space[4],
    backgroundColor: colors.surface,
  },
  resultOptionSelected: {
    borderColor: colors.success,
    backgroundColor: '#EAF7EF',
  },
  resultOptionMark: {
    ...textStyle.body,
    color: colors.success,
    width: 20,
  },
  resultOptionLabel: {
    ...textStyle.bodySm,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  beneficiaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    paddingHorizontal: space[4],
    backgroundColor: colors.surface,
  },
  beneficiaryRowSelected: {
    borderColor: colors.actionBlue,
    backgroundColor: colors.surfaceMuted,
  },
  beneficiaryName: {
    ...textStyle.bodySm,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  beneficiaryRemove: {
    ...textStyle.h4,
    color: colors.textMuted,
  },
  textArea: {
    ...textStyle.bodySm,
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    padding: space[4],
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    textAlignVertical: 'top',
  },
  errorText: {
    ...textStyle.caption,
    color: colors.error,
  },
  footer: {
    paddingTop: space[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
