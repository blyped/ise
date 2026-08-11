import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { fr } from '../../i18n/fr';
import { useAuth } from '../../lib/auth/AuthProvider';
import { newCorrelationId } from '../../lib/correlation';
import { loadMemberContext, type MemberProfile } from '../../lib/queries/profile';
import { colors, rounded, space, textStyle } from '../../theme/tokens';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'empty' }
  | { status: 'ready'; profile: MemberProfile };

/** ISE-015 — Tableau de bord membre (coquille mobile, Accueil). */
export function HomeScreen() {
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(() => {
    if (!user) return;
    setState({ status: 'loading' });

    loadMemberContext(user.id)
      .then((context) => {
        if (context.failed) {
          setState({ status: 'error', correlationId: newCorrelationId() });
        } else if (!context.profile) {
          setState({ status: 'empty' });
        } else {
          setState({ status: 'ready', profile: context.profile });
        }
      })
      .catch(() => {
        setState({ status: 'error', correlationId: newCorrelationId() });
      });
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen>
      <Text style={styles.heading}>{fr.nav.home}</Text>

      {state.status === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.actionBlue} />
        </View>
      ) : null}

      {state.status === 'error' ? (
        <ErrorState
          title={fr.dashboard.errorTitle}
          correlationId={state.correlationId}
          onRetry={load}
        />
      ) : null}

      {state.status === 'empty' ? (
        <EmptyState title={fr.dashboard.emptyTitle} description={fr.dashboard.emptyBody} />
      ) : null}

      {state.status === 'ready' ? <ProfileCard profile={state.profile} /> : null}
    </Screen>
  );
}

function ProfileCard({ profile }: { profile: MemberProfile }) {
  const completion = profile.profile_completion;
  const displayName = profile.display_name ?? `${profile.first_name} ${profile.last_name}`;

  return (
    <View style={styles.card}>
      <Text style={styles.name}>{displayName}</Text>
      {profile.headline ? <Text style={styles.headline}>{profile.headline}</Text> : null}

      {completion === null ? (
        <Text style={styles.hint}>{fr.dashboard.profileCompletionUnknown}</Text>
      ) : (
        <>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${completion}%` }]} />
          </View>
          <Text style={styles.hint}>{fr.dashboard.profileCompletionHint}</Text>
        </>
      )}

      <View style={styles.badgeRow}>
        <Badge label={fr.dashboard.claimStatus[profile.claim_status]} />
        <Badge label={fr.dashboard.verificationStatus[profile.verification_status]} />
      </View>
    </View>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...textStyle.h2,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: space[6],
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[6],
    gap: space[3],
  },
  name: {
    ...textStyle.h3,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headline: {
    ...textStyle.body,
    color: colors.textSecondary,
  },
  hint: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
  progressTrack: {
    height: 6,
    borderRadius: rounded.full,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.actionBlue,
    borderRadius: rounded.full,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: space[3],
    marginTop: space[2],
  },
  badge: {
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: rounded.full,
    backgroundColor: colors.surfaceMuted,
  },
  badgeLabel: {
    ...textStyle.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
