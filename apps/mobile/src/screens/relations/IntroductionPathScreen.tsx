import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { ScreenHeader } from '../../components/ScreenHeader';
import { frRelations, tRelations } from '../../i18n/relations';
import { newCorrelationId } from '../../lib/correlation';
import { loadIntroductionPaths, type IntroductionPath, type IntroductionPathsView } from '../../lib/queries/relations';
import type { RelationsStackParamList } from '../../navigation/RelationsStack';
import { colors, rounded, space, textStyle } from '../../theme/tokens';

type Props = NativeStackScreenProps<RelationsStackParamList, 'IntroductionPath'>;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'notFound' }
  | { status: 'ready'; view: IntroductionPathsView };

/**
 * ISE-043 — Chemins d'introduction vers un profil cible.
 *
 * Porte `suggest_introduction_paths` (migration 0039), exactement comme
 * `apps/web/src/app/profil/[profileId]/introduction/page.tsx`. Seuls des
 * signaux EXPLICITES produisent le libellé qualitatif de chaque chemin
 * (`label` + `reasons`, D-43) : aucun score numérique n'est calculé ni
 * affiché côté client (MASTER PROMPT §15).
 */
export function IntroductionPathScreen({ route, navigation }: Props) {
  const { profileId } = route.params;
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(() => {
    setState({ status: 'loading' });
    loadIntroductionPaths(profileId)
      .then((result) => {
        if (result.failed) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }
        if (result.data === null) {
          setState({ status: 'notFound' });
          return;
        }
        setState({ status: 'ready', view: result.data });
      })
      .catch(() => setState({ status: 'error', correlationId: newCorrelationId() }));
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

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
        <ScreenHeader title={frRelations.paths.title} onBack={navigation.goBack} />
        <ErrorState title={frRelations.paths.errorTitle} correlationId={state.correlationId} onRetry={load} />
      </Screen>
    );
  }

  if (state.status === 'notFound') {
    return (
      <Screen>
        <ScreenHeader title={frRelations.paths.title} onBack={navigation.goBack} />
        <Text style={styles.noticeTitle}>{frRelations.connect.notFoundTitle}</Text>
      </Screen>
    );
  }

  const { view } = state;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScreenHeader title={frRelations.paths.title} onBack={navigation.goBack} />

        <Text style={styles.subtitle}>{tRelations(frRelations.paths.subtitle, { name: view.target.displayName })}</Text>

        {view.alreadyConnected ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>{frRelations.paths.alreadyConnectedTitle}</Text>
            <Text style={styles.paragraph}>{frRelations.paths.alreadyConnectedBody}</Text>
          </View>
        ) : view.paths.length === 0 ? (
          <EmptyState title={frRelations.paths.emptyTitle} description={frRelations.paths.emptyBody} />
        ) : (
          <View style={styles.pathList}>
            {view.paths.map((path, index) => (
              <PathCard
                key={path.intermediary.profileId}
                path={path}
                title={index === 0 ? frRelations.paths.bestTitle : undefined}
                onAsk={() =>
                  navigation.navigate('RequestIntroduction', {
                    profileId,
                    intermediaryId: path.intermediary.profileId,
                  })
                }
                onSeeRequest={(requestId) => navigation.navigate('Introductions', { introductionId: requestId })}
              />
            ))}
          </View>
        )}

        {!view.alreadyConnected ? (
          <Pressable
            onPress={() => navigation.navigate('Connect', { profileId })}
            accessibilityRole="button"
            style={styles.linkButton}
          >
            <Text style={styles.linkButtonLabel}>{frRelations.paths.emptyAction}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function PathCard({
  path,
  title,
  onAsk,
  onSeeRequest,
}: {
  path: IntroductionPath;
  title: string | undefined;
  onAsk: () => void;
  onSeeRequest: (requestId: string) => void;
}) {
  const pendingRequestId = path.pendingRequestId;
  return (
    <View style={styles.card}>
      {title !== undefined ? <Text style={styles.cardTitle}>{title}</Text> : null}
      <Text style={styles.cardName}>{path.intermediary.displayName}</Text>
      {path.intermediary.promotionLabel !== null ? (
        <Text style={styles.cardMeta}>{path.intermediary.promotionLabel}</Text>
      ) : null}
      <View style={styles.badge}>
        <Text style={styles.badgeLabel}>{frRelations.pathLabel[path.label] ?? path.label}</Text>
      </View>

      {path.reasons.length > 0 ? (
        <View style={styles.reasonsBox}>
          <Text style={styles.reasonsTitle}>{frRelations.paths.reasonsTitle}</Text>
          {path.reasons.map((reason, i) => (
            <Text key={i} style={styles.reason}>
              ✓ {frRelations.reason[reason] ?? reason}
            </Text>
          ))}
        </View>
      ) : null}

      {pendingRequestId !== null ? (
        <Pressable
          onPress={() => onSeeRequest(pendingRequestId)}
          accessibilityRole="button"
          style={styles.actionButton}
        >
          <Text style={styles.actionLabel}>
            {tRelations(frRelations.paths.pendingVia, { name: path.intermediary.displayName })}
          </Text>
        </Pressable>
      ) : (
        <Pressable onPress={onAsk} accessibilityRole="button" style={styles.actionButtonPrimary}>
          <Text style={styles.actionLabelPrimary}>
            {tRelations(frRelations.paths.askVia, { name: path.intermediary.displayName })}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subtitle: { ...textStyle.bodySm, color: colors.textSecondary, marginBottom: space[5] },
  noticeBox: { gap: space[2], marginBottom: space[5] },
  noticeTitle: { ...textStyle.h4, fontWeight: '700', color: colors.textPrimary },
  paragraph: { ...textStyle.bodySm, color: colors.textSecondary },
  pathList: { gap: space[4], marginBottom: space[6] },
  card: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[5],
    gap: space[2],
  },
  cardTitle: { ...textStyle.caption, color: colors.actionBlue, fontWeight: '700', textTransform: 'uppercase' },
  cardName: { ...textStyle.body, fontWeight: '700', color: colors.textPrimary },
  cardMeta: { ...textStyle.caption, color: colors.textSecondary },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceMuted,
    borderRadius: rounded.full,
    paddingHorizontal: space[3],
    paddingVertical: 2,
  },
  badgeLabel: { ...textStyle.caption, color: colors.textSecondary, fontWeight: '700' },
  reasonsBox: { gap: 2 },
  reasonsTitle: { ...textStyle.caption, fontWeight: '700', color: colors.textPrimary },
  reason: { ...textStyle.caption, color: colors.textSecondary },
  actionButtonPrimary: {
    minHeight: 44,
    borderRadius: rounded.base,
    backgroundColor: colors.actionBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space[2],
  },
  actionLabelPrimary: { ...textStyle.bodySm, color: colors.textInverse, fontWeight: '700' },
  actionButton: {
    minHeight: 44,
    borderRadius: rounded.base,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space[2],
  },
  actionLabel: { ...textStyle.bodySm, color: colors.textPrimary, fontWeight: '700' },
  linkButton: { marginBottom: space[8], paddingVertical: space[2] },
  linkButtonLabel: { ...textStyle.bodySm, color: colors.actionBlue, fontWeight: '700' },
});
