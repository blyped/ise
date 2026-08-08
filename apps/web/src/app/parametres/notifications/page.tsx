import { redirect } from 'next/navigation';
import { Alert, Badge, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frSettings } from '@/i18n/settings';
import { frNotifications } from '@/i18n/notifications';
import { ROUTES } from '@/lib/routes';
import { SETTINGS_ROUTES } from '@/lib/routes/settings';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadMemberSettings, loadNotificationPreferences } from '@/lib/queries/settings';
import { SettingsShell } from '@/components/settings/SettingsShell';
import { NotificationPreferenceForm } from '@/components/settings/NotificationPreferenceForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frSettings.notifications.title };

/**
 * ISE-099 — preferences de notification par TYPE (D-80).
 *
 * Les 33 types viennent du catalogue `notification_types` seede en 0015.
 * Ils sont regroupes par categorie a l'affichage : la matrice complete
 * canal x type serait illisible a 375 px [34 §99-100].
 */
export default async function NotificationSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const [viewer, preferences, settings] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadNotificationPreferences(correlationId),
    loadMemberSettings(correlationId),
  ]);

  const grouped = preferences.ok
    ? preferences.data.reduce<Record<string, typeof preferences.data>>((accumulator, row) => {
        const bucket = accumulator[row.category] ?? [];
        bucket.push(row);
        accumulator[row.category] = bucket;
        return accumulator;
      }, {})
    : {};

  return (
    <SettingsShell
      currentPath={SETTINGS_ROUTES.notifications}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
      title={frSettings.notifications.title}
      subtitle={frSettings.notifications.subtitle}
    >
      <Alert variant="warning" title={frSettings.notifications.deliveryNotice} />

      {settings.ok ? (
        <p className="text-body-sm text-text-secondary">
          {frSettings.notifications.presetLabel} :{' '}
          <Badge tone="neutral">
            {frSettings.notifications.preset[settings.data.notificationPreset] ??
              settings.data.notificationPreset}
          </Badge>
        </p>
      ) : null}

      {!preferences.ok ? (
        <ErrorState
          title={frSettings.errorTitle}
          description={preferences.error.userMessage}
          correlationId={correlationId}
        />
      ) : (
        Object.entries(grouped).map(([category, rows]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle as="h2">{frNotifications.category[category] ?? category}</CardTitle>
            </CardHeader>
            <div className="flex flex-col">
              {rows.map((row) => (
                <NotificationPreferenceForm key={row.typeCode} row={row} />
              ))}
            </div>
          </Card>
        ))
      )}
    </SettingsShell>
  );
}
