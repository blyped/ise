import { FormSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frMentorship } from '@/i18n/mentorship';

/** ISE-082 — squelette calqué sur la mise en page réelle (D-93). */
export default function MentorshipRequestLoading() {
  return <FormSkeleton label={frMentorship.common.loadingLabel} />;
}
