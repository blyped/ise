import { DetailSkeleton } from '@/components/network/NetworkSkeletons';

/** ISE-043 — squelette calque sur la mise en page reelle (D-93). */
export default function IntroductionPathsLoading() {
  return <DetailSkeleton asideCards={3} />;
}
