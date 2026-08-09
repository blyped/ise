import { ListSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frMentorship } from '@/i18n/mentorship';

/** ISE-082 (réponses) — squelette calqué sur la mise en page réelle (D-93). */
export default function MentorshipRequestsLoading() {
  return <ListSkeleton label={frMentorship.common.loadingLabel} />;
}
