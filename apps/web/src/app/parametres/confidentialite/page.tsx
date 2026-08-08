import { redirect } from 'next/navigation';
import { Alert, Card, ErrorState } from '@ise/ui-web';
import { frSettings } from '@/i18n/settings';
import { ROUTES } from '@/lib/routes';
import { SETTINGS_ROUTES } from '@/lib/routes/settings';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadFieldVisibility } from '@/lib/queries/settings';
import { SettingsShell } from '@/components/settings/SettingsShell';
import { FieldVisibilityForm } from '@/components/settings/FieldVisibilityForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frSettings.privacy.title };

/**
 * ISE-099 — visibilite par champ (D-73, D-74).
 *
 * Les 4 niveaux et les champs viennent du referentiel
 * `profile_visibility_defaults` : ni la liste des champs ni celle des
 * niveaux n'est ecrite en dur ici.
 */
export default async function PrivacySettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const [viewer, fields] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadFieldVisibility(correlationId),
  ]);

  return (
    <SettingsShell
      currentPath={SETTINGS_ROUTES.privacy}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
      title={frSettings.privacy.title}
      subtitle={frSettings.privacy.subtitle}
    >
      <Alert variant="info" title={frSettings.privacy.serverEnforced}>
        {frSettings.privacy.noPublicLevel}
      </Alert>

      {!fields.ok ? (
        <ErrorState
          title={frSettings.errorTitle}
          description={fields.error.userMessage}
          correlationId={correlationId}
        />
      ) : (
        <Card>
          <div className="flex flex-col">
            {fields.data.map((row) => (
              <FieldVisibilityForm key={row.fieldKey} row={row} />
            ))}
          </div>
        </Card>
      )}
    </SettingsShell>
  );
}
