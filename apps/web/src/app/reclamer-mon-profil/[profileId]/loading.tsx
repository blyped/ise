import { Card, Skeleton } from '@ise/ui-web';
import { fr } from '@/i18n/fr';

/** Squelette calque sur la mise en page reelle d'ISE-006 (D-93). */
export default function ClaimConfirmLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">{fr.common.loading}</span>

      <Card>
        <Skeleton shape="line" className="h-[28px] w-[240px]" />
        <Skeleton shape="line" className="mt-3 w-[380px]" />

        <div className="border-border mt-7 rounded-lg border p-5">
          <Skeleton shape="line" className="w-[160px]" />
          <Skeleton shape="line" className="mt-3 w-[200px]" />
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-[62px] w-full" />
          ))}
        </div>

        <Skeleton className="mt-7 h-[48px] w-full" />
      </Card>
    </div>
  );
}
