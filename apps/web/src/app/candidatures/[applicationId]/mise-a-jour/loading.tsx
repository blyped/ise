import { FormSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frOpportunities } from '@/i18n/opportunities';

export default function ApplicationStepLoading() {
  return <FormSkeleton label={frOpportunities.common.loadMorePending} />;
}
