import { CmsListSkeleton } from '../../_components/CmsSkeletons';

/** Squelette calque sur la mise en page reelle de cet ecran (D-93). */
export default function Loading() {
  return <CmsListSkeleton label="Programmation « À la une du réseau »" rows={6} />;
}
