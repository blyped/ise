import Link from 'next/link';
import { ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { AVAILABILITY_ROUTES } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import { loadAvailabilityTypes } from '@/lib/queries/reference';
import { loadAvailabilityDetails } from '@/lib/queries/profile-extras';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { AvailabilityForm } from './AvailabilityForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProfile.availabilityForm.title };

const LINK_CLASS =
  'text-body-sm font-medium text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/** ISE-033 — Modifier ma disponibilite. */
export default async function EditAvailabilityPage() {
  const context = await requireProfile();

  const data = context.ok
    ? await Promise.all([
        loadAvailabilityTypes(context.correlationId),
        loadAvailabilityDetails(context.profile.id, context.correlationId),
      ])
    : null;

  return (
    <ProfilePage
      context={context}
      currentPath={AVAILABILITY_ROUTES.overview}
      title={frProfile.availabilityForm.title}
      subtitle={frProfile.availabilityForm.subtitle}
      action={
        <Link href={AVAILABILITY_ROUTES.overview} className={LINK_CLASS}>
          ← {frProfile.availabilityForm.backLink}
        </Link>
      }
    >
      {data === null ? null : !data[0].ok || !data[1].ok ? (
        <ErrorState
          title={frProfile.common.loadErrorTitle}
          description={frProfile.common.loadErrorBody}
          correlationId={context.ok ? context.correlationId : ''}
        />
      ) : (
        <AvailabilityForm types={data[0].data} details={data[1].data} />
      )}
    </ProfilePage>
  );
}
