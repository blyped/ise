import { Skeleton } from '@ise/ui-web';

/**
 * Squelettes de chargement calques sur la mise en page reelle (D-93) :
 * en-tete + rangees de liste. Jamais de page blanche.
 */
export function AdminListSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-hidden="true">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-[320px]" />
        <Skeleton className="h-4 w-[440px] max-w-full" />
      </div>
      <div className="flex flex-col gap-4">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-[84px] w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
