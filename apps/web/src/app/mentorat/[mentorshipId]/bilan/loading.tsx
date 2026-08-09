import { FormSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frMentorship } from '@/i18n/mentorship';

/** ISE-083 (bilan) — squelette calqué sur la mise en page réelle (D-93). */
export default function MentorshipReviewLoading() {
  return <FormSkeleton label={frMentorship.common.loadingLabel} />;
}
