import { Card, Skeleton } from '@ise/ui-web';
import { frSearch } from '@/i18n/search';

/**
 * Squelette CALQUE sur la mise en page reelle d'ISE-035 (D-93) :
 * meme grille (rail de criteres + colonne de resultats), meme structure
 * de carte a trois zones. Jamais de page blanche, jamais un simple
 * « Chargement… ».
 */
export default function ResultsLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">{frSearch.common.loading}</span>

      <Skeleton shape="line" className="w-[240px]" />

      <div className="flex flex-col gap-3">
        <Skeleton shape="line" className="h-[32px] w-[300px]" />
        <Skeleton shape="line" className="w-[440px] max-w-full" />
      </div>

      <div className="grid gap-7 xl:grid-cols-[300px_minmax(0,1fr)] xl:items-start">
        <Card>
          <Skeleton shape="line" className="mb-4 w-[160px]" />
          <div className="flex flex-wrap gap-2 xl:flex-col xl:items-start">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-[36px] w-[150px] rounded-full" />
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <Skeleton shape="line" className="w-[180px]" />
          {[0, 1, 2, 3].map((index) => (
            <Card key={index} padding="sm">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto] lg:gap-7">
                <div className="flex gap-4">
                  <Skeleton shape="circle" className="h-[48px] w-[48px]" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton shape="line" className="w-[160px]" />
                    <Skeleton shape="line" className="w-[200px]" />
                    <Skeleton shape="line" className="w-[240px]" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Skeleton shape="line" className="w-[120px]" />
                  <Skeleton shape="line" className="w-[190px]" />
                  <Skeleton shape="line" className="w-[170px]" />
                </div>
                <Skeleton className="h-[44px] w-full lg:w-[168px]" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
