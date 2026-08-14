'use client';

import { frCms } from '@/i18n/cms';
import type { LandingQueueEntityType, LandingQueueSection } from '@/lib/cms/landing-queue';
import { CMS_INPUT_CLASS, CMS_TEXTAREA_CLASS, CmsField, CmsForm } from '../../_components/CmsForm';
import { addQueueEntryAction, setPassageDurationAction, setRotationAction } from './actions';

/** Un contenu proposable à la file : ce qu'il faut pour le choisir sans deviner. */
export interface QueueCandidate {
  id: string;
  label: string;
  /** Renseigné quand le contenu ne passerait PAS le filtre de la vitrine. */
  warning: string | null;
}

/**
 * Ajout d'un passage à la file d'un encart (0121).
 *
 * Le contenu se choisit dans une LISTE, jamais en recopiant un identifiant :
 * la programmation globale (CMS-009) demande un UUID parce qu'elle couvre
 * cinq tables, cet écran-ci n'en couvre qu'une par section.
 *
 * Laisser la date de début vide veut dire « à la suite » : la base place le
 * passage après le dernier de la file. C'est le geste courant — préparer
 * quatre articles d'affilée sans calculer soi-même les dates.
 */
export function QueueAddForm({
  entityType,
  candidates,
  canSchedule,
  sectionLabel,
}: {
  entityType: LandingQueueEntityType;
  candidates: readonly QueueCandidate[];
  canSchedule: boolean;
  sectionLabel: string;
}) {
  return (
    <details className="border-border rounded-lg border p-4">
      <summary className="text-body-sm text-primary min-h-[44px] cursor-pointer list-none font-medium">
        Ajouter un passage — {sectionLabel}
      </summary>
      <div className="mt-4">
        <CmsForm
          action={addQueueEntryAction}
          submitLabel="Ajouter à la file"
          disabled={!canSchedule}
          disabledReason={frCms.common.forbidden}
        >
          {(errors) => (
            <>
              <input type="hidden" name="entityType" value={entityType} />

              <CmsField
                name="entityId"
                label="Contenu à programmer"
                hint="Seuls les contenus existants sont proposés. Un contenu signalé « non diffusable » sera accepté dans la file, mais n’apparaîtra pas tant que son statut éditorial ne le permet pas."
                required
                error={errors['entityId']}
              >
                {(props) => (
                  <select {...props} defaultValue="" className={CMS_INPUT_CLASS}>
                    <option value="" disabled>
                      {candidates.length === 0 ? 'Aucun contenu disponible' : '—'}
                    </option>
                    {candidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.warning === null
                          ? candidate.label
                          : `${candidate.label} — ${candidate.warning}`}
                      </option>
                    ))}
                  </select>
                )}
              </CmsField>

              <div className="grid gap-5 lg:grid-cols-2">
                <CmsField
                  name="startsAt"
                  label="Date de passage"
                  hint="Laissez vide pour placer ce contenu à la suite du dernier passage de la file."
                  error={errors['startsAt']}
                >
                  {(props) => (
                    <input {...props} type="datetime-local" className={CMS_INPUT_CLASS} />
                  )}
                </CmsField>
                <CmsField
                  name="endsAt"
                  label="Fin du passage (facultatif)"
                  hint="Sans date de fin, le passage dure jusqu’à ce que le suivant prenne le relais."
                  error={errors['endsAt']}
                >
                  {(props) => (
                    <input {...props} type="datetime-local" className={CMS_INPUT_CLASS} />
                  )}
                </CmsField>
              </div>

              <CmsField name="reason" label="Motif (facultatif)" error={errors['reason']}>
                {(props) => <textarea {...props} rows={2} className={CMS_TEXTAREA_CLASS} />}
              </CmsField>
            </>
          )}
        </CmsForm>
      </div>
    </details>
  );
}

/**
 * Durée d'un passage ajouté « à la suite » (0124).
 *
 * Ce réglage existait déjà, mais sous la forme d'une constante de sept jours
 * écrite au milieu d'une fonction SQL : c'était elle, et non l'administrateur,
 * qui fixait le rythme de l'encart. Elle est désormais lisible et modifiable,
 * encart par encart.
 *
 * Changer la durée NE DÉPLACE PAS les passages déjà programmés : leurs dates
 * ont été préparées, les recalculer derrière l'administrateur reviendrait à
 * bouger un calendrier qu'il croyait figé.
 */
export function PassageDurationForm({
  sectionKey,
  days,
  canSchedule,
  sectionLabel,
}: {
  sectionKey: LandingQueueSection;
  days: number;
  canSchedule: boolean;
  sectionLabel: string;
}) {
  return (
    <CmsForm
      action={setPassageDurationAction}
      submitLabel={frCms.common.save}
      disabled={!canSchedule}
      disabledReason={frCms.common.forbidden}
    >
      {(errors) => (
        <>
          <input type="hidden" name="sectionKey" value={sectionKey} />
          <CmsField
            name="passageDays"
            label={`Durée d’un passage sans date de fin — ${sectionLabel} (en jours)`}
            hint="S’applique aux passages ajoutés « à la suite », sans date saisie. Les passages déjà programmés gardent leurs dates."
            error={errors['passageDays']}
          >
            {(props) => (
              <input
                {...props}
                type="number"
                min={1}
                max={90}
                defaultValue={days}
                className={CMS_INPUT_CLASS}
              />
            )}
          </CmsField>
        </>
      )}
    </CmsForm>
  );
}

/**
 * Fréquence de rotation de l'ISE du jour (0121).
 *
 * L'encart « ISE du jour » ne prend PAS de file : le système choisit
 * lui-même, chaque matin, parmi les profils éligibles. Le seul réglage
 * utile est donc l'ESPACEMENT entre deux rotations.
 */
export function RotationForm({
  intervalDays,
  canManage,
}: {
  intervalDays: number;
  canManage: boolean;
}) {
  return (
    <CmsForm
      action={setRotationAction}
      submitLabel={frCms.common.save}
      disabled={!canManage}
      disabledReason={frCms.common.forbidden}
    >
      {(errors) => (
        <CmsField
          name="intervalDays"
          label="Changer d’ISE du jour tous les… (en jours)"
          hint="1 = un nouvel ISE chaque jour. 7 = un nouvel ISE par semaine. Entre deux rotations, le profil déjà sélectionné reste affiché."
          error={errors['intervalDays']}
        >
          {(props) => (
            <input
              {...props}
              type="number"
              min={1}
              max={90}
              defaultValue={intervalDays}
              className={CMS_INPUT_CLASS}
            />
          )}
        </CmsField>
      )}
    </CmsForm>
  );
}
