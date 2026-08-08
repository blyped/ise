import { ListSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frCalls } from '@/i18n/calls';

export default function MyCallsLoading() {
  return <ListSkeleton label={frCalls.common.loadMorePending} />;
}
