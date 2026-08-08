import { DetailSkeleton } from '@/components/network/NetworkSkeletons';

/** ISE-046 — squelette calque sur la mise en page reelle (D-93). */
export default function IntroductionOutcomeLoading() {
  return <DetailSkeleton asideCards={2} />;
}
