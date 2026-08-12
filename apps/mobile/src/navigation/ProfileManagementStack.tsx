import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ErrorState } from '../components/ErrorState';
import { profileManagement as pm } from '../i18n/profile-management';
import { useAuth } from '../lib/auth/AuthProvider';
import { newCorrelationId } from '../lib/correlation';
import { loadMemberContext } from '../lib/queries/profile';
import { AvailabilityEditScreen } from '../screens/profile-management/AvailabilityEditScreen';
import { AvailabilityScreen } from '../screens/profile-management/AvailabilityScreen';
import { CompletionScreen } from '../screens/profile-management/CompletionScreen';
import { EducationFormScreen } from '../screens/profile-management/EducationFormScreen';
import { EducationsScreen } from '../screens/profile-management/EducationsScreen';
import { ExperienceFormScreen } from '../screens/profile-management/ExperienceFormScreen';
import { ExperiencesScreen } from '../screens/profile-management/ExperiencesScreen';
import { HeaderEditScreen } from '../screens/profile-management/HeaderEditScreen';
import { LanguagesZonesScreen } from '../screens/profile-management/LanguagesZonesScreen';
import { ManagementHomeScreen } from '../screens/profile-management/ManagementHomeScreen';
import { MissingItemsScreen } from '../screens/profile-management/MissingItemsScreen';
import { PositioningScreen } from '../screens/profile-management/PositioningScreen';
import { ProjectFormScreen } from '../screens/profile-management/ProjectFormScreen';
import { ProjectsScreen } from '../screens/profile-management/ProjectsScreen';
import { RecommendationsScreen } from '../screens/profile-management/RecommendationsScreen';
import { RequestRecommendationScreen } from '../screens/profile-management/RequestRecommendationScreen';
import { SkillFormScreen } from '../screens/profile-management/SkillFormScreen';
import { SkillsScreen } from '../screens/profile-management/SkillsScreen';
import { colors, textStyle } from '../theme/tokens';

/**
 * Pile de navigation des ecrans de gestion de profil ISE-017 -> ISE-033.
 *
 * Monte comme second ecran de la pile locale de `ProfileScreen.tsx`
 * (ISE-016, `screens/profile/ProfileScreen.tsx`) : ce fichier ne touche
 * pas `AppTabs.tsx` ni `RootNavigator.tsx`, dont d'autres tranches mobiles
 * (onboarding, recherche, relations, appels au reseau, opportunites) sont
 * proprietaires en parallele — voir la consigne d'isolation du brief.
 *
 * `ManagementHomeScreen` n'est pas un ecran numerote de la traceability
 * matrix : c'est le menu ajoute par cette tranche pour rendre chaque
 * section (ISE-017 -> ISE-033) joignable depuis un seul point d'entree
 * « Modifier mon profil ».
 */
export type ProfileManagementStackParamList = {
  ManagementHome: undefined;
  HeaderEdit: undefined;
  Experiences: undefined;
  ExperienceForm: { experienceId?: string } | undefined;
  Educations: undefined;
  EducationForm: { educationId?: string } | undefined;
  Skills: undefined;
  SkillForm: { skillId?: number } | undefined;
  Positioning: undefined;
  Projects: undefined;
  ProjectForm: { projectId?: string } | undefined;
  LanguagesZones: undefined;
  Recommendations: undefined;
  RequestRecommendation: undefined;
  Completion: undefined;
  MissingItems: undefined;
  Availability: undefined;
  AvailabilityEdit: undefined;
};

const Stack = createNativeStackNavigator<ProfileManagementStackParamList>();

const ProfileIdContext = createContext<string | null>(null);

/**
 * Identifiant `ise_profiles.id` du membre courant, charge une seule fois
 * par `ProfileManagementStack` puis partage a tous ses ecrans : evite de
 * relire `loadMemberContext` a chaque navigation interne, et garantit
 * qu'aucun ecran ne peut se monter sans un profil resolu (la pile
 * n'affiche ses `Stack.Screen` qu'une fois `profileId` connu).
 */
export function useProfileId(): string {
  const value = useContext(ProfileIdContext);
  if (value === null) {
    throw new Error('useProfileId doit être utilisé sous ProfileManagementStack.');
  }
  return value;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'ready'; profileId: string };

export function ProfileManagementStack() {
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(() => {
    if (!user) return;
    setState({ status: 'loading' });
    loadMemberContext(user.id)
      .then((context) => {
        if (context.failed || !context.profile) {
          setState({ status: 'error', correlationId: newCorrelationId() });
        } else {
          setState({ status: 'ready', profileId: context.profile.id });
        }
      })
      .catch(() => setState({ status: 'error', correlationId: newCorrelationId() }));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.actionBlue} />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.loading}>
        <ErrorState title={pm.hub.title} correlationId={state.correlationId} onRetry={load} />
      </View>
    );
  }

  return (
    <ProfileIdContext.Provider value={state.profileId}>
      <Stack.Navigator
        screenOptions={{
          headerTintColor: colors.actionBlue,
          headerTitleStyle: { ...textStyle.bodySm, fontWeight: '700', color: colors.textPrimary },
          headerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="ManagementHome" component={ManagementHomeScreen} options={{ title: pm.hub.title }} />
        <Stack.Screen name="HeaderEdit" component={HeaderEditScreen} options={{ title: pm.header.title }} />
        <Stack.Screen name="Experiences" component={ExperiencesScreen} options={{ title: pm.experiences.title }} />
        <Stack.Screen
          name="ExperienceForm"
          component={ExperienceFormScreen}
          options={({ route }) => ({
            title: route.params?.experienceId ? pm.experienceForm.titleEdit : pm.experienceForm.titleNew,
          })}
        />
        <Stack.Screen name="Educations" component={EducationsScreen} options={{ title: pm.educations.title }} />
        <Stack.Screen
          name="EducationForm"
          component={EducationFormScreen}
          options={({ route }) => ({
            title: route.params?.educationId ? pm.educationForm.titleEdit : pm.educationForm.titleNew,
          })}
        />
        <Stack.Screen name="Skills" component={SkillsScreen} options={{ title: pm.skills.title }} />
        <Stack.Screen
          name="SkillForm"
          component={SkillFormScreen}
          options={({ route }) => ({
            title: route.params?.skillId ? pm.skillForm.titleEdit : pm.skillForm.titleNew,
          })}
        />
        <Stack.Screen name="Positioning" component={PositioningScreen} options={{ title: pm.positioning.title }} />
        <Stack.Screen name="Projects" component={ProjectsScreen} options={{ title: pm.projects.title }} />
        <Stack.Screen
          name="ProjectForm"
          component={ProjectFormScreen}
          options={({ route }) => ({
            title: route.params?.projectId ? pm.projectForm.titleEdit : pm.projectForm.titleNew,
          })}
        />
        <Stack.Screen
          name="LanguagesZones"
          component={LanguagesZonesScreen}
          options={{ title: pm.languagesZones.title }}
        />
        <Stack.Screen
          name="Recommendations"
          component={RecommendationsScreen}
          options={{ title: pm.recommendations.title }}
        />
        <Stack.Screen
          name="RequestRecommendation"
          component={RequestRecommendationScreen}
          options={{ title: pm.requestRecommendation.title }}
        />
        <Stack.Screen name="Completion" component={CompletionScreen} options={{ title: pm.completion.title }} />
        <Stack.Screen name="MissingItems" component={MissingItemsScreen} options={{ title: pm.missingItems.title }} />
        <Stack.Screen name="Availability" component={AvailabilityScreen} options={{ title: pm.availability.title }} />
        <Stack.Screen
          name="AvailabilityEdit"
          component={AvailabilityEditScreen}
          options={{ title: pm.availabilityForm.title }}
        />
      </Stack.Navigator>
    </ProfileIdContext.Provider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
