'use client';

import Link from 'next/link';
import { Button } from '@ise/ui-web';
import { frOnboarding } from '@/i18n/onboarding';

export interface StepActionsProps {
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
  /** Chemin de l'etape precedente. Absent a l'etape 1. */
  backHref?: string | undefined;
  /**
   * `true` lorsque l'etape est explicitement passable (maquettes ISE-011,
   * ISE-012, ISE-013). Le bouton poste `intention=skip` : la position est
   * quand meme enregistree en base, l'etape est marquee « passee ».
   */
  skippable?: boolean;
}

const LINK_CLASS =
  'inline-flex min-h-[44px] items-center text-body-sm font-medium text-text-secondary ' +
  'hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/** Barre d'actions commune aux 7 etapes. */
export function StepActions({
  submitLabel,
  pendingLabel,
  isPending,
  backHref,
  skippable = false,
}: StepActionsProps) {
  return (
    <div className="border-border flex flex-wrap items-center gap-5 border-t pt-6">
      <Button type="submit" size="lg" loading={isPending} loadingLabel={pendingLabel}>
        {submitLabel}
      </Button>

      {backHref ? (
        <Link href={backHref} className={LINK_CLASS}>
          ← {frOnboarding.shell.back}
        </Link>
      ) : null}

      {skippable ? (
        <button
          type="submit"
          name="intention"
          value="skip"
          disabled={isPending}
          className={`${LINK_CLASS} ml-auto disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {frOnboarding.shell.skip}
        </button>
      ) : null}
    </div>
  );
}
