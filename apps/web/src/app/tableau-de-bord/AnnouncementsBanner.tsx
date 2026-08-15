import { Alert } from '@ise/ui-web';
import { frAnnouncements } from '@/i18n/announcements';
import type { DashboardAnnouncement } from '@/lib/queries/announcements';

/**
 * Bandeau des annonces admin en tete du tableau de bord membre (0145,
 * tache #188), insere juste apres le bloc de salutation « Bonjour
 * {prenom} » dans `page.tsx`.
 *
 * Robustesse (convention §47) : ce composant ne recoit QUE la liste deja
 * chargee. Si la lecture a echoue cote serveur, l'appelant passe
 * simplement une liste vide — aucun etat d'erreur n'est rendu ici : une
 * annonce n'est pas un contenu critique, le tableau de bord continue de
 * fonctionner normalement (voir `DashboardPage`).
 *
 * Urgentes d'abord (deja triees par `get_active_dashboard_announcements`) :
 * le composant se contente d'afficher dans l'ordre recu.
 */
export function AnnouncementsBanner({
  announcements,
}: {
  announcements: readonly DashboardAnnouncement[];
}) {
  if (announcements.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {announcements.map((announcement) => (
        <Alert
          key={announcement.id}
          variant={announcement.severity === 'urgent' ? 'warning' : 'info'}
          title={
            announcement.severity === 'urgent'
              ? frAnnouncements.member.urgentPrefix
              : frAnnouncements.member.normalPrefix
          }
        >
          {announcement.body}
        </Alert>
      ))}
    </div>
  );
}
