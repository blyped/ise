import { Card, Skeleton } from '@ise/ui-web';

/**
 * Squelettes CALQUES sur les mises en page reelles des tranches
 * APPELS AU RESEAU et OPPORTUNITES (D-93).
 *
 * Ils reprennent la structure exacte des ecrans — bandeau, onglets,
 * filtres, cartes, rail lateral — pour qu'aucun element ne saute a
 * l'arrivee des donnees. Un squelette generique serait pire qu'aucun.
 */

export function ListSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">{label}</span>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton shape="line" className="h-[32px] w-[280px] max-w-full" />
          <Skeleton shape="line" className="w-[440px] max-w-full" />
        </div>
        <Skeleton className="rounded-base h-[44px] w-[180px] max-lg:w-full" />
      </div>

      <div className="border-border flex gap-5 border-b pb-3">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} shape="line" className="w-[90px]" />
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Skeleton className="rounded-base h-[44px] flex-1" />
        <Skeleton className="rounded-base h-[44px] w-[130px]" />
      </div>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <ul className="flex flex-col gap-5">
          {[0, 1, 2].map((index) => (
            <li key={index}>
              <Card>
                <Skeleton shape="line" className="w-[110px]" />
                <Skeleton shape="line" className="mt-3 h-[22px] w-[70%]" />
                <Skeleton shape="line" className="mt-3 w-full" />
                <Skeleton shape="line" className="mt-2 w-[80%]" />
                <div className="border-border mt-5 flex items-center gap-3 border-t pt-4">
                  <Skeleton shape="circle" className="h-10 w-10" />
                  <Skeleton shape="line" className="w-[180px]" />
                  <Skeleton className="rounded-base ml-auto h-[44px] w-[130px]" />
                </div>
              </Card>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-7">
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

export function DetailSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">{label}</span>

      <Skeleton shape="line" className="w-[220px]" />

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex flex-col gap-7">
          <Card>
            <Skeleton shape="line" className="w-[120px]" />
            <Skeleton shape="line" className="mt-3 h-[30px] w-[80%]" />
            <div className="mt-5 flex items-center gap-4">
              <Skeleton shape="circle" className="h-12 w-12" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton shape="line" className="w-[180px]" />
                <Skeleton shape="line" className="w-[220px]" />
              </div>
            </div>
          </Card>

          {[0, 1].map((index) => (
            <Card key={index}>
              <Skeleton shape="line" className="mb-4 w-[140px]" />
              <Skeleton shape="line" className="w-full" />
              <Skeleton shape="line" className="mt-2 w-full" />
              <Skeleton shape="line" className="mt-2 w-[60%]" />
            </Card>
          ))}
        </div>

        <div className="flex flex-col gap-7">
          {[0, 1, 2].map((index) => (
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

export function FormSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">{label}</span>
      <Skeleton shape="line" className="h-[32px] w-[320px] max-w-full" />
      <Skeleton className="h-[10px] w-full rounded-full" />
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <Card>
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="mb-6 flex flex-col gap-2">
              <Skeleton shape="line" className="w-[160px]" />
              <Skeleton className="rounded-base h-[44px] w-full" />
            </div>
          ))}
          <Skeleton className="rounded-base h-[44px] w-[200px]" />
        </Card>
        <Card>
          <Skeleton shape="line" className="mb-4 w-[160px]" />
          <Skeleton shape="line" className="w-full" />
          <Skeleton shape="line" className="mt-2 w-[70%]" />
        </Card>
      </div>
    </div>
  );
}
