import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ApplicationDetailScreen } from '../screens/opportunities-detail/ApplicationDetailScreen';
import { ApplicationResultScreen } from '../screens/opportunities-detail/ApplicationResultScreen';
import { CloseOpportunityScreen } from '../screens/opportunities-detail/CloseOpportunityScreen';
import { MyApplicationsScreen } from '../screens/opportunities-detail/MyApplicationsScreen';
import { MyOpportunitiesScreen } from '../screens/opportunities-detail/MyOpportunitiesScreen';
import { OpportunityDetailScreen } from '../screens/opportunities-detail/OpportunityDetailScreen';
import { PreviewOpportunityScreen } from '../screens/opportunities-detail/PreviewOpportunityScreen';
import { PublishOpportunityScreen } from '../screens/opportunities-detail/PublishOpportunityScreen';
import { SavedOpportunitiesScreen } from '../screens/opportunities-detail/SavedOpportunitiesScreen';
import { TargetingOpportunityScreen } from '../screens/opportunities-detail/TargetingOpportunityScreen';
import { TrackOpportunityScreen } from '../screens/opportunities-detail/TrackOpportunityScreen';
import { UpdateApplicationScreen } from '../screens/opportunities-detail/UpdateApplicationScreen';
import { OpportunitiesScreen } from '../screens/opportunities/OpportunitiesScreen';

/**
 * Pile ISE-056 -> ISE-066 : détail, candidatures, publication.
 *
 * Fichier NOUVEAU, distinct de `AppTabs.tsx` (hors-limite pour cette
 * tranche, d'autres agents y travaillent en parallèle). `OpportunitiesHub`
 * enveloppe l'écran ISE-055 déjà livré (`OpportunitiesScreen`, étendu
 * avec des points d'entrée vers cette pile — voir le commentaire en tête
 * de ce fichier). Pour que le point d'entrée central + onglet
 * « Opportunités » ouvre cette pile au lieu de l'écran nu, il suffit de
 * remplacer, dans `AppTabs.tsx` :
 *
 *   import { OpportunitiesScreen } from '../screens/opportunities/OpportunitiesScreen';
 *   ...
 *   <Tab.Screen name="Opportunites" component={OpportunitiesScreen} ... />
 *
 * par :
 *
 *   import { OpportunitiesDetailStack } from './OpportunitiesDetailStack';
 *   ...
 *   <Tab.Screen name="Opportunites" component={OpportunitiesDetailStack} ... />
 *
 * Ce remplacement n'a PAS été fait ici (AppTabs.tsx est hors-limite pour
 * cette tranche) : à faire lors de l'intégration finale des tranches
 * mobiles en parallèle.
 */
export type OpportunitiesDetailStackParamList = {
  OpportunitiesHub: undefined;
  OpportunityDetail: { opportunityId: string };
  SavedOpportunities: undefined;
  MyApplications: undefined;
  ApplicationDetail: { applicationId: string };
  UpdateApplication: { applicationId: string };
  ApplicationResult: { applicationId: string; pendingNote: string };
  PublishOpportunity: undefined;
  TargetingOpportunity: { opportunityId: string };
  PreviewOpportunity: { opportunityId: string };
  MyOpportunities: undefined;
  TrackOpportunity: { opportunityId: string };
  CloseOpportunity: { opportunityId: string };
};

const Stack = createNativeStackNavigator<OpportunitiesDetailStackParamList>();

type Props<Name extends keyof OpportunitiesDetailStackParamList> = NativeStackScreenProps<
  OpportunitiesDetailStackParamList,
  Name
>;

function OpportunitiesHubRoute({ navigation }: Props<'OpportunitiesHub'>) {
  return (
    <OpportunitiesScreen
      onOpenOpportunity={(opportunityId) => navigation.navigate('OpportunityDetail', { opportunityId })}
      onOpenSaved={() => navigation.navigate('SavedOpportunities')}
      onOpenApplications={() => navigation.navigate('MyApplications')}
      onOpenPublish={() => navigation.navigate('PublishOpportunity')}
      onOpenMyOpportunities={() => navigation.navigate('MyOpportunities')}
    />
  );
}

function OpportunityDetailRoute({ route, navigation }: Props<'OpportunityDetail'>) {
  return (
    <OpportunityDetailScreen
      opportunityId={route.params.opportunityId}
      onBack={() => navigation.goBack()}
      onOpenApplication={(applicationId) => navigation.replace('ApplicationDetail', { applicationId })}
    />
  );
}

function SavedOpportunitiesRoute({ navigation }: Props<'SavedOpportunities'>) {
  return (
    <SavedOpportunitiesScreen
      onBack={() => navigation.goBack()}
      onOpenOpportunity={(opportunityId) => navigation.navigate('OpportunityDetail', { opportunityId })}
      onOpenApplications={() => navigation.navigate('MyApplications')}
    />
  );
}

function MyApplicationsRoute({ navigation }: Props<'MyApplications'>) {
  return (
    <MyApplicationsScreen
      onBack={() => navigation.goBack()}
      onOpenApplication={(applicationId) => navigation.navigate('ApplicationDetail', { applicationId })}
    />
  );
}

function ApplicationDetailRoute({ route, navigation }: Props<'ApplicationDetail'>) {
  return (
    <ApplicationDetailScreen
      applicationId={route.params.applicationId}
      onBack={() => navigation.goBack()}
      onUpdate={(applicationId) => navigation.navigate('UpdateApplication', { applicationId })}
      onOutcome={(applicationId) => navigation.navigate('ApplicationResult', { applicationId, pendingNote: '' })}
    />
  );
}

function UpdateApplicationRoute({ route, navigation }: Props<'UpdateApplication'>) {
  return (
    <UpdateApplicationScreen
      applicationId={route.params.applicationId}
      onBack={() => navigation.goBack()}
      onDone={() => navigation.goBack()}
      onGoToOutcome={(applicationId, pendingNote) =>
        navigation.replace('ApplicationResult', { applicationId, pendingNote })
      }
    />
  );
}

function ApplicationResultRoute({ route, navigation }: Props<'ApplicationResult'>) {
  return (
    <ApplicationResultScreen
      applicationId={route.params.applicationId}
      pendingNote={route.params.pendingNote}
      onBack={() => navigation.goBack()}
      onDone={() =>
        navigation.navigate('ApplicationDetail', { applicationId: route.params.applicationId })
      }
    />
  );
}

function PublishOpportunityRoute({ navigation }: Props<'PublishOpportunity'>) {
  return (
    <PublishOpportunityScreen
      onBack={() => navigation.goBack()}
      onContinue={(opportunityId) => navigation.navigate('TargetingOpportunity', { opportunityId })}
    />
  );
}

function TargetingOpportunityRoute({ route, navigation }: Props<'TargetingOpportunity'>) {
  return (
    <TargetingOpportunityScreen
      opportunityId={route.params.opportunityId}
      onBack={() => navigation.goBack()}
      onContinue={() => navigation.navigate('PreviewOpportunity', { opportunityId: route.params.opportunityId })}
    />
  );
}

function PreviewOpportunityRoute({ route, navigation }: Props<'PreviewOpportunity'>) {
  return (
    <PreviewOpportunityScreen
      opportunityId={route.params.opportunityId}
      onBack={() => navigation.goBack()}
      onPublished={(opportunityId) => navigation.replace('TrackOpportunity', { opportunityId })}
    />
  );
}

function MyOpportunitiesRoute({ navigation }: Props<'MyOpportunities'>) {
  return (
    <MyOpportunitiesScreen
      onBack={() => navigation.goBack()}
      onOpenTracking={(opportunityId) => navigation.navigate('TrackOpportunity', { opportunityId })}
    />
  );
}

function TrackOpportunityRoute({ route, navigation }: Props<'TrackOpportunity'>) {
  return (
    <TrackOpportunityScreen
      opportunityId={route.params.opportunityId}
      onBack={() => navigation.goBack()}
      onClose={(opportunityId) => navigation.navigate('CloseOpportunity', { opportunityId })}
    />
  );
}

function CloseOpportunityRoute({ route, navigation }: Props<'CloseOpportunity'>) {
  return (
    <CloseOpportunityScreen
      opportunityId={route.params.opportunityId}
      onBack={() => navigation.goBack()}
      onDone={() => navigation.navigate('TrackOpportunity', { opportunityId: route.params.opportunityId })}
    />
  );
}

export function OpportunitiesDetailStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OpportunitiesHub" component={OpportunitiesHubRoute} />
      <Stack.Screen name="OpportunityDetail" component={OpportunityDetailRoute} />
      <Stack.Screen name="SavedOpportunities" component={SavedOpportunitiesRoute} />
      <Stack.Screen name="MyApplications" component={MyApplicationsRoute} />
      <Stack.Screen name="ApplicationDetail" component={ApplicationDetailRoute} />
      <Stack.Screen name="UpdateApplication" component={UpdateApplicationRoute} />
      <Stack.Screen name="ApplicationResult" component={ApplicationResultRoute} />
      <Stack.Screen name="PublishOpportunity" component={PublishOpportunityRoute} />
      <Stack.Screen name="TargetingOpportunity" component={TargetingOpportunityRoute} />
      <Stack.Screen name="PreviewOpportunity" component={PreviewOpportunityRoute} />
      <Stack.Screen name="MyOpportunities" component={MyOpportunitiesRoute} />
      <Stack.Screen name="TrackOpportunity" component={TrackOpportunityRoute} />
      <Stack.Screen name="CloseOpportunity" component={CloseOpportunityRoute} />
    </Stack.Navigator>
  );
}
