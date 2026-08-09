import { ListSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frMentorship } from '@/i18n/mentorship';

/** ISE-078 — squelette calqué sur la mise en page réelle (D-93). */
export default function MentorshipHomeLoading() {
  return <ListSkeleton label={frMentorship.common.loadingLabel} />;
}
