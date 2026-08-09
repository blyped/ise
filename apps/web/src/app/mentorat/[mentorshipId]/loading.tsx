import { DetailSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frMentorship } from '@/i18n/mentorship';

/** ISE-083 — squelette calqué sur la mise en page réelle (D-93). */
export default function MentorshipDetailLoading() {
  return <DetailSkeleton label={frMentorship.common.loadingLabel} />;
}
