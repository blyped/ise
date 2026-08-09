import { DetailSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frMentorship } from '@/i18n/mentorship';

/** ISE-081 — squelette calqué sur la mise en page réelle (D-93). */
export default function MentorProfileLoading() {
  return <DetailSkeleton label={frMentorship.common.loadingLabel} />;
}
