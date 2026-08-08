import { DetailSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frOpportunities } from '@/i18n/opportunities';

/** ISE-056 — squelette calque sur la mise en page reelle (D-93). */
export default function OpportunityDetailLoading() {
  return <DetailSkeleton label={frOpportunities.common.loadMorePending} />;
}
