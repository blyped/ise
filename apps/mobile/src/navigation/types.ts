import type { NavigatorScreenParams } from '@react-navigation/native';

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
  ActionCentrale: undefined;
  Opportunites: undefined;
  Moi: undefined;
};

export type RootParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  App: NavigatorScreenParams<AppTabParamList>;
};
