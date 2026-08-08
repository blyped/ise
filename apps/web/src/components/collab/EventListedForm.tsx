import { frContent } from '@/i18n/content';
import { setListedAction } from '@/app/evenements/actions';
import { ActionForm } from './ActionForm';

/**
 * Apparaître ou non dans la liste des participants.
 * Un inscrit qui se retire de la liste n'apparaît nulle part — y compris
 * pour les autres inscrits (docs/rls.md §10.7).
 */
export function EventListedForm({ eventId, listed }: { eventId: string; listed: boolean }) {
  const label = listed
    ? 'Ne plus apparaître dans la liste des participants'
    : frContent.eventDetail.listedLabel;

  return (
    <ActionForm
      action={setListedAction}
      hidden={{ eventId, listed: listed ? 'false' : 'true' }}
      label={label}
      submitLabel={label}
      pendingLabel="Enregistrement…"
      variant="secondary"
      className="flex flex-col gap-2"
    >
      <p className="text-caption text-text-muted">{frContent.eventDetail.listedHelp}</p>
    </ActionForm>
  );
}
