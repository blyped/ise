import { Card, Skeleton } from '@ise/ui-web';
import { frNetwork } from '@/i18n/network';

/**
 * Squelette CALQUE sur la mise en page reelle d'ISE-038 (D-93) : meme
 * grille (colonne principale + rail lateral), meme carte de profil, meme
 * bloc de motifs. Jamais de page blanche, jamais un « Chargement… » nu.
 */
export default function ConnectLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-8">
      <span className="sr-only">{frNetwork.common.loading}</span>

      <Skeleton shape="line" className="w-[180px]" />
      <div className="flex flex-col gap-3">
        <Skeleton shape="line" className="h-[32px] w-[320px] max-w-full" />
        <Skeleton shape="line" className="w-[480px] max-w-full" />
      </div>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex flex-col gap-7">
          <Card>
            <div className="flex gap-5">
              <Skeleton shape="circle" className="h-16 w-16" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton shape="line" className="w-[200px]" />
                <Skeleton shape="line" className="w-[260px]" />
                <Skeleton shape="line" className="w-[160px]" />
              </div>
            </div>
          </Card>

          <div className="flex flex-col gap-4">
            <Skeleton shape="line" className="w-[280px]" />
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="rounded-base h-[64px] w-full" />
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <Skeleton shape="line" className="w-[160px]" />
            <Skeleton className="rounded-base h-[140px] w-full" />
          </div>

          <div className="flex justify-end gap-3">
            <Skeleton className="rounded-base h-[48px] w-[120px]" />
            <Skeleton className="rounded-base h-[48px] w-[200px]" />
          </div>
        </div>

        <div className="flex flex-col gap-7 max-xl:order-first">
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
