import { ListSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frOpportunities } from '@/i18n/opportunities';

export default function SavedOpportunitiesLoading() {
  return <ListSkeleton label={frOpportunities.common.loadMorePending} />;
}
