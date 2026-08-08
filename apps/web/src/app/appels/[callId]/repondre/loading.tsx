import { FormSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frCalls } from '@/i18n/calls';

export default function RespondLoading() {
  return <FormSkeleton label={frCalls.common.loadMorePending} />;
}
