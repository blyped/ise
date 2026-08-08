import { ListSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frContent } from '@/i18n/content';

/** ISE-094 — squelette calqué sur la mise en page réelle (D-93). */
export default function EventsLoading() {
  return <ListSkeleton label={frContent.events.title} />;
}
