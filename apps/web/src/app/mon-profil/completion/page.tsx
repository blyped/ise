import Link from 'next/link';
import { Badge, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import { loadMissingItems, loadMyCompletion } from '@/lib/queries/onboarding';
import { loadCompletionRules } from '@/lib/queries/profile-extras';
import { impactLevel, profileBlockRoute } from '@/lib/profile-blocks';
import { ProfilePage } from '@/components/profile/ProfilePage';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProfile.completion.title };

const t = frProfile.completion;

const PRIMARY_LINK =
  'inline-flex h-[40px] items-center justify-center rounded-base bg-primary px-5 text-body-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';
const LINK_CLASS =
  'text-body-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

const IMPACT_LABEL = {
  strong: t.weightStrong,
  medium: t.weightMedium,
  light: t.weightLight,
} as const;
const IMPACT_TONE = { strong: 'success', medium: 'warning', light: 'info' } as const;

/**
 * ISE-030 — Completion du profil.
 * Score par `my_profile_completion()`, manques par
 * `my_profile_missing_items()` : le score est PRIVE (D-72), jamais
 * presente comme un classement (MASTER PROMPT §17). Les priorites
 * suivent les ponderations reelles de `profile_completion_rules`.
 */
export default async function CompletionPage() {
  const context = await requireProfile();

  const data = context.ok
    ? await Promise.all([
        loadMyCompletion(),
        loadMissingItems(context.correlationId),
        loadCompletionRules(context.correlationId),
      ])
    : null;

  const completion = data?.[0] ?? null;
  const missing = data !== null && data[1].ok ? data[1].data : [];
  const rules = data !== null && data[2].ok ? data[2].data : [];
  const missingKeys = new Set(missing.map((item) => item.blockKey));
  const priorities = [...missing].sort((a, b) => b.weight - a.weight).slice(0, 3);

  return (
    <ProfilePage
      context={context}
      currentPath={PROFILE_ROUTES.completion}
      title={t.title}
      subtitle={t.subtitle}
    >
      {data === null ? null : !data[1].ok || !data[2].ok ? (
        <ErrorState
          title={frProfile.common.loadErrorTitle}
          description={frProfile.common.loadErrorBody}
          correlationId={context.ok ? context.correlationId : ''}
        />
      ) : (
        <div className="flex flex-col gap-7">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="min-w-[240px] flex-1">
                {completion === null ? (
                  <p className="text-body text-text-secondary">{t.scoreUnknown}</p>
                ) : (
                  <>
                    <p className="text-text-primary text-[40px] font-bold leading-none">
                      {t.scoreValue.replace('{value}', String(completion))}{' '}
                      <span className="text-body text-text-secondary font-normal">
                        {t.scoreCompleted}
                      </span>
                    </p>
                    <div
                      className="bg-surface-muted mt-4 h-[8px] w-full max-w-[420px] overflow-hidden rounded-full"
                      role="progressbar"
                      aria-valuenow={completion}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={t.title}
                    >
                      <span
                        className="bg-primary block h-full rounded-full"
                        style={{ width: `${completion}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="max-w-[360px]">
                <p className="text-body-sm text-text-primary font-semibold">{t.privacyNote}</p>
                <p className="text-caption text-text-secondary mt-1">{t.privacyBody}</p>
              </div>
            </div>
          </Card>

          <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section aria-label={t.prioritiesTitle} className="flex flex-col gap-5">
              <h2 className="text-h3 text-text-primary font-bold">{t.prioritiesTitle}</h2>

              {priorities.length === 0 ? (
                <Card>
                  <p className="text-body text-text-secondary">{t.prioritiesEmpty}</p>
                </Card>
              ) : (
                priorities.map((item, index) => {
                  const impact = impactLevel(item.weight);
                  return (
                    <Card key={item.blockKey}>
                      <div className="flex flex-wrap items-start justify-between gap-5">
                        <div className="flex min-w-0 items-start gap-4">
                          <span
                            className="text-body-sm text-primary rounded-base flex h-10 w-10 shrink-0 items-center justify-center bg-[#EFF6FF] font-semibold"
                            aria-hidden="true"
                          >
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-body text-text-primary font-semibold">
                              {item.label}
                            </h3>
                            {item.hint ? (
                              <p className="text-caption text-text-secondary mt-1">{item.hint}</p>
                            ) : null}
                            <p className="text-caption text-text-muted mt-1">
                              {t.weightHint.replace('{weight}', String(item.weight))}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-3">
                          <Badge tone={IMPACT_TONE[impact]}>{IMPACT_LABEL[impact]}</Badge>
                          <Link href={profileBlockRoute(item.blockKey)} className={PRIMARY_LINK}>
                            {t.complete}
                            <span className="sr-only"> — {item.label}</span>
                          </Link>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}

              <Card>
                <CardHeader>
                  <CardTitle as="h2">{t.improvesTitle}</CardTitle>
                </CardHeader>
                <ul className="flex list-disc flex-col gap-2 pl-5">
                  {t.improvesItems.map((item) => (
                    <li key={item} className="text-body-sm text-text-secondary">
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            </section>

            <aside className="flex flex-col gap-5">
              <Card>
                <CardHeader>
                  <CardTitle as="h2">{t.sectionsTitle}</CardTitle>
                </CardHeader>
                <ul className="flex flex-col gap-3">
                  {rules.map((rule) => (
                    <li key={rule.blockKey} className="flex items-center justify-between gap-4">
                      <Link href={profileBlockRoute(rule.blockKey)} className={LINK_CLASS}>
                        {rule.label}
                      </Link>
                      <Badge tone={missingKeys.has(rule.blockKey) ? 'warning' : 'success'}>
                        {missingKeys.has(rule.blockKey) ? t.sectionPartial : t.sectionComplete}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle as="h2">{t.controlTitle}</CardTitle>
                </CardHeader>
                <p className="text-body-sm text-text-secondary">{t.controlBody}</p>
                <p className="mt-4">
                  <Link href={PROFILE_ROUTES.missingItems} className={LINK_CLASS}>
                    {t.seeMissing}
                  </Link>
                </p>
              </Card>
            </aside>
          </div>
        </div>
      )}
    </ProfilePage>
  );
}
