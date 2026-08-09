import { Skeleton } from '@ise/ui-web';

/** Squelette calque sur la mise en page reelle (D-93). */
export default function ProjectsLoading() {
  return (
    <div className="flex flex-col gap-7 p-8" aria-busy="true">
      <Skeleton className="h-9 w-2/5" />
      <Skeleton className="h-5 w-3/5" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
