import { DetailSkeleton } from '@/components/network/NetworkSkeletons';

/** ISE-045 — squelette calque sur la mise en page reelle (D-93). */
export default function IntroductionFollowLoading() {
  return <DetailSkeleton asideCards={3} />;
}
