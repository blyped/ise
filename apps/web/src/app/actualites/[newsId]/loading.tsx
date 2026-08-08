import { DetailSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frContent } from '@/i18n/content';

/** ISE-093 — squelette calqué sur la mise en page réelle (D-93). */
export default function NewsDetailLoading() {
  return <DetailSkeleton label={frContent.news.breadcrumb} />;
}
