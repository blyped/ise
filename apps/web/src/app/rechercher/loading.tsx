import { Card, Skeleton } from '@ise/ui-web';
import { frSearch } from '@/i18n/search';

/**
 * Squelette CALQUE sur la mise en page reelle d'ISE-034 (D-93) :
 * fil d'Ariane, titre, bloc de recherche libre, grille de criteres,
 * colonne des recherches enregistrees. Jamais de page blanche.
 */
export default function FindLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">{frSearch.common.loading}</span>

      <Skeleton shape="line" className="w-[180px]" />

      <div className="flex flex-col gap-3">
        <Skeleton shape="line" className="h-[32px] w-[240px]" />
        <Skeleton shape="line" className="w-[420px] max-w-full" />
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="flex flex-col gap-7">
          <Card>
            <Skeleton shape="line" className="w-[280px]" />
            <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end">
              <Skeleton className="h-[44px] w-full" />
              <Skeleton className="h-[48px] w-full lg:w-[160px]" />
            </div>
          </Card>

          <Card>
            <Skeleton shape="line" className="w-[200px]" />
            <div className="mt-6 grid gap-7 lg:grid-cols-2">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
                <div key={index} className="flex flex-col gap-3">
                  <Skeleton shape="line" className="w-[120px]" />
                  <Skeleton className="h-[44px] w-full" />
                  <Skeleton className="h-[120px] w-full" />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card>
          <Skeleton shape="line" className="mb-5 w-[190px]" />
          {[0, 1, 2].map((index) => (
            <div key={index} className="mb-4 flex flex-col gap-2">
              <Skeleton shape="line" className="w-[180px]" />
              <Skeleton shape="line" className="w-[110px]" />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
