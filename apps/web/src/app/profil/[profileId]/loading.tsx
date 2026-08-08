import { Card, Skeleton } from '@ise/ui-web';
import { frSearch } from '@/i18n/search';

/**
 * Squelette CALQUE sur la mise en page reelle d'ISE-037 (D-93) :
 * bandeau d'en-tete, colonne principale (a propos / competences /
 * parcours) et colonne laterale. Jamais de page blanche.
 */
export default function MemberProfileLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">{frSearch.common.loading}</span>

      <Skeleton shape="line" className="w-[160px]" />

      <div className="bg-surface-muted rounded-lg px-7 py-8 max-md:px-5">
        <div className="flex flex-col items-center gap-5 lg:flex-row lg:items-start lg:gap-7">
          <Skeleton shape="circle" className="h-[96px] w-[96px]" />
          <div className="flex w-full flex-col gap-3">
            <Skeleton shape="line" className="h-[32px] w-[260px]" />
            <Skeleton shape="line" className="w-[200px]" />
            <Skeleton shape="line" className="w-[340px] max-w-full" />
          </div>
        </div>
      </div>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex flex-col gap-7">
          {[0, 1, 2].map((index) => (
            <Card key={index}>
              <Skeleton shape="line" className="mb-5 w-[180px]" />
              <Skeleton className="h-[110px] w-full" />
            </Card>
          ))}
        </div>
        <div className="flex flex-col gap-7">
          {[0, 1, 2].map((index) => (
            <Card key={index}>
              <Skeleton shape="line" className="mb-5 w-[150px]" />
              <Skeleton className="h-[72px] w-full" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
