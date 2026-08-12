import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { fr } from '../i18n/fr';
import { SaveSearchScreen } from '../screens/search/SaveSearchScreen';
import { SearchProfileScreen } from '../screens/search/SearchProfileScreen';
import { SearchResultsScreen } from '../screens/search/SearchResultsScreen';
import { SearchScreen } from '../screens/search/SearchScreen';
import type { CriterionChip, SearchCriteria } from '../lib/queries/search';
import { colors, textStyle } from '../theme/tokens';

/**
 * ISE-034 -> ISE-037 — Recherche & decouverte (nouvelle pile de
 * navigation, non branchee automatiquement).
 *
 * Cette pile n'est PAS montee par `AppTabs.tsx` : la consigne de la
 * tranche (cf. rapport de livraison) interdit d'editer les fichiers de
 * navigation partages pendant que d'autres lots mobiles y travaillent en
 * parallele. Voir le rapport de livraison pour le branchement exact de
 * l'onglet central « + » (`ActionCentrale`) vers cette pile.
 *
 * Parametres de route :
 *  - `Search`         : sans parametre, point d'entree (ISE-034).
 *  - `SearchResults`   : `{ criteria, labels }` — `labels` porte les
 *    libelles deja connus des critères scalaires choisis dans
 *    `SearchScreen` (secteur/pays/disponibilite), pour ne pas refaire
 *    une lecture referentielle rien que pour nommer 1 a 3 valeurs
 *    (meme raisonnement que `loadCriteriaLabels` cote web, en plus
 *    direct puisque le formulaire mobile connait deja ces libelles).
 *  - `SaveSearch`      : `{ criteria? }` — presente si on arrive depuis
 *    « Enregistrer la recherche » (ISE-035 -> ISE-036) ; absente si on
 *    ouvre l'ecran seulement pour gerer ses recherches deja enregistrees.
 *  - `SearchProfile`   : `{ profileId }` (ISE-037).
 */
export type SearchStackParamList = {
  Search: undefined;
  SearchResults: {
    criteria: SearchCriteria;
    labels: {
      sectorLabel: string | null;
      countryLabel: string | null;
      availabilityLabel: string | null;
    };
  };
  SaveSearch:
    | {
        criteria: SearchCriteria;
        labels?: {
          sectorLabel: string | null;
          countryLabel: string | null;
          availabilityLabel: string | null;
        };
      }
    | undefined;
  SearchProfile: { profileId: string };
};

export type { CriterionChip };

const Stack = createNativeStackNavigator<SearchStackParamList>();

export function SearchStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.actionBlue,
        headerTitleStyle: { ...textStyle.h4, fontWeight: '700', color: colors.textPrimary },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Search" component={SearchScreen} options={{ title: fr.nav.actionCentral }} />
      <Stack.Screen
        name="SearchResults"
        component={SearchResultsScreen}
        options={{ title: 'Résultats' }}
      />
      <Stack.Screen
        name="SaveSearch"
        component={SaveSearchScreen}
        options={{ title: 'Enregistrer la recherche' }}
      />
      <Stack.Screen
        name="SearchProfile"
        component={SearchProfileScreen}
        options={{ title: 'Profil' }}
      />
    </Stack.Navigator>
  );
}
