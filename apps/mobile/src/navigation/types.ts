import type { NavigatorScreenParams } from '@react-navigation/native';

import type { SearchStackParamList } from './SearchStack';

/**
 * Pile affichee aux visiteurs non authentifies.
 *
 * ISE-002 (creer un compte), ISE-003 (mot de passe oublie) et ISE-004
 * (reinitialiser) restent hors de cette premiere tranche mobile : la
 * traceability matrix les laisse "a definir" pour la route mobile. Seule
 * ISE-001 est cablee ; le type est ecrit au singulier pour que l'ajout d'un
 * ecran plus tard soit une extension, pas une reecriture.
 */
export type AuthStackParamList = {
  Connexion: undefined;
};

/** Les 5 destinations D-94 : Accueil, Reseau, action centrale (+), Opportunites, Moi. */
export type AppTabParamList = {
  Accueil: undefined;
  Reseau: undefined;
  /**
   * L'action centrale « + » monte desormais `SearchStack` (ISE-034 ->
   * ISE-037, integration finale des tranches mobiles paralleles) au lieu
   * de la coquille `ActionCentralScreen`.
   */
  ActionCentrale: NavigatorScreenParams<SearchStackParamList>;
  Opportunites: undefined;
  Moi: undefined;
};

export type RootParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  App: NavigatorScreenParams<AppTabParamList>;
};
