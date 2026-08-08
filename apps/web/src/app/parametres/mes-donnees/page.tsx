import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Card, CardDescription, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frSettings, ts } from '@/i18n/settings';
import { ROUTES } from '@/lib/routes';
import { SETTINGS_ROUTES } from '@/lib/routes/settings';
import { SUPPORT_ROUTES } from '@/lib/routes/support';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadConsents } from '@/lib/queries/settings';
import { formatDate } from '@/lib/messaging-view';
import { SettingsShell } from '@/components/settings/SettingsShell';
import { ConsentControls } from '@/components/settings/ConsentControls';
import { DeleteAccountSection } from '@/components/settings/DeleteAccountSection';

export const dynamic = 'force-dynamic';
export const metadata = { title: frSettings.data.title };

const LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * Version de reference utilisee lorsqu'aucune trace n'existe encore.
 * Aucun registre de documents contractuels n'est en base : on ne
 * fabrique donc pas un numero de version plus precis que celui-la.
 */
const FALLBACK_CONSENT_VERSION = '1.0';

/**
 * Consentements REVOCABLES depuis cet ecran. Les CGU et la politique de
 * confidentialite ne sont pas revocables en libre-service : les retirer
 * reviendrait a resilier le service, ce que fait « Supprimer mon compte ».
 */
const OPTIONAL_CONSENTS = ['marketing_communication', 'testimonial_use', 'public_profile'] as const;

const ALL_CONSENTS = [
  'terms_of_service',
  'privacy_policy',
  'data_processing',
  ...OPTIONAL_CONSENTS,
] as const;

/**
 * SYS-009 — confidentialite et consentement : acces, rectification,
 * export, suppression, revocation.
 *
 * L'EXPORT n'est pas implemente. Aucun bouton d'export n'est rendu :
 * un bouton qui ne produirait aucun fichier serait un bouton decoratif
 * (§113). Le texte le dit et oriente vers l'assistance, qui existe.
 */
export default async function MyDataPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const [viewer, consents] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadConsents(correlationId),
  ]);

  const byType = new Map(
    consents.ok ? consents.data.consents.map((row) => [row.consentType, row]) : [],
  );

  return (
    <SettingsShell
      currentPath={SETTINGS_ROUTES.data}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
      title={frSettings.data.title}
      subtitle={frSettings.data.subtitle}
    >
      <Card>
        <CardHeader>
          <CardTitle as="h2">{frSettings.data.accessTitle}</CardTitle>
          <CardDescription>{frSettings.data.accessBody}</CardDescription>
        </CardHeader>
        <div className="flex flex-wrap gap-3">
          <Link href={PROFILE_ROUTES.overview} className={LINK}>
            {frSettings.data.accessLink}
          </Link>
          <Link href={SETTINGS_ROUTES.privacy} className={LINK}>
            {frSettings.sections.privacy}
          </Link>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frSettings.data.exportTitle}</CardTitle>
        </CardHeader>
        <Alert variant="warning" title={frSettings.data.exportBody} />
        <p className="mt-4">
          <Link href={SUPPORT_ROUTES.newTicket} className={LINK}>
            {frSettings.data.exportAction}
          </Link>
        </p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frSettings.data.consentsTitle}</CardTitle>
          <CardDescription>{frSettings.data.consentsBody}</CardDescription>
        </CardHeader>

        {!consents.ok ? (
          <ErrorState
            title={frSettings.errorTitle}
            description={consents.error.userMessage}
            correlationId={correlationId}
          />
        ) : (
          <>
            <div className="flex flex-col">
              {ALL_CONSENTS.map((consentType) => (
                <ConsentControls
                  key={consentType}
                  consentType={consentType}
                  current={byType.get(consentType) ?? null}
                  fallbackVersion={FALLBACK_CONSENT_VERSION}
                  optional={(OPTIONAL_CONSENTS as readonly string[]).includes(consentType)}
                />
              ))}
            </div>

            <div className="border-border mt-6 flex flex-col gap-2 border-t pt-5">
              <h3 className="text-body text-text-primary font-semibold">
                {frSettings.data.termsTitle}
              </h3>
              {consents.data.terms.length === 0 ? (
                <p className="text-body-sm text-text-muted">{frSettings.data.termsNone}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {consents.data.terms.map((row) => (
                    <li key={row.documentType} className="text-body-sm text-text-secondary">
                      <span className="text-text-primary font-medium">
                        {frSettings.data.documentType[row.documentType] ?? row.documentType}
                      </span>{' '}
                      —{' '}
                      {ts(frSettings.data.acceptedOn, {
                        version: row.version,
                        date: formatDate(row.acceptedAt),
                      })}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frSettings.data.deleteTitle}</CardTitle>
        </CardHeader>
        <DeleteAccountSection />
      </Card>
    </SettingsShell>
  );
}
