import { Card, Skeleton } from '@ise/ui-web';
import { frNetwork } from '@/i18n/network';

/**
 * Squelettes CALQUES sur les mises en page reelles de la tranche (D-93).
 *
 * Deux gabarits suffisent parce que les neuf ecrans n'en utilisent que
 * deux : « detail » (colonne principale + rail lateral) et « liste »
 * (bandeau + filtres + cartes). Un squelette generique flottant au
 * milieu de la page serait pire qu'aucun squelette : il ferait sauter la
 * mise en page a l'arrivee des donnees.
 */

export function DetailSkeleton({ asideCards = 2 }: { asideCards?: number }) {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">{frNetwork.common.loading}</span>

      <Skeleton shape="line" className="w-[180px]" />
      <div className="flex flex-col gap-3">
        <Skeleton shape="line" className="h-[32px] w-[340px] max-w-full" />
        <Skeleton shape="line" className="w-[520px] max-w-full" />
      </div>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex flex-col gap-7">
          <Card>
            <div className="flex gap-4">
              <Skeleton shape="circle" className="h-14 w-14" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton shape="line" className="w-[200px]" />
                <Skeleton shape="line" className="w-[260px]" />
                <Skeleton shape="line" className="w-[160px]" />
              </div>
            </div>
            <div className="border-border mt-6 flex flex-col gap-3 border-t pt-5">
              <Skeleton shape="line" className="w-[70%]" />
              <Skeleton className="rounded-base h-[80px] w-full" />
            </div>
          </Card>

          <Card>
            <Skeleton shape="line" className="mb-5 w-[160px]" />
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="mb-4 flex items-center gap-4">
                <Skeleton shape="circle" className="h-3 w-3" />
                <Skeleton shape="line" className="w-[240px] max-w-full" />
              </div>
            ))}
          </Card>
        </div>

        <div className="flex flex-col gap-7">
          {Array.from({ length: asideCards }, (_, index) => (
            <Card key={index}>
              <Skeleton shape="line" className="mb-4 w-[160px]" />
              <Skeleton shape="line" className="w-full" />
              <Skeleton shape="line" className="mt-2 w-[70%]" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ListSkeleton({ withStats = false }: { withStats?: boolean }) {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">{frNetwork.common.loading}</span>

      <div className="flex flex-col gap-3">
        <Skeleton shape="line" className="h-[32px] w-[280px] max-w-full" />
        <Skeleton shape="line" className="w-[520px] max-w-full" />
      </div>

      {withStats ? (
        <Card>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="flex flex-col gap-2">
                <Skeleton shape="line" className="h-[28px] w-[60px]" />
                <Skeleton shape="line" className="w-[140px]" />
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="flex flex-col gap-5">
          <Skeleton className="rounded-base h-[44px] w-full" />
          {[0, 1, 2, 3].map((index) => (
            <Card key={index} padding="sm">
              <div className="flex gap-4">
                <Skeleton shape="circle" className="h-12 w-12" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton shape="line" className="w-[180px]" />
                  <Skeleton shape="line" className="w-[240px]" />
                  <Skeleton shape="line" className="w-[140px]" />
                </div>
                <Skeleton className="rounded-base h-[44px] w-[120px] max-md:hidden" />
              </div>
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-7 max-xl:hidden">
          {[0, 1].map((index) => (
            <Card key={index}>
              <Skeleton shape="line" className="mb-4 w-[160px]" />
              <Skeleton shape="line" className="w-full" />
              <Skeleton shape="line" className="mt-2 w-[70%]" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
