import { ListSkeleton } from '@/components/tranche/TrancheSkeletons';
import { frProjects } from '@/i18n/projects';

/** ISE-088 — squelette calqué sur la mise en page réelle (D-93). */
export default function ProjectsLoading() {
  return <ListSkeleton label={frProjects.list.title} />;
}
