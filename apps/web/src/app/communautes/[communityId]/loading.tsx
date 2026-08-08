import { DetailSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frCommunities } from '@/i18n/communities';

/** ISE-085 — squelette calqué sur la mise en page réelle (D-93). */
export default function CommunityLoading() {
  return <DetailSkeleton label={frCommunities.common.breadcrumb} />;
}
