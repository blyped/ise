import { FormSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frMentorship } from '@/i18n/mentorship';

/** « Devenir mentor » — squelette calqué sur la mise en page réelle (D-93). */
export default function BecomeMentorLoading() {
  return <FormSkeleton label={frMentorship.common.loadingLabel} />;
}
