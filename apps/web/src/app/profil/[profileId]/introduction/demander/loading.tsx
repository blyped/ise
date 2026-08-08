import { DetailSkeleton } from '@/components/network/NetworkSkeletons';

/** ISE-044 — squelette calque sur la mise en page reelle (D-93). */
export default function AskIntroductionLoading() {
  return <DetailSkeleton asideCards={2} />;
}
