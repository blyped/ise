import { ListSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frCommunities } from '@/i18n/communities';

/** ISE-084 — squelette calqué sur la mise en page réelle (D-93). */
export default function CommunitiesLoading() {
  return <ListSkeleton label={frCommunities.list.title} />;
}
