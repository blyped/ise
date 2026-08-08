import { Card, Skeleton } from '@ise/ui-web';
import { fr } from '@/i18n/fr';

/**
 * Squelette calque sur la mise en page reelle du tableau de bord (D-93) :
 * jamais de page blanche, jamais de simple « Chargement… ».
 */
export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">{fr.common.loading}</span>

      <div className="flex flex-col gap-3">
        <Skeleton shape="line" className="h-[32px] w-[260px]" />
        <Skeleton shape="line" className="w-[340px]" />
      </div>

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-7">
          {[0, 1, 2].map((index) => (
            <Card key={index}>
              <Skeleton shape="line" className="mb-5 w-[200px]" />
              <Skeleton className="h-[96px] w-full" />
            </Card>
          ))}
        </div>
        <div className="flex flex-col gap-7">
          {[0, 1].map((index) => (
            <Card key={index}>
              <Skeleton shape="line" className="mb-5 w-[140px]" />
              <Skeleton className="h-[64px] w-full" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
