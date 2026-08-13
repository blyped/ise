/**
 * Types de routes ISE-038 -> ISE-046 — Relations & introductions.
 *
 * Ce fichier ne contient plus de composant navigateur : la passe
 * d'assemblage finale (D-169, tâche #114) a fusionné ses 8 écrans A PLAT
 * dans `ReseauStack.tsx` (même navigateur que `NetworkScreen` et les
 * appels au réseau, cf. le commentaire de ce fichier pour la raison —
 * navigation croisée entre ces trois lots, donc un seul `Stack.Navigator`
 * partagé plutôt que des navigateurs imbriqués).
 *
 * `RelationsStackParamList` reste défini ICI et nulle part ailleurs : les 8
 * écrans de `screens/relations/*` et `ReseauStack.tsx` l'importent tous
 * directement depuis ce chemin (`from './RelationsStack'` /
 * `from '../../navigation/RelationsStack'`) pour typer leurs props
 * (`NativeStackScreenProps<RelationsStackParamList, '...'>`). Renommer ou
 * déplacer ce type casserait ces imports sans bénéfice : il est donc
 * conservé tel quel, seul le navigateur mort a été retiré.
 */
export type RelationsStackParamList = {
  /** ISE-038 — Se connecter a un ISE, depuis son profil. */
  Connect: { profileId: string };
  /** ISE-039 — Confirmation d'envoi d'une demande de connexion. */
  ConnectionSent: { requestId: string };
  /** ISE-041 — Invitations recues. */
  Invitations: undefined;
  /** ISE-042 — Detail d'une invitation recue. */
  InvitationDetail: { requestId: string };
  /** ISE-043 — Chemins d'introduction vers un profil cible. */
  IntroductionPath: { profileId: string };
  /** ISE-044 — Demander une introduction via un intermediaire donne. */
  RequestIntroduction: { profileId: string; intermediaryId: string };
  /**
   * ISE-045 — Mes demandes d'introduction. Sans `introductionId` : liste
   * (`list_my_introductions`). Avec : suivi d'une demande precise
   * (`get_introduction_request`) — meme ecran, meme maniere que la pile web
   * distingue `/reseau/introductions` de `/reseau/introductions/[id]`.
   */
  Introductions: { introductionId?: string } | undefined;
  /** ISE-046 — Bilan d'une introduction. */
  IntroductionOutcome: { introductionId: string };
};
