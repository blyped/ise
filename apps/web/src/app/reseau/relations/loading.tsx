import { ListSkeleton } from '@/components/network/NetworkSkeletons';

/** ISE-040 — squelette calque sur la mise en page reelle (D-93). */
export default function ConnectionsLoading() {
  return <ListSkeleton withStats />;
}
