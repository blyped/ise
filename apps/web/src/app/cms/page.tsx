import Link from 'next/link';
import { Alert, Badge, Card, ErrorState } from '@ise/ui-web';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import { newCorrelationId } from '@/lib/correlation';
import { requireCmsAccess } from '@/lib/cms/permissions';
import { loadCmsAutomationStatus, loadCmsDashboard } from '@/lib/cms/queries';
import { formatLongDateTime } from '@/lib/cms/format';
import { CmsShell } from './_components/CmsShell';
import { PageHeader } from './_components/PageHeader';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCms.dashboard.title };

const MANAGE_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/**
 * CMS-001 — Tableau de bord CMS (ADDENDUM §31).
 *
 * DONNEES REELLES UNIQUEMENT. Chaque compteur vient de
 * `public.get_cms_dashboard()`, qui compte les lignes existantes. Un
 * compteur a zero affiche zero : c'est la reponse correcte quand rien
 * n'existe encore, pas une erreur de chargement (MASTER PROMPT §98). Les
 * valeurs 7 / 3 / 1 / 2 des maquettes sont illustratives et n'apparaissent
 * nulle part dans ce fichier.
 *
 * L'etat des automatisations vient de `get_cms_automation_status()`, qui
 * lit `cron.job` et `cron.job_run_details`. Une tache n'est declaree
 * active que si l'ordonnanceur la contient (D-129).
 */
export default async function CmsDashboardPage() {
  const access = await requireCmsAccess();
  const correlationId = newCorrelationId();

  const [dashboard, automation] = await Promise.all([
    loadCmsDashboard(correlationId),
    loadCmsAutomationStatus(correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <CmsShell currentPath={CMS_ROUTES.dashboard} screenTitle={frCms.dashboard.title}>
      {children}
    </CmsShell>
  );

  if (!dashboard.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title={frCms.dashboard.title} subtitle={frCms.dashboard.subtitle} />
        <ErrorState
          title={frCms.common.loadError}
          description={dashboard.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const data = dashboard.data;
  const alertTotal = data.alerts.reduce((sum, alert) => sum + alert.count, 0);

  const kpis = [
    { value: data.publishedToday, label: frCms.dashboard.kpiPublishedToday },
    { value: data.schedule['pending'] ?? 0, label: frCms.dashboard.kpiScheduled },
    { value: data.carousel['live_now'] ?? 0, label: frCms.dashboard.kpiCarouselLive },
    { value: alertTotal, label: frCms.dashboard.kpiAlerts },
  ];

  const cards = [
    {
      href: CMS_ROUTES.carousel,
      title: frCms.dashboard.cardCarousel,
      meta: `${data.carousel['published'] ?? 0} publiée(s) · ${data.carousel['scheduled'] ?? 0} programmée(s) · ${data.carousel['draft'] ?? 0} brouillon(s)`,
    },
    {
      href: CMS_ROUTES.sections,
      title: frCms.dashboard.cardSections,
      meta: `${data.sections['enabled'] ?? 0} active(s) sur ${data.sections['total'] ?? 0} · ${data.sections['published'] ?? 0} publiée(s)`,
    },
    {
      href: CMS_ROUTES.news,
      title: frCms.dashboard.cardNews,
      meta: `${data.news['landing_visible'] ?? 0} visible(s) sur la landing · ${data.news['featured'] ?? 0} à la une`,
    },
    {
      href: CMS_ROUTES.events,
      title: frCms.dashboard.cardEvents,
      meta: `${data.events['upcoming_visible'] ?? 0} visible(s) sur ${data.events['upcoming'] ?? 0} à venir`,
    },
    {
      href: CMS_ROUTES.featuredProfile,
      title: frCms.dashboard.cardFeatured,
      meta: `${data.featuredProfile.automationEnabled ? frCms.featured.automationOn : frCms.featured.automationOff} · ${
        data.featuredProfile.todayStatus === null
          ? frCms.featured.currentNone
          : (frCms.status[data.featuredProfile.todayStatus] ?? data.featuredProfile.todayStatus)
      }`,
    },
    {
      href: CMS_ROUTES.partners,
      title: frCms.dashboard.cardPartners,
      meta: `${data.partners['active'] ?? 0} campagne(s) en diffusion · ${data.partners['scheduled'] ?? 0} à venir`,
    },
    {
      href: CMS_ROUTES.media,
      title: frCms.dashboard.cardMedia,
      meta: `${data.media['total'] ?? 0} média(s) · ${data.media['variants'] ?? 0} variante(s)`,
    },
    {
      href: CMS_ROUTES.schedule,
      title: frCms.dashboard.cardSchedule,
      meta: `${data.schedule['pending'] ?? 0} en attente · ${data.schedule['failed'] ?? 0} en échec`,
    },
  ];

  return shell(
    <div className="flex flex-col gap-8">
      <PageHeader title={frCms.dashboard.title} subtitle={frCms.dashboard.subtitle} />

      <section
        aria-label={frCms.dashboard.title}
        className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4"
      >
        {kpis.map((kpi) => (
          <Card key={kpi.label} padding="sm">
            <p className="text-h2 text-text-primary font-bold">{kpi.value}</p>
            <p className="text-caption text-text-muted mt-1">{kpi.label}</p>
          </Card>
        ))}
      </section>

      <p className="text-caption text-text-muted">{frCms.dashboard.emptyCounters}</p>

      <section aria-label="Modules du CMS" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.href} padding="sm">
            <h2 className="text-body text-text-primary font-semibold">{card.title}</h2>
            <p className="text-caption text-text-muted mt-1">{card.meta}</p>
            <p className="mt-3">
              <Link href={card.href} className={MANAGE_LINK}>
                {frCms.common.manage} →
              </Link>
            </p>
          </Card>
        ))}
      </section>

      <section aria-labelledby="cms-alertes" className="flex flex-col gap-4">
        <h2 id="cms-alertes" className="text-h3 text-text-primary font-semibold">
          {frCms.dashboard.alertsTitle}
        </h2>
        {data.alerts.length === 0 ? (
          <Alert variant="success" title="Aucune alerte">
            {frCms.dashboard.noAlerts}
          </Alert>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.alerts.map((alert) => (
              <li key={alert.code}>
                <Alert
                  variant={
                    alert.severity === 'error'
                      ? 'error'
                      : alert.severity === 'warning'
                        ? 'warning'
                        : 'info'
                  }
                  title={frCms.dashboard.alertsTitle}
                >
                  {alert.count} {frCms.dashboard.alerts[alert.code] ?? alert.code}
                </Alert>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="cms-automatisations" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="cms-automatisations" className="text-h3 text-text-primary font-semibold">
            {frCms.dashboard.automationTitle}
          </h2>
          <p className="text-caption text-text-muted max-w-[70ch]">
            {frCms.dashboard.automationSubtitle}
          </p>
        </div>

        {!automation.ok ? (
          <Alert variant="warning" title="État indisponible">
            {frCms.dashboard.automationUnavailable}
          </Alert>
        ) : automation.data.length === 0 ? (
          <Alert variant="warning" title="État indisponible">
            {frCms.dashboard.automationUnavailable}
          </Alert>
        ) : (
          <ul className="flex flex-col gap-3">
            {automation.data.map((job) => (
              <li
                key={job.jobName}
                className="border-border bg-surface flex flex-col gap-2 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-body-sm text-text-primary font-semibold">
                    {frCms.dashboard.jobs[job.jobName] ?? job.jobName}
                  </p>
                  <p className="text-caption text-text-muted font-mono">{job.schedule}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={job.isActive ? 'success' : 'error'}>
                    {job.isActive
                      ? frCms.dashboard.automationActive
                      : frCms.dashboard.automationInactive}
                  </Badge>
                  <span className="text-caption text-text-secondary">
                    {job.lastRunAt === null
                      ? frCms.dashboard.automationNever
                      : `${frCms.dashboard.automationLastRun} : ${formatLongDateTime(job.lastRunAt)}${
                          job.lastStatus === null ? '' : ` · ${job.lastStatus}`
                        }`}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-label={frCms.dashboard.previewTitle}
        className="flex flex-col gap-4 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-6 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex flex-col gap-1">
          <p className="text-body text-primary font-semibold">{frCms.dashboard.previewTitle}</p>
          <p className="text-caption text-text-secondary">
            {data.lastPublishedAt === null
              ? frCms.dashboard.neverPublished
              : `${frCms.dashboard.lastPublication} : ${formatLongDateTime(data.lastPublishedAt)}`}
          </p>
        </div>
        <Link
          href={CMS_ROUTES.preview}
          className="rounded-base bg-primary text-body-sm hover:bg-primary-hover focus-visible:outline-active-blue inline-flex min-h-[44px] items-center justify-center px-6 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {frCms.dashboard.previewOpen}
        </Link>
      </section>

      {!access.can('cms.edit') ? (
        <Alert variant="info" title="Lecture seule">
          {frCms.common.readOnlyHint}
        </Alert>
      ) : null}
      <p className="text-caption text-text-muted lg:hidden">{frCms.common.mobileHint}</p>
    </div>,
  );
}
