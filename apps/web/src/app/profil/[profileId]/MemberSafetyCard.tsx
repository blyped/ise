'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@ise/ui-web';
import { frMemberModeration } from '@/i18n/moderation-membre';
import { initialFormState } from '@/lib/form-state';
import { SETTINGS_ROUTES } from '@/lib/routes/settings';
import { reportRoute } from '@/lib/routes/support';
import { SensitiveActionDialog } from '@/components/system/SensitiveActionDialog';
import { blockProfileAction } from './actions';

const LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] ' +
  'bg-surface px-5 text-body-sm font-medium text-text-primary transition-colors duration-150 ' +
  'hover:border-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-active-blue';

/**
 * ISE-037 / ISE-100 — SIGNALER ou BLOQUER, depuis la fiche d'un membre.
 *
 * DEUX GESTES, JAMAIS CONFONDUS
 *   * SIGNALER alerte l'administration. Il passe par `create_report()`
 *     et l'ecran `/aide/signaler`, qui existent depuis 0016 et n'ont
 *     jamais bouge : on n'ouvre qu'un lien PRE-CIBLE vers eux, on ne
 *     recopie pas le formulaire ici.
 *   * BLOQUER est une mesure personnelle. Elle passe par
 *     `block_profile()` (0016), et l'ecran DIT ce qu'elle produit
 *     reellement — un blocage dont l'effet n'est pas explicite est un
 *     piege.
 *
 * POURQUOI IL N'Y A PAS DE BOUTON « DEBLOQUER » ICI
 *   `private.can_see_profile()` evalue le blocage avant toute
 *   visibilite, dans les deux sens. Si cette fiche s'affiche, c'est
 *   qu'aucun blocage n'existe entre les deux membres : proposer
 *   « Debloquer » serait proposer une action impossible. Le deblocage
 *   vit dans « Membres bloques » (ISE-099), et le dialogue le dit.
 */
export function MemberSafetyCard({
  profileId,
  displayName,
}: {
  profileId: string;
  displayName: string;
}) {
  const [state, formAction, isPending] = useActionState(blockProfileAction, initialFormState);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body-sm text-text-secondary">{frMemberModeration.safety.intro}</p>

      <div className="flex flex-col gap-2">
        <Link href={reportRoute('profile', profileId)} className={LINK}>
          {frMemberModeration.safety.reportAction}
        </Link>
        <p className="text-caption text-text-muted">{frMemberModeration.safety.reportHint}</p>
      </div>

      <SensitiveActionDialog
        triggerLabel={frMemberModeration.safety.blockAction}
        title={`${frMemberModeration.safety.blockTitle} — ${displayName}`}
        description={
          <>
            <p>{frMemberModeration.safety.blockDescription}</p>
            <div>
              <h4 className="text-body-sm text-text-primary font-semibold">
                {frMemberModeration.safety.blockEffectsTitle}
              </h4>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-6">
                {frMemberModeration.safety.blockEffects.map((effect) => (
                  <li key={effect} className="text-body-sm text-text-secondary">
                    {effect}
                  </li>
                ))}
              </ul>
            </div>
          </>
        }
        confirmLabel={frMemberModeration.safety.blockConfirm}
        confirmationPhrase={null}
        preservedTitle={frMemberModeration.safety.blockPreservedTitle}
        preservedItems={frMemberModeration.safety.blockPreserved}
        noticeTitle={frMemberModeration.safety.blockNoticeTitle}
        notice={frMemberModeration.safety.blockNotice}
        pending={isPending}
      >
        {() => (
          <form action={formAction}>
            <input type="hidden" name="profileId" value={profileId} />
            <Button
              type="submit"
              variant="danger"
              loading={isPending}
              loadingLabel={frMemberModeration.safety.blockConfirm}
            >
              {frMemberModeration.safety.blockConfirm}
            </Button>
          </form>
        )}
      </SensitiveActionDialog>

      {state.status === 'error' && state.message !== null ? (
        <p role="alert" className="text-caption text-error">
          {state.message}
          {state.correlationId !== null ? ` (${state.correlationId})` : ''}
        </p>
      ) : null}

      <Link
        href={SETTINGS_ROUTES.blocked}
        className="text-caption text-primary hover:text-primary-hover focus-visible:outline-active-blue inline-flex min-h-[44px] items-center font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {frMemberModeration.safety.blockedListLink}
      </Link>
    </div>
  );
}
