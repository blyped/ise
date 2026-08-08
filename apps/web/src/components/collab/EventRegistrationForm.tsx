import { frContent } from '@/i18n/content';
import { registerAction } from '@/app/evenements/actions';
import { ActionForm } from './ActionForm';
import { FIELD } from './styles';

/**
 * Inscription en un clic (DIGEST D 6.8, U 75). Les questions de
 * l'organisateur restent facultatives et peu nombreuses : le profil
 * porte déjà l'identité, un formulaire long serait redondant.
 */
export function EventRegistrationForm({
  eventId,
  questions,
}: {
  eventId: string;
  questions: { id: string; label: string; required: boolean }[];
}) {
  return (
    <ActionForm
      action={registerAction}
      hidden={{ eventId }}
      label={frContent.eventDetail.registerNow}
      submitLabel={frContent.eventDetail.registerNow}
      pendingLabel={frContent.events.registerPending}
    >
      {questions.length === 0 ? null : (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-body-sm text-text-primary font-medium">
            {frContent.eventDetail.questionsTitle}
          </legend>
          {questions.map((question) => (
            <div key={question.id} className="flex flex-col gap-1">
              <label
                htmlFor={`question-${question.id}`}
                className="text-caption text-text-secondary"
              >
                {question.label}
                {question.required ? '' : ` — ${frContent.common.optional}`}
              </label>
              <input
                id={`question-${question.id}`}
                name={`question:${question.id}`}
                type="text"
                required={question.required}
                maxLength={500}
                className={FIELD}
              />
            </div>
          ))}
        </fieldset>
      )}
    </ActionForm>
  );
}
