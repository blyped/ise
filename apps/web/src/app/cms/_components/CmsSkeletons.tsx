import { Skeleton } from '@ise/ui-web';

/**
 * Squelettes CALQUES sur la mise en page reelle (D-93).
 *
 * Ils reproduisent le nombre de blocs, leurs hauteurs et leur grille : un
 * squelette qui ne ressemble pas a l'ecran final produit un saut de mise
 * en page a l'arrivee des donnees, ce qui est pire que rien.
 */

function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-[34px] w-[280px]" />
      <Skeleton className="h-[20px] w-[420px] max-w-full" />
    </div>
  );
}

/** Squelette des ecrans en liste : CMS-002, CMS-003, CMS-005, CMS-007, CMS-009. */
export function CmsListSkeleton({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <div className="flex flex-col gap-8 px-7 py-8 max-md:px-4 max-md:py-5" aria-busy="true">
      <span className="sr-only" role="status">
        {label}
      </span>
      <HeaderSkeleton />
      <Skeleton className="h-[44px] w-full" />
      <div className="flex flex-col gap-4">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-[92px] w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/** Squelette du tableau de bord CMS-001 : 4 indicateurs, 8 cartes. */
export function CmsDashboardSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-8 px-7 py-8 max-md:px-4 max-md:py-5" aria-busy="true">
      <span className="sr-only" role="status">
        {label}
      </span>
      <HeaderSkeleton />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[92px] w-full rounded-lg" />
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-[124px] w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[110px] w-full rounded-lg" />
    </div>
  );
}

/** Squelette des ecrans de detail et de formulaire. */
export function CmsPanelSkeleton({ label, blocks = 3 }: { label: string; blocks?: number }) {
  return (
    <div className="flex flex-col gap-8 px-7 py-8 max-md:px-4 max-md:py-5" aria-busy="true">
      <span className="sr-only" role="status">
        {label}
      </span>
      <HeaderSkeleton />
      {Array.from({ length: blocks }, (_, index) => (
        <Skeleton key={index} className="h-[180px] w-full rounded-lg" />
      ))}
    </div>
  );
}

/** Squelette de la mediatheque CMS-008 : grille de vignettes. */
export function CmsGridSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-8 px-7 py-8 max-md:px-4 max-md:py-5" aria-busy="true">
      <span className="sr-only" role="status">
        {label}
      </span>
      <HeaderSkeleton />
      <Skeleton className="h-[44px] w-full" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-[220px] w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
