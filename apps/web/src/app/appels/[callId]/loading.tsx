import { DetailSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frCalls } from '@/i18n/calls';

/** ISE-048 — squelette calque sur la mise en page reelle (D-93). */
export default function CallDetailLoading() {
  return <DetailSkeleton label={frCalls.common.loadMorePending} />;
}
