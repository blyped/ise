import Link from 'next/link';
import { Alert, Badge, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { AVAILABILITY_ROUTES } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import { loadAvailabilityTypes } from '@/lib/queries/reference';
import { loadAvailabilityDetails, type AvailabilityDetail } from '@/lib/queries/profile-extras';
import { ProfilePage } from '@/components/profile/ProfilePage';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProfile.availability.title };

const t = frProfile.availability;

const PRIMARY_LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base bg-primary px-6 text-body-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/** 90 jours sans mise a jour : l'ecran invite a actualiser (seuil documente). */
const STALE_AFTER_DAYS = 90;

function frenchDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(iso));
}

/**
 * Valeur commune aux types actifs, ou `null` si les declarations
 * divergent : rien n'est moyenne ni invente.
 */
function consensus<T>(rows: readonly AvailabilityDetail[], pick: (row: AvailabilityDetail) => T) {
  if (rows.length === 0) return { value: null as T | null, mixed: false };
  const first = pick(rows[0] as AvailabilityDetail);
  const mixed = rows.some((row) => pick(row) !== first);
  return { value: mixed ? null : first, mixed };
}

/**
 * ISE-032 — Ma disponibilite.
 * 14 types reels du referentiel ; etat, preferences et note viennent de
 * `profile_availabilities`. La disponibilite ne vaut jamais obligation
 * d'accepter (MASTER PROMPT §20) — l'ecran le rappelle.
 */
export default async function AvailabilityPage() {
  const context = await requireProfile();

  const data = context.ok
    ? await Promise.all([
        loadAvailabilityTypes(context.correlationId),
        loadAvailabilityDetails(context.profile.id, context.correlationId),
      ])
    : null;

  const types = data !== null && data[0].ok ? data[0].data : [];
  const details = data !== null && data[1].ok ? data[1].data : [];
  const byCode = new Map(details.map((detail) => [detail.code, detail]));
  const activeRows = details.filter((detail) => detail.active);

  const lastUpdated =
    details.length > 0
      ? details.reduce(
          (max, row) => (row.updatedAt > max ? row.updatedAt : max),
          details[0]!.updatedAt,
        )
      : null;
  const isStale =
    lastUpdated !== null &&
    Date.now() - new Date(lastUpdated).getTime() > STALE_AFTER_DAYS * 24 * 3600 * 1000;

  const frequency = consensus(activeRows, (row) => row.maxPerMonth);
  const delay = consensus(activeRows, (row) => row.idealDelayDays);
  const channel = consensus(activeRows, (row) => row.preferredChannel);
  const visibility = consensus(activeRows, (row) => row.visibility);
  const notes = consensus(activeRows, (row) => row.notes);

  return (
    <ProfilePage
      context={context}
      currentPath={AVAILABILITY_ROUTES.overview}
      title={t.title}
      subtitle={t.subtitle}
      action={
        <Link href={AVAILABILITY_ROUTES.edit} className={PRIMARY_LINK}>
          {t.edit}
        </Link>
      }
    >
      {data === null ? null : !data[0].ok || !data[1].ok ? (
        <ErrorState
          title={frProfile.common.loadErrorTitle}
          description={frProfile.common.loadErrorBody}
          correlationId={context.ok ? context.correlationId : ''}
        />
      ) : details.length === 0 ? (
        <EmptyState
          title={t.emptyTitle}
          description={t.emptyBody}
          action={
            <Link href={AVAILABILITY_ROUTES.edit} className={PRIMARY_LINK}>
              {t.edit}
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-7">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="flex min-w-0 items-center gap-5">
                <Badge tone={activeRows.length > 0 ? 'success' : 'neutral'}>
                  {activeRows.length > 0 ? t.availableBadge : t.unavailableBadge}
                </Badge>
                <p className="text-body text-text-primary font-semibold">
                  {activeRows.length > 0
                    ? t.summaryActive
                        .replace('{count}', String(activeRows.length))
                        .replace('{total}', String(types.length))
                    : t.summaryNone}
                </p>
              </div>
              {lastUpdated !== null ? (
                <div className="text-right">
                  <p className="text-caption text-text-muted">
                    {t.updatedAt.replace('{date}', frenchDate(lastUpdated))}
                  </p>
                  {isStale ? (
                    <p className="text-caption mt-1 font-semibold text-[#A16207]">{t.staleHint}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Card>

          <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section aria-label={t.typesTitle} className="flex flex-col gap-4">
              <h2 className="text-h3 text-text-primary font-bold">{t.typesTitle}</h2>
              <ul className="flex flex-col gap-4">
                {types.map((type) => {
                  const declared = byCode.get(type.code);
                  return (
                    <Card as="li" key={type.code}>
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="text-body text-text-primary font-semibold">{type.name}</h3>
                          {type.description ? (
                            <p className="text-caption text-text-secondary mt-1">
                              {type.description}
                            </p>
                          ) : null}
                          {declared?.active && declared.notes ? (
                            <p className="text-caption text-text-muted mt-2">
                              {t.noteTitle} : {declared.notes}
                            </p>
                          ) : null}
                        </div>
                        <Badge
                          tone={
                            declared === undefined
                              ? 'neutral'
                              : declared.active
                                ? 'success'
                                : 'neutral'
                          }
                        >
                          {declared === undefined
                            ? t.notDeclared
                            : declared.active
                              ? t.active
                              : t.inactive}
                        </Badge>
                      </div>
                    </Card>
                  );
                })}
              </ul>
            </section>

            <aside className="flex flex-col gap-5">
              <Card>
                <CardHeader>
                  <CardTitle as="h2">{t.preferencesTitle}</CardTitle>
                </CardHeader>
                <dl className="flex flex-col gap-3">
                  {(
                    [
                      [
                        t.frequencyLabel,
                        frequency.mixed
                          ? t.mixedValues
                          : frequency.value === null
                            ? t.notProvided
                            : t.frequencyValue.replace('{count}', String(frequency.value)),
                      ],
                      [
                        t.delayLabel,
                        delay.mixed
                          ? t.mixedValues
                          : delay.value === null
                            ? t.notProvided
                            : t.delayValue.replace('{count}', String(delay.value)),
                      ],
                      [
                        t.channelLabel,
                        channel.mixed
                          ? t.mixedValues
                          : channel.value === null
                            ? t.notProvided
                            : t.channel[channel.value],
                      ],
                      [
                        t.visibilityLabel,
                        visibility.mixed
                          ? t.mixedValues
                          : visibility.value === null
                            ? t.notProvided
                            : frProfile.visibility[visibility.value],
                      ],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-4">
                      <dt className="text-caption text-text-muted">{label}</dt>
                      <dd className="text-body-sm text-text-primary text-right font-semibold">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {notes.value !== null && !notes.mixed ? (
                  <p className="text-caption text-text-secondary mt-4">
                    {t.noteTitle} : {notes.value}
                  </p>
                ) : null}
              </Card>

              <Alert variant="warning" title={t.obligationTitle}>
                {t.obligationBody} {t.obligationReminder}
              </Alert>

              <Card>
                <CardHeader>
                  <CardTitle as="h2">{t.visibleTitle}</CardTitle>
                </CardHeader>
                <p className="text-body-sm text-text-secondary">{t.visibleBody}</p>
              </Card>
            </aside>
          </div>
        </div>
      )}
    </ProfilePage>
  );
}
