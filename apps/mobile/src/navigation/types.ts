import type { NavigatorScreenParams } from '@react-navigation/native';

import type { ReseauStackParamList } from './ReseauStack';
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
  /**
   * L'onglet « Réseau » monte `ReseauStack` (fusion à plat de `NetworkScreen`,
   * ISE-038 -> ISE-046 et ISE-047 -> ISE-054, D-169) : typé avec
   * `NavigatorScreenParams` comme `ActionCentrale`, pour qu'une navigation
   * externe puisse un jour cibler un écran précis de cette pile
   * (`navigate('Reseau', { screen: 'Invitations' })`) avec la même rigueur
   * de typage, même si rien ne le fait encore aujourd'hui.
   */
  Reseau: NavigatorScreenParams<ReseauStackParamList>;
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
