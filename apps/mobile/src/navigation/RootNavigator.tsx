import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '../lib/auth/AuthProvider';
import { loadMemberContext } from '../lib/queries/profile';
import { colors } from '../theme/tokens';
import { AppTabs } from './AppTabs';
import { AuthStack } from './AuthStack';
import { OnboardingStack } from './OnboardingStack';

/**
 * Racine de navigation : bascule entre `AuthStack`, `OnboardingStack` et
 * `AppTabs` selon la session lue par `AuthProvider` et l'etat d'onboarding
 * du profil.
 *
 * C'est l'equivalent mobile de `apps/web/src/middleware.ts` (D-155) : sur
 * le web, la garde s'execute cote serveur avant que la page ne soit servie,
 * avec redirection vers `/connexion?redirectTo=...` en cas d'absence de
 * session. Sur mobile, il n'y a pas de serveur intercalé : la meme garantie
 * (aucun ecran membre visible sans session) est obtenue en ne montant
 * JAMAIS `AppTabs` tant que `session` est `null` — pas en masquant son
 * contenu apres coup.
 *
 * GARDE D'ONBOARDING (integration finale des tranches mobiles paralleles) :
 * une fois la session ouverte, `loadMemberContext` (deja utilise par
 * `HomeScreen`/`ProfileScreen`) dit si un profil existe et si
 * `onboarding_completed_at` est renseigne. Aucun profil, ou un profil dont
 * l'onboarding n'est pas termine, montent `OnboardingStack` (ISE-002 ->
 * ISE-014) au lieu de `AppTabs`. Chaque ecran d'etape de cette pile relit
 * lui-meme sa progression via `profile_onboarding_progress`
 * (`furthest_step`, D-112) : cette garde ne pilote donc jamais quel ecran
 * precis afficher, seulement si on entre ou non dans le parcours.
 *
 * En cas d'echec de lecture (reseau, RPC), on laisse passer vers
 * `AppTabs` plutot que de bloquer un membre deja onboarde derriere un
 * ecran d'erreur : chaque ecran membre gere deja son propre etat d'erreur
 * avec reessai (D-93).
 *
 * Le port du `redirectTo` (page demandee avant connexion, D-155) n'a pas
 * d'equivalent utile ici : il n'existe pas de lien profond entrant pour
 * cette premiere tranche (pas encore de deep linking configure dans
 * `app.json`). A construire quand une premiere fonctionnalite en aura besoin
 * (ex. un lien de notification push).
 */
export function RootNavigator() {
  const { session, loading, user } = useAuth();
  const [onboardingState, setOnboardingState] = useState<
    { status: 'loading' } | { status: 'done'; needsOnboarding: boolean }
  >({ status: 'loading' });

  useEffect(() => {
    if (!session || !user) {
      setOnboardingState({ status: 'loading' });
      return;
    }

    let cancelled = false;

    loadMemberContext(user.id)
      .then((context) => {
        if (cancelled) return;
        if (context.failed) {
          setOnboardingState({ status: 'done', needsOnboarding: false });
          return;
        }
        const needsOnboarding =
          context.profile === null || context.profile.onboarding_completed_at === null;
        setOnboardingState({ status: 'done', needsOnboarding });
      })
      .catch(() => {
        if (!cancelled) setOnboardingState({ status: 'done', needsOnboarding: false });
      });

    return () => {
      cancelled = true;
    };
  }, [session, user]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.actionBlue} size="large" />
      </View>
    );
  }

  if (!session) {
    return <AuthStack />;
  }

  if (onboardingState.status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.actionBlue} size="large" />
      </View>
    );
  }

  return onboardingState.needsOnboarding ? <OnboardingStack /> : <AppTabs />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
