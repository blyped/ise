import { DetailSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frOpportunities } from '@/i18n/opportunities';

export default function OpportunityTrackingLoading() {
  return <DetailSkeleton label={frOpportunities.common.loadMorePending} />;
}
