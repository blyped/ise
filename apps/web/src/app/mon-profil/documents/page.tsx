import Link from 'next/link';
import { Alert, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { frDocuments } from '@/i18n/profile-documents';
import { ROUTES } from '@/lib/routes';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import { loadMyProfileDocuments } from '@/lib/queries/profile-documents';
import { AppShell } from '@/components/layout/AppShell';
import { DocumentsList } from './DocumentsList';
import { DocumentUploadForm } from './DocumentUploadForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frDocuments.title };

const LINK_CLASS =
  'text-body-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * Mes documents — dépôt de CV et de pièces de profil (migration 0127).
 *
 * Le backend existait depuis 0008 / 0027 / 0041 (table, bucket privé,
 * RLS) mais aucune écriture n'était exposée : la table était vide et
 * l'écran de candidature annonçait que le dépôt « n'était pas encore
 * ouvert ». C'est cet écran qui l'ouvre.
 *
 * Le bucket est PRIVÉ : chaque téléchargement passe par une URL signée de
 * cinq minutes, fabriquée au rendu. Aucune adresse permanente n'existe.
 */
export default async function MyDocumentsPage() {
  const context = await requireProfile();

  if (!context.ok) {
    return (
      <AppShell currentPath={PROFILE_ROUTES.documents} displayName={frDocuments.title}>
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
  const documents = await loadMyProfileDocuments(correlationId);
  const displayName = profile.displayName ?? `${profile.firstName} ${profile.lastName}`.trim();

  return (
    <AppShell currentPath={PROFILE_ROUTES.documents} displayName={displayName}>
      <div className="flex flex-col gap-7">
        <header className="flex flex-col gap-2">
          <h1 className="text-h1 text-text-primary font-bold">{frDocuments.title}</h1>
          <p className="text-body text-text-secondary">{frDocuments.subtitle}</p>
        </header>

        <Alert variant="info" title={frDocuments.contextTitle}>
          {frDocuments.contextBody}
        </Alert>

        {/* Dit sans détour qu'aucun antivirus n'analyse les fichiers : il
            n'en existe aucun dans ce déploiement. Annoncer un contrôle
            inexistant serait une capacité simulée. */}
        <Alert variant="warning" title={frDocuments.noScanTitle}>
          {frDocuments.noScanBody}
        </Alert>

        {!documents.ok ? (
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frProfile.common.loadErrorTitle}</CardTitle>
            </CardHeader>
            <ErrorState
              title={frProfile.common.loadErrorTitle}
              description={documents.error.userMessage}
              correlationId={correlationId}
            />
          </Card>
        ) : (
          <DocumentsList documents={documents.data} />
        )}

        <DocumentUploadForm />
      </div>
    </AppShell>
  );
}
