import { Skeleton } from '@ise/ui-web';

/** Squelette calque sur la mise en page reelle (D-93). */
export default function PositioningLoading() {
  return (
    <div className="flex flex-col gap-7 p-8" aria-busy="true">
      <Skeleton className="h-9 w-2/5" />
      <Skeleton className="h-5 w-3/5" />
      <Skeleton className="h-16 w-full" />
      <div className="grid gap-7 lg:grid-cols-3">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}
