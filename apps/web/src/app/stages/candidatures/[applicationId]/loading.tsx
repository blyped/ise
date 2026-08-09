import { DetailSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frInternships } from '@/i18n/internships';

/** ISE-076 — squelette calqué sur la mise en page réelle (D-93). */
export default function InternshipApplicationLoading() {
  return <DetailSkeleton label={frInternships.common.loadingLabel} />;
}
