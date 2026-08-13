/**
 * Types de routes ISE-047 -> ISE-054 — Appels au reseau.
 *
 * Ce fichier ne contient plus de composant navigateur : la passe
 * d'assemblage finale (D-169, tâche #114) a fusionné ses 5 écrans A PLAT
 * dans `ReseauStack.tsx` (même navigateur que `NetworkScreen` et les
 * relations/introductions — navigation croisée entre ces trois lots, donc
 * un seul `Stack.Navigator` partagé plutôt que des navigateurs imbriqués).
 *
 * `NetworkCallsStackParamList` reste défini ICI et nulle part ailleurs : les
 * 5 écrans de `screens/network-calls/*` et `ReseauStack.tsx` l'importent
 * tous directement depuis ce chemin pour typer leurs props
 * (`NativeStackScreenProps<NetworkCallsStackParamList, '...'>`). Renommer ou
 * déplacer ce type casserait ces imports sans bénéfice : il est donc
 * conservé tel quel, seul le navigateur mort a été retiré.
 */
export type NetworkCallsStackParamList = {
  AppelsListe: undefined;
  AppelDetail: { callId: string };
  AppelCreer: { callId?: string };
  AppelSuivi: { callId: string };
  AppelCloture: { callId: string };
};
