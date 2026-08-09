import { ListSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frInternships } from '@/i18n/internships';

/** ISE-076 — squelette calqué sur la mise en page réelle (D-93). */
export default function InternshipApplicationsLoading() {
  return <ListSkeleton label={frInternships.common.loadingLabel} />;
}
