import { Alert, ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import { loadJobFunctions, loadSectors } from '@/lib/queries/reference';
import { loadExpertiseAreaOptions, loadPositioning } from '@/lib/queries/profile-extras';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { PositioningForm } from './PositioningForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProfile.positioning.title };

/**
 * ISE-024 — Secteurs, fonctions & expertises.
 * Les trois referentiels (35 secteurs, 36 fonctions, 14 domaines) sont
 * lus en base : aucune liste n'est ecrite dans le code.
 */
export default async function PositioningPage() {
  const context = await requireProfile();

  const data = context.ok
    ? await Promise.all([
        loadSectors(context.correlationId),
        loadJobFunctions(context.correlationId),
        loadExpertiseAreaOptions(context.correlationId),
        loadPositioning(context.profile.id, context.correlationId),
      ])
    : null;

  return (
    <ProfilePage
      context={context}
      currentPath={PROFILE_ROUTES.positioning}
      title={frProfile.positioning.title}
      subtitle={frProfile.positioning.subtitle}
    >
      {data === null ? null : !data[0].ok || !data[1].ok || !data[2].ok || !data[3].ok ? (
        <ErrorState
          title={frProfile.common.loadErrorTitle}
          description={frProfile.common.loadErrorBody}
          correlationId={context.ok ? context.correlationId : ''}
        />
      ) : (
        <>
          <Alert variant="info" title={frProfile.positioning.dimensionsTitle}>
            {frProfile.positioning.dimensionsBody}
          </Alert>
          <PositioningForm
            sectors={data[0].data}
            jobFunctions={data[1].data}
            expertiseAreas={data[2].data}
            initial={data[3].data}
          />
        </>
      )}
    </ProfilePage>
  );
}
