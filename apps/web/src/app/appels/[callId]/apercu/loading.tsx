import { DetailSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frCalls } from '@/i18n/calls';

export default function CallPreviewLoading() {
  return <DetailSkeleton label={frCalls.common.loadMorePending} />;
}
