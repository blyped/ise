import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { frOpportunitiesDetail as t } from '../../i18n/opportunities-detail';
import { newCorrelationId } from '../../lib/correlation';
import { getApplication, type ApplicationDetail } from '../../lib/queries/opportunities-detail';
import { colors, rounded, space, textStyle } from '../../theme/tokens';
import { Badge, Card, CardTitle, formatDate } from './shared';

/**
 * ISE-064 — Détail d'une candidature.
 *
 * `get_application()` — même RPC que
 * `apps/web/src/app/candidatures/[applicationId]/page.tsx`.
 *
 * La carte « Le réseau peut vous aider » du visuel (avec avatars et lien
 * « Demander de l'aide ») n'est PAS reproduite : aucune RPC mandatée pour
 * cette tranche ne fournit « qui, dans mon réseau, peut relire ce
 * dossier ». Le bouton « Ajouter la pièce » du visuel suppose un envoi de
 * fichier, hors périmètre RPC de cette tranche (pas de fonction d'upload
 * de document mandatée) : l'écran propose à la place la mise à jour du
 * statut, qui couvre ISE-065 et ISE-066.
 */
export function ApplicationDetailScreen({
  applicationId,
  onBack,
  onUpdate,
  onOutcome,
}: {
  applicationId: string;
  onBack: () => void;
  onUpdate: (applicationId: string) => void;
  onOutcome: (applicationId: string) => void;
}) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; correlationId: string }
    | { status: 'ready'; application: ApplicationDetail }
  >({ status: 'loading' });

  const load = useCallback(() => {
    setState({ status: 'loading' });
    getApplication(applicationId)
      .then((result) => {
        if (result.failed || result.data === null) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }
        setState({ status: 'ready', application: result.data });
      })
      .catch(() => setState({ status: 'error', correlationId: newCorrelationId() }));
  }, [applicationId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.headerBack}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t.application.title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {state.status === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.actionBlue} />
        </View>
      ) : null}

      {state.status === 'error' ? (
        <ErrorState title={t.application.notFoundTitle} correlationId={state.correlationId} onRetry={load} />
      ) : null}

      {state.status === 'ready' ? (
        <ApplicationBody
          application={state.application}
          onUpdate={() => onUpdate(applicationId)}
          onOutcome={() => onOutcome(applicationId)}
        />
      ) : null}
    </Screen>
  );
}

function ApplicationBody({
  application,
  onUpdate,
  onOutcome,
}: {
  application: ApplicationDetail;
  onUpdate: () => void;
  onOutcome: () => void;
}) {
  const opportunity = application.opportunity;
  const location = [opportunity?.organization, opportunity?.city].filter(Boolean).join(' · ');
  const canFinalize = application.status === 'draft';
  const isTerminal = application.status === 'selected' || application.status === 'not_selected' || application.status === 'withdrawn';

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>{opportunity?.title ?? '—'}</Text>
        {location.length > 0 ? <Text style={styles.subtitle}>{location}</Text> : null}
      </View>

      {canFinalize ? (
        <Card tone="warning">
          <CardTitle>{t.application.toFinalizeTitle}</CardTitle>
          <Text style={styles.cardBody}>{t.application.toFinalizeBody}</Text>
        </Card>
      ) : null}

      {application.isSelfDeclared ? (
        <Card tone="info">
          <CardTitle>{t.application.selfDeclaredTitle}</CardTitle>
          <Text style={styles.cardBody}>{t.application.selfDeclaredBody}</Text>
        </Card>
      ) : null}

      {application.message !== null && application.message.length > 0 ? (
        <Card>
          <CardTitle>{t.application.messageTitle}</CardTitle>
          <Text style={styles.cardBody}>{application.message}</Text>
        </Card>
      ) : null}

      <Card>
        <CardTitle>{t.application.timelineTitle}</CardTitle>
        {application.timeline.length === 0 ? (
          <Text style={styles.cardBody}>—</Text>
        ) : (
          application.timeline.map((event, index) => (
            <View key={`${event.toStatus}-${index}`} style={styles.timelineRow}>
              <View style={styles.timelineDot} />
              <Text style={styles.timelineDate}>{formatDate(event.createdAt) ?? '—'}</Text>
              <Text style={styles.timelineLabel}>{t.applicationStatus[event.toStatus] ?? event.toStatus}</Text>
            </View>
          ))
        )}
      </Card>

      {application.documents.length > 0 ? (
        <Card>
          <CardTitle>{t.application.documentsTitle}</CardTitle>
          {application.documents.map((doc) => (
            <View key={doc.documentId} style={styles.documentRow}>
              <Text style={styles.documentLabel}>✓ {doc.title ?? doc.filename}</Text>
              <Text style={styles.documentStatus}>{t.application.added}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <View style={styles.badgeRow}>
        <Badge label={t.applicationStatus[application.status] ?? application.status} tone="info" />
      </View>

      <View style={styles.footer}>
        {application.allowedTransitions.length > 0 ? (
          <Button label={t.application.update} onPress={onUpdate} />
        ) : null}
        {isTerminal ? <Button label={t.application.outcome} onPress={onOutcome} /> : null}
      </View>
    </ScrollView>
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
  cardBody: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: rounded.full,
    backgroundColor: colors.success,
  },
  timelineDate: {
    ...textStyle.caption,
    color: colors.textMuted,
    width: 56,
  },
  timelineLabel: {
    ...textStyle.bodySm,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  documentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  documentLabel: {
    ...textStyle.bodySm,
    color: colors.textPrimary,
  },
  documentStatus: {
    ...textStyle.caption,
    color: colors.success,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  footer: {
    flexDirection: 'row',
    gap: space[3],
    paddingTop: space[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
