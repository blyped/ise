import { Alert, Badge, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frAdminData } from '@/i18n/admin-data';
import { newCorrelationId } from '@/lib/correlation';
import {
  loadFeatureFlags,
  loadMaintenanceWindows,
  loadPlatformSettings,
  loadSettingsHistory,
} from '@/lib/admin-data/queries';
import type { MaintenanceWindowItem } from '@/lib/admin-data/view';
import { AdminPageHeader } from '../_components/AdminPageHeader';
import { MaintenanceForm, MaintenanceTransitions } from './MaintenanceForms';
import { FlagForm, SettingForm } from './SettingsForms';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminData.settings.title };

const t = frAdminData.settings;

function formatDateTime(iso: string | null): string {
  if (iso === null) return frAdminData.common.none;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return frAdminData.common.none;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function isActiveNow(window: MaintenanceWindowItem): boolean {
  if (window.status === 'in_progress') return true;
  if (window.status !== 'scheduled' || window.startsAt === null || window.endsAt === null) {
    return false;
  }
  const now = Date.now();
  return new Date(window.startsAt).getTime() <= now && now < new Date(window.endsAt).getTime();
}

const DISCLOSURE =
  'text-body-sm text-primary cursor-pointer font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * SA-048 — Paramètres plateforme, feature flags et maintenance planifiée.
 * Toute écriture passe par les fonctions 0082 / 0084 : motif exigé,
 * ancienne et nouvelle valeur journalisées. Aucun secret ici (D-100).
 */
export default async function AdminSettingsPage() {
  const correlationId = newCorrelationId();
  const [settings, flags, windows, history] = await Promise.all([
    loadPlatformSettings(correlationId),
    loadFeatureFlags(correlationId),
    loadMaintenanceWindows(correlationId),
    loadSettingsHistory(correlationId),
  ]);

  const activeWindow = windows.ok ? windows.data.find(isActiveNow) : undefined;

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader title={t.title} subtitle={t.subtitle} />

      {/* Bandeau : fenêtre réellement active ou en cours, rien d'autre. */}
      {activeWindow !== undefined ? (
        <Alert
          variant="warning"
          title={
            activeWindow.status === 'in_progress'
              ? t.maintenance.bannerActive(activeWindow.title)
              : t.maintenance.bannerScheduled(activeWindow.title)
          }
        >
          {activeWindow.bannerMessage ??
            `${formatDateTime(activeWindow.startsAt)} → ${formatDateTime(activeWindow.endsAt)}`}
        </Alert>
      ) : null}

      <Alert variant="info" title={t.settingsSection}>
        {t.noSecretsNote}
      </Alert>

      {/* Paramètres */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">{t.settingsSection}</CardTitle>
        </CardHeader>
        {!settings.ok ? (
          <ErrorState
            title={frAdminData.common.loadError}
            description={settings.error.userMessage}
            correlationId={correlationId}
          />
        ) : settings.data.length === 0 ? (
          <p className="text-body-sm text-text-secondary">{t.emptySettings}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {settings.data.map((setting) => (
              <li key={setting.key} className="border-border border-b pb-3 last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-body-sm text-text-primary font-mono font-medium">
                      {setting.key}
                    </p>
                    <p className="text-caption text-text-muted">
                      {setting.description ?? frAdminData.common.none}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <code className="text-body-sm text-text-secondary max-w-[28ch] truncate font-mono">
                      {JSON.stringify(setting.value)}
                    </code>
                    <Badge tone={setting.scope === 'member' ? 'info' : 'neutral'}>
                      {t.scope[setting.scope] ?? setting.scope}
                    </Badge>
                  </div>
                </div>
                <p className="text-caption text-text-muted mt-1">
                  {t.colUpdated} : {formatDateTime(setting.updatedAt)}
                  {setting.updatedBy !== null ? ` — ${setting.updatedBy}` : ''}
                </p>
                <details className="mt-2">
                  <summary className={DISCLOSURE}>{t.editSetting}</summary>
                  <div className="mt-3 max-w-xl">
                    <SettingForm existing={setting} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        <details className="mt-4">
          <summary className={DISCLOSURE}>{t.newSetting}</summary>
          <div className="mt-3 max-w-xl">
            <SettingForm />
          </div>
        </details>
      </Card>

      {/* Feature flags */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">{t.flagsSection}</CardTitle>
        </CardHeader>
        {!flags.ok ? (
          <ErrorState
            title={frAdminData.common.loadError}
            description={flags.error.userMessage}
            correlationId={correlationId}
          />
        ) : flags.data.length === 0 ? (
          <p className="text-body-sm text-text-secondary">{t.emptyFlags}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {flags.data.map((flag) => (
              <li key={flag.code} className="border-border border-b pb-3 last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-body-sm text-text-primary font-medium">
                      {flag.name}{' '}
                      <span className="text-caption text-text-muted font-mono">({flag.code})</span>
                    </p>
                    {flag.description !== null ? (
                      <p className="text-caption text-text-muted">{flag.description}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={flag.isEnabled ? 'success' : 'neutral'}>
                      {flag.isEnabled ? frAdminData.common.yes : frAdminData.common.no}
                    </Badge>
                    <Badge tone="info">
                      {t.strategy[flag.rolloutStrategy] ?? flag.rolloutStrategy}
                    </Badge>
                  </div>
                </div>
                <details className="mt-2">
                  <summary className={DISCLOSURE}>{t.editSetting}</summary>
                  <div className="mt-3 max-w-xl">
                    <FlagForm existing={flag} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        <details className="mt-4">
          <summary className={DISCLOSURE}>{t.newFlag}</summary>
          <div className="mt-3 max-w-xl">
            <FlagForm />
          </div>
        </details>
      </Card>

      {/* Maintenance planifiée */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">{t.maintenance.section}</CardTitle>
        </CardHeader>
        <p className="text-caption text-text-muted mb-4">{t.maintenance.plannedVsActualNote}</p>
        {!windows.ok ? (
          <ErrorState
            title={frAdminData.common.loadError}
            description={windows.error.userMessage}
            correlationId={correlationId}
          />
        ) : windows.data.length === 0 ? (
          <EmptyState title={t.maintenance.empty} description={frAdminData.common.emptyGeneric} />
        ) : (
          <ul className="flex flex-col gap-4">
            {windows.data.map((window) => (
              <li key={window.id} className="border-border border-b pb-4 last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-body-sm text-text-primary font-medium">{window.title}</p>
                    <p className="text-caption text-text-muted">
                      {t.maintenance.colPeriod} : {formatDateTime(window.startsAt)} →{' '}
                      {formatDateTime(window.endsAt)}
                    </p>
                    {window.actualStartedAt !== null ? (
                      <p className="text-caption text-text-muted">
                        {t.maintenance.colActual} : {formatDateTime(window.actualStartedAt)} →{' '}
                        {formatDateTime(window.actualEndedAt)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">
                      {t.maintenance.scope[window.affectedScope] ?? window.affectedScope}
                    </Badge>
                    <Badge
                      tone={
                        window.status === 'in_progress'
                          ? 'warning'
                          : window.status === 'scheduled'
                            ? 'info'
                            : window.status === 'completed'
                              ? 'success'
                              : 'neutral'
                      }
                    >
                      {t.maintenance.status[window.status] ?? window.status}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3">
                  <MaintenanceTransitions window={window} />
                </div>
                {window.status === 'scheduled' ? (
                  <details className="mt-2">
                    <summary className={DISCLOSURE}>{t.editSetting}</summary>
                    <div className="mt-3 max-w-xl">
                      <MaintenanceForm existing={window} />
                    </div>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <details className="mt-4">
          <summary className={DISCLOSURE}>{t.maintenance.newWindow}</summary>
          <div className="mt-3 max-w-xl">
            <MaintenanceForm />
          </div>
        </details>
      </Card>

      {/* Historique journalisé */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">{t.historySection}</CardTitle>
        </CardHeader>
        {!history.ok ? (
          <ErrorState
            title={frAdminData.common.loadError}
            description={history.error.userMessage}
            correlationId={correlationId}
          />
        ) : history.data.length === 0 ? (
          <p className="text-body-sm text-text-secondary">{t.historyEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.data.map((entry) => (
              <li
                key={entry.id}
                className="border-border flex flex-wrap items-baseline gap-2 border-b pb-2 last:border-0"
              >
                <span className="text-caption text-text-muted tabular-nums">
                  {formatDateTime(entry.createdAt)}
                </span>
                <span className="text-body-sm text-text-primary font-medium">{entry.action}</span>
                <span className="text-body-sm text-text-secondary font-mono">
                  {entry.objectId ?? frAdminData.common.none}
                </span>
                {entry.actorName !== null ? (
                  <span className="text-caption text-text-muted">{entry.actorName}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
