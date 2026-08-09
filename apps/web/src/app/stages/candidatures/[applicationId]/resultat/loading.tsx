import { FormSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frInternships } from '@/i18n/internships';

/** ISE-077 — squelette calqué sur la mise en page réelle (D-93). */
export default function InternshipResultLoading() {
  return <FormSkeleton label={frInternships.common.loadingLabel} />;
}
