import Link from 'next/link';
import { Alert, Badge, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import { newCorrelationId } from '@/lib/correlation';
import { requireCmsAccess } from '@/lib/cms/permissions';
import { loadScheduleOrders } from '@/lib/cms/queries';
import { conflictsByOrder, detectScheduleConflicts } from '@/lib/cms/conflicts';
import { formatDateTime, formatWeekday, scheduleStatusTone } from '@/lib/cms/format';
import { CmsShell } from '../_components/CmsShell';
import { PageHeader } from '../_components/PageHeader';
import { RowCard, RowList } from '../_components/RowCard';
import { ActionButton } from '../_components/ActionButton';
import { ScheduleForm } from './ScheduleForm';
import { cancelScheduleAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCms.schedule.title };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Lundi de la semaine contenant `date`, a minuit UTC. */
function startOfWeek(date: Date): Date {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = (copy.getUTCDay() + 6) % 7; // lundi = 0
  return new Date(copy.getTime() - weekday * DAY_MS);
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const NAV_LINK =
  'inline-flex min-h-[44px] items-center rounded-base border border-[#CBD5E1] bg-surface px-4 ' +
  'text-body-sm font-medium text-text-primary hover:border-primary ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * CMS-009 — Programmation globale (ADDENDUM §40).
 *
 * Calendrier, contenus futurs, dates de debut et de fin, DETECTION DE
 * CONFLITS, statut.
 *
 * La detection est une fonction pure (`lib/cms/conflicts.ts`), testee
 * separement. Elle SIGNALE, elle ne corrige pas : arbitrer entre deux
 * ordres contradictoires est un acte editorial, pas une decision de
 * l'ecran.
 */
export default async function CmsSchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireCmsAccess();
  const params = await searchParams;
  const weekParam = params['semaine'];
  const anchor =
    typeof weekParam === 'string' && !Number.isNaN(Date.parse(weekParam))
      ? new Date(weekParam)
      : new Date();

  const correlationId = newCorrelationId();
  const orders = await loadScheduleOrders(correlationId);
  const canSchedule = access.can('cms.schedule');

  const shell = (children: React.ReactNode) => (
    <CmsShell currentPath={CMS_ROUTES.schedule} screenTitle={frCms.schedule.title}>
      {children}
    </CmsShell>
  );

  if (!orders.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title={frCms.schedule.title} subtitle={frCms.schedule.subtitle} />
        <ErrorState
          title={frCms.common.loadError}
          description={orders.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const rows = orders.data;
  const conflicts = detectScheduleConflicts(rows);
  const conflictIndex = conflictsByOrder(conflicts);

  const weekStart = startOfWeek(anchor);
  const days = Array.from(
    { length: 7 },
    (_, index) => new Date(weekStart.getTime() + index * DAY_MS),
  );
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);
  const today = isoDay(new Date());

  const inWeek = (value: string | null): boolean => {
    if (value === null) return false;
    const time = Date.parse(value);
    return time >= weekStart.getTime() && time < weekEnd.getTime();
  };

  const countForDay = (day: Date): number => {
    const dayIso = isoDay(day);
    return rows.filter(
      (order) =>
        (order.publishAt !== null && order.publishAt.slice(0, 10) === dayIso) ||
        (order.unpublishAt !== null && order.unpublishAt.slice(0, 10) === dayIso),
    ).length;
  };

  const weekRows = rows.filter((order) => inWeek(order.publishAt) || inWeek(order.unpublishAt));
  const futureRows = rows.filter(
    (order) =>
      order.status === 'pending' &&
      ((order.publishAt !== null && Date.parse(order.publishAt) >= weekEnd.getTime()) ||
        (order.unpublishAt !== null && Date.parse(order.unpublishAt) >= weekEnd.getTime())),
  );

  const previousWeek = isoDay(new Date(weekStart.getTime() - 7 * DAY_MS));
  const nextWeek = isoDay(new Date(weekStart.getTime() + 7 * DAY_MS));

  const renderOrder = (order: (typeof rows)[number]) => {
    const kinds = conflictIndex.get(order.id) ?? [];
    return (
      <RowCard
        key={order.id}
        title={order.label ?? `${frCms.schedule.entityTypes[order.entityType] ?? order.entityType}`}
        meta={`${frCms.schedule.entityTypes[order.entityType] ?? order.entityType} · ${order.entityId}`}
        statusText={frCms.scheduleStatus[order.status] ?? order.status}
        status={
          order.status === 'applied'
            ? 'published'
            : order.status === 'failed'
              ? 'expired'
              : 'scheduled'
        }
        period={
          <span className="flex flex-col">
            <span>
              {frCms.schedule.start} : {formatDateTime(order.publishAt)}
            </span>
            <span>
              {frCms.schedule.end} : {formatDateTime(order.unpublishAt)}
            </span>
          </span>
        }
        notice={
          <>
            {kinds.length > 0 ? (
              <span className="text-caption text-error">
                {kinds
                  .map((kind) =>
                    kind === 'overlap'
                      ? frCms.schedule.conflictOverlap
                      : kind === 'contradiction'
                        ? frCms.schedule.conflictContradiction
                        : kind === 'overdue'
                          ? frCms.schedule.conflictOverdue
                          : frCms.schedule.conflictFailed,
                  )
                  .join(' · ')}
              </span>
            ) : null}
            {order.lastError !== null ? (
              <span className="text-caption text-error">
                {frCms.schedule.lastError} : {order.lastError}
              </span>
            ) : null}
            {order.runCount > 0 ? (
              <span className="text-caption text-text-muted">
                {frCms.schedule.runCount} : {order.runCount}
              </span>
            ) : null}
          </>
        }
        actions={
          order.status === 'pending' ? (
            <ActionButton
              action={cancelScheduleAction}
              fields={{ orderId: order.id }}
              label={frCms.schedule.cancelOrder}
              srLabel={`${frCms.schedule.cancelOrder} — ${order.label ?? order.entityId}`}
              disabled={!canSchedule}
              {...(canSchedule ? {} : { disabledReason: frCms.common.forbidden })}
            />
          ) : (
            <Badge tone={scheduleStatusTone(order.status)}>
              {frCms.scheduleStatus[order.status] ?? order.status}
            </Badge>
          )
        }
      />
    );
  };

  return shell(
    <div className="flex flex-col gap-8">
      <PageHeader title={frCms.schedule.title} subtitle={frCms.schedule.subtitle} />

      <nav aria-label={frCms.schedule.weekLabel} className="flex flex-wrap items-center gap-3">
        <Link href={`${CMS_ROUTES.schedule}?semaine=${previousWeek}`} className={NAV_LINK}>
          ← {frCms.schedule.previousWeek}
        </Link>
        <Link href={CMS_ROUTES.schedule} className={NAV_LINK}>
          {frCms.schedule.today}
        </Link>
        <Link href={`${CMS_ROUTES.schedule}?semaine=${nextWeek}`} className={NAV_LINK}>
          {frCms.schedule.nextWeek} →
        </Link>
      </nav>

      <ol
        aria-label={frCms.schedule.weekLabel}
        className="border-border bg-surface grid gap-3 rounded-lg border p-4 sm:grid-cols-4 lg:grid-cols-7"
      >
        {days.map((day) => {
          const count = countForDay(day);
          const isToday = isoDay(day) === today;
          return (
            <li
              key={isoDay(day)}
              aria-current={isToday ? 'date' : undefined}
              className={`rounded-base flex min-h-[64px] flex-col items-center justify-center border px-2 py-3 ${
                isToday ? 'border-[#BFDBFE] bg-[#EFF6FF]' : 'border-border'
              }`}
            >
              <span className="text-caption text-text-secondary font-semibold">
                {day.getUTCDate()} {formatWeekday(day)}
              </span>
              <span className="text-caption text-text-muted">
                {count === 0 ? frCms.schedule.dayNothing : `${count} ordre(s)`}
              </span>
            </li>
          );
        })}
      </ol>

      <section aria-labelledby="cms-conflits" className="flex flex-col gap-3">
        <h2 id="cms-conflits" className="text-h3 text-text-primary font-semibold">
          {frCms.schedule.conflictsTitle}
        </h2>
        {conflicts.length === 0 ? (
          <Alert variant="success" title={frCms.schedule.conflictsTitle}>
            {frCms.schedule.noConflicts}
          </Alert>
        ) : (
          <ul className="flex flex-col gap-2">
            {conflicts.map((conflict, index) => (
              <li key={`${conflict.kind}-${index}`}>
                <Alert
                  variant={conflict.kind === 'overdue' ? 'warning' : 'error'}
                  title={frCms.schedule.conflictsTitle}
                >
                  {conflict.kind === 'overlap'
                    ? frCms.schedule.conflictOverlap
                    : conflict.kind === 'contradiction'
                      ? frCms.schedule.conflictContradiction
                      : conflict.kind === 'overdue'
                        ? frCms.schedule.conflictOverdue
                        : frCms.schedule.conflictFailed}
                  {' — '}
                  {frCms.schedule.entityTypes[conflict.entityType] ?? conflict.entityType}{' '}
                  <code className="font-mono">{conflict.entityId}</code>
                </Alert>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="cms-semaine" className="flex flex-col gap-4">
        <h2 id="cms-semaine" className="text-h3 text-text-primary font-semibold">
          {frCms.schedule.weekLabel}
        </h2>
        {weekRows.length === 0 ? (
          <EmptyState title={frCms.schedule.emptyTitle} description={frCms.schedule.emptyBody} />
        ) : (
          <RowList label={frCms.schedule.weekLabel}>{weekRows.map(renderOrder)}</RowList>
        )}
      </section>

      {futureRows.length > 0 ? (
        <section aria-labelledby="cms-futurs" className="flex flex-col gap-4">
          <h2 id="cms-futurs" className="text-h3 text-text-primary font-semibold">
            Contenus programmés au-delà de cette semaine
          </h2>
          <RowList label="Contenus futurs">{futureRows.map(renderOrder)}</RowList>
        </section>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frCms.schedule.add}</CardTitle>
        </CardHeader>
        <ScheduleForm canSchedule={canSchedule} />
      </Card>

      <section
        aria-label={frCms.schedule.checksTitle}
        className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-5"
      >
        <p className="text-body-sm text-primary font-semibold">{frCms.schedule.checksTitle}</p>
        <ul className="text-caption text-text-secondary mt-2 flex flex-col gap-1">
          <li>✓ {frCms.schedule.checkExpiry}</li>
          <li>✓ {frCms.schedule.checkSponsored}</li>
          <li>✓ {frCms.schedule.checkTimezone}</li>
        </ul>
      </section>
    </div>,
  );
}
