import { CmsPanelSkeleton } from '../_components/CmsSkeletons';
import { frCms } from '@/i18n/cms';

/** Squelette calque sur la mise en page reelle de cet ecran (D-93). */
export default function Loading() {
  return <CmsPanelSkeleton label={frCms.featured.title} />;
}
