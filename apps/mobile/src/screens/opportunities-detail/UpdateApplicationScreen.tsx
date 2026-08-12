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
import { Card } from './shared';

type NetworkHelped = 'yes' | 'partial' | 'no';

/**
 * ISE-065 — Mettre à jour une candidature.
 *
 * `get_application()` puis `transition_application_status()` — mêmes
 * RPC que `apps/web/src/components/opportunities/ApplicationUpdateForm.tsx`.
 * Les étapes proposées viennent EXCLUSIVEMENT de `allowedTransitions`
 * (calculé en base) : l'écran ne propose jamais une étape que la base
 * refuserait, et n'en cache aucune qu'elle accepterait (D-55).
 *
 * Le visuel ajoute des champs sans colonne dédiée dans la RPC
 * (« Prochaine échéance », « Prochaine action », « Le réseau a-t-il
 * aidé ? », « Type d'aide ») : ils sont repliés, en texte lisible, dans
 * le paramètre `note` déjà prévu par `transition_application_status`.
 *
 * Quand l'étape choisie est une ISSUE FINALE (retenue / non retenue /
 * retirée), cet écran n'appelle PAS la transition lui-même : il transmet
 * le texte composé à ISE-066 (`onGoToOutcome`), qui est le SEUL écran à
 * finaliser ce type de transition — évite un double appel RPC et garde
 * la richesse du formulaire de résultat pour ces trois issues.
 */
export function UpdateApplicationScreen({
  applicationId,
  onBack,
  onDone,
  onGoToOutcome,
}: {
  applicationId: string;
  onBack: () => void;
  onDone: () => void;
  onGoToOutcome: (applicationId: string, pendingNote: string) => void;
}) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; correlationId: string }
    | { status: 'ready'; application: ApplicationDetail }
  >({ status: 'loading' });

  const [toStatus, setToStatus] = useState<ApplicationStatus | null>(null);
  const [nextDeadline, setNextDeadline] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [networkHelped, setNetworkHelped] = useState<NetworkHelped>('no');
  const [helpType, setHelpType] = useState('');
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
        setToStatus(result.data.allowedTransitions[0] ?? null);
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

  if (application.allowedTransitions.length === 0) {
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

  const composeNote = () =>
    [
      nextDeadline.trim().length > 0 ? `Prochaine échéance : ${nextDeadline.trim()}` : null,
      nextAction.trim().length > 0 ? `Prochaine action : ${nextAction.trim()}` : null,
      networkHelped !== 'no'
        ? `Réseau : ${networkHelped === 'yes' ? 'Oui' : 'Partiellement'}${helpType.trim().length > 0 ? ` (${helpType.trim()})` : ''}`
        : null,
    ]
      .filter((part): part is string => part !== null)
      .join(' · ');

  const submit = () => {
    if (toStatus === null) return;
    const note = composeNote();

    if ((OUTCOME_APPLICATION_STATUSES as readonly ApplicationStatus[]).includes(toStatus)) {
      onGoToOutcome(applicationId, note);
      return;
    }

    setSubmitting(true);
    setError(null);
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

  const isOutcomeChoice =
    toStatus !== null && (OUTCOME_APPLICATION_STATUSES as readonly ApplicationStatus[]).includes(toStatus);

  return (
    <Screen>
      <Header onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{t.update.heading}</Text>
          <Text style={styles.subtitle}>
            {[application.opportunity?.title, application.opportunity?.organization].filter(Boolean).join(' · ')}
          </Text>
        </View>

        {application.isSelfDeclared ? (
          <Card tone="warning">
            <Text style={styles.noticeTitle}>{t.update.declarationTitle}</Text>
            <Text style={styles.noticeBody}>{t.update.declarationBody}</Text>
          </Card>
        ) : null}

        <View style={styles.statusGrid}>
          {application.allowedTransitions.map((status) => (
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

        <View style={styles.field}>
          <Text style={styles.legend}>{t.update.nextDeadlineLabel}</Text>
          <TextInput
            style={styles.input}
            placeholder="AAAA-MM-JJ"
            placeholderTextColor={colors.textMuted}
            value={nextDeadline}
            onChangeText={setNextDeadline}
            accessibilityLabel={t.update.nextDeadlineLabel}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.legend}>{t.update.nextActionLabel}</Text>
          <TextInput
            style={styles.input}
            placeholder={t.update.nextActionPlaceholder}
            placeholderTextColor={colors.textMuted}
            value={nextAction}
            onChangeText={setNextAction}
            accessibilityLabel={t.update.nextActionLabel}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.legend}>{t.update.networkHelpedLabel}</Text>
          <View style={styles.pillRow}>
            {(['yes', 'partial', 'no'] as NetworkHelped[]).map((value) => (
              <Pressable
                key={value}
                onPress={() => setNetworkHelped(value)}
                accessibilityRole="button"
                style={[styles.smallPill, networkHelped === value ? styles.smallPillSelected : null]}
              >
                <Text style={[styles.smallPillLabel, networkHelped === value ? styles.smallPillLabelSelected : null]}>
                  {value === 'yes' ? t.closure.yes : value === 'partial' ? t.closure.partial : t.closure.no}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {networkHelped !== 'no' ? (
          <View style={styles.field}>
            <Text style={styles.legend}>{t.update.helpTypeLabel}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.update.helpTypePlaceholder}
              placeholderTextColor={colors.textMuted}
              value={helpType}
              onChangeText={setHelpType}
              accessibilityLabel={t.update.helpTypeLabel}
            />
          </View>
        ) : null}

        {isOutcomeChoice ? (
          <Card tone="success">
            <Text style={styles.noticeTitle}>{t.update.nextStepTitle}</Text>
            <Text style={styles.noticeBody}>{t.update.nextStepBody}</Text>
          </Card>
        ) : null}

        {error !== null ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label={t.update.submit} loading={submitting} disabled={toStatus === null} onPress={submit} />
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
      <Text style={styles.headerTitle}>{t.update.title}</Text>
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
    borderColor: colors.purple,
    borderWidth: 2,
    backgroundColor: colors.surfaceMuted,
  },
  statusPillLabel: {
    ...textStyle.bodySm,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  statusPillLabelSelected: {
    color: colors.purple,
  },
  field: {
    gap: space[2],
  },
  legend: {
    ...textStyle.bodySm,
    color: colors.textPrimary,
    fontWeight: '600',
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
