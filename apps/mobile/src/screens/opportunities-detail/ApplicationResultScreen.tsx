import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { frOpportunitiesDetail as t } from '../../i18n/opportunities-detail';
import { newCorrelationId } from '../../lib/correlation';
import {
  OUTCOME_APPLICATION_STATUSES,
  getApplication,
  transitionApplication,
  type ApplicationDetail,
  type ApplicationStatus,
} from '../../lib/queries/opportunities-detail';
import { colors, rounded, space, textStyle } from '../../theme/tokens';
import { Card, CardTitle } from './shared';

type NetworkContributed = 'yes' | 'partial' | 'no';
type ResultKind = 'mission' | 'job' | 'shortlist';

const RESULT_LABELS: Record<ResultKind, string> = {
  mission: t.outcome.resultMission,
  job: t.outcome.resultJob,
  shortlist: t.outcome.resultShortlist,
};

/**
 * ISE-066 — Résultat final d'une candidature (impact).
 *
 * `get_application()` puis `transition_application_status()`, restreint
 * aux 3 issues terminales (`selected` / `not_selected` / `withdrawn`) —
 * mêmes RPC et même restriction que
 * `apps/web/src/app/candidatures/[applicationId]/resultat/page.tsx`
 * (`restrictTo={['selected', 'not_selected', 'withdrawn']}`).
 *
 * `pendingNote` porte le texte composé par ISE-065
 * (`UpdateApplicationScreen`) quand l'utilisateur y a choisi une issue
 * terminale : cet écran le complète avec le résultat obtenu, la
 * contribution du réseau et les remerciements avant le SEUL appel RPC
 * qui enregistre réellement la transition (pas de double écriture).
 *
 * « Résultat obtenu » (Mission/Emploi obtenu, Shortlist finale) et
 * « Membres à remercier » n'ont pas de colonne dédiée dans la RPC : ils
 * sont repliés en texte dans `note`, comme le fait déjà le web pour ce
 * même écran (un seul champ `note` existe côté base, migration 0008).
 */
export function ApplicationResultScreen({
  applicationId,
  pendingNote,
  onBack,
  onDone,
}: {
  applicationId: string;
  pendingNote: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; correlationId: string }
    | { status: 'ready'; application: ApplicationDetail }
  >({ status: 'loading' });

  const [toStatus, setToStatus] = useState<ApplicationStatus | null>(null);
  const [resultKind, setResultKind] = useState<ResultKind>('mission');
  const [contributed, setContributed] = useState<NetworkContributed>('yes');
  const [contribution, setContribution] = useState('');
  const [thanks, setThanks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    getApplication(applicationId)
      .then((result) => {
        if (result.failed || result.data === null) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }
        setState({ status: 'ready', application: result.data });
        const options = result.data.allowedTransitions.filter((status) =>
          (OUTCOME_APPLICATION_STATUSES as readonly ApplicationStatus[]).includes(status),
        );
        setToStatus(options[0] ?? null);
      })
      .catch(() => setState({ status: 'error', correlationId: newCorrelationId() }));
  }, [applicationId]);

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

  const application = state.application;
  const outcomeOptions = application.allowedTransitions.filter((status) =>
    (OUTCOME_APPLICATION_STATUSES as readonly ApplicationStatus[]).includes(status),
  );
  const alreadyTerminal = (OUTCOME_APPLICATION_STATUSES as readonly ApplicationStatus[]).includes(application.status);

  if (alreadyTerminal) {
    return (
      <Screen>
        <Header onBack={onBack} />
        <Card tone={application.status === 'selected' ? 'success' : 'default'}>
          <CardTitle tone={application.status === 'selected' ? 'success' : 'default'}>
            {application.status === 'selected' ? t.outcome.successHeading : t.outcome.failureHeading}
          </CardTitle>
          <Text style={styles.noticeBody}>
            {t.applicationStatusHint[application.status] ?? (t.applicationStatus[application.status] ?? application.status)}
          </Text>
        </Card>
      </Screen>
    );
  }

  if (outcomeOptions.length === 0) {
    return (
      <Screen>
        <Header onBack={onBack} />
        <Card tone="info">
          <Text style={styles.noticeTitle}>{t.update.noTransitionTitle}</Text>
          <Text style={styles.noticeBody}>{t.update.noTransitionBody}</Text>
        </Card>
      </Screen>
    );
  }

  const submit = () => {
    if (toStatus === null) return;
    setSubmitting(true);
    setError(null);
    const note = [
      pendingNote.trim().length > 0 ? pendingNote.trim() : null,
      toStatus === 'selected' ? `${t.outcome.resultLegend} : ${RESULT_LABELS[resultKind]}` : null,
      `${t.outcome.networkContributedLabel} : ${
        contributed === 'yes' ? t.closure.yes : contributed === 'partial' ? t.closure.partial : t.closure.no
      }`,
      contribution.trim().length > 0 ? `${t.outcome.contributionLabel} : ${contribution.trim()}` : null,
      thanks.trim().length > 0 ? `${t.outcome.thanksLabel} : ${thanks.trim()}` : null,
    ]
      .filter((part): part is string => part !== null)
      .join(' · ');

    transitionApplication(applicationId, toStatus, note.length > 0 ? note : null)
      .then((result) => {
        setSubmitting(false);
        if (result.failed) {
          setError(t.common.loadErrorTitle);
          return;
        }
        onDone();
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
          <Text style={styles.title}>{t.outcome.recordPrompt}</Text>
          <Text style={styles.subtitle}>
            {[application.opportunity?.title, application.opportunity?.organization].filter(Boolean).join(' · ')}
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.legend}>{t.outcome.resultLegend}</Text>
          <View style={styles.statusGrid}>
            {outcomeOptions.map((status) => (
              <Pressable
                key={status}
                onPress={() => setToStatus(status)}
                accessibilityRole="button"
                accessibilityState={{ selected: toStatus === status }}
                style={[styles.statusPill, toStatus === status ? styles.statusPillSelected : null]}
              >
                <Text style={[styles.statusPillLabel, toStatus === status ? styles.statusPillLabelSelected : null]}>
                  {t.applicationStatus[status] ?? status}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {toStatus === 'selected' ? (
          <View style={styles.field}>
            <Text style={styles.legend}>{t.outcome.resultLegend}</Text>
            {(Object.keys(RESULT_LABELS) as ResultKind[]).map((key) => (
              <Pressable
                key={key}
                onPress={() => setResultKind(key)}
                accessibilityRole="button"
                style={[styles.resultOption, resultKind === key ? styles.resultOptionSelected : null]}
              >
                <Text style={styles.resultOptionMark}>{resultKind === key ? '✓' : '○'}</Text>
                <Text style={styles.resultOptionLabel}>{RESULT_LABELS[key]}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.legend}>{t.outcome.networkContributedLabel}</Text>
          <View style={styles.pillRow}>
            {(['yes', 'partial', 'no'] as NetworkContributed[]).map((value) => (
              <Pressable
                key={value}
                onPress={() => setContributed(value)}
                accessibilityRole="button"
                style={[styles.smallPill, contributed === value ? styles.smallPillSelected : null]}
              >
                <Text style={[styles.smallPillLabel, contributed === value ? styles.smallPillLabelSelected : null]}>
                  {value === 'yes' ? t.closure.yes : value === 'partial' ? t.closure.partial : t.closure.no}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {contributed !== 'no' ? (
          <View style={styles.field}>
            <Text style={styles.legend}>{t.outcome.contributionLabel}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.outcome.contributionPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={contribution}
              onChangeText={setContribution}
              accessibilityLabel={t.outcome.contributionLabel}
            />
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.legend}>{t.outcome.thanksLabel}</Text>
          <TextInput
            style={styles.input}
            placeholder={t.outcome.thanksPlaceholder}
            placeholderTextColor={colors.textMuted}
            value={thanks}
            onChangeText={setThanks}
            accessibilityLabel={t.outcome.thanksLabel}
          />
        </View>

        <Card tone="info">
          <CardTitle>{t.outcome.impactTitle}</CardTitle>
          <Text style={styles.noticeBody}>{t.outcome.impactBody}</Text>
        </Card>

        {error !== null ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label={t.outcome.submit} loading={submitting} disabled={toStatus === null} onPress={submit} />
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
      <Text style={styles.headerTitle}>{t.outcome.title}</Text>
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
  noticeTitle: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  noticeBody: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
  field: {
    gap: space[2],
  },
  legend: {
    ...textStyle.bodySm,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
  },
  statusPill: {
    minHeight: 44,
    minWidth: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: space[4],
  },
  statusPillSelected: {
    borderColor: colors.success,
    borderWidth: 2,
    backgroundColor: colors.surfaceMuted,
  },
  statusPillLabel: {
    ...textStyle.bodySm,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  statusPillLabelSelected: {
    color: colors.success,
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
    marginBottom: space[2],
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
  pillRow: {
    flexDirection: 'row',
    gap: space[3],
  },
  smallPill: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  smallPillSelected: {
    borderColor: colors.actionBlue,
    borderWidth: 2,
    backgroundColor: colors.surfaceMuted,
  },
  smallPillLabel: {
    ...textStyle.bodySm,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  smallPillLabelSelected: {
    color: colors.actionBlue,
  },
  input: {
    ...textStyle.bodySm,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    paddingHorizontal: space[4],
    color: colors.textPrimary,
    backgroundColor: colors.surface,
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
