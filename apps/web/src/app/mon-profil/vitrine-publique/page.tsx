import Link from 'next/link';
import { Alert, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { frShowcase } from '@/i18n/profile-showcase';
import { ROUTES } from '@/lib/routes';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import { loadPublicShowcase } from '@/lib/queries/public-showcase';
import { AppShell } from '@/components/layout/AppShell';
import { PublicShowcaseForm } from './PublicShowcaseForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frShowcase.title };

const LINK_CLASS =
  'text-body-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * Ma vitrine publique — brève description et consentement « ISE du jour ».
 *
 * RÉVISION DE D-135 (migration 0120), puis D-211 (14/08/2026) : le dépôt de
 * la photo et son consentement de publication (`allowPublicPhoto`) ont
 * quitté cet écran. Demande du porteur : « la photo que l'ISE mettra pour
 * son profil, c'est elle qui sera affichée devant pour l'accueil » — un
 * dépôt UNIQUE, plutôt que deux photos distinctes. Ce dépôt vit désormais
 * sur « Photo de profil » (mon-profil/en-tete), avec deux blocs de cadrage
 * (médaillon + rectangle « ISE du jour ») réglés en un seul geste.
 *
 * Ce qui reste ici porte sur le TEXTE, indépendant de la photo depuis
 * toujours (D-135) : la brève description et le consentement à paraître
 * comme « ISE du jour ».
 */
export default async function PublicShowcasePage() {
  const context = await requireProfile();

  if (!context.ok) {
    return (
      <AppShell
        currentPath={PROFILE_ROUTES.publicShowcase}
        displayName={frShowcase.title}
      >
        {context.noProfile ? (
          <Alert
            variant="info"
            title={frProfile.overview.noProfileTitle}
            action={
              <Link href={ROUTES.claimSearch} className={LINK_CLASS}>
                {frProfile.overview.noProfileAction}
              </Link>
            }
          >
            {frProfile.overview.noProfileBody}
          </Alert>
        ) : (
          <ErrorState
            title={frProfile.common.loadErrorTitle}
            description={context.message}
            correlationId={context.correlationId}
          />
        )}
      </AppShell>
    );
  }

  const { profile, correlationId } = context;
  const showcase = await loadPublicShowcase(profile.id, correlationId);
  const displayName = profile.displayName ?? `${profile.firstName} ${profile.lastName}`.trim();

  return (
    <AppShell currentPath={PROFILE_ROUTES.publicShowcase} displayName={displayName}>
      <div className="flex flex-col gap-7">
        <header className="flex flex-col gap-2">
          <h1 className="text-h1 text-text-primary font-bold">
            {frShowcase.title}
          </h1>
          <p className="text-body text-text-secondary">{frShowcase.subtitle}</p>
        </header>

        <Alert variant="info" title={frShowcase.contextTitle}>
          {frShowcase.contextBody}
        </Alert>

        {/* Renvoi vers « Photo de profil » — révision D-211 : la photo et
            son consentement de publication vivent désormais là-bas, pas ici. */}
        <Alert
          variant="info"
          title={frShowcase.photoPointerTitle}
          action={
            <Link href={PROFILE_ROUTES.header} className={LINK_CLASS}>
              {frShowcase.photoPointerLink}
            </Link>
          }
        >
          {frShowcase.photoPointerHint}
        </Alert>

        {!showcase.ok ? (
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frProfile.common.loadErrorTitle}</CardTitle>
            </CardHeader>
            <ErrorState
              title={frProfile.common.loadErrorTitle}
              description={showcase.error.userMessage}
              correlationId={correlationId}
            />
          </Card>
        ) : (
          <PublicShowcaseForm showcase={showcase.data} />
        )}
      </div>
    </AppShell>
  );
}
