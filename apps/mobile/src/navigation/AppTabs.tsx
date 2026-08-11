import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';

import { fr } from '../i18n/fr';
import { ActionCentralScreen } from '../screens/action/ActionCentralScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { NetworkScreen } from '../screens/network/NetworkScreen';
import { OpportunitiesScreen } from '../screens/opportunities/OpportunitiesScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { colors, minTouchTarget, rounded, textStyle } from '../theme/tokens';
import type { AppTabParamList } from './types';

const Tab = createBottomTabNavigator<AppTabParamList>();

/**
 * Coquille de navigation D-94 : 5 destinations — Accueil, Réseau, action
 * centrale (+), Opportunités, Moi. « éviter plus de 5 destinations »
 * (MASTER PROMPT §90) — cet onglet central n'ouvre pas un 6e ecran caché,
 * il EST l'une des 5 destinations, rendue differemment (bouton releve)
 * pour signaler que c'est une action plutot qu'une consultation.
 */
export function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.actionBlue,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tab.Screen name="Accueil" component={HomeScreen} options={{ title: fr.nav.home }} />
      <Tab.Screen name="Reseau" component={NetworkScreen} options={{ title: fr.nav.network }} />
      <Tab.Screen
        name="ActionCentrale"
        component={ActionCentralScreen}
        options={{
          title: fr.nav.actionCentral,
          tabBarButton: (props) => <CentralActionButton {...props} />,
        }}
      />
      <Tab.Screen
        name="Opportunites"
        component={OpportunitiesScreen}
        options={{ title: fr.nav.opportunities }}
      />
      <Tab.Screen name="Moi" component={ProfileScreen} options={{ title: fr.nav.profile }} />
    </Tab.Navigator>
  );
}

/**
 * Rendu distinct de l'action centrale : bouton circulaire releve, plutôt
 * qu'une icône d'onglet ordinaire — signale visuellement qu'il s'agit d'une
 * action (créer / démarrer quelque chose), pas d'une section à consulter.
 */
function CentralActionButton({ onPress, accessibilityState }: BottomTabBarButtonProps) {
  const selected = accessibilityState?.selected ?? false;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={fr.nav.actionCentral}
      style={styles.centralWrapper}
    >
      <Pressable
        onPress={onPress}
        style={[styles.centralButton, selected ? styles.centralButtonActive : null]}
      >
        <Text style={styles.centralButtonLabel}>+</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: Platform.select({ ios: 84, default: 64 }),
    paddingTop: 8,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  tabBarLabel: {
    ...textStyle.caption,
    fontWeight: '600',
  },
  centralWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centralButton: {
    width: minTouchTarget + 8,
    height: minTouchTarget + 8,
    borderRadius: rounded.full,
    backgroundColor: colors.actionBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.select({ ios: 28, default: 20 }),
    shadowColor: colors.darkNavy,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  centralButtonActive: {
    backgroundColor: colors.activeBlue,
  },
  centralButtonLabel: {
    color: colors.textInverse,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 30,
  },
});
