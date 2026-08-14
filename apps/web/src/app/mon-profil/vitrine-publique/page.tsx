import Link from 'next/link';
import { Alert, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { frShowcase } from '@/i18n/profile-showcase';
import { ROUTES } from '@/lib/routes';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import { loadPublicShowcase } from '@/lib/queries/public-showcase';
import { LANDING_MEDIA_BUCKET, landingMediaUrl } from '@/lib/public/landing-data';
import { AppShell } from '@/components/layout/AppShell';
import { PublicShowcaseForm } from './PublicShowcaseForm';
import { PublicPhotoForm } from './PublicPhotoForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frShowcase.title };

const LINK_CLASS =
  'text-body-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * Ma vitrine publique — brève description et consentements « ISE du jour ».
 *
 * RÉVISION DE D-135 (migration 0120). Deux consentements distincts :
 * la parution comme « ISE du jour » (texte) d'une part, la publication d'un
 * portrait sur le site public d'autre part. Le second n'est pas déduit du
 * premier : c'était précisément le reproche de D-135.
 *
 * Rappel que l'écran assume : la fiche profil complète est réservée aux
 * membres connectés, mais l'encart d'accueil, lui, est public. Le
 * consentement porte donc sur une exposition réellement anonyme.
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

  // L'URL n'est construite que si le portrait est réellement consenti et
  // décrit : la même règle que la projection SQL, pour ne jamais afficher
  // ici une image que la vitrine ne montrerait pas.
  const photoUrl =
    showcase.ok && showcase.data.allowPublicPhoto && showcase.data.photoPath !== null
      ? landingMediaUrl({
          bucket: LANDING_MEDIA_BUCKET,
          path: showcase.data.photoPath,
          alt: showcase.data.photoAlt ?? '',
          credit: null,
          width: showcase.data.photoWidth,
          height: showcase.data.photoHeight,
        })
      : null;

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
          <>
            <PublicShowcaseForm showcase={showcase.data} />
            <PublicPhotoForm showcase={showcase.data} photoUrl={photoUrl} />
          </>
        )}
      </div>
    </AppShell>
  );
}
