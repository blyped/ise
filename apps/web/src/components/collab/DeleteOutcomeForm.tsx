import { frContent } from '@/i18n/content';
import { deleteOutcomeAction } from '@/app/evenements/actions';
import { ActionForm } from './ActionForm';

/** Retirer une suite déclarée par erreur. Elle n'appartient qu'à son auteur. */
export function DeleteOutcomeForm({ eventId, outcomeId }: { eventId: string; outcomeId: string }) {
  return (
    <ActionForm
      action={deleteOutcomeAction}
      hidden={{ eventId, outcomeId }}
      label={`${frContent.followup.remove} — ${outcomeId}`}
      submitLabel={frContent.followup.remove}
      pendingLabel={frContent.followup.removePending}
      variant="secondary"
      className="flex flex-col gap-2"
    />
  );
}
