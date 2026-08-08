import { ListSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frOpportunities } from '@/i18n/opportunities';

/** ISE-063 — squelette calque sur la mise en page reelle (D-93). */
export default function ApplicationsLoading() {
  return <ListSkeleton label={frOpportunities.common.loadMorePending} />;
}
