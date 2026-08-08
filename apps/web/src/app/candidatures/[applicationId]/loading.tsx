import { DetailSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frOpportunities } from '@/i18n/opportunities';

/** ISE-064 — squelette calque sur la mise en page reelle (D-93). */
export default function ApplicationDetailLoading() {
  return <DetailSkeleton label={frOpportunities.common.loadMorePending} />;
}
