'use client';

import { useActionState, useId } from 'react';
import { Button } from '@ise/ui-web';
import { frAdminCommunities } from '@/i18n/admin-communities';
import { initialFormState } from '@/lib/form-state';
import type { AdminAction } from '../_components/ActionButton';

const COMMUNITY_TYPES = ['thematic', 'special', 'country', 'sector'] as const;
const VISIBILITIES = ['network', 'private'] as const;
const JOIN_POLICIES = ['open', 'request', 'invitation'] as const;
const POST_MODERATION_MODES = ['immediate', 'pre_approval'] as const;
const INITIAL_STATUSES = ['active', 'draft'] as const;

const FIELD =
  'rounded-base border-border bg-surface text-body-sm text-text-primary placeholder:text-text-muted ' +
  'focus-visible:outline-active-blue h-[44px] border px-4 focus-visible:outline-2 focus-visible:outline-offset-2';

const TEXTAREA =
  'rounded-base border-border bg-surface text-body-sm text-text-primary focus-visible:outline-active-blue ' +
  'min-h-[88px] border px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * SA-027 — Creation administrative d'une communaute. Communautes
 * curatees : 0072 reserve explicitement la creation a l'administration
 * en V1 (aucun membre ne peut en creer). `admin_create_community`
 * (0099) accepte un statut initial 'draft' ou 'active' seulement — les
 * statuts 'inactive'/'archived'/'merged' ne s'atteignent qu'apres
 * creation, via le cycle de vie (fiche communaute).
 */
export function CommunityForm({ action }: { action: AdminAction }) {
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const base = useId();

  const fieldError = (key: string): string | null => {
    const message = state.fieldErrors[key];
    return typeof message === 'string' && message.length > 0 ? message : null;
  };

  return (
    <form action={formAction} className="flex max-w-[640px] flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-name`} className="text-body-sm text-text-primary font-medium">
          {frAdminCommunities.form.name}
        </label>
        <input id={`${base}-name`} name="name" type="text" required minLength={3} className={FIELD} />
        {fieldError('name') !== null ? (
          <p role="alert" className="text-caption text-error">
            {fieldError('name')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-slug`} className="text-body-sm text-text-primary font-medium">
          {frAdminCommunities.form.slug}
        </label>
        <input
          id={`${base}-slug`}
          name="slug"
          type="text"
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          aria-describedby={`${base}-slug-aide`}
          className={FIELD}
        />
        <p id={`${base}-slug-aide`} className="text-caption text-text-muted">
          {frAdminCommunities.form.slugHelp}
        </p>
        {fieldError('slug') !== null ? (
          <p role="alert" className="text-caption text-error">
            {fieldError('slug')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-description`} className="text-body-sm text-text-primary font-medium">
          {frAdminCommunities.form.description}
        </label>
        <textarea id={`${base}-description`} name="description" rows={2} required className={TEXTAREA} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-purpose`} className="text-body-sm text-text-primary font-medium">
          {frAdminCommunities.form.purpose}
        </label>
        <textarea
          id={`${base}-purpose`}
          name="purpose"
          rows={2}
          aria-describedby={`${base}-purpose-aide`}
          className={TEXTAREA}
        />
        <p id={`${base}-purpose-aide`} className="text-caption text-text-muted">
          {frAdminCommunities.form.purposeHelp}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-charter`} className="text-body-sm text-text-primary font-medium">
          {frAdminCommunities.form.charterText}
        </label>
        <textarea id={`${base}-charter`} name="charterText" rows={3} className={TEXTAREA} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${base}-type`} className="text-body-sm text-text-primary font-medium">
          {frAdminCommunities.form.communityType}
        </label>
        <select id={`${base}-type`} name="communityType" defaultValue="thematic" className={FIELD}>
          {COMMUNITY_TYPES.map((value) => (
            <option key={value} value={value}>
              {frAdminCommunities.communityType[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-country`} className="text-body-sm text-text-primary font-medium">
            {frAdminCommunities.form.countryCode}
          </label>
          <input id={`${base}-country`} name="countryCode" type="text" maxLength={2} className={`${FIELD} w-[140px] uppercase`} />
          <p className="text-caption text-text-muted">{frAdminCommunities.form.countryCodeHelp}</p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-sector`} className="text-body-sm text-text-primary font-medium">
            {frAdminCommunities.form.sectorId}
          </label>
          <input id={`${base}-sector`} name="sectorId" type="number" min={1} className={`${FIELD} w-[160px]`} />
          <p className="text-caption text-text-muted">{frAdminCommunities.form.sectorIdHelp}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-visibility`} className="text-body-sm text-text-primary font-medium">
            {frAdminCommunities.form.visibility}
          </label>
          <select id={`${base}-visibility`} name="visibility" defaultValue="network" className={`${FIELD} w-[180px]`}>
            {VISIBILITIES.map((value) => (
              <option key={value} value={value}>
                {frAdminCommunities.visibility[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-join`} className="text-body-sm text-text-primary font-medium">
            {frAdminCommunities.form.joinPolicy}
          </label>
          <select id={`${base}-join`} name="joinPolicy" defaultValue="open" className={`${FIELD} w-[220px]`}>
            {JOIN_POLICIES.map((value) => (
              <option key={value} value={value}>
                {frAdminCommunities.joinPolicy[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-mod`} className="text-body-sm text-text-primary font-medium">
            {frAdminCommunities.form.postModerationMode}
          </label>
          <select id={`${base}-mod`} name="postModerationMode" defaultValue="immediate" className={`${FIELD} w-[220px]`}>
            {POST_MODERATION_MODES.map((value) => (
              <option key={value} value={value}>
                {frAdminCommunities.postModerationMode[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${base}-status`} className="text-body-sm text-text-primary font-medium">
            {frAdminCommunities.form.initialStatus}
          </label>
          <select id={`${base}-status`} name="initialStatus" defaultValue="active" className={`${FIELD} w-[180px]`}>
            {INITIAL_STATUSES.map((value) => (
              <option key={value} value={value}>
                {frAdminCommunities.status[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Button type="submit" variant="primary" loading={isPending} loadingLabel="Enregistrement…">
          {frAdminCommunities.form.submitCreate}
        </Button>
      </div>

      {state.status !== 'idle' && state.message !== null ? (
        <p
          role={state.status === 'error' ? 'alert' : 'status'}
          className={`text-body-sm ${state.status === 'error' ? 'text-error' : 'text-text-secondary'}`}
        >
          {state.message}
          {state.correlationId !== null ? ` (${state.correlationId})` : ''}
        </p>
      ) : null}
    </form>
  );
}
