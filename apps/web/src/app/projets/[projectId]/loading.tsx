import { DetailSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frProjects } from '@/i18n/projects';

/** ISE-089 — squelette calqué sur la mise en page réelle (D-93). */
export default function ProjectLoading() {
  return <DetailSkeleton label={frProjects.common.breadcrumb} />;
}
