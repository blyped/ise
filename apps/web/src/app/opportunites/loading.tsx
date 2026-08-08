import { ListSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frOpportunities } from '@/i18n/opportunities';

/** ISE-055 — squelette calque sur la mise en page reelle (D-93). */
export default function OpportunitiesLoading() {
  return <ListSkeleton label={frOpportunities.common.loadMorePending} />;
}
