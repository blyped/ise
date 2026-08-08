import { frContent } from '@/i18n/content';
import { declareOutcomeAction } from '@/app/evenements/actions';
import { ActionForm } from './ActionForm';
import { FIELD, SELECT } from './styles';

/**
 * ISE-096 — déclarer une suite constatée après un événement (D-55).
 *
 * Rien n'est déduit de la présence : seule cette déclaration compte, et
 * elle reste strictement personnelle (politiques `event_outcomes_*_own`,
 * migration 0074).
 */
export function DeclareOutcomeForm({
  eventId,
  attendees,
}: {
  eventId: string;
  attendees: { id: string; name: string }[];
}) {
  return (
    <ActionForm
      action={declareOutcomeAction}
      hidden={{ eventId }}
      label={frContent.followup.declareTitle}
      submitLabel={frContent.followup.declareSubmit}
      pendingLabel={frContent.followup.declarePending}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="suite-type" className="text-body-sm text-text-primary font-medium">
          {frContent.followup.declareType}
        </label>
        <select id="suite-type" name="outcomeType" defaultValue="connection" className={SELECT}>
          {Object.entries(frContent.followup.outcomeType).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {attendees.length === 0 ? null : (
        <div className="flex flex-col gap-1">
          <label htmlFor="suite-personne" className="text-body-sm text-text-primary font-medium">
            {frContent.followup.outcomeType.connection} — {frContent.common.optional}
          </label>
          <select id="suite-personne" name="targetProfileId" defaultValue="" className={SELECT}>
            <option value="">—</option>
            {attendees.map((attendee) => (
              <option key={attendee.id} value={attendee.id}>
                {attendee.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="suite-note" className="text-body-sm text-text-primary font-medium">
          {frContent.followup.declareNotes}
        </label>
        <input
          id="suite-note"
          name="notes"
          type="text"
          required
          minLength={3}
          maxLength={500}
          placeholder={frContent.followup.declareNotesPlaceholder}
          className={FIELD}
        />
      </div>
    </ActionForm>
  );
}
