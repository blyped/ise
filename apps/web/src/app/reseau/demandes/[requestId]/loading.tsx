import { DetailSkeleton } from '@/components/network/NetworkSkeletons';

/** ISE-039 — squelette calque sur la mise en page reelle (D-93). */
export default function SentRequestLoading() {
  return <DetailSkeleton asideCards={2} />;
}
