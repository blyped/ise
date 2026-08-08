import { frContent } from '@/i18n/content';
import { cancelRegistrationAction } from '@/app/evenements/actions';
import { ActionForm } from './ActionForm';

/** Annuler son inscription. Ne touche jamais `attended` (D-55). */
export function CancelRegistrationForm({ eventId }: { eventId: string }) {
  return (
    <ActionForm
      action={cancelRegistrationAction}
      hidden={{ eventId }}
      label={frContent.eventDetail.cancelRegistration}
      submitLabel={frContent.eventDetail.cancelRegistration}
      pendingLabel={frContent.eventDetail.cancelPending}
      variant="secondary"
      className="flex flex-col gap-2"
    />
  );
}
