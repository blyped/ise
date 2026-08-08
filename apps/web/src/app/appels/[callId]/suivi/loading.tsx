import { DetailSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frCalls } from '@/i18n/calls';

export default function CallTrackingLoading() {
  return <DetailSkeleton label={frCalls.common.loadMorePending} />;
}
