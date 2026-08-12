import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { fr } from '../../i18n/fr';
import { useAuth } from '../../lib/auth/AuthProvider';
import { newCorrelationId } from '../../lib/correlation';
import {
  loadMemberContext,
  type MemberProfile,
  type MemberPromotion,
} from '../../lib/queries/profile';
import { colors, rounded, space, textStyle } from '../../theme/tokens';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'empty' }
  | { status: 'ready'; profile: MemberProfile; promotion: MemberPromotion | null };

/**
 * Moi — ISE-016 « Mon profil » (coquille mobile, D-94).
 *
 * Meme lecture que `HomeScreen` (`loadMemberContext`, RPC `my_profile_completion`
 * — D-72, le score n'est jamais visible d'un autre membre), etendue a la
 * promotion. Le formulaire d'edition complet (ISE-017 → ISE-033) reste hors
 * de cette premiere tranche : cet ecran est une lecture seule de son propre
 * profil, plus la deconnexion.
 */
export function ProfileScreen() {
  const { user, signOut } = useAuth();
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
          setState({ status: 'ready', profile: context.profile, promotion: context.promotion });
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
      <Text style={styles.heading}>{fr.nav.profile}</Text>

      {state.status === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.actionBlue} />
        </View>
      ) : null}

      {state.status === 'error' ? (
        <ErrorState title={fr.profile.errorTitle} correlationId={state.correlationId} onRetry={load} />
      ) : null}

      {state.status === 'empty' ? (
        <EmptyState title={fr.profile.emptyTitle} description={fr.profile.emptyBody} />
      ) : null}

      {state.status === 'ready' ? (
        <ProfileCard profile={state.profile} promotion={state.promotion} />
      ) : null}

      <View style={styles.signOut}>
        <Button label={fr.common.signOut} onPress={() => void signOut()} />
      </View>
    </Screen>
  );
}

function ProfileCard({
  profile,
  promotion,
}: {
  profile: MemberProfile;
  promotion: MemberPromotion | null;
}) {
  const displayName = profile.display_name ?? `${profile.first_name} ${profile.last_name}`;
  const promotionLabel =
    promotion !== null ? `${promotion.name} · ${promotion.graduation_year}` : null;
  const completion = profile.profile_completion;

  return (
    <View style={styles.card}>
      <Text style={styles.name}>{displayName}</Text>
      <Text style={styles.promotion}>{promotionLabel ?? fr.profile.promotionUnknown}</Text>
      {profile.headline ? <Text style={styles.headline}>{profile.headline}</Text> : null}

      {completion === null ? (
        <Text style={styles.hint}>{fr.profile.completionUnknown}</Text>
      ) : (
        <>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${completion}%` }]} />
          </View>
          <Text style={styles.hint}>
            {completion}% · {fr.profile.completionHint}
          </Text>
        </>
      )}
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
  promotion: {
    ...textStyle.body,
    color: colors.textSecondary,
    fontWeight: '600',
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
  signOut: {
    marginTop: space[8],
  },
});
