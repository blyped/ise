import { DetailSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frContent } from '@/i18n/content';

/** ISE-095 — squelette calqué sur la mise en page réelle (D-93). */
export default function EventDetailLoading() {
  return <DetailSkeleton label={frContent.events.breadcrumb} />;
}
