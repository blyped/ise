import { ListSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frCalls } from '@/i18n/calls';

/** ISE-047 — squelette calque sur la mise en page reelle (D-93). */
export default function CallsLoading() {
  return <ListSkeleton label={frCalls.common.loadMorePending} />;
}
