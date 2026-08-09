import { FormSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frMentorship } from '@/i18n/mentorship';

/** ISE-079 — squelette calqué sur la mise en page réelle (D-93). */
export default function MentorshipNeedLoading() {
  return <FormSkeleton label={frMentorship.common.loadingLabel} />;
}
