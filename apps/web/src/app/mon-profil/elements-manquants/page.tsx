import Link from 'next/link';
import { Badge, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import { loadMissingItems } from '@/lib/queries/onboarding';
import { profileBlockRoute } from '@/lib/profile-blocks';
import { ProfilePage } from '@/components/profile/ProfilePage';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProfile.missing.title };

const t = frProfile.missing;

const PRIMARY_LINK =
  'inline-flex h-[40px] items-center justify-center rounded-base bg-primary px-5 text-body-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-031 — Elements manquants & suggestions.
 * Source unique : `my_profile_missing_items()` (D-72 : sans parametre,
 * aucun tiers atteignable). Les priorites suivent les ponderations
 * REELLES de la base ; rien n'est presente comme un classement
 * (MASTER PROMPT §17), et chaque manque pointe vers son ecran d'edition.
 */
export default async function MissingItemsPage() {
  const context = await requireProfile();
  const missing = context.ok ? await loadMissingItems(context.correlationId) : null;

  const items = missing !== null && missing.ok ? missing.data : [];
  const sorted = [...items].sort((a, b) => b.weight - a.weight);
  const priorities = sorted.slice(0, 3);
  const secondary = sorted.slice(3);

  return (
    <ProfilePage
      context={context}
      currentPath={PROFILE_ROUTES.missingItems}
      title={t.title}
      subtitle={t.subtitle}
    >
      {missing === null ? null : !missing.ok ? (
        <ErrorState
          title={frProfile.common.loadErrorTitle}
          description={missing.error.userMessage}
          correlationId={context.ok ? context.correlationId : ''}
        />
      ) : (
        <div className="flex flex-col gap-7">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-body text-text-primary font-semibold">
                {items.length === 0
                  ? t.summaryNone
                  : t.summaryCount.replace('{count}', String(items.length))}
              </p>
              <Badge tone="success">{t.noBlocking}</Badge>
            </div>
          </Card>

          <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex flex-col gap-5">
              {priorities.length > 0 ? (
                <section aria-label={t.priorityTitle} className="flex flex-col gap-5">
                  <h2 className="text-h3 text-text-primary font-bold">{t.priorityTitle}</h2>
                  {priorities.map((item, index) => (
                    <Card key={item.blockKey}>
                      <div className="flex flex-wrap items-start justify-between gap-5">
                        <div className="min-w-0">
                          <Badge tone="warning">
                            {t.priorityBadge.replace('{rank}', String(index + 1))}
                          </Badge>
                          <h3 className="text-body text-text-primary mt-3 font-semibold">
                            {item.label}
                          </h3>
                          {item.hint ? (
                            <p className="text-caption text-text-secondary mt-1">{item.hint}</p>
                          ) : null}
                          <p className="text-caption text-text-muted mt-1">
                            {t.progressLabel.replace(
                              '{value}',
                              String(Math.round(item.completionRatio * 100)),
                            )}
                          </p>
                        </div>
                        <Link href={profileBlockRoute(item.blockKey)} className={PRIMARY_LINK}>
                          {t.complete}
                          <span className="sr-only"> — {item.label}</span>
                        </Link>
                      </div>
                    </Card>
                  ))}
                </section>
              ) : null}

              {secondary.length > 0 ? (
                <Card className="bg-surface-muted">
                  <CardHeader>
                    <CardTitle as="h2">{t.secondaryTitle}</CardTitle>
                    <p className="text-caption text-text-secondary">{t.secondaryHint}</p>
                  </CardHeader>
                  <ul className="flex flex-wrap gap-3">
                    {secondary.map((item) => (
                      <li key={item.blockKey}>
                        <Link
                          href={profileBlockRoute(item.blockKey)}
                          className="border-border bg-surface text-body-sm text-text-secondary hover:text-text-primary rounded-full border px-5 py-2 font-medium"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}
            </div>

            <aside className="flex flex-col gap-5">
              <Card>
                <CardHeader>
                  <CardTitle as="h2">{t.usableTitle}</CardTitle>
                </CardHeader>
                <p className="text-body-sm text-text-secondary">{t.usableBody}</p>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle as="h2">{t.whyTitle}</CardTitle>
                </CardHeader>
                <p className="text-body-sm text-text-secondary">{t.whyBody}</p>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle as="h2">{t.afterTitle}</CardTitle>
                </CardHeader>
                <p className="text-body-sm text-text-secondary">{t.afterBody}</p>
              </Card>
            </aside>
          </div>
        </div>
      )}
    </ProfilePage>
  );
}
