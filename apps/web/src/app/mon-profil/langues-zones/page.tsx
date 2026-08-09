import { ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import { loadCountries } from '@/lib/queries/reference';
import {
  loadLanguageOptions,
  loadProfileGeographies,
  loadProfileLanguages,
  loadProfileTools,
  loadToolOptions,
} from '@/lib/queries/profile-extras';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { LanguagesZonesForm } from './LanguagesZonesForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProfile.languagesZones.title };

/**
 * ISE-027 — Langues, zones d'experience et outils.
 * Referentiels reels : langues actives, 249 pays, 44 outils. La section
 * « Outils » repond aux suggestions d'ISE-030 / ISE-031 (« Ajouter vos
 * outils principaux ») : chaque manque doit pointer vers un ecran
 * d'edition reel.
 */
export default async function LanguagesZonesPage() {
  const context = await requireProfile();

  const data = context.ok
    ? await Promise.all([
        loadLanguageOptions(context.correlationId),
        loadCountries(context.correlationId),
        loadToolOptions(context.correlationId),
        loadProfileLanguages(context.profile.id, context.correlationId),
        loadProfileGeographies(context.profile.id, context.correlationId),
        loadProfileTools(context.profile.id, context.correlationId),
      ])
    : null;

  const failed = data !== null && data.some((result) => !result.ok);

  return (
    <ProfilePage
      context={context}
      currentPath={PROFILE_ROUTES.languagesZones}
      title={frProfile.languagesZones.title}
      subtitle={frProfile.languagesZones.subtitle}
    >
      {data === null ? null : failed ? (
        <ErrorState
          title={frProfile.common.loadErrorTitle}
          description={frProfile.common.loadErrorBody}
          correlationId={context.ok ? context.correlationId : ''}
        />
      ) : (
        <LanguagesZonesForm
          languageOptions={data[0].ok ? data[0].data : []}
          countryOptions={data[1].ok ? data[1].data : []}
          toolOptions={data[2].ok ? data[2].data : []}
          initialLanguages={data[3].ok ? data[3].data : []}
          initialGeographies={data[4].ok ? data[4].data : []}
          initialTools={data[5].ok ? data[5].data : []}
        />
      )}
    </ProfilePage>
  );
}
