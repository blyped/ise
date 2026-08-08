import { redirect } from 'next/navigation';
import { Card, ErrorState } from '@ise/ui-web';
import { frSettings } from '@/i18n/settings';
import { ROUTES } from '@/lib/routes';
import { SETTINGS_ROUTES } from '@/lib/routes/settings';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadMemberSettings } from '@/lib/queries/settings';
import { SettingsShell } from '@/components/settings/SettingsShell';
import { AccountSettingsForm } from '@/components/settings/AccountSettingsForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frSettings.account.title };

/** ISE-099 — compte et sollicitations. */
export default async function AccountSettingsPage() {
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
      currentPath={SETTINGS_ROUTES.account}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
      title={frSettings.account.title}
      subtitle={frSettings.sections.accountBody}
    >
      {!settings.ok ? (
        <ErrorState
          title={frSettings.errorTitle}
          description={settings.error.userMessage}
          correlationId={correlationId}
        />
      ) : (
        <Card>
          <AccountSettingsForm settings={settings.data} />
        </Card>
      )}
    </SettingsShell>
  );
}
