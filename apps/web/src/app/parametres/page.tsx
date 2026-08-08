import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Card, CardDescription, CardHeader, CardTitle } from '@ise/ui-web';
import { frSettings } from '@/i18n/settings';
import { ROUTES } from '@/lib/routes';
import { SETTINGS_ROUTES } from '@/lib/routes/settings';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadMemberSettings } from '@/lib/queries/settings';
import { SettingsShell } from '@/components/settings/SettingsShell';

export const dynamic = 'force-dynamic';
export const metadata = { title: frSettings.title };

const SECTIONS = [
  {
    href: SETTINGS_ROUTES.privacy,
    title: frSettings.sections.privacy,
    body: frSettings.sections.privacyBody,
  },
  {
    href: SETTINGS_ROUTES.notifications,
    title: frSettings.sections.notifications,
    body: frSettings.sections.notificationsBody,
  },
  {
    href: SETTINGS_ROUTES.account,
    title: frSettings.sections.account,
    body: frSettings.sections.accountBody,
  },
  {
    href: SETTINGS_ROUTES.blocked,
    title: frSettings.sections.blocked,
    body: frSettings.sections.blockedBody,
  },
  {
    href: SETTINGS_ROUTES.data,
    title: frSettings.sections.data,
    body: frSettings.sections.dataBody,
  },
] as const;

/** ISE-099 — sommaire des parametres. */
export default async function SettingsOverviewPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const [viewer, settings] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadMemberSettings(correlationId),
  ]);

  return (
    <SettingsShell
      currentPath={SETTINGS_ROUTES.overview}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
      title={frSettings.title}
      subtitle={frSettings.subtitle}
    >
      {settings.ok && settings.data.isPaused ? (
        <Alert variant="warning" title="Votre profil est en pause.">
          Il n’est plus proposé dans le matching. Vos données et vos échanges sont conservés.
        </Alert>
      ) : null}

      <ul className="grid gap-5 md:grid-cols-2">
        {SECTIONS.map((section) => (
          <li key={section.href}>
            <Card>
              <CardHeader>
                <CardTitle as="h2">
                  <Link
                    href={section.href}
                    className="focus-visible:outline-active-blue underline decoration-transparent hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {section.title}
                  </Link>
                </CardTitle>
                <CardDescription>{section.body}</CardDescription>
              </CardHeader>
            </Card>
          </li>
        ))}
      </ul>
    </SettingsShell>
  );
}
