import { DetailSkeleton } from '@/components/network/NetworkSkeletons';

/** ISE-042 — squelette calque sur la mise en page reelle (D-93). */
export default function InvitationDetailLoading() {
  return <DetailSkeleton asideCards={2} />;
}
