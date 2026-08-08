import { Card, Skeleton } from '@ise/ui-web';
import { fr } from '@/i18n/fr';

/**
 * Squelette calque sur la mise en page reelle d'ISE-005 (D-93) :
 * jamais de page blanche, jamais de simple « Chargement… ».
 */
export default function ClaimLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">{fr.common.loading}</span>

      <Card>
        <Skeleton shape="line" className="h-[28px] w-[280px]" />
        <Skeleton shape="line" className="mt-3 w-[360px]" />

        <div className="mt-7 flex flex-col gap-5">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton shape="line" className="w-[110px]" />
              <Skeleton className="h-[44px] w-full" />
            </div>
          ))}
          <Skeleton className="h-[48px] w-full" />
        </div>
      </Card>
    </div>
  );
}
