import { ListSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frContent } from '@/i18n/content';

/** ISE-092 — squelette calqué sur la mise en page réelle (D-93). */
export default function NewsLoading() {
  return <ListSkeleton label={frContent.news.title} />;
}
