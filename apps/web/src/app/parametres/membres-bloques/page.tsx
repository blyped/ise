import { redirect } from 'next/navigation';
import { Card, EmptyState, ErrorState } from '@ise/ui-web';
import { frSettings, ts } from '@/i18n/settings';
import { ROUTES } from '@/lib/routes';
import { SETTINGS_ROUTES } from '@/lib/routes/settings';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadBlockedProfiles } from '@/lib/queries/settings';
import { formatDate } from '@/lib/messaging-view';
import { SettingsShell } from '@/components/settings/SettingsShell';
import { UnblockButton } from '@/components/settings/UnblockButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: frSettings.blocked.title };

/** ISE-099 — « Membres bloqués » [34 §109], seul point de deblocage. */
export default async function BlockedMembersPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const [viewer, blocked] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadBlockedProfiles(correlationId),
  ]);

  return (
    <SettingsShell
      currentPath={SETTINGS_ROUTES.blocked}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
      title={frSettings.blocked.title}
      subtitle={frSettings.blocked.subtitle}
    >
      {!blocked.ok ? (
        <ErrorState
          title={frSettings.errorTitle}
          description={blocked.error.userMessage}
          correlationId={correlationId}
        />
      ) : blocked.data.length === 0 ? (
        <EmptyState
          title={frSettings.blocked.emptyTitle}
          description={frSettings.blocked.emptyBody}
        />
      ) : (
        <Card>
          <ul className="flex flex-col">
            {blocked.data.map((row) => (
              <li
                key={row.profileId}
                className="border-border flex flex-col gap-3 border-b py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-body-sm text-text-primary font-medium">
                    {row.displayName}
                  </span>
                  <span className="text-caption text-text-muted">
                    {ts(frSettings.blocked.blockedOn, { date: formatDate(row.blockedAt) })}
                  </span>
                </div>
                <UnblockButton profileId={row.profileId} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </SettingsShell>
  );
}
