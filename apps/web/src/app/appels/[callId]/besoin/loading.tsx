import { FormSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frCalls } from '@/i18n/calls';

export default function EditNeedLoading() {
  return <FormSkeleton label={frCalls.common.loadMorePending} />;
}
